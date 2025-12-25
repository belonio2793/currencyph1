/**
 * DIAGNOSTIC QUERY: Identify What's Overriding Real Rates
 * 
 * Run this in Supabase SQL Editor to see:
 * 1. What rates are currently in the database
 * 2. Where they came from (source_table)
 * 3. When they were last updated
 * 4. Which rates are hardcoded fallbacks vs real
 */

-- ============================================================================
-- Query 1: Show critical rates and their sources
-- ============================================================================
SELECT 
  from_currency,
  to_currency,
  rate,
  source_table,
  updated_at,
  CASE
    WHEN source_table IN ('cryptocurrency_rates', 'currency_rates') 
      AND updated_at > NOW() - INTERVAL '2 hours'
    THEN '✓ REAL (Fresh from fetch-rates)'
    WHEN source_table = 'currency_rates' AND updated_at < NOW() - INTERVAL '2 hours'
    THEN '⚠️ STALE (Hardcoded fallback?)'
    ELSE '❓ UNKNOWN'
  END as assessment,
  EXTRACT(EPOCH FROM (NOW() - updated_at))/3600 as hours_ago
FROM pairs
WHERE from_currency IN ('BTC', 'ETH', 'USD', 'EUR', 'USDT', 'BNB')
  AND to_currency = 'PHP'
ORDER BY from_currency, updated_at DESC;

-- ============================================================================
-- Query 2: Check for duplicate pairs (real vs hardcoded)
-- ============================================================================
SELECT 
  from_currency,
  COUNT(*) as duplicate_count,
  STRING_AGG(source_table || ' (' || rate || ')', ' | ') as all_sources_and_rates
FROM pairs
WHERE to_currency = 'PHP'
GROUP BY from_currency
HAVING COUNT(*) > 1
ORDER BY from_currency;

-- ============================================================================
-- Query 3: Compare hardcoded fallback rates vs real rates
-- ============================================================================
-- Shows discrepancies between what was set as fallback and what fetch-rates has
WITH fallback_rates AS (
  SELECT 
    from_currency,
    rate as fallback_rate,
    updated_at as fallback_updated
  FROM pairs
  WHERE source_table = 'currency_rates'
    AND updated_at < NOW() - INTERVAL '2 hours'
    AND to_currency = 'PHP'
),
real_rates AS (
  SELECT 
    from_currency,
    rate as real_rate,
    updated_at as real_updated
  FROM pairs
  WHERE source_table IN ('cryptocurrency_rates', 'currency_rates')
    AND updated_at >= NOW() - INTERVAL '2 hours'
    AND to_currency = 'PHP'
)
SELECT 
  COALESCE(f.from_currency, r.from_currency) as currency,
  f.fallback_rate,
  r.real_rate,
  CASE
    WHEN r.real_rate IS NULL THEN '❌ NO REAL RATE'
    WHEN f.fallback_rate IS NULL THEN '✓ REAL ONLY'
    WHEN ABS((f.fallback_rate - r.real_rate) / r.real_rate) > 0.1 THEN '⚠️ DISCREPANCY'
    ELSE '✓ MATCH'
  END as status,
  ROUND((f.fallback_rate - r.real_rate)::numeric, 2) as difference
FROM fallback_rates f
FULL OUTER JOIN real_rates r ON f.from_currency = r.from_currency
ORDER BY COALESCE(f.from_currency, r.from_currency);

-- ============================================================================
-- Query 4: Show what should be removed
-- ============================================================================
SELECT 
  from_currency,
  to_currency,
  rate,
  source_table,
  updated_at,
  'DELETE' as action
FROM pairs
WHERE source_table = 'currency_rates'
  AND updated_at < NOW() - INTERVAL '2 hours'
  AND to_currency = 'PHP'
  AND EXISTS (
    SELECT 1 FROM pairs p2
    WHERE p2.from_currency = pairs.from_currency
      AND p2.to_currency = pairs.to_currency
      AND p2.source_table IN ('cryptocurrency_rates', 'currency_rates')
      AND p2.updated_at >= NOW() - INTERVAL '2 hours'
  )
ORDER BY from_currency;

-- ============================================================================
-- Query 5: Show rates table structure
-- ============================================================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'pairs'
ORDER BY ordinal_position;

-- ============================================================================
-- Query 6: Show migration audit trail
-- ============================================================================
SELECT 
  action_type,
  COUNT(*) as count,
  MAX(created_at) as last_action,
  STRING_AGG(DISTINCT reason, ' | ') as reasons
FROM pairs_migration_audit
GROUP BY action_type
ORDER BY last_action DESC
LIMIT 20;
