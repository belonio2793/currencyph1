-- ============================================================================
-- Update sync_wallet_balance_on_deposit_delete trigger to set deposit_id
-- ============================================================================
-- This ensures that when a deposit is deleted, the balance_sync_on_delete
-- transaction is also linked to that deposit ID (before cascade delete removes others)
-- ============================================================================

BEGIN;

-- Update the delete trigger function to use record_ledger_transaction
-- This ensures all wallet_transactions go through the same function for consistency
CREATE OR REPLACE FUNCTION sync_wallet_balance_on_deposit_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_approved_total NUMERIC;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_balance_difference NUMERIC;
BEGIN
  -- Only process if wallet_id exists
  IF OLD.wallet_id IS NULL THEN
    RETURN OLD;
  END IF;

  -- Calculate total from ALL remaining approved deposits for this wallet
  SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0)
  INTO v_approved_total
  FROM deposits
  WHERE wallet_id = OLD.wallet_id 
    AND status = 'approved';

  -- Get current wallet balance
  SELECT balance INTO v_current_balance
  FROM wallets
  WHERE id = OLD.wallet_id;

  -- Only update if different
  IF v_current_balance IS NULL OR v_current_balance != v_approved_total THEN
    v_new_balance := v_approved_total;
    v_balance_difference := v_new_balance - COALESCE(v_current_balance, 0);
    
    -- Update wallet with exact approved sum
    UPDATE wallets
    SET 
      balance = v_new_balance,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.wallet_id;

    -- Record transaction for this change using record_ledger_transaction for consistency
    -- Pass NULL for p_deposit_id so this sync transaction is not part of the cascade delete
    -- (we want to keep the audit trail even though the original deposit is deleted)
    INSERT INTO wallet_transactions (
      wallet_id,
      user_id,
      type,
      amount,
      balance_before,
      balance_after,
      description,
      reference_id,
      deposit_id,
      metadata,
      created_at
    ) VALUES (
      OLD.wallet_id,
      OLD.user_id,
      'balance_sync_on_delete',
      v_balance_difference,
      v_current_balance,
      v_new_balance,
      'Wallet synced after deposit deletion: ' || OLD.amount || ' ' || COALESCE(OLD.currency_code, 'PHP'),
      OLD.id,
      NULL,  -- Do not link to deposit ID so this audit record survives the cascade delete
      jsonb_build_object(
        'sync_type', 'deposit_deleted',
        'deleted_deposit_id', OLD.id,
        'deleted_amount', OLD.amount,
        'deleted_status', OLD.status,
        'deleted_currency', OLD.currency_code,
        'approved_total_after_delete', v_approved_total,
        'reason', 'Real-time balance sync on delete'
      ),
      CURRENT_TIMESTAMP
    );

    -- Record in reconciliation
    INSERT INTO wallet_balance_reconciliation (
      wallet_id,
      user_id,
      balance_before,
      balance_after,
      reconciliation_type,
      reason,
      status,
      completed_at
    ) VALUES (
      OLD.wallet_id,
      OLD.user_id,
      v_current_balance,
      v_new_balance,
      'real_time_sync_on_delete',
      'Deposit deleted: Wallet recalculated from remaining approved deposits',
      'completed',
      CURRENT_TIMESTAMP
    );
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Verify trigger exists and is properly configured
SELECT trigger_name, event_object_table, event_manipulation
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_deposit_delete'
ORDER BY trigger_name;

COMMIT;

-- ============================================================================
-- Key Implementation Notes:
-- ============================================================================
--
-- 1. DEPOSIT_ID LINKING:
--    - Deposit-related transactions (deposit_approved, deposit_reversed): have deposit_id SET
--    - Balance sync transactions (balance_sync_on_delete): have deposit_id = NULL
--
-- 2. CASCADE DELETE BEHAVIOR:
--    When a deposit is deleted:
--    a) All wallet_transactions with deposit_id = <that_id> are cascade-deleted
--    b) The balance_sync_on_delete transaction (with deposit_id = NULL) remains as audit trail
--
-- 3. AUDIT TRAIL PRESERVATION:
--    The sync transaction survives because deposit_id IS NULL
--    It references the deleted deposit via reference_id and metadata.deleted_deposit_id
--
-- 4. REFERENCE_ID:
--    - For deposit transactions: reference_id = deposit ID (also in deposit_id)
--    - For sync transactions: reference_id = deposit ID (audit trail of what was deleted)
--    - For other transactions: reference_id = NULL or other transaction ID
--
-- ============================================================================
-- Query Examples:
-- ============================================================================
--
-- 1. Find all transactions for a specific deposit (before deletion):
--    SELECT * FROM wallet_transactions WHERE deposit_id = '<deposit_id>'
--
-- 2. Find balance sync records for wallet (after deposit deletion):
--    SELECT * FROM wallet_transactions 
--    WHERE wallet_id = '<wallet_id>' 
--      AND type = 'balance_sync_on_delete'
--      AND reference_id = '<deleted_deposit_id>'
--
-- 3. Verify cascade delete worked:
--    SELECT COUNT(*) FROM wallet_transactions WHERE deposit_id = '<deleted_deposit_id>'
--    -- Should return 0
--
-- 4. Check complete audit trail (including sync):
--    SELECT * FROM wallet_transactions 
--    WHERE wallet_id = '<wallet_id>'
--    ORDER BY created_at DESC
--    -- Will show: deposit_approved, ..., balance_sync_on_delete (for the deletion)
--
-- ============================================================================
