# ✅ Errors Fixed - Retry Guide

## 🔧 What Was Wrong

### Error 1: Constraint Already Exists
```
ERROR: 42710: constraint "check_wallet_balance_reasonable" for relation "wallets" already exists
```

**Cause:** The constraint was created in a previous migration run
**Fix:** Wrapped the ADD CONSTRAINT in a DO block with exception handling

### Error 2: RAISE Syntax Error
```
ERROR: 42601: syntax error at or near "RAISE" LINE 41: RAISE NOTICE ''; ^
```

**Cause:** RAISE statements can only be used inside PL/pgSQL blocks (DO blocks or functions), not at top-level SQL
**Fix:** Wrapped all RAISE statements in DO $$ ... END $$; blocks

---

## ✅ Changes Made

### Migration File Fixed
**File:** `supabase/migrations/0120_fix_deposits_metadata_and_wallet_balances.sql`

**Change:** Line 293-307
```sql
-- BEFORE (fails if constraint exists):
ALTER TABLE IF EXISTS wallets
ADD CONSTRAINT check_wallet_balance_reasonable ...

-- AFTER (skips if already exists):
DO $$
BEGIN
  ALTER TABLE wallets
  ADD CONSTRAINT check_wallet_balance_reasonable ...
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
```

### Diagnostic Script Fixed
**File:** `supabase/sql/diagnose_and_fix_transaction_cbf899c8.sql`

**Changes:** All RAISE statements wrapped in DO blocks

**Before:**
```sql
RAISE NOTICE '';
RAISE NOTICE '>> PHASE 2: ...';
```

**After:**
```sql
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '>> PHASE 2: ...';
END $$;
```

---

## 🚀 How to Retry

### Option 1: Fresh Start (Recommended)
If you want a clean slate:

**Step 1: Drop the old constraint** (if it was partially created)
```sql
ALTER TABLE IF EXISTS wallets 
DROP CONSTRAINT IF EXISTS check_wallet_balance_reasonable;
```

**Step 2: Run the fixed migration**
Copy the entire corrected file and run:
```
supabase/migrations/0120_fix_deposits_metadata_and_wallet_balances.sql
```

**Step 3: Run the fixed diagnostic script**
Copy the entire corrected file and run:
```
supabase/sql/diagnose_and_fix_transaction_cbf899c8.sql
```

---

### Option 2: Just Run the Scripts (Easier)
The fixes now have exception handling, so they should work even if you ran them before:

**Step 1: Run the migration again**
```
supabase/migrations/0120_fix_deposits_metadata_and_wallet_balances.sql
```
✅ The constraint already exists? OK - exception handler skips it
✅ The functions exist? OK - CREATE OR REPLACE updates them

**Step 2: Run the diagnostic script again**
```
supabase/sql/diagnose_and_fix_transaction_cbf899c8.sql
```
✅ All RAISE statements now wrapped in DO blocks

---

## 🎯 What to Expect

After running the corrected scripts, you should see:

```
PHASE 1 output:
═══════════════════════════════════════════════════════════
TRANSACTION ID: cbf899c8-78f2-46e7-a319-c119400b68b1
AFFECTED USER: ramol@venezuela.com (user-uuid)
═══════════════════════════════════════════════════════════

PHASE 2 output:
>> PHASE 2: CURRENT WALLET STATE (CORRUPTED)
(Shows the wallet balances before fix)

PHASE 3 output:
>> PHASE 3: WALLET TRANSACTIONS FOR THIS DEPOSIT
(Shows all transactions for this deposit)

... more phases ...

PHASE 6 output:
✓ FIXED PHP (...): 5,179,990,012,320,011.00 → [correct amount]
✓ FIXED BTC (...): 10,186,804,350,678,487,000.00 → [correct amount]

PHASE 7 output:
(Shows verification - balances should now match transactions)

═══════════════════════════════════════════════════════════
FIX COMPLETE!
═══════════════════════════════════════════════════════════
```

---

## ✅ Verification Queries

After the scripts run, verify everything worked:

```sql
-- 1. Check the constraint exists
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'wallets' 
AND constraint_name = 'check_wallet_balance_reasonable';

-- Expected: One row with constraint_name

-- 2. Check the functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('fix_wallet_balance', 'reconcile_wallet_balance', 'fix_all_corrupted_wallets');

-- Expected: 3 rows with the function names

-- 3. Check the audit table exists
SELECT EXISTS(
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'wallet_balance_audit'
);

-- Expected: true

-- 4. Check user's walances are now reasonable
SELECT currency_code, balance 
FROM wallets 
WHERE user_id = (
  SELECT user_id FROM deposits 
  WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1'
);

-- Expected: PHP in thousands/millions, BTC in fractions (not quadrillions!)
```

---

## 🔐 Why the Fixes Work

### Constraint Exception Handling
```sql
DO $$
BEGIN
  ALTER TABLE wallets
  ADD CONSTRAINT check_wallet_balance_reasonable ...
EXCEPTION WHEN duplicate_object THEN
  NULL;  -- If constraint already exists, just skip
END $$;
```

This approach:
- ✅ Tries to add the constraint
- ✅ If it already exists, catches `duplicate_object` exception
- ✅ Does nothing (NULL) and continues
- ✅ No error, migration completes successfully

### RAISE in DO Blocks
```sql
DO $$
BEGIN
  RAISE NOTICE 'Message here';
END $$;
```

This approach:
- ✅ RAISE can only be used inside PL/pgSQL blocks
- ✅ DO blocks are PL/pgSQL blocks
- ✅ Now syntax is valid
- ✅ Messages display correctly

---

## 📋 Deployment Checklist

- [ ] Read this guide
- [ ] Verify both files are corrected (migration + diagnostic)
- [ ] Run the migration: `supabase/migrations/0120_fix_deposits_metadata_and_wallet_balances.sql`
- [ ] Run the diagnostic: `supabase/sql/diagnose_and_fix_transaction_cbf899c8.sql`
- [ ] Run verification queries (above)
- [ ] Confirm balances are now reasonable
- [ ] Confirm audit trail shows the fix

---

## 🚨 If You Still See Errors

### Error: "Function already exists"
**Solution:** This is OK! All functions use `CREATE OR REPLACE` so they're updated automatically

### Error: "Table already exists"
**Solution:** This is OK! All tables use `CREATE TABLE IF NOT EXISTS`

### Error: "Trigger already exists"
**Solution:** Tables use `DROP TRIGGER IF EXISTS` before creating, so it's replaced

### Error about wallet_transactions not existing
**Solution:** Migration 0115 must have run first. Check migration order and run 0115 before 0120

### Still seeing corrupt balances
**Solution:** Make sure the diagnostic script ran all the way to the end (check for "FIX COMPLETE!")

---

## 💡 Key Takeaways

1. **RAISE in SQL**: Can only be used inside DO blocks or functions
2. **Idempotent Migrations**: Use exception handling for commands that might fail on re-run
3. **Check Constraints**: Can't be added IF NOT EXISTS, must use exception handling
4. **Exception Names**: `duplicate_object` catches when constraint/function/table already exists

---

## 🎯 Next Steps

1. **Right now:** Run the fixed migration
2. **Then:** Run the fixed diagnostic script
3. **Then:** Run verification queries
4. **Finally:** Confirm balances are correct

---

**Status:** ✅ Errors identified and fixed
**Ready to retry:** YES
**Time estimate:** 5-10 minutes

---

Need help? Check:
- DEPOSITS_FIX_ACTION_PLAN.md (deployment steps)
- DEPOSITS_FIX_QUICK_REFERENCE.md (command lookup)
