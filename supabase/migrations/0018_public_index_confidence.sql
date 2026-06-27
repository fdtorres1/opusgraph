-- Public index confidence bridge.
-- Keeps legacy work.status physically present while public_tier becomes the
-- public visibility source of truth for works.

do $$ begin
  create type public_work_tier as enum ('draft','quarantined','indexed','verified','canonical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type confidence_level as enum ('confirmed','probable','inferred','conflicting','unknown','not_applicable');
exception when duplicate_object then null; end $$;

do $$ begin
  create type source_candidate_status as enum ('pending','needs_evidence','rejected','promoted','quarantined');
exception when duplicate_object then null; end $$;

alter table work
  add column if not exists public_tier public_work_tier not null default 'draft',
  add column if not exists field_confidence jsonb not null default '{}'::jsonb,
  add column if not exists evidence_summary jsonb not null default '{}'::jsonb,
  add column if not exists public_notes text,
  add column if not exists promoted_at timestamptz,
  add column if not exists promotion_gate_version text;

update work
set public_tier = case
  when exists (
    select 1
    from review_flag rf
    where rf.entity_type = 'work'
      and rf.entity_id = work.id
      and rf.status = 'open'
      and rf.reason in ('orchestral_scope_review', 'possible_duplicate')
  ) then 'quarantined'::public_work_tier
  when status = 'published' then 'verified'::public_work_tier
  else 'draft'::public_work_tier
end
where public_tier = 'draft';

do $$ begin
  alter table work
    add constraint work_public_tier_requires_min_fields
    check (
      public_tier in ('draft','quarantined') or
      (work_name is not null and composer_id is not null)
    );
exception when duplicate_object then null; end $$;

create table if not exists work_evidence (
  id uuid primary key default gen_random_uuid(),
  work_id uuid references work(id) on delete cascade,
  source text not null,
  source_display_name text,
  source_url text not null,
  source_record_id text,
  source_title text,
  evidence_kind text not null,
  supports_fields text[] not null default '{}',
  extracted_fields jsonb not null default '{}'::jsonb,
  confidence confidence_level not null default 'unknown',
  source_terms_status text not null default 'unverified'
    check (source_terms_status in ('unverified','approved','restricted','blocked')),
  is_public boolean not null default false,
  public_label text,
  public_url text,
  fetched_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists work_promotion_decision (
  id uuid primary key default gen_random_uuid(),
  work_id uuid references work(id) on delete cascade,
  from_tier public_work_tier,
  to_tier public_work_tier not null,
  gate_version text not null,
  decision jsonb not null,
  evidence_ids uuid[] not null default '{}',
  batch_id text,
  model_provider text,
  model_name text,
  reviewer_kind text not null check (reviewer_kind in ('system','ai','human','mixed')),
  reviewer_id text,
  created_at timestamptz not null default now()
);

create table if not exists source_ingest_candidate (
  id uuid primary key default gen_random_uuid(),
  source_ingest_job_id uuid references source_ingest_job(id) on delete set null,
  batch_id text,
  source text not null,
  entity_kind text not null check (entity_kind in ('composer','work')),
  source_id text not null,
  source_url text,
  raw_payload jsonb not null default '{}'::jsonb,
  normalized_candidate jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  field_confidence jsonb not null default '{}'::jsonb,
  duplicate_cluster_key text,
  public_eligibility jsonb not null default '{}'::jsonb,
  status source_candidate_status not null default 'pending',
  promoted_work_id uuid references work(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, entity_kind, source_id)
);

insert into work_evidence (
  work_id,
  source,
  source_display_name,
  source_url,
  source_title,
  evidence_kind,
  supports_fields,
  extracted_fields,
  confidence,
  source_terms_status,
  is_public,
  public_label,
  public_url
)
select
  ws.work_id,
  'work_source',
  coalesce(ws.title, 'Source'),
  ws.url,
  ws.title,
  'source_link',
  array['identity','external_ids']::text[],
  jsonb_build_object('title', ws.title, 'url', ws.url),
  'probable'::confidence_level,
  'unverified',
  false,
  ws.title,
  ws.url
from work_source ws
join work w on w.id = ws.work_id
where w.public_tier in ('indexed','verified','canonical')
  and not exists (
    select 1
    from work_evidence we
    where we.work_id = ws.work_id
      and we.source = 'work_source'
      and we.source_url = ws.url
  );

update work
set field_confidence = jsonb_strip_nulls(jsonb_build_object(
  'identity', case
    when work_name is not null and composer_id is not null then 'probable'
    else 'unknown'
  end,
  'title', case when work_name is not null then 'probable' else 'unknown' end,
  'composer', case when composer_id is not null then 'probable' else 'unknown' end,
  'orchestral_scope', case
    when public_tier = 'quarantined' then 'conflicting'
    else 'unknown'
  end,
  'instrumentation', case when instrumentation_text is not null then 'inferred' else 'unknown' end,
  'duration', case when duration_seconds is not null then 'probable' else 'unknown' end,
  'composition_year', case when composition_year is not null then 'probable' else 'unknown' end,
  'publisher', case when publisher_id is not null then 'probable' else 'unknown' end,
  'availability', 'unknown',
  'external_ids', case when external_ids <> '{}'::jsonb then 'probable' else 'unknown' end
))
where field_confidence = '{}'::jsonb;

update work
set evidence_summary = jsonb_build_object(
  'schema_version', 'public-index-evidence-summary-v1',
  'gate_version', coalesce(promotion_gate_version, 'backfill-v1'),
  'evidence_ids', coalesce((
    select jsonb_agg(we.id)
    from work_evidence we
    where we.work_id = work.id
  ), '[]'::jsonb),
  'public_rationale', case
    when public_tier in ('indexed','verified','canonical') then 'Backfilled from legacy published/source metadata.'
    when public_tier = 'quarantined' then 'Backfilled from open review flag state.'
    else 'Internal draft.'
  end,
  'blocking_issues', '[]'::jsonb,
  'reviewer_kind', 'system'
)
where evidence_summary = '{}'::jsonb;

create index if not exists work_public_tier_idx on work(public_tier);
create index if not exists work_public_tier_visible_idx
  on work(public_tier)
  where public_tier in ('indexed','verified','canonical');
create index if not exists work_composer_public_tier_idx
  on work(composer_id, public_tier)
  where public_tier in ('indexed','verified','canonical');
create index if not exists work_evidence_work_id_idx on work_evidence(work_id);
create index if not exists work_evidence_source_idx on work_evidence(source, source_record_id);
create index if not exists work_promotion_decision_work_id_idx on work_promotion_decision(work_id);
create index if not exists source_ingest_candidate_status_idx on source_ingest_candidate(status);
create index if not exists source_ingest_candidate_job_idx on source_ingest_candidate(source_ingest_job_id);
create index if not exists source_ingest_candidate_batch_idx on source_ingest_candidate(batch_id);
create index if not exists source_ingest_candidate_duplicate_cluster_idx on source_ingest_candidate(duplicate_cluster_key);
create index if not exists review_flag_open_work_public_blocker_idx
  on review_flag(entity_id, reason)
  where entity_type = 'work'
    and status = 'open'
    and reason in ('orchestral_scope_review', 'possible_duplicate');

drop index if exists work_status_idx;
drop index if exists work_composer_status_idx;

drop function if exists public_min_works(text, uuid);

create or replace function public_min_composers(q text default null)
returns table (id uuid, first_name text, last_name text)
language sql stable security definer set search_path=public as $$
  select c.id, c.first_name, c.last_name
  from composer c
  where (
      c.status = 'published'
      or exists (
        select 1
        from work w
        where w.composer_id = c.id
          and w.public_tier in ('indexed','verified','canonical')
      )
    )
    and (q is null or norm(c.first_name || ' ' || c.last_name) like norm('%' || q || '%'))
  order by c.last_name, c.first_name
  limit 50;
$$;

create function public_min_works(q text default null, composer_id uuid default null)
returns table (id uuid, work_name text, composer_id uuid, public_tier public_work_tier)
language sql stable security definer set search_path=public as $$
  select w.id, w.work_name, w.composer_id, w.public_tier
  from work w
  where w.public_tier in ('indexed','verified','canonical')
    and (composer_id is null or w.composer_id = composer_id)
    and (q is null or norm(w.work_name) like norm('%' || q || '%'))
  order by w.work_name
  limit 50;
$$;

create or replace function public_work_detail(p_id uuid)
returns table (
  id uuid,
  work_name text,
  composer_id uuid,
  composer_first_name text,
  composer_last_name text,
  composition_year smallint,
  instrumentation_text text,
  duration_seconds int,
  public_tier public_work_tier,
  field_confidence jsonb,
  evidence_summary jsonb,
  public_notes text
)
language sql stable security definer set search_path=public as $$
  select
    w.id,
    w.work_name,
    w.composer_id,
    c.first_name as composer_first_name,
    c.last_name as composer_last_name,
    w.composition_year,
    w.instrumentation_text,
    w.duration_seconds,
    w.public_tier,
    w.field_confidence,
    w.evidence_summary,
    w.public_notes
  from work w
  left join composer c on c.id = w.composer_id
  where w.id = p_id
    and w.public_tier in ('indexed','verified','canonical');
$$;

create or replace function public_composer_detail(p_id uuid)
returns table (id uuid, first_name text, last_name text)
language sql stable security definer set search_path=public as $$
  select c.id, c.first_name, c.last_name
  from composer c
  where c.id = p_id
    and (
      c.status = 'published'
      or exists (
        select 1
        from work w
        where w.composer_id = c.id
          and w.public_tier in ('indexed','verified','canonical')
      )
    );
$$;

create or replace function public_work_evidence(p_work_id uuid)
returns table (
  id uuid,
  source text,
  source_display_name text,
  public_label text,
  public_url text,
  confidence confidence_level,
  supports_fields text[]
)
language sql stable security definer set search_path=public as $$
  select
    we.id,
    we.source,
    we.source_display_name,
    we.public_label,
    we.public_url,
    we.confidence,
    we.supports_fields
  from work_evidence we
  join work w on w.id = we.work_id
  where we.work_id = p_work_id
    and w.public_tier in ('indexed','verified','canonical')
    and we.is_public = true
    and we.source_terms_status = 'approved'
  order by we.created_at;
$$;

revoke all on function public_min_composers(text) from public;
revoke all on function public_min_works(text, uuid) from public;
revoke all on function public_work_detail(uuid) from public;
revoke all on function public_composer_detail(uuid) from public;
revoke all on function public_work_evidence(uuid) from public;
grant execute on function public_min_composers(text) to anon, authenticated;
grant execute on function public_min_works(text, uuid) to anon, authenticated;
grant execute on function public_work_detail(uuid) to anon, authenticated;
grant execute on function public_composer_detail(uuid) to anon, authenticated;
grant execute on function public_work_evidence(uuid) to anon, authenticated;

alter table work_evidence enable row level security;
alter table work_promotion_decision enable row level security;
alter table source_ingest_candidate enable row level security;

drop policy if exists read_work_members on work;
create policy read_work_members on work
for select using (
  has_active_subscription()
  and public_tier in ('indexed','verified','canonical')
);

drop policy if exists read_work_individual on work;
create policy read_work_individual on work
for select using (
  auth.uid() is not null
  and (
    not exists (
      select 1 from user_profile
      where user_id = auth.uid()
        and admin_role in ('super_admin', 'admin', 'contributor')
    )
  )
  and public_tier in ('indexed','verified','canonical')
);

drop policy if exists read_work_evidence_admin on work_evidence;
create policy read_work_evidence_admin on work_evidence
for select using (role_is_contributor_or_above());

drop policy if exists write_work_evidence_admin on work_evidence;
create policy write_work_evidence_admin on work_evidence
for all using (role_is_contributor_or_above()) with check (role_is_contributor_or_above());

drop policy if exists read_work_promotion_decision_admin on work_promotion_decision;
create policy read_work_promotion_decision_admin on work_promotion_decision
for select using (role_is_contributor_or_above());

drop policy if exists write_work_promotion_decision_admin on work_promotion_decision;
create policy write_work_promotion_decision_admin on work_promotion_decision
for all using (role_is_contributor_or_above()) with check (role_is_contributor_or_above());

drop policy if exists read_source_ingest_candidate_admin on source_ingest_candidate;
create policy read_source_ingest_candidate_admin on source_ingest_candidate
for select using (role_is_contributor_or_above());

drop policy if exists write_source_ingest_candidate_admin on source_ingest_candidate;
create policy write_source_ingest_candidate_admin on source_ingest_candidate
for all using (role_is_contributor_or_above()) with check (role_is_contributor_or_above());
