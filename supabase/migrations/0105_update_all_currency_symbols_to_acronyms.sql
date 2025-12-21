-- Migration: Update all currency symbols to acronyms across all tables
-- This migration updates currency symbols from special unicode characters to the currency code
-- Example: ₿ -> BTC, Ξ -> ETH, USDT -> USDT

BEGIN;

-- Step 1: Update currencies table to use acronyms as symbols
UPDATE public.currencies
SET symbol = code
WHERE type = 'crypto' AND symbol != code;

-- Step 2: Update wallets_house table currency_symbol to use acronyms
UPDATE public.wallets_house wh
SET currency_symbol = c.code
FROM public.currencies c
WHERE wh.currency = c.code AND c.type = 'crypto';

-- Step 3: Fallback for any wallets_house rows where currencies don't exist - use currency code as symbol
UPDATE public.wallets_house
SET currency_symbol = currency
WHERE wallet_type = 'crypto' AND (currency_symbol IS NULL OR currency_symbol ~ '[^\w\-]');

-- Step 4: Verify the updates
-- SELECT DISTINCT currency, currency_symbol FROM wallets_house WHERE wallet_type = 'crypto' ORDER BY currency;
-- SELECT code, symbol FROM currencies WHERE type = 'crypto' ORDER BY code;

COMMIT;
