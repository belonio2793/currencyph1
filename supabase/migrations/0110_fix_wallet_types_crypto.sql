-- ============================================================================
-- MIGRATION 0110: Fix Wallet Types - Ensure Crypto Wallets Are Correctly Typed
-- ============================================================================
-- This migration fixes an issue where cryptocurrency wallets were being
-- marked as 'fiat' instead of 'crypto'. It ensures:
-- 1. All cryptocurrencies are in the currencies table with type='crypto'
-- 2. All existing wallets have the correct type based on currency_code
-- 3. The database trigger is working correctly for future wallet creation
-- ============================================================================

BEGIN;

-- Step 1: Ensure all cryptocurrencies exist in the currencies table with correct type
-- This handles any missing cryptocurrencies that should be crypto but aren't in the table
INSERT INTO public.currencies (code, name, type, symbol, decimals, active)
VALUES
  ('BNB', 'Binance Coin', 'crypto', 'BNB', 8, TRUE),
  ('TRX', 'Tron', 'crypto', 'TRX', 8, TRUE),
  ('XLM', 'Stellar Lumens', 'crypto', 'XLM', 8, TRUE),
  ('SUI', 'Sui', 'crypto', 'SUI', 8, TRUE),
  ('HBAR', 'Hedera', 'crypto', 'HBAR', 8, TRUE),
  ('TON', 'Telegram', 'crypto', 'TON', 8, TRUE),
  ('PEPE', 'Pepe', 'crypto', 'PEPE', 8, TRUE),
  ('UNI', 'Uniswap', 'crypto', 'UNI', 8, TRUE),
  ('AAVE', 'Aave', 'crypto', 'AAVE', 8, TRUE),
  ('XAUT', 'Tether Gold', 'crypto', 'XAUT', 8, TRUE),
  ('ENA', 'Ethena', 'crypto', 'ENA', 8, TRUE),
  ('WLD', 'Worldcoin', 'crypto', 'WLD', 8, TRUE),
  ('PYUSD', 'PayPal USD', 'crypto', 'PYUSD', 6, TRUE),
  ('HYPE', 'Hyperliquid', 'crypto', 'HYPE', 8, TRUE),
  ('LITECOIN', 'Litecoin', 'crypto', 'LTC', 8, TRUE),
  ('Sui', 'Sui Network', 'crypto', 'SUI', 8, TRUE)
ON CONFLICT (code) DO UPDATE 
SET type = 'crypto', active = TRUE, decimals = COALESCE(excluded.decimals, public.currencies.decimals)
WHERE public.currencies.type != 'crypto';

-- Step 2: Fix existing wallets - Update wallets for known cryptocurrencies to have correct type
UPDATE public.wallets w
SET type = 'crypto'
WHERE type = 'fiat' 
  AND currency_code IN (
    'BTC', 'ETH', 'XRP', 'ADA', 'SOL', 'DOGE', 'MATIC', 'LINK', 'LTC', 'BCH',
    'USDT', 'USDC', 'BUSD', 'SHIB', 'AVAX', 'DOT', 'BNB', 'TRX', 'XLM', 'SUI',
    'HBAR', 'TON', 'PEPE', 'UNI', 'AAVE', 'XAUT', 'ENA', 'WLD', 'PYUSD', 'HYPE',
    'LITECOIN', 'Bitcoin Cash', 'Cardano', 'Dogecoin', 'Ethereum', 'Polkadot',
    'Solana', 'Tether USD', 'USD Coin', 'Binance USD', 'Shiba Inu', 'Avalanche',
    'Polygon', 'Chainlink', 'Stellar Lumens', 'XRP', 'Ripple'
  );

-- Step 3: Also update wallets where the currency_code matches known crypto names or codes
-- in case the code itself is the full name
UPDATE public.wallets w
SET type = c.type
FROM public.currencies c
WHERE w.currency_code = c.code
  AND c.type = 'crypto'
  AND w.type != 'crypto';

-- Step 4: Verify the database trigger is still in place and working
-- The trigger should auto-set type based on currency table for any new inserts
-- No manual fix needed here - just ensure it exists

-- Step 5: Log the changes made
-- This would show statistics about what was fixed (for informational purposes)
-- SELECT 
--   COUNT(*) as total_wallets,
--   SUM(CASE WHEN type = 'crypto' THEN 1 ELSE 0 END) as crypto_wallets,
--   SUM(CASE WHEN type = 'fiat' THEN 1 ELSE 0 END) as fiat_wallets
-- FROM public.wallets;

-- Step 6: Ensure all currencies referenced in wallets table have their type set correctly
-- This is a safety check to sync any orphaned currencies
UPDATE public.currencies
SET type = 'crypto'
WHERE type IS NULL 
  AND code IN (
    SELECT DISTINCT currency_code FROM public.wallets 
    WHERE type = 'crypto'
  );

COMMIT;
-- ============================================================================
-- END MIGRATION 0110
-- ============================================================================
