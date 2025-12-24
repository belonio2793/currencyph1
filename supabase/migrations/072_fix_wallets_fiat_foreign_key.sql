-- Migration: 072 - Fix wallets_fiat foreign key constraint
-- Problem: wallets_fiat.user_id has FK to public.users(id), but signup trigger
-- tries to insert with auth.users.id before public.users record exists
-- Solution: Change FK to reference auth.users directly, or make it nullable/defer constraint

-- Step 1: Drop the problematic foreign key constraint
ALTER TABLE public.wallets_fiat 
DROP CONSTRAINT IF EXISTS wallets_fiat_user_id_fkey;

-- Step 2: Re-add the constraint to reference auth.users instead of public.users
ALTER TABLE public.wallets_fiat
ADD CONSTRAINT wallets_fiat_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 3: Do the same for wallets_crypto if it has the same issue
ALTER TABLE public.wallets_crypto 
DROP CONSTRAINT IF EXISTS wallets_crypto_user_id_fkey;

ALTER TABLE public.wallets_crypto
ADD CONSTRAINT wallets_crypto_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 4: Create a unique constraint on wallets_fiat to prevent duplicates
-- This ensures one wallet per user per currency
ALTER TABLE public.wallets_fiat
ADD CONSTRAINT wallets_fiat_user_currency_key UNIQUE (user_id, currency) 
DEFERRABLE INITIALLY DEFERRED;

-- Step 5: Update RLS policies to allow trigger execution
DROP POLICY IF EXISTS "Users can view own fiat wallets" ON public.wallets_fiat;
CREATE POLICY "Users can view own fiat wallets" ON public.wallets_fiat
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own fiat wallets" ON public.wallets_fiat;
CREATE POLICY "Users can insert own fiat wallets" ON public.wallets_fiat
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can update own fiat wallets" ON public.wallets_fiat;
CREATE POLICY "Users can update own fiat wallets" ON public.wallets_fiat
  FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Step 6: Do the same for wallets_crypto
DROP POLICY IF EXISTS "Users can view own crypto wallets" ON public.wallets_crypto;
CREATE POLICY "Users can view own crypto wallets" ON public.wallets_crypto
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own crypto wallets" ON public.wallets_crypto;
CREATE POLICY "Users can insert own crypto wallets" ON public.wallets_crypto
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- Step 7: Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.wallets_fiat TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.wallets_crypto TO anon, authenticated, service_role;

-- Step 8: Documentation
COMMENT ON CONSTRAINT wallets_fiat_user_id_fkey ON public.wallets_fiat IS 'Foreign key to auth.users, allowing wallets to be created during signup trigger';
COMMENT ON CONSTRAINT wallets_crypto_user_id_fkey ON public.wallets_crypto IS 'Foreign key to auth.users, allowing wallets to be created during signup trigger';
