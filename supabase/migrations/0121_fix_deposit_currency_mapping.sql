-- ============================================================================
-- MIGRATION: Fix Critical Deposit Currency Mapping Bug (FULL FIXED VERSION)
-- ============================================================================
-- Issue:
-- Deposits incorrectly treat input amount as payment currency.
--
-- Example bug:
--   User sends: 90,000 USD via Ethereum
--   System treats it as: 90,000 ETH → PHP (~2.6T PHP ❌)
--
-- Correct behavior:
--   90,000 USD → PHP
--   Display how much ETH is required to pay
--
-- Root cause:
-- deposits table conflated:
--   1) input currency
--   2) payment currency
--   3) wallet currency
--
-- Solution:
-- Explicit three-currency model
-- ============================================================================


-- ============================================================================
-- STEP 1: ADD REQUIRED COLUMNS
-- ============================================================================

ALTER TABLE deposits
ADD COLUMN IF NOT EXISTS input_amount NUMERIC(36, 8),
ADD COLUMN IF NOT EXISTS input_currency VARCHAR(16),
ADD COLUMN IF NOT EXISTS payment_method_currency VARCHAR(16),
ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(36, 8);


-- ============================================================================
-- STEP 2: INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_deposits_input_currency
ON deposits(input_currency);

CREATE INDEX IF NOT EXISTS idx_deposits_payment_method_currency
ON deposits(payment_method_currency);


-- ============================================================================
-- STEP 3: VALIDATION TRIGGER (THREE-CURRENCY MODEL)
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_three_currency_deposit()
RETURNS trigger AS $$
BEGIN
  -- Backwards compatibility: if using legacy original_currency model, auto-populate input_currency
  IF NEW.original_currency IS NOT NULL AND NEW.input_currency IS NULL THEN
    NEW.input_currency := NEW.original_currency;
    NEW.input_amount := NEW.amount;
  END IF;

  -- Validate when three-currency model is used
  IF NEW.input_currency IS NOT NULL THEN

    -- Input must be valid
    IF NEW.input_amount IS NULL OR NEW.input_amount <= 0 THEN
      RAISE EXCEPTION
        'Invalid deposit: input_currency set but input_amount is missing or <= 0';
    END IF;

    -- Payment validation (optional but strict if provided)
    IF NEW.payment_method_currency IS NOT NULL
       AND NEW.payment_method_currency <> NEW.input_currency THEN

      IF NEW.payment_amount IS NULL OR NEW.payment_amount <= 0 THEN
        RAISE EXCEPTION
          'Invalid deposit: payment_method_currency set but payment_amount is missing or <= 0';
      END IF;
    END IF;

    -- Wallet conversion validation: If wallet currency differs, auto-calculate exchange_rate
    IF NEW.currency_code IS NOT NULL AND NEW.currency_code <> NEW.input_currency THEN

      IF NEW.received_amount IS NULL OR NEW.received_amount <= 0 THEN
        RAISE EXCEPTION
          'Invalid deposit: wallet currency differs from input_currency but received_amount is missing';
      END IF;

      -- Auto-calculate exchange_rate if missing using: rate = received_amount / input_amount
      IF NEW.exchange_rate IS NULL OR NEW.exchange_rate <= 0 THEN
        NEW.exchange_rate := NEW.received_amount / NEW.input_amount;
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


-- ============================================================================
-- STEP 4: DOCUMENTATION / READ MODEL VIEW (FIXED)
-- ============================================================================

CREATE OR REPLACE VIEW deposits_three_currency_model AS
SELECT
  d.id,
  d.user_id,
  u.email AS user_email,

  -- Input (what user specifies)
  d.input_amount,
  d.input_currency,

  -- Payment (how user pays)
  d.payment_method_currency,
  d.payment_amount,
  d.payment_address,

  -- Wallet (what they receive)
  d.currency_code AS wallet_currency,
  d.received_amount AS wallet_credited_amount,

  -- Rates
  d.exchange_rate,

  -- Status
  d.status,
  d.created_at,

  -- Display summary (human readable)
  CASE
    WHEN d.input_currency IS NOT NULL THEN
      CASE
        WHEN d.payment_method_currency IS NOT NULL
             AND d.payment_method_currency <> d.input_currency THEN
          d.input_amount || ' ' || d.input_currency || ' → ' ||
          COALESCE(d.payment_amount::text, '?') || ' ' ||
          d.payment_method_currency || ' (payment) → ' ||
          COALESCE(d.received_amount::text, '?') || ' ' ||
          d.currency_code || ' (wallet)'
        ELSE
          d.input_amount || ' ' || d.input_currency || ' → ' ||
          COALESCE(d.received_amount::text, '?') || ' ' ||
          d.currency_code
      END
    ELSE
      d.amount || ' ' || d.currency_code
  END AS conversion_summary,

  w.balance AS current_wallet_balance

FROM deposits d
LEFT JOIN auth.users u ON d.user_id = u.id
LEFT JOIN wallets w ON d.wallet_id = w.id
ORDER BY d.created_at DESC;


GRANT SELECT ON deposits_three_currency_model TO authenticated;


-- ============================================================================
-- STEP 5: MIGRATION HELPER (LEGACY → THREE-CURRENCY)
-- ============================================================================

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
  SELECT COUNT(*) INTO v_total FROM deposits;

  -- Migrate legacy multi-currency rows
  UPDATE deposits
  SET
    input_currency = original_currency,
    input_amount   = amount,
    payment_method_currency =
      CASE
        WHEN original_currency <> currency_code THEN currency_code
        ELSE NULL
      END,
    payment_amount = received_amount
  WHERE input_currency IS NULL
    AND original_currency IS NOT NULL;

  GET DIAGNOSTICS v_migrated = ROW_COUNT;

  -- Detect problematic rows
  SELECT COUNT(*) INTO v_issues
  FROM deposits
  WHERE input_currency IS NULL
    AND original_currency IS NULL
    AND currency_code <> 'PHP'
    AND received_amount IS NULL;

  RETURN QUERY SELECT v_total, v_migrated, v_issues;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- STEP 6: COMMENTS (AUTHORITATIVE SOURCE OF TRUTH)
-- ============================================================================

COMMENT ON COLUMN deposits.input_amount IS
'Amount specified by the user. Always denominated in input_currency.';

COMMENT ON COLUMN deposits.input_currency IS
'Currency specified by the user (e.g. USD when user enters "90,000 USD").';

COMMENT ON COLUMN deposits.payment_method_currency IS
'Currency required by the payment method (e.g. ETH, TRX, BTC).';

COMMENT ON COLUMN deposits.payment_amount IS
'Amount of payment_method_currency required to complete the deposit.';

COMMENT ON COLUMN deposits.currency_code IS
'Wallet currency. This is what the user ultimately receives.';

COMMENT ON COLUMN deposits.amount IS
'DEPRECATED. Legacy field that incorrectly conflated input and payment currency.';

COMMENT ON COLUMN deposits.received_amount IS
'Amount credited to the wallet after conversion into currency_code.';

COMMENT ON TABLE deposits IS
'Three-currency deposit model:
1) input_currency / input_amount (what user specifies)
2) payment_method_currency / payment_amount (how user pays)
3) currency_code / received_amount (wallet credit)
Prevents treating fiat deposits as crypto amounts.';


-- ============================================================================
-- TESTING
-- ============================================================================

/*
SELECT * FROM deposits_three_currency_model
ORDER BY created_at DESC
LIMIT 20;

SELECT * FROM migrate_deposits_to_three_currency_model();

SELECT id, input_currency, input_amount,
       payment_method_currency, payment_amount,
       currency_code, received_amount
FROM deposits
WHERE input_currency IS NOT NULL
ORDER BY created_at DESC;
*/

-- ============================================================================
-- END MIGRATION
-- ============================================================================
