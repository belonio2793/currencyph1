-- ============================================================================
-- MIGRATION: Fix Critical Deposit Currency Mapping Bug
-- ============================================================================
-- Issue: Deposits incorrectly map input amount currency to payment method currency
--
-- Example of the bug:
--   User sends: 90,000 USD via Ethereum
--   Current behavior: Treats as 90,000 ETH, converts to PHP = ~2.6T PHP (WRONG)
--   Expected behavior: Convert 90,000 USD to PHP, show how much ETH needed
--
-- Root Cause: deposits table conflates three separate concepts:
--   1. Input amount currency (what user specifies)
--   2. Payment method currency (how they pay)
--   3. Wallet currency (what they receive)
--
-- Solution: Add explicit columns for input currency and payment currency
-- ============================================================================

-- Step 1: Add columns to properly track all three currencies
ALTER TABLE deposits
ADD COLUMN IF NOT EXISTS input_amount NUMERIC(36, 8),
ADD COLUMN IF NOT EXISTS input_currency VARCHAR(16),
ADD COLUMN IF NOT EXISTS payment_method_currency VARCHAR(16),
ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(36, 8);

-- Step 2: Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_deposits_input_currency ON deposits(input_currency);
CREATE INDEX IF NOT EXISTS idx_deposits_payment_method_currency ON deposits(payment_method_currency);

-- Step 3: Create validation function for three-currency deposits
CREATE OR REPLACE FUNCTION validate_three_currency_deposit()
RETURNS trigger AS $$
BEGIN
  -- If input_currency is set, validate the conversion chain
  IF NEW.input_currency IS NOT NULL THEN
    -- Must have input_amount if input_currency is set
    IF NEW.input_amount IS NULL OR NEW.input_amount <= 0 THEN
      RAISE EXCEPTION 'Invalid deposit: input_currency set but input_amount is missing or <= 0';
    END IF;

    -- If payment_method_currency is set, ensure it's different from input_currency
    -- (same currency would mean no conversion)
    IF NEW.payment_method_currency IS NOT NULL 
       AND NEW.payment_method_currency <> NEW.input_currency THEN
      IF NEW.payment_amount IS NULL OR NEW.payment_amount <= 0 THEN
        RAISE EXCEPTION 'Invalid deposit: payment_method_currency set but payment_amount is missing or <= 0';
      END IF;
    END IF;

    -- Validate conversion chain: input_currency → wallet_currency
    -- (payment_method_currency is informational)
    IF NEW.currency_code IS NOT NULL AND NEW.currency_code <> NEW.input_currency THEN
      -- This is a currency conversion deposit
      IF NEW.received_amount IS NULL OR NEW.received_amount <= 0 THEN
        RAISE EXCEPTION 'Invalid deposit: currency_code differs from input_currency but received_amount is missing';
      END IF;
      IF NEW.exchange_rate IS NULL OR NEW.exchange_rate <= 0 THEN
        RAISE EXCEPTION 'Invalid deposit: currency_code differs from input_currency but exchange_rate is missing';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_three_currency_deposit ON deposits;
CREATE TRIGGER trg_validate_three_currency_deposit
BEFORE INSERT OR UPDATE ON deposits
FOR EACH ROW
EXECUTE FUNCTION validate_three_currency_deposit();

-- Step 4: Create documentation view for the new three-currency model
CREATE OR REPLACE VIEW deposits_three_currency_model AS
SELECT 
  d.id,
  d.user_id,
  u.email as user_email,
  
  -- Input (what user specifies)
  d.input_amount,
  d.input_currency,
  
  -- Payment method (how user pays)
  d.payment_method,
  d.payment_method_currency,
  d.payment_amount,
  d.payment_address,
  
  -- Wallet (what they receive)
  d.currency_code as wallet_currency,
  d.received_amount as wallet_credited_amount,
  
  -- Rates
  d.exchange_rate,
  
  -- Status
  d.status,
  d.created_at,
  
  -- Display summary
  CASE 
    WHEN d.input_currency IS NOT NULL THEN
      CASE 
        WHEN d.payment_method_currency IS NOT NULL AND d.payment_method_currency <> d.input_currency THEN
          d.input_amount || ' ' || d.input_currency || ' → ' || 
          COALESCE(d.payment_amount, '?') || ' ' || d.payment_method_currency || ' (payment) → ' ||
          COALESCE(d.received_amount, '?') || ' ' || d.currency_code || ' (wallet)'
        ELSE
          d.input_amount || ' ' || d.input_currency || ' → ' ||
          COALESCE(d.received_amount, '?') || ' ' || d.currency_code
      END
    ELSE
      d.amount || ' ' || d.currency_code
  END as conversion_summary,
  
  w.balance as current_wallet_balance
FROM deposits d
LEFT JOIN auth.users u ON d.user_id = u.id
LEFT JOIN wallets w ON d.wallet_id = w.id
ORDER BY d.created_at DESC;

GRANT SELECT ON deposits_three_currency_model TO authenticated;

-- Step 5: Create migration helper function to populate new columns from existing data
CREATE OR REPLACE FUNCTION migrate_deposits_to_three_currency_model()
RETURNS TABLE (
  total_deposits INT,
  migrated_deposits INT,
  issues_found INT
) AS $$
DECLARE
  v_total INT := 0;
  v_migrated INT := 0;
  v_issues INT := 0;
BEGIN
  -- Count total deposits
  SELECT COUNT(*) INTO v_total FROM deposits;

  -- Migrate deposits that have original_currency set (already multi-currency)
  -- These should have: original_currency as input_currency, currency_code as wallet_currency
  UPDATE deposits
  SET 
    input_currency = original_currency,
    input_amount = amount,
    payment_method_currency = CASE 
      WHEN original_currency <> currency_code THEN currency_code 
      ELSE NULL 
    END,
    payment_amount = received_amount
  WHERE input_currency IS NULL
    AND original_currency IS NOT NULL;

  GET DIAGNOSTICS v_migrated = ROW_COUNT;

  -- Flag deposits with potential issues
  -- (where currency_code doesn't match original_currency but received_amount is missing)
  SELECT COUNT(*) INTO v_issues
  FROM deposits
  WHERE input_currency IS NULL
    AND original_currency IS NULL
    AND currency_code <> 'PHP'
    AND received_amount IS NULL;

  RETURN QUERY SELECT v_total, v_migrated, v_issues;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Add comments documenting the three-currency model
COMMENT ON COLUMN deposits.input_amount IS 
'The amount entered by the user (what they specify as the deposit amount). Should be in input_currency.';

COMMENT ON COLUMN deposits.input_currency IS 
'The currency of the input_amount (what user specifies). Example: USD when user enters "90,000 USD"';

COMMENT ON COLUMN deposits.payment_method_currency IS 
'The currency required for the payment method. Example: ETH when paying via Ethereum.
This may differ from input_currency (e.g., user specifies 90,000 USD but pays in ETH).';

COMMENT ON COLUMN deposits.payment_amount IS 
'The amount of payment_method_currency needed to complete the deposit.
Example: if user sends 90,000 USD via Ethereum, payment_amount might be ~0.03 ETH.';

COMMENT ON COLUMN deposits.currency_code IS 
'The wallet currency (destination). This is what the user receives in their wallet after conversion.
Example: PHP if user has a PHP wallet.
IMPORTANT: With the three-currency model, currency_code is NOT the payment currency, it is the wallet currency.';

COMMENT ON COLUMN deposits.amount IS 
'DEPRECATED: Use input_amount and input_currency instead.
Legacy field that conflated input amount with payment method currency.';

COMMENT ON COLUMN deposits.received_amount IS 
'The amount that gets credited to the wallet in wallet_currency (currency_code).
This is the result of converting from input_currency to currency_code.';

COMMENT ON TABLE deposits IS 
'Deposits table with three-currency model:
1. input_currency/input_amount: What user specifies
2. payment_method_currency/payment_amount: How they pay
3. currency_code/received_amount: What gets credited to wallet
This prevents the bug where 90,000 USD deposited via ETH was incorrectly treated as 90,000 ETH.';

-- ============================================================================
-- TESTING QUERIES
-- ============================================================================
/*
-- Test 1: View the three-currency model
SELECT * FROM deposits_three_currency_model WHERE created_at > NOW() - INTERVAL '7 days';

-- Test 2: Check for any deposits still missing input_currency
SELECT id, amount, currency_code, original_currency, input_currency 
FROM deposits 
WHERE input_currency IS NULL 
LIMIT 10;

-- Test 3: Run migration helper
SELECT * FROM migrate_deposits_to_three_currency_model();

-- Test 4: Validate all deposits pass the three-currency validation
-- (If any fail, they'll be caught by the trigger on next update)
SELECT id, input_currency, input_amount, payment_method_currency, payment_amount, currency_code, received_amount
FROM deposits
WHERE input_currency IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;
*/

-- ============================================================================
-- END MIGRATION
-- ============================================================================
