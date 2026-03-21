-- Harden auth-user bootstrap against auth trigger search_path resolution.
-- New user creation fires from auth.users, so unqualified names inside the
-- trigger function can fail if public is not on the active search_path.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  -- Create user profile
  insert into public.user_profile (user_id, admin_role)
  values (new.id, 'none')
  on conflict (user_id) do nothing;

  -- Create personal organization
  new_org_id := gen_random_uuid();
  insert into public.organization (id, name, slug, type, plan_tier)
  values (
    new_org_id,
    'My Library',
    public.generate_slug('my-library'),
    'other',
    'free'
  );

  -- Add user as owner of personal org
  insert into public.org_member (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$;
