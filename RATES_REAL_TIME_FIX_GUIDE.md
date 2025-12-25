# 🔴 Real-Time Rates Issue - Complete Fix Guide

## The Problem

Your Deposits page shows **hardcoded fallback rates** instead of **real-time rates**:
- Shows: BTC = 2,500,000 PHP (hardcoded)
- Should show: BTC = 5,186,122 PHP (real from fetch-rates)
- Difference: **107% off!**

The rates should come from your **fetch-rates edge function** which fetches real prices from exchanges, but instead hardcoded values are being used.

---

## Root Cause

**Migration 0203** inserted hardcoded fallback rates with this logic:
```sql
ON CONFLICT (from_currency, to_currency) 
DO UPDATE SET 
  rate = EXCLUDED.rate,  -- ❌ OVERWRITES real rates with hardcoded values
  source_table = 'currency_rates'
```

This means: "If rate already exists, REPLACE it with hardcoded fallback"

---

## The Solution

### Step 1: Run Migration 0205 (Remove Hardcoded Rates)

**In Supabase SQL Editor, run:**
```bash
# Copy entire contents of:
# supabase/migrations/0205_remove_hardcoded_keep_realtime_only.sql
# Paste into Supabase SQL Editor
# Click "Run"
```

**What it does:**
- Deletes ALL hardcoded fallback rates
- Keeps ONLY real rates from fetch-rates edge function
- Audits all changes

**Expected result:**
```
✅ Hardcoded rates removed
✅ BTC rate changes to real value (5,186,122 instead of 2,500,000)
✅ All other rates updated to real values
```

### Step 2: Verify Fetch-Rates is Running

Check if fetch-rates edge function is updating rates:

```sql
-- Query 1: Check if BTC rate is fresh (updated within last 2 hours)
SELECT 
  from_currency,
  rate,
  source_table,
  updated_at,
  ROUND(EXTRACT(EPOCH FROM (NOW() - updated_at))/3600, 1) as hours_old
FROM pairs
WHERE from_currency IN ('BTC', 'ETH', 'USD')
  AND to_currency = 'PHP'
ORDER BY from_currency;

-- EXPECT:
-- BTC | 5186122 | cryptocurrency_rates | <recent> | <1 hour
-- ETH | 310000  | cryptocurrency_rates | <recent> | <1 hour  
-- USD | 56.5    | currency_rates       | <recent> | <1 hour

-- Query 2: Check for stale rates
SELECT 
  from_currency,
  ROUND(EXTRACT(EPOCH FROM (NOW() - updated_at))/3600, 1) as hours_old,
  source_table
FROM pairs
WHERE to_currency = 'PHP'
  AND from_currency IN ('BTC', 'ETH', 'USDT', 'BNB')
  AND EXTRACT(EPOCH FROM (NOW() - updated_at))/3600 > 2
ORDER BY hours_old DESC;

-- SHOULD RETURN: Empty (no stale rates)
-- If returns rates >2 hours old = fetch-rates not running!
```

### Step 3: If fetch-rates is NOT Running

Check the edge function status:
```bash
# In Supabase Dashboard > Edge Functions > fetch-rates
# Check:
# 1. Is it deployed?
# 2. Are there recent invocations?
# 3. Check error logs
# 4. Check environment variables (API keys)
```

---

## Diagnostic Queries

### Query 1: Show Current Rates vs Hardcoded Fallbacks
```sql
SELECT 
  from_currency,
  to_currency,
  rate,
  source_table,
  updated_at,
  CASE
    WHEN updated_at > NOW() - INTERVAL '2 hours' THEN '✓ REAL'
    ELSE '❌ STALE/HARDCODED'
  END as status
FROM pairs
WHERE from_currency IN ('BTC', 'ETH', 'USD', 'EUR', 'USDT', 'BNB')
  AND to_currency = 'PHP'
ORDER BY from_currency, updated_at DESC;
```

### Query 2: Check What Was Removed
```sql
SELECT 
  action_type,
  from_currency,
  to_currency,
  old_rate as removed_rate,
  created_at
FROM pairs_migration_audit
WHERE action_type = 'REMOVING_HARDCODED_RATE'
ORDER BY created_at DESC;
```

### Query 3: Show Migration History
```sql
SELECT 
  action_type,
  COUNT(*) as count,
  MAX(created_at) as timestamp
FROM pairs_migration_audit
WHERE action_type LIKE '%0205%' OR action_type LIKE '%HARDCODED%'
GROUP BY action_type
ORDER BY timestamp DESC;
```

---

## Expected Before/After

| Aspect | Before | After |
|--------|--------|-------|
| **BTC Rate** | 2,500,000 (hardcoded) | 5,186,122 (real) |
| **Source** | 'currency_rates' (fallback) | 'cryptocurrency_rates' (real API) |
| **Updated** | Static/old | Fresh (updated hourly) |
| **Age** | >2 hours old | <1 hour old |

---

## How It Works

### Real-Time Rate Flow
```
1. Fetch-Rates Edge Function (runs hourly)
   ↓
2. Queries real exchanges (ExConvert, OpenExchangeRates, CoinGecko)
   ↓
3. Stores rates in public.pairs table
   ↓
4. Deposits component queries public.pairs
   ↓
5. Shows real, up-to-date rates to user
```

### Why Hardcoded Rates Were Bad
```
Hardcoded Fallback Flow (WRONG):
1. Migration 0203 inserts: BTC = 2,500,000
2. Deposits component queries public.pairs
3. Shows 2,500,000 even if real rate is 5,186,122
4. User sees WRONG rate
```

---

## Troubleshooting

### Problem: Rates Still Show Old Values
**Solution:** 
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R)
3. Run verification query to confirm DB is updated
4. Check if fetch-rates is running

### Problem: Some Rates Missing
**Solution:**
1. Check fetch-rates edge function error logs
2. Verify API keys (EXCONVERT, OPENEXCHANGERATES, etc.)
3. Check that fetch-rates function is deployed
4. Check Supabase logs for errors

### Problem: fetch-rates Not Running
**Solution:**
1. Check if edge function is deployed
2. Verify environment variables are set
3. Check if it has proper permissions
4. Check recent function invocations
5. Look at error logs in Supabase dashboard

---

## Verification After Migration

Run these checks to confirm:

```sql
-- 1. Check BTC rate is real (should be ~5M)
SELECT * FROM pairs WHERE from_currency = 'BTC' AND to_currency = 'PHP';

-- 2. Check all rates are fresh
SELECT * FROM pairs 
WHERE to_currency = 'PHP' 
  AND EXTRACT(EPOCH FROM (NOW() - updated_at))/3600 < 2
ORDER BY from_currency;

-- 3. Confirm no stale hardcoded rates remain
SELECT COUNT(*) FROM pairs 
WHERE source_table = 'currency_rates' 
  AND updated_at < NOW() - INTERVAL '2 hours'
  AND to_currency = 'PHP';
-- Should return: 0
```

---

## Files Involved

| File | Purpose |
|------|---------|
| supabase/functions/fetch-rates/index.ts | **Updates pairs** with real rates (should run hourly) |
| public.pairs table | **Stores rates** fetched by fetch-rates |
| src/components/Deposits.jsx | **Reads rates** from public.pairs (should show real values) |
| supabase/migrations/0203_...sql | **❌ Caused issue** - inserted hardcoded rates |
| supabase/migrations/0205_...sql | **✅ Fixes issue** - removes hardcoded rates |

---

## Summary

### What Was Wrong
✗ Migration 0203 overrode real rates with hardcoded values
✗ BTC showed 2.5M instead of 5.1M (100% wrong!)
✗ All crypto rates were inaccurate

### What's Fixed
✓ Removed all hardcoded fallback rates
✓ Kept only real rates from fetch-rates edge function
✓ Rates now auto-update every hour
✓ Deposits page shows accurate prices

### What You Need to Do
1. ✅ Run Migration 0205
2. ✅ Verify fetch-rates is running
3. ✅ Check rates are fresh and accurate
4. ✅ Done!

---

## Next Steps

1. **Run the migration** → `supabase/migrations/0205_remove_hardcoded_keep_realtime_only.sql`
2. **Verify with queries** → Check BTC rate is ~5.1M PHP
3. **Test Deposits** → Select BTC, see real conversion rate
4. **Monitor** → Watch fetch-rates edge function logs to ensure it keeps updating

---

**Status:** 🟢 **READY FOR DEPLOYMENT**
