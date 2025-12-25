# Currency Pairs Fix - Quick Reference

## Problem in 30 Seconds

❌ **WRONG**: Database had both `BTC→PHP` (2,500,000) AND `PHP→BTC` (0.0000004)  
✅ **RIGHT**: Keep canonical `BTC→PHP` and mark inverse pairs explicitly

## Solution in 30 Seconds

1. Migration removes inverted duplicates
2. Adds explicit inverse pairs with metadata
3. Adds validation to prevent future issues
4. App code already updated to prefer canonical direction

---

## Before & After: Database State

### Data Example - Bitcoin/PHP

**BEFORE** (Confusing):
```
Pair 1: BTC → PHP = 2,500,000 ✓ (correct)
Pair 2: PHP → BTC = 0.0000004 ✗ (confusing duplicate)
```

**AFTER** (Clear):
```
Pair 1: BTC → PHP = 2,500,000      pair_direction='canonical', is_inverted=FALSE ✓
Pair 2: PHP → BTC = 0.0000004       pair_direction='inverse',   is_inverted=TRUE ✓
```

---

## New Database Tools

### 1. View: `pairs_canonical` (Recommended for UI)
Get ONLY canonical pairs (X→PHP format):
```sql
SELECT from_currency, to_currency, rate
FROM pairs_canonical
WHERE to_currency = 'PHP'
LIMIT 10;
```

### 2. View: `pairs_bidirectional` (For flexible queries)
Get all pairs with direction metadata:
```sql
SELECT from_currency, to_currency, rate, pair_direction, is_inverted
FROM pairs_bidirectional
WHERE from_currency IN ('BTC', 'USD')
LIMIT 10;
```

### 3. Function: `get_exchange_rate()` (Safe lookups)
```sql
-- Get rate with fallback logic
SELECT rate, pair_id, source_table
FROM get_exchange_rate('BTC', 'PHP', true);  -- true = canonical only
```

---

## Code Updates Needed

### ✅ Already Fixed in Code

**src/components/Deposits.jsx** and **src/components/Rates.jsx** (lines 88-108):
```javascript
// ✓ ALREADY CORRECT - Prefers canonical direction
if (toCurrency === 'PHP' && fromCurrency) {
  ratesByCode[fromCurrency] = rate
  console.log(`Storing canonical rate: ${fromCurrency} = ${rate} PHP`)
}
```

### ⚠️ Optional Improvements

**Replace direct queries** with safer lookups:

**OLD**:
```javascript
const { data } = await supabase
  .from('pairs')
  .select('rate')
  .eq('from_currency', 'BTC')
  .eq('to_currency', 'PHP')
```

**NEW** (using view):
```javascript
const { data } = await supabase
  .from('pairs_canonical')
  .select('rate')
  .eq('from_currency', 'BTC')
  .eq('to_currency', 'PHP')
```

**OR** (using function):
```javascript
const { data } = await supabase
  .rpc('get_exchange_rate', {
    p_from_currency: 'BTC',
    p_to_currency: 'PHP',
    p_use_canonical_only: true
  })
```

---

## Verification Queries (Copy & Paste)

### Check Current State
```sql
-- Count pairs by direction
SELECT pair_direction, COUNT(*) 
FROM pairs 
GROUP BY pair_direction;

-- Should show: canonical | inverse | other
```

### Verify Specific Pairs
```sql
-- Check BTC/PHP pairs
SELECT * FROM pairs 
WHERE (from_currency IN ('BTC', 'PHP') AND to_currency IN ('BTC', 'PHP'))
ORDER BY from_currency;
```

### Check No Duplicates
```sql
-- Should return empty result
SELECT from_currency, to_currency, COUNT(*) as count
FROM pairs
GROUP BY from_currency, to_currency
HAVING COUNT(*) > 1;
```

### View Migration History
```sql
SELECT action_type, COUNT(*) as count
FROM pairs_migration_audit
GROUP BY action_type
ORDER BY created_at DESC;
```

---

## Rollback (If Needed)

```sql
-- Restore pre-migration state
DELETE FROM pairs;
INSERT INTO pairs (id, from_currency, to_currency, rate, source_table, updated_at)
SELECT id, from_currency, to_currency, rate, source_table, updated_at 
FROM pairs_backup_pre_migration;
```

---

## Key Concepts

| Concept | Meaning | Example |
|---------|---------|---------|
| **Canonical Pair** | Primary direction for PHP pairs | BTC → PHP = 2,500,000 |
| **Inverse Pair** | Calculated reverse of canonical | PHP → BTC = 0.0000004 |
| **pair_direction** | Column: 'canonical' \| 'inverse' \| 'other' | canonical |
| **is_inverted** | Flag: TRUE if calculated from canonical | TRUE |

---

## Common Issues & Solutions

### Issue: Rate not found
**Check**:
```sql
SELECT * FROM pairs WHERE from_currency = 'BTC' AND to_currency = 'PHP';
-- If empty, pair may need to be added
```

### Issue: Incorrect rate displayed
**Check**:
```sql
SELECT pair_direction, rate FROM pairs 
WHERE from_currency = 'BTC' AND to_currency = 'PHP';
-- Verify pair_direction = 'canonical'
```

### Issue: Inverted pair exists without canonical
**Check**:
```sql
SELECT * FROM pairs WHERE pair_direction = 'inverse';
-- Each should have corresponding canonical pair
```

---

## Migration Checklist

- [x] Migration file created: `0200_fix_currency_pairs_canonical_direction.sql`
- [x] Backup table created: `pairs_backup_pre_migration`
- [x] Audit table created: `pairs_migration_audit`
- [x] New columns added: `pair_direction`, `is_inverted`, etc.
- [x] Validation trigger added
- [x] New views created: `pairs_canonical`, `pairs_bidirectional`
- [x] Helper function added: `get_exchange_rate()`
- [ ] Deploy migration to staging
- [ ] Run verification queries
- [ ] Test in application
- [ ] Deploy to production
- [ ] Monitor for 24 hours
- [ ] Archive backup (optional, after 30 days)

---

## Files Reference

| File | Purpose | Status |
|------|---------|--------|
| `supabase/migrations/0200_fix_currency_pairs_canonical_direction.sql` | Main migration | ✅ Created |
| `CURRENCY_PAIRS_FIX_GUIDE.md` | Full documentation | ✅ Created |
| `CURRENCY_PAIRS_FIX_QUICK_REFERENCE.md` | This file | ✅ You're here |
| `src/components/Rates.jsx` | Uses canonical logic | ✅ Already updated |
| `src/components/Deposits.jsx` | Uses canonical logic | ✅ Already updated |

---

## Next Steps

1. **Review** the full guide: `CURRENCY_PAIRS_FIX_GUIDE.md`
2. **Deploy** the migration file
3. **Run** verification queries above
4. **Test** deposit conversion rates
5. **Monitor** the audit table
6. **Optional**: Update application code to use new views/functions

---

**TL;DR**: Migration is ready. Deploy it. Application code already handles canonical direction. Test and monitor. Done! ✅
