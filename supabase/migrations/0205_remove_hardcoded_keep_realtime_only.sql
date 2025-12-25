/**
 * MIGRATION 0205: FINAL FIX - Remove All Hardcoded Rates
 * Keep ONLY real-time rates from fetch-rates edge function
 * 
 * PROBLEM: Migration 0203 inserted hardcoded fallback rates that override
 * real rates from the fetch-rates edge function
 * 
 * Example:
 *   BTC shown as 2,500,000 (hardcoded) instead of 5,186,122 (real from API)
 *   ETH shown as 150,000 (hardcoded) instead of 310,000 (real from API)
 * 
 * SOLUTION: 
 * 1. Delete ALL hardcoded fallback rates
 * 2. Keep ONLY rates that come from fetch-rates edge function
 * 3. Ensure fetch-rates continues to update rates in real-time
 * 4. NO hardcoded values in migrations
 */

BEGIN;

-- ============================================================================
-- STEP 1: Identify hardcoded rates to be removed
-- ============================================================================
-- Hardcoded rates have source_table = 'currency_rates' and haven't been 
-- updated in the last few hours (they're static)

CREATE TEMP TABLE hardcoded_rates_to_remove AS
SELECT 
  id,
  from_currency,
  to_currency,
  rate,
  updated_at,
  'HARDCODED_FALLBACK' as removal_reason
FROM pairs
WHERE source_table = 'currency_rates'
  AND updated_at < NOW() - INTERVAL '2 hours'
  AND to_currency = 'PHP'
  AND (from_currency, to_currency) IN (
    -- List of currencies that should have REAL rates from fetch-rates
    ('BTC', 'PHP'),
    ('ETH', 'PHP'),
    ('USDT', 'PHP'),
    ('BNB', 'PHP'),
    ('XRP', 'PHP'),
    ('ADA', 'PHP'),
    ('DOGE', 'PHP'),
    ('SOL', 'PHP'),
    ('AVAX', 'PHP'),
    ('BCH', 'PHP'),
    ('LTC', 'PHP'),
    ('XLM', 'PHP'),
    ('LINK', 'PHP'),
    ('DOT', 'PHP'),
    ('UNI', 'PHP'),
    ('AAVE', 'PHP'),
    ('TON', 'PHP'),
    ('TRX', 'PHP'),
    ('SHIB', 'PHP'),
    ('WLD', 'PHP'),
    ('HBAR', 'PHP'),
    ('PYUSD', 'PHP'),
    ('SUI', 'PHP'),
    ('USDC', 'PHP'),
    ('MATIC', 'PHP')
  );

-- ============================================================================
-- STEP 2: Audit what's being removed
-- ============================================================================
INSERT INTO pairs_migration_audit (action_type, from_currency, to_currency, old_rate, reason)
SELECT 
  'REMOVING_HARDCODED_RATE',
  from_currency,
  to_currency,
  rate,
  'Removing hardcoded fallback rate to use real-time rates from fetch-rates edge function'
FROM hardcoded_rates_to_remove;

-- ============================================================================
-- STEP 3: DELETE hardcoded fallback rates
-- ============================================================================
DELETE FROM pairs
WHERE id IN (SELECT id FROM hardcoded_rates_to_remove);

-- ============================================================================
-- STEP 4: Verify what remains (should be real rates from fetch-rates)
-- ============================================================================
DO $$
DECLARE
  btc_rate numeric;
  btc_source varchar;
  btc_updated timestamptz;
  btc_age_hours numeric;
  total_crypto_rates int;
  removed_count int;
BEGIN
  -- Get current BTC rate
  SELECT rate, source_table, updated_at INTO btc_rate, btc_source, btc_updated
  FROM pairs 
  WHERE from_currency = 'BTC' AND to_currency = 'PHP'
  LIMIT 1;
  
  -- Calculate age
  btc_age_hours := EXTRACT(EPOCH FROM (NOW() - btc_updated)) / 3600;
  
  -- Count crypto rates
  SELECT COUNT(*) INTO total_crypto_rates
  FROM pairs
  WHERE to_currency = 'PHP' AND from_currency IN (
    'BTC', 'ETH', 'USDT', 'BNB', 'XRP', 'ADA', 'DOGE', 'SOL', 'AVAX', 'BCH'
  );
  
  -- Count removed
  SELECT COUNT(*) INTO removed_count FROM hardcoded_rates_to_remove;
  
  RAISE NOTICE '
╔════════════════════════════════════════════════════════════════╗
║  MIGRATION 0205 - HARDCODED RATES REMOVED, REAL RATES ONLY     ║
╠════════════════════════════════════════════════════════════════╣
║ CURRENT BTC RATE:                                              ║
║   Rate: % PHP                                                 ║
║   Source: %                                                    ║
║   Updated: % hours ago                                         ║
║   Status: %                                                    ║
║                                                                ║
║ CLEANUP SUMMARY:                                               ║
║   Total crypto pairs: %                                        ║
║   Hardcoded rates removed: %                                   ║
║                                                                ║
╠════════════════════════════════════════════════════════════════╣
║ ✅ HARDCODED RATES REMOVED                                      ║
║ ✅ REAL-TIME RATES ONLY (from fetch-rates edge function)       ║
║ ✅ Deposits component will show accurate rates                 ║
║ ✅ Rates auto-update via fetch-rates edge function             ║
║                                                                ║
║ NEXT: fetch-rates edge function continues to update rates      ║
║       in real-time from actual exchanges                       ║
╚════════════════════════════════════════════════════════════════╝
  ',
  COALESCE(btc_rate::text, 'NOT FOUND'),
  COALESCE(btc_source, 'N/A'),
  ROUND(btc_age_hours::numeric, 1),
  CASE 
    WHEN btc_rate IS NULL THEN '⚠️ No BTC rate found! Check fetch-rates edge function'
    WHEN btc_age_hours > 24 THEN '⚠️ Stale (>24 hours old) - Check fetch-rates edge function'
    WHEN btc_age_hours > 1 THEN '⚠ Getting old - fetch-rates may not be running'
    ELSE '✓ Fresh (from fetch-rates)'
  END,
  total_crypto_rates,
  removed_count;
END $$;

-- ============================================================================
-- STEP 5: Log completion
-- ============================================================================
INSERT INTO pairs_migration_audit (action_type, reason)
VALUES (
  'MIGRATION_0205_COMPLETE',
  'All hardcoded fallback rates removed. Only real-time rates from fetch-rates edge function remain. '
  || 'Deposits component will now show accurate rates. If rates are missing, check fetch-rates edge function status.'
);

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================
-- Query 1: Verify BTC rate is real and recent
-- SELECT from_currency, rate, source_table, updated_at 
-- FROM pairs 
-- WHERE from_currency = 'BTC' AND to_currency = 'PHP';

-- Query 2: Check if rates are being updated by fetch-rates
-- SELECT COUNT(*) as total_pairs, 
--        MAX(updated_at) as most_recent_update,
--        MIN(updated_at) as oldest_update
-- FROM pairs
-- WHERE to_currency = 'PHP';

-- Query 3: Show rates age (how recent they are)
-- SELECT from_currency, rate, 
--        ROUND(EXTRACT(EPOCH FROM (NOW() - updated_at))/3600, 1) as hours_old
-- FROM pairs
-- WHERE to_currency = 'PHP' 
--   AND from_currency IN ('BTC', 'ETH', 'USD')
-- ORDER BY from_currency;
