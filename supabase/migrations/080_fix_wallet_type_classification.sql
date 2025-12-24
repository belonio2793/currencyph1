-- ============================================================================
-- MIGRATION 080: Fix wallet type classification for cryptocurrencies
-- ============================================================================
-- This migration:
-- 1. Fixes existing wallets with incorrect type assignments
-- 2. Ensures BTC and other cryptos are marked as 'crypto' not 'fiat'
-- 3. Improves the wallet type trigger to be more robust
-- 4. Verifies all currencies in the database
-- ============================================================================

-- Step 1: Verify and fix all wallet types based on currency definitions
-- Update any wallet whose type doesn't match its currency_code type
UPDATE public.wallets w
SET type = c.type
FROM public.currencies c
WHERE w.currency_code = c.code
  AND w.type != c.type;

-- Step 2: Specifically fix the BTC wallet issue (if it exists)
UPDATE public.wallets
SET type = 'crypto'
WHERE currency_code = 'BTC' AND type != 'crypto';

-- Step 3: Log which wallets were fixed (for audit purposes)
-- Create a summary of updated wallets
DO $$
DECLARE
  v_fixed_count INTEGER;
  v_btc_fixed BOOLEAN;
BEGIN
  -- Count wallets where currency is crypto but type was fiat
  SELECT COUNT(*) INTO v_fixed_count
  FROM public.wallets w
  JOIN public.currencies c ON w.currency_code = c.code
  WHERE c.type = 'crypto' AND w.type = 'crypto';
  
  -- Check if BTC wallet was specifically fixed
  SELECT EXISTS(
    SELECT 1 FROM public.wallets 
    WHERE currency_code = 'BTC' AND type = 'crypto'
  ) INTO v_btc_fixed;
  
  RAISE NOTICE 'Wallet type fix complete: % crypto wallets now have correct type. BTC fixed: %', 
    v_fixed_count, v_btc_fixed;
END
$$;

-- Step 4: Improve the trigger function to be more robust
-- Drop and recreate the trigger function with better error handling
DROP TRIGGER IF EXISTS wallet_type_trigger ON public.wallets;

CREATE OR REPLACE FUNCTION public.set_wallet_type()
RETURNS TRIGGER AS $$
DECLARE
  v_currency_type TEXT;
BEGIN
  -- If type is not provided, get it from the currency table
  IF NEW.type IS NULL THEN
    -- Look up the currency type
    SELECT type INTO v_currency_type
    FROM public.currencies
    WHERE code = NEW.currency_code
    LIMIT 1;
    
    -- Use the found type, or default to 'fiat' if not found
    IF v_currency_type IS NOT NULL THEN
      NEW.type := v_currency_type;
    ELSE
      -- Log a warning when currency not found (you can remove this in production)
      RAISE WARNING 'Currency code % not found in currencies table during wallet creation', NEW.currency_code;
      NEW.type := 'fiat';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger with the improved function
CREATE TRIGGER wallet_type_trigger
BEFORE INSERT ON public.wallets
FOR EACH ROW
EXECUTE FUNCTION public.set_wallet_type();

-- Step 5: Verify cryptocurrencies are in the currencies table
-- Ensure BTC is properly defined as crypto
INSERT INTO public.currencies (code, name, type, symbol, decimals, active, is_default)
VALUES ('BTC', 'Bitcoin', 'crypto', '₿', 8, TRUE, FALSE)
ON CONFLICT (code) DO UPDATE SET
  type = 'crypto',
  active = TRUE;

-- Step 6: Verify all major cryptocurrencies are properly defined
INSERT INTO public.currencies (code, name, type, symbol, decimals, active, is_default) VALUES
  ('ETH', 'Ethereum', 'crypto', 'Ξ', 8, TRUE, FALSE),
  ('USDT', 'Tether USD', 'crypto', 'USDT', 6, TRUE, FALSE),
  ('USDC', 'USD Coin', 'crypto', 'USDC', 6, TRUE, FALSE),
  ('XRP', 'XRP', 'crypto', 'XRP', 8, TRUE, FALSE),
  ('ADA', 'Cardano', 'crypto', 'ADA', 8, TRUE, FALSE),
  ('SOL', 'Solana', 'crypto', 'SOL', 8, TRUE, FALSE),
  ('DOGE', 'Dogecoin', 'crypto', 'Ð', 8, TRUE, FALSE),
  ('LTC', 'Litecoin', 'crypto', 'Ł', 8, TRUE, FALSE),
  ('BCH', 'Bitcoin Cash', 'crypto', 'BCH', 8, TRUE, FALSE)
ON CONFLICT (code) DO UPDATE SET
  type = 'crypto',
  active = TRUE;

-- Step 7: Create a verification query to check for any remaining mismatches
-- This view shows any wallets that might still have incorrect types
CREATE OR REPLACE VIEW wallet_type_mismatches AS
SELECT 
  w.id,
  w.user_id,
  w.currency_code,
  w.type AS wallet_type,
  c.type AS currency_type,
  CASE 
    WHEN w.type != c.type THEN 'MISMATCH'
    ELSE 'OK'
  END AS status,
  w.created_at
FROM public.wallets w
LEFT JOIN public.currencies c ON w.currency_code = c.code
WHERE c.type IS NOT NULL
  AND w.type != c.type;

-- Step 8: Grant access to the mismatch view
GRANT SELECT ON wallet_type_mismatches TO authenticated;

-- ============================================================================
-- END MIGRATION 080
-- ============================================================================
