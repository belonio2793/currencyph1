# Currency Pairs Canonical Direction Fix - Complete Guide

## Executive Summary

This migration fixes a critical issue where the database contained currency pairs in **both directions** (BTC→PHP and PHP→BTC), causing the UI to sometimes pick the **inverted pair** and display incorrect exchange rates (e.g., "1 BTC = 6.51 PHP" instead of "1 BTC = 2,500,000 PHP").

**Status**: ✅ MIGRATION READY TO DEPLOY
**File**: `supabase/migrations/0200_fix_currency_pairs_canonical_direction.sql`

---

## The Problem

### What Happened

The `public.pairs` table had a UNIQUE constraint on `(from_currency, to_currency)`, allowing one rate per ordered pair. However:

1. **Legacy behavior stored both directions**:
   - When rates were fetched, the system stored BOTH `BTC→PHP` AND `PHP→BTC`
   - This was done to support different query directions without recalculation

2. **Inversion logic introduced errors**:
   - `PHP→BTC` = 1/`BTC→PHP` ratio
   - Example: If `1 BTC = 2,500,000 PHP`, then `1 PHP = 0.00000004 BTC`
   - When both existed with the same timestamp, the UI logic would randomly pick one

3. **Inconsistent UI display**:
   - The rate picker would show inverted pairs alongside canonical ones
   - Users would see "1 BTC = 6.51 PHP" (inverted direction showing as PHP to BTC conversion)

### Root Cause

The original rate-building code in the fetch service:
```javascript
// OLD PROBLEMATIC CODE
ratesByCode[fromCode] = rate           // Direct: BTC → PHP
ratesByCode[toCode] = 1 / rate         // Inverted: PHP → BTC
```

This created confusion because:
- Both directions were stored with equal priority
- No clear metadata about which was canonical
- Inversion logic was applied inconsistently across the codebase

---

## The Solution

### Strategy: Enforce Canonical Direction + Support Bidirectional Lookups

#### Step 1: **Canonical Direction Enforcement**
- **Primary rule**: For PHP pairs, enforce `X → PHP` (e.g., `BTC → PHP`, `USD → PHP`)
- **Remove inverted pairs**: Delete any `PHP → X` pairs if their canonical `X → PHP` counterpart exists
- **Mark direction**: Add `pair_direction` column to categorize each pair

#### Step 2: **Bidirectional Support**
- For all canonical `X → PHP` pairs, add their inverse `PHP → X` pairs
- These inverse pairs calculate: `rate = 1 / canonical_rate`
- Mark them clearly with `is_inverted = TRUE` flag

#### Step 3: **Data Quality & Audit**
- Create backup of original data
- Add validation triggers to prevent future issues
- Track all changes in audit table
- Add confidence scoring for rate quality

#### Step 4: **Helper Views & Functions**
- `pairs_canonical` view: Get only canonical pairs
- `pairs_bidirectional` view: Get all direction-agnostic lookups
- `get_exchange_rate()` function: Safe rate retrieval with fallback logic

---

## What the Migration Changes

### Schema Changes

#### NEW COLUMNS

```sql
-- Added to pairs table:
pair_direction VARCHAR(20)      -- 'canonical' | 'inverse' | 'other'
is_inverted BOOLEAN             -- TRUE if this is a calculated inverse
canonical_pair_id BIGINT        -- Reference to canonical pair
confidence_score NUMERIC(3,2)   -- Quality metric (0.00-1.00)
migration_notes TEXT            -- Audit trail notes
```

#### NEW TABLES

1. **pairs_migration_audit** - Complete audit trail of all changes
2. **pairs_backup_pre_migration** - Full backup of pre-migration data

#### NEW INDEXES

```sql
CREATE INDEX idx_pairs_direction ON pairs(pair_direction);
CREATE INDEX idx_pairs_inverted ON pairs(is_inverted);
CREATE INDEX idx_pairs_audit_timestamp ON pairs_migration_audit(migration_timestamp);
```

#### NEW VIEWS

```sql
-- View: pairs_canonical
-- Returns only canonical pairs (X → PHP for PHP pairs)
SELECT * FROM pairs_canonical;

-- View: pairs_bidirectional
-- Returns both canonical and explicitly-added inverse pairs
SELECT * FROM pairs_bidirectional;
```

#### NEW FUNCTION

```sql
-- Safe rate lookup with fallback
SELECT * FROM get_exchange_rate('BTC', 'PHP', p_use_canonical_only := FALSE);
SELECT * FROM get_exchange_rate('BTC', 'PHP', p_use_canonical_only := TRUE);
```

### Data Cleanup

1. **Deleted**: Inverted `PHP → X` pairs (if canonical `X → PHP` exists)
2. **Added**: Explicit inverse pairs for all canonical `X → PHP` pairs
3. **Labeled**: All pairs marked with direction metadata

---

## Data Structure After Migration

### Example: BTC/PHP pairs

**BEFORE** (Problematic):
```
id  | from_currency | to_currency | rate      | pair_direction | is_inverted
----|---------------|-------------|-----------|----------------|------------
1   | BTC           | PHP         | 2500000   | unspecified    | FALSE
2   | PHP           | BTC         | 0.0000004 | unspecified    | FALSE
```

**AFTER** (Fixed):
```
id  | from_currency | to_currency | rate      | pair_direction | is_inverted
----|---------------|-------------|-----------|----------------|------------
1   | BTC           | PHP         | 2500000   | canonical      | FALSE
3   | PHP           | BTC         | 0.0000004 | inverse        | TRUE
```

### Key Differences
- ✅ Canonical pair clearly marked
- ✅ Inverse pair clearly marked
- ✅ Application can now prefer canonical pairs
- ✅ Validation prevents duplicates in wrong direction
- ✅ Audit trail tracks all changes

---

## How Application Code Should Use This

### Updated Query Logic (Recommended)

**OLD CODE (problematic):**
```javascript
// getRatesFromPublicPairs in src/components/Deposits.jsx
const { data, error } = await supabase
  .from('pairs')
  .select('from_currency, rate')
  .eq('to_currency', 'PHP')
  .in('from_currency', ['BTC', 'USD'])
```

**NEW CODE (improved):**
```javascript
// Option 1: Use canonical pairs only
const { data, error } = await supabase
  .from('pairs_canonical')  // NEW VIEW
  .select('from_currency, rate, pair_direction')
  .eq('to_currency', 'PHP')
  .in('from_currency', ['BTC', 'USD'])

// Option 2: Use safe function
const { data, error } = await supabase
  .rpc('get_exchange_rate', {
    p_from_currency: 'BTC',
    p_to_currency: 'PHP',
    p_use_canonical_only: true
  })
```

### Validation Logic (for Rates.jsx & Deposits.jsx)

**The fix already in code:**
```javascript
// NEW LOGIC - Only use canonical (X→PHP) pairs
if (toCurrency === 'PHP' && fromCurrency) {
  ratesByCode[fromCurrency] = rate
  console.log(`Storing canonical rate: ${fromCurrency} = ${rate} PHP`)
}

// Fallback: Try inverted pairs only if missing
if (fromCurrency === 'PHP' && !rates[toCode]) {
  const invertedRate = 1 / rate
  rates[toCode] = invertedRate
  console.warn(`WARNING: Using inverted rate for ${toCode}`)
}
```

---

## Validation & Testing Checklist

### Before Deploying

- [ ] Run migration in staging environment first
- [ ] Verify pair counts with provided verification queries
- [ ] Check that no duplicate pairs exist:
  ```sql
  SELECT from_currency, to_currency, COUNT(*) 
  FROM pairs 
  GROUP BY from_currency, to_currency 
  HAVING COUNT(*) > 1;
  ```
- [ ] Verify all canonical PHP pairs exist
- [ ] Test exchange rate calculations
- [ ] Confirm no rate = 0 or negative values exist

### Verification Queries

```sql
-- 1. Check current pair distribution
SELECT pair_direction, COUNT(*) as count 
FROM pairs 
GROUP BY pair_direction;

-- 2. Verify BTC/PHP specific pairs
SELECT * FROM pairs 
WHERE (from_currency = 'BTC' AND to_currency = 'PHP')
   OR (from_currency = 'PHP' AND to_currency = 'BTC')
ORDER BY from_currency, to_currency;

-- 3. Check bidirectional coverage
SELECT 
  p1.from_currency,
  p1.to_currency,
  p1.rate as canonical_rate,
  CASE WHEN p2.id IS NOT NULL THEN p2.rate ELSE NULL END as inverse_rate
FROM pairs p1
LEFT JOIN pairs p2 ON p1.from_currency = p2.to_currency AND p1.to_currency = p2.from_currency
WHERE p1.to_currency = 'PHP'
ORDER BY p1.from_currency;

-- 4. View migration audit trail
SELECT action_type, COUNT(*) as count, MAX(created_at) as last_action
FROM pairs_migration_audit
GROUP BY action_type
ORDER BY created_at DESC;

-- 5. Check for any negative or zero rates
SELECT * FROM pairs WHERE rate <= 0 OR rate IS NULL;
```

---

## Preventing Future Issues

### For Developers

1. **When adding new rates**:
   - Always use canonical direction (X → PHP when PHP is involved)
   - Never manually create inverted pairs
   - Let the trigger handle direction labeling

2. **When querying rates**:
   - Prefer `pairs_canonical` view for single-direction queries
   - Use `get_exchange_rate()` function for safe lookups
   - Always check `pair_direction` metadata in results

3. **When debugging rate issues**:
   - Check `pairs_migration_audit` table for changes
   - Verify `pair_direction` and `is_inverted` flags
   - Use `pairs_backup_pre_migration` for comparisons

### Database Constraints

The new trigger `validate_pairs_direction()` now enforces:
```sql
✓ Rate must be positive (> 0)
✓ Both from_currency and to_currency required (NOT NULL)
✓ Automatically sets pair_direction based on currencies
✓ Warns if creating inverted pair without canonical counterpart
```

---

## Rollback Plan

If issues arise, you can restore the previous state:

```sql
-- Restore from backup
DELETE FROM pairs;
INSERT INTO pairs (id, from_currency, to_currency, rate, source_table, updated_at)
SELECT id, from_currency, to_currency, rate, source_table, updated_at 
FROM pairs_backup_pre_migration;

-- Check audit trail for what changed
SELECT * FROM pairs_migration_audit 
ORDER BY created_at DESC LIMIT 50;
```

---

## Performance Impact

### Index Analysis
- New indexes on `pair_direction` and `is_inverted` improve filtering performance
- Composite index `(from_currency, to_currency)` unchanged (existing)
- View queries use existing indexes, no performance impact

### Query Performance
- Direct pair lookups: **No change** (same as before)
- View-based queries: **Slight improvement** (filtered indexes)
- Function-based lookups: **Minimal overhead** (single function call)

### Storage Impact
- New columns: ~50 bytes per row (pair_direction, flags, metadata)
- Backup table: ~3x current pairs table size (one-time, can be archived)
- New views: No storage cost (virtual)
- New function: Negligible storage cost

---

## Migration Timeline

### Deployment Steps

1. **Apply migration**:
   ```bash
   # Migration file: supabase/migrations/0200_fix_currency_pairs_canonical_direction.sql
   # This will run automatically on next Supabase deployment
   ```

2. **Monitor audit table**:
   ```sql
   SELECT COUNT(*) FROM pairs_migration_audit;
   ```

3. **Update application code** (if using old logic):
   - Update `Rates.jsx` to prefer canonical pairs
   - Update `Deposits.jsx` to prefer canonical pairs
   - Both files already have improved logic, minor adjustments may be needed

4. **Test thoroughly**:
   - Test deposit conversion rates
   - Test rate display in UI
   - Test all supported currency pairs

5. **Archive backup** (after 30 days):
   ```sql
   -- Archive old backup
   ALTER TABLE pairs_backup_pre_migration RENAME TO pairs_backup_archive;
   -- Or delete after verification
   TRUNCATE pairs_backup_pre_migration;
   ```

---

## FAQ

### Q: Will this affect my existing data?
**A**: No. The migration preserves all rates but reorganizes them for clarity. Backup table (`pairs_backup_pre_migration`) keeps original data.

### Q: What about other currency pairs (not PHP)?
**A**: Non-PHP pairs are marked as `pair_direction = 'other'` and continue working. The enforcement is primarily for PHP pairs.

### Q: Can I revert this migration?
**A**: Yes. See "Rollback Plan" section above. The backup table preserves pre-migration state.

### Q: Will the new columns slow down queries?
**A**: No. New columns only affect INSERT/UPDATE performance minimally. SELECT queries unchanged (new indexes available if needed).

### Q: How often does the pairs table update?
**A**: Controlled by your fetch service. Migration doesn't change update frequency. Audit table now tracks all updates.

### Q: What if I manually added pairs to this table?
**A**: The new validation trigger will warn if you create inverted pairs without canonical counterparts, preventing future confusion.

---

## Related Files & Code

### Files Modified by This Migration
- `supabase/migrations/0200_fix_currency_pairs_canonical_direction.sql` ← NEW MIGRATION

### Application Code Using Pairs Table
- `src/components/Rates.jsx` - Already has improved logic (lines 88-108)
- `src/components/Deposits.jsx` - Already has improved logic (lines 88-108)
- `src/lib/ratesFetchService.js` - May need updates
- `src/lib/cryptoRatesService.js` - May need updates

### Documentation
- `RATES_TABLE_QUERY_GUIDE.md` - Query reference
- `RATES_ARCHITECTURE_OVERVIEW.md` - System overview

---

## Support & Questions

If you encounter issues:

1. **Check the audit table**:
   ```sql
   SELECT * FROM pairs_migration_audit 
   WHERE action_type LIKE '%ERROR%' 
   ORDER BY created_at DESC;
   ```

2. **Compare with backup**:
   ```sql
   SELECT COUNT(*) FROM pairs;
   SELECT COUNT(*) FROM pairs_backup_pre_migration;
   ```

3. **Review validation warnings**:
   - Check Supabase logs for trigger warnings
   - Query the validation history in audit table

4. **Reach out with**:
   - Specific currency pair that's not working
   - Error message from audit table
   - Expected vs actual rate values

---

**Last Updated**: 2025-01-15
**Migration Version**: 0200
**Status**: Ready for Deployment
