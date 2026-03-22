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

### Hosted auth config corrected; signed-in verification exposed a member catalog-create defect
- The first hosted owner-login attempt failed with `Legacy API keys are disabled`.
- Confirmed the deployed browser bundle was still shipping a legacy JWT anon key even though repo code already used `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- After production envs were corrected and the app was redeployed, the hosted bundle switched to the modern `sb_publishable_...` key and owner login succeeded again.
- Signed-in verification findings so far:
  - owner login from `/library/auth-rls-verification-20260320/catalog?view=all` succeeds and returns to the full route
  - outsider login from `/admin/review` falls back to the outsider's library instead of `/admin/*`
  - outsider direct access to the verification org falls back to the outsider's own library
  - member can read the org catalog and settings members page
  - member is denied from `/library/auth-rls-verification-20260320/tags`
- The verification run found a real authorization defect:
  - member users could still see catalog-create affordances
  - member users could load `/library/auth-rls-verification-20260320/catalog/new`
- Implemented a focused fix on branch `fix/member-catalog-create-guard`:
  - redirect members away from `/catalog/new`
  - hide catalog-create affordances for non-manager/non-owner users in the catalog page, dashboard quick actions, and library sidebar
- `npm run build` passes with the catalog-create guard fix.
- Follow-up:
  - deploy the member catalog-create fix
  - re-run the member verification slice first
  - continue manager, owner, signup/callback, and direct RLS verification only after the member slice passes

### Member catalog-create fix deployed; app and live-RLS verification mostly passed
- Merged and deployed PR #22 (`fix: unblock auth verification findings`), which shipped:
  - `0015_fix_handle_new_user_search_path.sql`
  - the member catalog-create route/UI guard fix
  - the latest auth-verification handoff refresh
- Hosted app verification after deploy:
  - member login from `/library/auth-rls-verification-20260320/catalog/new` now lands on `/library/auth-rls-verification-20260320/catalog`
  - member no longer sees `Add New`, `Add New Entry`, or empty-state catalog-create affordances
  - manager can still load `/library/auth-rls-verification-20260320/catalog/new` and sees catalog create affordances
  - owner can still load `/library/auth-rls-verification-20260320/catalog/new`
  - manager and owner can load `/library/auth-rls-verification-20260320/settings/members` and `/library/auth-rls-verification-20260320/tags`
- Live RLS verification using real user JWTs against `rest/v1/org_member`:
  - `owner`, `manager`, and `member` each read 3 membership rows for the verification org
  - `outsider` reads 0 rows
  - `member` insert is denied with RLS (`403`)
  - `manager` insert succeeds
  - `owner` update succeeds
  - `manager` update/delete return empty results rather than explicit `403`, which is consistent with the row not being writable/visible through policy
  - `owner` delete succeeds
  - outsider membership cleanup was confirmed; the verification org is back to 3 members
- Remaining gaps:
  - positive `/admin/review` login return for a platform-admin account
  - signup confirmation/callback proof with a fresh account or generated confirmation link
  - final verification summary/write-up in the runbook

## 2026-03-21

### Signup confirmation/callback defect isolated
- Used the secure 1Password service-account path to read `SUPABASE_SECRET_KEY` from the `Sage-Openclaw` vault without storing the secret in repo files or shell startup files.
- Generated a fresh admin signup confirmation link for a brand-new user targeting:
  - `/auth/callback?redirect=%2Flibrary%2Fauth-rls-verification-20260320%2Fcatalog`
- Replayed the live Supabase verify URL end to end and captured the redirect chain.
- Confirmed the live verify flow preserves the canonical internal redirect target, but the app still fails after control returns from Supabase:
  - Supabase verify responds with a `303` to `/auth/callback?redirect=...#access_token=...&refresh_token=...&type=signup`
  - the final app destination is `/auth/login?error=auth_callback_error&redirect=%2Flibrary%2Fauth-rls-verification-20260320%2Fcatalog`
- Re-read `app/auth/callback/route.ts` and confirmed the route currently handles only `code` exchange:
  - there is no handling for email-confirmation token flow such as `token_hash`/`type` verification
  - URL-fragment tokens are invisible to the server route, so the current implementation cannot complete the signup confirmation flow as returned by Supabase verify
- Result:
  - the remaining auth-verification blocker is now a concrete callback defect, not email rate limiting or fixture setup
- Follow-up:
  - open a narrow fix branch for the signup confirmation/callback path
  - add support for the Supabase email-confirmation token shape in `/auth/callback`
  - re-run the generated-link verification after the fix

### Server-side signup confirmation flow implemented locally
- Opened branch `fix/signup-confirm-flow`.
- Implemented a dedicated server-side confirmation route:
  - `app/auth/confirm/route.ts`
  - verifies `token_hash` + `type` with `supabase.auth.verifyOtp(...)`
  - reuses the existing safe redirect contract and post-auth destination policy
- Narrowed `app/auth/callback/route.ts` back to the `?code=...` exchange path and moved shared post-auth destination logic into:
  - `lib/post-auth-redirect.ts`
- Extended `lib/auth-redirect.ts` so server auth routes can safely recover the intended internal destination from a same-origin absolute `redirect_to` URL.
- Updated:
  - `app/page.tsx` to reuse the shared post-auth destination helper
  - `app/auth/signup/page.tsx` so `emailRedirectTo` carries the final intended in-app destination instead of `/auth/callback`
- Verification:
  - `npm run build` passes
  - local dev verification against the live Supabase project passed:
    - generated a fresh `hashed_token` with `auth.admin.generateLink({ type: "signup" })`
    - called `http://localhost:3000/auth/confirm?token_hash=...&type=signup&redirect_to=https://opusgraph.vercel.app/library/auth-rls-verification-20260320/catalog`
    - observed session cookie establishment
    - final destination was the new user’s personal library (`/library/my-library-...`), which is the correct non-member fallback
- Remaining rollout dependency:
  - production still needs the Supabase email template updated to a server-visible confirmation URL such as:
    - `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}`
- Follow-up:
  - deploy this branch
  - update the Supabase confirmation email template
  - rerun production signup confirmation verification

### Signup confirmation flow deployed and verified in production
- Created and merged PR #23 (`fix: add server-side signup confirmation flow`).
- Production now includes:
  - `app/auth/confirm/route.ts`
  - narrowed `app/auth/callback/route.ts`
  - shared `lib/post-auth-redirect.ts`
- Used the official Supabase Management API with a dashboard access token to update hosted auth config:
  - `site_url` is now `https://opusgraph.vercel.app`
  - Confirm signup template now uses:
    - `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}`
- Waited for Vercel to deploy until `/auth/confirm` stopped returning `404`.
- Re-ran production signup confirmation using a fresh `hashed_token`.
- Production verification result:
  - `/auth/confirm` sets the auth session cookie
  - the first redirect target is the requested verification-org catalog
  - downstream org access rules redirect the new outsider user to their personal library
  - final destination was `/library/my-library-...`, which is the correct result for a newly confirmed non-member
- Remaining auth verification gap:
  - positive `/admin/review` login-return path for a platform-admin account

## 2026-03-22

### Final auth/RLS verification signoff completed
- Created a dedicated platform-admin verification user:
  - `auth-rls-admin-20260322@example.com`
  - `user_profile.admin_role = contributor`
  - credentials stored in 1Password under `Sage-Openclaw`
- Verified the final positive admin redirect flow in production:
  - logged-out `/admin/review` redirects to `/auth/login?redirect=%2Fadmin%2Freview`
  - successful admin login returns to `/admin/review`
  - the final page is the real review screen, not a fallback destination
- Re-ran the highest-signal auth regressions:
  - outsider login from `/admin/review` still falls back to the outsider personal library
  - owner login from `/library/auth-rls-verification-20260320/catalog?view=all` still returns to the requested route
  - production signup confirmation through `/auth/confirm` still lands a fresh outsider in the new user’s personal library
- Result:
  - the signed-in auth and `org_member` RLS verification pass is now signed off in production
  - the next active implementation objective is the generic source-ingestion foundation with IMSLP as the first adapter

### IMSLP `T0-1` through `T0-4` decisions grounded against live IMSLP payloads
- Re-checked the IMSLP source contract directly against:
  - the official list API documented at `IMSLP:API`
  - live `type=1` and `type=2` list responses from `API.ISCR.php`
  - live `api.php` responses for person and work pages
- Decision updates written into `docs/specs/imslp-reference-ingestion.md`:
  - canonical IMSLP identity should use resolved page title + canonical page URL, not raw list `pageid`
  - framework `entity_kind` stays `composer | work`, while source-side IMSLP kinds stay `person | work`
  - ingest jobs use a six-state lifecycle: `pending`, `running`, `paused`, `completed`, `failed`, `canceled`
  - the generic cursor should be structured JSON, with IMSLP `start` mapped into an offset model
  - dry-run should execute fetch, redirect resolution, parse, normalization, and duplicate matching without writing `composer`, `work`, `review_flag`, or `revision`
- Follow-up:
  - implement `T1-1`, then `T2-1` through `T2-3` on top of those now-explicit framework decisions
