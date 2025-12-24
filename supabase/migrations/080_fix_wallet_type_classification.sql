-- ============================================================================
-- MIGRATION 080: Fix wallet type classification for cryptocurrencies
-- ============================================================================
-- This migration ensures wallet types are correctly set based on currency_code
-- from the currencies table (either 'crypto' or 'fiat')
-- ============================================================================

-- Step 1: Ensure all cryptocurrencies exist in currencies table with correct type
INSERT INTO public.currencies (code, name, type, symbol, decimals, active, is_default) VALUES
  ('BTC', 'Bitcoin', 'crypto', '₿', 8, TRUE, FALSE),
  ('ETH', 'Ethereum', 'crypto', 'Ξ', 8, TRUE, FALSE),
  ('USDT', 'Tether USD', 'crypto', 'USDT', 6, TRUE, FALSE),
  ('USDC', 'USD Coin', 'crypto', 'USDC', 6, TRUE, FALSE),
  ('XRP', 'XRP', 'crypto', 'XRP', 8, TRUE, FALSE),
  ('ADA', 'Cardano', 'crypto', 'ADA', 8, TRUE, FALSE),
  ('SOL', 'Solana', 'crypto', 'SOL', 8, TRUE, FALSE),
  ('DOGE', 'Dogecoin', 'crypto', 'Ð', 8, TRUE, FALSE),
  ('MATIC', 'Polygon', 'crypto', 'MATIC', 8, TRUE, FALSE),
  ('LINK', 'Chainlink', 'crypto', 'LINK', 8, TRUE, FALSE),
  ('LTC', 'Litecoin', 'crypto', 'Ł', 8, TRUE, FALSE),
  ('BCH', 'Bitcoin Cash', 'crypto', 'BCH', 8, TRUE, FALSE),
  ('SHIB', 'Shiba Inu', 'crypto', 'SHIB', 8, TRUE, FALSE),
  ('AVAX', 'Avalanche', 'crypto', 'AVAX', 8, TRUE, FALSE),
  ('DOT', 'Polkadot', 'crypto', 'DOT', 8, TRUE, FALSE)
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type,
  active = TRUE;

-- Step 2: Fix all existing wallets - set type based on currency_code mapping
UPDATE public.wallets w
SET type = c.type
FROM public.currencies c
WHERE w.currency_code = c.code
  AND (w.type IS NULL OR w.type != c.type);

-- Step 3: For any wallets with unknown currency, default to 'fiat'
UPDATE public.wallets
SET type = 'fiat'
WHERE type IS NULL;

-- Step 4: Improve the trigger function to always get type from currencies table
DROP TRIGGER IF EXISTS wallet_type_trigger ON public.wallets;

CREATE OR REPLACE FUNCTION public.set_wallet_type()
RETURNS TRIGGER AS $$
DECLARE
  v_currency_type TEXT;
BEGIN
  -- Always get type from currency table based on currency_code
  SELECT type INTO v_currency_type
  FROM public.currencies
  WHERE code = NEW.currency_code
  LIMIT 1;

  -- Set the wallet type to the currency's type, default to 'fiat' if not found
  NEW.type := COALESCE(v_currency_type, 'fiat');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Recreate trigger on INSERT
CREATE TRIGGER wallet_type_trigger
BEFORE INSERT ON public.wallets
FOR EACH ROW
EXECUTE FUNCTION public.set_wallet_type();

-- ============================================================================
-- END MIGRATION 080
-- ============================================================================
