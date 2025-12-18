-- Migration: Consolidate all auth.users triggers into a single master function
-- Problem: Multiple migrations create triggers with the same name "on_auth_user_created"
-- which causes only the last one to run. This ensures ALL user initialization happens.

-- ============================================================================
-- 1. CREATE MASTER TRIGGER FUNCTION that calls all initialization functions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.master_on_auth_user_created()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Create profile for the user
  IF EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name = 'create_profile_on_signup'
  ) THEN
    PERFORM public.create_profile_on_signup_internal(NEW);
  END IF;

  -- 2. Create ride profile for the user
  IF EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name = 'create_ride_profile_on_signup_internal'
  ) THEN
    PERFORM public.create_ride_profile_on_signup_internal(NEW);
  END IF;

  -- 3. Initialize wallets for the user
  IF EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name = 'initialize_user_wallets_internal'
  ) THEN
    PERFORM public.initialize_user_wallets_internal(NEW);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. CREATE INTERNAL WRAPPER FUNCTIONS (so old migrations still work)
-- ============================================================================

-- Wrapper for create_profile_on_signup to accept a trigger row
CREATE OR REPLACE FUNCTION public.create_profile_on_signup_internal(user_row auth.users)
RETURNS void AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    full_name,
    created_at,
    updated_at
  )
  VALUES (
    user_row.id,
    COALESCE(user_row.raw_user_meta_data->>'full_name', ''),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Wrapper for create_ride_profile_on_signup to accept a trigger row
CREATE OR REPLACE FUNCTION public.create_ride_profile_on_signup_internal(user_row auth.users)
RETURNS void AS $$
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
    user_row.id,
    COALESCE(user_row.raw_user_meta_data->>'full_name', ''),
    'rider',
    'offline',
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET role = 'rider', updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Wrapper for initialize_user_wallets to accept a trigger row
CREATE OR REPLACE FUNCTION public.initialize_user_wallets_internal(user_row auth.users)
RETURNS void AS $$
DECLARE
  currency_code TEXT;
  fiat_currencies TEXT[] := ARRAY['PHP', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'AUD', 'CAD', 'CHF', 'SEK', 'NZD', 'SGD', 'HKD', 'IDR', 'MYR', 'THB', 'VND', 'KRW', 'ZAR', 'BRL', 'MXN', 'NOK', 'DKK', 'AED'];
BEGIN
  -- Create fiat wallets for all supported currencies
  FOREACH currency_code IN ARRAY fiat_currencies
  LOOP
    INSERT INTO public.wallets_fiat (
      user_id,
      provider,
      provider_account_id,
      currency,
      balance,
      status,
      created_at,
      updated_at
    ) VALUES (
      user_row.id,
      'internal',
      'internal-' || currency_code || '-' || user_row.id::TEXT,
      currency_code,
      0,
      'active',
      now(),
      now()
    ) ON CONFLICT (user_id, currency) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. DROP OLD INDIVIDUAL TRIGGERS (clean up collision)
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP TRIGGER IF EXISTS trigger_initialize_user_wallets ON auth.users;

-- ============================================================================
-- 4. CREATE SINGLE MASTER TRIGGER
-- ============================================================================
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.master_on_auth_user_created();

-- ============================================================================
-- 5. KEEP OLD FUNCTIONS FOR BACKWARD COMPATIBILITY
-- ============================================================================
-- These functions are now called internally by wrappers
-- No changes needed - they continue to work as before

-- ============================================================================
-- 6. VERIFY SETUP
-- ============================================================================
-- Check that the master trigger exists and is the only trigger on auth.users
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users' AND trigger_schema = 'auth'
ORDER BY trigger_name;
