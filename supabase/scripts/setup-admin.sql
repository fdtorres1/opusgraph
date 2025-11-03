-- Setup Admin User Script
-- Run this in Supabase Dashboard → SQL Editor after creating your account

-- Step 1: Find your user ID (replace 'your-email@example.com' with your actual email)
-- Uncomment and run this first to find your user ID:
-- SELECT id, email, created_at FROM auth.users WHERE email = 'your-email@example.com';

-- Step 2: Set yourself as super admin (replace 'USER_ID_HERE' with the id from Step 1)
-- Or use the email-based version below if you prefer

-- Option A: Using user ID (most reliable)
/*
INSERT INTO user_profile(user_id, first_name, last_name, admin_role)
VALUES ('USER_ID_HERE', 'Your First Name', 'Your Last Name', 'super_admin')
ON CONFLICT (user_id) DO UPDATE SET admin_role='super_admin';
*/

-- Option B: Using email (automatically finds user ID)
-- Replace 'your-email@example.com' with your actual email
DO $$
DECLARE
  user_uuid uuid;
BEGIN
  SELECT id INTO user_uuid
  FROM auth.users
  WHERE email = 'your-email@example.com';
  
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'User with email not found. Please create an account first.';
  END IF;
  
  INSERT INTO user_profile(user_id, first_name, last_name, admin_role)
  VALUES (user_uuid, 'Your First Name', 'Your Last Name', 'super_admin')
  ON CONFLICT (user_id) DO UPDATE SET admin_role='super_admin';
  
  RAISE NOTICE 'Successfully set user % as super_admin', user_uuid;
END $$;

