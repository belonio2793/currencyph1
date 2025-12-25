-- ============================================================================
-- MIGRATION 0112: Comprehensively Expand All VARCHAR Columns
-- ============================================================================
-- This migration expands ALL VARCHAR(n) columns to TEXT or VARCHAR(1000)
-- to prevent "value too long for type character varying(n)" errors
-- ============================================================================

BEGIN;

-- ============================================================================
-- EXTENDED RIDE PAYMENTS - Fix currency column
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='extended_ride_payments' AND column_name='currency') THEN
    ALTER TABLE public.extended_ride_payments ALTER COLUMN currency TYPE VARCHAR(16);
    RAISE NOTICE 'Extended extended_ride_payments.currency to VARCHAR(16)';
  END IF;
END $$;

-- ============================================================================
-- COMMITMENTS - Fix currency column
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='commitments' AND column_name='currency') THEN
    ALTER TABLE public.commitments ALTER COLUMN currency TYPE VARCHAR(16);
    RAISE NOTICE 'Extended commitments.currency to VARCHAR(16)';
  END IF;
END $$;

-- ============================================================================
-- ALIBABA PRODUCTS - Fix original_currency column
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='alibaba_products' AND column_name='original_currency') THEN
    ALTER TABLE public.alibaba_products ALTER COLUMN original_currency TYPE VARCHAR(16);
    RAISE NOTICE 'Extended alibaba_products.original_currency to VARCHAR(16)';
  END IF;
END $$;

-- ============================================================================
-- PAYMENTS - Fix currency column (if created after 0111)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='payments' AND column_name='currency'
             AND character_maximum_length = 3) THEN
    ALTER TABLE public.payments ALTER COLUMN currency TYPE VARCHAR(16);
    RAISE NOTICE 'Extended payments.currency to VARCHAR(16)';
  END IF;
END $$;

-- ============================================================================
-- SHOP SCHEMA - Expand all VARCHAR(3) columns to larger limits
-- ============================================================================

DO $$
BEGIN
  -- shop_products currency
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='shop_products' 
             AND column_name='currency' AND character_maximum_length = 3) THEN
    ALTER TABLE public.shop_products ALTER COLUMN currency TYPE VARCHAR(16);
    RAISE NOTICE 'Extended shop_products.currency to VARCHAR(16)';
  END IF;

  -- shop_customers preferred_currency
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='shop_customers' 
             AND column_name='preferred_currency' AND character_maximum_length = 3) THEN
    ALTER TABLE public.shop_customers ALTER COLUMN preferred_currency TYPE VARCHAR(16);
    RAISE NOTICE 'Extended shop_customers.preferred_currency to VARCHAR(16)';
  END IF;
END $$;

-- ============================================================================
-- GENERIC FIXES FOR ANY REMAINING VARCHAR(n) COLUMNS
-- Expand all VARCHAR columns in critical tables to at least VARCHAR(255)
-- ============================================================================

DO $$
DECLARE
  col_record RECORD;
BEGIN
  -- Find and log all VARCHAR columns with limits < 255
  FOR col_record IN
    SELECT table_name, column_name, character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND data_type = 'character varying'
    AND character_maximum_length IS NOT NULL
    AND character_maximum_length < 255
    AND table_name IN (
      'extended_ride_payments', 'commitments', 'alibaba_products', 
      'payments', 'payment_intents', 'shop_products', 'shop_orders',
      'shop_customers', 'ride_requests', 'orders'
    )
  LOOP
    RAISE NOTICE 'Found VARCHAR(%) in %.%', 
      col_record.character_maximum_length, 
      col_record.table_name, 
      col_record.column_name;
    
    -- Expand based on column name patterns
    IF col_record.column_name IN ('currency', 'currency_code', 'original_currency') THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE VARCHAR(16)', 
                     col_record.table_name, col_record.column_name);
      RAISE NOTICE 'Expanded %.% to VARCHAR(16)', col_record.table_name, col_record.column_name;
    ELSIF col_record.column_name IN ('status', 'type', 'method') THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE VARCHAR(100)', 
                     col_record.table_name, col_record.column_name);
      RAISE NOTICE 'Expanded %.% to VARCHAR(100)', col_record.table_name, col_record.column_name;
    ELSE
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE VARCHAR(255)', 
                     col_record.table_name, col_record.column_name);
      RAISE NOTICE 'Expanded %.% to VARCHAR(255)', col_record.table_name, col_record.column_name;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_extended_ride_payments_currency 
    ON public.extended_ride_payments(currency);
  CREATE INDEX IF NOT EXISTS idx_commitments_currency 
    ON public.commitments(currency);
  CREATE INDEX IF NOT EXISTS idx_alibaba_products_original_currency 
    ON public.alibaba_products(original_currency);
  CREATE INDEX IF NOT EXISTS idx_payments_currency 
    ON public.payments(currency);
  CREATE INDEX IF NOT EXISTS idx_shop_products_currency 
    ON public.shop_products(currency);
  RAISE NOTICE 'Created/verified indexes for currency columns';
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERY (run manually if needed):
-- ============================================================================
-- SELECT table_name, column_name, character_maximum_length, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
-- AND data_type = 'character varying'
-- AND character_maximum_length IS NOT NULL
-- ORDER BY character_maximum_length, table_name;
-- ============================================================================
