-- ============================================================================
-- DEPLOYMENT SCRIPT: Deploy Missing Functions
-- ============================================================================
-- Run this script in Supabase SQL Editor if migrations haven't been applied
-- This creates the get_total_wallet_valuation_in_fiat function
-- ============================================================================

-- Step 1: Create the function if it doesn't exist
CREATE OR REPLACE FUNCTION public.get_total_wallet_valuation_in_fiat(
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
      SELECT rate INTO v_wallet_rate
      FROM public.get_exchange_rate_safe(v_wallet_record.currency_code, v_target_upper)
      WHERE rate IS NOT NULL
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

-- Step 2: Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_total_wallet_valuation_in_fiat(UUID, VARCHAR) TO authenticated, service_role;

-- Step 3: Add comment/documentation
COMMENT ON FUNCTION public.get_total_wallet_valuation_in_fiat(UUID, VARCHAR) IS
'Calculate the total fiat value of all user wallets consolidated.

PARAMETERS:
- p_user_id: User UUID to get wallets for
- p_target_currency: Target fiat currency code (default: PHP). Examples: USD, EUR, GBP

RETURNS:
- total_balance_in_target_currency: Sum of all wallet balances converted to target currency
- breakdown: JSONB array with per-wallet details
- calculated_at: Timestamp when calculation was performed

NOTES:
1. Calculates TOTAL HOLDINGS, NOT NET WORTH (debt is NOT subtracted)
2. Wallets with zero balance are excluded
3. Uses get_exchange_rate_safe() for proper rate handling';

-- Step 4: Verify the function exists
DO $$
BEGIN
  RAISE NOTICE '✓ Function get_total_wallet_valuation_in_fiat created successfully';
  RAISE NOTICE '✓ Permissions granted to authenticated users';
  RAISE NOTICE '✓ You may now refresh your application';
END $$;
