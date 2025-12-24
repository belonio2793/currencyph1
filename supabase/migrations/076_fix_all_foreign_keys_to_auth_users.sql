-- Migration: 076 - Fix ALL Foreign Keys to Reference auth.users
-- Problem: Many tables reference "users(id)" which could be public.users, causing signup failures
-- Solution: Explicitly reference auth.users(id) for all user-related foreign keys

-- This migration ensures that ALL user references in the database point to auth.users(id)
-- This prevents foreign key constraint violations during signup when public.users doesn't exist yet

-- ============================================================================
-- 1. DEPOSITS TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.deposits
  DROP CONSTRAINT IF EXISTS deposits_user_id_fkey CASCADE;

ALTER TABLE IF EXISTS public.deposits
  ADD CONSTRAINT deposits_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 2. LOANS TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.loans
  DROP CONSTRAINT IF EXISTS loans_user_id_fkey CASCADE;

ALTER TABLE IF EXISTS public.loans
  ADD CONSTRAINT loans_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 3. LOAN PAYMENTS TABLE (if exists)
-- ============================================================================
ALTER TABLE IF EXISTS public.loan_payments
  DROP CONSTRAINT IF EXISTS loan_payments_user_id_fkey CASCADE;

ALTER TABLE IF EXISTS public.loan_payments
  ADD CONSTRAINT loan_payments_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 4. LOAN REQUESTS TABLE (if exists)
-- ============================================================================
ALTER TABLE IF EXISTS public.loan_requests
  DROP CONSTRAINT IF EXISTS loan_requests_lender_id_fkey CASCADE;

ALTER TABLE IF EXISTS public.loan_requests
  ADD CONSTRAINT loan_requests_lender_id_fkey 
  FOREIGN KEY (lender_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 5. CONVERSATIONS TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.conversations
  DROP CONSTRAINT IF EXISTS conversations_created_by_fkey CASCADE;

ALTER TABLE IF EXISTS public.conversations
  ADD CONSTRAINT conversations_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================================
-- 6. CONVERSATION MEMBERS TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.conversation_members
  DROP CONSTRAINT IF EXISTS conversation_members_user_id_fkey CASCADE;

ALTER TABLE IF EXISTS public.conversation_members
  ADD CONSTRAINT conversation_members_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 7. MESSAGES TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.messages
  DROP CONSTRAINT IF EXISTS messages_user_id_fkey CASCADE;

ALTER TABLE IF EXISTS public.messages
  ADD CONSTRAINT messages_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 8. MESSAGE READS TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.message_reads
  DROP CONSTRAINT IF EXISTS message_reads_user_id_fkey CASCADE;

ALTER TABLE IF EXISTS public.message_reads
  ADD CONSTRAINT message_reads_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 9. INVESTMENTS TABLE (if exists)
-- ============================================================================
ALTER TABLE IF EXISTS public.investments
  DROP CONSTRAINT IF EXISTS investments_user_id_fkey CASCADE;

ALTER TABLE IF EXISTS public.investments
  ADD CONSTRAINT investments_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 10. DEPOSITS AUDIT TABLE (if exists)
-- ============================================================================
ALTER TABLE IF EXISTS public.deposit_audit
  DROP CONSTRAINT IF EXISTS deposit_audit_changed_by_fkey CASCADE;

ALTER TABLE IF EXISTS public.deposit_audit
  ADD CONSTRAINT deposit_audit_changed_by_fkey 
  FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================================
-- 11. DEPOSITS TABLE - confirmed_by column (if exists)
-- ============================================================================
ALTER TABLE IF EXISTS public.deposits
  DROP CONSTRAINT IF EXISTS deposits_confirmed_by_fkey CASCADE;

ALTER TABLE IF EXISTS public.deposits
  ADD CONSTRAINT deposits_confirmed_by_fkey 
  FOREIGN KEY (confirmed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================================
-- 12. PROPERTIES TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.properties
  DROP CONSTRAINT IF EXISTS properties_owner_id_fkey CASCADE;

ALTER TABLE IF EXISTS public.properties
  ADD CONSTRAINT properties_owner_id_fkey 
  FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================================
-- 13. WALLET ENTRIES TABLE (if exists)
-- ============================================================================
ALTER TABLE IF EXISTS public.wallet_entries
  DROP CONSTRAINT IF EXISTS wallet_entries_user_id_fkey CASCADE;

ALTER TABLE IF EXISTS public.wallet_entries
  ADD CONSTRAINT wallet_entries_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================================
-- 14. COMMUNITY MANAGERS TABLE (if exists)
-- ============================================================================
ALTER TABLE IF EXISTS public.community_managers
  DROP CONSTRAINT IF EXISTS community_managers_user_id_fkey CASCADE;

ALTER TABLE IF EXISTS public.community_managers
  ADD CONSTRAINT community_managers_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 15. LOANS - verified_by column (if exists)
-- ============================================================================
ALTER TABLE IF EXISTS public.loans
  DROP CONSTRAINT IF EXISTS loans_verified_by_fkey CASCADE;

ALTER TABLE IF EXISTS public.loans
  ADD CONSTRAINT loans_verified_by_fkey 
  FOREIGN KEY (verified_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================================
-- 16. COMMUNITY_MANAGER_VOTES TABLE (if exists)
-- ============================================================================
ALTER TABLE IF EXISTS public.community_manager_votes
  DROP CONSTRAINT IF EXISTS community_manager_votes_voter_id_fkey CASCADE;

ALTER TABLE IF EXISTS public.community_manager_votes
  ADD CONSTRAINT community_manager_votes_voter_id_fkey 
  FOREIGN KEY (voter_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 17. PENDING_LISTINGS TABLE (if exists)
-- ============================================================================
ALTER TABLE IF EXISTS public.pending_listings
  DROP CONSTRAINT IF EXISTS pending_listings_submitted_by_user_id_fkey CASCADE;

ALTER TABLE IF EXISTS public.pending_listings
  ADD CONSTRAINT pending_listings_submitted_by_user_id_fkey 
  FOREIGN KEY (submitted_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 18. PENDING_LISTINGS_VOTES TABLE (if exists)
-- ============================================================================
ALTER TABLE IF EXISTS public.pending_listings_votes
  DROP CONSTRAINT IF EXISTS pending_listings_votes_user_id_fkey CASCADE;

ALTER TABLE IF EXISTS public.pending_listings_votes
  ADD CONSTRAINT pending_listings_votes_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 19. NEARBY_LISTINGS_VOTES TABLE (if exists)
-- ============================================================================
ALTER TABLE IF EXISTS public.nearby_listings_votes
  DROP CONSTRAINT IF EXISTS nearby_listings_votes_user_id_fkey CASCADE;

ALTER TABLE IF EXISTS public.nearby_listings_votes
  ADD CONSTRAINT nearby_listings_votes_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 20. RIDE REQUESTS TABLE (if exists)
-- ============================================================================
ALTER TABLE IF EXISTS public.ride_requests
  DROP CONSTRAINT IF EXISTS ride_requests_user_id_fkey CASCADE;

ALTER TABLE IF EXISTS public.ride_requests
  ADD CONSTRAINT ride_requests_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 21. RIDE MATCHES TABLE (if exists)
-- ============================================================================
ALTER TABLE IF EXISTS public.ride_matches
  DROP CONSTRAINT IF EXISTS ride_matches_user_id_fkey CASCADE;

ALTER TABLE IF EXISTS public.ride_matches
  ADD CONSTRAINT ride_matches_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 22. RIDE MATCH RATINGS TABLE (if exists)
-- ============================================================================
ALTER TABLE IF EXISTS public.ride_match_ratings
  DROP CONSTRAINT IF EXISTS ride_match_ratings_rater_id_fkey CASCADE;

ALTER TABLE IF EXISTS public.ride_match_ratings
  ADD CONSTRAINT ride_match_ratings_rater_id_fkey 
  FOREIGN KEY (rater_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 23. TRANSFERS TABLE (if exists)
-- ============================================================================
ALTER TABLE IF EXISTS public.transfers
  DROP CONSTRAINT IF EXISTS transfers_initiated_by_fkey CASCADE;

ALTER TABLE IF EXISTS public.transfers
  ADD CONSTRAINT transfers_initiated_by_fkey 
  FOREIGN KEY (initiated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================================
-- 24. VOICE CALLS TABLE (if exists)
-- ============================================================================
ALTER TABLE IF EXISTS public.voice_calls
  DROP CONSTRAINT IF EXISTS voice_calls_caller_id_fkey CASCADE;

ALTER TABLE IF EXISTS public.voice_calls
  ADD CONSTRAINT voice_calls_caller_id_fkey 
  FOREIGN KEY (caller_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.voice_calls
  DROP CONSTRAINT IF EXISTS voice_calls_callee_id_fkey CASCADE;

ALTER TABLE IF EXISTS public.voice_calls
  ADD CONSTRAINT voice_calls_callee_id_fkey 
  FOREIGN KEY (callee_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 25. USER PRESENCE TABLE (if exists)
-- ============================================================================
ALTER TABLE IF EXISTS public.user_presence
  DROP CONSTRAINT IF EXISTS user_presence_user_id_fkey CASCADE;

ALTER TABLE IF EXISTS public.user_presence
  ADD CONSTRAINT user_presence_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================
COMMENT ON SCHEMA public IS 'All user_id foreign keys now reference auth.users(id) to ensure signup triggers work correctly';
