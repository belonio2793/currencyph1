-- ============================================================================
-- MIGRATION 058: Create currencies table and add FK to wallets
-- ============================================================================
-- This migration:
-- 1. Creates the currencies table with all supported currencies
-- 2. Adds a foreign key constraint from wallets to currencies
-- 3. Sets up proper RLS policies
-- ============================================================================

-- Step 1: Create currencies table
CREATE TABLE IF NOT EXISTS public.currencies (
  code VARCHAR(16) PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('fiat', 'crypto')),
  symbol TEXT,
  decimals INTEGER DEFAULT 2,
  active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on active status
CREATE INDEX IF NOT EXISTS idx_currencies_active ON public.currencies(active);

-- Step 2: Insert all currencies (using UPSERT to allow re-running)
INSERT INTO public.currencies (code, name, type, symbol, decimals, is_default, active) VALUES
  ('PHP', 'Philippine Peso', 'fiat', '₱', 2, TRUE, TRUE),
  ('USD', 'US Dollar', 'fiat', '$', 2, FALSE, TRUE),
  ('EUR', 'Euro', 'fiat', '€', 2, FALSE, TRUE),
  ('GBP', 'British Pound', 'fiat', '£', 2, FALSE, TRUE),
  ('JPY', 'Japanese Yen', 'fiat', '¥', 0, FALSE, TRUE),
  ('CNY', 'Chinese Yuan', 'fiat', '¥', 2, FALSE, TRUE),
  ('INR', 'Indian Rupee', 'fiat', '₹', 2, FALSE, TRUE),
  ('AUD', 'Australian Dollar', 'fiat', '$', 2, FALSE, TRUE),
  ('CAD', 'Canadian Dollar', 'fiat', '$', 2, FALSE, TRUE),
  ('CHF', 'Swiss Franc', 'fiat', 'CHF', 2, FALSE, TRUE),
  ('SEK', 'Swedish Krona', 'fiat', 'kr', 2, FALSE, TRUE),
  ('NZD', 'New Zealand Dollar', 'fiat', '$', 2, FALSE, TRUE),
  ('SGD', 'Singapore Dollar', 'fiat', '$', 2, FALSE, TRUE),
  ('HKD', 'Hong Kong Dollar', 'fiat', '$', 2, FALSE, TRUE),
  ('IDR', 'Indonesian Rupiah', 'fiat', 'Rp', 0, FALSE, TRUE),
  ('MYR', 'Malaysian Ringgit', 'fiat', 'RM', 2, FALSE, TRUE),
  ('THB', 'Thai Baht', 'fiat', '฿', 2, FALSE, TRUE),
  ('VND', 'Vietnamese Dong', 'fiat', '₫', 0, FALSE, TRUE),
  ('KRW', 'South Korean Won', 'fiat', '₩', 0, FALSE, TRUE),
  ('ZAR', 'South African Rand', 'fiat', 'R', 2, FALSE, TRUE),
  ('BRL', 'Brazilian Real', 'fiat', 'R$', 2, FALSE, TRUE),
  ('MXN', 'Mexican Peso', 'fiat', '$', 2, FALSE, TRUE),
  ('NOK', 'Norwegian Krone', 'fiat', 'kr', 2, FALSE, TRUE),
  ('DKK', 'Danish Krone', 'fiat', 'kr', 2, FALSE, TRUE),
  ('AED', 'UAE Dirham', 'fiat', 'د.إ', 2, FALSE, TRUE),
  ('BTC', 'Bitcoin', 'crypto', '₿', 8, FALSE, TRUE),
  ('ETH', 'Ethereum', 'crypto', 'Ξ', 8, FALSE, TRUE),
  ('XRP', 'XRP', 'crypto', 'XRP', 8, FALSE, TRUE),
  ('ADA', 'Cardano', 'crypto', 'ADA', 8, FALSE, TRUE),
  ('SOL', 'Solana', 'crypto', 'SOL', 8, FALSE, TRUE),
  ('DOGE', 'Dogecoin', 'crypto', 'Ð', 8, FALSE, TRUE),
  ('MATIC', 'Polygon', 'crypto', 'MATIC', 8, FALSE, TRUE),
  ('LINK', 'Chainlink', 'crypto', 'LINK', 8, FALSE, TRUE),
  ('LTC', 'Litecoin', 'crypto', 'Ł', 8, FALSE, TRUE),
  ('BCH', 'Bitcoin Cash', 'crypto', 'BCH', 8, FALSE, TRUE),
  ('USDT', 'Tether USD', 'crypto', 'USDT', 6, FALSE, TRUE),
  ('USDC', 'USD Coin', 'crypto', 'USDC', 6, FALSE, TRUE),
  ('BUSD', 'Binance USD', 'crypto', 'BUSD', 6, FALSE, TRUE),
  ('SHIB', 'Shiba Inu', 'crypto', 'SHIB', 8, FALSE, TRUE),
  ('AVAX', 'Avalanche', 'crypto', 'AVAX', 8, FALSE, TRUE),
  ('DOT', 'Polkadot', 'crypto', 'DOT', 8, FALSE, TRUE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  symbol = EXCLUDED.symbol,
  decimals = EXCLUDED.decimals,
  active = EXCLUDED.active,
  is_default = EXCLUDED.is_default;

-- Step 3: Enable RLS on currencies (public read-only)
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Anyone can view active currencies" ON public.currencies;

-- Create policy allowing public to view active currencies
CREATE POLICY "Anyone can view active currencies" ON public.currencies
  FOR SELECT USING (active = TRUE);

-- Step 4: Add foreign key constraint to wallets if it doesn't exist
-- First check if the constraint already exists
DO $$
BEGIN
  -- Try to add the foreign key constraint
  ALTER TABLE public.wallets
  ADD CONSTRAINT wallets_currency_code_fk 
    FOREIGN KEY (currency_code) REFERENCES public.currencies(code)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
EXCEPTION WHEN OTHERS THEN
  -- Constraint may already exist or there's another issue, log it
  RAISE NOTICE 'Could not add FK constraint to wallets: %', SQLERRM;
END
$$;

-- Step 5: Create index on wallets for faster lookups
CREATE INDEX IF NOT EXISTS idx_wallets_active ON public.wallets(is_active) WHERE is_active = TRUE;

-- Step 6: Drop existing RLS policies on wallets if any
DROP POLICY IF EXISTS "Users can view own wallets" ON public.wallets;
DROP POLICY IF EXISTS "Users can insert own wallets" ON public.wallets;
DROP POLICY IF EXISTS "Users can update own wallets" ON public.wallets;

-- Step 7: Enable RLS on wallets
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Create new RLS policies
CREATE POLICY "Users can view own wallets" ON public.wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallets" ON public.wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wallets" ON public.wallets
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Step 8: Ensure wallets table has all required columns
-- Add columns if they don't exist
ALTER TABLE public.wallets
ADD COLUMN IF NOT EXISTS total_deposited NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_withdrawn NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS account_number VARCHAR(255);

-- ============================================================================
-- END MIGRATION 058
-- ============================================================================
