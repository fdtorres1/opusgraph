# Auth Redirect And `org_member` RLS

## Problem

Two related issues are in flight:

1. Auth redirects need to preserve the originally requested internal destination across middleware, login, signup, email confirmation, and callback handling.
2. `org_member` RLS behavior needs to allow correct role-based reads and writes without recursive or caller-scoped policy failures.

These problems affect the first-run experience, access control correctness, and recoverability when users move between protected routes and auth pages.

## Scope

- Preserve full internal redirect targets, including query strings, for `/library/*` and `/admin/*`.
- Reject unsafe redirect values such as external URLs or protocol-relative paths.
- Ensure signup confirmation links round-trip the intended redirect through `/auth/callback`.
- Ensure non-admin users are not redirected back into `/admin/*` after auth.
- Move org membership checks into safe helper functions and update policies to use them consistently.
- Verify behavior with the manual runbook in `docs/AUTH_AND_RLS_VERIFICATION.md`.

## Non-Goals

- A broader auth redesign
- Org-switcher UX changes
- Full automated auth/RLS test coverage in this pass

## Current Implementation Surface

- `middleware.ts`
- `app/auth/login/page.tsx`
- `app/auth/signup/page.tsx`
- `app/auth/callback/route.ts`
- `supabase/migrations/0005_organizations.sql`
- `supabase/migrations/0013_fix_org_member_rls.sql`
- `supabase/migrations/0014_backfill_org_member_rls_helpers.sql`

## Requirements

### Redirect handling
- Preserve the full internal path and query string when sending unauthenticated users to `/auth/login`.
- Carry the same redirect from login to signup and back.
- Include the redirect in the signup confirmation callback URL when present.
- In `/auth/callback`, honor the redirect only if it is a safe internal path.
- If a user requested an admin route but lacks admin access, redirect them to their library instead of back into `/admin/*`.

### RLS handling
- `is_org_member`, `is_org_manager_or_owner`, and `is_org_owner` should evaluate membership without depending on caller-scoped `org_member` policies.
- `org_member` select, insert, update, and delete policies should resolve by role with no recursion failures.
- Organization update and delete policies should consistently use owner checks.
- Existing databases may need a helper backfill migration if the base migration has already been applied.

## Edge Cases

- Requested redirect contains query params that must survive login.
- Requested redirect is malformed, external, or starts with `//`.
- A non-admin signs in from an admin URL.
- A newly confirmed signup must land on the intended library page, not a generic fallback.
- Existing databases already have prior versions of the helper functions and policies.

## Acceptance Criteria

- Logged-out visits to `/library/<org-slug>/catalog?view=all` return to the same URL after login.
- Logged-out visits to `/admin/review` return admins to that page after login.
- Non-admins attempting `/admin/review` are redirected to a safe non-admin destination after login.
- Signup confirmation preserves the requested redirect through `/auth/callback`.
- `org_member` reads and writes behave by role according to `docs/AUTH_AND_RLS_VERIFICATION.md`.
- No recursive-RLS behavior or silently empty member reads remain.

## Related Docs

- `docs/AUTH_AND_RLS_VERIFICATION.md`
- `docs/ARCHITECTURE.md`
- `docs/SCHEMA.md`
- `docs/ACTIVE_CONTEXT.md`
