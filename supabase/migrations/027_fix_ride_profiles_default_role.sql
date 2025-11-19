-- Migration: Fix ride_profiles default role and add auto-creation trigger
-- This migration ensures:
-- 1. All existing ride_profiles with role='driver' are reset to 'rider'
-- 2. A trigger is created to automatically create ride_profiles when new users sign up

-- ============================================================================
-- 1. FIX EXISTING PROFILES - Reset all driver roles to rider
-- ============================================================================
UPDATE ride_profiles
SET role = 'rider', updated_at = NOW()
WHERE role = 'driver' OR role IS NULL;

-- ============================================================================
-- 2. CREATE FUNCTION AND TRIGGER FOR AUTO-CREATING PROFILES ON SIGNUP
-- ============================================================================

-- Create function that will be triggered on new user creation
CREATE OR REPLACE FUNCTION public.create_ride_profile_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.ride_profiles (
    user_id,
    full_name,
    role,
    status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'rider',
    'offline',
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET role = 'rider', updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to call the function when a new user is created in auth
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_ride_profile_on_signup();

-- ============================================================================
-- 3. VERIFY THE SETUP
-- ============================================================================

-- Check that all profiles have role='rider'
SELECT COUNT(*) as total_profiles, 
       COUNT(CASE WHEN role = 'rider' THEN 1 END) as rider_count,
       COUNT(CASE WHEN role = 'driver' THEN 1 END) as driver_count,
       COUNT(CASE WHEN role IS NULL THEN 1 END) as null_count
FROM ride_profiles;
