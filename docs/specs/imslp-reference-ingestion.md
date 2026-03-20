# Source Ingestion Framework and IMSLP Adapter

## Problem

OpusGraph needs a practical way to seed the reference database with a large volume of composer and work records. IMSLP is the best first source to integrate, but the long-term architecture should support multiple external sources without rebuilding the ingestion pipeline each time.

## Decision Direction

- Build a platform-agnostic ingestion framework.
- Implement IMSLP as the first source adapter inside that framework.
- Keep source-specific fetch and parse logic behind generic ingestion jobs, review flows, and persistence paths.

## Current State

- Existing admin import endpoints are CSV-oriented:
  - `app/api/admin/import/parse/route.ts`
  - `app/api/admin/import/validate/route.ts`
  - `app/api/admin/import/execute/route.ts`
- Existing admin CRUD and review endpoints can support curation after ingest:
  - `app/api/admin/composers/[id]/route.ts`
  - `app/api/admin/works/[id]/route.ts`
  - `app/api/admin/review/[id]/route.ts`
  - `app/api/admin/review/[id]/merge/route.ts`
- The database already has useful target fields and metadata containers:
  - `composer.external_ids`
  - `composer.extra_metadata`
  - `work.external_ids`
  - `work.extra_metadata`
  - `review_flag`
  - `revision`

## Why A Generic Framework

- The durable problem is not “import IMSLP”. It is “ingest reference data from external sources safely and repeatedly.”
- Job orchestration, resume behavior, idempotency, provenance, dedupe, and review are shared concerns across all sources.
- IMSLP still requires adapter-specific logic because its pagination, identifiers, and page parsing are source-specific.
- A generic API with source adapters avoids baking IMSLP assumptions into admin routes while still acknowledging that extraction logic cannot be fully abstracted.

## Framework Boundaries

### Generic Framework Responsibilities

- ingestion job creation and tracking
- source selection and job parameters
- cursor/resume support
- dry-run versus execute flow
- normalized intermediate record shape
- provenance model
- idempotency rules
- duplicate detection and review-flag creation
- persistence into `composer`, `work`, and related tables
- audit and metrics

### Source Adapter Responsibilities

- source fetch logic
- pagination semantics
- raw payload normalization
- source identity extraction
- source-specific parsing rules
- mapping raw payloads into normalized composer/work candidates
- adapter-specific confidence or parse-completeness signals

## Proposed Architecture

### Generic Admin Surface

Prefer a generic ingestion API shape such as:

- `POST /api/admin/ingest/jobs`
- `GET /api/admin/ingest/jobs/[id]`
- `POST /api/admin/ingest/jobs/[id]/run`
- `POST /api/admin/ingest/jobs/[id]/resume`
- `POST /api/admin/ingest/jobs/[id]/cancel`

With job input roughly shaped as:

- `source`
- `entity_kind`
- `mode`
- `cursor`
- `limit`
- `dry_run`
- `options`

### Suggested Internal Layers

- `lib/ingest/`
  - generic framework types and orchestration
- `lib/ingest/adapters/imslp/`
  - IMSLP fetch, parse, and normalized mapping
- `lib/ingest/persist/`
  - composer/work upsert-or-flag behavior
- `lib/ingest/review/`
  - review flag creation and duplicate handling

## Normalized Intermediate Shapes

The framework should work with generic candidate records before persistence.

### Composer Candidate

- `source`
- `source_entity_kind`
- `source_id`
- `source_url`
- `display_name`
- `first_name`
- `last_name`
- `external_ids`
- `raw_payload`
- `warnings`

### Work Candidate

- `source`
- `source_entity_kind`
- `source_id`
- `source_url`
- `title`
- `composer_source_id`
- `composer_display_name`
- `composition_year`
- `instrumentation_text`
- `opus_number`
- `catalog_number`
- `movements`
- `duration_text`
- `external_ids`
- `raw_payload`
- `warnings`

## IMSLP Adapter Capabilities

- IMSLP documents a bulk list API for:
  - people and category pages: `type=1`
  - works: `type=2`
- The list API returns lightweight records such as title/id, permalink, parent category, and limited structured values.
- IMSLP also exposes standard MediaWiki endpoints at `https://imslp.org/api.php`, which can return:
  - page metadata via `action=query`
  - full page wikitext via `action=parse&prop=wikitext`
- The page wikitext contains structured work fields that are directly relevant to OpusGraph, including:
  - `Work Title`
  - `Alternative Title`
  - `Opus/Catalogue Number`
  - `Year/Date of Composition`
  - `Year of First Publication`
  - `Piece Style`
  - `Instrumentation`
  - movements and duration

## Gaps

- No generic source-ingestion framework exists.
- No import-job tracking exists for resumable batch ingestion.
- No canonical uniqueness constraint exists for source identity.
- Admin import execution is row-by-row and synchronous, which is not suitable for large backfills.
- Duplicate detection is fuzzy-only and not source-aware.
- No normalized intermediate candidate model exists.
- No IMSLP-specific parser exists for category names, page titles, or work wikitext.

## Execution Backlog

The plan below is intentionally decomposed into the smallest practical units. Each task should be small enough to implement, review, and verify independently.

### Track 0: Foundations and decisions

#### T0-1 Define source keys and naming rules
- Decide canonical source identifiers:
  - `source = 'imslp'`
  - `entity_kind = 'composer' | 'work'`
  - adapter key path under `extra_metadata.imslp`
- Decide JSON key naming inside `external_ids`.
- Output:
  - stable naming rules for code and stored JSON

#### T0-2 Define ingestion job lifecycle
- Define job statuses such as:
  - `pending`
  - `running`
  - `paused`
  - `completed`
  - `failed`
  - `canceled`
- Define when a job may transition between states.
- Output:
  - explicit lifecycle rules for API and database logic

#### T0-3 Define batch cursor contract
- Decide whether cursor is:
  - source-native string
  - numeric offset
  - structured JSON cursor
- For IMSLP, define how `start` maps into the generic cursor model.
- Output:
  - generic cursor contract plus IMSLP mapping

#### T0-4 Define dry-run semantics
- Decide whether dry-run:
  - fetches and parses only
  - includes duplicate detection
  - writes job logs but not entity rows
- Output:
  - precise dry-run behavior

#### T0-5 Define review-flag policy for imports
- Decide which conditions create review flags:
  - duplicate
  - ambiguous source match
  - ambiguous composer match
  - incomplete parse
- Decide which conditions only produce warnings.
- Output:
  - framework-level flagging rules

### Track 1: Generic schema tasks

#### T1-1 Add `source_ingest_job` migration
- Create the table.
- Include:
  - `id`
  - `source`
  - `entity_kind`
  - `status`
  - `mode`
  - `cursor`
  - `limit`
  - `dry_run`
  - `options`
  - counters
  - error summary
  - `created_by`
  - timestamps

#### T1-2 Add indexes for job querying
- Add indexes for:
  - source + entity kind
  - status
  - created_at
  - created_by

#### T1-3 Add optional job-attempt or event table
- Decide if job-level observability is sufficient.
- If not, add a table for:
  - run attempts
  - state transitions
  - per-run error payloads

#### T1-4 Add source-identity indexing strategy
- Decide if source uniqueness stays application-level first.
- If ready, add partial indexes for stable external ids.
- Keep this incremental if the JSON shape is not finalized.

#### T1-5 Add migration comments or docs for job tables
- Document how cursor, counters, and errors are expected to behave.

### Track 2: Generic TypeScript model tasks

#### T2-1 Add generic ingest domain types
- Create framework types under `lib/ingest/` for:
  - job input
  - job status
  - cursor
  - dry-run result
  - execution summary

#### T2-2 Add normalized candidate types
- Add `ComposerCandidate`.
- Add `WorkCandidate`.
- Add shared candidate metadata types:
  - source identity
  - warnings
  - raw payload

#### T2-3 Add adapter interface
- Define the minimum adapter contract:
  - validate job options
  - fetch batch
  - parse batch
  - return normalized candidates
  - return next cursor

#### T2-4 Add persistence result types
- Define normalized outcomes such as:
  - created
  - updated
  - skipped_existing_source_match
  - flagged_duplicate
  - failed_parse
  - failed_write

### Track 3: Generic persistence tasks

#### T3-1 Add source-identity lookup helper
- Given source plus source id, check for an existing entity by `external_ids`.
- Support both composers and works.

#### T3-2 Add duplicate-detection wrapper
- Wrap existing duplicate logic so the framework can:
  - try source identity first
  - fallback to fuzzy duplicate helpers second

#### T3-3 Add composer persistence service
- Accept a `ComposerCandidate`.
- Map fields into `composer`.
- Write provenance into:
  - `external_ids`
  - `extra_metadata`
- Return a normalized persistence result.

#### T3-4 Add work persistence service
- Accept a `WorkCandidate`.
- Resolve composer linkage.
- Map fields into `work`.
- Write provenance into:
  - `external_ids`
  - `extra_metadata`
- Return a normalized persistence result.

#### T3-5 Add review-flag creation helper
- Centralize creation of import-related review flags.
- Standardize `reason` and `details` payload shape.

#### T3-6 Add revision logging helper
- Centralize revision logging for created or updated imported entities.

### Track 4: Generic job orchestration tasks

#### T4-1 Add job creation service
- Validate source, entity kind, limit, and options.
- Insert a `pending` job row.

#### T4-2 Add job loader service
- Fetch a job by id.
- Validate permissions.

#### T4-3 Add job state-transition guard
- Prevent invalid transitions.
- Reuse this for run, resume, pause, cancel.

#### T4-4 Add job runner service
- Load adapter by source.
- Fetch one batch.
- Parse candidates.
- Persist or dry-run them.
- Update counters and cursor.

#### T4-5 Add resume service
- Resume from stored cursor.
- Reuse the same runner logic.

#### T4-6 Add cancel service
- Mark a job canceled.
- Prevent further execution.

#### T4-7 Add error-handling and retry policy
- Decide which failures are:
  - terminal
  - retryable
  - candidate-level only
- Record errors consistently.

### Track 5: Generic admin API tasks

#### T5-1 Add `POST /api/admin/ingest/jobs`
- Create a job.
- Validate admin permissions.

#### T5-2 Add `GET /api/admin/ingest/jobs/[id]`
- Return status, counters, cursor, and errors.

#### T5-3 Add `POST /api/admin/ingest/jobs/[id]/run`
- Start or continue a job batch.

#### T5-4 Add `POST /api/admin/ingest/jobs/[id]/resume`
- Resume a paused or partially completed job.

#### T5-5 Add `POST /api/admin/ingest/jobs/[id]/cancel`
- Cancel a job safely.

#### T5-6 Add request validation schemas
- Add Zod schemas for all ingestion job endpoints.

### Track 6: Generic verification tasks

#### T6-1 Add unit tests for type-level helpers
- Candidate mapping helpers
- cursor helpers
- job transition helpers

#### T6-2 Add tests for source identity matching
- exact source match
- no source match
- malformed source metadata

#### T6-3 Add tests for review-flag conditions
- duplicate
- ambiguous composer match
- parse incomplete

#### T6-4 Add tests for API permission checks
- unauthorized
- non-admin
- allowed admin/contributor paths

### Track 7: IMSLP composer adapter tasks

#### T7-1 Add IMSLP adapter module skeleton
- Create `lib/ingest/adapters/imslp/`.
- Split files by responsibility:
  - client
  - mapper
  - parser
  - constants

#### T7-2 Add IMSLP list client for `type=1`
- Fetch one composer/person batch.
- Normalize transport-level errors.

#### T7-3 Add `type=1` payload parser
- Parse IMSLP list records into a predictable raw shape.

#### T7-4 Add composer-category classifier
- Distinguish likely composers from other people/category records where possible.
- Emit warnings for uncertain rows.

#### T7-5 Add name parser for IMSLP canonical names
- Parse forms like `Last, First`.
- Handle mononyms and unusual cases conservatively.

#### T7-6 Add composer candidate mapper
- Map parsed IMSLP row into `ComposerCandidate`.

#### T7-7 Add composer adapter integration
- Wire IMSLP `type=1` fetch + parse + map into the generic adapter interface.

#### T7-8 Add composer adapter tests
- happy path
- malformed names
- uncertain classification
- empty batch

### Track 8: IMSLP composer persistence rollout tasks

#### T8-1 Run dry-run ingest for a small composer batch
- Validate counts, warnings, and next cursor behavior.

#### T8-2 Run write-mode ingest for a small composer batch
- Confirm draft rows are created as expected.

#### T8-3 Verify duplicate handling on composer imports
- Confirm review flags are created instead of silent merges.

#### T8-4 Verify stored provenance shape
- Confirm `external_ids` and `extra_metadata.imslp` are consistent.

### Track 9: IMSLP work adapter tasks

#### T9-1 Add IMSLP list client for `type=2`
- Fetch one work batch.

#### T9-2 Add `type=2` payload parser
- Parse title, parent composer category, permalink, and `intvals`.

#### T9-3 Add work identity mapper
- Define canonical source id from:
  - page id
  - permalink
  - page title

#### T9-4 Add MediaWiki page client
- Fetch page metadata and wikitext from `api.php`.

#### T9-5 Add work wikitext field extractor
- Extract:
  - title
  - alternative title
  - opus/catalogue number
  - composition year text
  - publication year text
  - style
  - instrumentation
  - movement text
  - duration text

#### T9-6 Add composition-year normalizer
- Convert parseable year text into first-pass numeric year.

#### T9-7 Add opus/catalog parser
- Split raw string into `opus_number` and `catalog_number` conservatively.

#### T9-8 Add movements parser
- Convert movement text into structured JSON when reliable.
- Fall back to raw text in metadata when not reliable.

#### T9-9 Add work candidate mapper
- Map parsed IMSLP work data into `WorkCandidate`.

#### T9-10 Add composer-resolution helper for works
- Resolve by source identity first.
- Resolve by name fallback second.
- Emit ambiguity warnings when needed.

#### T9-11 Add work adapter integration
- Wire batch fetch + page fetch + parse + candidate mapping into the generic adapter interface.

#### T9-12 Add work adapter tests
- happy path
- missing wikitext fields
- ambiguous composer resolution
- malformed opus/catalog strings

### Track 10: IMSLP work persistence rollout tasks

#### T10-1 Run dry-run ingest for a small work batch
- Validate parse quality and cursor behavior.

#### T10-2 Run write-mode ingest for a small work batch
- Confirm draft rows are created as expected.

#### T10-3 Verify composer linking for imported works
- exact source-id match
- fallback name match
- ambiguous match review flag

#### T10-4 Verify stored work provenance shape
- Confirm `external_ids` and `extra_metadata.imslp` are consistent.

### Track 11: Review and admin UX tasks

#### T11-1 Add review-queue filtering for source imports
- Filter by source.
- Filter by import-related reasons.

#### T11-2 Add admin job-status page or panel
- Show job state, counters, cursor, and recent errors.

#### T11-3 Add admin action for dry-run versus execute
- Ensure this is explicit in the UI or operator flow.

#### T11-4 Add operator documentation
- Document how to:
  - create a job
  - dry-run a batch
  - resume a job
  - review flagged records

### Track 12: Optional enrichment tasks

#### T12-1 Decide whether to map publication info into `work_source`
- Do not implement until seed ingestion is stable.

#### T12-2 Decide whether to map recordings or external links
- Restrict to high-confidence, high-value data.

#### T12-3 Decide whether to normalize style and instrumentation
- Start with raw text preservation first.

#### T12-4 Decide whether to ingest arrangement/file-level data
- Explicitly defer unless there is a clear product need.

## Dependency Order

- T0-1 through T0-5 before schema and API implementation.
- T1-1 through T1-5 before job orchestration lands.
- T2-1 through T2-4 before persistence and adapter integration.
- T3-1 through T3-6 before any write-mode adapter rollout.
- T4-1 through T4-7 before admin execution endpoints are complete.
- T5-1 through T5-6 after core orchestration exists.
- T6-1 through T6-4 should begin as soon as the matching generic code exists.
- T7-* depends on T2 through T5.
- T8-* depends on T7-* and generic persistence.
- T9-* depends on T7-* for shared IMSLP client patterns and on composer import being usable enough to resolve work composers.
- T10-* depends on T9-*.
- T11-* depends on jobs and review flows already existing.
- T12-* is optional and should not block seed ingestion.

## Recommended First 10 Implementation Tasks

1. T0-1 Define source keys and naming rules.
2. T0-2 Define ingestion job lifecycle.
3. T0-3 Define batch cursor contract.
4. T0-4 Define dry-run semantics.
5. T1-1 Add `source_ingest_job` migration.
6. T2-1 Add generic ingest domain types.
7. T2-2 Add normalized candidate types.
8. T2-3 Add adapter interface.
9. T4-1 Add job creation service.
10. T5-1 Add `POST /api/admin/ingest/jobs`.

## Recommended Data Rules

- Treat source identity as append-only provenance, not as proof that two OpusGraph rows should auto-merge.
- Prefer exact external-id matching over fuzzy matching whenever source ids exist.
- Keep imported records as `draft` until reviewed or promoted.
- Preserve raw source payloads so parsers can improve without re-fetching immediately.
- Use batch sizes and resume cursors; do not attempt one huge monolithic import.
- Keep adapter-specific raw data inside `extra_metadata.<source_key>`.

## Suggested Schema And API Follow-Ups

- Add a generic ingestion-jobs table, for example `source_ingest_job`.
- Consider a generic source-record or source-attempt table if job-level observability is not enough.
- Add optional source-specific review detail to `review_flag.details`.
- Add unique or partial-unique indexes for stable external ids once the JSON shape is finalized.
- Add a server-side ingest service layer under `lib/ingest/` instead of extending the CSV routes directly.
- Add generic admin ingestion routes instead of source-named API endpoints.

## Acceptance Criteria

- A batch job can ingest a controlled slice of source data without manual CSV preparation.
- Jobs are resumable by cursor and idempotent by source external id.
- IMSLP can be integrated as one adapter without special-casing the whole ingestion framework around it.
- Ambiguous matches create review flags instead of silently overwriting or merging records.
- Imported drafts are searchable in admin flows and usable as reference candidates for library linking after review/publish.

## Related Files

- `app/api/admin/import/parse/route.ts`
- `app/api/admin/import/validate/route.ts`
- `app/api/admin/import/execute/route.ts`
- `app/api/admin/composers/[id]/route.ts`
- `app/api/admin/works/[id]/route.ts`
- `app/api/admin/review/[id]/route.ts`
- `app/api/admin/review/[id]/merge/route.ts`
- `supabase/migrations/0001_init.sql`
- `docs/ARCHITECTURE.md`
