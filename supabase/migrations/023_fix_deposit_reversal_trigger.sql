-- ====================================================================
-- FIX: Deposit Reversal Trigger - Ensure proper handling when status reverts
-- ====================================================================

BEGIN;

-- Step 1: Ensure required columns exist in deposits table
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS reversal_reason TEXT;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

-- Step 2: Drop existing trigger to recreate it cleanly
DROP TRIGGER IF EXISTS trigger_deposit_status_change ON deposits;
DROP FUNCTION IF EXISTS handle_deposit_status_change();

-- Step 3: Create improved trigger function with better error handling
CREATE OR REPLACE FUNCTION handle_deposit_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_wallet_balance_before NUMERIC;
  v_wallet_balance_after NUMERIC;
  v_is_approval BOOLEAN;
  v_is_reversal BOOLEAN;
  v_wallet_exists BOOLEAN;
BEGIN
  -- Determine if this is an approval (pending -> approved/completed)
  -- or a reversal (approved/completed -> pending)
  v_is_approval := (OLD.status = 'pending' AND NEW.status IN ('approved', 'completed'));
  v_is_reversal := (OLD.status IN ('approved', 'completed') AND NEW.status = 'pending');

  -- Only proceed if status changed and wallet exists
  IF (v_is_approval OR v_is_reversal) AND NEW.wallet_id IS NOT NULL THEN
    
    -- Check if wallet exists
    SELECT EXISTS(SELECT 1 FROM wallets WHERE id = NEW.wallet_id)
    INTO v_wallet_exists;

    IF v_wallet_exists THEN
      -- Get current wallet balance
      SELECT balance INTO v_wallet_balance_before 
      FROM wallets 
      WHERE id = NEW.wallet_id;

      -- Calculate new balance
      IF v_is_approval THEN
        -- Approval: Credit the wallet (+amount)
        v_wallet_balance_after := v_wallet_balance_before + CAST(NEW.amount AS NUMERIC);
      ELSE
        -- Reversal: Debit the wallet (-amount)
        v_wallet_balance_after := v_wallet_balance_before - CAST(NEW.amount AS NUMERIC);
      END IF;

      -- Update wallet balance
      UPDATE wallets 
      SET balance = v_wallet_balance_after, updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.wallet_id;

      -- Record wallet transaction
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
        NEW.wallet_id,
        CASE WHEN v_is_approval THEN 'deposit' ELSE 'deposit_reversal' END,
        CASE WHEN v_is_approval THEN CAST(NEW.amount AS NUMERIC) ELSE -CAST(NEW.amount AS NUMERIC) END,
        v_wallet_balance_before,
        v_wallet_balance_after,
        CASE 
          WHEN v_is_approval THEN 'Deposit approved: ' || NEW.amount || ' ' || COALESCE(NEW.currency_code, 'PHP')
          ELSE 'Deposit reverted to pending: ' || NEW.amount || ' ' || COALESCE(NEW.currency_code, 'PHP')
        END,
        NEW.id,
        jsonb_build_object(
          'status_change', OLD.status || ' -> ' || NEW.status,
          'currency', NEW.currency_code,
          'deposit_method', NEW.deposit_method
        ),
        CURRENT_TIMESTAMP
      );

      -- Record reconciliation
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
        NEW.wallet_id,
        NEW.user_id,
        v_wallet_balance_before,
        v_wallet_balance_after,
        CASE WHEN v_is_approval THEN 'deposit_approval' ELSE 'deposit_reversal' END,
        CASE 
          WHEN v_is_approval THEN 'Automatic deposit approval'
          ELSE 'Automatic deposit reversal to pending'
        END,
        'completed',
        CURRENT_TIMESTAMP
      );

      -- If reversal, create reversal registry entry
      IF v_is_reversal THEN
        INSERT INTO deposit_reversal_registry (
          original_deposit_id,
          reason,
          reversed_by,
          original_balance,
          reversal_balance,
          status,
          created_at
        ) VALUES (
          NEW.id,
          'manual_status_change_to_pending',
          COALESCE(NEW.approved_by, '00000000-0000-0000-0000-000000000000'::UUID),
          v_wallet_balance_before,
          v_wallet_balance_after,
          'active',
          CURRENT_TIMESTAMP
        );
      END IF;

      -- Record status history
      INSERT INTO deposit_status_history (
        deposit_id,
        user_id,
        old_status,
        new_status,
        changed_by,
        reason,
        created_at
      ) VALUES (
        NEW.id,
        NEW.user_id,
        OLD.status,
        NEW.status,
        COALESCE(NEW.approved_by, '00000000-0000-0000-0000-000000000000'::UUID),
        'Automatic wallet balance adjustment',
        CURRENT_TIMESTAMP
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 4: Recreate trigger
CREATE TRIGGER trigger_deposit_status_change
AFTER UPDATE ON deposits
FOR EACH ROW
EXECUTE FUNCTION handle_deposit_status_change();

-- Step 5: Verify trigger was created
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_deposit_status_change';

COMMIT;

-- Diagnostic queries to verify everything works
-- Run these AFTER making a test deposit status change:
-- SELECT * FROM wallets WHERE id = '<wallet_id>' ORDER BY updated_at DESC LIMIT 1;
-- SELECT * FROM wallet_transactions WHERE reference_id = '<deposit_id>' ORDER BY created_at DESC;
-- SELECT * FROM deposit_reversal_registry WHERE original_deposit_id = '<deposit_id>';
-- SELECT * FROM deposit_status_history WHERE deposit_id = '<deposit_id>' ORDER BY created_at DESC;
