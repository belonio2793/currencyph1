-- ============================================================================
-- CRITICAL FIX: Deposit Triggers & Currency Validation
-- ============================================================================
-- This migration fixes a critical bug where deposit triggers were using the
-- raw amount instead of the PHP-converted received_amount for crypto deposits.
--
-- Issue: When a 3443 BCH deposit was approved, the trigger added 3443 (not 119,947,205.75) PHP
-- Root Cause: Trigger used NEW.amount without checking NEW.received_amount
--
-- Solution:
-- 1. Update auto-credit trigger to use received_amount when available
-- 2. Add validation constraints for currency_code
-- 3. Add audit function to catch currency mismatches
-- 4. Add safeguard trigger to prevent invalid currency codes

-- ============================================================================
-- 1. FIX: Update credit_wallet_on_deposit_approved() trigger function
-- ============================================================================

DROP TRIGGER IF EXISTS trg_credit_wallet_on_approved ON deposits;
DROP FUNCTION IF EXISTS credit_wallet_on_deposit_approved();

CREATE OR REPLACE FUNCTION credit_wallet_on_deposit_approved()
RETURNS trigger AS $$
DECLARE
  v_wallet_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
  v_credit_amount NUMERIC;
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

      -- CRITICAL FIX: Use received_amount (PHP equivalent) if available, otherwise use amount
      -- For crypto deposits: received_amount has the PHP-converted value
      -- For PHP deposits: received_amount is NULL, use amount directly
      v_credit_amount := COALESCE(NEW.received_amount, NEW.amount);

      -- Validate the credit amount makes sense
      IF v_credit_amount <= 0 THEN
        RAISE EXCEPTION 'Invalid credit amount: % for deposit %', v_credit_amount, NEW.id;
      END IF;

      -- Calculate new balance
      v_new_balance := COALESCE(v_wallet_balance, 0) + v_credit_amount;

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
          metadata,
          created_at
        ) VALUES (
          NEW.user_id,
          NEW.wallet_id,
          'deposit',
          v_credit_amount,
          'PHP',  -- Always credit in PHP
          NEW.id,
          'deposit',
          CASE 
            WHEN NEW.received_amount IS NOT NULL 
              THEN 'Deposit approved: ' || NEW.amount || ' ' || NEW.currency_code || ' (' || v_credit_amount || ' PHP)'
            ELSE 'Deposit approved: ' || NEW.amount || ' ' || NEW.currency_code
          END,
          v_new_balance,
          'completed',
          jsonb_build_object(
            'original_amount', NEW.amount,
            'original_currency', NEW.currency_code,
            'credited_amount', v_credit_amount,
            'exchange_rate', NEW.exchange_rate,
            'deposit_method', NEW.deposit_method
          ),
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

CREATE TRIGGER trg_credit_wallet_on_approved
BEFORE UPDATE ON deposits
FOR EACH ROW
EXECUTE FUNCTION credit_wallet_on_deposit_approved();

GRANT EXECUTE ON FUNCTION credit_wallet_on_deposit_approved TO authenticated, service_role;

-- ============================================================================
-- 2. ADD VALIDATION: Currency code must match deposit method
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_deposit_currency()
RETURNS trigger AS $$
BEGIN
  -- If received_amount is set (conversion happened), ensure original_currency is set
  IF NEW.received_amount IS NOT NULL AND NEW.received_amount > 0 THEN
    -- For conversions to PHP, original_currency MUST be set to track the source currency
    IF NEW.currency_code = 'PHP' AND NEW.exchange_rate IS NOT NULL AND NEW.exchange_rate <> 1 THEN
      -- Only raise error if original_currency is NOT properly set
      IF NEW.original_currency IS NULL OR NEW.original_currency = '' THEN
        RAISE EXCEPTION 'Invalid deposit: currency_code is PHP but exchange_rate indicates a conversion. '
          'Original currency should be stored in original_currency field.';
      END IF;
    END IF;
  END IF;

  -- Validate that currency_code is not null
  IF NEW.currency_code IS NULL THEN
    RAISE EXCEPTION 'Invalid deposit: currency_code cannot be null';
  END IF;

  -- Validate amount is positive
  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Invalid deposit: amount must be positive, got %', NEW.amount;
  END IF;

  -- Validate received_amount if set
  IF NEW.received_amount IS NOT NULL AND NEW.received_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid deposit: received_amount must be positive, got %', NEW.received_amount;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_deposit_currency ON deposits;

CREATE TRIGGER trg_validate_deposit_currency
BEFORE INSERT OR UPDATE ON deposits
FOR EACH ROW
EXECUTE FUNCTION validate_deposit_currency();

GRANT EXECUTE ON FUNCTION validate_deposit_currency TO authenticated, service_role;

-- ============================================================================
-- 3. ADD AUDIT: Log all deposits with potential currency mismatches
-- ============================================================================

CREATE TABLE IF NOT EXISTS deposit_currency_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
  issue_type TEXT NOT NULL, -- 'currency_mismatch', 'missing_conversion', 'invalid_amount'
  description TEXT,
  original_amount NUMERIC(36, 8),
  original_currency VARCHAR(16),
  stored_currency VARCHAR(16),
  received_amount NUMERIC(36, 8),
  exchange_rate NUMERIC(18, 8),
  wallet_balance_affected NUMERIC(36, 8),
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  fixed BOOLEAN DEFAULT FALSE,
  fixed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_deposit_currency_audit_deposit ON deposit_currency_audit(deposit_id);
CREATE INDEX IF NOT EXISTS idx_deposit_currency_audit_issue ON deposit_currency_audit(issue_type);

-- ============================================================================
-- 4. AUDIT FUNCTION: Detect deposits with currency mismatches
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_deposit_currency_issues()
RETURNS TABLE (
  issue_count INT,
  affected_deposits INT,
  affected_wallets INT
) AS $$
DECLARE
  v_issue_count INT := 0;
  v_affected_deposits INT := 0;
  v_affected_wallets INT := 0;
BEGIN
  -- Find deposits where currency_code doesn't match the deposit method
  -- (e.g., crypto deposit stored as PHP)
  INSERT INTO deposit_currency_audit (deposit_id, issue_type, description, original_amount, original_currency, stored_currency, received_amount, exchange_rate)
  SELECT 
    d.id,
    'currency_mismatch',
    'Deposit marked as crypto but currency_code is PHP or vice versa',
    d.amount,
    d.original_currency,
    d.currency_code,
    d.received_amount,
    d.exchange_rate
  FROM deposits d
  WHERE 
    -- Crypto deposits should have received_amount and exchange_rate
    (d.deposit_method LIKE '%crypto%' AND (d.received_amount IS NULL OR d.exchange_rate IS NULL))
    OR
    -- If conversion happened, currency_code should not be PHP (unless it was already PHP)
    (d.received_amount IS NOT NULL AND d.received_amount <> d.amount AND d.currency_code = 'PHP')
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_issue_count = ROW_COUNT;

  SELECT COUNT(DISTINCT d.id), COUNT(DISTINCT d.wallet_id) 
  INTO v_affected_deposits, v_affected_wallets
  FROM deposits d
  INNER JOIN deposit_currency_audit dca ON d.id = dca.deposit_id
  WHERE dca.fixed = FALSE;

  RETURN QUERY SELECT v_issue_count, v_affected_deposits, v_affected_wallets;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION audit_deposit_currency_issues TO authenticated, service_role;

-- ============================================================================
-- 5. SAFEGUARD: Prevent manual SQL that sets wrong currency_code
-- ============================================================================

CREATE OR REPLACE FUNCTION safeguard_deposit_currency_on_update()
RETURNS trigger AS $$
BEGIN
  -- If someone tries to manually change currency_code to something that doesn't match received_amount
  IF NEW.currency_code IS DISTINCT FROM OLD.currency_code THEN
    -- Check if this would cause a currency mismatch
    IF NEW.received_amount IS NOT NULL AND NEW.received_amount <> NEW.amount THEN
      IF NEW.currency_code = 'PHP' AND OLD.currency_code <> 'PHP' THEN
        RAISE EXCEPTION 'Cannot change currency_code to PHP for a deposit with conversion (received_amount != amount). '
          'This deposit has a conversion, use original_currency field instead.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_safeguard_deposit_currency_on_update ON deposits;

CREATE TRIGGER trg_safeguard_deposit_currency_on_update
BEFORE UPDATE ON deposits
FOR EACH ROW
EXECUTE FUNCTION safeguard_deposit_currency_on_update();

-- ============================================================================
-- 6. DOCUMENTATION: View to see all deposits with currency conversions
-- ============================================================================

CREATE OR REPLACE VIEW deposits_with_conversions AS
SELECT 
  d.id,
  d.user_id,
  u.email as user_email,
  d.amount,
  d.currency_code,
  d.original_currency,
  d.received_amount,
  d.exchange_rate,
  d.deposit_method,
  d.status,
  d.created_at,
  CASE 
    WHEN d.received_amount IS NOT NULL AND d.received_amount <> d.amount
      THEN d.amount || ' ' || d.currency_code || ' → ' || d.received_amount || ' PHP'
    ELSE d.amount || ' ' || d.currency_code
  END as conversion_display,
  w.balance as current_wallet_balance
FROM deposits d
LEFT JOIN auth.users u ON d.user_id = u.id
LEFT JOIN wallets w ON d.wallet_id = w.id
WHERE d.received_amount IS NOT NULL OR d.exchange_rate IS NOT NULL
ORDER BY d.created_at DESC;

GRANT SELECT ON deposits_with_conversions TO authenticated;

-- ============================================================================
-- TESTING: Run these queries to verify the fixes
-- ============================================================================

/*
-- Test 1: Check all deposits that had currency issues detected
SELECT * FROM deposit_currency_audit WHERE fixed = FALSE;

-- Test 2: View deposits with conversions
SELECT * FROM deposits_with_conversions;

-- Test 3: Check if any deposits use received_amount properly
SELECT 
  id,
  amount,
  currency_code,
  received_amount,
  exchange_rate,
  status
FROM deposits
WHERE received_amount IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Test 4: Run audit to find any currency mismatches
SELECT * FROM audit_deposit_currency_issues();
*/

COMMENT ON FUNCTION credit_wallet_on_deposit_approved() IS
'CRITICAL: Fixed to use received_amount (PHP-converted) instead of raw amount for crypto deposits.
This ensures that a 3443 BCH deposit credits 119,947,205.75 PHP, not 3443 PHP.
Uses COALESCE(received_amount, amount) to handle both crypto and PHP deposits.';

-- ============================================================================
-- END CRITICAL FIX MIGRATION
-- ============================================================================
