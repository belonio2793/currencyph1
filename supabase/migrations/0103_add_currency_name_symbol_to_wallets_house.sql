-- Migration: Add currency name and symbol columns to wallets_house
-- This migration adds denormalized currency_name and currency_symbol columns
-- to improve query performance and reduce JOIN operations

BEGIN;

-- Step 1: Add the new columns
ALTER TABLE IF EXISTS public.wallets_house
  ADD COLUMN IF NOT EXISTS currency_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(20);

-- Step 2: Populate currency_name and currency_symbol from the currencies table
UPDATE public.wallets_house wh
SET 
  currency_name = c.name,
  currency_symbol = c.symbol
FROM public.currencies c
WHERE wh.currency = c.code AND c.active = true;

-- Step 3: For any remaining null values (in case currency doesn't exist), set defaults
UPDATE public.wallets_house
SET 
  currency_name = COALESCE(currency_name, currency),
  currency_symbol = COALESCE(currency_symbol, currency)
WHERE currency_name IS NULL OR currency_symbol IS NULL;

-- Step 4: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_wallets_house_currency_name 
ON public.wallets_house (currency_name) 
WHERE wallet_type = 'crypto';

CREATE INDEX IF NOT EXISTS idx_wallets_house_currency_symbol 
ON public.wallets_house (currency_symbol) 
WHERE wallet_type = 'crypto';

-- Step 5: Verify the data
-- SELECT currency, currency_name, currency_symbol FROM wallets_house 
-- WHERE wallet_type = 'crypto' 
-- LIMIT 10;

COMMIT;
