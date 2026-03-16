-- Migration: Auto-create user_profile for new users
-- This ensures all new users get a user_profile with admin_role='none' (Individual)

-- Function to create user_profile when a new auth user is created
create or replace function public.handle_new_user() 
returns trigger 
language plpgsql 
security definer
as $$
begin
  insert into public.user_profile (user_id, admin_role)
  values (new.id, 'none')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Trigger to call the function when a new user signs up
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill: Create user_profile for any existing users who don't have one
-- This ensures all existing users have a profile with admin_role='none'
insert into public.user_profile (user_id, admin_role)
select id, 'none'
from auth.users
where id not in (select user_id from public.user_profile)
on conflict (user_id) do nothing;

