-- ============================================================================
-- FIX: wallet_transactions user_id foreign key constraint violation
-- ============================================================================
-- Issue: "Key (user_id) is not present in table users"
-- Cause: Deposits reference deleted users or orphaned data
-- 
-- Solution:
-- 1. Make user_id nullable in wallet_transactions
-- 2. Update record_ledger_transaction to check if user exists before inserting
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Drop the existing foreign key constraint if it exists
-- ============================================================================

ALTER TABLE IF EXISTS wallet_transactions
DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_fkey;

-- ============================================================================
-- Step 2: Make user_id nullable and add back the FK constraint as optional
-- ============================================================================

ALTER TABLE IF EXISTS wallet_transactions
ALTER COLUMN user_id DROP NOT NULL;

-- Add back the foreign key with ON DELETE SET NULL to allow orphaned records
ALTER TABLE IF EXISTS wallet_transactions
ADD CONSTRAINT wallet_transactions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
DEFERRABLE INITIALLY DEFERRED;

-- ============================================================================
-- Step 3: Update record_ledger_transaction to handle missing users
-- ============================================================================

CREATE OR REPLACE FUNCTION record_ledger_transaction(
  p_wallet_id UUID,
  p_user_id UUID,
  p_type TEXT,
  p_amount NUMERIC,
  p_note TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_description TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
  v_transaction_id UUID;
  v_user_exists BOOLEAN;
BEGIN
  -- Get current wallet balance
  SELECT balance INTO v_balance_before 
  FROM wallets 
  WHERE id = p_wallet_id 
  FOR UPDATE;
  
  IF v_balance_before IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  -- Check if user exists (it may have been deleted but deposit still exists)
  SELECT EXISTS(SELECT 1 FROM users WHERE id = p_user_id)
  INTO v_user_exists;

  -- Calculate new balance based on transaction type
  CASE p_type
    WHEN 'deposit_pending', 'deposit_approved', 'transfer_in', 'refund' THEN
      v_balance_after := v_balance_before + p_amount;
    WHEN 'deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee' THEN
      v_balance_after := v_balance_before - p_amount;
    WHEN 'adjustment' THEN
      v_balance_after := v_balance_before + p_amount;
    ELSE
      RAISE EXCEPTION 'Invalid transaction type: %', p_type;
  END CASE;

  -- Prevent negative balance (except adjustments)
  IF v_balance_after < 0 AND p_type NOT IN ('adjustment') THEN
    RAISE EXCEPTION 'Insufficient balance. Current: %, Attempted: %', v_balance_before, p_amount;
  END IF;

  -- Update wallet balance
  UPDATE wallets
  SET 
    balance = v_balance_after,
    updated_at = NOW()
  WHERE id = p_wallet_id;

  -- Record transaction (user_id can be NULL if user was deleted)
  INSERT INTO wallet_transactions (
    wallet_id,
    user_id,
    type,
    amount,
    balance_before,
    balance_after,
    currency_code,
    description,
    note,
    status,
    reference_id,
    metadata,
    created_at
  ) VALUES (
    p_wallet_id,
    CASE WHEN v_user_exists THEN p_user_id ELSE NULL END,
    p_type,
    p_amount,
    v_balance_before,
    v_balance_after,
    (SELECT currency_code FROM wallets WHERE id = p_wallet_id),
    p_description,
    p_note,
    CASE 
      WHEN p_type LIKE 'deposit_%' THEN 
        CASE 
          WHEN p_type = 'deposit_pending' THEN 'pending'
          WHEN p_type = 'deposit_approved' THEN 'approved'
          WHEN p_type = 'deposit_rejected' THEN 'rejected'
          WHEN p_type = 'deposit_reversed' THEN 'reversed'
          ELSE 'pending'
        END
      ELSE 'completed'
    END,
    p_reference_id,
    p_metadata,
    NOW()
  ) RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 4: Add helpful comments
-- ============================================================================

COMMENT ON COLUMN wallet_transactions.user_id IS 
'User who owns the wallet transaction. May be NULL if user account was deleted.';

COMMENT ON FUNCTION record_ledger_transaction(uuid,uuid,text,numeric,text,uuid,jsonb,text) IS
'Records a ledger transaction for a wallet.

BEHAVIOR:
- If the user exists: records transaction with user_id
- If the user doesn't exist: records transaction with NULL user_id (allows orphaned deposits)
- Safely handles deleted users without blocking transaction recording

PARAMETERS:
- p_wallet_id: ID of wallet being modified
- p_user_id: ID of user (may not exist in users table)
- p_type: transaction type (deposit_approved, withdrawal, etc.)
- p_amount: amount being transferred
- p_note: optional note about transaction
- p_reference_id: optional reference to deposits, payments, etc.
- p_metadata: optional JSONB metadata
- p_description: optional human-readable description

RETURNS: UUID of newly created transaction record
';

COMMIT;

-- ============================================================================
-- Diagnostic queries (run after applying migration):
-- ============================================================================
-- Check for orphaned wallet transactions (user_id is NULL):
-- SELECT COUNT(*) as orphaned_transactions 
-- FROM wallet_transactions 
-- WHERE user_id IS NULL;
--
-- Check for orphaned deposits (user doesn't exist):
-- SELECT d.id, d.user_id, d.amount, d.currency_code, d.status
-- FROM deposits d
-- LEFT JOIN users u ON d.user_id = u.id
-- WHERE u.id IS NULL;
-- ============================================================================
