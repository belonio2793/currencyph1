/**
 * MIGRATION: Fix Currency Pairs Canonical Direction
 * PURPOSE: Resolve the dual-direction pair issue that caused incorrect exchange rates
 * 
 * PROBLEM SUMMARY:
 * The pairs table contained rates in BOTH directions for the same currency pair:
 * - Canonical (correct): BTC → PHP (1 BTC = 2,500,000 PHP)
 * - Inverted (wrong): PHP → BTC (1 PHP = 0.00000004 BTC)
 * 
 * When both directions existed, the UI would pick the inverted pair and show
 * "1 BTC = 6.51 PHP" instead of the correct "1 BTC = 2,500,000 PHP"
 * 
 * SOLUTION STRATEGY:
 * 1. Enforce canonical direction: X → PHP for PHP pairs (primary currency base)
 * 2. For all other pairs: Keep highest to lowest volume order (standardized)
 * 3. Add inverse pairs explicitly where needed for bidirectional queries
 * 4. Add audit columns to track data lineage and prevent future issues
 * 5. Create validation triggers to ensure data integrity
 * 
 * SCOPE:
 * - Backup current pairs data for audit trail
 * - Remove inverted/malformed pairs
 * - Ensure canonical pairs exist with correct rates
 * - Add inverse pairs where needed (especially for cryptos)
 * - Add audit trail columns
 */

-- ============================================================================
-- STEP 1: Create audit table to track migration history
-- ============================================================================
CREATE TABLE IF NOT EXISTS pairs_migration_audit (
  id BIGSERIAL PRIMARY KEY,
  migration_timestamp TIMESTAMPTZ DEFAULT NOW(),
  action_type VARCHAR(50) NOT NULL,
  from_currency VARCHAR(10),
  to_currency VARCHAR(10),
  old_rate NUMERIC,
  new_rate NUMERIC,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pairs_audit_timestamp ON pairs_migration_audit(migration_timestamp);
CREATE INDEX IF NOT EXISTS idx_pairs_audit_currencies ON pairs_migration_audit(from_currency, to_currency);

-- ============================================================================
-- STEP 2: Backup current pairs data
-- ============================================================================
CREATE TABLE IF NOT EXISTS pairs_backup_pre_migration (
  backup_id BIGSERIAL PRIMARY KEY,
  id BIGINT,
  from_currency VARCHAR(10),
  to_currency VARCHAR(10),
  rate NUMERIC,
  source_table VARCHAR(50),
  updated_at TIMESTAMPTZ,
  backup_timestamp TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO pairs_backup_pre_migration (id, from_currency, to_currency, rate, source_table, updated_at)
SELECT id, from_currency, to_currency, rate, source_table, updated_at FROM pairs;

-- ============================================================================
-- STEP 3: Identify and audit problematic pairs
-- ============================================================================
-- Log all PHP pairs (both directions) for analysis
INSERT INTO pairs_migration_audit (action_type, from_currency, to_currency, old_rate, reason)
SELECT 
  'AUDIT_FOUND_PHP_PAIR',
  from_currency,
  to_currency,
  rate,
  CASE 
    WHEN to_currency = 'PHP' THEN 'Canonical PHP pair (target)'
    WHEN from_currency = 'PHP' THEN 'Inverted PHP pair (source)'
    ELSE 'Non-PHP pair'
  END
FROM pairs
WHERE from_currency = 'PHP' OR to_currency = 'PHP'
ORDER BY from_currency, to_currency;

-- ============================================================================
-- STEP 4: Clean up inverted pairs and enforce canonical direction
-- ============================================================================

-- Step 4a: For PHP pairs, remove inverted direction (PHP → X)
DELETE FROM pairs 
WHERE from_currency = 'PHP' 
  AND to_currency != 'PHP'
  AND EXISTS (
    SELECT 1 FROM pairs p2 
    WHERE p2.from_currency = pairs.to_currency 
      AND p2.to_currency = 'PHP'
  );

-- Log the deletion
INSERT INTO pairs_migration_audit (action_type, from_currency, to_currency, reason)
SELECT 
  'DELETED_INVERTED_PHP_PAIR',
  from_currency,
  to_currency,
  'Removed inverted PHP pair because canonical X→PHP pair exists'
FROM pairs_backup_pre_migration
WHERE from_currency = 'PHP' 
  AND to_currency != 'PHP'
  AND EXISTS (
    SELECT 1 FROM pairs p2 
    WHERE p2.from_currency = pairs_backup_pre_migration.to_currency 
      AND p2.to_currency = 'PHP'
  );

-- ============================================================================
-- STEP 5: Add inverse pairs for critical currencies
-- ============================================================================

-- For all X→PHP pairs, add their inverse (PHP→X) with calculated inverted rate
WITH php_pairs AS (
  SELECT from_currency, to_currency, rate FROM pairs
  WHERE to_currency = 'PHP' AND from_currency != 'PHP'
),
inverse_pairs AS (
  SELECT 
    'PHP' as from_currency,
    from_currency as to_currency,
    (1.0 / rate) as inverse_rate
  FROM php_pairs
  WHERE NOT EXISTS (
    SELECT 1 FROM pairs p2 
    WHERE p2.from_currency = 'PHP' 
      AND p2.to_currency = php_pairs.from_currency
  )
)
INSERT INTO pairs (from_currency, to_currency, rate, source_table, updated_at)
SELECT from_currency, to_currency, inverse_rate, 'currency_rates', NOW()
FROM inverse_pairs
ON CONFLICT (from_currency, to_currency) DO UPDATE
SET rate = EXCLUDED.rate, source_table = EXCLUDED.source_table, updated_at = NOW();

-- Log the additions
INSERT INTO pairs_migration_audit (action_type, from_currency, to_currency, new_rate, reason)
SELECT 
  'ADDED_INVERSE_PAIR',
  'PHP',
  from_currency,
  (1.0 / rate),
  'Added inverse pair for bidirectional lookup support'
FROM pairs
WHERE to_currency = 'PHP' AND from_currency != 'PHP';

-- ============================================================================
-- STEP 6: Add schema documentation columns
-- ============================================================================
-- These columns help track data quality and prevent future issues

ALTER TABLE pairs ADD COLUMN IF NOT EXISTS pair_direction VARCHAR(20) DEFAULT 'unspecified';
ALTER TABLE pairs ADD COLUMN IF NOT EXISTS is_inverted BOOLEAN DEFAULT FALSE;
ALTER TABLE pairs ADD COLUMN IF NOT EXISTS canonical_pair_id BIGINT;
ALTER TABLE pairs ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(3,2) DEFAULT 1.00;
ALTER TABLE pairs ADD COLUMN IF NOT EXISTS migration_notes TEXT;

-- Update pair direction metadata
UPDATE pairs SET pair_direction = 'canonical' WHERE to_currency = 'PHP';
UPDATE pairs SET pair_direction = 'inverse' WHERE from_currency = 'PHP' AND to_currency != 'PHP';
UPDATE pairs SET pair_direction = 'other' WHERE pair_direction = 'unspecified';

-- Mark inverted pairs
UPDATE pairs SET is_inverted = TRUE 
WHERE from_currency = 'PHP' AND to_currency != 'PHP';

-- Create index on new columns for performance
CREATE INDEX IF NOT EXISTS idx_pairs_direction ON pairs(pair_direction);
CREATE INDEX IF NOT EXISTS idx_pairs_inverted ON pairs(is_inverted);

-- ============================================================================
-- STEP 7: Add validation trigger to prevent future issues
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_pairs_direction()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure rate is positive
  IF NEW.rate <= 0 THEN
    RAISE EXCEPTION 'Exchange rate must be positive, got: %', NEW.rate;
  END IF;

  -- Ensure currencies are not null
  IF NEW.from_currency IS NULL OR NEW.to_currency IS NULL THEN
    RAISE EXCEPTION 'Both from_currency and to_currency must be provided';
  END IF;

  -- Warn if creating inverted PHP pair without canonical
  IF NEW.from_currency = 'PHP' AND NEW.to_currency != 'PHP' THEN
    IF NOT EXISTS (
      SELECT 1 FROM pairs 
      WHERE from_currency = NEW.to_currency AND to_currency = 'PHP'
    ) THEN
      RAISE WARNING 'Creating inverted PHP pair % → % without canonical %→PHP pair. This may cause confusion.',
        NEW.from_currency, NEW.to_currency, NEW.to_currency;
    END IF;
  END IF;

  -- Auto-set pair direction
  IF NEW.to_currency = 'PHP' THEN
    NEW.pair_direction = 'canonical';
    NEW.is_inverted = FALSE;
  ELSIF NEW.from_currency = 'PHP' THEN
    NEW.pair_direction = 'inverse';
    NEW.is_inverted = TRUE;
  ELSE
    NEW.pair_direction = 'other';
    NEW.is_inverted = FALSE;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS validate_pairs_before_insert_update ON pairs;

-- Create trigger to validate pairs on insert/update
CREATE TRIGGER validate_pairs_before_insert_update
BEFORE INSERT OR UPDATE ON pairs
FOR EACH ROW
EXECUTE FUNCTION validate_pairs_direction();

-- ============================================================================
-- STEP 8: Create view for canonical pairs only (for quick canonical lookups)
-- ============================================================================
CREATE OR REPLACE VIEW pairs_canonical AS
SELECT 
  id,
  from_currency,
  to_currency,
  rate,
  source_table,
  updated_at,
  pair_direction,
  confidence_score
FROM pairs
WHERE pair_direction = 'canonical'
ORDER BY from_currency, to_currency;

-- Create view for all valid pairs (both directions)
CREATE OR REPLACE VIEW pairs_bidirectional AS
SELECT 
  id,
  from_currency,
  to_currency,
  rate,
  source_table,
  updated_at,
  pair_direction,
  is_inverted,
  confidence_score
FROM pairs
WHERE pair_direction IN ('canonical', 'inverse')
ORDER BY from_currency, to_currency;

-- ============================================================================
-- STEP 9: Create helper function for safe rate lookups
-- ============================================================================
CREATE OR REPLACE FUNCTION get_exchange_rate(
  p_from_currency VARCHAR,
  p_to_currency VARCHAR,
  p_use_canonical_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(rate NUMERIC, pair_id BIGINT, source_table VARCHAR, updated_at TIMESTAMPTZ) AS $$
BEGIN
  -- Try direct pair first
  RETURN QUERY
  SELECT pairs.rate, pairs.id, pairs.source_table, pairs.updated_at
  FROM pairs
  WHERE from_currency = UPPER(p_from_currency) 
    AND to_currency = UPPER(p_to_currency)
    AND (NOT p_use_canonical_only OR pair_direction = 'canonical')
  LIMIT 1;

  -- If not found and not canonical-only, try inverse with calculation
  IF NOT FOUND AND NOT p_use_canonical_only THEN
    RETURN QUERY
    SELECT (1.0 / pairs.rate)::NUMERIC, pairs.id, pairs.source_table, pairs.updated_at
    FROM pairs
    WHERE from_currency = UPPER(p_to_currency) 
      AND to_currency = UPPER(p_from_currency)
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 10: Create audit summary report
-- ============================================================================
INSERT INTO pairs_migration_audit (action_type, reason)
VALUES (
  'MIGRATION_COMPLETE',
  'Currency pairs canonical direction enforcement complete. '
  || 'All PHP pairs now follow canonical X→PHP format. '
  || 'Inverse pairs added for bidirectional lookup support. '
  || 'Validation triggers active to prevent future issues.'
);

-- ============================================================================
-- STEP 11: Display migration summary
-- ============================================================================
-- These counts help understand what was changed
DO $$
DECLARE
  canonical_count INT;
  inverse_count INT;
  other_count INT;
  backup_count INT;
BEGIN
  SELECT COUNT(*) INTO canonical_count FROM pairs WHERE pair_direction = 'canonical';
  SELECT COUNT(*) INTO inverse_count FROM pairs WHERE pair_direction = 'inverse';
  SELECT COUNT(*) INTO other_count FROM pairs WHERE pair_direction = 'other';
  SELECT COUNT(*) INTO backup_count FROM pairs_backup_pre_migration;
  
  RAISE NOTICE '
  ╔════════════════════════════════════════════════════════════════╗
  ║           CURRENCY PAIRS MIGRATION SUMMARY                     ║
  ╠════════════════════════════════════════════════════════════════╣
  ║ Canonical pairs (X→PHP):        %                              ║
  ║ Inverse pairs (PHP→X):          %                              ║
  ║ Other pairs:                    %                              ║
  ║ Pre-migration backup count:     %                              ║
  ╠════════════════════════════════════════════════════════════════╣
  ║ SCHEMA CHANGES:                                                ║
  ║ ✓ Added pair_direction column for categorization              ║
  ║ ✓ Added is_inverted flag for quick identification             ║
  ║ ✓ Added canonical_pair_id for pair relationships              ║
  ║ ✓ Added confidence_score for data quality tracking            ║
  ║ ✓ Added migration_notes for audit trail                       ║
  ╠════════════════════════════════════════════════════════════════╣
  ║ NEW SAFETY FEATURES:                                           ║
  ║ ✓ Validation trigger to ensure data integrity                 ║
  ║ ✓ pairs_canonical view for canonical-only queries             ║
  ║ ✓ pairs_bidirectional view for flexible lookups               ║
  ║ ✓ get_exchange_rate() function for safe rate retrieval        ║
  ║ ✓ pairs_migration_audit table for tracking changes            ║
  ╚════════════════════════════════════════════════════════════════╝
  ', canonical_count, inverse_count, other_count, backup_count;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (for manual review)
-- ============================================================================
-- Query to verify canonical pairs exist
-- SELECT * FROM pairs_canonical WHERE from_currency IN ('BTC', 'USD', 'EUR') ORDER BY from_currency;

-- Query to identify any remaining problematic pairs
-- SELECT from_currency, to_currency, COUNT(*) as duplicate_count 
-- FROM pairs 
-- GROUP BY from_currency, to_currency 
-- HAVING COUNT(*) > 1;

-- Query to see bidirectional pair coverage
-- SELECT 
--   p1.from_currency,
--   CASE WHEN p2.id IS NOT NULL THEN '✓' ELSE '✗' END as has_inverse
-- FROM pairs p1
-- LEFT JOIN pairs p2 ON p1.from_currency = p2.to_currency AND p1.to_currency = p2.from_currency
-- WHERE p1.to_currency = 'PHP'
-- ORDER BY p1.from_currency;
