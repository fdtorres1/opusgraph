# Auth And RLS Verification

This runbook is for the auth redirect fix and the `org_member` RLS fix. It is intentionally manual and narrow so it can be run against a local or staging Supabase-backed environment without adding a full test harness first.

## Preconditions

- App is running locally with working Supabase credentials.
- Latest migrations have been applied, including `0014_backfill_org_member_rls_helpers.sql` for existing databases.
- You have four test users available:
  - `owner@example.com`
  - `manager@example.com`
  - `member@example.com`
  - `outsider@example.com`
- You have one shared organization where those roles are assigned accordingly.
- You have one platform admin user and one non-admin user for `/admin` redirect checks.

## Auth Redirect Checks

### 1. Logged-out library redirect preserves full path

1. Sign out.
2. Open `/library/<org-slug>/catalog?view=all`.
3. Confirm you are redirected to `/auth/login?redirect=%2Flibrary%2F<org-slug>%2Fcatalog%3Fview%3Dall`.
4. Sign in as a valid member of that org.
5. Confirm you land on `/library/<org-slug>/catalog?view=all`.

Expected:
- Query string is preserved.
- No redirect to `/search` or the org dashboard unless that was the original target.

### 2. Logged-out admin redirect preserves path for admins

1. Sign out.
2. Open `/admin/review`.
3. Confirm you are redirected to `/auth/login?redirect=%2Fadmin%2Freview`.
4. Sign in as a platform admin or contributor.
5. Confirm you land on `/admin/review`.

Expected:
- Exact path is preserved.

### 3. Logged-out admin redirect falls back for non-admins

1. Sign out.
2. Open `/admin/review`.
3. Sign in as a non-admin user.
4. Confirm you are **not** returned to `/admin/review`.
5. Confirm you land in that user's library instead.

Expected:
- Non-admins are redirected to their library or the app fallback, not back into `/admin`.

### 4. Signup confirmation preserves redirect

1. Sign out.
2. Open `/library/<org-slug>/catalog`.
3. Follow the auth flow to the sign-up page.
4. Create a new account from `/auth/signup?redirect=...`.
5. Inspect the confirmation email target or the browser URL after following the email link.
6. Confirm `/auth/callback` includes the same `redirect` param.
7. Complete the callback.

Expected:
- The callback receives the original internal redirect target.
- After confirmation, the user is sent to the requested library page when authorized.

## org_member RLS Checks

Run these in the Supabase SQL editor or with `psql`, impersonating each user through the app/session where possible. The goal is to prove that the policies no longer recurse and that access is correct by role.

Use placeholders:
- `<shared-org-id>`
- `<owner-user-id>`
- `<manager-user-id>`
- `<member-user-id>`
- `<outsider-user-id>`
- `<candidate-user-id>` for a user not yet in the org
- `<owner-membership-id>` etc. for existing `org_member.id` values

### 5. SELECT behavior

As `owner`, `manager`, and `member`, run:

```sql
select user_id, role
from org_member
where organization_id = '<shared-org-id>';
```

Expected:
- Owner, manager, and member can read the membership rows for their org.
- No empty result caused by recursive RLS.

As `outsider`, run the same query.

Expected:
- Zero rows returned.

### 6. INSERT behavior

As `manager`, run:

```sql
insert into org_member (organization_id, user_id, role)
values ('<shared-org-id>', '<candidate-user-id>', 'member');
```

Expected:
- Insert succeeds.

As `member`, run the same insert with a different candidate user.

Expected:
- Insert is denied by RLS.

Cleanup after each successful insert:

```sql
delete from org_member
where organization_id = '<shared-org-id>'
  and user_id = '<candidate-user-id>';
```

### 7. UPDATE behavior

As `owner`, run:

```sql
update org_member
set role = 'manager'
where organization_id = '<shared-org-id>'
  and user_id = '<member-user-id>';
```

Expected:
- Update succeeds.

As `manager`, attempt to demote or promote another member:

```sql
update org_member
set role = 'member'
where organization_id = '<shared-org-id>'
  and user_id = '<manager-user-id>';
```

Expected:
- Update is denied unless your product rules explicitly allow it. With the current policy, only owners should succeed.

Restore the original role after testing.

### 8. DELETE behavior

As `owner`, delete a non-owner membership:

```sql
delete from org_member
where organization_id = '<shared-org-id>'
  and user_id = '<candidate-user-id>';
```

Expected:
- Delete succeeds for owner.

As `manager`, attempt the same delete.

Expected:
- Delete is denied by RLS.

### 9. Last-owner guard still works

As `owner`, attempt to remove or demote the final owner membership.

Expected:
- Operation fails with the trigger error about removing or demoting the last owner.

## Pass Criteria

- Library and admin redirects preserve internal paths through login and callback.
- Signup confirmation keeps the original internal redirect.
- `org_member` `SELECT`, `INSERT`, `UPDATE`, and `DELETE` behave by role as expected.
- Member reads no longer silently return empty sets because of recursive RLS.
