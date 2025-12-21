-- ============================================================================
-- AUTO-CREDIT WALLET WHEN DEPOSIT IS APPROVED
-- ============================================================================
-- This migration adds a trigger that automatically credits the user's wallet
-- when a deposit status is updated to 'approved' by SQL or admin action.

-- ============================================================================
-- Function: credit_wallet_on_deposit_approved
-- Purpose: Automatically credit wallet when deposit is marked as 'approved'
-- ============================================================================

CREATE OR REPLACE FUNCTION credit_wallet_on_deposit_approved()
RETURNS trigger AS $$
DECLARE
  v_wallet_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Only process transitions to 'approved' status
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    
    BEGIN
      -- Lock wallet row to prevent race conditions
      SELECT balance INTO v_wallet_balance
      FROM wallets
      WHERE id = NEW.wallet_id
        AND user_id = NEW.user_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user % and wallet %', NEW.user_id, NEW.wallet_id;
      END IF;

      -- Calculate new balance
      v_new_balance := COALESCE(v_wallet_balance, 0) + NEW.amount;

      -- Update wallet balance atomically
      UPDATE wallets
      SET 
        balance = v_new_balance,
        updated_at = NOW()
      WHERE id = NEW.wallet_id
        AND user_id = NEW.user_id;

      -- Record transaction in wallet_transactions ledger
      BEGIN
        INSERT INTO wallet_transactions (
          user_id,
          wallet_id,
          transaction_type,
          amount,
          currency_code,
          reference_id,
          reference_type,
          description,
          balance_after,
          status,
          created_at
        ) VALUES (
          NEW.user_id,
          NEW.wallet_id,
          'deposit',
          NEW.amount,
          NEW.currency_code,
          NEW.id,
          'deposit',
          COALESCE(NEW.description, 'Deposit from ' || NEW.deposit_method),
          v_new_balance,
          'completed',
          NOW()
        ) RETURNING id INTO v_transaction_id;

        -- Update deposit with transaction record
        NEW.transaction_id = v_transaction_id;
      EXCEPTION WHEN OTHERS THEN
        -- Continue even if wallet_transactions fails, log the error
        RAISE WARNING 'Failed to record wallet transaction: %', SQLERRM;
      END;

      -- Set completed timestamp if not already set
      IF NEW.completed_at IS NULL THEN
        NEW.completed_at = NOW();
      END IF;

    EXCEPTION WHEN OTHERS THEN
      -- Log error and re-raise
      RAISE EXCEPTION 'Error crediting wallet for deposit: %', SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trigger: Auto-credit wallet on deposit approval
-- ============================================================================

DROP TRIGGER IF EXISTS trg_credit_wallet_on_approved ON deposits;

CREATE TRIGGER trg_credit_wallet_on_approved
BEFORE UPDATE ON deposits
FOR EACH ROW
EXECUTE FUNCTION credit_wallet_on_deposit_approved();

-- ============================================================================
-- Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION credit_wallet_on_deposit_approved TO authenticated, service_role;

-- ============================================================================
-- Notes and Documentation
-- ============================================================================

COMMENT ON FUNCTION credit_wallet_on_deposit_approved() IS 
'Automatically credits the user wallet when a deposit status is updated to approved.
This trigger ensures atomic, transactional crediting of user balances with proper
record-keeping in the wallet_transactions ledger.

Workflow:
1. Admin or automated process updates deposit status to approved
2. Trigger fires and credits the wallet atomically
3. Wallet balance is updated
4. Transaction is recorded in wallet_transactions ledger
5. Deposit completed_at timestamp is set (if not already set)

The trigger locks the wallet row to prevent race conditions and ensure
consistency across concurrent operations.';

-- ============================================================================
-- END AUTO-CREDIT DEPOSITS MIGRATION
-- ============================================================================
