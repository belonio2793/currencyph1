-- ============================================================================
-- FIX DEPOSITS: Ensure proper metadata insertion and table structure
-- ============================================================================
-- This ensures:
-- 1. All required columns exist in deposits table
-- 2. Metadata is properly stored
-- 3. All approved deposits have wallet_id references
-- 4. Deposit status transitions are tracked
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Ensure deposits table has all required columns
-- ============================================================================

RAISE NOTICE 'STEP 1: Ensuring deposits table structure...';

-- Add missing columns if they don't exist
ALTER TABLE IF EXISTS deposits
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS received_amount NUMERIC(36, 8),
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(36, 8),
ADD COLUMN IF NOT EXISTS approved_by UUID,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reversed_by UUID,
ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;

-- Create GIN index on metadata for fast queries
CREATE INDEX IF NOT EXISTS idx_deposits_metadata ON deposits USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_deposits_status_user ON deposits(status, user_id, created_at DESC);

RAISE NOTICE '✓ Deposits table structure verified';

-- ============================================================================
-- STEP 2: Enhance improved_deposit_metadata function
-- ============================================================================

RAISE NOTICE 'STEP 2: Creating enhanced metadata function...';

CREATE OR REPLACE FUNCTION improve_deposit_metadata()
RETURNS TRIGGER AS $$
DECLARE
  v_metadata JSONB;
  v_wallet_currency VARCHAR;
BEGIN
  -- Get wallet currency for validation
  SELECT currency_code INTO v_wallet_currency
  FROM wallets
  WHERE id = NEW.wallet_id;

  -- Build comprehensive metadata
  v_metadata := jsonb_build_object(
    -- Deposit basics
    'deposit_id', NEW.id,
    'deposit_method', NEW.deposit_method,
    'original_amount', NEW.amount,
    'original_currency', NEW.currency_code,
    'status_before', OLD.status,
    'status_after', NEW.status,
    
    -- Conversion details (if applicable)
    'exchange_rate', COALESCE(NEW.exchange_rate, 1),
    'received_currency', NEW.currency_code,
    'received_amount', COALESCE(NEW.received_amount, NEW.amount),
    'wallet_currency', v_wallet_currency,
    
    -- Conversion validation
    'conversion_valid', CASE
      WHEN NEW.received_amount IS NULL THEN NULL
      WHEN NEW.exchange_rate IS NULL THEN NULL
      WHEN NEW.exchange_rate = 0 THEN FALSE
      WHEN ABS((NEW.received_amount / NEW.exchange_rate) - NEW.amount) < 0.01 THEN TRUE
      ELSE FALSE
    END,
    
    -- Approval workflow
    'approved_by', COALESCE(NEW.approved_by::TEXT, 'system'),
    'approved_at', NEW.approved_at,
    'reversed_by', COALESCE(NEW.reversed_by::TEXT, NULL),
    'reversed_at', NEW.reversed_at,
    
    -- Reference information
    'payment_reference', NEW.payment_reference,
    'external_tx_id', NEW.external_tx_id,
    'transaction_id', NEW.transaction_id,
    
    -- Audit info
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at
  );

  -- Store metadata when status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE deposits
    SET metadata = v_metadata
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

RAISE NOTICE '✓ Enhanced metadata function created';

-- ============================================================================
-- STEP 3: Drop and recreate trigger
-- ============================================================================

RAISE NOTICE 'STEP 3: Recreating metadata trigger...';

DROP TRIGGER IF EXISTS enrich_deposit_metadata_on_status_change ON deposits;

CREATE TRIGGER enrich_deposit_metadata_on_status_change
AFTER UPDATE ON deposits
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION improve_deposit_metadata();

RAISE NOTICE '✓ Metadata trigger created';

-- ============================================================================
-- STEP 4: Enrich existing approved deposits with metadata
-- ============================================================================

RAISE NOTICE 'STEP 4: Enriching existing approved deposits...';

DO $$
DECLARE
  v_deposit_record RECORD;
  v_wallet_currency VARCHAR;
  v_metadata JSONB;
  v_count INTEGER := 0;
BEGIN
  FOR v_deposit_record IN
    SELECT 
      id, amount, currency_code, deposit_method,
      exchange_rate, received_amount, wallet_id,
      approved_by, approved_at, reversed_by, reversed_at,
      payment_reference, external_tx_id, transaction_id,
      created_at, updated_at, status
    FROM deposits
    WHERE status = 'approved' AND metadata IS NULL
    ORDER BY created_at DESC
  LOOP
    -- Get wallet currency
    SELECT currency_code INTO v_wallet_currency
    FROM wallets
    WHERE id = v_deposit_record.wallet_id;

    -- Build metadata
    v_metadata := jsonb_build_object(
      'deposit_id', v_deposit_record.id,
      'deposit_method', v_deposit_record.deposit_method,
      'original_amount', v_deposit_record.amount,
      'original_currency', v_deposit_record.currency_code,
      'status_before', 'pending',
      'status_after', 'approved',
      'exchange_rate', COALESCE(v_deposit_record.exchange_rate, 1),
      'received_currency', v_deposit_record.currency_code,
      'received_amount', COALESCE(v_deposit_record.received_amount, v_deposit_record.amount),
      'wallet_currency', v_wallet_currency,
      'conversion_valid', CASE
        WHEN v_deposit_record.received_amount IS NULL THEN NULL
        WHEN v_deposit_record.exchange_rate IS NULL THEN NULL
        WHEN v_deposit_record.exchange_rate = 0 THEN FALSE
        WHEN ABS((v_deposit_record.received_amount / v_deposit_record.exchange_rate) - v_deposit_record.amount) < 0.01 THEN TRUE
        ELSE FALSE
      END,
      'approved_by', COALESCE(v_deposit_record.approved_by::TEXT, 'system'),
      'approved_at', v_deposit_record.approved_at,
      'payment_reference', v_deposit_record.payment_reference,
      'external_tx_id', v_deposit_record.external_tx_id,
      'created_at', v_deposit_record.created_at,
      'updated_at', v_deposit_record.updated_at
    );

    -- Update deposit with metadata
    UPDATE deposits
    SET metadata = v_metadata
    WHERE id = v_deposit_record.id;

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE '✓ Enriched % approved deposits with metadata', v_count;
END $$;

-- ============================================================================
-- STEP 5: Verify metadata coverage
-- ============================================================================

RAISE NOTICE 'STEP 5: Verifying metadata coverage...';

SELECT
  COUNT(*) as total_deposits,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_deposits,
  COUNT(CASE WHEN status = 'approved' AND metadata IS NOT NULL THEN 1 END) as approved_with_metadata,
  COUNT(CASE WHEN status = 'approved' AND metadata IS NULL THEN 1 END) as approved_without_metadata
FROM deposits;

-- ============================================================================
-- STEP 6: Verify wallet linkage
-- ============================================================================

RAISE NOTICE 'STEP 6: Verifying wallet linkage...';

CREATE TEMPORARY TABLE deposit_verification AS
SELECT
  d.id as deposit_id,
  d.user_id,
  d.amount,
  d.currency_code,
  d.wallet_id,
  d.status,
  w.id as wallet_exists,
  w.currency_code as wallet_currency
FROM deposits d
LEFT JOIN wallets w ON d.wallet_id = w.id
WHERE d.status = 'approved';

SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN wallet_exists IS NOT NULL THEN 1 END) as wallets_linked,
  COUNT(CASE WHEN wallet_exists IS NULL THEN 1 END) as wallets_missing
FROM deposit_verification;

-- Show any orphaned deposits
SELECT deposit_id, user_id, amount, currency_code, wallet_id
FROM deposit_verification
WHERE wallet_exists IS NULL;

RAISE NOTICE '';
RAISE NOTICE '═══════════════════════════════════════════════════════════';
RAISE NOTICE 'DEPOSITS METADATA SETUP COMPLETE!';
RAISE NOTICE '═══════════════════════════════════════════════════════════';

COMMIT;

-- ============================================================================
-- POST-SETUP VERIFICATION (Run after this script)
-- ============================================================================
--
-- Check metadata quality:
-- SELECT id, amount, currency_code, status, jsonb_pretty(metadata) as metadata
-- FROM deposits
-- WHERE status = 'approved'
-- LIMIT 5;
--
-- Check wallet linkage:
-- SELECT d.id, d.user_id, d.amount, d.status, w.id, w.currency_code, w.balance
-- FROM deposits d
-- LEFT JOIN wallets w ON d.wallet_id = w.id
-- WHERE d.status = 'approved'
-- ORDER BY d.created_at DESC
-- LIMIT 10;
--
-- Verify conversion calculations:
-- SELECT 
--   id, amount, received_amount, exchange_rate,
--   (received_amount / NULLIF(exchange_rate, 0)) as calculated_original,
--   ABS((received_amount / NULLIF(exchange_rate, 0)) - amount) as discrepancy
-- FROM deposits
-- WHERE received_amount IS NOT NULL AND exchange_rate IS NOT NULL
-- LIMIT 10;
--
-- ============================================================================
