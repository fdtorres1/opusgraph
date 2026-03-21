# Active Context

This is the canonical handoff file for the next session. Rewrite freely as priorities change.

## Current Objective

Deploy the member catalog-create authorization fix, re-run the blocked signed-in verification slice, then finish the remaining auth and `org_member` RLS verification before starting IMSLP ingestion implementation.

## Current Branch

- `fix/member-catalog-create-guard`

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
  - Branch: `fix/member-catalog-create-guard`
  - Scope: member catalog-create authorization fix, verification continuation, and handoff refresh
  - File ownership:
    - `app/library/[orgSlug]/catalog/[id]/page.tsx`
    - `app/library/[orgSlug]/catalog/page.tsx`
    - `app/library/[orgSlug]/catalog/catalog-client.tsx`
    - `app/library/[orgSlug]/layout.tsx`
    - `app/library/[orgSlug]/page.tsx`
    - `components/library-sidebar.tsx`
    - `docs/ACTIVE_CONTEXT.md`
    - `docs/ROADMAP.md`
    - `docs/WORKLOG.md`
    - `docs/DECISIONS.md`
  - Status: active
  - Notes: local member-catalog-create fix is committed; current task is to deploy it and resume the blocked verification matrix

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
- The live verification run found a real defect: members could still see catalog-create affordances and load `/library/auth-rls-verification-20260320/catalog/new`.
- A focused local fix now exists on this branch:
  - members are redirected away from `/catalog/new`
  - catalog-create affordances are hidden for non-manager/non-owner users
  - `npm run build` passes
- IMSLP ingestion planning review is complete:
  - the current reference import pipeline is CSV-only
  - admin CRUD, duplicate review, `external_ids`, `extra_metadata`, `review_flag`, and `revision` provide reusable building blocks
  - IMSLP exposes a documented bulk list API for people and works plus usable MediaWiki `api.php` endpoints for page metadata and wikitext
  - the plan has been revised so the target architecture is a generic source-ingestion framework with IMSLP as the first adapter
  - the spec is now decomposed into smallest-unit execution tasks with task IDs `T0-*` through `T12-*`, explicit dependencies, and a recommended first-10-task sequence
  - a focused spec now exists at `docs/specs/imslp-reference-ingestion.md`

## Next 3 Steps

1. Execute the signed-in verification matrix from `docs/AUTH_AND_RLS_VERIFICATION.md` using `docs/templates/auth-rls-verification-checklist.md` with real owner, manager, member, and non-member test users.
2. Deploy the local member catalog-create guard fix and re-run the member verification slice first.
3. If the member slice passes, continue manager, owner, signup/callback, and direct RLS verification; if the full matrix passes, refresh the handoff docs and begin `T0-1` through `T0-4`, then `T1-1`, `T2-1` through `T2-3`, `T4-1`, and `T5-1` from `docs/specs/imslp-reference-ingestion.md`.

## Known Blockers

- This session has no local `.env` file and no running local Supabase stack, so the cloud environment remains the practical verification target.
- The full signed-in verification matrix should not continue until the member catalog-create guard fix is deployed and rechecked on the hosted app.
- IMSLP implementation should not start until auth/RLS verification is either signed off or narrowed into a known follow-up fix slice.

## Key Files

- `middleware.ts`
- `app/auth/login/page.tsx`
- `app/auth/signup/page.tsx`
- `app/auth/callback/route.ts`
- `lib/auth-redirect.ts`
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
- The current stack-ranked order is: member catalog-create fix deployment and recheck, remaining signed-in auth/RLS verification, auth/RLS failure triage if needed, handoff-doc reconciliation, then IMSLP ingestion implementation.
- The live verification fixture is:
  - org slug `auth-rls-verification-20260320`
  - org id `6228fd52-3a52-49b1-a3fa-50d8bf3a4d00`
  - owner `auth-rls-owner-20260320@example.com`
  - manager `auth-rls-manager-20260320@example.com`
  - member `auth-rls-member-20260320@example.com`
  - outsider `auth-rls-outsider-20260320@example.com`
- The latest hosted verification findings are:
  - owner redirect/login works
  - outsider fallback works for both `/admin/*` and another org's library route
  - member still needs a deployed recheck for `/catalog/new` and create affordances after the local fix on this branch
- For concurrent agent work, prefer separate worktrees and branches, and claim file ownership in `Parallel Work Coordination` before editing.
- For source ingestion, keep the framework generic and isolate IMSLP-specific logic inside an adapter that uses official IMSLP list endpoints for discovery and `api.php` for detailed page extraction before considering HTML scraping.
- For implementation sequencing, use the task IDs in `docs/specs/imslp-reference-ingestion.md` rather than phase labels; the current starting slice is `T0-1` through `T0-4`, then `T1-1`, `T2-1` through `T2-3`, `T4-1`, and `T5-1`.
- Prefer updating the worklog and this file before ending a session.
