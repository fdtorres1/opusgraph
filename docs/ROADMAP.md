# Roadmap

This file is the current priority view for OpusGraph. Keep it short, current, and linked to the deeper spec or runbook that drives the work.

## Now

### Generic source-ingestion foundation with IMSLP as the first adapter
- Status: In progress
- Why now: Auth/RLS verification is signed off in production, `T0-1` through `T0-4` are codified, `T1-1` is applied in the linked cloud, and the ingest type, persistence, job-service, and first admin API layers are now in place.
- Scope:
  - add a platform-agnostic ingestion framework with jobs, cursors, provenance, and review handling
  - implement IMSLP as the first source adapter for composer and work seeding
  - use source identity in `external_ids` and raw payloads in `extra_metadata`
  - route ambiguous matches into `review_flag` instead of auto-merging
- Immediate task slice:
  - pause further live IMSLP work-slice expansion beyond offset `1600`
  - merge the new orchestral-only correction before resuming work ingest:
    - the IMSLP work adapter now classifies orchestral scope from instrumentation text
    - non-orchestral or unconfirmed IMSLP work candidates are quarantined into `review_flag.reason = "orchestral_scope_review"` instead of flowing through normal work ingest
    - live dry-run check on the first `25` rows now returns `20` quarantined and only `5` positively orchestral updates
  - the already imported IMSLP work corpus has now been backfilled into quarantine:
    - `1602` IMSLP works processed
    - `1561` quarantined
    - classification summary:
      - `1555` `non_orchestral`
      - `6` `unknown`
      - `41` positively `orchestral`
  - next operator step after merge:
    - inspect the quarantine queue and decide whether new IMSLP work ingestion should resume immediately or wait for review tooling improvements
  - the CLI wrappers still settle late enough to look hung, so operator verification against `source_ingest_job`, `review_flag`, and coverage counts remains the safer path during live runs
  - the `200`, `300`, and `400` slices are now operationally recovered to:
    - `0` failed rows
    - only duplicate-review cases remaining
  - the first deliberate composer catch-up batch succeeded:
    - dry-run `218` usable rows with `137` creates and `0` failures
    - live `218` usable rows with `130` creates, `80` updates, `8` duplicate flags, and `0` failures
  - the larger composer catch-up from offset `250` also succeeded:
    - dry-run `475` usable rows with `470` creates and `0` failures
    - live `475` usable rows with `462` creates, `4` updates, `9` duplicate flags, and `0` failures
  - replaying work offset `500` after composer coverage reached `1030` was still too early:
    - dry-run returned `17` creates and `83` composer-resolution failures
  - the follow-up composer catch-up from offset `750` is materially expanding coverage again:
    - dry-run `475` usable rows with `474` creates and `0` failures
  - broad composer catch-up alone was not enough for work offset `500`:
    - `18` creates
    - `82` composer-resolution failures
  - targeted offset-`500` composer recovery did work:
    - `72` exact missing composers created
    - follow-up dry-run returned `100` creates and `0` failures
    - matching live batch returned `93` creates, `2` updates, `5` duplicate flags, and `0` failures
  - targeted offset-`600` composer recovery also worked:
    - `65` exact missing composers created
    - follow-up dry-run returned `96` creates, `4` duplicate flags, and `0` failures
    - matching live batch returned `94` creates, `6` duplicate flags, and `0` failures
  - targeted offset-`700` recovery now also works:
    - `70` unique missing composers derived from the slice
    - `69` created and `1` duplicate-flagged during targeted seeding
    - two residual duration parser misses were fixed (`1 to 2 minutes each`, `6'`)
    - follow-up dry-run returned `99` creates, `1` update, and `0` failures
    - matching live batch returned `96` creates, `2` updates, `2` duplicate flags, and `0` failures
  - targeted offset-`800` recovery now also works:
    - `68` unique missing composers derived from the slice
    - all `68` created cleanly during targeted seeding
    - follow-up dry-run returned `100` creates and `0` failures
    - matching live batch returned `91` creates, `5` updates, `4` duplicate flags, and `0` failures
  - targeted offset-`900` recovery now also works:
    - `65` unique missing composers derived from the slice
    - all `65` created cleanly during targeted seeding
    - follow-up dry-run returned `99` creates, `1` duplicate flag, and `0` failures
    - matching live batch returned `90` creates, `4` updates, `6` duplicate flags, and `0` failures
  - targeted offset-`1000` recovery now also works:
    - `63` unique missing composers derived from the slice
    - all `63` created cleanly during targeted seeding
    - follow-up dry-run returned `96` creates, `4` duplicate flags, and `0` failures
    - matching live batch returned `93` creates, `1` update, `6` duplicate flags, and `0` failures
  - targeted offset-`1100` recovery now also works:
    - `58` unique missing composers derived from the slice
    - all `58` created cleanly during targeted seeding
    - follow-up dry-run returned `100` creates and `0` failures
    - matching live batch returned `96` creates, `1` update, `3` duplicate flags, and `0` failures
  - targeted offset-`1200` recovery now also works:
    - mixed failure slice: `68` unresolved composers plus `1` bad IMSLP duration field
    - the IMSLP adapter now drops non-numeric `Average Duration` strings like `'dedicate alle Dame'`
    - the new unified recovery script then completed the slice end to end
    - final dry-run returned `100` creates and `0` failures
    - matching live batch returned `95` creates, `1` update, `4` duplicate flags, and `0` failures
  - targeted offset-`1300` recovery now also works:
    - initial dry-run returned `37` creates, `1` duplicate flag, and `62` composer-resolution failures
    - targeted composer seeding expanded IMSLP composer coverage from `2021` to `2074`
    - dry-run replay returned `99` creates, `1` duplicate flag, and `0` failures
    - matching live batch returned `93` creates, `7` duplicate flags, and `0` failures
    - a duplicate live attempt left one stale zero-counter job row, which was canceled after the real live batch settled
  - targeted offset-`1400` recovery now also works:
    - initial dry-run returned `30` creates, `1` duplicate flag, and `69` composer-resolution failures
    - targeted composer seeding expanded IMSLP composer coverage from `2074` to `2139`
    - dry-run replay returned `98` creates, `1` update, `1` duplicate flag, and `0` failures
    - matching live batch returned `93` creates, `1` update, `6` duplicate flags, and `0` failures
  - targeted offset-`1500` recovery now also works:
    - initial dry-run returned `37` creates, `1` duplicate flag, and `62` composer-resolution failures
    - targeted composer seeding expanded IMSLP composer coverage from `2139` to `2193`
    - dry-run replay returned `99` creates, `1` duplicate flag, and `0` failures
    - matching live batch returned `83` creates, `1` update, `16` duplicate flags, and `0` failures
  - targeted offset-`1600` recovery now also works:
    - initial dry-run returned `43` creates, `1` duplicate flag, and `56` composer-resolution failures
    - targeted composer seeding expanded IMSLP composer coverage from `2193` to `2246`
    - dry-run replay returned `99` creates, `1` duplicate flag, and `0` failures
    - matching live batch returned `95` creates, `1` update, `4` duplicate flags, and `0` failures
  - the fresh live offset-`400` job exposed `96` new composer-resolution misses; the follow-up composer-link pass resolved them by updating `86` existing composers with IMSLP source identity, and the backfill reduced the slice to:
    - `0` failed rows
    - `6` duplicate-review cases
  - current linked-cloud IMSLP coverage is:
    - `2246` composers
    - `1602` works
  - inspect the remaining warning mix at real write scale:
    - movement parsing
    - redirected IMSLP pages
    - ambiguous composition years
  - keep targeted composer seeding available as an operational tool if later work slices expose new coverage gaps
  - Supabase-managed daily physical backups are now available after the plan upgrade, but PITR is still off and phone-network manual dumps remain useful when a downloadable artifact is needed
- Primary spec: `docs/specs/imslp-reference-ingestion.md`

## Next

### Implement the remaining Phase 0 and Phase 1 library management work
- Status: Planned
- Reference: `docs/DECOMPOSITION.md`
- Notes: This includes orgs, library entries, tags, comments, performances, import, activity, and settings flows.

### Billing and commercial packaging spec
- Status: Planned
- Notes: Billing is conceptually org-scoped and personal-org aware, but the implementation plan needs a dedicated product and technical spec before execution.

## Later

### Venture-studio operating model across projects
- Status: Emerging
- Notes: This should influence how docs and specs are structured, but the current implementation remains repo-local and product-specific.

## Recently Completed

### Signed-in auth and `org_member` RLS verification signoff
- Status: Complete
- Outcome:
  - production login redirect preservation passed for library and admin paths
  - outsider admin fallback passed
  - owner requested-route return passed
  - signup confirmation now works through `/auth/confirm`
  - live `org_member` RLS checks passed the core role matrix
- Runbook: `docs/AUTH_AND_RLS_VERIFICATION.md`
