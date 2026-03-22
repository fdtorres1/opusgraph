# Roadmap

This file is the current priority view for OpusGraph. Keep it short, current, and linked to the deeper spec or runbook that drives the work.

## Now

### Signed-in auth and `org_member` RLS verification signoff
- Status: In progress
- Why now: The production auth redirect hotfix is deployed, the cloud migration repairs are applied, the hosted publishable-key config is corrected, the dedicated verification fixtures exist, the member catalog-create defect has been fixed, and most app/RLS checks now pass. The remaining gap is rollout of the new server-side signup confirmation flow plus the final auth-flow closeout checks.
- Scope:
  - deploy and re-verify the new signup confirmation flow
  - finish the remaining login/signup/callback and post-auth redirect checks
  - verify the remaining positive `/admin/*` login path with a platform admin account
  - record the completed hosted-app and live-RLS outcomes in the runbook and handoff docs
- record pass/fail outcomes using the runbook and checklist template
- Primary spec: `docs/specs/auth-redirect-and-org-member-rls.md`
- Related docs: `docs/AUTH_AND_RLS_VERIFICATION.md`, `docs/templates/auth-rls-verification-checklist.md`, `docs/ARCHITECTURE.md`

### Auth/RLS failure triage if verification finds defects
- Status: In progress
- Why now: Signup confirmation currently fails in production until the new `/auth/confirm` flow and matching email-template change are live, which remains the immediate blocker for auth-verification signoff and further feature work.
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
- Status: Partially blocked
- Blocker: The new `/auth/confirm` code path is ready locally but still needs deployment plus the matching Supabase email-template update, and the positive `/admin/*` login-return check still needs a usable platform-admin credential path from this shell.
- Runbook: `docs/AUTH_AND_RLS_VERIFICATION.md`
