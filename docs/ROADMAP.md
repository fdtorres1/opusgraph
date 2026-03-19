# Roadmap

This file is the current priority view for OpusGraph. Keep it short, current, and linked to the deeper spec or runbook that drives the work.

## Now

### Auth redirect and `org_member` RLS stabilization
- Status: In progress
- Why now: This is active uncommitted work on `main` and it affects core login, signup, callback, and multi-tenant authorization behavior.
- Scope:
  - preserve full internal redirect targets through `/auth/login`, `/auth/signup`, and `/auth/callback`
  - harden redirect handling so only safe internal paths are honored
  - fix `org_member` RLS helper and policy behavior to avoid recursion and align reads and writes by role
  - verify behavior manually with the runbook in `docs/AUTH_AND_RLS_VERIFICATION.md`
- Primary spec: `docs/specs/auth-redirect-and-org-member-rls.md`
- Related docs: `docs/AUTH_AND_RLS_VERIFICATION.md`, `docs/ARCHITECTURE.md`

### Library management foundation and MVP sequencing
- Status: Planned
- Why now: The project direction is established and the implementation plan already exists, but execution needs a canonical roadmap surface for future sessions and parallel work.
- Scope:
  - carry forward the migration, API, and UI work outlined in `docs/DECOMPOSITION.md`
  - use specs and worklog entries to track actual progress instead of treating the decomposition doc as a live status board
- Primary plan: `docs/DECOMPOSITION.md`

## Next

### Implement the remaining Phase 0 and Phase 1 library management work
- Status: Planned
- Reference: `docs/DECOMPOSITION.md`
- Notes: This includes orgs, library entries, tags, comments, performances, import, activity, and settings flows.

### Establish recurring handoff discipline for Codex local and Codex Cloud
- Status: In progress
- Scope:
  - keep `docs/ACTIVE_CONTEXT.md` current
  - append to `docs/WORKLOG.md` after meaningful sessions
  - record durable choices in `docs/DECISIONS.md`

## Later

### Billing and commercial packaging
- Status: Not started
- Notes: Billing is conceptually org-scoped and personal-org aware, but the implementation plan needs a dedicated product and technical spec before execution.

### Venture-studio operating model across projects
- Status: Emerging
- Notes: This should influence how docs and specs are structured, but the current implementation remains repo-local and product-specific.

## Blocked

### End-to-end auth and RLS signoff
- Status: Waiting on manual verification
- Blocker: Local or staging environment with current migrations applied and representative test users.
- Runbook: `docs/AUTH_AND_RLS_VERIFICATION.md`
