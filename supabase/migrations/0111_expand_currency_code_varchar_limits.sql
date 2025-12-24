-- ============================================================================
-- MIGRATION 0111: Expand Currency Code VARCHAR Limits
-- ============================================================================
-- This migration fixes the issue where cryptocurrency wallets with 4+ character
-- codes (like AVAX, USDT, USDC, DOGE, LINK, HBAR, PEPE, SHIB) were failing to
-- be created or used in various payment tables.
--
-- Problem: Multiple tables had currency VARCHAR(3) which only supports 3-character
-- currency codes like 'PHP', 'USD', 'EUR'. Cryptocurrencies require up to 16 chars.
--
-- Solution: Change all VARCHAR(3) currency columns to VARCHAR(16) to match the
-- currencies table's code column size.
-- ============================================================================

BEGIN;

-- Step 1: Payments table
ALTER TABLE IF EXISTS public.payments
  ALTER COLUMN currency TYPE VARCHAR(16);

-- Step 2: Payment intents table
ALTER TABLE IF EXISTS public.payment_intents
  ALTER COLUMN currency TYPE VARCHAR(16);

-- Step 3: Invoices table
ALTER TABLE IF EXISTS public.invoices
  ALTER COLUMN currency TYPE VARCHAR(16);

-- Step 4: Deposits table
ALTER TABLE IF EXISTS public.deposits
  ALTER COLUMN currency TYPE VARCHAR(16);

-- Step 5: Payment links table
ALTER TABLE IF EXISTS public.payment_links
  ALTER COLUMN currency TYPE VARCHAR(16);

-- Step 6: Escrow payments table
ALTER TABLE IF EXISTS public.escrow_payments
  ALTER COLUMN currency TYPE VARCHAR(16);

-- Step 7: Ride requests table
ALTER TABLE IF EXISTS public.ride_requests
  ALTER COLUMN currency TYPE VARCHAR(16);

-- Step 8: Commitments table
ALTER TABLE IF EXISTS public.commitments
  ALTER COLUMN currency TYPE VARCHAR(16);

-- Step 9: Alibaba products table (original_currency)
ALTER TABLE IF EXISTS public.alibaba_products
  ALTER COLUMN original_currency TYPE VARCHAR(16);

-- Step 10: Shop products table
ALTER TABLE IF EXISTS public.shop_products
  ALTER COLUMN currency TYPE VARCHAR(16);

-- Step 11: Industrial products table
ALTER TABLE IF EXISTS public.industrial_products
  ALTER COLUMN currency TYPE VARCHAR(16);

-- Step 12: Shop customer addresses table (preferred_currency)
ALTER TABLE IF EXISTS public.shop_customer_addresses
  ALTER COLUMN preferred_currency TYPE VARCHAR(16);

-- Step 13: Orders table (shop)
ALTER TABLE IF EXISTS public.orders
  ALTER COLUMN currency TYPE VARCHAR(16);

-- Step 14: Product orders table
ALTER TABLE IF EXISTS public.product_orders
  ALTER COLUMN currency TYPE VARCHAR(16);

-- Step 15: Payment gateways table (if exists)
ALTER TABLE IF EXISTS public.payment_gateways
  ALTER COLUMN default_settlement_currency TYPE VARCHAR(16);

-- Step 16: Extended ride payments (if exists)
ALTER TABLE IF EXISTS public.extended_ride_payments
  ALTER COLUMN currency TYPE VARCHAR(16);

-- Step 17: Comprehensive schema hardening currency fields (if exists)
ALTER TABLE IF EXISTS public.transfers
  ALTER COLUMN currency TYPE VARCHAR(16);

-- Step 18: Multi-wallet consolidation currency fields
ALTER TABLE IF EXISTS public.multi_wallet_currencies
  ALTER COLUMN code TYPE VARCHAR(16);

-- Step 19: Verify constraints still work
-- All tables should have CHECK constraints that validate against the currencies table
-- or CHECK constraints for specific currency codes. These should remain functional.

-- Step 20: Create index for faster currency lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_payments_currency ON public.payments(currency);
CREATE INDEX IF NOT EXISTS idx_payment_intents_currency ON public.payment_intents(currency);
CREATE INDEX IF NOT EXISTS idx_invoices_currency ON public.invoices(currency);
CREATE INDEX IF NOT EXISTS idx_deposits_currency ON public.deposits(currency);
CREATE INDEX IF NOT EXISTS idx_escrow_payments_currency ON public.escrow_payments(currency);

-- Step 21: Document the change (informational comment)
COMMENT ON COLUMN public.payments.currency IS 'ISO 4217 or crypto currency code (e.g., PHP, USD, EUR, BTC, AVAX, USDT)';
COMMENT ON COLUMN public.payment_intents.currency IS 'ISO 4217 or crypto currency code (e.g., PHP, USD, EUR, BTC, AVAX, USDT)';
COMMENT ON COLUMN public.invoices.currency IS 'ISO 4217 or crypto currency code (e.g., PHP, USD, EUR, BTC, AVAX, USDT)';
COMMENT ON COLUMN public.deposits.currency IS 'ISO 4217 or crypto currency code (e.g., PHP, USD, EUR, BTC, AVAX, USDT)';

COMMIT;
-- ============================================================================
-- END MIGRATION 0111
-- ============================================================================
