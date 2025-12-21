-- ====================================================================
-- ADD DELETE TRIGGER: Real-time wallet sync when deposits are deleted
-- Ensures wallet.balance = SUM(approved deposits) even after deletes
-- ====================================================================

BEGIN;

-- Step 1: Create DELETE trigger function
CREATE OR REPLACE FUNCTION sync_wallet_balance_on_deposit_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_approved_total NUMERIC;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
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
    
    -- Update wallet with exact approved sum
    UPDATE wallets
    SET 
      balance = v_new_balance,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.wallet_id;

    -- Record transaction for this change
    INSERT INTO wallet_transactions (
      wallet_id,
      type,
      amount,
      balance_before,
      balance_after,
      description,
      reference_id,
      metadata,
      created_at
    ) VALUES (
      OLD.wallet_id,
      'balance_sync_on_delete',
      v_new_balance - COALESCE(v_current_balance, 0),
      v_current_balance,
      v_new_balance,
      'Wallet synced after deposit deletion: ' || OLD.amount || ' ' || COALESCE(OLD.currency_code, 'PHP'),
      OLD.id,
      jsonb_build_object(
        'sync_type', 'deposit_deleted',
        'deleted_deposit_id', OLD.id,
        'deleted_amount', OLD.amount,
        'deleted_status', OLD.status,
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

-- Step 2: Create DELETE trigger
DROP TRIGGER IF EXISTS trigger_deposit_delete ON deposits;

CREATE TRIGGER trigger_deposit_delete
AFTER DELETE ON deposits
FOR EACH ROW
EXECUTE FUNCTION sync_wallet_balance_on_deposit_delete();

-- Step 3: Verify both triggers exist
SELECT trigger_name, event_object_table, event_manipulation
FROM information_schema.triggers 
WHERE trigger_name IN ('trigger_deposit_status_change', 'trigger_deposit_delete')
ORDER BY trigger_name;

COMMIT;

-- ====================================================================
-- NOW WE HAVE:
-- 1. UPDATE trigger: Updates wallet when deposit status changes
-- 2. DELETE trigger: Updates wallet when deposit is deleted
-- 3. Both calculate: wallet.balance = SUM(deposits WHERE status='approved')
-- ====================================================================

-- Test the DELETE trigger:
-- 1. Check current wallet balance
-- SELECT id, balance FROM wallets LIMIT 1;

-- 2. Delete a deposit
-- DELETE FROM deposits WHERE wallet_id = '<wallet_id>' LIMIT 1;

-- 3. Wallet balance should INSTANTLY reflect the deletion
-- SELECT id, balance FROM wallets WHERE id = '<wallet_id>';

-- 4. Check transaction log
-- SELECT * FROM wallet_transactions 
-- WHERE wallet_id = '<wallet_id>' 
-- ORDER BY created_at DESC LIMIT 5;
