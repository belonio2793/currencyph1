# Fix the Broken Migration Error

## The Problem

The migration `0111_expand_currency_code_varchar_limits.sql` tried to alter a "currency" column on the deposits table that **doesn't exist**.

Your deposits table uses `currency_code VARCHAR(16)` - not a simple `currency` column.

```
ERROR: 42703: column "currency" of relation "deposits" does not exist
```

---

## The Solution

### Step 1: Delete the Broken Migration ❌

**Delete this file:**
```
supabase/migrations/0111_expand_currency_code_varchar_limits.sql
```

This is the broken one.

---

### Step 2: Use the Corrected Migration ✅

**Use this file instead:**
```
supabase/migrations/0111_expand_currency_varchar_SAFE.sql
```

This migration:
- ✓ Checks for column existence before altering
- ✓ Only alters tables that actually have "currency" VARCHAR(3)
- ✓ **Skips deposits table** (already uses currency_code VARCHAR(16))
- ✓ Safe to run multiple times

---

### Step 3: Apply the Corrected Migration

Go to **Supabase Dashboard** → **SQL Editor**:

1. Click **"New Query"**
2. Copy entire contents of:
   ```
   supabase/migrations/0111_expand_currency_varchar_SAFE.sql
   ```
3. Paste and click **Run** ▶️

**Expected:** Green checkmark ✓ (no errors)

---

## Why the First One Failed

| Issue | Details |
|-------|---------|
| **Assumed column existed** | Tried to ALTER a "currency" column on deposits |
| **Wrong table schema** | Deposits uses `currency_code` not `currency` |
| **No existence check** | Didn't verify column existed before altering |
| **Result** | Error: "column currency does not exist" |

---

## What's Fixed

The corrected migration:

✅ Checks `information_schema.columns` to see if column exists  
✅ Only alters tables that actually have the column  
✅ Uses safe `DO $$` blocks with `IF EXISTS`  
✅ Explicitly documents that deposits is NOT affected  
✅ Includes fallback logic if columns don't exist  

---

## About Your Deposits Table

Your deposits table structure:

```sql
CREATE TABLE deposits (
  id UUID,
  user_id UUID,
  wallet_id UUID,
  amount NUMERIC(36, 8),
  currency_code VARCHAR(16),  -- ← This is what deposits uses!
  deposit_method TEXT,
  status TEXT,
  -- ... many more columns for conversions, auditing, etc.
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  -- ... and 30+ additional columns
);
```

**Key:** It has `currency_code VARCHAR(16)`, not `currency VARCHAR(3)` ✓

So deposits table does NOT need any migration changes.

---

## Summary of Files

| File | Status | Action |
|------|--------|--------|
| `0110_fix_wallet_types_crypto.sql` | ✅ KEEP | Already applied |
| `0111_expand_currency_code_varchar_limits.sql` | ❌ DELETE | Broken - has error |
| `0111_expand_currency_varchar_SAFE.sql` | ✅ USE | Safe corrected version |

---

## Next Steps

1. **Delete** the broken migration file
2. **Apply** the corrected migration
3. **Run verification script:**
   ```bash
   node scripts/verify-wallet-types.js
   ```
4. **Test** AVAX wallet creation

---

## Questions?

- **Why does deposits have so many columns?** It tracks conversions, audit trails, transaction details, verification methods, etc.
- **Should I manually fix the column?** No - the safe migration handles it automatically
- **Will this affect my data?** No - just expands the column size, no data changes

---

**You're good to proceed!** Just delete the old migration and apply the safe one. 🚀
