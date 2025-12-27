-- ============================================================================
-- MIGRATION: Calculate Fiat Wallet Valuation
-- ============================================================================
-- Purpose: Calculate total fiat value of all user wallets consolidated by UUID
-- This sums all wallet balances and converts to a specified fiat currency
-- using the public.pairs exchange rate table
--
-- Example:
--   User has: 100,000 PHP + 0.5 BTC + 10 ETH
--   Call: get_total_wallet_valuation_in_fiat('user-uuid', 'USD')
--   Result: Total fiat value in USD (not debt-adjusted)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_total_wallet_valuation_in_fiat(
  p_user_id UUID,
  p_target_currency VARCHAR(16) DEFAULT 'PHP'
)
RETURNS TABLE (
  total_balance_in_target_currency NUMERIC,
  breakdown JSONB,
  calculated_at TIMESTAMPTZ
) AS $$
DECLARE
  v_target_upper VARCHAR(16) := UPPER(p_target_currency);
  v_total NUMERIC := 0;
  v_breakdown JSONB := '[]'::JSONB;
  v_wallet_record RECORD;
  v_wallet_rate NUMERIC;
  v_wallet_value_in_target NUMERIC;
BEGIN
  -- Iterate through all wallets for this user
  FOR v_wallet_record IN
    SELECT
      w.id,
      w.currency_code,
      w.balance,
      c.type AS currency_type
    FROM wallets w
    JOIN currencies c ON c.code = w.currency_code
    WHERE w.user_id = p_user_id
      AND w.balance > 0
  LOOP
    -- Get exchange rate from wallet currency to target currency
    IF UPPER(v_wallet_record.currency_code) = v_target_upper THEN
      -- Same currency, no conversion needed
      v_wallet_rate := 1.0;
    ELSE
      -- Get rate from pairs table using safe function
      SELECT er.rate INTO v_wallet_rate
      FROM get_exchange_rate_safe(v_wallet_record.currency_code, v_target_upper) as er
      WHERE er.rate IS NOT NULL
      LIMIT 1;
    END IF;

    -- If no rate found, skip this wallet (can't convert)
    IF v_wallet_rate IS NULL THEN
      RAISE WARNING 'No exchange rate found for %→%', v_wallet_record.currency_code, v_target_upper;
      CONTINUE;
    END IF;

    -- Calculate value in target currency
    v_wallet_value_in_target := v_wallet_record.balance * v_wallet_rate;

    -- Add to total
    v_total := v_total + v_wallet_value_in_target;

    -- Add to breakdown
    v_breakdown := v_breakdown || jsonb_build_array(
      jsonb_build_object(
        'wallet_id', v_wallet_record.id,
        'currency', v_wallet_record.currency_code,
        'balance', v_wallet_record.balance,
        'exchange_rate', v_wallet_rate,
        'value_in_target', v_wallet_value_in_target,
        'currency_type', v_wallet_record.currency_type
      )
    );
  END LOOP;

  -- Return total and breakdown
  RETURN QUERY SELECT
    ROUND(v_total::NUMERIC, 2),
    v_breakdown,
    NOW();
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_total_wallet_valuation_in_fiat(UUID, VARCHAR) TO authenticated, service_role;

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON FUNCTION get_total_wallet_valuation_in_fiat(UUID, VARCHAR) IS
'Calculate the total fiat value of all user wallets consolidated.

PARAMETERS:
- p_user_id: User UUID to get wallets for
- p_target_currency: Target fiat currency code (default: PHP). Examples: USD, EUR, GBP

RETURNS:
- total_balance_in_target_currency: Sum of all wallet balances converted to target currency
- breakdown: JSONB array with per-wallet details including balance, currency, exchange rate, and calculated value
- calculated_at: Timestamp when calculation was performed

IMPORTANT NOTES:
1. This function calculates TOTAL HOLDINGS, NOT NET WORTH (debt is NOT subtracted)
2. Wallets with zero balance are excluded from calculation
3. If no exchange rate can be found for a currency, that wallet is skipped with a warning
4. All conversions use the public.pairs table via get_exchange_rate_safe()
5. This is a STABLE function (deterministic for same inputs)

EXAMPLE:
  SELECT * FROM get_total_wallet_valuation_in_fiat('123e4567-e89b-12d3-a456-426614174000'::uuid, ''USD'')
  
  Result:
  {
    "total_balance_in_target_currency": 50000.00,
    "breakdown": [
      {
        "wallet_id": "uuid1",
        "currency": "USD",
        "balance": 10000,
        "exchange_rate": 1.0,
        "value_in_target": 10000.00
      },
      {
        "wallet_id": "uuid2", 
        "currency": "BTC",
        "balance": 0.5,
        "exchange_rate": 40000.0,
        "value_in_target": 20000.00
      }
    ],
    "calculated_at": "2025-01-01T12:00:00Z"
  }
';

-- ============================================================================
-- END MIGRATION
-- ============================================================================
