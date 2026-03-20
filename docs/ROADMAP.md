# Roadmap

This file is the current priority view for OpusGraph. Keep it short, current, and linked to the deeper spec or runbook that drives the work.

## Now

### Signed-in auth and `org_member` RLS verification signoff
- Status: In progress
- Why now: The production auth redirect hotfix is deployed, the cloud migration repairs are applied, and the dedicated verification fixtures now exist, but the signed-in verification matrix is still incomplete.
- Scope:
  - verify login, signup, confirmation callback, and post-auth redirect behavior with real test users
  - verify `owner`, `manager`, `member`, and authenticated non-member behavior in the hosted app
  - verify direct RLS outcomes at the table level through the SQL editor or equivalent cloud access
  - record pass/fail outcomes using the runbook and checklist template
- Primary spec: `docs/specs/auth-redirect-and-org-member-rls.md`
- Related docs: `docs/AUTH_AND_RLS_VERIFICATION.md`, `docs/templates/auth-rls-verification-checklist.md`, `docs/ARCHITECTURE.md`

### Auth/RLS failure triage if verification finds defects
- Status: Planned
- Why now: Any failing auth or RLS behavior becomes the immediate blocker for further feature work.
- Scope:
  - isolate failures by boundary: middleware, UI, API authorization, RLS policy, or fixture/setup
  - fix only the verified defect slice
  - re-run the affected verification slice before closing the issue
- Primary spec: `docs/specs/auth-redirect-and-org-member-rls.md`

## Next

### Reconcile roadmap and handoff docs after auth/RLS signoff
- Status: Planned
- Why next: Once verification is complete, the handoff docs need one clean refresh so the current objective and next steps are accurate.
- Scope:
  - update `docs/ACTIVE_CONTEXT.md`
  - append verification outcomes to `docs/WORKLOG.md`
  - align `docs/ROADMAP.md` with the next active implementation stream

### Generic source-ingestion foundation with IMSLP as the first adapter
- Status: Planned
- Why next: After auth/RLS signoff, this is the highest-leverage engineering initiative already decomposed into an implementation-ready spec.
- Scope:
  - add a platform-agnostic ingestion framework with jobs, cursors, provenance, and review handling
  - implement IMSLP as the first source adapter for composer and work seeding
  - use source identity in `external_ids` and raw payloads in `extra_metadata`
  - route ambiguous matches into `review_flag` instead of auto-merging
- Immediate task slice:
  - `T0-1` through `T0-4` for framework decisions
  - `T1-1` for the initial job-table migration
  - `T2-1` through `T2-3` for generic ingest types and adapter contract
  - `T4-1` and `T5-1` for initial job creation flow
- Primary spec: `docs/specs/imslp-reference-ingestion.md`

### Implement the remaining Phase 0 and Phase 1 library management work
- Status: Planned
- Reference: `docs/DECOMPOSITION.md`
- Notes: This includes orgs, library entries, tags, comments, performances, import, activity, and settings flows.

## Later

### Billing and commercial packaging
- Status: Not started
- Notes: Billing is conceptually org-scoped and personal-org aware, but the implementation plan needs a dedicated product and technical spec before execution.

### Venture-studio operating model across projects
- Status: Emerging
- Notes: This should influence how docs and specs are structured, but the current implementation remains repo-local and product-specific.

## Blocked

### Signed-in auth and RLS verification execution
- Status: Ready to run
- Blocker: None on fixture setup; the remaining work is the actual execution and result capture.
- Runbook: `docs/AUTH_AND_RLS_VERIFICATION.md`
