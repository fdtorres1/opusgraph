# Active Context

This is the canonical handoff file for the next session. Rewrite freely as priorities change.

## Current Objective

Finish stabilizing auth redirect preservation and `org_member` RLS behavior so users land on the correct destination after login/signup and org membership checks behave correctly under RLS.

## Current Branch

- `main`

## In Progress

- Middleware now preserves the full internal path plus query string when redirecting unauthenticated users to `/auth/login`.
- Login and signup now use `redirect` as the canonical auth redirect parameter.
- Auth callback handling now parses redirects through a shared helper, honors only safe internal paths, and accepts legacy `next` only as a backward-compatibility fallback.
- Fresh-install bootstrap logic in `0005_organizations.sql` now carries the corrected `security definer` helper and policy end state.
- `0014_backfill_org_member_rls_helpers.sql` is the chosen forward repair for existing databases that may already have applied the older `0013` fix.
- Static verification is complete: `npm run build` passes, and targeted lint passes for the touched auth/middleware files.
- Linked cloud verification shows the active Supabase project is `vszoxfmjkasnjpzieyyd`, and `0014` has now been applied successfully.
- Hosted verification confirms the deployed hotfix is live: logged-out library and admin redirects now preserve the correct `redirect` target on `opusgraph.vercel.app`.
- Hosted login and signup pages preserve the redirect parameter in their cross-links.
- Manual verification guidance exists in `docs/AUTH_AND_RLS_VERIFICATION.md`, but the full runbook has not been executed in this session.

## Next 3 Steps

1. Execute the remaining signed-in checks from `docs/AUTH_AND_RLS_VERIFICATION.md` using real test users on the cloud environment.
2. Verify the `org_member` role-behavior checks through the SQL editor or app sessions for owner, manager, member, and outsider users.
3. Decide whether to keep the docs/housekeeping changes in the same branch or split them from the auth/RLS implementation work.

## Known Blockers

- Manual verification still depends on a Supabase-backed environment with the latest migrations applied.
- This session has no local `.env` file and no running local Supabase stack, so the manual verification runbook cannot be completed here without additional environment setup.
- This session still lacks test-user credentials and SQL-editor execution context, so the signed-in auth and RLS behavior checks remain blocked from the terminal.

## Key Files

- `middleware.ts`
- `app/auth/login/page.tsx`
- `app/auth/signup/page.tsx`
- `app/auth/callback/route.ts`
- `lib/auth-redirect.ts`
- `supabase/migrations/0005_organizations.sql`
- `supabase/migrations/0013_fix_org_member_rls.sql`
- `supabase/migrations/0014_backfill_org_member_rls_helpers.sql`
- `docs/AUTH_AND_RLS_VERIFICATION.md`
- `docs/specs/auth-redirect-and-org-member-rls.md`

## Key Routes

- `/auth/login`
- `/auth/signup`
- `/auth/callback`
- `/admin/*`
- `/library/[orgSlug]/*`

## Key Tables And Functions

- `organization`
- `org_member`
- `user_profile`
- `is_org_member(uuid)`
- `is_org_manager_or_owner(uuid)`
- `is_org_owner(uuid)`

## Resume Notes

- Preserve only safe internal redirect paths. Reject protocol-relative or external values.
- Generate only `redirect` in new auth flows; accept legacy `next` only when parsing older callback URLs.
- Keep `0013` historically representative. Use `0014` as the upgrade repair path.
- Non-admin users should never be bounced back into `/admin/*` after auth.
- Prefer updating the worklog and this file before ending a session.
