-- Trigger function to automatically handle deposit status changes
-- This ensures wallet balances are updated whenever deposit status changes,
-- regardless of whether the change comes from the app, API, or direct SQL

CREATE OR REPLACE FUNCTION handle_deposit_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_wallet_balance_before NUMERIC;
  v_wallet_balance_after NUMERIC;
  v_is_approval BOOLEAN;
  v_is_reversal BOOLEAN;
BEGIN
  -- Determine if this is an approval (pending -> approved/completed)
  -- or a reversal (approved/completed -> pending)
  v_is_approval := (OLD.status = 'pending' AND NEW.status IN ('approved', 'completed'));
  v_is_reversal := ((OLD.status IN ('approved', 'completed') AND NEW.status = 'pending') OR
                    (OLD.status = 'completed' AND NEW.status = 'approved'));

  -- Only proceed if status actually changed to a relevant state
  IF v_is_approval OR v_is_reversal THEN
    -- Get current wallet balance
    SELECT balance INTO v_wallet_balance_before 
    FROM wallets 
    WHERE id = NEW.wallet_id;

    IF v_wallet_balance_before IS NOT NULL THEN
      -- Calculate new balance
      IF v_is_approval THEN
        -- Approval: Credit the wallet
        v_wallet_balance_after := v_wallet_balance_before + CAST(NEW.amount AS NUMERIC);
      ELSE
        -- Reversal: Debit the wallet
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
        created_at
      ) VALUES (
        NEW.wallet_id,
        CASE WHEN v_is_approval THEN 'deposit' ELSE 'deposit_reversal' END,
        CASE WHEN v_is_approval THEN CAST(NEW.amount AS NUMERIC) ELSE -CAST(NEW.amount AS NUMERIC) END,
        v_wallet_balance_before,
        v_wallet_balance_after,
        CASE 
          WHEN v_is_approval THEN 'Deposit approved: ' || NEW.amount || ' ' || COALESCE(NEW.currency_code, 'PHP')
          ELSE 'Deposit reverted: ' || NEW.amount || ' ' || COALESCE(NEW.currency_code, 'PHP')
        END,
        NEW.id,
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
          ELSE 'Automatic deposit reversal'
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
          'automatic_status_change',
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
        'Automatic status change',
        CURRENT_TIMESTAMP
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on deposits table
DROP TRIGGER IF EXISTS trigger_deposit_status_change ON deposits;

CREATE TRIGGER trigger_deposit_status_change
AFTER UPDATE ON deposits
FOR EACH ROW
EXECUTE FUNCTION handle_deposit_status_change();
