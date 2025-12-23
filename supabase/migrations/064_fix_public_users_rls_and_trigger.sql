-- Migration: 064 - Fix public.users table with proper RLS policies and auto-creation trigger
-- This migration ensures users can be created on signup and adds necessary fields

-- Step 1: Ensure public.users table exists with all necessary fields
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE,
  username VARCHAR(255) UNIQUE,
  full_name VARCHAR(255),
  phone_number VARCHAR(20),
  profile_picture_url TEXT,
  wallet_address VARCHAR(255) UNIQUE,
  dog_balance DECIMAL(15, 2) DEFAULT 0,
  region_code VARCHAR(5) DEFAULT 'PH',
  bio TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone_number);

-- Step 3: Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop old problematic RLS policies if they exist
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert deposits" ON public.users;

-- Step 5: Create improved RLS policies for users table

-- Policy 1: Authenticated users can view their own user data
CREATE POLICY "Users can view their own user data"
  ON public.users FOR SELECT
  USING (auth.uid() = auth_id OR auth_id IS NULL);

-- Policy 2: Authenticated users can update their own user data
CREATE POLICY "Users can update their own user data"
  ON public.users FOR UPDATE
  USING (auth.uid() = auth_id);

-- Policy 3: System can insert users during signup (auth trigger)
CREATE POLICY "System can create user on signup"
  ON public.users FOR INSERT
  WITH CHECK (true);

-- Policy 4: Allow the service role to manage users (admin operations)
CREATE POLICY "Service role can manage all users"
  ON public.users FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Step 6: Create function to auto-create public.users row on auth signup
CREATE OR REPLACE FUNCTION public.create_user_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a new user row in public.users when auth.users is created
  INSERT INTO public.users (
    auth_id,
    email,
    full_name,
    region_code,
    status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'region_code', 'PH'),
    'active',
    NOW(),
    NOW()
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_public_user ON auth.users;

-- Step 8: Create trigger to call the function
CREATE TRIGGER on_auth_user_created_public_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_on_signup();

-- Step 9: Create function to update public.users when metadata is updated
CREATE OR REPLACE FUNCTION public.update_user_metadata_on_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Update public.users with metadata from profiles table
  UPDATE public.users
  SET
    username = COALESCE(NEW.username, username),
    full_name = COALESCE(NEW.full_name, full_name),
    phone_number = COALESCE(NEW.phone_number, phone_number),
    profile_picture_url = COALESCE(NEW.profile_picture_url, profile_picture_url),
    bio = COALESCE(NEW.bio, bio),
    updated_at = NOW()
  WHERE auth_id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Create trigger for profile updates
DROP TRIGGER IF EXISTS on_profile_update_sync_users ON public.profiles;
CREATE TRIGGER on_profile_update_sync_users
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_metadata_on_profile_update();

-- Step 11: Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.users TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_on_signup TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_metadata_on_profile_update TO authenticated;

-- Step 12: Add comments for documentation
COMMENT ON TABLE public.users IS 'Central user table synced from auth.users and profiles - single source of truth for user data';
COMMENT ON COLUMN public.users.auth_id IS 'Reference to auth.users.id - never change this';
COMMENT ON COLUMN public.users.email IS 'User email address - synced from auth.users';
COMMENT ON COLUMN public.users.username IS 'Unique username for login and public profile - set by user or auto-generated';
COMMENT ON COLUMN public.users.full_name IS 'User full name - synced from profiles table';
COMMENT ON COLUMN public.users.phone_number IS 'Contact phone number - synced from profiles table';
COMMENT ON COLUMN public.users.dog_balance IS 'DOG token balance - updated by deposit/withdrawal operations';
