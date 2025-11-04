-- Migration: Allow Individual users to read published composers and works
-- This enables authenticated Individual users to view full details on public pages
-- Note: Related tables (composer_link, composer_nationality, work_source, work_recording, etc.)
-- don't have RLS enabled, so they're accessible to authenticated users

-- Add RLS policy for Individual users to read published composers
drop policy if exists read_composer_individual on composer;
create policy read_composer_individual on composer
for select using (
  -- User is authenticated
  auth.uid() is not null
  -- User has Individual role (admin_role='none' or no profile)
  and (
    not exists (
      select 1 from user_profile
      where user_id = auth.uid()
        and admin_role in ('super_admin', 'admin', 'contributor')
    )
  )
  -- Only published content
  and status = 'published'
);

-- Add RLS policy for Individual users to read published works
drop policy if exists read_work_individual on work;
create policy read_work_individual on work
for select using (
  -- User is authenticated
  auth.uid() is not null
  -- User has Individual role (admin_role='none' or no profile)
  and (
    not exists (
      select 1 from user_profile
      where user_id = auth.uid()
        and admin_role in ('super_admin', 'admin', 'contributor')
    )
  )
  -- Only published content
  and status = 'published'
);

