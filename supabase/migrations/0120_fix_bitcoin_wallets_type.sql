-- ============================================================================
-- MIGRATION 0120: Fix Bitcoin and Bitcoin Cash wallet types
-- ============================================================================
-- This migration fixes wallets where BTC and BCH are incorrectly marked as 'fiat'
-- instead of 'crypto'
-- ============================================================================

-- Step 1: Ensure BTC and BCH exist in currencies table with correct type
INSERT INTO public.currencies (code, name, type, symbol, decimals, active, is_default) 
VALUES 
  ('BTC', 'Bitcoin', 'crypto', '₿', 8, TRUE, FALSE),
  ('BCH', 'Bitcoin Cash', 'crypto', 'BCH', 8, TRUE, FALSE)
ON CONFLICT (code) DO UPDATE SET
  type = 'crypto',
  active = TRUE;

-- Step 2: Fix all existing BTC and BCH wallets to have type = 'crypto'
UPDATE public.wallets
SET type = 'crypto'
WHERE currency_code IN ('BTC', 'BCH')
  AND type != 'crypto';

-- Step 3: Verify the fix by showing affected wallets
-- This is informational and can be removed in production
-- SELECT id, user_id, currency_code, type, created_at 
-- FROM public.wallets 
-- WHERE currency_code IN ('BTC', 'BCH') 
-- ORDER BY created_at DESC
-- LIMIT 10;

-- Step 4: Ensure other major cryptocurrencies are also correct
INSERT INTO public.currencies (code, name, type, symbol, decimals, active, is_default) VALUES
  ('ETH', 'Ethereum', 'crypto', 'Ξ', 8, TRUE, FALSE),
  ('USDT', 'Tether USD', 'crypto', 'USDT', 6, TRUE, FALSE),
  ('USDC', 'USD Coin', 'crypto', 'USDC', 6, TRUE, FALSE),
  ('XRP', 'XRP', 'crypto', 'XRP', 8, TRUE, FALSE),
  ('ADA', 'Cardano', 'crypto', 'ADA', 8, TRUE, FALSE),
  ('SOL', 'Solana', 'crypto', 'SOL', 8, TRUE, FALSE),
  ('DOGE', 'Dogecoin', 'crypto', 'Ð', 8, TRUE, FALSE),
  ('MATIC', 'Polygon', 'crypto', 'MATIC', 8, TRUE, FALSE),
  ('LINK', 'Chainlink', 'crypto', 'LINK', 8, TRUE, FALSE),
  ('LTC', 'Litecoin', 'crypto', 'Ł', 8, TRUE, FALSE)
ON CONFLICT (code) DO UPDATE SET
  type = 'crypto',
  active = TRUE;

-- Step 5: Fix any wallets for these cryptocurrencies that might be marked as fiat
UPDATE public.wallets
SET type = 'crypto'
WHERE currency_code IN ('ETH', 'USDT', 'USDC', 'XRP', 'ADA', 'SOL', 'DOGE', 'MATIC', 'LINK', 'LTC')
  AND type != 'crypto';

-- ============================================================================
-- END MIGRATION 0120
-- ============================================================================
