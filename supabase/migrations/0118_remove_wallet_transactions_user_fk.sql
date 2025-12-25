-- ============================================================================
-- FIX: Completely remove wallet_transactions user_id FK constraint
-- ============================================================================
-- Issue: FK constraint still blocks inserts even after migration
-- Root cause: The constraint itself should not exist or should be added with NOT VALID
-- 
-- Solution: Drop the FK constraint completely and keep user_id as nullable
-- This prevents validation failures when users are deleted
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Drop ALL foreign key constraints on user_id
-- ============================================================================

-- Drop by exact name (if it exists from recent migration)
ALTER TABLE IF EXISTS wallet_transactions
DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_fkey;

-- Also try alternate naming patterns that might exist
ALTER TABLE IF EXISTS wallet_transactions
DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_fk;

-- Drop any other user_id constraints
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'wallet_transactions'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%user%'
  LOOP
    EXECUTE 'ALTER TABLE wallet_transactions DROP CONSTRAINT ' || quote_ident(constraint_record.constraint_name);
    RAISE NOTICE 'Dropped constraint: %', constraint_record.constraint_name;
  END LOOP;
END $$;

-- ============================================================================
-- Step 2: Ensure user_id column exists and is nullable
-- ============================================================================

ALTER TABLE IF EXISTS wallet_transactions
ALTER COLUMN user_id DROP NOT NULL;

-- ============================================================================
-- Step 3: Add helpful comments
-- ============================================================================

COMMENT ON COLUMN wallet_transactions.user_id IS 
'User who owns the wallet transaction. May be NULL if user account was deleted. No foreign key constraint enforced.';

-- ============================================================================
-- Step 4: Fix the record_ledger_transaction function
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
BEGIN
  -- Lock wallet row and get balance
  SELECT balance
  INTO v_balance_before
  FROM wallets
  WHERE id = p_wallet_id
  FOR UPDATE;

  IF v_balance_before IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  -- Calculate balance based on transaction type
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
    RAISE EXCEPTION
      'Insufficient balance. Current: %, Attempted: %',
      v_balance_before,
      p_amount;
  END IF;

  -- Update wallet balance
  UPDATE wallets
  SET
    balance = v_balance_after,
    updated_at = NOW()
  WHERE id = p_wallet_id;

  -- Insert transaction (user_id stored as-is, no FK validation)
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
    p_user_id,
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
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION record_ledger_transaction(
  uuid,
  uuid,
  text,
  numeric,
  text,
  uuid,
  jsonb,
  text
) IS
$$Records a ledger transaction for a wallet without FK constraint validation.

BEHAVIOR:
- Records transaction with the provided user_id (even if user doesn't exist)
- Safely handles deleted users without blocking transaction recording
- No foreign key constraint enforced on user_id

PARAMETERS:
- p_wallet_id: ID of wallet being modified (required, must exist in wallets)
- p_user_id: ID of user (may be NULL or non-existent)
- p_type: transaction type (deposit_approved, withdrawal, etc.)
- p_amount: amount being transferred
- p_note: optional note
- p_reference_id: optional reference (deposit, payment, etc.)
- p_metadata: optional JSONB metadata
- p_description: optional human-readable description

RETURNS: UUID of newly created wallet_transactions row
$$;

COMMIT;

-- ============================================================================
-- Verification queries (run after migration completes)
-- ============================================================================
-- Check if FK constraint was removed:
-- SELECT constraint_name FROM information_schema.table_constraints 
-- WHERE table_name = 'wallet_transactions' AND constraint_type = 'FOREIGN KEY';
-- 
-- Should return: (no rows)
--
-- Check if user_id column is nullable:
-- SELECT is_nullable FROM information_schema.columns 
-- WHERE table_name = 'wallet_transactions' AND column_name = 'user_id';
-- 
-- Should return: YES
--
-- Test deposit approval:
-- UPDATE deposits SET status = 'approved' WHERE status = 'pending' LIMIT 1;
-- ============================================================================
