-- Migration: Fix foreign key references to auth.users
-- This migration fixes all broken foreign key constraints that reference
-- a non-existent 'users' table. They should reference 'auth.users' instead.
-- This is the root cause of signup failures (HTTP 500 errors).
-- IMPORTANT: This migration also cleans up bad data before adding constraints.

-- ============================================================================
-- PART 1: CLEAN UP BAD DATA (NULL or invalid user_ids)
-- ============================================================================

-- Clean up wallets_fiat with NULL or invalid user_ids
DELETE FROM public.wallets_fiat 
WHERE user_id IS NULL 
   OR user_id = '00000000-0000-0000-0000-000000000000'
   OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_id);

-- Clean up wallets_crypto with NULL or invalid user_ids
DELETE FROM public.wallets_crypto 
WHERE user_id IS NULL 
   OR user_id = '00000000-0000-0000-0000-000000000000'
   OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_id);

-- Clean up wallets with NULL or invalid user_ids
DELETE FROM public.wallets 
WHERE user_id IS NULL 
   OR user_id = '00000000-0000-0000-0000-000000000000'
   OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_id);

-- Clean up loans with NULL or invalid user_ids
DELETE FROM public.loans 
WHERE user_id IS NULL 
   OR user_id = '00000000-0000-0000-0000-000000000000'
   OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_id);

-- Clean up loan_payments with NULL or invalid user_ids (if table exists)
DO $$
BEGIN
  DELETE FROM public.loan_payments 
  WHERE user_id IS NULL 
     OR user_id = '00000000-0000-0000-0000-000000000000'
     OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_id);
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Clean up deposits with NULL or invalid user_ids
DELETE FROM public.deposits 
WHERE user_id IS NULL 
   OR user_id = '00000000-0000-0000-0000-000000000000'
   OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_id);

-- Clean up investments with NULL or invalid user_ids (if table exists)
DO $$
BEGIN
  DELETE FROM public.investments 
  WHERE user_id IS NULL 
     OR user_id = '00000000-0000-0000-0000-000000000000'
     OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_id);
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Clean up properties with NULL or invalid owner_ids (if table exists)
DO $$
BEGIN
  DELETE FROM public.properties 
  WHERE owner_id = '00000000-0000-0000-0000-000000000000'
     OR (owner_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = owner_id));
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Clean up property_transfers with NULL or invalid buyer/seller ids (if table exists)
DO $$
BEGIN
  DELETE FROM public.property_transfers 
  WHERE buyer_id IS NULL 
     OR buyer_id = '00000000-0000-0000-0000-000000000000'
     OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = buyer_id);

  DELETE FROM public.property_transfers 
  WHERE seller_id = '00000000-0000-0000-0000-000000000000'
     OR (seller_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = seller_id));
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Clean up nearby_listings_saved with NULL or invalid user_ids
DELETE FROM public.nearby_listings_saved 
WHERE user_id IS NULL 
   OR user_id = '00000000-0000-0000-0000-000000000000'
   OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_id);

-- Clean up pending_listings_votes with NULL or invalid user_ids (if table exists)
DO $$
BEGIN
  DELETE FROM public.pending_listings_votes 
  WHERE user_id IS NULL 
     OR user_id = '00000000-0000-0000-0000-000000000000'
     OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_id);
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Clean up community_managers with NULL or invalid user_ids (if table exists)
DO $$
BEGIN
  DELETE FROM public.community_managers 
  WHERE user_id IS NULL 
     OR user_id = '00000000-0000-0000-0000-000000000000'
     OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_id);
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Clean up community_manager_kyc with NULL or invalid verified_by ids (if table exists)
DO $$
BEGIN
  DELETE FROM public.community_manager_kyc 
  WHERE verified_by = '00000000-0000-0000-0000-000000000000'
     OR (verified_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = verified_by));
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Clean up community_manager_votes with NULL or invalid voter_ids (if table exists)
DO $$
BEGIN
  DELETE FROM public.community_manager_votes 
  WHERE voter_id IS NULL 
     OR voter_id = '00000000-0000-0000-0000-000000000000'
     OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = voter_id);
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Clean up loan_lenders with NULL or invalid lender_ids (if table exists)
DO $$
BEGIN
  DELETE FROM public.loan_lenders 
  WHERE lender_id IS NULL 
     OR lender_id = '00000000-0000-0000-0000-000000000000'
     OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = lender_id);
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Clean up loan_lender_ratings with NULL or invalid rater_ids (if table exists)
DO $$
BEGIN
  DELETE FROM public.loan_lender_ratings 
  WHERE rater_id IS NULL 
     OR rater_id = '00000000-0000-0000-0000-000000000000'
     OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = rater_id);
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Clean up loan_ratings_p2p with NULL or invalid rated_user_ids (if table exists)
DO $$
BEGIN
  DELETE FROM public.loan_ratings_p2p 
  WHERE rated_user_id IS NULL 
     OR rated_user_id = '00000000-0000-0000-0000-000000000000'
     OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = rated_user_id);
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- ============================================================================
-- PART 2: DROP OLD BROKEN CONSTRAINTS
-- ============================================================================

-- Drop old constraints that reference non-existent 'users' table
ALTER TABLE IF EXISTS public.wallets_fiat DROP CONSTRAINT IF EXISTS wallets_fiat_user_id_fkey;
ALTER TABLE IF EXISTS public.wallets_crypto DROP CONSTRAINT IF EXISTS wallets_crypto_user_id_fkey;
ALTER TABLE IF EXISTS public.wallets DROP CONSTRAINT IF EXISTS wallets_user_id_fkey;
ALTER TABLE IF EXISTS public.loans DROP CONSTRAINT IF EXISTS loans_user_id_fkey;
ALTER TABLE IF EXISTS public.loan_payments DROP CONSTRAINT IF EXISTS loan_payments_user_id_fkey;
ALTER TABLE IF EXISTS public.deposits DROP CONSTRAINT IF EXISTS deposits_user_id_fkey;
ALTER TABLE IF EXISTS public.investments DROP CONSTRAINT IF EXISTS investments_user_id_fkey;
ALTER TABLE IF EXISTS public.properties DROP CONSTRAINT IF EXISTS properties_owner_id_fkey;
ALTER TABLE IF EXISTS public.property_transfers DROP CONSTRAINT IF EXISTS property_transfers_buyer_id_fkey;
ALTER TABLE IF EXISTS public.property_transfers DROP CONSTRAINT IF EXISTS property_transfers_seller_id_fkey;
ALTER TABLE IF EXISTS public.nearby_listings_saved DROP CONSTRAINT IF EXISTS nearby_listings_saved_user_id_fkey;
ALTER TABLE IF EXISTS public.pending_listings_votes DROP CONSTRAINT IF EXISTS pending_listings_votes_user_id_fkey;
ALTER TABLE IF EXISTS public.community_managers DROP CONSTRAINT IF EXISTS community_managers_user_id_fkey;
ALTER TABLE IF EXISTS public.community_manager_kyc DROP CONSTRAINT IF EXISTS community_manager_kyc_verified_by_fkey;
ALTER TABLE IF EXISTS public.community_manager_votes DROP CONSTRAINT IF EXISTS community_manager_votes_voter_id_fkey;
ALTER TABLE IF EXISTS public.loan_lenders DROP CONSTRAINT IF EXISTS loan_lenders_lender_id_fkey;
ALTER TABLE IF EXISTS public.loan_lender_ratings DROP CONSTRAINT IF EXISTS loan_lender_ratings_rater_id_fkey;
ALTER TABLE IF EXISTS public.loan_ratings_p2p DROP CONSTRAINT IF EXISTS loan_ratings_p2p_rated_user_id_fkey;
ALTER TABLE IF EXISTS public.loans DROP CONSTRAINT IF EXISTS loans_lender_id_fkey;

-- ============================================================================
-- PART 3: ADD NEW CORRECT CONSTRAINTS TO auth.users
-- ============================================================================

-- 1. FIX wallets_fiat TABLE
ALTER TABLE IF EXISTS public.wallets_fiat
ADD CONSTRAINT wallets_fiat_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. FIX wallets_crypto TABLE
ALTER TABLE IF EXISTS public.wallets_crypto
ADD CONSTRAINT wallets_crypto_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. FIX wallets TABLE
ALTER TABLE IF EXISTS public.wallets
ADD CONSTRAINT wallets_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. FIX loans TABLE
ALTER TABLE IF EXISTS public.loans
ADD CONSTRAINT loans_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 5. FIX loan_payments TABLE
ALTER TABLE IF EXISTS public.loan_payments
ADD CONSTRAINT loan_payments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 6. FIX deposits TABLE
ALTER TABLE IF EXISTS public.deposits
ADD CONSTRAINT deposits_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 7. FIX investments TABLE (from migration 033)
ALTER TABLE IF EXISTS public.investments
ADD CONSTRAINT investments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 8. FIX properties TABLE
ALTER TABLE IF EXISTS public.properties
ADD CONSTRAINT properties_owner_id_fkey 
FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 9. FIX property_transfers TABLE (if exists)
ALTER TABLE IF EXISTS public.property_transfers
ADD CONSTRAINT property_transfers_buyer_id_fkey 
FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.property_transfers
ADD CONSTRAINT property_transfers_seller_id_fkey 
FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 10. FIX nearby_listings_saved TABLE
ALTER TABLE IF EXISTS public.nearby_listings_saved
ADD CONSTRAINT nearby_listings_saved_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 11. FIX pending_listings_votes TABLE
ALTER TABLE IF EXISTS public.pending_listings_votes
ADD CONSTRAINT pending_listings_votes_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 12. FIX p2p_loan_marketplace tables
ALTER TABLE IF EXISTS public.community_managers
ADD CONSTRAINT community_managers_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.community_manager_kyc
ADD CONSTRAINT community_manager_kyc_verified_by_fkey 
FOREIGN KEY (verified_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.community_manager_votes
ADD CONSTRAINT community_manager_votes_voter_id_fkey 
FOREIGN KEY (voter_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.loan_lenders
ADD CONSTRAINT loan_lenders_lender_id_fkey 
FOREIGN KEY (lender_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.loan_lender_ratings
ADD CONSTRAINT loan_lender_ratings_rater_id_fkey 
FOREIGN KEY (rater_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.loan_ratings_p2p
ADD CONSTRAINT loan_ratings_p2p_rated_user_id_fkey 
FOREIGN KEY (rated_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 13. FIX loans table (add lender_id constraint if not exists)
ALTER TABLE IF EXISTS public.loans
ADD CONSTRAINT loans_lender_id_fkey 
FOREIGN KEY (lender_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================================
-- SUCCESS: All foreign keys are now fixed
-- ============================================================================
