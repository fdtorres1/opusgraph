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
