-- ============================================
-- SQL AUDIT QUERIES FOR EXCHANGE RATES
-- Run these in Supabase SQL Editor
-- ============================================

-- 1. CHECK PAIRS TABLE STATUS
-- Shows count of pairs and data quality
SELECT 
  COUNT(*) as total_pairs,
  COUNT(DISTINCT from_currency) as unique_from_currencies,
  COUNT(DISTINCT to_currency) as unique_to_currencies,
  COUNT(DISTINCT source_table) as unique_sources,
  MAX(updated_at) as latest_update,
  MIN(updated_at) as oldest_update
FROM public.pairs;

-- 2. CHECK FOR MISSING OR INVALID RATES
-- Shows pairs with NULL, zero, or negative rates
SELECT 
  from_currency,
  to_currency,
  rate,
  updated_at,
  source_table
FROM public.pairs
WHERE rate IS NULL 
  OR rate <= 0 
  OR rate = 0
  OR NOT isfinite(rate::numeric)
ORDER BY updated_at DESC
LIMIT 50;

-- 3. CHECK USD-TO-PHP RATES (CRITICAL)
-- Should have recent data with positive rate
SELECT 
  from_currency,
  to_currency,
  rate,
  updated_at,
  source_table
FROM public.pairs
WHERE (
  (from_currency = 'USD' AND to_currency = 'PHP')
  OR (from_currency = 'PHP' AND to_currency = 'USD')
)
ORDER BY updated_at DESC
LIMIT 10;

-- 4. CHECK BTC-TO-PHP RATES (FOR CRYPTO DEPOSITS)
-- Should show large numbers (2.5M+) for BTC->PHP
SELECT 
  from_currency,
  to_currency,
  rate,
  updated_at,
  source_table
FROM public.pairs
WHERE from_currency = 'BTC' 
  AND (to_currency = 'PHP' OR to_currency = 'USD')
ORDER BY updated_at DESC
LIMIT 10;

-- 5. CHECK CANONICAL PAIRS VIEW
-- Shows the view used by Deposits component
SELECT 
  from_currency,
  to_currency,
  rate,
  updated_at
FROM public.pairs_canonical
ORDER BY updated_at DESC
LIMIT 20;

-- 6. COUNT PAIRS BY SOURCE
-- Shows which APIs are providing data
SELECT 
  source_table,
  COUNT(*) as count,
  MAX(updated_at) as latest_update,
  COUNT(CASE WHEN rate > 0 AND rate IS NOT NULL THEN 1 END) as valid_rates
FROM public.pairs
GROUP BY source_table
ORDER BY latest_update DESC;

-- 7. CHECK FOR DUPLICATE PAIRS
-- Identifies conflicting rates for same currency pair
SELECT 
  from_currency,
  to_currency,
  COUNT(*) as duplicate_count,
  COUNT(DISTINCT rate) as different_rates,
  STRING_AGG(DISTINCT source_table, ', ') as sources,
  ARRAY_AGG(DISTINCT rate ORDER BY rate) as all_rates
FROM public.pairs
WHERE rate > 0
GROUP BY from_currency, to_currency
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 20;

-- 8. CHECK RATES FRESHNESS
-- Shows how old the rates are
SELECT 
  from_currency,
  to_currency,
  rate,
  updated_at,
  NOW() - updated_at as age,
  EXTRACT(HOURS FROM NOW() - updated_at) as hours_old,
  source_table
FROM public.pairs
WHERE rate > 0 
  AND rate IS NOT NULL
ORDER BY updated_at DESC
LIMIT 30;

-- 9. FIND MISSING COMMON CURRENCIES
-- Check if USD, EUR, GBP, JPY, etc. have rates
SELECT DISTINCT from_currency
FROM public.pairs
WHERE to_currency = 'PHP'
  AND rate > 0
  AND rate IS NOT NULL
ORDER BY from_currency;

-- 10. CHECK DEPOSITS TABLE FOR RATE USAGE
-- Shows what rates were used in actual deposits
SELECT 
  deposit_method,
  from_currency,
  to_currency,
  exchange_rate,
  COUNT(*) as count,
  MAX(created_at) as latest,
  AVG(exchange_rate::numeric) as avg_rate,
  MIN(exchange_rate::numeric) as min_rate,
  MAX(exchange_rate::numeric) as max_rate
FROM public.deposits
WHERE exchange_rate > 0 
  AND exchange_rate IS NOT NULL
GROUP BY deposit_method, from_currency, to_currency
ORDER BY latest DESC
LIMIT 30;

-- 11. IDENTIFY STALE RATES
-- Rates older than 1 hour
SELECT 
  from_currency,
  to_currency,
  rate,
  updated_at,
  source_table,
  NOW() - updated_at as staleness
FROM public.pairs
WHERE updated_at < NOW() - INTERVAL '1 hour'
  AND rate > 0
ORDER BY updated_at ASC
LIMIT 50;

-- 12. VERIFY RATE CONSISTENCY
-- Compare rates from different sources for same pair
SELECT 
  from_currency,
  to_currency,
  source_table,
  rate,
  updated_at,
  ROW_NUMBER() OVER (PARTITION BY from_currency, to_currency ORDER BY updated_at DESC) as recency_rank
FROM public.pairs
WHERE from_currency IN ('USD', 'EUR', 'GBP', 'JPY')
  AND to_currency = 'PHP'
  AND rate > 0
ORDER BY from_currency, to_currency, recency_rank;
