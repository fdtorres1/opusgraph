# Roadmap

This file is the current priority view for OpusGraph. Keep it short, current, and linked to the deeper spec or runbook that drives the work.

## Now

### Generic source-ingestion foundation with IMSLP as the first adapter
- Status: In progress
- Why now: Auth/RLS verification is signed off in production, `T0-1` through `T0-4` are codified, `T1-1` is merged and now applied in the linked cloud, and the next active slice is the generic ingest type/adapter layer.
- Scope:
  - add a platform-agnostic ingestion framework with jobs, cursors, provenance, and review handling
  - implement IMSLP as the first source adapter for composer and work seeding
  - use source identity in `external_ids` and raw payloads in `extra_metadata`
  - route ambiguous matches into `review_flag` instead of auto-merging
- Immediate task slice:
  - `T2-1` through `T2-3` for generic ingest types and adapter contract
  - `T4-1` and `T5-1` for initial job creation flow
  - future linked-cloud migrations still require a fresh manual backup while on the phone/mobile network until the home-network IPv6 issue is fixed
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
