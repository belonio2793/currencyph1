# Currency Pairs - SQL Reference & Query Collection

This document contains ready-to-use SQL queries for managing, monitoring, and troubleshooting the currency pairs system after the canonical direction fix.

---

## 📊 Monitoring Queries

### 1. Overview Dashboard
```sql
-- Get complete overview of pairs database
WITH pair_stats AS (
  SELECT 
    pair_direction,
    COUNT(*) as count,
    COUNT(DISTINCT from_currency) as unique_from,
    COUNT(DISTINCT to_currency) as unique_to
  FROM pairs
  GROUP BY pair_direction
)
SELECT 
  pair_direction,
  count,
  unique_from,
  unique_to,
  ROUND(100.0 * count / SUM(count) OVER (), 1) || '%' as percentage
FROM pair_stats
ORDER BY count DESC;
```

### 2. Data Quality Report
```sql
-- Check for data quality issues
SELECT
  'Duplicate pairs' as issue,
  COUNT(*) as count
FROM (
  SELECT from_currency, to_currency
  FROM pairs
  GROUP BY from_currency, to_currency
  HAVING COUNT(*) > 1
) subq
UNION ALL
SELECT 'Invalid rates (zero or negative)', COUNT(*)
FROM pairs WHERE rate <= 0 OR rate IS NULL
UNION ALL
SELECT 'Missing from_currency', COUNT(*)
FROM pairs WHERE from_currency IS NULL
UNION ALL
SELECT 'Missing to_currency', COUNT(*)
FROM pairs WHERE to_currency IS NULL
UNION ALL
SELECT 'Missing pair_direction', COUNT(*)
FROM pairs WHERE pair_direction IS NULL;
```

### 3. Pair Direction Distribution
```sql
-- Show distribution of canonical vs inverse pairs
SELECT 
  pair_direction,
  is_inverted,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as percentage,
  MIN(updated_at) as oldest_update,
  MAX(updated_at) as newest_update
FROM pairs
GROUP BY pair_direction, is_inverted
ORDER BY pair_direction, is_inverted;
```

---

## 🔍 Currency Pair Queries

### 4. Find All Pairs for a Currency
```sql
-- Find all trading pairs involving a specific currency (e.g., PHP)
SELECT
  from_currency,
  to_currency,
  rate,
  pair_direction,
  is_inverted,
  updated_at
FROM pairs
WHERE from_currency = 'PHP' OR to_currency = 'PHP'
ORDER BY from_currency, to_currency;
```

### 5. Find Bidirectional Pairs
```sql
-- Find pairs that have both directions (X→Y and Y→X)
SELECT
  p1.from_currency,
  p1.to_currency,
  p1.rate as forward_rate,
  ROUND(1.0 / p1.rate, 8) as expected_inverse,
  p2.rate as actual_inverse,
  CASE 
    WHEN ABS((1.0 / p1.rate) - p2.rate) < 0.00001 THEN '✓ Matches'
    ELSE '⚠ Discrepancy'
  END as rate_check
FROM pairs p1
LEFT JOIN pairs p2 
  ON p1.from_currency = p2.to_currency 
  AND p1.to_currency = p2.from_currency
WHERE p1.from_currency < p1.to_currency
ORDER BY p1.from_currency, p1.to_currency;
```

### 6. Find Missing Pairs
```sql
-- Find all canonical pairs and check if inverse exists
SELECT
  p.from_currency,
  p.to_currency,
  p.rate,
  CASE WHEN inv.id IS NOT NULL THEN '✓' ELSE '✗ Missing' END as has_inverse
FROM pairs p
LEFT JOIN pairs inv 
  ON p.from_currency = inv.to_currency 
  AND p.to_currency = inv.from_currency
WHERE p.pair_direction = 'canonical'
ORDER BY p.from_currency;
```

### 7. Compare Canonical vs Inverse
```sql
-- Compare canonical and its inverse pair
SELECT
  canonical.from_currency,
  canonical.to_currency,
  canonical.rate as canonical_rate,
  CASE WHEN inverse.id IS NOT NULL THEN inverse.rate ELSE NULL END as inverse_rate,
  CASE 
    WHEN inverse.id IS NULL THEN '✗ No inverse'
    WHEN ABS((1.0 / canonical.rate) - inverse.rate) < 0.00001 THEN '✓ Match'
    ELSE '⚠ Mismatch'
  END as status
FROM pairs canonical
LEFT JOIN pairs inverse ON canonical.from_currency = inverse.to_currency AND canonical.to_currency = inverse.from_currency
WHERE canonical.pair_direction = 'canonical'
ORDER BY canonical.from_currency;
```

---

## 💱 Exchange Rate Queries

### 8. Get Current Rate for Pair
```sql
-- Get the current rate for a specific pair
SELECT
  from_currency,
  to_currency,
  rate,
  source_table,
  updated_at,
  ROUND(100.0 * (CURRENT_TIMESTAMP - updated_at) / INTERVAL '1 hour', 1) as hours_old
FROM pairs
WHERE from_currency = 'BTC' AND to_currency = 'PHP'
ORDER BY updated_at DESC
LIMIT 1;
```

### 9. Calculate Conversion
```sql
-- Convert an amount from one currency to another
WITH rate_data AS (
  SELECT
    1 as amount,  -- Change this to the amount you want to convert
    'BTC' as from_curr,
    'PHP' as to_curr,
    (SELECT rate FROM pairs WHERE from_currency = 'BTC' AND to_currency = 'PHP' LIMIT 1) as rate
)
SELECT
  amount,
  from_curr,
  '→' as arrow,
  to_curr,
  ROUND(amount * rate, 2) as converted_amount,
  rate as exchange_rate
FROM rate_data;
```

### 10. Top 10 Most Recently Updated Rates
```sql
-- See which pairs were updated most recently
SELECT
  from_currency,
  to_currency,
  rate,
  source_table,
  updated_at,
  CURRENT_TIMESTAMP - updated_at as age
FROM pairs
ORDER BY updated_at DESC
LIMIT 10;
```

---

## 📋 Audit Trail Queries

### 11. View Migration Audit Trail
```sql
-- See complete history of migration changes
SELECT
  action_type,
  from_currency,
  to_currency,
  COUNT(*) as count,
  MAX(created_at) as last_action,
  STRING_AGG(DISTINCT reason, '; ')::TEXT as reasons
FROM pairs_migration_audit
GROUP BY action_type, from_currency, to_currency
ORDER BY created_at DESC;
```

### 12. Audit Summary by Action Type
```sql
-- Summary of all migration actions
SELECT
  action_type,
  COUNT(*) as count,
  MIN(created_at) as first_action,
  MAX(created_at) as last_action,
  ROUND((EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 60)::NUMERIC, 1) as duration_minutes
FROM pairs_migration_audit
GROUP BY action_type
ORDER BY first_action ASC;
```

### 13. Recent Pair Changes
```sql
-- Track changes to specific pairs during migration
SELECT
  action_type,
  from_currency,
  to_currency,
  old_rate,
  new_rate,
  reason,
  created_at
FROM pairs_migration_audit
WHERE from_currency IS NOT NULL AND to_currency IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;
```

---

## 🔧 Maintenance Queries

### 14. Update Outdated Rates
```sql
-- Find rates older than a certain age
SELECT
  from_currency,
  to_currency,
  rate,
  updated_at,
  CURRENT_TIMESTAMP - updated_at as age,
  EXTRACT(HOUR FROM (CURRENT_TIMESTAMP - updated_at)) as hours_old
FROM pairs
WHERE updated_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY updated_at ASC;
```

### 15. Check Confidence Scores
```sql
-- Review confidence scores of rates
SELECT
  from_currency,
  to_currency,
  confidence_score,
  COUNT(*) as count
FROM pairs
WHERE confidence_score IS NOT NULL
GROUP BY from_currency, to_currency, confidence_score
ORDER BY confidence_score ASC;
```

### 16. Find Low Confidence Pairs
```sql
-- Find pairs with low confidence (potential issues)
SELECT
  from_currency,
  to_currency,
  rate,
  confidence_score,
  source_table,
  migration_notes
FROM pairs
WHERE confidence_score < 0.9 OR confidence_score IS NULL
ORDER BY confidence_score ASC;
```

---

## ⚠️ Validation Queries

### 17. Detect Invalid Rates
```sql
-- Find any invalid rates
SELECT
  id,
  from_currency,
  to_currency,
  rate,
  CASE 
    WHEN rate IS NULL THEN '✗ NULL rate'
    WHEN rate <= 0 THEN '✗ Non-positive rate'
    WHEN rate > 1000000000 THEN '⚠ Suspiciously high'
    WHEN rate < 0.00000001 THEN '⚠ Suspiciously low'
    ELSE '✓ Valid'
  END as validation
FROM pairs
WHERE rate IS NULL OR rate <= 0 OR rate > 1000000000 OR rate < 0.00000001
ORDER BY rate DESC;
```

### 18. Find Orphaned Inverse Pairs
```sql
-- Find inverse pairs without corresponding canonical pair
SELECT
  p.from_currency,
  p.to_currency,
  p.rate,
  p.is_inverted
FROM pairs p
WHERE p.is_inverted = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM pairs p2
    WHERE p2.from_currency = p.to_currency
      AND p2.to_currency = p.from_currency
      AND p2.is_inverted = FALSE
  )
ORDER BY p.from_currency;
```

### 19. Check for Direction Inconsistencies
```sql
-- Verify pair_direction is set correctly
SELECT
  from_currency,
  to_currency,
  pair_direction,
  is_inverted,
  CASE
    WHEN to_currency = 'PHP' AND pair_direction != 'canonical' THEN '✗ Should be canonical'
    WHEN from_currency = 'PHP' AND to_currency != 'PHP' AND pair_direction != 'inverse' THEN '✗ Should be inverse'
    WHEN pair_direction NOT IN ('canonical', 'inverse', 'other') THEN '✗ Invalid direction'
    ELSE '✓ Correct'
  END as check
FROM pairs
WHERE pair_direction NOT IN ('canonical', 'inverse', 'other')
  OR (to_currency = 'PHP' AND pair_direction != 'canonical')
  OR (from_currency = 'PHP' AND to_currency != 'PHP' AND pair_direction != 'inverse')
ORDER BY from_currency;
```

---

## 🎯 Source Table Queries

### 20. Rates by Source Table
```sql
-- See where rates are coming from
SELECT
  source_table,
  COUNT(*) as count,
  COUNT(DISTINCT from_currency) as currencies,
  MIN(updated_at) as oldest,
  MAX(updated_at) as newest,
  ROUND(AVG(rate), 2) as avg_rate
FROM pairs
GROUP BY source_table
ORDER BY count DESC;
```

### 21. Find Pairs from Specific Source
```sql
-- Get all pairs from a specific source
SELECT
  from_currency,
  to_currency,
  rate,
  updated_at,
  CURRENT_TIMESTAMP - updated_at as age
FROM pairs
WHERE source_table = 'cryptocurrency_rates'
ORDER BY updated_at DESC
LIMIT 20;
```

---

## 🔄 Comparison Queries

### 22. Compare Pre & Post Migration
```sql
-- Compare data before and after migration
SELECT
  backup.from_currency,
  backup.to_currency,
  backup.rate as backup_rate,
  current.rate as current_rate,
  CASE
    WHEN backup.rate = current.rate THEN '✓ Unchanged'
    WHEN current.rate IS NULL THEN '✗ Deleted'
    ELSE '⚠ Changed: ' || ROUND(ABS((current.rate - backup.rate) / backup.rate * 100), 2) || '%'
  END as status
FROM pairs_backup_pre_migration backup
LEFT JOIN pairs current ON backup.from_currency = current.from_currency AND backup.to_currency = current.to_currency
ORDER BY backup.from_currency, backup.to_currency;
```

### 23. Find Differences Between Backup and Current
```sql
-- Show pairs that differ between backup and current
SELECT
  COALESCE(backup.from_currency, current.from_currency) as from_currency,
  COALESCE(backup.to_currency, current.to_currency) as to_currency,
  COALESCE(backup.rate, 0) as backup_rate,
  COALESCE(current.rate, 0) as current_rate,
  current.pair_direction,
  CASE
    WHEN backup.id IS NULL THEN '✗ New in current'
    WHEN current.id IS NULL THEN '✗ Deleted from current'
    ELSE '⚠ Rate changed'
  END as change_type
FROM pairs_backup_pre_migration backup
FULL OUTER JOIN pairs current ON backup.from_currency = current.from_currency AND backup.to_currency = current.to_currency
WHERE backup.id IS NULL OR current.id IS NULL OR backup.rate != current.rate
ORDER BY from_currency, to_currency;
```

---

## 🛠️ Administrative Queries

### 24. Backup Current Pairs (Create New Snapshot)
```sql
-- Create a new backup snapshot for comparison
INSERT INTO pairs_backup_pre_migration (id, from_currency, to_currency, rate, source_table, updated_at)
SELECT id, from_currency, to_currency, rate, source_table, updated_at FROM pairs
WHERE id NOT IN (SELECT id FROM pairs_backup_pre_migration)
ON CONFLICT DO NOTHING;

-- Verify backup created
SELECT COUNT(*) as new_backup_rows FROM pairs_backup_pre_migration;
```

### 25. Refresh Pair Direction Metadata
```sql
-- Re-check and update pair_direction for all pairs
UPDATE pairs SET pair_direction = 'canonical' WHERE to_currency = 'PHP' AND pair_direction != 'canonical';
UPDATE pairs SET pair_direction = 'inverse' WHERE from_currency = 'PHP' AND to_currency != 'PHP' AND pair_direction != 'inverse';
UPDATE pairs SET pair_direction = 'other' WHERE pair_direction IS NULL;

-- Verify updates
SELECT pair_direction, COUNT(*) FROM pairs GROUP BY pair_direction;
```

### 26. Recalculate Inverse Pair Rates
```sql
-- Verify and fix any inverse pair rate discrepancies
UPDATE pairs p2
SET rate = (1.0 / p1.rate)::NUMERIC
FROM pairs p1
WHERE p2.from_currency = p1.to_currency
  AND p2.to_currency = p1.from_currency
  AND p1.pair_direction = 'canonical'
  AND p2.pair_direction = 'inverse'
  AND ABS(p2.rate - (1.0 / p1.rate)) > 0.00001;

-- Check how many were updated
SELECT COUNT(*) as rows_updated FROM pairs WHERE updated_at > CURRENT_TIMESTAMP - INTERVAL '1 minute';
```

---

## 📈 Performance & Reporting Queries

### 27. Table Size & Index Statistics
```sql
-- Check storage usage
SELECT
  'pairs' as table_name,
  pg_size_pretty(pg_total_relation_size('pairs')) as total_size,
  pg_size_pretty(pg_relation_size('pairs')) as table_size,
  pg_size_pretty(pg_indexes_size('pairs')) as indexes_size,
  (SELECT COUNT(*) FROM pairs) as row_count;
```

### 28. Index Usage Statistics
```sql
-- See which indexes are being used
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scan_count,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'pairs'
ORDER BY idx_scan DESC;
```

### 29. Most Common Query Patterns
```sql
-- Identify top PHP pairs (most likely queries)
SELECT
  from_currency,
  COUNT(*) as frequency
FROM pairs
WHERE to_currency = 'PHP'
GROUP BY from_currency
ORDER BY frequency DESC
LIMIT 20;
```

---

## 🔔 Alert Queries (Use for Monitoring)

### 30. Daily Rate Update Check
```sql
-- Alert if critical pairs haven't been updated
SELECT
  from_currency,
  to_currency,
  updated_at,
  CURRENT_TIMESTAMP - updated_at as age,
  CASE
    WHEN CURRENT_TIMESTAMP - updated_at > INTERVAL '24 hours' THEN '🔴 CRITICAL'
    WHEN CURRENT_TIMESTAMP - updated_at > INTERVAL '6 hours' THEN '🟠 WARNING'
    ELSE '🟢 OK'
  END as status
FROM pairs
WHERE to_currency = 'PHP' AND from_currency IN ('BTC', 'USD', 'EUR', 'GBP')
ORDER BY updated_at ASC;
```

---

## Quick Copy-Paste Commands

### Get Latest BTC/PHP Rate
```sql
SELECT rate FROM pairs WHERE from_currency = 'BTC' AND to_currency = 'PHP' LIMIT 1;
```

### Check All PHP Pairs
```sql
SELECT * FROM pairs WHERE to_currency = 'PHP' ORDER BY from_currency;
```

### Count Canonical Pairs
```sql
SELECT COUNT(*) FROM pairs WHERE pair_direction = 'canonical';
```

### Find Problematic Pairs
```sql
SELECT * FROM pairs WHERE rate IS NULL OR rate <= 0 OR pair_direction IS NULL;
```

### View Migration Summary
```sql
SELECT * FROM pairs_migration_audit ORDER BY created_at DESC LIMIT 20;
```

---

## Notes

- All timestamps are in UTC (TIMESTAMPTZ)
- All rates use NUMERIC type (high precision)
- Currency codes are VARCHAR(10), uppercased
- Backup tables are snapshots, not live data
- Audit table logs all changes for compliance

---

**Last Updated**: 2025-01-15  
**Version**: 1.0  
**Compatible with**: PostgreSQL 12+
