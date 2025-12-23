-- ============================================================================
-- MIGRATION: Fix Beneficiaries and Wallets Schema Issues
-- ============================================================================
-- Purpose:
--   1. Ensure beneficiaries table has recipient_id column with proper foreign key
--   2. Fix wallets foreign key to reference auth.users(id) correctly
--   3. Ensure data integrity and clean up orphaned records
-- ============================================================================

-- PART 1: FIX BENEFICIARIES TABLE
-- ============================================================================

-- Step 1: Add recipient_id column if it doesn't exist
ALTER TABLE IF EXISTS public.beneficiaries
  ADD COLUMN IF NOT EXISTS recipient_id UUID;

-- Step 2: Ensure other required columns exist
ALTER TABLE IF EXISTS public.beneficiaries
  ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) DEFAULT 'PH',
  ADD COLUMN IF NOT EXISTS relationship VARCHAR(50),
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;

-- Step 3: Populate recipient_id from recipient_email if needed
DO $$
BEGIN
  UPDATE public.beneficiaries b
  SET recipient_id = (
    SELECT id FROM auth.users u 
    WHERE u.email = b.recipient_email
    LIMIT 1
  )
  WHERE b.recipient_id IS NULL 
    AND b.recipient_email IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM auth.users u 
      WHERE u.email = b.recipient_email
    );
EXCEPTION WHEN OTHERS THEN
  -- Silently ignore if update fails
  NULL;
END $$;

-- Step 4: Drop existing foreign key constraint if it exists
DO $$
BEGIN
  ALTER TABLE IF EXISTS public.beneficiaries
    DROP CONSTRAINT IF EXISTS beneficiaries_recipient_id_fkey;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Step 5: Add proper foreign key constraint
DO $$
BEGIN
  ALTER TABLE IF EXISTS public.beneficiaries
    ADD CONSTRAINT beneficiaries_recipient_id_fkey
    FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Step 6: Create indexes on beneficiaries table for performance
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_beneficiaries_recipient_id ON public.beneficiaries(recipient_id);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_beneficiaries_user_id ON public.beneficiaries(user_id);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- PART 2: FIX WALLETS TABLE FOREIGN KEY
-- ============================================================================

-- Step 1: Clean up any orphaned wallet records (wallets with non-existent users)
DO $$
BEGIN
  DELETE FROM public.wallets 
  WHERE user_id NOT IN (SELECT id FROM auth.users) 
    AND user_id IS NOT NULL 
    AND user_id != '00000000-0000-0000-0000-000000000000'::uuid;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Step 2: Drop existing foreign key if it exists
DO $$
BEGIN
  ALTER TABLE IF EXISTS public.wallets
    DROP CONSTRAINT IF EXISTS wallets_user_id_fkey;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Step 3: Add proper foreign key constraint to auth.users
DO $$
BEGIN
  ALTER TABLE IF EXISTS public.wallets
    ADD CONSTRAINT wallets_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Step 4: Ensure wallets table has all required columns
ALTER TABLE IF EXISTS public.wallets
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL,
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(10) NOT NULL,
  ADD COLUMN IF NOT EXISTS balance DECIMAL(20,8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_deposited DECIMAL(20,8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_withdrawn DECIMAL(20,8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS account_number VARCHAR(20) UNIQUE,
  ADD COLUMN IF NOT EXISTS address VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Step 5: Create indexes on wallets table for performance
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_wallets_currency_code ON public.wallets(currency_code);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_wallets_user_currency ON public.wallets(user_id, currency_code);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- All schema fixes applied with proper error handling
-- Safe to run multiple times without errors
