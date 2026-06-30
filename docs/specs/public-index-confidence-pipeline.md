# Public Index Confidence Pipeline

## Purpose

This spec is the handoff for changing OpusGraph from a binary `draft` / `published` Works Database into a public, source-backed repertoire index with confidence tiers, field-level evidence, and AI-assisted promotion gates.

It comes from the 2026-06-27 planning conversation about reaching first dollars by 2026-08-01 while using heavy AI parallelism to prepare both the library-management product and a much larger public Works Database surface.

The immediate business goal is to make a 10000-20000 work public launch plausible without requiring Felix to manually verify every row. The product must not pretend that every public row is expert-curated. It should make uncertainty visible and auditable.

## Thesis

The current `work.status` model is too coarse for the intended launch.

Today, a work is effectively either:

- `draft`: internal
- `published`: public

That works for a small manually curated database. It does not work for an AI-assisted public index where different records and fields have different confidence levels.

The new model should distinguish:

- whether a record can be public at all
- how strongly its identity is confirmed
- which fields are source-backed
- which fields are incomplete, conflicting, inferred, or low-confidence
- how and why the record was promoted

The core launch posture should be:

> OpusGraph is a public, provenance-backed repertoire index with confidence labels and a smaller verified/canonical subset.

Do not launch with the claim:

> Every public record is fully normalized, deduped, and expert-verified.

## Current Context

Observed live state on 2026-06-27:

- `3385` works, all `draft`
- `3151` composers
- `11` published composers
- `0` published works
- `0` library entries
- `0` performances
- `3592` open review flags
- `3305` open `orchestral_scope_review` flags
- `287` open `possible_duplicate` flags
- public work RPC returned `0` rows
- public composer RPC returned `11` rows

The current public database is therefore not a public acquisition surface yet.

Related docs:

- `docs/specs/august-1-first-dollars-plan.md`
- `docs/specs/monetization-path.md`
- `docs/specs/imslp-reference-ingestion.md`
- `docs/ACTIVE_CONTEXT.md`
- `docs/ROADMAP.md`
- `docs/WORKLOG.md`

Important current schema/files:

- `supabase/migrations/0001_init.sql`
- `supabase/migrations/0016_source_ingest_job.sql`
- `supabase/migrations/0017_review_flag_duplicate_source_identity.sql`
- `lib/ingest/`
- `scripts/recover-imslp-work-slice.ts`
- `scripts/audit-imslp-work-coverage.ts`
- `scripts/sample-imslp-audit.ts`
- `app/api/public/search/route.ts`
- `app/search/public-search.tsx`
- `app/works/[id]/page.tsx`
- `app/composers/[id]/page.tsx`

## Definitions

### Public Tiers

Use tiers instead of binary publication.

- `draft`: internal only; not public.
- `quarantined`: internal review only; known issue, out-of-scope, conflict, or duplicate risk.
- `indexed`: public, source-backed, incomplete-field tolerance, not fully curated.
- `verified`: public, stronger source confirmation and no known material conflicts.
- `canonical`: public, high-confidence, normalized record suitable for prominent recommendations, demos, and paid workflow features.

For launch, `indexed` is the scale tier. `verified` and `canonical` are trust tiers.

### Field-Level Confidence

A work record is not one confidence object. Each field or field group needs its own confidence.

Recommended confidence keys:

- `identity`: title plus composer pair
- `title`: normalized title
- `composer`: composer identity and link
- `orchestral_scope`: whether this belongs in the current orchestral product scope
- `instrumentation`: instrumentation text and parsed forces
- `duration`: duration text or seconds
- `composition_year`: composition date/year
- `publisher`: publisher or source-reported publisher
- `availability`: purchase, rental, perusal, public-domain, or score availability
- `external_ids`: source identifiers and canonical URLs

Recommended confidence values:

- `confirmed`: strong source support
- `probable`: source-backed but not fully corroborated
- `inferred`: derived from source context or parser logic
- `conflicting`: sources disagree
- `unknown`: no reliable value
- `not_applicable`: field does not apply

Use numeric scores only as secondary metadata. Reader-facing labels should be simple.

### Triple Confirmation

Triple confirmation should apply first to core identity, not every field.

Core identity means:

- this work exists
- it is associated with this composer
- the source record points to the same composer-work pair

A public-index candidate can pass identity confirmation if it has:

- one source identity from the ingest source, and
- at least two independent corroborating source references for the same composer-work pair, or
- one very strong authority source plus one independent corroborator

The implementation must store the evidence used to make the decision.

Triple confirmation should not be required for every field. Duration, exact instrumentation, publisher, composition year, and availability often need lower field-level confidence labels.

## Database Plan

### Principle

Design the database as if OpusGraph were fresh today, then write the forward migration/backfill needed to convert the existing live database into that design.

The target model should not keep binary publication as the conceptual source of truth. Public visibility should be tiered from the beginning:

1. Replace `publication_status` as the public-readiness concept with `public_work_tier`.
2. Keep draft/quarantine/index/verification/canonical status in one field.
3. Attach field-level confidence and source evidence directly to that public tier.
4. Update fresh-install migrations and application code to use the new model.
5. Use a forward migration to backfill and change over existing databases.

Temporary compatibility is required for the first rollout because `work.status` is currently used across admin editors, validators, admin APIs, public RPCs, RLS policies, public pages, library reference lookup, import flows, stats, and review/compare tooling. The bridge must still be explicitly temporary and documented as such. The end state should not require both `status` and `public_tier` for works.

### Status Usage Inventory

Before writing or applying the migration, create a concrete inventory of every `work.status` and `status = 'published'` use.

Start with:

```bash
rg -n "status|published|draft|publication_status|public_tier" app lib components scripts supabase/migrations -g '*.ts' -g '*.tsx' -g '*.sql'
```

Classify each hit into:

- public work read path
- authenticated member/library reference read path
- admin editor or admin API write path
- import or ingestion write path
- stats, activity, audit, or review display
- composer-only status usage
- unrelated HTTP/job/review status

The migration branch should include this inventory in the implementation notes or worklog. Do not drop `work.status` until the inventory shows no remaining work-public-visibility dependency on it.

### Composer Visibility Decision

Resolve composer visibility before the first public-tier migration is applied.

Public work pages need composer names. A work promoted to `indexed`, `verified`, or `canonical` is not useful if its linked composer is still hidden by binary composer `status = 'draft'` rules.

Acceptable first implementation choices:

- Keep composer `publication_status` temporarily, but automatically make the minimal composer fields public when at least one linked work is in a public tier.
- Add a parallel composer public-tier/confidence model in the same initiative.
- Keep composer public visibility binary, but require every promoted public work to reference a composer that is already published.

The first option is likely the smallest safe bridge. The chosen rule must be reflected in public composer RPCs, work detail loaders, RLS policies, and library reference search.

### Target Fresh Schema

For a fresh database, `work` should use `public_tier` directly instead of `status publication_status`.

Target enum:

```sql
create type public_work_tier as enum (
  'draft',
  'quarantined',
  'indexed',
  'verified',
  'canonical'
);
```

Target confidence enum:

```sql
create type confidence_level as enum (
  'confirmed',
  'probable',
  'inferred',
  'conflicting',
  'unknown',
  'not_applicable'
);
```

Target `work` table fields:

```sql
create table if not exists work (
  id uuid primary key default gen_random_uuid(),
  composer_id uuid references composer(id),
  work_name text,
  composition_year smallint check (composition_year between 1000 and 2100),
  ensemble_id uuid references ensemble_type(id),
  instrumentation_text text,
  duration_seconds int check (duration_seconds >= 0),
  publisher_id uuid references publisher(id),
  external_ids jsonb not null default '{}'::jsonb,
  extra_metadata jsonb not null default '{}'::jsonb,
  field_confidence jsonb not null default '{}'::jsonb,
  evidence_summary jsonb not null default '{}'::jsonb,
  work_type text,
  opus_number text,
  catalog_number text,
  movements jsonb,
  notes_md text,
  public_notes text,
  rental_only boolean default false,
  territory_limits text,
  materials_available text,
  slug text unique,
  public_tier public_work_tier not null default 'draft',
  promoted_at timestamptz,
  promotion_gate_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_public_tier_requires_min_fields
    check (
      public_tier in ('draft', 'quarantined') or
      (work_name is not null and composer_id is not null)
    )
);
```

Target public visibility rule:

```sql
public_tier in ('indexed', 'verified', 'canonical')
```

Target semantics:

- `draft`: internal only
- `quarantined`: internal review only
- `indexed`: public source-backed index record
- `verified`: public stronger-confirmation record
- `canonical`: public high-confidence normalized record

### Forward Migration For Existing Databases

Create a forward migration, likely:

`supabase/migrations/0018_public_index_confidence.sql`

This migration should convert the existing binary model into the target tiered model.

Required steps:

1. Create `public_work_tier`.
2. Create `confidence_level`.
3. Add target columns to `work`.
4. Backfill `public_tier` from existing `status` and review-flag state.
5. Backfill minimal `field_confidence` and `evidence_summary` from existing source metadata where possible.
6. Create `work_evidence`.
7. Create `work_promotion_decision`.
8. Optionally create `source_ingest_candidate`.
9. Update public RPCs/policies/views to use `public_tier`.
10. Remove or deprecate old `status` semantics for works.

Compatibility choice:

- Preferred end state: drop `work.status` after all code paths are switched to `public_tier`.
- Required first rollout bridge: keep `work.status` physically present for at least one deploy while new reads/writes move to `public_tier`, then remove it in a follow-up migration after the status usage inventory is clean.
- Not acceptable as final design: long-term dual source of truth where `status` and `public_tier` both decide public visibility.

During the bridge, `public_tier` is authoritative for work public visibility. If legacy `status` must be maintained for old code during the same deploy window, maintain it as compatibility scaffolding only and document exactly which files still depend on it.

Suggested migration additions:

```sql
create type public_work_tier as enum (
  'draft',
  'quarantined',
  'indexed',
  'verified',
  'canonical'
);

create type confidence_level as enum (
  'confirmed',
  'probable',
  'inferred',
  'conflicting',
  'unknown',
  'not_applicable'
);
```

Add target columns to existing `work`:

```sql
alter table work
  add column if not exists public_tier public_work_tier not null default 'draft',
  add column if not exists field_confidence jsonb not null default '{}'::jsonb,
  add column if not exists evidence_summary jsonb not null default '{}'::jsonb,
  add column if not exists public_notes text,
  add column if not exists promoted_at timestamptz,
  add column if not exists promotion_gate_version text;
```

Create source evidence table:

```sql
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
```

Evidence storage has two audiences:

- internal audit and promotion logic, which can store raw extracted fields and source-specific notes
- public UI, which should expose only public-safe labels, URLs, and summaries

Do not expose `extracted_fields`, raw source snippets, source payloads, or AI rationales directly to unauthenticated users. Public pages should prefer `evidence_summary` plus `work_evidence` rows where `is_public = true` and `source_terms_status = 'approved'`.

Create promotion decision log:

```sql
create table if not exists work_promotion_decision (
  id uuid primary key default gen_random_uuid(),
  work_id uuid references work(id) on delete cascade,
  from_tier public_work_tier,
  to_tier public_work_tier not null,
  gate_version text not null,
  decision jsonb not null,
  evidence_ids uuid[] not null default '{}',
  model_provider text,
  model_name text,
  reviewer_kind text not null check (reviewer_kind in ('system','ai','human','mixed')),
  reviewer_id text,
  created_at timestamptz not null default now()
);
```

Optional but strongly recommended for scale:

```sql
create type source_candidate_status as enum (
  'pending',
  'needs_evidence',
  'rejected',
  'promoted',
  'quarantined'
);

create table if not exists source_ingest_candidate (
  id uuid primary key default gen_random_uuid(),
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
```

Indexes:

```sql
create index if not exists work_public_tier_idx on work(public_tier);
create index if not exists work_evidence_work_id_idx on work_evidence(work_id);
create index if not exists work_evidence_source_idx on work_evidence(source, source_record_id);
create index if not exists work_promotion_decision_work_id_idx on work_promotion_decision(work_id);
create index if not exists source_ingest_candidate_status_idx on source_ingest_candidate(status);
create index if not exists source_ingest_candidate_duplicate_cluster_idx on source_ingest_candidate(duplicate_cluster_key);
```

Backfill public tiers:

```sql
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
```

Backfill conservative confidence:

```sql
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
```

### Confidence Schema Validation

Although `field_confidence` and `evidence_summary` are JSONB for iteration speed, writes must be schema-validated in TypeScript before promotion.

Required validation:

- `field_confidence` includes every required key listed in this spec
- every confidence value is one of the `confidence_level` enum values
- `evidence_summary` includes `schema_version`, `gate_version`, `evidence_ids`, `public_rationale`, `blocking_issues`, and `reviewer_kind`
- public-tier writes require `promotion_gate_version`
- `indexed`, `verified`, and `canonical` writes require at least one stored evidence row
- `verified` and `canonical` writes require evidence IDs that exist in `work_evidence`

The validation helper should live in a small shared module, for example `lib/public-index/confidence.ts`, and all candidate export, adjudication validation, and promotion scripts should use it.

Fresh-install migration update:

- Update `supabase/migrations/0001_init.sql` so new databases use `public_work_tier` directly.
- Remove `publication_status` from the work concept in fresh schema, or keep it only for composer/entity workflows where still needed.
- Update the minimum-field check from `status = 'published'` to `public_tier in ('indexed','verified','canonical')`.

### Public Visibility Rule

Public work pages/search should show:

- `public_tier in ('indexed', 'verified', 'canonical')`

Admin/editor surfaces should still show all tiers.

All public RPCs, RLS policies, API routes, and page loaders should use `public_tier` directly. Do not keep checking `status = 'published'` for works after the changeover.

Library reference search must get an explicit rule too. Decide whether organization-library users can link against all public tiers or only `verified` and `canonical` works. The default should be all public tiers, with visible confidence labels, so `indexed` records can still accelerate private catalog import without pretending to be fully curated.

## Promotion Gate

The promotion gate is the deterministic rule that decides whether AI-reviewed data can become public.

Minimum gate for `indexed`:

- `work_name` present
- `composer_id` present
- at least one source URL/evidence row
- identity confidence is `confirmed` or `probable`
- orchestral scope is not `conflicting` or `unknown` for the current orchestral public product
- no hard parser failure on title/composer
- no open `orchestral_scope_review` flag for the work
- no open same-source duplicate collision
- no unresolved `possible_duplicate` flag that points to a higher-confidence existing work
- evidence summary records why the row passed

Additional gate for `verified`:

- identity confidence is `confirmed`
- at least two independent corroborating evidence rows, or one strong authority source plus one independent corroborator
- orchestral scope is `confirmed` or `probable`
- no material source conflict on title/composer
- sampled audit batch has acceptable error rate under the current batch-audit contract

Additional gate for `canonical`:

- identity, title, composer, and orchestral scope are `confirmed`
- instrumentation is `confirmed` or `probable`
- duplicate cluster reviewed or deterministically resolved
- display fields are clean enough for prominent product use
- suitable for demos, recommendations, and paid workflows

### Batch Audit And Demotion Contract

Every promotion run needs a stable `batch_id`, saved input packet set, saved adjudication output set, dry-run report, apply report, and audit artifact.

Initial conservative audit thresholds before the first public launch:

- any sampled core-identity error blocks the batch from `verified` or `canonical`
- any sampled non-orchestral false positive blocks the batch from public launch until reviewed
- any unresolved duplicate collision blocks the affected cluster
- any missing evidence row blocks the affected work
- `indexed` batches may tolerate incomplete optional fields, but not missing identity, missing evidence, unresolved duplicate collisions, or unknown/conflicting orchestral scope

Demotion must be logged through `work_promotion_decision`, not silent updates. Use:

- demote to `quarantined` for duplicate, scope, identity conflict, or source-term problems
- demote to `draft` for incomplete internal records that should not be reviewed as public candidates yet
- keep prior promotion history intact

## AI Review Packet

Agents and models should operate on explicit packets, not the live DB directly.

Recommended packet shape:

```json
{
  "schema_version": "public-index-packet-v1",
  "packet_id": "stable batch-local packet id",
  "candidate_id": "source or staging candidate id",
  "source": "imslp",
  "source_id": "raw source id",
  "source_url": "https://...",
  "raw_title": "...",
  "normalized_title": "...",
  "composer_display_name": "...",
  "composer_id": "...",
  "instrumentation_text": "...",
  "duration_text": "...",
  "composition_year": null,
  "existing_duplicate_candidates": [],
  "evidence": [
    {
      "evidence_id": "stored or proposed evidence id",
      "source": "...",
      "url": "...",
      "title": "...",
      "extracted_fields": {}
    }
  ],
  "parser_warnings": [],
  "open_review_flags": []
}
```

AI response should be structured JSON:

```json
{
  "schema_version": "public-index-adjudication-v1",
  "gate_version": "public-index-gate-v1",
  "recommended_public_tier": "indexed",
  "field_confidence": {
    "identity": "probable",
    "title": "confirmed",
    "composer": "confirmed",
    "orchestral_scope": "probable",
    "instrumentation": "inferred",
    "duration": "unknown",
    "composition_year": "unknown",
    "publisher": "unknown"
  },
  "evidence_assessment": {
    "identity_evidence_ids": ["..."],
    "conflicts": [],
    "notes": "short factual rationale"
  },
  "blocking_issues": [],
  "needs_human_review": false
}
```

Reject any AI response that:

- is not valid JSON
- omits `schema_version` or `gate_version`
- omits required confidence keys
- references evidence not present in the packet
- invents a source URL
- changes core identity without citing evidence
- recommends `verified` or `canonical` without meeting the gate

## Pipeline

### Stage 1: Harvest

Goal: collect raw source candidates at scale.

Inputs:

- IMSLP adapter
- future adapters or source imports
- public metadata sources after terms and API limits are verified

Outputs:

- raw payloads
- source identity
- candidate rows or review packets

### Stage 2: Normalize

Goal: produce structured candidates.

Tasks:

- normalize title
- resolve composer
- parse opus/catalog numbers
- parse instrumentation text
- parse duration
- parse dates
- extract source URLs
- identify parser warnings

AI can help, but deterministic parsers should own repeatable normalization where possible.

### Stage 3: Corroborate

Goal: collect source evidence for the same composer-work pair.

Tasks:

- query or search independent sources
- store evidence references
- extract fields per source
- record source strength and independence

Important: verify source terms before scraping or bulk API usage.

### Stage 4: Adjudicate

Goal: have AI compare source evidence and assign field-level confidence.

Rules:

- use structured output only
- do not let model memory count as evidence
- cite evidence IDs/URLs from the packet
- keep conflicts explicit
- mark uncertain fields as `unknown`, `inferred`, or `conflicting`

### Stage 5: Gate

Goal: deterministic promotion decision.

Inputs:

- normalized candidate
- evidence rows
- AI adjudication JSON
- duplicate review state
- parser warnings

Outputs:

- reject
- quarantine
- promote to `indexed`
- promote to `verified`
- promote to `canonical`

### Stage 6: Publish

Goal: update public tier and evidence tables.

Rules:

- write promotion decision log
- store field confidence
- store evidence summary
- do not silently discard uncertainty
- keep raw/source payload retrievable

### Stage 7: Audit And Demote

Goal: keep quality measurable.

Tasks:

- sample each batch
- measure identity error rate
- measure duplicate error rate
- measure orchestral-scope false positives
- demote bad batches from public tiers if needed
- log audit results

## Implementation Plan

### Phase 0: Status Inventory And Design Lock

First chat/task should do this before coding:

- read this spec completely
- read `docs/specs/august-1-first-dollars-plan.md`
- inspect `work`, `review_flag`, `source_ingest_job`, and public search/RLS code
- treat `public_tier` as the target source of truth for work visibility
- run and record the status usage inventory
- decide the composer visibility bridge
- decide the organization-library reference-search visibility rule
- plan both fresh-schema edits and forward migration/backfill

Decision for this spec: design from scratch around `public_tier`; any retained `work.status` bridge is temporary migration scaffolding, not the desired design.

Acceptance:

- every `work.status`, `status = 'published'`, `status = 'draft'`, and `publication_status` usage has been classified
- composer visibility behavior for public work pages is decided
- library reference search behavior for `indexed` works is decided
- no implementation begins with large AI batches or broad public promotion

### Phase 1: Bridge Migration Draft

Create `0018_public_index_confidence.sql` and update the fresh-install schema. Do not physically drop `work.status` in this first migration.

Include:

- `public_work_tier`
- `confidence_level`
- `work.public_tier`
- `work.field_confidence`
- `work.evidence_summary`
- `work.promoted_at`
- `work.promotion_gate_version`
- `work_evidence`
- `work_promotion_decision`
- optionally `source_ingest_candidate`
- indexes
- backfill
- RLS policies for new tables
- public RPC/policy replacements that stop checking `status = 'published'` for works
- a documented bridge that keeps `work.status` physically present only while the code migration completes
- a documented follow-up path to remove or fully deprecate `work.status`

Acceptance:

- migration applies cleanly locally or in a test DB
- fresh install schema reflects the new target model
- existing build passes
- current admin and public routes are updated to use `public_tier`
- `work.status` remains only as temporary compatibility scaffolding
- no long-term dual source of truth remains for work public visibility

### Phase 2: Read And Write Path Changeover

Update public RPCs/routes/pages, library reference lookup, admin write paths, and validators to use tiered visibility.

Likely files:

- `supabase/migrations/0001_init.sql` or a forward RPC replacement migration
- `app/api/public/search/route.ts`
- `app/search/public-search.tsx`
- `app/works/[id]/page.tsx`
- `app/works/[id]/public-work-detail.tsx`
- `app/composers/[id]/page.tsx`
- `app/api/library/reference/search/route.ts`
- `lib/validators/work.ts`
- `app/admin/works/[id]/work-editor.tsx`
- `app/api/admin/works/[id]/route.ts`
- `app/api/admin/stats/route.ts`
- `app/admin/page.tsx`
- `app/api/admin/import/execute/route.ts`

Acceptance:

- public search returns `indexed`, `verified`, and `canonical` works
- public work list and search cards show composer context alongside titles so duplicate or generic titles are not title-only
- public detail pages show public tier, confidence labels, public-safe instrumentation/duration/year, and a public source section
- public source rows come only from `public_work_evidence`, so evidence remains hidden unless `work_evidence.is_public = true` and `source_terms_status = 'approved'`
- draft/quarantined records remain hidden from public users
- library reference search follows the decided public-tier rule
- admin work editor can set or display the tier without collapsing back to binary Draft/Published
- no public work read path still depends on `status = 'published'`
- no work write path updates `status` as the public-readiness authority

### Phase 3: Candidate Export And Review Packets

Create scripts that export candidate batches for AI review.

Likely scripts:

- `scripts/export-public-index-candidates.ts`
- `scripts/run-public-index-adjudication.ts`
- `scripts/validate-public-index-decisions.ts`

Acceptance:

- packets are deterministic
- packets include source identity, evidence, parser warnings, and duplicate flags
- AI outputs are schema-validated
- invalid outputs are rejected
- packet and response schemas include a schema version
- responses cite evidence IDs from the packet, not model memory

### Phase 4: Promotion Gate

Create a dry-run promotion gate.

Likely script:

- `scripts/promote-public-index-candidates.ts`

Required modes:

- `--dry-run true`
- `--apply true`
- `--tier indexed|verified|canonical`
- `--limit`
- `--batch-id`

Acceptance:

- dry run reports pass/fail reasons
- apply mode writes `work.public_tier`, confidence JSON, evidence rows, and promotion decisions
- no candidate can be promoted with missing title/composer/evidence
- duplicate blockers are respected
- no candidate can be promoted while `orchestral_scope_review` is open
- every apply run writes a stable `batch_id`

### Phase 5: Batch Audit

Create batch audit before large public launch.

Likely script:

- `scripts/audit-public-index-batch.ts`

Metrics:

- total promoted
- identity-confirmed count
- probable-only count
- missing evidence count
- duplicate-blocked count
- orchestral-scope unknown/conflicting count
- sampled error rate

Acceptance:

- every promotion batch has an audit artifact
- bad batches can be demoted
- demotions append promotion-decision rows instead of silently overwriting history
- audit thresholds are stored with the batch artifact

### Phase 6: AI Parallelization

Run multiple model/agent streams only after the packet schema and promotion gate exist.

Suggested streams:

- GLM or other low-cost model: high-volume first-pass adjudication
- Sonnet/Opus-class model: ambiguous duplicate clusters and source conflicts
- Codex/Claude Code: scripts, migrations, public UI, tests, runbooks
- Felix/human review: calibration sets, launch claims, canonical/high-traffic works

Rules:

- no direct model writes to production
- all model outputs are structured JSON
- all promotion runs are reproducible from stored packets/evidence
- spot-check samples before and after promotion

## First Work Items For Another Chat

Start with this exact sequence:

1. Create or switch to a dedicated branch/worktree, for example `codex/public-index-confidence`.
2. Read:
   - `docs/ACTIVE_CONTEXT.md`
   - `docs/ROADMAP.md`
   - this file
   - `docs/specs/august-1-first-dollars-plan.md`
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0016_source_ingest_job.sql`
   - `lib/ingest/`
   - `app/api/public/search/route.ts`
3. Run and record the status usage inventory.
4. Decide the composer visibility bridge and the library reference-search tier rule.
5. Draft `supabase/migrations/0018_public_index_confidence.sql` as a bridge migration that does not drop `work.status`.
6. Update the fresh-install schema in `supabase/migrations/0001_init.sql` to represent the target design.
7. Add a small TypeScript type/helper module for public tiers, confidence labels, and confidence JSON validation.
8. Update public search/read logic, library reference lookup, admin work edit/save paths, validators, stats, and import paths to use `public_tier`.
9. Remove or explicitly deprecate work `status` usage in code and SQL after the inventory is clean.
10. Build candidate export and dry-run promotion scripts.
11. Run only small test batches first.

Do not begin by running large AI batches. Build the gate first.

## Must-Answer Before Phase 1

- What is the composer visibility bridge for public work pages?
- Which public tiers are eligible for organization-library reference lookup?
- Which evidence fields are public-safe, and which must remain internal-only?
- What batch-audit thresholds block promotion or trigger demotion for the first launch?

## Open Questions

- Which follow-up migration should remove `work.status` after the bridge dependency inventory is clean?
- Which external sources can be used at scale under acceptable terms?
- How should non-orchestral records be handled if the public product later expands beyond orchestral repertoire?
- Should `indexed` pages be excluded from some paid workflow features until they become `verified` or `canonical`?

## Non-Goals For The First Implementation

- Full marketplace or commerce workflow
- Fully automated natural-language recommendation engine
- Perfect deduplication
- Perfect instrumentation parsing
- Human verification of every public record
- Publishing all draft/quarantined data

## Launch Messaging Constraint

If this pipeline is used for an August 1 launch, language must be careful.

Acceptable:

- "source-backed public repertoire index"
- "records include visible provenance and confidence labels"
- "verified and canonical records are reviewed more deeply"
- "the index is expanding rapidly and accepts corrections"

Avoid:

- "definitive"
- "fully verified"
- "complete"
- "expert-curated 20000-work database"
- any claim that low-confidence fields are certain
