-- ====================================================================
-- FIX: Trigger wallet updates and RLS policy issue
-- ====================================================================

BEGIN;

-- Step 1: Ensure wallet updates are allowed by RLS even from triggers
-- Triggers run as SECURITY DEFINER, so they bypass RLS, but we need to verify
-- that the wallets table has proper policies

-- Check if wallets table has RLS enabled
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Drop old policies to recreate them
DROP POLICY IF EXISTS wallets_select_own ON wallets;
DROP POLICY IF EXISTS wallets_update_own ON wallets;
DROP POLICY IF EXISTS wallets_insert_own ON wallets;

-- Create new RLS policies that allow service_role and owners
CREATE POLICY wallets_select_own ON wallets
  FOR SELECT USING (
    auth.uid() = user_id OR 
    auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY wallets_update_own ON wallets
  FOR UPDATE USING (
    auth.uid() = user_id OR 
    auth.jwt() ->> 'role' = 'service_role'
  )
  WITH CHECK (
    auth.uid() = user_id OR 
    auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY wallets_insert_own ON wallets
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR 
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Step 2: Drop and recreate trigger with corrected status handling
DROP TRIGGER IF EXISTS trigger_deposit_status_change ON deposits;
DROP FUNCTION IF EXISTS handle_deposit_status_change();

-- Step 3: Create improved trigger that handles ALL reversal scenarios
CREATE OR REPLACE FUNCTION handle_deposit_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_wallet_balance_before NUMERIC;
  v_wallet_balance_after NUMERIC;
  v_is_approval BOOLEAN;
  v_is_reversal BOOLEAN;
  v_wallet_exists BOOLEAN;
BEGIN
  -- Approval: pending -> approved/completed
  v_is_approval := (OLD.status = 'pending' AND NEW.status IN ('approved', 'completed'));
  
  -- Reversal: any approved/completed status -> pending/reverted/cancelled/failed
  v_is_reversal := (
    OLD.status IN ('approved', 'completed') AND 
    NEW.status IN ('pending', 'reverted', 'cancelled', 'failed')
  );

  -- Only proceed if wallet exists
  IF NEW.wallet_id IS NOT NULL AND (v_is_approval OR v_is_reversal) THEN
    
    SELECT EXISTS(SELECT 1 FROM wallets WHERE id = NEW.wallet_id)
    INTO v_wallet_exists;

    IF v_wallet_exists THEN
      -- Get current wallet balance BEFORE any changes
      SELECT balance INTO v_wallet_balance_before 
      FROM wallets 
      WHERE id = NEW.wallet_id
      FOR UPDATE; -- Lock row to prevent race conditions

      -- Calculate new balance based on action type
      IF v_is_approval THEN
        -- APPROVAL: Add amount to wallet
        v_wallet_balance_after := v_wallet_balance_before + CAST(NEW.amount AS NUMERIC);
      ELSE
        -- REVERSAL: Subtract amount from wallet
        v_wallet_balance_after := v_wallet_balance_before - CAST(NEW.amount AS NUMERIC);
      END IF;

      -- === CRITICAL: Update wallet balance ===
      UPDATE wallets 
      SET 
        balance = v_wallet_balance_after, 
        updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.wallet_id;

      -- Record in wallet_transactions
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
          ELSE 'Deposit ' || OLD.status || ' -> ' || NEW.status || ': ' || NEW.amount || ' ' || COALESCE(NEW.currency_code, 'PHP')
        END,
        NEW.id,
        jsonb_build_object(
          'old_status', OLD.status,
          'new_status', NEW.status,
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
          WHEN v_is_approval THEN 'Deposit approved'
          ELSE 'Deposit status reverted: ' || OLD.status || ' -> ' || NEW.status
        END,
        'completed',
        CURRENT_TIMESTAMP
      );

      -- If reversal, log in reversal registry
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
          'status_change_to_' || NEW.status,
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
        'Automatic wallet sync: ' || CASE WHEN v_is_approval THEN 'Approved' ELSE 'Reverted' END,
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

-- Step 5: Verify trigger exists
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_deposit_status_change';

COMMIT;

-- ====================================================================
-- MANUAL FIX: For deposits that have already been reverted
-- Run this to retroactively fix wallet balances
-- ====================================================================

-- Query to find deposits that were reverted but wallet wasn't updated
-- SELECT d.id, d.wallet_id, d.amount, w.balance
-- FROM deposits d
-- LEFT JOIN wallet_transactions wt ON d.id = wt.reference_id AND wt.type = 'deposit_reversal'
-- LEFT JOIN wallets w ON d.wallet_id = w.id
-- WHERE d.status IN ('reverted', 'failed', 'cancelled')
-- AND wt.id IS NULL; -- No reversal transaction was recorded

-- If you need to manually fix a deposit reversal, use this pattern:
-- UPDATE wallets 
-- SET balance = balance - <amount>, updated_at = CURRENT_TIMESTAMP
-- WHERE id = '<wallet_id>';
