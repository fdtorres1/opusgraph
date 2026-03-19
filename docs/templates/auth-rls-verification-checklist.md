# Production Auth/RLS Verification Checklist

Date:
Environment:
App URL:
Supabase project:
Verifier:
Branch:
Related PR/commit:

## 1. Preflight

- [ ] Confirm target app URL is correct
- [ ] Confirm target Supabase Cloud project is correct
- [ ] Confirm expected migrations are applied
- [ ] Confirm this run uses test-only users and test-only org data
- [ ] Confirm current intended behavior from:
  - [ ] `docs/AUTH_AND_RLS_VERIFICATION.md`
  - [ ] `docs/ARCHITECTURE.md`
  - [ ] `docs/SCHEMA.md`
  - [ ] relevant specs/decision docs

## 2. Fixtures

Test org slug:
Owner user:
Manager user:
Member user:
Non-member user:
Test records to use:

- [ ] Test org exists
- [ ] Owner user exists
- [ ] Manager user exists
- [ ] Member user exists
- [ ] Non-member authenticated user exists
- [ ] Safe test records exist for read/write checks
- [ ] Fixture setup is isolated from real customer data

## 3. Anonymous Baseline

### Protected library route

Route:
Expected:
Actual:

- [ ] Logged-out visit redirects to `/auth/login`
- [ ] `redirect` query preserves full intended destination
- [ ] Query string stays inside encoded `redirect`

### Protected admin route

Route:
Expected:
Actual:

- [ ] Logged-out visit redirects correctly
- [ ] Redirect behavior matches intended admin gating

## 4. Login Redirect Flow

Starting route:
User:
Expected destination after login:
Actual destination:

- [ ] User can log in successfully
- [ ] Session is established
- [ ] User lands on original protected route
- [ ] No redirect loop
- [ ] No dropped query params

## 5. Signup + Callback Flow

Starting route:
Signup user:
Expected destination after confirmation:
Actual destination:

- [ ] Signup succeeds
- [ ] Confirmation email is received
- [ ] Confirmation link/callback succeeds
- [ ] Session is established after confirmation
- [ ] Final redirect target is correct
- [ ] No fallback/misrouting occurs

## 6. Non-Member Verification

User:
Target org:
Expected denial behavior:
Actual behavior:

- [ ] Non-member cannot access org-scoped protected pages
- [ ] Non-member cannot perform org-scoped mutations
- [ ] Denial behavior is correct and consistent
- [ ] No accidental data leakage in page/API response

## 7. Member Verification

User:
Expected allowed actions:
Expected denied actions:

- [ ] Member can access allowed org pages
- [ ] Member can perform allowed member-level actions
- [ ] Member cannot perform manager-only actions
- [ ] Member cannot perform owner-only actions
- [ ] UI behavior and API behavior match

## 8. Manager Verification

User:
Expected allowed actions:
Expected denied actions:

- [ ] Manager can access manager-scoped org pages
- [ ] Manager can perform manager-scoped mutations
- [ ] Manager cannot perform owner-only actions
- [ ] UI behavior and API behavior match

## 9. Owner Verification

User:
Expected allowed actions:

- [ ] Owner can access owner-scoped org pages
- [ ] Owner can perform org management actions
- [ ] Owner can perform expected catalog/library mutations
- [ ] Owner is not accidentally blocked by RLS

## 10. Direct Database / RLS Verification

Tables checked:
Queries used:
Notes:

### Non-member

- [ ] `SELECT` denied as expected
- [ ] `INSERT` denied as expected
- [ ] `UPDATE` denied as expected
- [ ] `DELETE` denied as expected

### Member

- [ ] `SELECT` behavior matches expectation
- [ ] `INSERT` behavior matches expectation
- [ ] `UPDATE` behavior matches expectation
- [ ] `DELETE` behavior matches expectation

### Manager

- [ ] `SELECT` behavior matches expectation
- [ ] `INSERT` behavior matches expectation
- [ ] `UPDATE` behavior matches expectation
- [ ] `DELETE` behavior matches expectation

### Owner

- [ ] `SELECT` behavior matches expectation
- [ ] `INSERT` behavior matches expectation
- [ ] `UPDATE` behavior matches expectation
- [ ] `DELETE` behavior matches expectation

- [ ] Live policy behavior matches intended `org_member` helper path

## 11. Cross-Check

For each mismatch, classify as:

- [ ] middleware bug
- [ ] app/UI bug
- [ ] API authorization bug
- [ ] RLS/policy bug
- [ ] fixture/setup issue
- [ ] unclear intended behavior

## 12. Evidence

- [ ] Pass/fail recorded for every case
- [ ] Screenshots captured where needed
- [ ] SQL snippets/results captured where needed
- [ ] Repro steps written for every failure

## 13. Outcome

### Passed

- [ ] Verification complete
- [ ] Residual risks noted

### Failed

- [ ] Exact failing cases documented
- [ ] Fault boundary identified
- [ ] Follow-up fix branch planned
- [ ] No speculative fixes made before documentation

## 14. Summary

Overall status:
Key findings:
Open questions:
Next step:
