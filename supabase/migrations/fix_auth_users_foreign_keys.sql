-- Migration: Fix foreign key references to auth.users
-- This migration fixes all broken foreign key constraints that reference
-- a non-existent 'users' table. They should reference 'auth.users' instead.
-- This is the root cause of signup failures (HTTP 500 errors).
-- IMPORTANT: This migration also cleans up bad data before adding constraints.
-- Made safer: All DELETE statements are wrapped in DO blocks to check if the table exists first.

-- ============================================================================
-- PART 1: CLEAN UP BAD DATA (NULL or invalid user_ids) - SAFELY
-- ============================================================================

-- Helper: Generic cleanup for user_id columns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallets_fiat') THEN
    DELETE FROM public.wallets_fiat 
    WHERE user_id IS NULL 
       OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = wallets_fiat.user_id);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallets_crypto') THEN
    DELETE FROM public.wallets_crypto 
    WHERE user_id IS NULL 
       OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = wallets_crypto.user_id);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallets') THEN
    DELETE FROM public.wallets 
    WHERE user_id IS NULL 
       OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = wallets.user_id);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'loans') THEN
    DELETE FROM public.loans 
    WHERE user_id IS NULL 
       OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = loans.user_id);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'loan_payments') THEN
    DELETE FROM public.loan_payments 
    WHERE user_id IS NULL 
       OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = loan_payments.user_id);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'deposits') THEN
    DELETE FROM public.deposits 
    WHERE user_id IS NULL 
       OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = deposits.user_id);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'investments') THEN
    DELETE FROM public.investments 
    WHERE user_id IS NULL 
       OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = investments.user_id);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'properties') THEN
    DELETE FROM public.properties 
    WHERE owner_id = '00000000-0000-0000-0000-000000000000'
       OR (owner_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = properties.owner_id));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'property_transfers') THEN
    DELETE FROM public.property_transfers 
    WHERE buyer_id IS NULL 
       OR buyer_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = property_transfers.buyer_id);

    DELETE FROM public.property_transfers 
    WHERE seller_id = '00000000-0000-0000-0000-000000000000'
       OR (seller_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = property_transfers.seller_id));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nearby_listings_saved') THEN
    DELETE FROM public.nearby_listings_saved 
    WHERE user_id IS NULL 
       OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = nearby_listings_saved.user_id);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pending_listings_votes') THEN
    DELETE FROM public.pending_listings_votes 
    WHERE user_id IS NULL 
       OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = pending_listings_votes.user_id);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'community_managers') THEN
    DELETE FROM public.community_managers 
    WHERE user_id IS NULL 
       OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = community_managers.user_id);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'community_manager_kyc') THEN
    DELETE FROM public.community_manager_kyc 
    WHERE verified_by = '00000000-0000-0000-0000-000000000000'
       OR (verified_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = community_manager_kyc.verified_by));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'community_manager_votes') THEN
    DELETE FROM public.community_manager_votes 
    WHERE voter_id IS NULL 
       OR voter_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = community_manager_votes.voter_id);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'loan_lenders') THEN
    DELETE FROM public.loan_lenders 
    WHERE lender_id IS NULL 
       OR lender_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = loan_lenders.lender_id);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'loan_lender_ratings') THEN
    DELETE FROM public.loan_lender_ratings 
    WHERE rater_id IS NULL 
       OR rater_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = loan_lender_ratings.rater_id);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'loan_ratings_p2p') THEN
    DELETE FROM public.loan_ratings_p2p 
    WHERE rated_user_id IS NULL 
       OR rated_user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = loan_ratings_p2p.rated_user_id);
  END IF;
END $$;

-- ============================================================================
-- PART 2: DROP OLD BROKEN CONSTRAINTS (already safe with IF EXISTS)
-- ============================================================================

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
-- PART 3: ADD NEW CORRECT CONSTRAINTS TO auth.users (already safe with IF EXISTS)
-- ============================================================================

ALTER TABLE IF EXISTS public.wallets_fiat
ADD CONSTRAINT wallets_fiat_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.wallets_crypto
ADD CONSTRAINT wallets_crypto_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.wallets
ADD CONSTRAINT wallets_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.loans
ADD CONSTRAINT loans_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.loan_payments
ADD CONSTRAINT loan_payments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.deposits
ADD CONSTRAINT deposits_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.investments
ADD CONSTRAINT investments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.properties
ADD CONSTRAINT properties_owner_id_fkey 
FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.property_transfers
ADD CONSTRAINT property_transfers_buyer_id_fkey 
FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.property_transfers
ADD CONSTRAINT property_transfers_seller_id_fkey 
FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.nearby_listings_saved
ADD CONSTRAINT nearby_listings_saved_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.pending_listings_votes
ADD CONSTRAINT pending_listings_votes_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

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

ALTER TABLE IF EXISTS public.loans
ADD CONSTRAINT loans_lender_id_fkey 
FOREIGN KEY (lender_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================================
-- VERIFICATION: Check that all constraints are fixed
-- ============================================================================

SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_schema,
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
  AND tc.table_schema = 'public'
  AND (ccu.table_name = 'users' OR ccu.table_schema = 'auth')
ORDER BY tc.table_name;
