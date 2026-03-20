# Worklog

Append-only log for implementation, investigation, and planning sessions. Keep entries short and resume-oriented.

## 2026-03-18

### Documentation workflow bootstrapped
- Added the canonical repo-native documentation system:
  - `docs/ROADMAP.md`
  - `docs/DECISIONS.md`
  - `docs/WORKLOG.md`
  - `docs/ACTIVE_CONTEXT.md`
  - `docs/specs/`
- Updated `AGENTS.md` so future sessions are expected to read and maintain these files.
- Updated README documentation references so the new files are discoverable.
- Follow-up: keep these files current after every substantial coding or planning session.

### Auth redirect and `org_member` RLS work is in flight
- Active files include:
  - `app/auth/callback/route.ts`
  - `app/auth/login/page.tsx`
  - `app/auth/signup/page.tsx`
  - `lib/auth-redirect.ts`
  - `middleware.ts`
  - `supabase/migrations/0005_organizations.sql`
  - `supabase/migrations/0013_fix_org_member_rls.sql`
  - `supabase/migrations/0014_backfill_org_member_rls_helpers.sql`
  - `docs/AUTH_AND_RLS_VERIFICATION.md`
- Current direction:
  - preserve safe internal redirects through auth flows
  - standardize on `redirect` as the canonical param and accept legacy `next` only in callback parsing
  - fix org membership helper and policy behavior with `security definer` helpers
  - verify redirect preservation and RLS behavior manually
- Verification status:
  - `npm run build` passes
  - targeted lint passes for `app/auth/callback/route.ts`, `app/auth/login/page.tsx`, `app/auth/signup/page.tsx`, `lib/auth-redirect.ts`, and `middleware.ts`
  - full `npm run lint` still fails because of pre-existing repo-wide ESLint issues outside this auth/RLS scope
  - linked cloud verification confirms the project ref `vszoxfmjkasnjpzieyyd` is active
  - `supabase db push --include-all` successfully applied `0002_add_activity_view_rls.sql` and `0014_backfill_org_member_rls_helpers.sql` to the linked cloud project
  - post-push `supabase migration list` shows remote `0014` is now applied
  - hosted-app header verification found a real middleware bug on `opusgraph.vercel.app`: `/library/test-org/catalog?view=all` redirected to `/auth/login?view=all&redirect=%2Flibrary%2Ftest-org%2Fcatalog`, which leaked the original query string onto the login URL instead of preserving it inside `redirect`
  - `middleware.ts` was updated locally to build a fresh `/auth/login` URL instead of cloning `request.nextUrl`, and the fix passes targeted lint and `npm run build`
  - hotfix commit `fb57c7c` was pushed to `origin/main`, Vercel rolled forward, and hosted redirects now behave correctly:
    - `/library/test-org/catalog?view=all` → `/auth/login?redirect=%2Flibrary%2Ftest-org%2Fcatalog%3Fview%3Dall`
    - `/admin/review` → `/auth/login?redirect=%2Fadmin%2Freview`
  - hosted auth pages also preserve the canonical redirect parameter in rendered links:
    - login page links to `/auth/signup?redirect=...`
    - signup page links back to `/auth/login?redirect=...`
  - remote schema-level inspection via `supabase db dump --linked` is blocked by password auth failure for `cli_login_postgres`, so live function/policy DDL could not be re-dumped from this shell
  - local Supabase containers are not running, so local-stack verification remains unavailable in this session
- Follow-up:
  - execute the remaining signed-in auth/RLS verification steps with real test users or SQL-editor access
  - run lint/build/tests as appropriate
  - capture any cloud-specific findings in this log

## 2026-03-19

### IMSLP ingestion investigation and planning
- Reviewed the current reference-data APIs and schema:
  - admin CRUD exists for composers and works
  - admin review/merge flows exist for duplicate handling
  - admin import endpoints are CSV-only and synchronous
  - `external_ids` and `extra_metadata` already exist on `composer` and `work`
- Verified IMSLP source options directly:
  - documented bulk list API works for `type=1` people/categories and `type=2` works
  - standard MediaWiki `api.php` endpoints are available and can return page metadata and full wikitext
  - work-page wikitext contains useful structured fields including title, opus/catalogue number, composition/publication year, style, instrumentation, movements, and duration text
- Added `docs/specs/imslp-reference-ingestion.md` to capture the recommended phased approach:
  - decomposed into smallest-unit tasks `T0-*` through `T12-*`
  - includes dependencies and a recommended first-10-task starting slice
- Recommended implementation direction:
  - build a platform-agnostic ingest service separate from the CSV import routes
  - keep source-specific fetch and parse logic behind adapters, with IMSLP as the first one
  - use IMSLP ids/permalinks as canonical provenance inside the generic `external_ids` model
  - keep imported rows in `draft`
  - send ambiguous matches to `review_flag` instead of auto-merging

### Parallel work coordination protocol added
- Added a lightweight coordination section to `docs/ACTIVE_CONTEXT.md` for:
  - worktree
  - branch
  - scope
  - file ownership
  - status
- Recorded the durable rule in `docs/DECISIONS.md` that concurrent agents should use separate worktrees and explicit ownership rather than sharing one checkout.

## 2026-03-20

### Priority order and verification planning refreshed
- Re-ranked the active work order so the immediate sequence is now:
  - signed-in auth and `org_member` RLS verification
  - auth/RLS failure triage if verification finds defects
  - handoff-doc reconciliation
  - IMSLP ingestion implementation
- Updated `docs/ROADMAP.md` to reflect that ordering explicitly.
- Updated `docs/ACTIVE_CONTEXT.md` so the current objective is the signed-in verification pass rather than ingestion work.
- Added `docs/templates/auth-rls-verification-checklist.md` as the reusable operator checklist for future production verification runs.
- Follow-up:
  - execute the signed-in verification matrix with real test users and/or SQL-editor access
  - record pass/fail outcomes before starting IMSLP implementation work

### Auth user-bootstrap trigger fixed and dedicated verification fixtures created
- Validated the modern Supabase key path:
  - `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` are active for the linked cloud project
  - Auth Admin reads work with the new secret key
- Root-caused the failing new-user bootstrap path:
  - `auth.admin.createUser()` failed with `Database error creating new user`
  - live DB inspection showed `public.handle_new_user()` had no pinned `search_path`
  - `handle_new_user()` called `generate_slug(...)` unqualified
  - in the auth-trigger execution context, unqualified `generate_slug(...)` was not resolvable while `public.generate_slug(...)` succeeded
- Added the forward repair migration `supabase/migrations/0015_fix_handle_new_user_search_path.sql`.
- Applied `0015` to the linked cloud project and marked it applied in remote migration history.
- Re-tested new-user creation with the modern secret key after `0015`; user creation now succeeds.
- Created the dedicated verification org:
  - slug `auth-rls-verification-20260320`
  - id `6228fd52-3a52-49b1-a3fa-50d8bf3a4d00`
- Created the dedicated verification users:
  - `auth-rls-owner-20260320@example.com`
  - `auth-rls-manager-20260320@example.com`
  - `auth-rls-member-20260320@example.com`
  - `auth-rls-outsider-20260320@example.com`
- Assigned the owner, manager, and member users to the verification org and intentionally left the outsider user out of the org.
- Removed the temporary Felix-account memberships from the verification org once the dedicated users existed.
- Stored the dedicated verification logins in 1Password under the `Sage-Openclaw` vault.
- Follow-up:
  - execute the signed-in auth/RLS verification matrix against the live fixture
  - if anything fails, isolate the defect boundary before starting IMSLP implementation work
