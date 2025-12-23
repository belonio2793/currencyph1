-- ============================================================================
-- PULL ALL RATES FROM public.pairs TABLE
-- ============================================================================

-- 1. GET ALL RATES (Complete List)
SELECT 
  from_currency,
  to_currency,
  rate,
  source_table,
  updated_at,
  id
FROM public.pairs
ORDER BY from_currency, to_currency;


-- ============================================================================
-- DIAGNOSTIC QUERIES
-- ============================================================================

-- 2. CHECK TABLE ROW COUNT
SELECT COUNT(*) as total_rate_pairs FROM public.pairs;


-- 3. CHECK DATA BY SOURCE
SELECT 
  source_table,
  COUNT(*) as pair_count,
  MIN(updated_at) as oldest_update,
  MAX(updated_at) as newest_update
FROM public.pairs
GROUP BY source_table
ORDER BY pair_count DESC;


-- 4. CHECK FOR INVALID RATES (0.00 or NULL)
SELECT 
  from_currency,
  to_currency,
  rate,
  updated_at
FROM public.pairs
WHERE rate IS NULL OR rate = 0 OR rate < 0
ORDER BY from_currency, to_currency;


-- 5. GET RATES FOR SPECIFIC CURRENCY (PHP)
SELECT 
  from_currency,
  to_currency,
  rate,
  source_table,
  updated_at
FROM public.pairs
WHERE from_currency = 'PHP'
ORDER BY to_currency;


-- 6. GET RECENT UPDATES (Last 100)
SELECT 
  from_currency,
  to_currency,
  rate,
  source_table,
  updated_at
FROM public.pairs
ORDER BY updated_at DESC
LIMIT 100;


-- 7. CHECK CRYPTO RATES SPECIFICALLY
SELECT 
  from_currency,
  to_currency,
  rate,
  source_table,
  updated_at
FROM public.pairs
WHERE source_table = 'cryptocurrency_rates' OR source_table = 'crypto_rates'
ORDER BY from_currency, to_currency;


-- 8. CHECK FIAT RATES SPECIFICALLY
SELECT 
  from_currency,
  to_currency,
  rate,
  source_table,
  updated_at
FROM public.pairs
WHERE source_table = 'currency_rates' OR source_table = 'fiat_rates'
ORDER BY from_currency, to_currency;


-- 9. GET RATE STATISTICS
SELECT 
  COUNT(*) as total_pairs,
  COUNT(DISTINCT from_currency) as unique_from_currencies,
  COUNT(DISTINCT to_currency) as unique_to_currencies,
  MIN(rate) as lowest_rate,
  MAX(rate) as highest_rate,
  AVG(rate) as average_rate,
  MAX(updated_at) as last_update_time
FROM public.pairs
WHERE rate > 0;


-- 10. VERIFY PAIRS TABLE STRUCTURE
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'pairs'
ORDER BY ordinal_position;
