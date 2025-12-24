-- ============================================================================
-- MIGRATION 0140: Comprehensive Cryptocurrency Wallet Type Fix
-- ============================================================================
-- This migration ensures:
-- 1. All cryptocurrencies exist in currencies table with type='crypto'
-- 2. All fiat currencies exist with type='fiat'
-- 3. All existing wallets have correct type based on currency
-- 4. Future wallet creation validates against currencies table
-- ============================================================================

BEGIN;

-- Step 1: Ensure all major cryptocurrencies exist with correct type
INSERT INTO public.currencies (code, name, type, symbol, decimals, active)
VALUES
  -- Bitcoin and variants
  ('BTC', 'Bitcoin', 'crypto', '₿', 8, TRUE),
  ('BCH', 'Bitcoin Cash', 'crypto', 'BCH', 8, TRUE),
  
  -- Ethereum and Layer 2s
  ('ETH', 'Ethereum', 'crypto', 'Ξ', 8, TRUE),
  ('MATIC', 'Polygon', 'crypto', 'MATIC', 8, TRUE),
  ('ARB', 'Arbitrum', 'crypto', 'ARB', 8, TRUE),
  ('OP', 'Optimism', 'crypto', 'OP', 8, TRUE),
  
  -- Stablecoins
  ('USDT', 'Tether USD', 'crypto', 'USDT', 6, TRUE),
  ('USDC', 'USD Coin', 'crypto', 'USDC', 6, TRUE),
  ('BUSD', 'Binance USD', 'crypto', 'BUSD', 6, TRUE),
  ('DAI', 'Dai', 'crypto', 'DAI', 6, TRUE),
  ('PYUSD', 'PayPal USD', 'crypto', 'PYUSD', 6, TRUE),
  
  -- Major altcoins
  ('XRP', 'XRP', 'crypto', 'XRP', 8, TRUE),
  ('ADA', 'Cardano', 'crypto', 'ADA', 8, TRUE),
  ('SOL', 'Solana', 'crypto', 'SOL', 8, TRUE),
  ('DOGE', 'Dogecoin', 'crypto', 'Ð', 8, TRUE),
  ('SHIB', 'Shiba Inu', 'crypto', 'SHIB', 8, TRUE),
  ('LTC', 'Litecoin', 'crypto', 'Ł', 8, TRUE),
  
  -- DeFi tokens
  ('UNI', 'Uniswap', 'crypto', 'UNI', 8, TRUE),
  ('AAVE', 'Aave', 'crypto', 'AAVE', 8, TRUE),
  ('LINK', 'Chainlink', 'crypto', 'LINK', 8, TRUE),
  ('SUSHI', 'SushiSwap', 'crypto', 'SUSHI', 8, TRUE),
  ('CURVE', 'Curve', 'crypto', 'CRV', 8, TRUE),
  
  -- Smart contracts / Layer 1s
  ('DOT', 'Polkadot', 'crypto', 'DOT', 8, TRUE),
  ('AVAX', 'Avalanche', 'crypto', 'AVAX', 8, TRUE),
  ('NEAR', 'Near', 'crypto', 'NEAR', 8, TRUE),
  ('ATOM', 'Cosmos', 'crypto', 'ATOM', 8, TRUE),
  ('TRX', 'Tron', 'crypto', 'TRX', 8, TRUE),
  
  -- Emerging / Newer
  ('SUI', 'Sui', 'crypto', 'SUI', 8, TRUE),
  ('SEI', 'Sei', 'crypto', 'SEI', 8, TRUE),
  ('XLM', 'Stellar Lumens', 'crypto', 'XLM', 8, TRUE),
  ('HBAR', 'Hedera', 'crypto', 'HBAR', 8, TRUE),
  ('TON', 'Telegram Open Network', 'crypto', 'TON', 8, TRUE),
  ('WLD', 'Worldcoin', 'crypto', 'WLD', 8, TRUE),
  ('ENA', 'Ethena', 'crypto', 'ENA', 8, TRUE),
  ('PEPE', 'Pepe', 'crypto', 'PEPE', 8, TRUE),
  ('HYPE', 'Hyperliquid', 'crypto', 'HYPE', 8, TRUE),
  ('XAUT', 'Tether Gold', 'crypto', 'XAUT', 8, TRUE),
  ('ASTER', 'Astar', 'crypto', 'ASTR', 8, TRUE),
  ('BNB', 'Binance Coin', 'crypto', 'BNB', 8, TRUE),
  ('SKY', 'Sky', 'crypto', 'SKY', 8, TRUE)
ON CONFLICT (code) DO UPDATE 
SET 
  type = CASE WHEN EXCLUDED.type = 'crypto' THEN 'crypto' ELSE public.currencies.type END,
  active = TRUE,
  decimals = COALESCE(EXCLUDED.decimals, public.currencies.decimals)
WHERE public.currencies.type IS NULL OR public.currencies.type != 'crypto';

-- Step 2: Fix all existing wallets with wrong type (fiat marked as crypto currencies)
-- Create list of all known cryptocurrency codes
WITH crypto_codes AS (
  SELECT DISTINCT code FROM public.currencies WHERE type = 'crypto'
)
UPDATE public.wallets w
SET type = 'crypto'
WHERE type != 'crypto' 
  AND currency_code IN (SELECT code FROM crypto_codes);

-- Step 3: Ensure wallets match their currency's type precisely
UPDATE public.wallets w
SET type = c.type
FROM public.currencies c
WHERE w.currency_code = c.code
  AND w.type != c.type;

-- Step 4: Verify and log any wallets with missing currency references
-- (These should not exist due to FK constraint, but check anyway)
SELECT 
  w.id,
  w.user_id,
  w.currency_code,
  w.type,
  c.type AS currency_type,
  CASE 
    WHEN c.type IS NULL THEN 'ORPHANED - Currency not found'
    WHEN c.active = FALSE THEN 'INACTIVE - Currency marked as inactive'
    WHEN w.type != c.type THEN 'TYPE_MISMATCH - Wallet type does not match currency type'
    ELSE 'OK'
  END AS status
FROM public.wallets w
LEFT JOIN public.currencies c ON w.currency_code = c.code
WHERE c.type IS NULL OR c.active = FALSE OR w.type != c.type
ORDER BY w.currency_code, w.user_id
LIMIT 100;

-- Step 5: Create trigger to enforce type validation on insert/update
-- Drop old trigger if exists
DROP TRIGGER IF EXISTS wallet_type_validation_trigger ON public.wallets;

-- Create function to validate wallet type matches currency
CREATE OR REPLACE FUNCTION public.validate_wallet_type()
RETURNS TRIGGER AS $$
BEGIN
  -- First, try to get type from currency table
  IF NEW.type IS NULL THEN
    SELECT type INTO NEW.type
    FROM public.currencies
    WHERE code = NEW.currency_code;
    
    -- Default to 'fiat' if currency not found (but this should not happen with FK)
    IF NEW.type IS NULL THEN
      NEW.type := 'fiat';
    END IF;
  ELSE
    -- Verify the type matches what's in the currency table
    DECLARE
      expected_type TEXT;
    BEGIN
      SELECT type INTO expected_type
      FROM public.currencies
      WHERE code = NEW.currency_code;
      
      -- If currency exists, type must match
      IF expected_type IS NOT NULL AND NEW.type != expected_type THEN
        RAISE EXCEPTION 'Wallet type (%) does not match currency type (%) for currency %',
          NEW.type, expected_type, NEW.currency_code;
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that runs BEFORE INSERT and BEFORE UPDATE
CREATE TRIGGER wallet_type_validation_trigger
BEFORE INSERT OR UPDATE ON public.wallets
FOR EACH ROW
EXECUTE FUNCTION public.validate_wallet_type();

-- Step 6: Ensure all active fiat currencies are properly configured
INSERT INTO public.currencies (code, name, type, symbol, decimals, active)
VALUES
  ('PHP', 'Philippine Peso', 'fiat', '₱', 2, TRUE),
  ('USD', 'US Dollar', 'fiat', '$', 2, TRUE),
  ('EUR', 'Euro', 'fiat', '€', 2, TRUE),
  ('GBP', 'British Pound', 'fiat', '£', 2, TRUE),
  ('JPY', 'Japanese Yen', 'fiat', '¥', 0, TRUE),
  ('CNY', 'Chinese Yuan', 'fiat', '¥', 2, TRUE),
  ('INR', 'Indian Rupee', 'fiat', '₹', 2, TRUE),
  ('AUD', 'Australian Dollar', 'fiat', '$', 2, TRUE),
  ('CAD', 'Canadian Dollar', 'fiat', '$', 2, TRUE),
  ('CHF', 'Swiss Franc', 'fiat', 'CHF', 2, TRUE),
  ('SEK', 'Swedish Krona', 'fiat', 'kr', 2, TRUE),
  ('NZD', 'New Zealand Dollar', 'fiat', '$', 2, TRUE),
  ('SGD', 'Singapore Dollar', 'fiat', '$', 2, TRUE),
  ('HKD', 'Hong Kong Dollar', 'fiat', '$', 2, TRUE),
  ('IDR', 'Indonesian Rupiah', 'fiat', 'Rp', 0, TRUE),
  ('MYR', 'Malaysian Ringgit', 'fiat', 'RM', 2, TRUE),
  ('THB', 'Thai Baht', 'fiat', '฿', 2, TRUE),
  ('VND', 'Vietnamese Dong', 'fiat', '₫', 0, TRUE),
  ('KRW', 'South Korean Won', 'fiat', '₩', 0, TRUE),
  ('ZAR', 'South African Rand', 'fiat', 'R', 2, TRUE),
  ('BRL', 'Brazilian Real', 'fiat', 'R$', 2, TRUE),
  ('MXN', 'Mexican Peso', 'fiat', '$', 2, TRUE),
  ('NOK', 'Norwegian Krone', 'fiat', 'kr', 2, TRUE),
  ('DKK', 'Danish Krone', 'fiat', 'kr', 2, TRUE),
  ('AED', 'UAE Dirham', 'fiat', 'د.إ', 2, TRUE)
ON CONFLICT (code) DO UPDATE 
SET 
  type = EXCLUDED.type,
  active = TRUE,
  decimals = COALESCE(EXCLUDED.decimals, public.currencies.decimals)
WHERE public.currencies.type IS NULL OR public.currencies.type != 'fiat';

COMMIT;

-- ============================================================================
-- END MIGRATION 0140
-- ============================================================================
