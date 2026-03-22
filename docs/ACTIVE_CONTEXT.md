# Active Context

This is the canonical handoff file for the next session. Rewrite freely as priorities change.

## Current Objective

Start the generic source-ingestion foundation with IMSLP as the first adapter now that the signed-in auth and `org_member` RLS verification pass is complete.

## Current Branch

- `docs/auth-rls-signoff`

## Parallel Work Coordination

### Coordination Rules

- Use a separate `git worktree` for each active agent or coding stream.
- Use a separate branch per worktree.
- Do not let two active agents make code edits from the same worktree.
- Do not let two active agents own the same files at the same time.
- Before starting substantial work, add or update an entry in `Active Workstreams`.
- Before ending a session, update the matching workstream entry or remove it if the work is complete.

### Active Workstreams

- Agent: current Codex session
  - Worktree: current checkout at `/Volumes/Felix-SSD-1/Cursor Projects/opusgraph`
  - Branch: `docs/auth-rls-signoff`
  - Scope: auth/RLS signoff doc closeout and handoff transition to IMSLP
  - File ownership:
    - `docs/ACTIVE_CONTEXT.md`
    - `docs/AUTH_AND_RLS_VERIFICATION.md`
    - `docs/ROADMAP.md`
    - `docs/WORKLOG.md`
  - Status: active
  - Notes: member-catalog-create and signup-confirm fixes are merged and deployed; current task is to close the final verification gap and leave a clean handoff

## In Progress

- Middleware now preserves the full internal path plus query string when redirecting unauthenticated users to `/auth/login`.
- Login and signup now use `redirect` as the canonical auth redirect parameter.
- Auth callback handling now parses redirects through a shared helper, honors only safe internal paths, and accepts legacy `next` only as a backward-compatibility fallback.
- Fresh-install bootstrap logic in `0005_organizations.sql` now carries the corrected `security definer` helper and policy end state.
- `0014_backfill_org_member_rls_helpers.sql` is the chosen forward repair for existing databases that may already have applied the older `0013` fix.
- `0015_fix_handle_new_user_search_path.sql` is now the forward repair for the auth bootstrap trigger, pinning `search_path = public` and schema-qualifying `public.generate_slug(...)` inside `handle_new_user()`.
- Static verification is complete: `npm run build` passes, and targeted lint passes for the touched auth/middleware files.
- Linked cloud verification shows the active Supabase project is `vszoxfmjkasnjpzieyyd`, and `0014` has now been applied successfully.
- Hosted verification confirms the deployed hotfix is live: logged-out library and admin redirects now preserve the correct `redirect` target on `opusgraph.vercel.app`.
- Hosted login and signup pages preserve the redirect parameter in their cross-links.
- Manual verification guidance exists in `docs/AUTH_AND_RLS_VERIFICATION.md`, and the reusable checklist now lives in `docs/templates/auth-rls-verification-checklist.md`.
- The modern `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` are verified valid; the earlier user-creation failure was traced to the `handle_new_user()` trigger, not to credential or app misconfiguration.
- Production was temporarily serving a legacy Supabase anon key in the hosted browser bundle, which caused `Legacy API keys are disabled` during login; the production env/config was corrected and owner login now works again with the modern publishable key.
- Dedicated cloud verification fixtures now exist:
  - org `auth-rls-verification-20260320` (`6228fd52-3a52-49b1-a3fa-50d8bf3a4d00`)
  - `auth-rls-owner-20260320@example.com`
  - `auth-rls-manager-20260320@example.com`
  - `auth-rls-member-20260320@example.com`
  - `auth-rls-outsider-20260320@example.com`
- The temporary verification-org memberships for the two Felix accounts were removed after the dedicated test users were created.
- Signed-in verification findings so far:
  - owner login returns correctly to `/library/auth-rls-verification-20260320/catalog?view=all`
  - outsider auth from `/admin/review` falls back to the outsider's own library instead of `/admin/*`
  - outsider direct access to the verification org falls back to the outsider's own library
  - member can read the org catalog and settings members page
  - member is denied from `/library/auth-rls-verification-20260320/tags`
- The member catalog-create defect has now been fixed and revalidated in production:
  - member login from `/catalog/new` now lands on `/catalog`
  - members no longer see catalog-create affordances
  - manager and owner still reach `/catalog/new`
- Live `org_member` RLS checks using real user JWTs against `rest/v1` now confirm:
  - `owner`, `manager`, and `member` each read the verification-org membership rows
  - `outsider` reads zero rows
  - `member` insert is denied
  - `manager` insert succeeds
  - `owner` update/delete succeeds
  - `manager` update/delete noop because the row is not writable/visible under policy
  - outsider cleanup was confirmed after mutation checks
- Admin-generated signup confirmation has now been exercised directly against the live Supabase verify endpoint:
  - Supabase verification preserves the canonical `redirect` target back to `/auth/callback`
  - the live flow currently lands on `/auth/login?error=auth_callback_error&redirect=%2Flibrary%2Fauth-rls-verification-20260320%2Fcatalog`
  - the current callback route only handles `code` exchange and does not handle the email-confirmation token shape returned by the signup verification flow
- A new server-side confirmation flow is now implemented locally:
  - `/auth/confirm` verifies `token_hash` + `type` with `verifyOtp(...)`
  - `/auth/callback` now remains the `?code=...` path
  - post-auth redirect policy is shared in `lib/post-auth-redirect.ts`
  - safe redirect parsing now also supports same-origin `redirect_to` URLs
- The server-side signup confirmation flow is now merged and deployed:
  - PR #23 merged to `main`
  - production `/auth/confirm` is live
  - the hosted Supabase Confirm signup template now points at `/auth/confirm?token_hash=...&type=email&redirect_to={{ .RedirectTo }}`
- Production end-to-end signup confirmation now passes:
  - a fresh production `token_hash` sets the session cookie on `/auth/confirm`
  - the flow first redirects to the requested verification-org catalog
  - downstream org access rules correctly fall the new outsider user back to their personal library
- Final production auth/RLS signoff checks now pass:
  - a real platform-admin login from `/admin/review` returns to `/admin/review`
  - a non-admin login from `/admin/review` still falls back to the user's personal library
  - owner login from `/library/auth-rls-verification-20260320/catalog?view=all` still returns to the requested route
  - auth/RLS verification is now complete and no longer the active implementation blocker
- IMSLP ingestion planning review is complete:
  - the current reference import pipeline is CSV-only
  - admin CRUD, duplicate review, `external_ids`, `extra_metadata`, `review_flag`, and `revision` provide reusable building blocks
  - IMSLP exposes a documented bulk list API for people and works plus usable MediaWiki `api.php` endpoints for page metadata and wikitext
  - the plan has been revised so the target architecture is a generic source-ingestion framework with IMSLP as the first adapter
  - the spec is now decomposed into smallest-unit execution tasks with task IDs `T0-*` through `T12-*`, explicit dependencies, and a recommended first-10-task sequence
  - a focused spec now exists at `docs/specs/imslp-reference-ingestion.md`

## Next 3 Steps

1. Start `T0-1` through `T0-4` from `docs/specs/imslp-reference-ingestion.md` to lock the generic ingestion boundaries, job model, and review/provenance decisions.
2. Implement `T1-1`, then `T2-1` through `T2-3` so the repo has the first generic ingestion job table, TypeScript contracts, and adapter interface.
3. Move into `T4-1` and `T5-1` to create the first ingestion job flow and the IMSLP adapter bootstrap once the framework slice is in place.

## Known Blockers

- This session has no local `.env` file and no running local Supabase stack, so the cloud environment remains the practical verification target.
- IMSLP implementation still depends on staying disciplined about the generic adapter boundary so the first IMSLP slice does not collapse back into a one-off importer.

## Key Files

- `middleware.ts`
- `app/auth/login/page.tsx`
- `app/auth/signup/page.tsx`
- `app/auth/callback/route.ts`
- `app/auth/confirm/route.ts`
- `lib/auth-redirect.ts`
- `lib/post-auth-redirect.ts`
- `supabase/migrations/0005_organizations.sql`
- `supabase/migrations/0013_fix_org_member_rls.sql`
- `supabase/migrations/0014_backfill_org_member_rls_helpers.sql`
- `supabase/migrations/0015_fix_handle_new_user_search_path.sql`
- `docs/AUTH_AND_RLS_VERIFICATION.md`
- `docs/templates/auth-rls-verification-checklist.md`
- `docs/specs/auth-redirect-and-org-member-rls.md`
- `docs/specs/imslp-reference-ingestion.md`

## Key Routes

- `/auth/login`
- `/auth/signup`
- `/auth/callback`
- `/auth/confirm`
- `/admin/*`
- `/library/[orgSlug]/*`

## Key Tables And Functions

- `organization`
- `org_member`
- `user_profile`
- `handle_new_user()`
- `generate_slug(text)`
- `is_org_member(uuid)`
- `is_org_manager_or_owner(uuid)`
- `is_org_owner(uuid)`

## Resume Notes

- Preserve only safe internal redirect paths. Reject protocol-relative or external values.
- Generate only `redirect` in new auth flows; accept legacy `next` only when parsing older callback URLs.
- Keep `0013` historically representative. Use `0014` as the upgrade repair path.
- Keep `0015` as the forward repair for the auth bootstrap trigger; do not rewrite `0005` again without a deliberate migration-history decision.
- Non-admin users should never be bounced back into `/admin/*` after auth.
- The auth/RLS verification pass is signed off in production; use `docs/AUTH_AND_RLS_VERIFICATION.md` as historical evidence rather than as the active objective.
- The current stack-ranked order is: IMSLP ingestion foundation, then remaining library-management roadmap work, then billing/commercial packaging.
- The live verification fixture is:
  - org slug `auth-rls-verification-20260320`
  - org id `6228fd52-3a52-49b1-a3fa-50d8bf3a4d00`
  - owner `auth-rls-owner-20260320@example.com`
  - manager `auth-rls-manager-20260320@example.com`
  - member `auth-rls-member-20260320@example.com`
  - outsider `auth-rls-outsider-20260320@example.com`
- The latest hosted verification findings are:
  - owner redirect/login works
  - platform-admin `/admin/review` login-return works
  - outsider fallback works for both `/admin/*` and another org's library route
  - member `/catalog/new` access and create affordances are now fixed in production
  - manager and owner create paths remain intact
  - `org_member` live RLS checks now pass the core select/insert/update/delete matrix through `rest/v1` with real user JWTs
  - production signup confirmation now works through `/auth/confirm`
  - a fresh outsider signup correctly lands in the new user’s personal library rather than the requested verification org
- For concurrent agent work, prefer separate worktrees and branches, and claim file ownership in `Parallel Work Coordination` before editing.
- For source ingestion, keep the framework generic and isolate IMSLP-specific logic inside an adapter that uses official IMSLP list endpoints for discovery and `api.php` for detailed page extraction before considering HTML scraping.
- For implementation sequencing, use the task IDs in `docs/specs/imslp-reference-ingestion.md` rather than phase labels; the current starting slice is `T0-1` through `T0-4`, then `T1-1`, `T2-1` through `T2-3`, `T4-1`, and `T5-1`.
- Prefer updating the worklog and this file before ending a session.
