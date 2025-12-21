-- Migration: Drop currency column and use currency_name in wallets_house
-- This migration removes the short currency code column and makes currency_name the primary identifier
-- 
-- STEPS:
-- 1. Create a backup of current data
-- 2. Drop existing indexes that reference currency column
-- 3. Drop the unique constraint that uses currency
-- 4. Ensure currency_name is populated correctly
-- 5. Drop the currency column
-- 6. Create new unique constraint using currency_name
-- 7. Recreate indexes with currency_name

BEGIN;

-- Step 1: Create a backup table with all current data
-- This allows rollback if needed
CREATE TABLE IF NOT EXISTS wallets_house_backup_before_currency_drop AS
SELECT * FROM public.wallets_house;

-- Step 2: Drop existing unique constraint on (currency, network, address)
ALTER TABLE IF EXISTS public.wallets_house 
DROP CONSTRAINT IF EXISTS wallets_house_currency_network_address_key;

-- Step 3: Update currency_name to ensure all rows have proper full names
-- For rows where currency_name might be null or only contain code, ensure they have the full name
UPDATE public.wallets_house wh
SET currency_name = CONCAT(c.name, ' (', wh.currency, ')')
FROM public.currencies c
WHERE wh.currency = c.code 
  AND c.type = 'crypto' 
  AND c.active = true
  AND (wh.currency_name IS NULL OR wh.currency_name = wh.currency);

-- Step 4: For rows without a matching currency record, use currency as currency_name
UPDATE public.wallets_house
SET currency_name = currency
WHERE currency_name IS NULL OR currency_name = '';

-- Step 5: Drop the currency column (keeping currency_name and currency_symbol)
ALTER TABLE IF EXISTS public.wallets_house 
DROP COLUMN IF EXISTS currency;

-- Step 6: Make currency_name NOT NULL if it isn't already
ALTER TABLE IF EXISTS public.wallets_house
ALTER COLUMN currency_name SET NOT NULL;

-- Step 7: Create new unique constraint using currency_name instead of currency
ALTER TABLE IF EXISTS public.wallets_house
ADD CONSTRAINT wallets_house_currency_name_network_address_key 
UNIQUE (currency_name, network, address);

-- Step 8: Drop old currency-based indexes and recreate with currency_name
DROP INDEX IF EXISTS public.idx_wallets_house_currency;
CREATE INDEX IF NOT EXISTS idx_wallets_house_currency_name 
ON public.wallets_house (currency_name)
WHERE wallet_type = 'crypto';

-- Step 9: Verify the migration
-- SELECT COUNT(*) as total_rows, COUNT(DISTINCT currency_name) as unique_currencies
-- FROM public.wallets_house
-- WHERE wallet_type = 'crypto';

COMMIT;
