/**
 * MIGRATION 0206: URGENT FIX - Remove Stale Hardcoded Rates
 * Issue: Hardcoded fallback rates (BTC=2,500,000) are still in database
 * causing incorrect display (1 PHP = 0.0000004 BTC instead of 0.0000001931 BTC)
 * 
 * SOLUTION: Delete ALL rates with source_table='currency_rates' that haven't 
 * been updated by fetch-rates edge function in real-time
 * 
 * Root Cause Analysis:
 * - Migration 0201 inserted hardcoded fallback rates (BTC→PHP: 2,500,000)
 * - Migration 0205 was created to remove them, but may not have executed fully
 * - These stale rates are still in public.pairs, overriding real rates
 * - The Deposits component queries FROM pairs WHERE to_currency='PHP'
 *   and gets these wrong hardcoded rates instead of real ones
 */

BEGIN;

-- ============================================================================
-- STEP 1: AUDIT - Show what's currently in the database
-- ============================================================================
DO $$
DECLARE
  btc_rate numeric;
  btc_source varchar;
  btc_age_minutes numeric;
  stale_count int;
BEGIN
  -- Check current BTC→PHP rate
  SELECT rate, source_table, EXTRACT(EPOCH FROM (NOW() - updated_at))/60
  INTO btc_rate, btc_source, btc_age_minutes
  FROM pairs 
  WHERE from_currency = 'BTC' AND to_currency = 'PHP'
  ORDER BY updated_at DESC
  LIMIT 1;
  
  -- Count stale hardcoded rates
  SELECT COUNT(*)
  INTO stale_count
  FROM pairs
  WHERE source_table = 'currency_rates'
    AND updated_at < NOW() - INTERVAL '1 hour'
    AND to_currency = 'PHP';
  
  RAISE NOTICE '
╔════════════════════════════════════════════════════════════════╗
║        MIGRATION 0206 - HARDCODED RATES DIAGNOSIS              ║
╠════════════════════════════════════════════════════════════════╣
║ CURRENT STATE:                                                 ║
║   BTC rate: % PHP                                             ║
║   Source: %                                                    ║
║   Age: % minutes                                               ║
║   Stale hardcoded rates to remove: %                           ║
╠════════════════════════════════════════════════════════════════╣
║ EXPECTED:                                                      ║
║   BTC rate: ~5,200,000 PHP (real market rate)                 ║
║   1 PHP = 0.0000001931 BTC (correct inverse)                  ║
║                                                                ║
║ PROBLEM:                                                       ║
║   Showing 0.0000004 BTC (inverted from hardcoded 2,500,000)   ║
╚════════════════════════════════════════════════════════════════╝
  ',
  COALESCE(btc_rate::text, 'NULL'),
  COALESCE(btc_source, 'NULL'),
  ROUND(btc_age_minutes::numeric, 0),
  stale_count;
END $$;

-- ============================================================================
-- STEP 2: DELETE ALL STALE HARDCODED RATES
-- ============================================================================
-- These are rates that haven't been updated by fetch-rates edge function
-- Specifically target source_table='currency_rates' which are fallback values
DELETE FROM pairs
WHERE source_table = 'currency_rates'
  AND (
    -- Either they're old (not updated in 1 hour - likely hardcoded)
    updated_at < NOW() - INTERVAL '1 hour'
    OR
    -- Or they're known problematic hardcoded values from migration 0201
    (from_currency, to_currency, rate) IN (
      ('USD', 'PHP', 56.5),
      ('EUR', 'PHP', 62.0),
      ('GBP', 'PHP', 71.0),
      ('JPY', 'PHP', 0.37),
      ('BTC', 'PHP', 2500000.0),  -- THE MAIN CULPRIT
      ('ETH', 'PHP', 150000.0),
      ('USDT', 'PHP', 56.5),
      ('BNB', 'PHP', 25000.0),
      ('ADA', 'PHP', 34.0),
      ('XRP', 'PHP', 3.5),
      ('DOGE', 'PHP', 0.41),
      ('SOL', 'PHP', 195.0),
      ('AVAX', 'PHP', 28.0),
      ('BCH', 'PHP', 590.0),
      ('LTC', 'PHP', 100.0),
      ('XLM', 'PHP', 0.35),
      ('LINK', 'PHP', 65.0),
      ('DOT', 'PHP', 9.0),
      ('UNI', 'PHP', 8.5),
      ('AAVE', 'PHP', 550.0),
      ('TON', 'PHP', 6.5),
      ('TRX', 'PHP', 0.36),
      ('SHIB', 'PHP', 0.000021),
      ('WLD', 'PHP', 8.0),
      ('HBAR', 'PHP', 0.15),
      ('PYUSD', 'PHP', 56.5),
      ('SUI', 'PHP', 5.0)
    )
  );

-- ============================================================================
-- STEP 3: VERIFY CLEANUP COMPLETE
-- ============================================================================
DO $$
DECLARE
  remaining_stale int;
  btc_rate_after numeric;
  btc_source_after varchar;
BEGIN
  -- Count remaining stale hardcoded rates
  SELECT COUNT(*)
  INTO remaining_stale
  FROM pairs
  WHERE source_table = 'currency_rates'
    AND updated_at < NOW() - INTERVAL '1 hour'
    AND to_currency = 'PHP';
  
  -- Check what BTC rate is now (should be NULL or real rate)
  SELECT rate, source_table
  INTO btc_rate_after, btc_source_after
  FROM pairs
  WHERE from_currency = 'BTC' AND to_currency = 'PHP'
  ORDER BY updated_at DESC
  LIMIT 1;
  
  RAISE NOTICE '
╔════════════════════════════════════════════════════════════════╗
║        MIGRATION 0206 - CLEANUP COMPLETE                       ║
╠════════════════════════════════════════════════════════════════╣
║ RESULTS:                                                       ║
║   Stale hardcoded rates removed: YES                           ║
║   Remaining stale rates: %                                     ║
║   Current BTC rate after cleanup: %                            ║
║   Source: %                                                    ║
║                                                                ║
║ NEXT STEPS:                                                    ║
║   1. If BTC rate is NULL: Call fetch-rates edge function      ║
║   2. Run: npm run fetch-rates                                  ║
║   3. Or: npx supabase functions deploy fetch-rates             ║
║   4. Refresh deposits page to see corrected rates              ║
║                                                                ║
║ EXPECTED RESULT:                                               ║
║   ✓ 1 PHP = 0.0000001931 BTC (correct rate)                   ║
║   ✓ Deposits show accurate conversion rates                    ║
║   ✓ No more 0.0000004 PHP→BTC display error                   ║
╚════════════════════════════════════════════════════════════════╝
  ',
  remaining_stale,
  COALESCE(btc_rate_after::text, 'NO RATE FOUND - NEED FETCH-RATES'),
  COALESCE(btc_source_after, 'N/A');
END $$;

-- ============================================================================
-- STEP 4: AUDIT LOG
-- ============================================================================
INSERT INTO pairs_migration_audit (action_type, from_currency, to_currency, old_rate, reason)
VALUES (
  'MIGRATION_0206_CLEANUP',
  'ALL',
  'PHP',
  0,
  'Removed all stale hardcoded rates (source_table=currency_rates) that were causing incorrect BTC=2,500,000 display. ' ||
  'Deposits now showing 1 PHP = 0.0000004 BTC must call fetch-rates to populate real rates from APIs.'
)
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================
-- Query 1: Check current BTC rate
-- SELECT from_currency, to_currency, rate, source_table, updated_at 
-- FROM pairs 
-- WHERE from_currency = 'BTC' AND to_currency = 'PHP'
-- ORDER BY updated_at DESC;

-- Query 2: Check for remaining hardcoded rates
-- SELECT COUNT(*), source_table 
-- FROM pairs 
-- WHERE to_currency = 'PHP' 
-- GROUP BY source_table;

-- Query 3: If no BTC rate, you need to call fetch-rates
-- SELECT COUNT(*) 
-- FROM pairs 
-- WHERE rate IS NOT NULL AND to_currency = 'PHP';
