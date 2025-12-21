-- ============================================================================
-- MIGRATION: Multi-wallet consolidation and balance aggregation
-- ============================================================================
-- This migration adds support for:
-- - Multi-currency wallets per user (user can have BTC, ETH, PHP wallets)
-- - Consolidated balance view (all wallets valued in PHP)
-- - Total balance calculation (sum of all wallets in base currency)
-- - Currency valuation (what's 1 BTC worth in PHP today?)
-- - Automatic wallet creation on first deposit
--
-- When user deposits 1000 BCH:
-- 1. Creates BCH wallet (if not exists) with 1000 BCH balance
-- 2. Calculates PHP equivalent at current rate
-- 3. Shows both individual wallet and consolidated total
-- ============================================================================

-- ============================================================================
-- STEP 1: Create function to get exchange rate WITH timestamp (for user confirmation)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_exchange_rate_with_timestamp(
  p_from_currency VARCHAR(16),
  p_to_currency VARCHAR(16)
)
RETURNS TABLE(
  rate NUMERIC,
  rate_timestamp TIMESTAMPTZ,
  rate_age_seconds INTEGER,
  is_fresh BOOLEAN,
  fallback BOOLEAN,
  source VARCHAR(64)
) AS $$
DECLARE
  v_rate NUMERIC;
  v_timestamp TIMESTAMPTZ;
  v_age_seconds INTEGER;
  v_is_fresh BOOLEAN;
  v_fallback BOOLEAN := FALSE;
  v_source VARCHAR(64);
BEGIN
  -- If converting to same currency
  IF p_from_currency = p_to_currency THEN
    RETURN QUERY SELECT
      1::NUMERIC,
      NOW(),
      0::INTEGER,
      TRUE,
      FALSE,
      'same_currency'::VARCHAR(64);
    RETURN;
  END IF;

  -- Try to get fresh rate (< 1 hour old)
  SELECT rate, updated_at, EXTRACT(EPOCH FROM (NOW() - updated_at))::INTEGER, 'coingecko'::VARCHAR(64)
  INTO v_rate, v_timestamp, v_age_seconds, v_source
  FROM crypto_rates_valid
  WHERE from_currency = p_from_currency
    AND to_currency = p_to_currency
  ORDER BY updated_at DESC
  LIMIT 1;

  -- If fresh rate found, return it
  IF v_rate IS NOT NULL AND v_age_seconds <= 3600 THEN
    RETURN QUERY SELECT
      v_rate,
      v_timestamp,
      v_age_seconds,
      TRUE,
      FALSE,
      v_source;
    RETURN;
  END IF;

  -- Fallback: Use ANY rate we have (even if stale)
  SELECT rate, updated_at, EXTRACT(EPOCH FROM (NOW() - updated_at))::INTEGER
  INTO v_rate, v_timestamp, v_age_seconds
  FROM crypto_rates
  WHERE from_currency = p_from_currency
    AND to_currency = p_to_currency
    AND expires_at > NOW() - INTERVAL '7 days'  -- Not older than 7 days
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_rate IS NOT NULL THEN
    RETURN QUERY SELECT
      v_rate,
      v_timestamp,
      v_age_seconds,
      FALSE,
      TRUE,
      'fallback_rate'::VARCHAR(64);
    RETURN;
  END IF;

  -- Last resort: Return NULL (no rate available at all)
  RETURN QUERY SELECT
    NULL::NUMERIC,
    NULL::TIMESTAMPTZ,
    NULL::INTEGER,
    FALSE,
    TRUE,
    'no_rate_available'::VARCHAR(64);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 1B: Simpler function for just getting the rate (with fallback)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_exchange_rate_cached(
  p_from_currency VARCHAR(16),
  p_to_currency VARCHAR(16)
)
RETURNS NUMERIC AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- If converting to same currency, return 1
  IF p_from_currency = p_to_currency THEN
    RETURN 1;
  END IF;

  -- Get rate with timestamp/fallback info
  SELECT rate INTO v_result
  FROM get_exchange_rate_with_timestamp(p_from_currency, p_to_currency);

  -- If no rate found at all, raise error
  IF v_result.rate IS NULL THEN
    RAISE EXCEPTION 'No exchange rate found for %→% (even stale rates unavailable)',
      p_from_currency, p_to_currency;
  END IF;

  RETURN v_result.rate;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2: Create function to value a wallet WITH rate details (for user display)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_wallet_valuation_detailed(
  p_wallet_id UUID,
  p_target_currency VARCHAR(16) DEFAULT 'PHP'
)
RETURNS TABLE(
  wallet_id UUID,
  currency_code VARCHAR(16),
  balance NUMERIC,
  valuation_in_target NUMERIC,
  exchange_rate NUMERIC,
  rate_timestamp TIMESTAMPTZ,
  rate_age_seconds INTEGER,
  is_fresh_rate BOOLEAN,
  rate_source VARCHAR(64)
) AS $$
DECLARE
  v_balance NUMERIC;
  v_currency_code VARCHAR(16);
  v_rate_info RECORD;
BEGIN
  -- Get wallet details
  SELECT w.id, w.balance, w.currency_code
  INTO p_wallet_id, v_balance, v_currency_code
  FROM wallets w
  WHERE w.id = p_wallet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found: %', p_wallet_id;
  END IF;

  -- If already in target currency
  IF v_currency_code = p_target_currency THEN
    RETURN QUERY SELECT
      p_wallet_id,
      v_currency_code,
      v_balance,
      v_balance,
      1::NUMERIC,
      NOW(),
      0::INTEGER,
      TRUE,
      'same_currency'::VARCHAR(64);
    RETURN;
  END IF;

  -- Get exchange rate with timestamp
  SELECT rate, rate_timestamp, rate_age_seconds, is_fresh, source
  INTO v_rate_info
  FROM get_exchange_rate_with_timestamp(v_currency_code, p_target_currency);

  -- Return with all rate details
  RETURN QUERY SELECT
    p_wallet_id,
    v_currency_code,
    v_balance,
    v_balance * v_rate_info.rate,
    v_rate_info.rate,
    v_rate_info.rate_timestamp,
    v_rate_info.rate_age_seconds,
    v_rate_info.is_fresh,
    v_rate_info.source;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2B: Simple function to value a wallet (backward compatible)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_wallet_valuation(
  p_wallet_id UUID,
  p_target_currency VARCHAR(16) DEFAULT 'PHP'
)
RETURNS NUMERIC AS $$
DECLARE
  v_balance NUMERIC;
  v_currency_code VARCHAR(16);
  v_exchange_rate NUMERIC;
  v_valuation NUMERIC;
BEGIN
  -- Get wallet details
  SELECT balance, currency_code
  INTO v_balance, v_currency_code
  FROM wallets
  WHERE id = p_wallet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found: %', p_wallet_id;
  END IF;

  -- If already in target currency, return balance
  IF v_currency_code = p_target_currency THEN
    RETURN v_balance;
  END IF;

  -- Get exchange rate
  v_exchange_rate := get_exchange_rate_cached(v_currency_code, p_target_currency);

  -- Calculate valuation
  v_valuation := v_balance * v_exchange_rate;

  RETURN v_valuation;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 3: Create function to get user's total balance in target currency
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_total_balance(
  p_user_id UUID,
  p_target_currency VARCHAR(16) DEFAULT 'PHP'
)
RETURNS NUMERIC AS $$
DECLARE
  v_total_balance NUMERIC := 0;
  v_wallet record;
BEGIN
  -- Sum all wallets' valuations in target currency
  SELECT COALESCE(SUM(get_wallet_valuation(w.id, p_target_currency)), 0)
  INTO v_total_balance
  FROM wallets w
  WHERE w.user_id = p_user_id
    AND w.is_active = TRUE;
  
  RETURN v_total_balance;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 4: Create function to auto-create wallet if it doesn't exist
-- ============================================================================

CREATE OR REPLACE FUNCTION ensure_user_wallet(
  p_user_id UUID,
  p_currency_code VARCHAR(16)
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  -- Check if wallet exists
  SELECT id INTO v_wallet_id
  FROM wallets
  WHERE user_id = p_user_id
    AND currency_code = p_currency_code;
  
  -- If exists, return it
  IF v_wallet_id IS NOT NULL THEN
    RETURN v_wallet_id;
  END IF;
  
  -- Validate currency exists
  IF NOT EXISTS (SELECT 1 FROM currencies WHERE code = p_currency_code) THEN
    RAISE EXCEPTION 'Currency not found: %', p_currency_code;
  END IF;
  
  -- Create new wallet
  INSERT INTO wallets (
    user_id,
    currency_code,
    balance,
    total_deposited,
    total_withdrawn,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_currency_code,
    0,
    0,
    0,
    TRUE,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_wallet_id;
  
  RETURN v_wallet_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 5: Create trigger to auto-create wallet on first deposit
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_create_wallet_on_deposit()
RETURNS TRIGGER AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  -- Ensure wallet exists for deposit currency
  v_wallet_id := ensure_user_wallet(NEW.user_id, NEW.currency_code);
  
  -- If wallet_id is null, set it to the created wallet
  IF NEW.wallet_id IS NULL THEN
    NEW.wallet_id := v_wallet_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_create_wallet_on_deposit ON deposits;
CREATE TRIGGER trg_auto_create_wallet_on_deposit
BEFORE INSERT ON deposits
FOR EACH ROW
EXECUTE FUNCTION auto_create_wallet_on_deposit();

-- ============================================================================
-- STEP 6: Create consolidated wallet view
-- ============================================================================

CREATE OR REPLACE VIEW user_wallets_consolidated AS
SELECT 
  w.id,
  w.user_id,
  u.email,
  
  -- Wallet info
  w.currency_code,
  c.name AS currency_name,
  c.symbol AS currency_symbol,
  c.type AS currency_type,
  
  -- Balance in native currency
  w.balance AS native_balance,
  w.total_deposited,
  w.total_withdrawn,
  
  -- Valuation in PHP
  CASE 
    WHEN w.currency_code = 'PHP' THEN w.balance
    ELSE w.balance * COALESCE(
      (SELECT rate FROM crypto_rates_valid 
       WHERE from_currency = w.currency_code 
         AND to_currency = 'PHP' 
       ORDER BY updated_at DESC LIMIT 1),
      1
    )
  END AS balance_in_php,
  
  -- Metadata
  w.is_active,
  w.created_at,
  w.updated_at
  
FROM wallets w
JOIN users u ON u.id = w.user_id
JOIN currencies c ON c.code = w.currency_code
WHERE w.is_active = TRUE;

-- ============================================================================
-- STEP 7: Create user balance summary view
-- ============================================================================

CREATE OR REPLACE VIEW user_balance_summary AS
SELECT 
  u.id AS user_id,
  u.email,
  
  -- Total balance in PHP
  COALESCE(SUM(
    CASE 
      WHEN w.currency_code = 'PHP' THEN w.balance
      ELSE w.balance * COALESCE(
        (SELECT rate FROM crypto_rates_valid 
         WHERE from_currency = w.currency_code 
           AND to_currency = 'PHP' 
         ORDER BY updated_at DESC LIMIT 1),
        1
      )
    END
  ), 0) AS total_balance_php,
  
  -- Count of active wallets
  COUNT(w.id) FILTER (WHERE w.is_active) AS active_wallet_count,
  
  -- Last updated
  MAX(w.updated_at) AS last_balance_update
  
FROM users u
LEFT JOIN wallets w ON u.id = w.user_id
GROUP BY u.id, u.email;

-- ============================================================================
-- STEP 8: Create wallet conversion log
-- ============================================================================

CREATE TABLE IF NOT EXISTS wallet_conversions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Conversion details
  from_wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  to_wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  
  -- Amounts
  from_amount NUMERIC(36, 8) NOT NULL,
  from_currency VARCHAR(16) NOT NULL,
  to_amount NUMERIC(36, 8) NOT NULL,
  to_currency VARCHAR(16) NOT NULL,
  
  -- Rate used
  exchange_rate NUMERIC(36, 8) NOT NULL,
  rate_source VARCHAR(64),
  
  -- Status
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  
  -- Metadata
  initiated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  transaction_id UUID,
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wallet_conversions_from ON wallet_conversions_log(from_wallet_id);
CREATE INDEX idx_wallet_conversions_to ON wallet_conversions_log(to_wallet_id);
CREATE INDEX idx_wallet_conversions_created ON wallet_conversions_log(created_at DESC);

-- ============================================================================
-- STEP 9: Create function to transfer between wallets with conversion
-- ============================================================================

CREATE OR REPLACE FUNCTION transfer_between_wallets(
  p_from_wallet_id UUID,
  p_to_wallet_id UUID,
  p_from_amount NUMERIC,
  p_initiated_by UUID DEFAULT NULL
)
RETURNS TABLE(
  conversion_id UUID,
  success BOOLEAN,
  error_message TEXT,
  from_amount NUMERIC,
  to_amount NUMERIC,
  exchange_rate NUMERIC
) AS $$
DECLARE
  v_from_wallet wallets;
  v_to_wallet wallets;
  v_exchange_rate NUMERIC;
  v_to_amount NUMERIC;
  v_conversion_id UUID;
  v_error_message TEXT := NULL;
  v_success BOOLEAN := FALSE;
BEGIN
  -- Get both wallets
  SELECT * INTO v_from_wallet FROM wallets WHERE id = p_from_wallet_id;
  SELECT * INTO v_to_wallet FROM wallets WHERE id = p_to_wallet_id;
  
  -- Validate wallets exist
  IF v_from_wallet IS NULL THEN
    v_error_message := 'Source wallet not found';
  ELSIF v_to_wallet IS NULL THEN
    v_error_message := 'Destination wallet not found';
  ELSIF v_from_wallet.user_id != v_to_wallet.user_id THEN
    v_error_message := 'Wallets must belong to same user';
  ELSIF p_from_amount <= 0 THEN
    v_error_message := 'Amount must be greater than 0';
  ELSIF v_from_wallet.balance < p_from_amount THEN
    v_error_message := 'Insufficient balance';
  END IF;
  
  -- If validation passed, proceed with transfer
  IF v_error_message IS NULL THEN
    BEGIN
      -- Get exchange rate
      v_exchange_rate := get_exchange_rate_cached(v_from_wallet.currency_code, v_to_wallet.currency_code);
      v_to_amount := p_from_amount * v_exchange_rate;
      
      -- Debit source wallet
      UPDATE wallets
      SET balance = balance - p_from_amount, updated_at = NOW()
      WHERE id = p_from_wallet_id;
      
      -- Credit destination wallet
      UPDATE wallets
      SET balance = balance + v_to_amount, updated_at = NOW()
      WHERE id = p_to_wallet_id;
      
      -- Record in conversion log
      INSERT INTO wallet_conversions_log (
        from_wallet_id,
        to_wallet_id,
        from_amount,
        from_currency,
        to_amount,
        to_currency,
        exchange_rate,
        status,
        initiated_by
      ) VALUES (
        p_from_wallet_id,
        p_to_wallet_id,
        p_from_amount,
        v_from_wallet.currency_code,
        v_to_amount,
        v_to_wallet.currency_code,
        v_exchange_rate,
        'completed',
        p_initiated_by
      ) RETURNING id INTO v_conversion_id;
      
      v_success := TRUE;
      
    EXCEPTION WHEN OTHERS THEN
      v_error_message := SQLERRM;
      v_success := FALSE;
    END;
  END IF;
  
  -- Return result
  RETURN QUERY SELECT
    v_conversion_id,
    v_success,
    v_error_message,
    p_from_amount,
    v_to_amount,
    v_exchange_rate;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 10: Create function for quick balance check
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_balances(p_user_id UUID)
RETURNS TABLE (
  currency_code VARCHAR(16),
  currency_name TEXT,
  balance NUMERIC(36, 8),
  balance_in_php NUMERIC(36, 8),
  percentage_of_total NUMERIC
) AS $$
DECLARE
  v_total_balance NUMERIC;
BEGIN
  -- Get total balance in PHP
  v_total_balance := get_user_total_balance(p_user_id, 'PHP');
  
  -- Return balance breakdown
  RETURN QUERY
  SELECT 
    w.currency_code,
    c.name,
    w.balance,
    CASE 
      WHEN w.currency_code = 'PHP' THEN w.balance
      ELSE w.balance * COALESCE(
        (SELECT rate FROM crypto_rates_valid 
         WHERE from_currency = w.currency_code 
           AND to_currency = 'PHP' 
         ORDER BY updated_at DESC LIMIT 1),
        1
      )
    END,
    CASE 
      WHEN v_total_balance > 0 THEN
        (CASE 
          WHEN w.currency_code = 'PHP' THEN w.balance
          ELSE w.balance * COALESCE(
            (SELECT rate FROM crypto_rates_valid 
             WHERE from_currency = w.currency_code 
               AND to_currency = 'PHP' 
             ORDER BY updated_at DESC LIMIT 1),
            1
          )
        END) / v_total_balance * 100
      ELSE 0
    END
  FROM wallets w
  JOIN currencies c ON c.code = w.currency_code
  WHERE w.user_id = p_user_id
    AND w.is_active = TRUE
  ORDER BY 
    CASE 
      WHEN w.currency_code = 'PHP' THEN w.balance
      ELSE w.balance * COALESCE(
        (SELECT rate FROM crypto_rates_valid 
         WHERE from_currency = w.currency_code 
           AND to_currency = 'PHP' 
         ORDER BY updated_at DESC LIMIT 1),
        1
      )
    END DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 11: Add documentation
-- ============================================================================

COMMENT ON FUNCTION get_exchange_rate_cached IS 'Get exchange rate with freshness check. Raises error if rate not found or too old.';
COMMENT ON FUNCTION get_wallet_valuation IS 'Value a wallet in target currency using current exchange rates.';
COMMENT ON FUNCTION get_user_total_balance IS 'Get sum of all user wallets valued in target currency (default PHP).';
COMMENT ON FUNCTION ensure_user_wallet IS 'Get or create a wallet for user in specified currency.';
COMMENT ON FUNCTION transfer_between_wallets IS 'Transfer amount from one wallet to another with automatic conversion.';
COMMENT ON FUNCTION get_user_balances IS 'Get breakdown of all user balances with PHP valuation and percentages.';

COMMENT ON TABLE wallet_conversions_log IS 'Log of all wallet-to-wallet conversions with amounts and rates used.';
COMMENT ON VIEW user_wallets_consolidated IS 'View of all user wallets with native balance and PHP valuation.';
COMMENT ON VIEW user_balance_summary IS 'Quick summary: user total balance in PHP and active wallet count.';

-- ============================================================================
-- END MIGRATION: MULTI-WALLET CONSOLIDATION
-- ============================================================================
