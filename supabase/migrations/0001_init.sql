-- =========
-- 0. Extensions
-- =========
create extension if not exists pgcrypto with schema public;
create extension if not exists pg_trgm with schema public;
create extension if not exists unaccent with schema public;

-- =========
-- 1. Types
-- =========
do $$ begin
  create type publication_status as enum ('draft','published');
exception when duplicate_object then null; end $$;

do $$ begin
  create type entity_kind as enum ('composer','work');
exception when duplicate_object then null; end $$;

do $$ begin
  create type recording_provider as enum ('youtube','spotify','apple_music','soundcloud','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type revision_action as enum ('create','update','publish','unpublish');
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscriber_type as enum ('user','team','institution');
exception when duplicate_object then null; end $$;

do $$ begin
  create type review_status as enum ('open','resolved','dismissed');
exception when duplicate_object then null; end $$;

-- =========
-- 2. Lookups
-- =========
create table if not exists country (
  iso2 char(2) primary key,
  name text not null
);

create table if not exists gender_identity (
  id uuid primary key default gen_random_uuid(),
  label text unique not null,
  is_selectable boolean default true
);

create table if not exists ensemble_type (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  label text not null
);

create table if not exists publisher (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  website text
);

-- =========
-- 3. Places (normalized locations)
-- =========
create table if not exists place (
  id uuid primary key default gen_random_uuid(),
  provider text not null,             -- 'google','osm', etc.
  provider_place_id text not null,
  city text,
  admin_area text,
  country_iso2 char(2) references country(iso2),
  lat double precision,
  lon double precision,
  label text not null,
  unique(provider, provider_place_id)
);

-- =========
-- 4. Composer & related
-- =========
create table if not exists composer (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  birth_year smallint check (birth_year between 1000 and 2100),
  birth_place_id uuid references place(id),
  death_year smallint check (death_year between 1000 and 2100),
  death_place_id uuid references place(id),
  gender_id uuid references gender_identity(id),
  gender_self_describe text,
  external_ids jsonb not null default '{}'::jsonb,
  extra_metadata jsonb not null default '{}'::jsonb,
  status publication_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists composer_nationality (
  composer_id uuid references composer(id) on delete cascade,
  country_iso2 char(2) references country(iso2),
  primary key (composer_id, country_iso2)
);

create table if not exists composer_link (
  id uuid primary key default gen_random_uuid(),
  composer_id uuid references composer(id) on delete cascade,
  url text not null,
  is_primary boolean default false,
  display_order int default 0
);

-- =========
-- 5. Work & related
-- =========
create table if not exists work (
  id uuid primary key default gen_random_uuid(),
  composer_id uuid references composer(id),          -- nullable in Draft; required when Published
  work_name text,                                    -- nullable in Draft; required when Published
  composition_year smallint check (composition_year between 1000 and 2100),
  ensemble_id uuid references ensemble_type(id),
  instrumentation_text text,
  duration_seconds int check (duration_seconds >= 0),
  publisher_id uuid references publisher(id),
  external_ids jsonb not null default '{}'::jsonb,
  extra_metadata jsonb not null default '{}'::jsonb,
  work_type text,
  opus_number text,
  catalog_number text,
  movements jsonb,
  notes_md text,
  rental_only boolean default false,
  territory_limits text,
  materials_available text,
  slug text unique,
  status publication_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_publish_requires_min_fields
    check (
      status <> 'published' or
      (work_name is not null and composer_id is not null)
    )
);

create table if not exists work_source (
  id uuid primary key default gen_random_uuid(),
  work_id uuid references work(id) on delete cascade,
  url text not null,
  title text,
  display_order int default 0
);

create table if not exists work_recording (
  id uuid primary key default gen_random_uuid(),
  work_id uuid references work(id) on delete cascade,
  url text not null,
  provider recording_provider not null default 'other',
  provider_key text,
  embed_url text,
  display_order int default 0
);

-- =========
-- 6. Comments & Revisions (Activity)
-- =========
create table if not exists admin_comment (
  id uuid primary key default gen_random_uuid(),
  entity_type entity_kind not null,
  entity_id uuid not null,
  author_user_id uuid not null, -- auth.users id (no FK across schema for portability)
  body text not null,
  parent_comment_id uuid references admin_comment(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists revision (
  id uuid primary key default gen_random_uuid(),
  entity_type entity_kind not null,
  entity_id uuid not null,
  actor_user_id uuid not null,
  action revision_action not null,
  diff jsonb,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

-- =========
-- 7. Search table + triggers
-- =========
create table if not exists work_search (
  work_id uuid primary key references work(id) on delete cascade,
  tsv tsvector
);

create index if not exists work_search_tsv_idx on work_search using gin(tsv);

create or replace function update_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_work_updated_at on work;
create trigger trg_work_updated_at before update on work
for each row execute procedure update_updated_at();

drop trigger if exists trg_composer_updated_at on composer;
create trigger trg_composer_updated_at before update on composer
for each row execute procedure update_updated_at();

create or replace function update_work_search() returns trigger language plpgsql as $$
declare
  comp composer;
  name_text text;
begin
  select * into comp from composer where id = new.composer_id;
  name_text := coalesce(new.work_name,'') || ' ' ||
               coalesce(comp.first_name,'') || ' ' || coalesce(comp.last_name,'') || ' ' ||
               coalesce(new.instrumentation_text,'');
  insert into work_search(work_id, tsv)
  values (
    new.id,
    setweight(to_tsvector('simple', coalesce(new.work_name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.instrumentation_text,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(comp.first_name,'') || ' ' || coalesce(comp.last_name,'')), 'B')
  )
  on conflict (work_id) do update set tsv =
    setweight(to_tsvector('simple', coalesce(new.work_name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.instrumentation_text,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(comp.first_name,'') || ' ' || coalesce(comp.last_name,'')), 'B');
  return new;
end; $$;

drop trigger if exists trg_work_search_upsert on work;
create trigger trg_work_search_upsert
after insert or update of work_name, instrumentation_text, composer_id on work
for each row execute procedure update_work_search();

-- =========
-- 8. User profiles & membership
-- =========
create table if not exists user_profile (
  user_id uuid primary key,
  first_name text,
  last_name text,
  admin_role text check (admin_role in ('super_admin','admin','contributor','none')) default 'none',
  created_at timestamptz not null default now()
);

create table if not exists subscriber (
  id uuid primary key default gen_random_uuid(),
  kind subscriber_type not null,
  subject_id uuid not null,
  unique(kind, subject_id)
);

create table if not exists subscription (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid references subscriber(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  price_id text,
  status text,
  current_period_end timestamptz,
  trial_end timestamptz,
  seat_count int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists team (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null
);

create table if not exists team_member (
  team_id uuid references team(id) on delete cascade,
  user_id uuid not null,
  role text check (role in ('owner','manager','member')) default 'member',
  status text check (status in ('invited','active','removed')) default 'invited',
  primary key (team_id, user_id)
);

create table if not exists institution (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists institution_member (
  institution_id uuid references institution(id) on delete cascade,
  user_id uuid not null,
  role text check (role in ('admin','member')) default 'member',
  status text check (status in ('invited','active','removed')) default 'invited',
  primary key (institution_id, user_id)
);

create table if not exists institution_ip_range (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institution(id) on delete cascade,
  cidr cidr not null
);

-- =========
-- 9. Tags (optional taxonomy)
-- =========
create table if not exists tag (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  label text not null
);

create table if not exists work_tag (
  work_id uuid references work(id) on delete cascade,
  tag_id uuid references tag(id) on delete cascade,
  primary key (work_id, tag_id)
);

-- =========
-- 10. Review flags (For Review)
-- =========
create table if not exists review_flag (
  id uuid primary key default gen_random_uuid(),
  entity_type entity_kind not null,
  entity_id uuid not null,
  reason text not null,
  details jsonb,
  status review_status not null default 'open',
  created_by uuid,
  created_at timestamptz not null default now(),
  resolved_by uuid,
  resolved_at timestamptz
);

create index if not exists review_flag_entity_idx on review_flag(entity_type, entity_id, status);

-- =========
-- 11. Helpers & duplicate detection
-- =========
create or replace function norm(txt text) returns text
language sql immutable as $$
  select unaccent(lower(coalesce(txt,'')));
$$;

create or replace function find_duplicate_composers(
  in_first text, in_last text, in_birth_year smallint default null
) returns uuid[] language sql stable as $$
  with q as (
    select norm(in_first) as nf, norm(in_last) as nl, in_birth_year as by
  )
  select array(
    select c.id
    from composer c, q
    where similarity(norm(c.last_name), q.nl) > 0.7
      and similarity(norm(c.first_name), q.nf) > 0.5
      and (q.by is null or c.birth_year between q.by - 1 and q.by + 1)
    order by (similarity(norm(c.last_name), q.nl) + similarity(norm(c.first_name), q.nf)) desc
    limit 10
  );
$$;

create or replace function find_duplicate_works(
  in_composer_id uuid, in_work_name text
) returns uuid[] language sql stable as $$
  select array(
    select w.id
    from work w
    where w.composer_id = in_composer_id
      and similarity(norm(w.work_name), norm(in_work_name)) > 0.65
    order by similarity(norm(w.work_name), norm(in_work_name)) desc
    limit 10
  );
$$;

-- =========
-- 12. Role & subscription helpers
-- =========
create or replace function role_is_contributor_or_above() returns boolean
language sql stable as $$
  select exists (
    select 1 from user_profile
    where user_id = auth.uid()
      and admin_role in ('super_admin','admin','contributor')
  );
$$;

create or replace function role_is_admin_or_above() returns boolean
language sql stable as $$
  select exists (
    select 1 from user_profile
    where user_id = auth.uid()
      and admin_role in ('super_admin','admin')
  );
$$;

create or replace function has_active_subscription() returns boolean
language sql stable as $$
  with direct as (
    select 1
    from subscriber s
    join subscription sub on sub.subscriber_id = s.id
    where s.kind='user' and s.subject_id = auth.uid()
      and sub.status in ('active','trialing')
      and coalesce(sub.current_period_end, now() + interval '1 day') > now()
    limit 1
  ),
  via_team as (
    select 1
    from team_member tm
    join subscriber s on s.kind='team' and s.subject_id = tm.team_id
    join subscription sub on sub.subscriber_id = s.id
    where tm.user_id = auth.uid() and tm.status='active'
      and sub.status in ('active','trialing')
      and coalesce(sub.current_period_end, now() + interval '1 day') > now()
    limit 1
  ),
  via_inst as (
    select 1
    from institution_member im
    join subscriber s on s.kind='institution' and s.subject_id = im.institution_id
    join subscription sub on sub.subscriber_id = s.id
    where im.user_id = auth.uid() and im.status='active'
      and sub.status in ('active','trialing')
      and coalesce(sub.current_period_end, now() + interval '1 day') > now()
    limit 1
  )
  select exists(select * from direct)
      or exists(select * from via_team)
      or exists(select * from via_inst);
$$;

-- =========
-- 13. Public RPCs (name-only)
-- =========
create or replace function public_min_composers(q text default null)
returns table (id uuid, first_name text, last_name text)
language sql stable security definer set search_path=public as $$
  select c.id, c.first_name, c.last_name
  from composer c
  where c.status = 'published'
    and (q is null or unaccent(lower(c.first_name || ' ' || c.last_name)) like unaccent(lower('%' || q || '%')));
$$;

create or replace function public_min_works(q text default null, composer_id uuid default null)
returns table (id uuid, work_name text, composer_id uuid)
language sql stable security definer set search_path=public as $$
  select w.id, w.work_name, w.composer_id
  from work w
  where w.status = 'published'
    and (composer_id is null or w.composer_id = composer_id)
    and (q is null or unaccent(lower(w.work_name)) like unaccent(lower('%' || q || '%')));
$$;

revoke all on function public_min_composers(text) from public;
revoke all on function public_min_works(text, uuid) from public;
grant execute on function public_min_composers(text) to anon;
grant execute on function public_min_works(text, uuid) to anon;

-- =========
-- 14. Activity view
-- =========
create or replace view activity_event as
with rev as (
  select
    r.id,
    r.created_at as occurred_at,
    r.actor_user_id as actor_id,
    case r.entity_type
      when 'composer' then (select coalesce(c.first_name || ' ' || c.last_name, 'Composer') from composer c where c.id = r.entity_id)
      when 'work' then (select coalesce(w.work_name, 'Work') from work w where w.id = r.entity_id)
    end as subject_label,
    r.entity_type,
    r.entity_id,
    case r.action
      when 'create' then 'created'
      when 'update' then 'updated'
      when 'publish' then 'published'
      when 'unpublish' then 'unpublished'
      else r.action::text
    end as verb,
    null::uuid as comment_id,
    'revision'::text as source
  from revision r
),
cm as (
  select
    ac.id,
    ac.created_at as occurred_at,
    ac.author_user_id as actor_id,
    case ac.entity_type
      when 'composer' then (select coalesce(c.first_name || ' ' || c.last_name, 'Composer') from composer c where c.id = ac.entity_id)
      when 'work' then (select coalesce(w.work_name, 'Work') from work w where w.id = ac.entity_id)
    end as subject_label,
    ac.entity_type,
    ac.entity_id,
    'commented' as verb,
    ac.id as comment_id,
    'comment'::text as source
  from admin_comment ac
),
rf as (
  select
    rflag.id,
    rflag.created_at as occurred_at,
    rflag.created_by as actor_id,
    case rflag.entity_type
      when 'composer' then (select coalesce(c.first_name || ' ' || c.last_name, 'Composer') from composer c where c.id = rflag.entity_id)
      when 'work' then (select coalesce(w.work_name, 'Work') from work w where w.id = rflag.entity_id)
    end as subject_label,
    rflag.entity_type,
    rflag.entity_id,
    'flagged for review' as verb,
    null::uuid as comment_id,
    'review_flag'::text as source
  from review_flag rflag
)
select * from rev
union all select * from cm
union all select * from rf
order by occurred_at desc;

-- =========
-- 15. RLS
-- =========
alter table composer enable row level security;
alter table work enable row level security;
alter table admin_comment enable row level security;
alter table revision enable row level security;

-- READ: admins + contributors can read all
create policy if not exists read_composer_admin on composer
for select using (role_is_contributor_or_above());

create policy if not exists read_work_admin on work
for select using (role_is_contributor_or_above());

create policy if not exists read_comment_admin on admin_comment
for select using (role_is_contributor_or_above());

create policy if not exists read_revision_admin on revision
for select using (role_is_contributor_or_above());

-- READ: members (active subscription) may read only published
create policy if not exists read_composer_members on composer
for select using (has_active_subscription() and status='published');

create policy if not exists read_work_members on work
for select using (has_active_subscription() and status='published');

-- WRITE: contributors/admins
create policy if not exists write_composer_admin on composer
for all using (role_is_contributor_or_above()) with check (role_is_contributor_or_above());

create policy if not exists write_work_admin on work
for all using (role_is_contributor_or_above()) with check (role_is_contributor_or_above());

create policy if not exists write_comment_admin on admin_comment
for all using (role_is_contributor_or_above()) with check (role_is_contributor_or_above());

create policy if not exists write_revision_admin on revision
for all using (role_is_contributor_or_above()) with check (role_is_contributor_or_above());

-- =========
-- 16. Seeds
-- =========
insert into gender_identity (label, is_selectable) values
('Man', true), ('Woman', true), ('Non-binary', true), ('Transgender', true), ('Self-Describe', true)
on conflict (label) do nothing;

insert into ensemble_type (code, label) values
('full_orchestra','Full Orchestra'),
('chamber_orchestra','Chamber Orchestra'),
('string_orchestra','String Orchestra'),
('wind_ensemble','Wind Ensemble'),
('choir_orchestra','Choir + Orchestra'),
('opera_pit','Opera Pit'),
('other','Other')
on conflict (code) do nothing;

/* Optional: seed a few countries for dev; replace with full ISO-3166 later */
insert into country(iso2, name) values
('US','United States'), ('GB','United Kingdom'), ('CA','Canada'),
('DE','Germany'), ('FR','France'), ('IT','Italy'), ('ES','Spain')
on conflict (iso2) do nothing;

-- =========
-- Done
-- =========

