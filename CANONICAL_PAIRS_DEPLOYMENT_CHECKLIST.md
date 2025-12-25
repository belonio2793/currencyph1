# Canonical Pairs Implementation - Deployment Checklist

## Pre-Deployment ✅

- [x] Database migration created: `supabase/migrations/0200_fix_currency_pairs_canonical_direction.sql`
- [x] Migration tested in staging environment
- [x] Backup tables created: `pairs_backup_pre_migration`
- [x] Audit table created: `pairs_migration_audit`
- [x] New views created: `pairs_canonical`, `pairs_bidirectional`
- [x] New function created: `get_exchange_rate()`
- [x] Validation trigger created: `validate_pairs_direction()`

## Application Code Changes ✅

- [x] `src/lib/pairsRateService.js` - Updated getPairRate() with 3-level strategy
- [x] `src/lib/pairsRateService.js` - Updated getPairRateWithMetadata() with direction tracking
- [x] `src/lib/pairsRateService.js` - Updated getPairsByCurrency() to use canonical view
- [x] `src/components/Deposits.jsx` - Updated getRatesFromPublicPairs() with 3-tier fallback
- [x] `src/lib/currencyAPI.js` - Updated getGlobalRates() to prefer pairs_canonical
- [x] `src/lib/currencyAPI.js` - Updated getCryptoPrices() to use canonical view
- [x] `src/components/Rates.jsx` - Added pair_direction metadata tracking
- [x] `src/lib/cryptoRatesService.js` - Updated getCachedRateFromDatabase() with canonical preference

## Deployment Steps

### Step 1: Deploy Database Migration
```bash
# The migration was already run via SQL:
# supabase/migrations/0200_fix_currency_pairs_canonical_direction.sql

# Verify in Supabase:
# - Dashboard → SQL Editor → History
# - Should show successful execution
```

**Status**: ⏳ Complete - Migration already executed

### Step 2: Deploy Application Code
```bash
# All code changes are in place:
git status
# Should show:
# - src/lib/pairsRateService.js (modified)
# - src/components/Deposits.jsx (modified)
# - src/lib/currencyAPI.js (modified)
# - src/components/Rates.jsx (modified)
# - src/lib/cryptoRatesService.js (modified)

# Commit and push
git add .
git commit -m "chore: integrate canonical pairs database structure"
git push origin main
```

**Status**: ⏳ Ready to deploy

### Step 3: Verify in Staging
- [ ] Pull latest code
- [ ] Run application: `npm run dev`
- [ ] Open browser: `http://localhost:5173`
- [ ] Navigate to `/rates`
- [ ] Open DevTools (F12) → Console tab
- [ ] Look for: `✅ Using exchange rates from pairs_canonical view`
- [ ] Navigate to `/deposits`
- [ ] Select crypto deposit method
- [ ] Check console for: `[Deposits] ✓ Canonical`
- [ ] Verify conversion rate displays correctly

### Step 4: Database Validation Queries
```sql
-- Run in Supabase SQL Editor:

-- 1. Verify canonical pairs count
SELECT COUNT(*) as canonical_count FROM pairs WHERE pair_direction = 'canonical';
-- Expected: 50-100+

-- 2. Verify inverse pairs count  
SELECT COUNT(*) as inverse_count FROM pairs WHERE pair_direction = 'inverse';
-- Expected: 50-100+

-- 3. Check for duplicates (should be empty)
SELECT from_currency, to_currency, COUNT(*) as count
FROM pairs
GROUP BY from_currency, to_currency
HAVING COUNT(*) > 1;
-- Expected: No rows

-- 4. Check migration audit
SELECT action_type, COUNT(*) as count
FROM pairs_migration_audit
GROUP BY action_type
ORDER BY action_type;
-- Expected: Migration completed successfully

-- 5. Verify key pairs exist
SELECT * FROM pairs_canonical 
WHERE from_currency IN ('BTC', 'USD', 'EUR')
AND to_currency = 'PHP'
ORDER BY from_currency;
-- Expected: All three pairs present
```

### Step 5: Application Functional Tests

#### Test 1: Rates Page
- [ ] Navigate to `http://localhost:5173/rates`
- [ ] Page loads without errors
- [ ] Console shows: `✅ Using exchange rates from pairs_canonical view`
- [ ] All currency rates display
- [ ] BTC rate is in millions (e.g., 2,500,000 PHP)
- [ ] Conversion calculator works (e.g., "1 BTC to PHP")
- [ ] Favorites feature works
- [ ] Search/filter functions work

#### Test 2: Deposits Page
- [ ] Navigate to `http://localhost:5173/deposits`
- [ ] Page loads without errors
- [ ] Console shows: `[Deposits] ✓ Canonical` for BTC, ETH, etc.
- [ ] Select crypto deposit (BTC)
- [ ] Rate displays correctly (millions of PHP)
- [ ] Amount conversion works
- [ ] Select fiat deposit (GCash)
- [ ] Page doesn't error

#### Test 3: Other Rate-Dependent Pages
- [ ] SendMoney page - rates display correctly
- [ ] ReceiveMoney page - rates display correctly
- [ ] HomePage - currency conversion works
- [ ] Wallet Display Customizer - rates display

#### Test 4: Console Logging
- [ ] Open DevTools → Console
- [ ] No red error messages
- [ ] Should see success messages like:
  - `✅ Using exchange rates from pairs_canonical view`
  - `[Deposits] ✓ Canonical: BTC → PHP = 2500000`
- [ ] Should NOT see:
  - `✗ Could not fetch price for BTC/PHP`
  - Multiple ERROR messages about missing rates

### Step 6: Performance Tests
```javascript
// In browser console, measure query performance:
const start = performance.now();
// Perform rate-dependent action
const end = performance.now();
console.log(`Operation took ${end - start}ms`);
// Expected: < 500ms for rate operations
```

### Step 7: Deploy to Production

**Before Deploying**:
- [ ] All staging tests pass
- [ ] No console errors on any page
- [ ] Database validation queries successful
- [ ] Peer review completed
- [ ] Rollback plan documented (included in CURRENCY_PAIRS_FIX_DEPLOYMENT.md)

**Deployment**:
```bash
# Create release branch
git checkout -b release/canonical-pairs-v1

# Tag version
git tag -a v1.0.0 -m "Implement canonical pairs database structure"

# Push to production (your deployment process)
# Most common: merge to main/master, CI/CD handles the rest
```

**Status**: ⏳ Awaiting approval

### Step 8: Post-Deployment Monitoring (24 hours)

#### Monitor These Metrics:
- [ ] Error rate in error tracking (should not increase)
- [ ] Database query performance (should maintain or improve)
- [ ] Application response times (should maintain or improve)
- [ ] User conversion success rates
- [ ] No reports of incorrect exchange rates

#### Monitor These Logs:
```sql
-- Check for conversion errors
SELECT action_type, COUNT(*) 
FROM pairs_migration_audit
WHERE action_type LIKE '%ERROR%'
GROUP BY action_type;
-- Expected: 0 errors

-- Check recent data
SELECT * FROM pairs_migration_audit
ORDER BY created_at DESC
LIMIT 20;
-- Should show normal operation

-- Verify rates are being updated
SELECT from_currency, to_currency, updated_at
FROM pairs_canonical
WHERE to_currency = 'PHP'
ORDER BY updated_at DESC
LIMIT 10;
-- All should be recent (< 24 hours old)
```

#### Error Handling:
- [ ] If errors appear, check `pairs_migration_audit` table
- [ ] If rates are old, trigger fetch service
- [ ] If conversion fails, check transaction logs
- [ ] Contact support link: See CURRENCY_PAIRS_FIX_DEPLOYMENT.md

### Step 9: Documentation Update
- [ ] Update deployment notes with actual dates/times
- [ ] Document any issues encountered and resolutions
- [ ] Update team communication with "Deployed Successfully"
- [ ] Archive this checklist with completion date

### Step 10: Cleanup (After 30 Days)
```sql
-- Archive backup table
ALTER TABLE pairs_backup_pre_migration RENAME TO pairs_backup_archive;

-- Optional: Delete audit logs older than 30 days
DELETE FROM pairs_migration_audit 
WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';

-- Keep recent audit for reference
SELECT COUNT(*) FROM pairs_migration_audit;
```

---

## Rollback Plan (If Needed)

### Immediate Rollback (< 5 minutes)
```sql
-- This will revert database to pre-migration state
DELETE FROM pairs;
INSERT INTO pairs (id, from_currency, to_currency, rate, source_table, updated_at)
SELECT id, from_currency, to_currency, rate, source_table, updated_at 
FROM pairs_backup_pre_migration;

-- Application will continue working (no breaking changes)
-- Just restart if needed
```

### Application Rollback
```bash
# If application code has issues
git revert <commit-hash-of-canonical-pairs-changes>
git push origin main
# CI/CD will redeploy previous version
```

**Note**: No breaking changes in application code, so rollback not expected to be necessary.

---

## Sign-Off

### Development Team
- [ ] Code reviewed and approved
- [ ] All tests passing
- [ ] Ready for staging deployment

**Date**: ____________  
**Signed**: ____________

### QA Team
- [ ] Staging tests completed
- [ ] Performance acceptable
- [ ] No regression found
- [ ] Approved for production

**Date**: ____________  
**Signed**: ____________

### DevOps/Database
- [ ] Database migration successful
- [ ] Backup verified
- [ ] Monitoring set up
- [ ] Rollback plan tested

**Date**: ____________  
**Signed**: ____________

### Product/Stakeholder
- [ ] Business requirements met
- [ ] No negative impact on users
- [ ] Ready for production release

**Date**: ____________  
**Signed**: ____________

---

## Key Contacts

**Database Issues**: [Your DBA contact]  
**Application Issues**: [Your Backend contact]  
**Release Manager**: [Release manager contact]  
**On-Call Support**: [Support contact]

---

## Documentation Links

- Complete Guide: `CURRENCY_PAIRS_FIX_GUIDE.md`
- Deployment Guide: `CURRENCY_PAIRS_FIX_DEPLOYMENT.md`
- Quick Reference: `CURRENCY_PAIRS_FIX_QUICK_REFERENCE.md`
- SQL Queries: `CURRENCY_PAIRS_SQL_REFERENCE.md`
- Implementation Details: `CANONICAL_PAIRS_IMPLEMENTATION.md`
- This Checklist: `CANONICAL_PAIRS_DEPLOYMENT_CHECKLIST.md`

---

**Status**: ✅ Ready for Deployment  
**Last Updated**: 2025-01-15  
**Version**: 1.0
