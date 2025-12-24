-- ============================================================================
-- MIGRATION 0111 CORRECTED: Expand Currency Code VARCHAR Limits (Safely)
-- ============================================================================
-- This migration SAFELY expands VARCHAR(3) currency columns to VARCHAR(16)
-- ONLY on tables that actually have them.
--
-- NOTE: The deposits table already uses currency_code VARCHAR(16), so we skip it.
-- This migration only touches payment/order tables that use the simpler "currency" field.
-- ============================================================================

BEGIN;

-- Helper function to safely alter a column type
-- This checks if the column exists before trying to alter it
CREATE OR REPLACE FUNCTION safe_alter_currency_column(
  p_table_name TEXT,
  p_column_name TEXT
) RETURNS TEXT AS $$
DECLARE
  v_col_exists BOOLEAN;
  v_current_type TEXT;
  v_result TEXT := '';
BEGIN
  -- Check if column exists
  SELECT EXISTS(
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = p_table_name
      AND column_name = p_column_name
  ) INTO v_col_exists;
  
  IF NOT v_col_exists THEN
    v_result := 'Column ' || p_table_name || '.' || p_column_name || ' does not exist (skipped)';
    RETURN v_result;
  END IF;
  
  -- Get current type
  SELECT data_type
  INTO v_current_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = p_table_name
    AND column_name = p_column_name;
  
  -- If already VARCHAR(16), skip
  IF v_current_type = 'character varying(16)' OR v_current_type LIKE '%16%' THEN
    v_result := 'Column ' || p_table_name || '.' || p_column_name || ' already VARCHAR(16) (skipped)';
    RETURN v_result;
  END IF;
  
  -- Perform the alter
  EXECUTE 'ALTER TABLE IF EXISTS public.' || p_table_name || 
          ' ALTER COLUMN ' || p_column_name || ' TYPE VARCHAR(16)';
  
  v_result := 'Column ' || p_table_name || '.' || p_column_name || ' expanded to VARCHAR(16) (✓)';
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Step 1: Payment tables (if they have "currency" column)
-- These tables use simple "currency" VARCHAR(3) from 001_create_payments_module.sql
SELECT safe_alter_currency_column('payments', 'currency');
SELECT safe_alter_currency_column('payment_intents', 'currency');
SELECT safe_alter_currency_column('invoices', 'currency');
SELECT safe_alter_currency_column('payment_links', 'currency');
SELECT safe_alter_currency_column('escrow_payments', 'currency');

-- Step 2: Order tables (if they have "currency" column)
SELECT safe_alter_currency_column('orders', 'currency');
SELECT safe_alter_currency_column('product_orders', 'currency');

-- Step 3: Shop/product tables (if they have "currency" column)
SELECT safe_alter_currency_column('shop_products', 'currency');
SELECT safe_alter_currency_column('industrial_products', 'currency');
SELECT safe_alter_currency_column('shop_customer_addresses', 'preferred_currency');

-- Step 4: Ride/commitment tables (if they have "currency" column)
SELECT safe_alter_currency_column('ride_requests', 'currency');
SELECT safe_alter_currency_column('commitments', 'currency');

-- Step 5: Alibaba integration (if it has "original_currency" column)
SELECT safe_alter_currency_column('alibaba_products', 'original_currency');

-- Step 6: Payment gateways (if it has "default_settlement_currency" column)
SELECT safe_alter_currency_column('payment_gateways', 'default_settlement_currency');

-- Step 7: Extended ride payments (if it exists)
SELECT safe_alter_currency_column('extended_ride_payments', 'currency');

-- Step 8: Transfers table (if it has "currency" column)
SELECT safe_alter_currency_column('transfers', 'currency');

-- Step 9: DO NOT ALTER deposits - it uses currency_code VARCHAR(16) already!
-- Deposits table was created with currency_code VARCHAR(16) from the beginning
-- and does not have a simple "currency" VARCHAR(3) column

-- Step 10: Create indexes for faster currency lookups (if column exists)
CREATE INDEX IF NOT EXISTS idx_payments_currency ON public.payments(currency) 
  WHERE currency IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_intents_currency ON public.payment_intents(currency) 
  WHERE currency IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_currency ON public.invoices(currency) 
  WHERE currency IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_currency ON public.orders(currency) 
  WHERE currency IS NOT NULL;

-- Step 11: Clean up the helper function
DROP FUNCTION IF EXISTS safe_alter_currency_column(TEXT, TEXT);

COMMIT;
-- ============================================================================
-- END MIGRATION 0111 CORRECTED
-- ============================================================================
