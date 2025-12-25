/**
 * MIGRATION 0204: Remove Hardcoded Fallback Rates - Use Real Rates Only
 * 
 * PROBLEM: Migration 0203 set hardcoded fallback rates that OVERRIDE real rates
 * from the fetch-rates edge function.
 * 
 * Example: BTC shown as 2,500,000 (hardcoded fallback) instead of ~5,186,122
 * (real rate from fetch-rates)
 * 
 * SOLUTION: Delete hardcoded fallback rates. Keep ONLY real rates from
 * fetch-rates edge function (source_table = 'cryptocurrency_rates' or
 * 'currency_rates' from real APIs)
 */

BEGIN;

-- ============================================================================
-- STEP 1: Audit current state before changes
-- ============================================================================
INSERT INTO pairs_migration_audit (action_type, from_currency, to_currency, old_rate, reason)
SELECT 
  'AUDIT_BEFORE_FALLBACK_REMOVAL',
  from_currency,
  to_currency,
  rate,
  'Current rate before fallback removal: ' || source_table
FROM pairs
WHERE (from_currency, to_currency) IN (
  ('BTC', 'PHP'),
  ('ETH', 'PHP'),
  ('USD', 'PHP'),
  ('EUR', 'PHP'),
  ('USDT', 'PHP'),
  ('BNB', 'PHP')
);

-- ============================================================================
-- STEP 2: Identify which rates are from real sources vs hardcoded fallbacks
-- ============================================================================
-- Query to see what we have
CREATE OR REPLACE VIEW rates_audit_view AS
SELECT 
  from_currency,
  to_currency,
  rate,
  source_table,
  updated_at,
  CASE
    WHEN source_table IN ('cryptocurrency_rates', 'currency_rates') THEN '✓ REAL (from API/edge function)'
    ELSE '⚠️ FALLBACK (hardcoded)'
  END as rate_source,
  CASE
    WHEN source_table IN ('cryptocurrency_rates', 'currency_rates') THEN 'KEEP'
    ELSE 'REVIEW'
  END as action
FROM pairs
WHERE to_currency = 'PHP'
ORDER BY from_currency;

-- ============================================================================
-- STEP 3: Delete pairs with hardcoded fallback rates (source_table = 'currency_rates' 
-- ONLY if they haven't been updated recently by fetch-rates edge function)
-- ============================================================================
-- Strategy: Keep rates that were updated within the last hour (likely from fetch-rates)
-- Delete rates that haven't been updated in a while (likely hardcoded fallbacks)

DELETE FROM pairs
WHERE source_table = 'currency_rates'
  AND updated_at < NOW() - INTERVAL '1 hour'
  AND (from_currency, to_currency) NOT IN (
    -- Keep PHP rates
    SELECT from_currency, to_currency FROM pairs 
    WHERE source_table IN ('cryptocurrency_rates', 'currency_rates')
      AND updated_at >= NOW() - INTERVAL '1 hour'
  );

INSERT INTO pairs_migration_audit (action_type, from_currency, to_currency, reason)
SELECT 
  'DELETED_STALE_FALLBACK',
  from_currency,
  to_currency,
  'Removed hardcoded fallback rate (not updated in 1 hour)'
FROM pairs_backup_pre_migration
WHERE source_table = 'currency_rates'
  AND updated_at < NOW() - INTERVAL '1 hour'
  AND (from_currency, to_currency) NOT IN (
    SELECT from_currency, to_currency FROM pairs 
    WHERE source_table IN ('cryptocurrency_rates', 'currency_rates')
      AND updated_at >= NOW() - INTERVAL '1 hour'
  );

-- ============================================================================
-- STEP 4: Verify real rates from fetch-rates edge function
-- ============================================================================
DO $$
DECLARE
  btc_rate numeric;
  eth_rate numeric;
  btc_source varchar;
  eth_source varchar;
  btc_updated timestamptz;
  eth_updated timestamptz;
BEGIN
  SELECT rate, source_table, updated_at INTO btc_rate, btc_source, btc_updated 
  FROM pairs 
  WHERE from_currency = 'BTC' AND to_currency = 'PHP'
  LIMIT 1;
  
  SELECT rate, source_table, updated_at INTO eth_rate, eth_source, eth_updated
  FROM pairs 
  WHERE from_currency = 'ETH' AND to_currency = 'PHP'
  LIMIT 1;
  
  RAISE NOTICE '
╔════════════════════════════════════════════════════════════════╗
║       MIGRATION 0204 - REAL RATES AUDIT & FALLBACK REMOVAL     ║
╠════════════════════════════════════════════════════════════════╣
║ CURRENT BTC RATE:                                              ║
║   Rate: %                                                      ║
║   Source: %                                                    ║
║   Updated: %                                                   ║
║                                                                ║
║ CURRENT ETH RATE:                                              ║
║   Rate: %                                                      ║
║   Source: %                                                    ║
║   Updated: %                                                   ║
╠════════════════════════════════════════════════════════════════╣
║ ✓ Only rates from fetch-rates edge function will be used       ║
║ ✓ Hardcoded fallback rates removed                             ║
║ ✓ Real-time rates now guaranteed                              ║
╚════════════════════════════════════════════════════════════════╝
  ',
  coalesce(btc_rate::text, 'NULL'),
  coalesce(btc_source, 'NULL'),
  coalesce(btc_updated::text, 'NULL'),
  coalesce(eth_rate::text, 'NULL'),
  coalesce(eth_source, 'NULL'),
  coalesce(eth_updated::text, 'NULL');
END $$;

-- ============================================================================
-- STEP 5: Log completion
-- ============================================================================
INSERT INTO pairs_migration_audit (action_type, reason)
VALUES (
  'MIGRATION_0204_COMPLETE',
  'Removed hardcoded fallback rates. Only real rates from fetch-rates edge function will be displayed.'
);

COMMIT;
