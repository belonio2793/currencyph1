-- ============================================================================
-- CRITICAL FIX: Deposits Metadata & Wallet Balance Reconciliation
-- ============================================================================
-- Issue: PHP to BTC conversion creating corrupted balances
-- Root cause: Balance calculations may include unit conversion errors
--
-- Solution:
-- 1. Reconcile public.wallets from wallet_transactions (source of truth)
-- 2. Improve deposit metadata capture
-- 3. Add currency conversion validation
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: DIAGNOSTIC QUERIES (to understand the corruption)
-- ============================================================================

-- These queries help identify the issue for transaction cbf899c8-78f2-46e7-a319-c119400b68b1
-- Run AFTER migration to check the impact

/*
-- Diagnostic: Show all transactions for the deposit
SELECT 
  wt.id,
  wt.wallet_id,
  wt.type,
  wt.amount,
  wt.balance_before,
  wt.balance_after,
  wt.currency_code,
  wt.created_at,
  wt.metadata
FROM wallet_transactions wt
WHERE wt.reference_id = 'cbf899c8-78f2-46e7-a319-c119400b68b1'
ORDER BY wt.created_at;

-- Diagnostic: Show wallet balance vs calculated balance
SELECT 
  w.id as wallet_id,
  w.balance as current_balance,
  w.currency_code,
  (SELECT SUM(CASE 
    WHEN type IN ('deposit_pending', 'deposit_approved', 'transfer_in', 'refund') THEN amount
    WHEN type IN ('deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee') THEN -amount
    WHEN type = 'adjustment' THEN amount
    ELSE 0
  END) FROM wallet_transactions WHERE wallet_id = w.id) as calculated_balance,
  w.user_id
FROM wallets w
WHERE w.user_id IN (SELECT user_id FROM deposits WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1')
ORDER BY w.currency_code;

-- Diagnostic: Find all corrupted wallets (balance > 1 billion)
SELECT 
  w.id,
  w.user_id,
  w.currency_code,
  w.balance,
  COUNT(DISTINCT wt.id) as transaction_count
FROM wallets w
LEFT JOIN wallet_transactions wt ON wt.wallet_id = w.id
WHERE w.balance > 1000000000  -- More than 1 billion
GROUP BY w.id, w.user_id, w.currency_code, w.balance
ORDER BY w.balance DESC;
*/

-- ============================================================================
-- STEP 2: Create RECONCILIATION function
-- ============================================================================

CREATE OR REPLACE FUNCTION reconcile_wallet_balance(p_wallet_id UUID)
RETURNS RECORD AS $$
DECLARE
  v_actual_balance NUMERIC;
  v_calculated_balance NUMERIC;
  v_discrepancy NUMERIC;
  v_is_valid BOOLEAN;
BEGIN
  -- Get current balance
  SELECT balance INTO v_actual_balance
  FROM wallets
  WHERE id = p_wallet_id;

  -- Calculate balance from transactions
  SELECT SUM(CASE
    WHEN type IN ('deposit_pending', 'deposit_approved', 'transfer_in', 'refund') THEN amount
    WHEN type IN ('deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee') THEN -amount
    WHEN type = 'adjustment' THEN amount
    ELSE 0
  END) INTO v_calculated_balance
  FROM wallet_transactions
  WHERE wallet_id = p_wallet_id;

  -- Set defaults
  v_calculated_balance := COALESCE(v_calculated_balance, 0);
  v_discrepancy := v_actual_balance - v_calculated_balance;
  v_is_valid := ABS(v_discrepancy) < 0.01;  -- Allow small floating point errors

  RETURN (v_wallet_id, v_actual_balance, v_calculated_balance, v_discrepancy, v_is_valid);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 3: Create WALLET BALANCE FIX function
-- ============================================================================

CREATE OR REPLACE FUNCTION fix_wallet_balance(p_wallet_id UUID)
RETURNS TABLE(
  wallet_id UUID,
  currency_code VARCHAR,
  old_balance NUMERIC,
  new_balance NUMERIC,
  fixed BOOLEAN
) AS $$
DECLARE
  v_calculated_balance NUMERIC;
  v_old_balance NUMERIC;
BEGIN
  -- Get current balance
  SELECT balance INTO v_old_balance
  FROM wallets
  WHERE id = p_wallet_id;

  -- Calculate correct balance from transactions
  SELECT SUM(CASE
    WHEN type IN ('deposit_pending', 'deposit_approved', 'transfer_in', 'refund') THEN amount
    WHEN type IN ('deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee') THEN -amount
    WHEN type = 'adjustment' THEN amount
    ELSE 0
  END) INTO v_calculated_balance
  FROM wallet_transactions
  WHERE wallet_id = p_wallet_id;

  v_calculated_balance := COALESCE(v_calculated_balance, 0);

  -- Only fix if there's a significant discrepancy (more than 0.01)
  IF ABS(v_old_balance - v_calculated_balance) >= 0.01 THEN
    UPDATE wallets
    SET balance = v_calculated_balance, updated_at = NOW()
    WHERE id = p_wallet_id;

    RETURN QUERY
    SELECT
      p_wallet_id,
      (SELECT currency_code FROM wallets WHERE id = p_wallet_id),
      v_old_balance,
      v_calculated_balance,
      TRUE;
  ELSE
    RETURN QUERY
    SELECT
      p_wallet_id,
      (SELECT currency_code FROM wallets WHERE id = p_wallet_id),
      v_old_balance,
      v_calculated_balance,
      FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 4: Improve DEPOSIT METADATA capture
-- ============================================================================

CREATE OR REPLACE FUNCTION improve_deposit_metadata()
RETURNS TRIGGER AS $$
DECLARE
  v_metadata JSONB;
  v_exchange_rate NUMERIC;
  v_received_amount NUMERIC;
BEGIN
  -- Build comprehensive metadata
  v_metadata := jsonb_build_object(
    -- Original deposit info
    'deposit_id', NEW.id,
    'deposit_method', NEW.deposit_method,
    'original_amount', NEW.amount,
    'original_currency', NEW.currency_code,
    'status_before', OLD.status,
    'status_after', NEW.status,
    
    -- Exchange rate info (if conversion happened)
    'exchange_rate', COALESCE(NEW.exchange_rate, 1),
    'received_currency', NEW.currency_code,
    'received_amount', COALESCE(NEW.received_amount, NEW.amount),
    
    -- Conversion validation
    'conversion_valid', CASE
      WHEN NEW.received_amount IS NULL THEN NULL
      WHEN ABS((NEW.received_amount / NULLIF(NEW.exchange_rate, 0)) - NEW.amount) < 0.01 THEN TRUE
      ELSE FALSE
    END,
    
    -- Approval info
    'approved_by', COALESCE(NEW.approved_by::TEXT, 'system'),
    'approved_at', NEW.approved_at,
    'reversed_by', COALESCE(NEW.reversed_by::TEXT, NULL),
    'reversed_at', NEW.reversed_at,
    
    -- Audit info
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'payment_reference', NEW.payment_reference,
    'external_tx_id', NEW.external_tx_id
  );

  -- Only store if this is a status transition that matters
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE deposits
    SET metadata = v_metadata
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS enrich_deposit_metadata_on_status_change ON deposits;
CREATE TRIGGER enrich_deposit_metadata_on_status_change
AFTER UPDATE ON deposits
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION improve_deposit_metadata();

-- ============================================================================
-- STEP 5: Add metadata column to deposits if missing
-- ============================================================================

ALTER TABLE IF EXISTS deposits
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_deposits_metadata ON deposits USING GIN(metadata);

-- ============================================================================
-- STEP 6: Create BULK FIX for all corrupted wallets
-- ============================================================================

CREATE OR REPLACE FUNCTION fix_all_corrupted_wallets()
RETURNS TABLE(
  total_wallets_checked INTEGER,
  wallets_fixed INTEGER,
  wallets_in_sync INTEGER
) AS $$
DECLARE
  v_fixed_count INTEGER := 0;
  v_in_sync_count INTEGER := 0;
  v_total_count INTEGER := 0;
  v_wallet_record RECORD;
  v_calculated NUMERIC;
  v_actual NUMERIC;
BEGIN
  -- Iterate all wallets with suspicious balances
  FOR v_wallet_record IN
    SELECT w.id, w.balance
    FROM wallets w
    WHERE w.balance > 1000000  -- More than 1 million - suspicious for BTC
       OR w.balance > 10000000000  -- More than 10 billion - suspicious for PHP
  LOOP
    v_total_count := v_total_count + 1;

    -- Calculate correct balance
    SELECT SUM(CASE
      WHEN type IN ('deposit_pending', 'deposit_approved', 'transfer_in', 'refund') THEN amount
      WHEN type IN ('deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee') THEN -amount
      WHEN type = 'adjustment' THEN amount
      ELSE 0
    END) INTO v_calculated
    FROM wallet_transactions
    WHERE wallet_id = v_wallet_record.id;

    v_calculated := COALESCE(v_calculated, 0);
    v_actual := v_wallet_record.balance;

    -- If there's significant discrepancy, fix it
    IF ABS(v_actual - v_calculated) >= 0.01 THEN
      UPDATE wallets
      SET balance = v_calculated, updated_at = NOW()
      WHERE id = v_wallet_record.id;

      v_fixed_count := v_fixed_count + 1;
    ELSE
      v_in_sync_count := v_in_sync_count + 1;
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT v_total_count, v_fixed_count, v_in_sync_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 7: Add validation constraints to prevent future corruption
-- ============================================================================

-- Add check constraint for reasonable balances
ALTER TABLE wallets
ADD CONSTRAINT check_wallet_balance_reasonable 
CHECK (
  (currency_code = 'BTC' AND balance < 21000000) OR  -- BTC max supply is ~21M
  (currency_code = 'PHP' AND balance < 999999999999) OR  -- 1 trillion PHP max (reasonable)
  (currency_code NOT IN ('BTC', 'PHP'))
) DEFERRABLE INITIALLY DEFERRED;

-- ============================================================================
-- STEP 8: Create audit log for wallet balance changes
-- ============================================================================

CREATE TABLE IF NOT EXISTS wallet_balance_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  balance_before NUMERIC(36, 8) NOT NULL,
  balance_after NUMERIC(36, 8) NOT NULL,
  change_reason TEXT NOT NULL,
  changed_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_balance_audit_wallet ON wallet_balance_audit(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_balance_audit_created ON wallet_balance_audit(created_at DESC);

-- ============================================================================
-- STEP 9: Create function to log balance changes
-- ============================================================================

CREATE OR REPLACE FUNCTION log_wallet_balance_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.balance IS DISTINCT FROM OLD.balance THEN
    INSERT INTO wallet_balance_audit (
      wallet_id,
      balance_before,
      balance_after,
      change_reason,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.balance,
      NEW.balance,
      'balance_update',
      'system'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_wallet_balance_changes ON wallets;
CREATE TRIGGER log_wallet_balance_changes
AFTER UPDATE ON wallets
FOR EACH ROW
EXECUTE FUNCTION log_wallet_balance_change();

-- ============================================================================
-- STEP 10: Comments for documentation
-- ============================================================================

COMMENT ON FUNCTION reconcile_wallet_balance(UUID) IS
'Diagnoses balance discrepancies between actual balance and calculated balance from transactions.
Does NOT modify data - purely diagnostic.';

COMMENT ON FUNCTION fix_wallet_balance(UUID) IS
'Fixes a single wallet balance by recalculating from wallet_transactions.
Returns: wallet_id, currency_code, old_balance, new_balance, fixed (boolean)';

COMMENT ON FUNCTION fix_all_corrupted_wallets() IS
'Bulk fix all corrupted wallets (balances > 1M BTC or > 10B PHP).
Returns: total_wallets_checked, wallets_fixed, wallets_in_sync';

COMMENT ON TABLE wallet_balance_audit IS
'Audit trail of all wallet balance changes for accountability and debugging.';

COMMENT ON FUNCTION improve_deposit_metadata() IS
'Enriches deposit metadata with comprehensive transaction details.
Validates conversion calculations and captures all approval/reversal info.';

COMMIT;

-- ============================================================================
-- HOW TO USE AFTER MIGRATION
-- ============================================================================
--
-- 1. DIAGNOSE the specific transaction:
-- SELECT * FROM wallet_transactions 
-- WHERE reference_id = 'cbf899c8-78f2-46e7-a319-c119400b68b1'
-- ORDER BY created_at;
--
-- 2. FIX corrupted user's wallets:
-- SELECT * FROM fix_wallet_balance(wallet_id) 
-- WHERE wallet_id IN (
--   SELECT id FROM wallets 
--   WHERE user_id = (SELECT user_id FROM deposits WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1')
-- );
--
-- 3. BULK FIX all corrupted wallets:
-- SELECT * FROM fix_all_corrupted_wallets();
--
-- 4. VERIFY fix:
-- SELECT w.id, w.currency_code, w.balance, wba.balance_before, wba.balance_after, wba.created_at
-- FROM wallets w
-- LEFT JOIN wallet_balance_audit wba ON wba.wallet_id = w.id
-- ORDER BY wba.created_at DESC
-- LIMIT 20;
--
-- ============================================================================
