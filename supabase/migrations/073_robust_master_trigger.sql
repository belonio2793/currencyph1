-- Migration: 073 - Robust Master Trigger with Error Handling
-- Recreates the master trigger to handle errors gracefully and log failures

-- Drop the old master trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create improved master trigger function that handles errors
CREATE OR REPLACE FUNCTION public.master_on_auth_user_created()
RETURNS TRIGGER AS $$
DECLARE
  error_msg TEXT;
BEGIN
  -- 0. Auto-confirm email (remove verification requirement)
  BEGIN
    UPDATE auth.users
    SET email_confirmed_at = CURRENT_TIMESTAMP,
        confirmed_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to auto-confirm email for user %: %', NEW.id, SQLERRM;
  END;

  -- 1. Create profile for the user
  BEGIN
    PERFORM public.create_profile_on_signup_internal(NEW);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  END;

  -- 1b. Create user in public.users table
  BEGIN
    PERFORM public.create_user_on_signup_internal(NEW);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create public.users entry for %: %', NEW.id, SQLERRM;
  END;

  -- 2. Create ride profile for the user
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name = 'create_ride_profile_on_signup_internal'
    ) THEN
      PERFORM public.create_ride_profile_on_signup_internal(NEW);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create ride profile for user %: %', NEW.id, SQLERRM;
  END;

  -- 3. Initialize wallets for the user
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name = 'initialize_user_wallets_internal'
    ) THEN
      PERFORM public.initialize_user_wallets_internal(NEW);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to initialize wallets for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the master trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.master_on_auth_user_created();

-- Verify the trigger exists
COMMENT ON FUNCTION public.master_on_auth_user_created() IS 'Robust master trigger that handles all user initialization on signup with error handling';
