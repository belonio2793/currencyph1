-- ============================================================================
-- BACKFILL SCRIPT: Sync existing auth.users to public.users and profiles
-- ============================================================================
-- Run this script to populate public.users and public.profiles from existing auth.users
-- 
-- This is a standalone script that can be run separately from migrations
-- ============================================================================

-- ============================================================================
-- STEP 1: Verify tables exist
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
    RAISE EXCEPTION 'public.users table does not exist. Run migration 0119 first.';
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
    RAISE EXCEPTION 'public.profiles table does not exist. Run migration 0119 first.';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Count existing records before backfill
-- ============================================================================

DO $$
DECLARE
  v_auth_count INTEGER;
  v_users_count INTEGER;
  v_profiles_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_auth_count FROM auth.users;
  SELECT COUNT(*) INTO v_users_count FROM public.users;
  SELECT COUNT(*) INTO v_profiles_count FROM public.profiles;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'BACKFILL STARTING - Current state:';
  RAISE NOTICE '  auth.users:        % records', v_auth_count;
  RAISE NOTICE '  public.users:      % records', v_users_count;
  RAISE NOTICE '  public.profiles:   % records', v_profiles_count;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- ============================================================================
-- STEP 3: Backfill public.users from auth.users
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER := 0;
  v_auth_user RECORD;
  v_full_name TEXT;
  v_region_code TEXT;
BEGIN
  RAISE NOTICE '→ Syncing auth.users to public.users...';

  FOR v_auth_user IN 
    SELECT 
      id,
      email,
      raw_user_meta_data,
      user_metadata,
      created_at,
      updated_at
    FROM auth.users
    ORDER BY created_at ASC
  LOOP
    -- Extract metadata
    v_full_name := COALESCE(
      v_auth_user.raw_user_meta_data->>'full_name',
      v_auth_user.user_metadata->>'full_name',
      ''
    );
    
    v_region_code := COALESCE(
      v_auth_user.raw_user_meta_data->>'region_code',
      v_auth_user.user_metadata->>'region_code',
      'PH'
    );

    -- Insert/Update public.users
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
      v_auth_user.id,
      v_auth_user.email,
      v_full_name,
      v_region_code,
      'active',
      v_auth_user.created_at,
      v_auth_user.updated_at
    )
    ON CONFLICT (auth_id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
      region_code = COALESCE(EXCLUDED.region_code, public.users.region_code),
      updated_at = NOW()
    WHERE public.users.full_name IS NULL OR public.users.full_name = '';

    v_count := v_count + 1;

    -- Log every 100 records
    IF v_count % 100 = 0 THEN
      RAISE NOTICE '  ✓ Processed % users...', v_count;
    END IF;
  END LOOP;

  RAISE NOTICE '  ✓ Completed! Synced % users to public.users', v_count;
END $$;

-- ============================================================================
-- STEP 4: Backfill public.profiles from auth.users
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER := 0;
  v_auth_user RECORD;
  v_full_name TEXT;
BEGIN
  RAISE NOTICE '→ Syncing auth.users to public.profiles...';

  FOR v_auth_user IN 
    SELECT 
      id,
      raw_user_meta_data,
      user_metadata,
      created_at,
      updated_at
    FROM auth.users
    ORDER BY created_at ASC
  LOOP
    -- Extract full_name
    v_full_name := COALESCE(
      v_auth_user.raw_user_meta_data->>'full_name',
      v_auth_user.user_metadata->>'full_name',
      ''
    );

    -- Insert/Update public.profiles
    INSERT INTO public.profiles (
      user_id,
      full_name,
      created_at,
      updated_at
    )
    VALUES (
      v_auth_user.id,
      v_full_name,
      v_auth_user.created_at,
      v_auth_user.updated_at
    )
    ON CONFLICT (user_id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      updated_at = NOW()
    WHERE public.profiles.full_name IS NULL OR public.profiles.full_name = '';

    v_count := v_count + 1;

    -- Log every 100 records
    IF v_count % 100 = 0 THEN
      RAISE NOTICE '  ✓ Processed % profiles...', v_count;
    END IF;
  END LOOP;

  RAISE NOTICE '  ✓ Completed! Synced % profiles to public.profiles', v_count;
END $$;

-- ============================================================================
-- STEP 5: Verify backfill completed successfully
-- ============================================================================

DO $$
DECLARE
  v_auth_count INTEGER;
  v_users_count INTEGER;
  v_profiles_count INTEGER;
  v_unsynced_auth INTEGER;
  v_unsynced_profiles INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_auth_count FROM auth.users;
  SELECT COUNT(*) INTO v_users_count FROM public.users;
  SELECT COUNT(*) INTO v_profiles_count FROM public.profiles;
  
  -- Check for unsynced users
  SELECT COUNT(*) INTO v_unsynced_auth
  FROM auth.users au
  WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.auth_id = au.id);
  
  -- Check for unsynced profiles
  SELECT COUNT(*) INTO v_unsynced_profiles
  FROM auth.users au
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles pp WHERE pp.user_id = au.id);

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'BACKFILL COMPLETED - Final state:';
  RAISE NOTICE '  auth.users:        % records', v_auth_count;
  RAISE NOTICE '  public.users:      % records', v_users_count;
  RAISE NOTICE '  public.profiles:   % records', v_profiles_count;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  
  IF v_unsynced_auth > 0 THEN
    RAISE WARNING 'WARNING: % auth.users records not synced to public.users', v_unsynced_auth;
  ELSE
    RAISE NOTICE '✓ All auth.users synced to public.users';
  END IF;
  
  IF v_unsynced_profiles > 0 THEN
    RAISE WARNING 'WARNING: % auth.users records not synced to public.profiles', v_unsynced_profiles;
  ELSE
    RAISE NOTICE '✓ All auth.users synced to public.profiles';
  END IF;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- ============================================================================
-- STEP 6: Optional - View sample of synced data
-- ============================================================================

-- Uncomment to view sample synced data:
/*
SELECT 
  au.id as auth_id,
  au.email,
  pu.full_name as users_full_name,
  pu.region_code,
  pp.full_name as profile_full_name,
  au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON pu.auth_id = au.id
LEFT JOIN public.profiles pp ON pp.user_id = au.id
ORDER BY au.created_at DESC
LIMIT 20;
*/

-- ============================================================================
-- SAMPLE VERIFICATION QUERIES
-- ============================================================================
-- Run these after the backfill completes:
--
-- 1. Check total counts match:
-- SELECT 'auth.users' as table_name, COUNT(*) as count FROM auth.users
-- UNION ALL
-- SELECT 'public.users', COUNT(*) FROM public.users
-- UNION ALL
-- SELECT 'public.profiles', COUNT(*) FROM public.profiles;
--
-- 2. Find any unsynced records:
-- SELECT au.id, au.email
-- FROM auth.users au
-- WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.auth_id = au.id)
--    OR NOT EXISTS (SELECT 1 FROM public.profiles pp WHERE pp.user_id = au.id);
--
-- 3. View sample data:
-- SELECT 
--   au.email,
--   pu.full_name,
--   pu.region_code,
--   pp.created_at
-- FROM auth.users au
-- LEFT JOIN public.users pu ON pu.auth_id = au.id
-- LEFT JOIN public.profiles pp ON pp.user_id = au.id
-- LIMIT 10;
-- ============================================================================
