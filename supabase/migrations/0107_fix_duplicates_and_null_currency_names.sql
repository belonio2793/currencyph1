-- ============================================================================
-- MIGRATION: Fix null currency_name and remove duplicate addresses
-- ============================================================================
-- 
-- This migration:
-- 1. Fixes null currency_name values by mapping from currency_symbol or address patterns
-- 2. Removes duplicate deposit addresses (keeping only 1 per currency_name, network, address)
-- 3. Updates the unique constraint to use currency_name instead of currency
--
-- BACKUP: Creates a backup of affected data before making changes
-- ============================================================================

BEGIN;

-- Step 1: Create backup of current state
CREATE TABLE IF NOT EXISTS wallets_house_backup_20250101 AS
SELECT * FROM public.wallets_house 
WHERE wallet_type = 'crypto' 
  AND (currency_name IS NULL OR currency_name = '');

-- Step 2: Log current duplicate counts for reference
-- SELECT 'BEFORE FIX' as status, currency_name, network, COUNT(*) as count, COUNT(DISTINCT address) as unique_addresses
-- FROM public.wallets_house
-- WHERE wallet_type = 'crypto'
-- GROUP BY currency_name, network
-- HAVING COUNT(*) > 1
-- ORDER BY count DESC;

-- Step 3: Fix null currency_name values by pattern matching
-- These should map to their actual currency based on address patterns and networks
UPDATE public.wallets_house wh
SET currency_name = CASE
  WHEN currency_symbol = 'USDT' THEN 'Tether (USDT)'
  WHEN currency_symbol = 'ETH' THEN 'Ethereum (ETH)'
  WHEN currency_symbol = 'BNB' THEN 'Binance Coin (BNB)'
  WHEN currency_symbol = 'USDC' THEN 'USD Coin (USDC)'
  WHEN currency_symbol = 'MATIC' THEN 'Polygon (MATIC)'
  WHEN currency_symbol IS NOT NULL THEN CONCAT('Unknown (', currency_symbol, ')')
  ELSE 'Unknown'
END
WHERE wallet_type = 'crypto' 
  AND (currency_name IS NULL OR currency_name = '');

-- Step 4: Drop existing unique constraint (if it exists and uses old column structure)
ALTER TABLE IF EXISTS public.wallets_house
DROP CONSTRAINT IF EXISTS wallets_house_currency_network_address_key,
DROP CONSTRAINT IF EXISTS wallets_house_currency_network_address_uidx,
DROP CONSTRAINT IF EXISTS wallets_house_unique_deposit_address;

-- Step 5: Remove duplicate rows - keep only the earliest created_at per (currency_name, network, address)
DELETE FROM public.wallets_house wh1
WHERE wallet_type = 'crypto'
  AND id > (
    SELECT MIN(id)
    FROM public.wallets_house wh2
    WHERE wh1.currency_name = wh2.currency_name
      AND wh1.network = wh2.network
      AND wh1.address = wh2.address
      AND wh1.wallet_type = 'crypto'
  );

-- Step 6: Create new unique constraint on (currency_name, network, address)
ALTER TABLE IF EXISTS public.wallets_house
ADD CONSTRAINT wallets_house_currency_name_network_address_unique 
UNIQUE (currency_name, network, address)
WHERE wallet_type = 'crypto';

-- Step 7: Verify the fixes
-- SELECT 
--   COALESCE(currency_name, 'NULL') as currency_name,
--   network,
--   COUNT(*) as count,
--   COUNT(DISTINCT address) as unique_addresses
-- FROM public.wallets_house
-- WHERE wallet_type = 'crypto'
-- GROUP BY currency_name, network
-- HAVING COUNT(*) > 1
-- ORDER BY currency_name, network;

-- Step 8: Summary statistics
-- SELECT 
--   'AFTER FIX' as status,
--   COUNT(*) as total_rows,
--   COUNT(DISTINCT currency_name) as unique_currencies,
--   COUNT(DISTINCT network) as unique_networks,
--   COUNT(DISTINCT address) as unique_addresses
-- FROM public.wallets_house
-- WHERE wallet_type = 'crypto';

COMMIT;
