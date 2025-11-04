-- Setup Felix as Super Admin
-- Run this in Supabase Dashboard → SQL Editor

DO $$
DECLARE
  user_uuid uuid;
BEGIN
  -- Find user by email
  SELECT id INTO user_uuid
  FROM auth.users
  WHERE email = 'felix@fdtorres.com';
  
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'User with email felix@fdtorres.com not found. Please create an account first by signing up at https://opusgraph.vercel.app/auth/signup';
  END IF;
  
  -- Set as super admin
  INSERT INTO user_profile(user_id, first_name, last_name, admin_role)
  VALUES (user_uuid, 'Felix', 'Torres', 'super_admin')
  ON CONFLICT (user_id) DO UPDATE SET admin_role='super_admin';
  
  RAISE NOTICE 'Successfully set user % as super_admin', user_uuid;
END $$;

