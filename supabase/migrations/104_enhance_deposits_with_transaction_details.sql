-- ============================================================================
-- ENHANCE DEPOSITS TABLE WITH TRANSACTION DETAILS
-- ============================================================================
-- This migration adds structured transaction detail fields to the deposits table
-- to improve tracking, debugging, and display of deposit information.

-- ============================================================================
-- Add transaction_details JSONB column
-- ============================================================================

ALTER TABLE deposits
ADD COLUMN IF NOT EXISTS transaction_details JSONB DEFAULT '{}'::jsonb;

-- ============================================================================
-- Add exchange_rate and received_amount columns for clarity
-- ============================================================================

ALTER TABLE deposits
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18, 8),
ADD COLUMN IF NOT EXISTS received_amount NUMERIC(36, 8);

-- ============================================================================
-- Add reference_number column (if not already exists)
-- ============================================================================

ALTER TABLE deposits
ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100);

-- ============================================================================
-- Create an AFTER UPDATE trigger to record transaction details
-- ============================================================================

CREATE OR REPLACE FUNCTION record_deposit_transaction_details()
RETURNS trigger AS $$
DECLARE
  v_notes JSONB;
  v_exchange_rate NUMERIC;
  v_received_amount NUMERIC;
BEGIN
  -- Only process when deposit transitions to 'approved' or 'completed'
  IF (NEW.status = 'approved' OR NEW.status = 'completed') 
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- Extract metadata from notes JSON
    IF NEW.notes IS NOT NULL THEN
      v_notes := NEW.notes::jsonb;
      
      -- Extract exchange rate and calculate received amount
      IF v_notes ? 'converted_amount' THEN
        v_received_amount := (v_notes->>'converted_amount')::NUMERIC;
        NEW.received_amount = v_received_amount;
        
        -- Calculate exchange rate
        IF NEW.amount > 0 THEN
          v_exchange_rate := v_received_amount / NEW.amount;
          NEW.exchange_rate = v_exchange_rate;
        END IF;
      END IF;
      
      -- Build comprehensive transaction details
      NEW.transaction_details := jsonb_build_object(
        'original_amount', NEW.amount,
        'original_currency', v_notes->>'original_currency',
        'received_amount', v_received_amount,
        'received_currency', v_notes->>'wallet_currency',
        'exchange_rate', v_exchange_rate,
        'conversion_rate_percentage', CASE 
          WHEN v_exchange_rate IS NOT NULL AND v_exchange_rate > 0 
          THEN ROUND((v_exchange_rate - 1) * 100, 2) 
          ELSE NULL 
        END,
        'deposit_method', NEW.deposit_method,
        'deposit_type', v_notes->>'deposit_type',
        'network', v_notes->>'network',
        'transaction_id', NEW.transaction_id::text,
        'external_tx_id', NEW.external_tx_id,
        'reference_number', COALESCE(NEW.reference_number, NEW.phone_number),
        'created_at', NEW.created_at::text,
        'approved_at', CASE 
          WHEN NEW.status = 'approved' THEN NOW()::text 
          ELSE NULL 
        END,
        'completed_at', NEW.completed_at::text,
        'status', NEW.status
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_record_deposit_transaction_details ON deposits;

CREATE TRIGGER trg_record_deposit_transaction_details
BEFORE UPDATE ON deposits
FOR EACH ROW
EXECUTE FUNCTION record_deposit_transaction_details();

-- ============================================================================
-- Fix: Ensure wallet crediting also happens for 'completed' status
-- ============================================================================

CREATE OR REPLACE FUNCTION credit_wallet_on_deposit_approval()
RETURNS trigger AS $$
DECLARE
  v_wallet_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
  v_received_amount NUMERIC;
BEGIN
  -- Process transitions to 'approved' or 'completed' status
  IF (NEW.status = 'approved' OR NEW.status = 'completed') 
     AND OLD.status IS DISTINCT FROM NEW.status 
     AND OLD.status NOT IN ('approved', 'completed') THEN
    
    BEGIN
      -- Use received_amount if available, otherwise use amount
      v_received_amount := COALESCE(NEW.received_amount, NEW.amount);
      
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
      v_new_balance := COALESCE(v_wallet_balance, 0) + v_received_amount;

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
          v_received_amount,
          NEW.currency_code,
          NEW.id,
          'deposit',
          COALESCE(NEW.description, 'Deposit from ' || NEW.deposit_method || ' (converted: ' || v_received_amount || ' ' || NEW.currency_code || ')'),
          v_new_balance,
          'completed',
          NOW()
        ) RETURNING id INTO v_transaction_id;

        -- Update deposit with transaction record
        NEW.transaction_id = v_transaction_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to record wallet transaction: %', SQLERRM;
      END;

      -- Set completed timestamp if not already set
      IF NEW.completed_at IS NULL THEN
        NEW.completed_at = NOW();
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Error crediting wallet for deposit: %', SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_credit_wallet_on_approved ON deposits;

CREATE TRIGGER trg_credit_wallet_on_approved
BEFORE UPDATE ON deposits
FOR EACH ROW
EXECUTE FUNCTION credit_wallet_on_deposit_approval();

-- ============================================================================
-- Create view for deposits with all transaction details
-- ============================================================================

CREATE OR REPLACE VIEW deposits_with_details AS
SELECT 
  d.id,
  d.user_id,
  d.wallet_id,
  w.currency_code,
  w.currency_name,
  d.amount,
  d.received_amount,
  d.exchange_rate,
  d.deposit_method,
  d.reference_number,
  d.phone_number,
  d.status,
  d.description,
  d.notes,
  d.transaction_details,
  d.created_at,
  d.updated_at,
  d.completed_at,
  d.transaction_id,
  d.external_tx_id
FROM deposits d
JOIN wallets w ON d.wallet_id = w.id;

-- ============================================================================
-- Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION record_deposit_transaction_details TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION credit_wallet_on_deposit_approval TO authenticated, service_role;

-- ============================================================================
-- END ENHANCEMENT MIGRATION
-- ============================================================================
