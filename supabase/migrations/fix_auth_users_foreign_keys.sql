-- Migration: Fix foreign key references to auth.users
-- This migration fixes all broken foreign key constraints that reference
-- a non-existent 'users' table. They should reference 'auth.users' instead.
-- This is the root cause of signup failures (HTTP 500 errors).

-- ============================================================================
-- 1. FIX wallets_fiat TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.wallets_fiat
DROP CONSTRAINT IF EXISTS wallets_fiat_user_id_fkey;

ALTER TABLE IF EXISTS public.wallets_fiat
ADD CONSTRAINT wallets_fiat_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 2. FIX wallets_crypto TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.wallets_crypto
DROP CONSTRAINT IF EXISTS wallets_crypto_user_id_fkey;

ALTER TABLE IF EXISTS public.wallets_crypto
ADD CONSTRAINT wallets_crypto_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 3. FIX wallets TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.wallets
DROP CONSTRAINT IF EXISTS wallets_user_id_fkey;

ALTER TABLE IF EXISTS public.wallets
ADD CONSTRAINT wallets_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 4. FIX loans TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.loans
DROP CONSTRAINT IF EXISTS loans_user_id_fkey;

ALTER TABLE IF EXISTS public.loans
ADD CONSTRAINT loans_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 5. FIX loan_payments TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.loan_payments
DROP CONSTRAINT IF EXISTS loan_payments_user_id_fkey;

ALTER TABLE IF EXISTS public.loan_payments
ADD CONSTRAINT loan_payments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 6. FIX deposits TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.deposits
DROP CONSTRAINT IF EXISTS deposits_user_id_fkey;

ALTER TABLE IF EXISTS public.deposits
ADD CONSTRAINT deposits_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 7. FIX investments TABLE (from migration 033)
-- ============================================================================
ALTER TABLE IF EXISTS public.investments
DROP CONSTRAINT IF EXISTS investments_user_id_fkey;

ALTER TABLE IF EXISTS public.investments
ADD CONSTRAINT investments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 8. FIX properties TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.properties
DROP CONSTRAINT IF EXISTS properties_owner_id_fkey;

ALTER TABLE IF EXISTS public.properties
ADD CONSTRAINT properties_owner_id_fkey 
FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================================
-- 9. FIX property_transfers TABLE (if exists)
-- ============================================================================
ALTER TABLE IF EXISTS public.property_transfers
DROP CONSTRAINT IF EXISTS property_transfers_buyer_id_fkey;

ALTER TABLE IF EXISTS public.property_transfers
ADD CONSTRAINT property_transfers_buyer_id_fkey 
FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.property_transfers
DROP CONSTRAINT IF EXISTS property_transfers_seller_id_fkey;

ALTER TABLE IF EXISTS public.property_transfers
ADD CONSTRAINT property_transfers_seller_id_fkey 
FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================================
-- 10. FIX nearby_listings_saved TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.nearby_listings_saved
DROP CONSTRAINT IF EXISTS nearby_listings_saved_user_id_fkey;

ALTER TABLE IF EXISTS public.nearby_listings_saved
ADD CONSTRAINT nearby_listings_saved_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 11. FIX pending_listings_votes TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.pending_listings_votes
DROP CONSTRAINT IF EXISTS pending_listings_votes_user_id_fkey;

ALTER TABLE IF EXISTS public.pending_listings_votes
ADD CONSTRAINT pending_listings_votes_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 12. FIX p2p_loan_marketplace tables
-- ============================================================================
-- community_managers table
ALTER TABLE IF EXISTS public.community_managers
DROP CONSTRAINT IF EXISTS community_managers_user_id_fkey;

ALTER TABLE IF EXISTS public.community_managers
ADD CONSTRAINT community_managers_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- community_manager_kyc table
ALTER TABLE IF EXISTS public.community_manager_kyc
DROP CONSTRAINT IF EXISTS community_manager_kyc_verified_by_fkey;

ALTER TABLE IF EXISTS public.community_manager_kyc
ADD CONSTRAINT community_manager_kyc_verified_by_fkey 
FOREIGN KEY (verified_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- community_manager_votes table
ALTER TABLE IF EXISTS public.community_manager_votes
DROP CONSTRAINT IF EXISTS community_manager_votes_voter_id_fkey;

ALTER TABLE IF EXISTS public.community_manager_votes
ADD CONSTRAINT community_manager_votes_voter_id_fkey 
FOREIGN KEY (voter_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- loan_lenders table
ALTER TABLE IF EXISTS public.loan_lenders
DROP CONSTRAINT IF EXISTS loan_lenders_lender_id_fkey;

ALTER TABLE IF EXISTS public.loan_lenders
ADD CONSTRAINT loan_lenders_lender_id_fkey 
FOREIGN KEY (lender_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- loan_lender_ratings table
ALTER TABLE IF EXISTS public.loan_lender_ratings
DROP CONSTRAINT IF EXISTS loan_lender_ratings_rater_id_fkey;

ALTER TABLE IF EXISTS public.loan_lender_ratings
ADD CONSTRAINT loan_lender_ratings_rater_id_fkey 
FOREIGN KEY (rater_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- loan_ratings_p2p table
ALTER TABLE IF EXISTS public.loan_ratings_p2p
DROP CONSTRAINT IF EXISTS loan_ratings_p2p_rated_user_id_fkey;

ALTER TABLE IF EXISTS public.loan_ratings_p2p
ADD CONSTRAINT loan_ratings_p2p_rated_user_id_fkey 
FOREIGN KEY (rated_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 13. FIX loans table (add lender_id constraint if not exists)
-- ============================================================================
ALTER TABLE IF EXISTS public.loans
DROP CONSTRAINT IF EXISTS loans_lender_id_fkey;

ALTER TABLE IF EXISTS public.loans
ADD CONSTRAINT loans_lender_id_fkey 
FOREIGN KEY (lender_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================================
-- VERIFICATION: Check that all constraints are fixed
-- ============================================================================
-- This query shows any remaining invalid foreign key constraints
SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'users'  -- This should be empty after fix
  AND kcu.table_schema = 'public'
ORDER BY tc.table_name;
