-- =========
-- Backfill fix for databases that already applied 0013 with recursive org_member policies.
-- Recreate membership helpers as SECURITY DEFINER functions and replace every
-- org_member policy that depends on them.
-- =========

create or replace function is_org_member(p_org_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.org_member
    where organization_id = p_org_id
      and user_id = auth.uid()
  );
$$;

create or replace function is_org_manager_or_owner(p_org_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.org_member
    where organization_id = p_org_id
      and user_id = auth.uid()
      and role in ('owner', 'manager')
  );
$$;

create or replace function is_org_owner(p_org_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.org_member
    where organization_id = p_org_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

drop policy if exists update_organization_owner on organization;
create policy update_organization_owner on organization
for update using (is_org_owner(id));

drop policy if exists delete_organization_owner on organization;
create policy delete_organization_owner on organization
for delete using (is_org_owner(id));

drop policy if exists select_org_member_member on org_member;
create policy select_org_member_member on org_member
for select using (is_org_member(organization_id));

drop policy if exists insert_org_member_manager on org_member;
create policy insert_org_member_manager on org_member
for insert with check (is_org_manager_or_owner(organization_id));

drop policy if exists update_org_member_owner on org_member;
create policy update_org_member_owner on org_member
for update using (is_org_owner(organization_id));

drop policy if exists delete_org_member_owner on org_member;
create policy delete_org_member_owner on org_member
for delete using (is_org_owner(organization_id));

-- =========
-- Done
-- =========
