-- Migration: Fix remaining broken foreign key constraints to auth.users
-- This migration fixes 33+ additional tables that have foreign key constraints
-- pointing to the non-existent public.users table instead of auth.users.
-- These were discovered by running the verification query after the first fix.

-- ============================================================================
-- PART 1: CLEAN UP BAD DATA - SAFELY WITH TABLE EXISTENCE CHECKS
-- ============================================================================

DO $$
BEGIN
  -- approval_votes
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'approval_votes') THEN
    DELETE FROM public.approval_votes 
    WHERE user_id IS NULL OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = approval_votes.user_id);
  END IF;

  -- balances
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'balances') THEN
    DELETE FROM public.balances 
    WHERE user_id IS NULL OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = balances.user_id);
  END IF;

  -- beneficiaries
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'beneficiaries') THEN
    DELETE FROM public.beneficiaries 
    WHERE user_id IS NULL OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = beneficiaries.user_id);
  END IF;

  -- bill_payments
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bill_payments') THEN
    DELETE FROM public.bill_payments 
    WHERE user_id IS NULL OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = bill_payments.user_id);
  END IF;

  -- bills
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bills') THEN
    DELETE FROM public.bills 
    WHERE user_id IS NULL OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = bills.user_id);
  END IF;

  -- conversation_members
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversation_members') THEN
    DELETE FROM public.conversation_members 
    WHERE user_id IS NULL OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = conversation_members.user_id);
  END IF;

  -- conversations (created_by)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversations') THEN
    DELETE FROM public.conversations 
    WHERE created_by = '00000000-0000-0000-0000-000000000000'
       OR (created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = conversations.created_by));
  END IF;

  -- friend_requests (requester_id and receiver_id)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'friend_requests') THEN
    DELETE FROM public.friend_requests 
    WHERE requester_id IS NULL OR requester_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = friend_requests.requester_id);
    DELETE FROM public.friend_requests 
    WHERE receiver_id IS NULL OR receiver_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = friend_requests.receiver_id);
  END IF;

  -- friends (user_id and friend_id)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'friends') THEN
    DELETE FROM public.friends 
    WHERE user_id IS NULL OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = friends.user_id);
    DELETE FROM public.friends 
    WHERE friend_id IS NULL OR friend_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = friends.friend_id);
  END IF;

  -- lender_profiles
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lender_profiles') THEN
    DELETE FROM public.lender_profiles 
    WHERE user_id IS NULL OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = lender_profiles.user_id);
  END IF;

  -- listing_votes
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'listing_votes') THEN
    DELETE FROM public.listing_votes 
    WHERE user_id IS NULL OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = listing_votes.user_id);
  END IF;

  -- loan_offers (lender_id)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'loan_offers') THEN
    DELETE FROM public.loan_offers 
    WHERE lender_id IS NULL OR lender_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = loan_offers.lender_id);
  END IF;

  -- loan_ratings (rater_id and rated_user_id)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'loan_ratings') THEN
    DELETE FROM public.loan_ratings 
    WHERE rater_id IS NULL OR rater_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = loan_ratings.rater_id);
    DELETE FROM public.loan_ratings 
    WHERE rated_user_id IS NULL OR rated_user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = loan_ratings.rated_user_id);
  END IF;

  -- messages (sender_id and recipient_id)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
    DELETE FROM public.messages 
    WHERE sender_id IS NULL OR sender_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = messages.sender_id);
    DELETE FROM public.messages 
    WHERE recipient_id IS NULL OR recipient_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = messages.recipient_id);
  END IF;

  -- pending_listings (submitted_by_user_id)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pending_listings') THEN
    DELETE FROM public.pending_listings 
    WHERE submitted_by_user_id IS NULL OR submitted_by_user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = pending_listings.submitted_by_user_id);
  END IF;

  -- players
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'players') THEN
    DELETE FROM public.players 
    WHERE user_id IS NULL OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = players.user_id);
  END IF;

  -- privacy_settings
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'privacy_settings') THEN
    DELETE FROM public.privacy_settings 
    WHERE user_id IS NULL OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = privacy_settings.user_id);
  END IF;

  -- property_transactions (buyer_id and seller_id)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'property_transactions') THEN
    DELETE FROM public.property_transactions 
    WHERE buyer_id IS NULL OR buyer_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = property_transactions.buyer_id);
    DELETE FROM public.property_transactions 
    WHERE seller_id IS NULL OR seller_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = property_transactions.seller_id);
  END IF;

  -- ride_live_locations
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ride_live_locations') THEN
    DELETE FROM public.ride_live_locations 
    WHERE user_id IS NULL OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = ride_live_locations.user_id);
  END IF;

  -- ride_match_messages
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ride_match_messages') THEN
    DELETE FROM public.ride_match_messages 
    WHERE user_id IS NULL OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = ride_match_messages.user_id);
  END IF;

  -- ride_matches (rider_id and driver_id)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ride_matches') THEN
    DELETE FROM public.ride_matches 
    WHERE rider_id IS NULL OR rider_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = ride_matches.rider_id);
    DELETE FROM public.ride_matches 
    WHERE driver_id IS NULL OR driver_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = ride_matches.driver_id);
  END IF;

  -- ride_ratings (rater_id and ratee_id)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ride_ratings') THEN
    DELETE FROM public.ride_ratings 
    WHERE rater_id IS NULL OR rater_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = ride_ratings.rater_id);
    DELETE FROM public.ride_ratings 
    WHERE ratee_id IS NULL OR ratee_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = ride_ratings.ratee_id);
  END IF;

  -- ride_requests
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ride_requests') THEN
    DELETE FROM public.ride_requests 
    WHERE user_id IS NULL OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = ride_requests.user_id);
  END IF;

  -- transactions
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transactions') THEN
    DELETE FROM public.transactions 
    WHERE user_id IS NULL OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = transactions.user_id);
  END IF;

  -- transfers (sender_id and recipient_id)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transfers') THEN
    DELETE FROM public.transfers 
    WHERE sender_id IS NULL OR sender_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = transfers.sender_id);
    DELETE FROM public.transfers 
    WHERE recipient_id IS NULL OR recipient_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = transfers.recipient_id);
  END IF;

  -- user_verifications (user_id and verified_by)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_verifications') THEN
    DELETE FROM public.user_verifications 
    WHERE user_id IS NULL OR user_id = '00000000-0000-0000-0000-000000000000'
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_verifications.user_id);
    DELETE FROM public.user_verifications 
    WHERE verified_by = '00000000-0000-0000-0000-000000000000'
       OR (verified_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_verifications.verified_by));
  END IF;
END $$;

-- ============================================================================
-- PART 2: DROP OLD BROKEN CONSTRAINTS
-- ============================================================================

ALTER TABLE IF EXISTS public.approval_votes DROP CONSTRAINT IF EXISTS approval_votes_user_id_fkey;
ALTER TABLE IF EXISTS public.balances DROP CONSTRAINT IF EXISTS balances_user_id_fkey;
ALTER TABLE IF EXISTS public.beneficiaries DROP CONSTRAINT IF EXISTS beneficiaries_user_id_fkey;
ALTER TABLE IF EXISTS public.bill_payments DROP CONSTRAINT IF EXISTS bill_payments_user_id_fkey;
ALTER TABLE IF EXISTS public.bills DROP CONSTRAINT IF EXISTS bills_user_id_fkey;
ALTER TABLE IF EXISTS public.conversation_members DROP CONSTRAINT IF EXISTS conversation_members_user_id_fkey;
ALTER TABLE IF EXISTS public.conversations DROP CONSTRAINT IF EXISTS conversations_created_by_fkey;
ALTER TABLE IF EXISTS public.friend_requests DROP CONSTRAINT IF EXISTS friend_requests_requester_id_fkey;
ALTER TABLE IF EXISTS public.friend_requests DROP CONSTRAINT IF EXISTS friend_requests_receiver_id_fkey;
ALTER TABLE IF EXISTS public.friends DROP CONSTRAINT IF EXISTS friends_user_id_fkey;
ALTER TABLE IF EXISTS public.friends DROP CONSTRAINT IF EXISTS friends_friend_id_fkey;
ALTER TABLE IF EXISTS public.lender_profiles DROP CONSTRAINT IF EXISTS lender_profiles_user_id_fkey;
ALTER TABLE IF EXISTS public.listing_votes DROP CONSTRAINT IF EXISTS listing_votes_user_id_fkey;
ALTER TABLE IF EXISTS public.loan_offers DROP CONSTRAINT IF EXISTS loan_offers_lender_id_fkey;
ALTER TABLE IF EXISTS public.loan_ratings DROP CONSTRAINT IF EXISTS loan_ratings_rater_id_fkey;
ALTER TABLE IF EXISTS public.loan_ratings DROP CONSTRAINT IF EXISTS loan_ratings_rated_user_id_fkey;
ALTER TABLE IF EXISTS public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE IF EXISTS public.messages DROP CONSTRAINT IF EXISTS messages_recipient_id_fkey;
ALTER TABLE IF EXISTS public.pending_listings DROP CONSTRAINT IF EXISTS pending_listings_submitted_by_user_id_fkey;
ALTER TABLE IF EXISTS public.players DROP CONSTRAINT IF EXISTS players_user_id_fkey;
ALTER TABLE IF EXISTS public.privacy_settings DROP CONSTRAINT IF EXISTS privacy_settings_user_id_fkey;
ALTER TABLE IF EXISTS public.property_transactions DROP CONSTRAINT IF EXISTS property_transactions_buyer_id_fkey;
ALTER TABLE IF EXISTS public.property_transactions DROP CONSTRAINT IF EXISTS property_transactions_seller_id_fkey;
ALTER TABLE IF EXISTS public.ride_live_locations DROP CONSTRAINT IF EXISTS ride_live_locations_user_id_fkey;
ALTER TABLE IF EXISTS public.ride_match_messages DROP CONSTRAINT IF EXISTS ride_match_messages_user_id_fkey;
ALTER TABLE IF EXISTS public.ride_matches DROP CONSTRAINT IF EXISTS ride_matches_rider_id_fkey;
ALTER TABLE IF EXISTS public.ride_matches DROP CONSTRAINT IF EXISTS ride_matches_driver_id_fkey;
ALTER TABLE IF EXISTS public.ride_ratings DROP CONSTRAINT IF EXISTS ride_ratings_rater_id_fkey;
ALTER TABLE IF EXISTS public.ride_ratings DROP CONSTRAINT IF EXISTS ride_ratings_ratee_id_fkey;
ALTER TABLE IF EXISTS public.ride_requests DROP CONSTRAINT IF EXISTS ride_requests_user_id_fkey;
ALTER TABLE IF EXISTS public.transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
ALTER TABLE IF EXISTS public.transfers DROP CONSTRAINT IF EXISTS transfers_sender_id_fkey;
ALTER TABLE IF EXISTS public.transfers DROP CONSTRAINT IF EXISTS transfers_recipient_id_fkey;
ALTER TABLE IF EXISTS public.user_verifications DROP CONSTRAINT IF EXISTS user_verifications_user_id_fkey;
ALTER TABLE IF EXISTS public.user_verifications DROP CONSTRAINT IF EXISTS user_verifications_verified_by_fkey;

-- ============================================================================
-- PART 3: ADD NEW CORRECT CONSTRAINTS TO auth.users
-- ============================================================================

ALTER TABLE IF EXISTS public.approval_votes ADD CONSTRAINT approval_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.balances ADD CONSTRAINT balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.beneficiaries ADD CONSTRAINT beneficiaries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.bill_payments ADD CONSTRAINT bill_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.bills ADD CONSTRAINT bills_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.conversation_members ADD CONSTRAINT conversation_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.conversations ADD CONSTRAINT conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.friend_requests ADD CONSTRAINT friend_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.friend_requests ADD CONSTRAINT friend_requests_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.friends ADD CONSTRAINT friends_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.friends ADD CONSTRAINT friends_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.lender_profiles ADD CONSTRAINT lender_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.listing_votes ADD CONSTRAINT listing_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.loan_offers ADD CONSTRAINT loan_offers_lender_id_fkey FOREIGN KEY (lender_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.loan_ratings ADD CONSTRAINT loan_ratings_rater_id_fkey FOREIGN KEY (rater_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.loan_ratings ADD CONSTRAINT loan_ratings_rated_user_id_fkey FOREIGN KEY (rated_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.messages ADD CONSTRAINT messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.pending_listings ADD CONSTRAINT pending_listings_submitted_by_user_id_fkey FOREIGN KEY (submitted_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.players ADD CONSTRAINT players_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.privacy_settings ADD CONSTRAINT privacy_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.property_transactions ADD CONSTRAINT property_transactions_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.property_transactions ADD CONSTRAINT property_transactions_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.ride_live_locations ADD CONSTRAINT ride_live_locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.ride_match_messages ADD CONSTRAINT ride_match_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.ride_matches ADD CONSTRAINT ride_matches_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.ride_matches ADD CONSTRAINT ride_matches_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.ride_ratings ADD CONSTRAINT ride_ratings_rater_id_fkey FOREIGN KEY (rater_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.ride_ratings ADD CONSTRAINT ride_ratings_ratee_id_fkey FOREIGN KEY (ratee_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.ride_requests ADD CONSTRAINT ride_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.transactions ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.transfers ADD CONSTRAINT transfers_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.transfers ADD CONSTRAINT transfers_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.user_verifications ADD CONSTRAINT user_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.user_verifications ADD CONSTRAINT user_verifications_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================================
-- SUCCESS: All 33+ remaining foreign keys are now fixed to auth.users
-- ============================================================================
