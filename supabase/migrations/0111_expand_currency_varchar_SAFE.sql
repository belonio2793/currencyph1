-- ============================================================================
-- MIGRATION 0111: Safely Expand VARCHAR(3) Currency Columns to VARCHAR(16)
-- ============================================================================
-- This migration SAFELY and CONDITIONALLY expands currency columns
-- only on tables where they actually exist.
--
-- KEY: The deposits table uses currency_code VARCHAR(16) - NOT affected
-- Only simple "currency" VARCHAR(3) columns on payment/order tables get expanded
-- ============================================================================

BEGIN;

-- ============================================================================
-- PAYMENT TABLES - Expand "currency" column if it exists
-- ============================================================================

DO $$
BEGIN
  -- payments table
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='payments' AND column_name='currency') THEN
    ALTER TABLE public.payments ALTER COLUMN currency TYPE VARCHAR(16);
  END IF;
  
  -- payment_intents table
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='payment_intents' AND column_name='currency') THEN
    ALTER TABLE public.payment_intents ALTER COLUMN currency TYPE VARCHAR(16);
  END IF;
  
  -- invoices table
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='invoices' AND column_name='currency') THEN
    ALTER TABLE public.invoices ALTER COLUMN currency TYPE VARCHAR(16);
  END IF;
  
  -- payment_links table
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='payment_links' AND column_name='currency') THEN
    ALTER TABLE public.payment_links ALTER COLUMN currency TYPE VARCHAR(16);
  END IF;
  
  -- escrow_payments table
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='escrow_payments' AND column_name='currency') THEN
    ALTER TABLE public.escrow_payments ALTER COLUMN currency TYPE VARCHAR(16);
  END IF;
END $$;

-- ============================================================================
-- ORDER TABLES - Expand "currency" column if it exists
-- ============================================================================

DO $$
BEGIN
  -- orders table
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='orders' AND column_name='currency') THEN
    ALTER TABLE public.orders ALTER COLUMN currency TYPE VARCHAR(16);
  END IF;
  
  -- product_orders table
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='product_orders' AND column_name='currency') THEN
    ALTER TABLE public.product_orders ALTER COLUMN currency TYPE VARCHAR(16);
  END IF;
END $$;

-- ============================================================================
-- PRODUCT/SHOP TABLES - Expand "currency" column if it exists
-- ============================================================================

DO $$
BEGIN
  -- shop_products table
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='shop_products' AND column_name='currency') THEN
    ALTER TABLE public.shop_products ALTER COLUMN currency TYPE VARCHAR(16);
  END IF;
  
  -- industrial_products table
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='industrial_products' AND column_name='currency') THEN
    ALTER TABLE public.industrial_products ALTER COLUMN currency TYPE VARCHAR(16);
  END IF;
  
  -- shop_customer_addresses table - preferred_currency
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='shop_customer_addresses' AND column_name='preferred_currency') THEN
    ALTER TABLE public.shop_customer_addresses ALTER COLUMN preferred_currency TYPE VARCHAR(16);
  END IF;
END $$;

-- ============================================================================
-- RIDE/COMMITMENT TABLES - Expand "currency" column if it exists
-- ============================================================================

DO $$
BEGIN
  -- ride_requests table
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='ride_requests' AND column_name='currency') THEN
    ALTER TABLE public.ride_requests ALTER COLUMN currency TYPE VARCHAR(16);
  END IF;
  
  -- commitments table
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='commitments' AND column_name='currency') THEN
    ALTER TABLE public.commitments ALTER COLUMN currency TYPE VARCHAR(16);
  END IF;
  
  -- extended_ride_payments table
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='extended_ride_payments' AND column_name='currency') THEN
    ALTER TABLE public.extended_ride_payments ALTER COLUMN currency TYPE VARCHAR(16);
  END IF;
END $$;

-- ============================================================================
-- INTEGRATION TABLES - Expand various currency columns if they exist
-- ============================================================================

DO $$
BEGIN
  -- alibaba_products - original_currency
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='alibaba_products' AND column_name='original_currency') THEN
    ALTER TABLE public.alibaba_products ALTER COLUMN original_currency TYPE VARCHAR(16);
  END IF;
  
  -- payment_gateways - default_settlement_currency
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='payment_gateways' AND column_name='default_settlement_currency') THEN
    ALTER TABLE public.payment_gateways ALTER COLUMN default_settlement_currency TYPE VARCHAR(16);
  END IF;
  
  -- transfers - currency (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='transfers' AND column_name='currency') THEN
    ALTER TABLE public.transfers ALTER COLUMN currency TYPE VARCHAR(16);
  END IF;
END $$;

-- ============================================================================
-- NOTE ON DEPOSITS TABLE
-- ============================================================================
-- The deposits table was created with currency_code VARCHAR(16) from the start
-- It does NOT have a simple "currency" VARCHAR(3) column
-- Therefore, deposits table is NOT altered by this migration
-- To verify: SELECT column_name, data_type FROM information_schema.columns
--           WHERE table_name='deposits' AND column_name LIKE '%currency%';

-- ============================================================================
-- CREATE HELPFUL INDEXES
-- ============================================================================

DO $$
BEGIN
  -- Create indexes only if table and column exist
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='payments' AND column_name='currency') THEN
    CREATE INDEX IF NOT EXISTS idx_payments_currency ON public.payments(currency);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='payment_intents' AND column_name='currency') THEN
    CREATE INDEX IF NOT EXISTS idx_payment_intents_currency ON public.payment_intents(currency);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='invoices' AND column_name='currency') THEN
    CREATE INDEX IF NOT EXISTS idx_invoices_currency ON public.invoices(currency);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='orders' AND column_name='currency') THEN
    CREATE INDEX IF NOT EXISTS idx_orders_currency ON public.orders(currency);
  END IF;
END $$;

-- ============================================================================
-- END MIGRATION 0111
-- ============================================================================
-- Summary:
-- ✓ Safely checks for column existence before altering
-- ✓ Only alters VARCHAR(3) columns on tables that have them
-- ✓ Skips deposits table (already uses currency_code VARCHAR(16))
-- ✓ Idempotent - safe to run multiple times
-- ============================================================================
