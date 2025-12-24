# ⚡ Final Quick Start - AVAX Wallet Fix

## Current Status
- ✅ Migration 0110 (wallet types) - APPLIED ✓
- ❌ Migration 0111 (broken) - DELETED ✓
- ⬜ Migration 0111 SAFE (corrected) - READY TO APPLY

---

## Apply the Fixed Migrations (3 minutes)

### Migration 1: Fix Wallet Types ✓ (Already Applied)

Status: **Already done** - you've applied migration 0110

---

### Migration 2: Fix VARCHAR Limits (Corrected Version)

**File:** `supabase/migrations/0111_expand_currency_varchar_SAFE.sql`

#### Steps:

1. **Open Supabase Dashboard**
   - Go to your project
   - Click **SQL Editor**

2. **Create Query**
   - Click **"New Query"**

3. **Copy Migration**
   - Open `supabase/migrations/0111_expand_currency_varchar_SAFE.sql`
   - Copy ALL contents

4. **Paste & Run**
   - Paste into Supabase
   - Click **Run** ▶️
   - Wait for ✓ (green checkmark)

**Expected Output:**
```
Query executed successfully

-- No errors, all safe checks passed
```

---

## Verify & Test (2 minutes)

### Test 1: Run Verification Script

```bash
node scripts/verify-wallet-types.js
```

**Expected:**
```
✅ All checks passed! Wallet types appear to be correct.
```

---

### Test 2: Create AVAX Wallet

1. Go to **Wallet** page
2. Click **"Add More Currencies"**
3. Search for **AVAX**
4. Click **Add**
5. ✓ Should create successfully!

---

### Test 3: Create BNB Wallet

1. Click **"Add More Currencies"**
2. Search for **BNB**
3. Click **Add**
4. ✓ Should appear under "Cryptocurrency"!

---

## That's It! 🎉

Both migrations are now applied and working correctly.

---

## What Was Fixed

| Issue | Fix | Status |
|-------|-----|--------|
| BNB appears as Fiat | Migration 0110 | ✅ Done |
| AVAX fails to create | Migration 0111 SAFE | ⬜ Apply Now |
| Wrong table assumptions | Corrected migration | ✅ Safe |

---

## Quick Reference

**If something goes wrong:**

1. Check Supabase migration status (Migrations tab)
2. Run verification script: `node scripts/verify-wallet-types.js`
3. Check if AVAX has type='crypto': 
   ```sql
   SELECT code, type FROM currencies WHERE code = 'AVAX';
   ```

---

**Ready? Apply migration 0111_expand_currency_varchar_SAFE.sql now!**

The corrected migration uses safe conditional checks and won't error on your actual schema.
