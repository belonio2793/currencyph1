-- ============================================================================
-- WALLET TRANSACTIONS TABLE ENRICHMENT & FIXES
-- ============================================================================
-- This migration ensures:
-- 1. wallet_transactions has user_id column for direct user lookups
-- 2. wallet_transactions has currency_code for filtering by currency
-- 3. Proper indexes for fast queries across all user transactions
-- 4. RLS policies allow users to see their wallet transactions
--
-- Migration version: 0126
-- Created: 2025-01-01
-- Purpose: Fix transaction history queries to show all user wallet transactions

-- ============================================================================
-- PART 1: ENSURE REQUIRED COLUMNS EXIST
-- ============================================================================

-- Add user_id column if it doesn't exist
ALTER TABLE IF EXISTS wallet_transactions
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add currency_code column if it doesn't exist
ALTER TABLE IF EXISTS wallet_transactions
ADD COLUMN IF NOT EXISTS currency_code VARCHAR(16);

-- ============================================================================
-- PART 2: POPULATE user_id FROM wallets RELATIONSHIP
-- ============================================================================

-- Backfill user_id from related wallets table for existing records
UPDATE wallet_transactions wt
SET user_id = w.user_id
FROM wallets w
WHERE wt.wallet_id = w.id AND wt.user_id IS NULL;

-- ============================================================================
-- PART 3: CREATE COMPREHENSIVE INDEXES
-- ============================================================================

-- User-based indexes (for transaction history queries)
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id 
  ON wallet_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_status
  ON wallet_transactions(user_id, type, created_at DESC);

-- Currency-based indexes
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_currency_code
  ON wallet_transactions(currency_code, created_at DESC);

-- Combined indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_currency
  ON wallet_transactions(user_id, currency_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_created
  ON wallet_transactions(wallet_id, created_at DESC);

-- ============================================================================
-- PART 4: ENSURE RLS POLICIES ARE CORRECT
-- ============================================================================

-- Drop existing policies if they exist to recreate them
DROP POLICY IF EXISTS wallet_transactions_select ON wallet_transactions;
DROP POLICY IF EXISTS wallet_transactions_insert ON wallet_transactions;
DROP POLICY IF EXISTS wallet_transactions_update ON wallet_transactions;
DROP POLICY IF EXISTS wallet_transactions_delete ON wallet_transactions;

-- Enable RLS
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see transactions from their own wallets
CREATE POLICY wallet_transactions_select ON wallet_transactions
  FOR SELECT
  USING (
    -- User can see transactions if:
    -- 1. They own the wallet, OR
    -- 2. They are the service role
    (user_id = auth.uid()) OR
    (wallet_id IN (SELECT id FROM wallets WHERE user_id = auth.uid())) OR
    (auth.jwt() ->> 'role' = 'service_role')
  );

-- Policy: Only service role can insert
CREATE POLICY wallet_transactions_insert ON wallet_transactions
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Only service role can update
CREATE POLICY wallet_transactions_update ON wallet_transactions
  FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Only service role can delete
CREATE POLICY wallet_transactions_delete ON wallet_transactions
  FOR DELETE
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- PART 5: CREATE TRIGGER TO AUTO-POPULATE user_id ON INSERT
-- ============================================================================

DROP TRIGGER IF EXISTS wallet_transactions_populate_user_id_trigger ON wallet_transactions;

CREATE OR REPLACE FUNCTION populate_wallet_transaction_user_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If user_id is not provided, fetch it from the wallet
  IF NEW.user_id IS NULL THEN
    SELECT user_id INTO NEW.user_id FROM wallets WHERE id = NEW.wallet_id;
  END IF;
  
  -- If currency_code is not provided, fetch it from the wallet
  IF NEW.currency_code IS NULL THEN
    SELECT currency_code INTO NEW.currency_code FROM wallets WHERE id = NEW.wallet_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallet_transactions_populate_user_id_trigger
BEFORE INSERT ON wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION populate_wallet_transaction_user_id();

-- ============================================================================
-- PART 6: GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON wallet_transactions TO authenticated;
GRANT INSERT ON wallet_transactions TO service_role;
GRANT UPDATE ON wallet_transactions TO service_role;
GRANT DELETE ON wallet_transactions TO service_role;

-- ============================================================================
-- PART 7: VERIFICATION QUERIES (for debugging)
-- ============================================================================

-- Verify user_id is populated:
-- SELECT COUNT(*) as transactions_without_user_id FROM wallet_transactions WHERE user_id IS NULL;

-- Verify currency_code is populated:
-- SELECT COUNT(*) as transactions_without_currency FROM wallet_transactions WHERE currency_code IS NULL;

-- Check a sample user's transactions:
-- SELECT wt.id, wt.user_id, wt.wallet_id, wt.type, wt.amount, wt.currency_code, wt.created_at
-- FROM wallet_transactions wt
-- WHERE wt.user_id = auth.uid()
-- ORDER BY wt.created_at DESC
-- LIMIT 10;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- The wallet_transactions table now:
-- ✓ Has user_id column for direct user lookups
-- ✓ Has currency_code for filtering by currency
-- ✓ Has proper indexes for transaction history queries
-- ✓ Has improved RLS policies
-- ✓ Auto-populates user_id and currency_code on insert
-- ✓ Allows users to see all their wallet transactions
-- ============================================================================
