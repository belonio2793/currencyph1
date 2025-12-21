-- Migration: Fix currency symbols to use acronyms instead of actual symbols
-- This migration updates the currencies table to use the cryptocurrency code as the symbol
-- instead of special unicode symbols (e.g., ₿ -> BTC, Ξ -> ETH)

BEGIN;

-- Step 1: Update all cryptocurrency symbols to their acronyms
UPDATE public.currencies
SET symbol = code
WHERE type = 'crypto';

-- Step 2: Verify the update
-- SELECT code, name, symbol, type FROM currencies WHERE type = 'crypto' ORDER BY code;

COMMIT;
