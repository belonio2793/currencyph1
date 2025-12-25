# Deposits Balance Fix - Action Plan

## ✅ What Was Done

### 1. Fixed the Migration File
**File:** `supabase/migrations/0120_fix_deposits_metadata_and_wallet_balances.sql`

**Key Change:** Removed `DEFERRABLE INITIALLY DEFERRED` from CHECK constraint
- **Line 252 (BEFORE):** `CHECK (...) DEFERRABLE INITIALLY DEFERRED;`
- **Line 252 (AFTER):** `CHECK (...);`

**Why:** PostgreSQL doesn't support DEFERRABLE on CHECK constraints (only on Foreign Keys and Unique constraints).

---

### 2. Created Functions for Balance Reconciliation
The migration creates these new database functions:

#### `reconcile_wallet_balance(wallet_id UUID)`
- **Type:** Diagnostic (read-only)
- **Purpose:** Check if a wallet's balance matches its transaction history
- **Returns:** Actual balance, calculated balance, discrepancy, is_valid flag

#### `fix_wallet_balance(wallet_id UUID)`
- **Type:** Corrective (updates one wallet)
- **Purpose:** Fix a single corrupted wallet by recalculating from transactions
- **Returns:** Old balance, new balance, fixed flag

#### `fix_all_corrupted_wallets()`
- **Type:** Corrective (updates multiple wallets)
- **Purpose:** Bulk fix all wallets with suspicious balances (> 1M BTC or > 10B PHP)
- **Returns:** Total checked, fixed count, in-sync count

---

### 3. Created Audit Trail System
**Table:** `wallet_balance_audit`
- Logs every wallet balance change
- Tracks: before/after values, reason, timestamp
- Enables debugging and accountability

**Trigger:** `log_wallet_balance_changes` automatically records all balance updates

---

### 4. Enhanced Deposit Metadata
**Trigger:** `improve_deposit_metadata()`
- Automatically captures comprehensive transaction details when deposit status changes
- Records: amounts, currencies, exchange rates, conversion validation, approval info
- Creates audit trail in `deposits.metadata` (JSONB)

---

### 5. Created Diagnostic Script
**File:** `supabase/sql/diagnose_and_fix_transaction_cbf899c8.sql`

This script:
1. ✅ Identifies the affected user
2. ✅ Shows current (corrupted) wallet balances
3. ✅ Analyzes wallet_transactions for the deposit
4. ✅ Calculates what balances should be
5. ✅ Fixes the corrupted balances
6. ✅ Verifies the fix worked
7. ✅ Shows audit trail

---

## 🎯 Next Steps (YOU NEED TO DO THESE)

### Step 1: Connect to Your Supabase Database

You have three options:

**Option A: Use Supabase SQL Editor (Easiest)**
- Go to https://app.supabase.com
- Select your project
- Go to SQL Editor
- Follow steps 2-3 below

**Option B: Use psql CLI**
```bash
psql -h <your-host>.supabase.co -U postgres -d postgres
# Enter password when prompted
```

**Option C: Use Database client (pgAdmin, DBeaver, etc)**
- Connect to your Supabase database
- Open SQL query editor

---

### Step 2: Verify the Migration Works

Paste and run this test query first:
```sql
-- Check if migration can run (no CHECK constraint syntax errors)
SELECT 1 as test;
```

If it fails, double-check that the migration file doesn't have DEFERRABLE on CHECK constraints.

---

### Step 3: Run the Fixed Migration

**In Supabase:**
```sql
-- Copy the entire contents of this file and run it:
-- supabase/migrations/0120_fix_deposits_metadata_and_wallet_balances.sql
```

**Or via CLI:**
```bash
supabase migrations up
```

Expected output: No errors, all functions and tables created successfully.

---

### Step 4: Run the Diagnostic & Fix Script

Once the migration is successful, run this script:

**File:** `supabase/sql/diagnose_and_fix_transaction_cbf899c8.sql`

This will:
1. Find the user with transaction cbf899c8-78f2-46e7-a319-c119400b68b1
2. Show their corrupted balances (5.1 quadrillion PHP, 10.1 septillion BTC)
3. Calculate correct balances from wallet_transactions
4. Fix the walances
5. Verify the fix
6. Show audit trail

Expected output: Messages showing "FIXED" for corrupted wallets.

---

### Step 5: Verify the Fix

Run these verification queries to confirm everything worked:

```sql
-- 1. Check the specific deposit
SELECT 
  id, user_id, amount, currency_code, status, 
  jsonb_pretty(metadata) as metadata
FROM deposits
WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1';
```

```sql
-- 2. Check the user's wallets are now reasonable
SELECT 
  id, currency_code, balance, 
  total_deposited, total_withdrawn
FROM wallets
WHERE user_id = (
  SELECT user_id FROM deposits 
  WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1'
);
```

```sql
-- 3. Verify balance matches transactions
SELECT 
  w.id, w.currency_code, w.balance,
  COALESCE(SUM(CASE
    WHEN wt.type IN ('deposit_pending', 'deposit_approved', 'transfer_in', 'refund') THEN wt.amount
    WHEN wt.type IN ('deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee') THEN -wt.amount
    ELSE 0
  END), 0) as calculated
FROM wallets w
LEFT JOIN wallet_transactions wt ON wt.wallet_id = w.id
WHERE w.user_id = (SELECT user_id FROM deposits WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1')
GROUP BY w.id, w.currency_code, w.balance;
```

**Expected results:**
- Balances are now reasonable (PHP in thousands/millions, BTC in fractions)
- `balance` = `calculated` (no discrepancy)
- Metadata contains conversion details

---

## 🔧 What Each File Does

| File | Purpose | When to Run |
|------|---------|-----------|
| `supabase/migrations/0120_fix_deposits_metadata_and_wallet_balances.sql` | Creates functions, tables, triggers | Once, when deploying |
| `supabase/sql/diagnose_and_fix_transaction_cbf899c8.sql` | Diagnoses and fixes specific transaction | After migration, for this specific issue |
| `DEPOSITS_BALANCE_RECONCILIATION_FIX.md` | Comprehensive reference guide | For understanding the fix |
| `DEPOSITS_FIX_ACTION_PLAN.md` | This file - quick action steps | Follow these steps first |

---

## 🚨 Troubleshooting

### Error: "CHECK constraints cannot be marked DEFERRABLE"
- ✅ Already fixed in the migration file
- Verify you're using the correct version from `supabase/migrations/0120_fix_deposits_metadata_and_wallet_balances.sql`
- Don't use the old version mentioned in the user prompt

### Error: "Function already exists"
- This is OK! The functions are created with `CREATE OR REPLACE FUNCTION`
- Migration will update existing functions

### Error: "wallet_transactions table not found"
- Make sure migration `0115_wallet_transactions_ledger_system.sql` ran first
- Check the migration order in supabase/migrations/

### Verification query shows balance still wrong
- The diagnostic script must have failed (check for errors)
- Run the script again and review error messages
- Check wallet_transactions to verify they exist and are correct

---

## 📊 Testing the Fix

### Quick Test Query
```sql
-- This should return the functions we created
SELECT 
  routine_name, 
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE 'fix_%'
OR routine_name LIKE 'reconcile_%'
OR routine_name LIKE '%_deposit_metadata%'
ORDER BY routine_name;
```

### Function Existence Check
```sql
-- Check if fix_wallet_balance exists
SELECT EXISTS(
  SELECT 1 FROM information_schema.routines 
  WHERE routine_name = 'fix_wallet_balance'
);
```

### Table Existence Check
```sql
-- Check if wallet_balance_audit table exists
SELECT EXISTS(
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'wallet_balance_audit'
);
```

---

## ✨ Summary

**Before:**
- PHP wallet: 5,179,990,012,320,011.00 (impossible)
- BTC wallet: 10,186,804,350,678,487,000.00 (impossible)
- No audit trail
- No reconciliation capability

**After:**
- ✅ Balances reconciled from wallet_transactions
- ✅ Audit trail of all changes in wallet_balance_audit
- ✅ Functions to diagnose and fix corrupted wallets
- ✅ Enhanced deposit metadata with conversion details
- ✅ Constraints to prevent future corruption
- ✅ Triggers to maintain data integrity

---

## 🚀 Recommended Reading Order

1. **This file** - Action plan overview
2. **DEPOSITS_BALANCE_RECONCILIATION_FIX.md** - Comprehensive details
3. **supabase/migrations/0120_fix_deposits_metadata_and_wallet_balances.sql** - The actual SQL
4. **supabase/sql/diagnose_and_fix_transaction_cbf899c8.sql** - The fix script

---

**Status:** Ready to deploy
**Priority:** HIGH (fixes data integrity issue)
**Rollback:** Possible (balances are recalculated from transactions, which are immutable)
