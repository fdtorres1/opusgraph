-- Queue-ready ingestion job control plane for generic external-source ingestion.
-- This table tracks orchestration state, resume cursor, counters, and summarized
-- results/errors without storing candidate-level staging rows.

do $$ begin
  create type source_ingest_job_status as enum (
    'pending',
    'running',
    'paused',
    'completed',
    'failed',
    'canceled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type source_ingest_job_mode as enum (
    'manual',
    'scheduled',
    'backfill',
    'retry'
  );
exception when duplicate_object then null; end $$;

create table if not exists source_ingest_job (
  id uuid primary key default gen_random_uuid(),

  source text not null,
  entity_kind entity_kind not null,
  status source_ingest_job_status not null default 'pending',
  mode source_ingest_job_mode not null default 'manual',
  priority integer not null default 100,
  dry_run boolean not null default false,

  cursor jsonb,
  options jsonb not null default '{}'::jsonb,

  batch_size integer,
  limit_count integer,

  processed_count integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  flagged_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  warning_count integer not null default 0,

  error_summary jsonb,
  warning_summary jsonb,
  result_summary jsonb,

  attempt_count integer not null default 0,
  last_error_at timestamptz,
  next_retry_at timestamptz,

  claimed_by text,
  claimed_at timestamptz,
  last_heartbeat_at timestamptz,

  created_by uuid not null,

  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint source_ingest_job_source_lowercase check (source = lower(source)),
  constraint source_ingest_job_source_not_blank check (length(btrim(source)) > 0),
  constraint source_ingest_job_priority_nonnegative check (priority >= 0),
  constraint source_ingest_job_batch_size_positive check (batch_size is null or batch_size > 0),
  constraint source_ingest_job_limit_positive check (limit_count is null or limit_count > 0),
  constraint source_ingest_job_cursor_object check (
    cursor is null or jsonb_typeof(cursor) = 'object'
  ),
  constraint source_ingest_job_options_object check (
    jsonb_typeof(options) = 'object'
  ),
  constraint source_ingest_job_error_summary_object check (
    error_summary is null or jsonb_typeof(error_summary) = 'object'
  ),
  constraint source_ingest_job_warning_summary_object check (
    warning_summary is null or jsonb_typeof(warning_summary) = 'object'
  ),
  constraint source_ingest_job_result_summary_object check (
    result_summary is null or jsonb_typeof(result_summary) = 'object'
  ),
  constraint source_ingest_job_counts_nonnegative check (
    processed_count >= 0 and
    created_count >= 0 and
    updated_count >= 0 and
    flagged_count >= 0 and
    failed_count >= 0 and
    skipped_count >= 0 and
    warning_count >= 0 and
    attempt_count >= 0
  ),
  constraint source_ingest_job_claim_pair check (
    (claimed_by is null and claimed_at is null) or
    (claimed_by is not null and claimed_at is not null)
  ),
  constraint source_ingest_job_terminal_finished_at check (
    finished_at is null or status in ('completed', 'failed', 'canceled')
  ),
  constraint source_ingest_job_retry_requires_failure check (
    next_retry_at is null or status = 'failed'
  )
);

comment on table source_ingest_job is
  'Generic ingestion job state for external reference-data sources such as IMSLP.';

comment on column source_ingest_job.source is
  'Stable lowercase source key such as imslp.';

comment on column source_ingest_job.entity_kind is
  'Normalized OpusGraph target entity kind for this job.';

comment on column source_ingest_job.cursor is
  'Structured resume cursor JSON. For IMSLP this maps the list API start offset into the generic cursor model.';

comment on column source_ingest_job.options is
  'Source-specific or run-specific configuration JSON for the adapter.';

comment on column source_ingest_job.error_summary is
  'Summarized failure payload for the most recent job failure, not a full event log.';

comment on column source_ingest_job.warning_summary is
  'Summarized warning payload for parse-quality or ambiguity issues encountered during execution.';

comment on column source_ingest_job.result_summary is
  'Structured execution summary suitable for operator review without reading raw logs.';

comment on column source_ingest_job.claimed_by is
  'Worker identity string such as cron:vercel or worker:ingest-1.';

comment on column source_ingest_job.created_by is
  'Auth user id that initiated the job. Stored without a cross-schema foreign key to match existing auth-user patterns.';

create index if not exists source_ingest_job_source_entity_idx
  on source_ingest_job(source, entity_kind);

create index if not exists source_ingest_job_status_idx
  on source_ingest_job(status);

create index if not exists source_ingest_job_source_status_idx
  on source_ingest_job(source, status);

create index if not exists source_ingest_job_created_at_idx
  on source_ingest_job(created_at desc);

create index if not exists source_ingest_job_created_by_idx
  on source_ingest_job(created_by);

create index if not exists source_ingest_job_dry_run_idx
  on source_ingest_job(dry_run);

create index if not exists source_ingest_job_claimable_idx
  on source_ingest_job(status, next_retry_at, priority desc, created_at asc);

drop trigger if exists trg_source_ingest_job_updated_at on source_ingest_job;
create trigger trg_source_ingest_job_updated_at
before update on source_ingest_job
for each row execute procedure update_updated_at();
