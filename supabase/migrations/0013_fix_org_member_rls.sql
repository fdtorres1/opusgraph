-- =========
-- Fix: org_member SELECT policy had circular RLS dependency
-- The original policy called is_org_member() which queries org_member itself,
-- causing infinite recursion. Replace with a direct subquery.
-- =========

drop policy if exists select_org_member_member on org_member;
create policy select_org_member_member on org_member
for select using (
  organization_id in (
    select om.organization_id from org_member om where om.user_id = auth.uid()
  )
);

-- =========
-- Done
-- =========
