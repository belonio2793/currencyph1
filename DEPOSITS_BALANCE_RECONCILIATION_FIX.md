# Deposits Balance Reconciliation Fix

## 🚨 Problem Summary

**Transaction ID:** `cbf899c8-78f2-46e7-a319-c119400b68b1`

A user's wallet balances became severely corrupted during a PHP to BTC deposit conversion:
- **PHP Wallet:** 5,179,990,012,320,011.00 PHP (5 quadrillion - impossible!)
- **BTC Wallet:** 10,186,804,350,678,487,000.00 BTC (10 septillion - impossible!)

**Maximum realistic amounts:**
- BTC: ~21 million (total supply)
- PHP: ~999 billion (1 trillion max)

### Root Causes

1. **Balance calculation error** - Deposit amounts may have been applied incorrectly
2. **Unit conversion bug** - Decimal places not handled correctly during PHP→BTC conversion
3. **Duplicate transactions** - Same deposit may have been credited multiple times
4. **Exchange rate error** - Wrong exchange rate applied to conversion

### Why This Happened

The `wallets` table balance was being updated directly without proper validation against the `wallet_transactions` ledger. There was no reconciliation mechanism to catch these errors.

---

## ✅ The Fix

### Files Modified

1. **supabase/migrations/0120_fix_deposits_metadata_and_wallet_balances.sql** (FIXED)
   - Removed `DEFERRABLE INITIALLY DEFERRED` from CHECK constraint (PostgreSQL doesn't support this)
   - Creates reconciliation and fix functions
   - Creates audit trail table

2. **supabase/sql/diagnose_and_fix_transaction_cbf899c8.sql** (NEW)
   - Diagnostic script to identify the issue
   - Automated fix for the specific transaction

### New Database Functions

#### 1. `reconcile_wallet_balance(wallet_id UUID)` 
**Purpose:** Diagnoses balance discrepancies (read-only)

```sql
-- Returns diagnostic info about a wallet's balance
SELECT * FROM reconcile_wallet_balance(wallet_id);
```

**Returns:**
- `wallet_id` - The wallet being checked
- `actual_balance` - Current balance in DB
- `calculated_balance` - Sum of transactions
- `discrepancy` - Difference between actual and calculated
- `is_valid` - TRUE if within floating point tolerance

---

#### 2. `fix_wallet_balance(wallet_id UUID)`
**Purpose:** Fixes a single wallet by recalculating from transactions

```sql
-- Fix one wallet
SELECT * FROM fix_wallet_balance(wallet_id);
```

**Returns:**
- `wallet_id` - Wallet that was fixed
- `currency_code` - Currency (BTC, PHP, etc)
- `old_balance` - Previous (corrupted) balance
- `new_balance` - New (corrected) balance
- `fixed` - TRUE if balance was changed

---

#### 3. `fix_all_corrupted_wallets()`
**Purpose:** Bulk fix all wallets with suspicious balances

```sql
-- Fix all corrupted wallets at once
SELECT * FROM fix_all_corrupted_wallets();
```

**Returns:**
- `total_wallets_checked` - How many wallets were analyzed
- `wallets_fixed` - How many had corrupted balances
- `wallets_in_sync` - How many were already correct

---

### New Database Table

#### `wallet_balance_audit`
Tracks every balance change for accountability and debugging.

**Columns:**
- `id` - Unique audit record ID
- `wallet_id` - Which wallet was changed
- `balance_before` - Old balance
- `balance_after` - New balance
- `change_reason` - Why it changed (e.g., "balance_update")
- `changed_by` - Who/what changed it (e.g., "system")
- `created_at` - When the change occurred

**Example Query:**
```sql
SELECT *
FROM wallet_balance_audit
WHERE wallet_id = 'wallet-uuid-here'
ORDER BY created_at DESC
LIMIT 20;
```

---

### Enhanced Deposit Metadata

Deposits now capture comprehensive transaction details via the `improve_deposit_metadata()` trigger.

**Metadata includes:**
```json
{
  "deposit_id": "cbf899c8-...",
  "deposit_method": "crypto_transfer",
  "original_amount": 10000,
  "original_currency": "PHP",
  "status_before": "pending",
  "status_after": "approved",
  "exchange_rate": 1.25,
  "received_amount": 12500,
  "conversion_valid": true,
  "approved_by": "system",
  "approved_at": "2024-01-15T10:30:00Z",
  "payment_reference": "ref-123",
  "external_tx_id": "ext-tx-456"
}
```

---

## 🔧 How to Apply the Fix

### Step 1: Run the Migration

The fixed migration is already in place:
```
supabase/migrations/0120_fix_deposits_metadata_and_wallet_balances.sql
```

This migration:
- Creates reconciliation functions
- Creates audit table
- Sets up balance change triggers
- Adds metadata column to deposits

### Step 2: Run the Diagnostic Script

Execute the diagnostic script to identify and fix the specific transaction:
```sql
-- Run this script to diagnose and fix transaction cbf899c8-78f2-46e7-a319-c119400b68b1
psql -h <host> -U <user> -d <database> < supabase/sql/diagnose_and_fix_transaction_cbf899c8.sql
```

Or paste the contents directly in your database client and execute.

---

## 📊 How to Verify the Fix

### Verification Query 1: Check Deposit Details

```sql
SELECT 
  id as deposit_id,
  user_id,
  amount,
  currency_code,
  status,
  created_at,
  jsonb_pretty(metadata) as metadata
FROM deposits
WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1';
```

### Verification Query 2: Check User's Wallets

```sql
SELECT 
  w.id,
  w.user_id,
  w.currency_code,
  w.balance,
  w.total_deposited,
  w.total_withdrawn,
  w.created_at,
  w.updated_at
FROM wallets w
WHERE w.user_id = (
  SELECT user_id FROM deposits 
  WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1'
)
ORDER BY w.currency_code;
```

### Verification Query 3: Reconcile Each Wallet

```sql
SELECT *
FROM fix_wallet_balance(wallet_id)
WHERE wallet_id IN (
  SELECT w.id FROM wallets w
  WHERE w.user_id = (
    SELECT user_id FROM deposits 
    WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1'
  )
);
```

**Expected results:**
- `fixed = FALSE` (balance already matches transactions)
- `old_balance = new_balance` (no change needed)

### Verification Query 4: Check Audit Trail

```sql
SELECT 
  wallet_id,
  balance_before,
  balance_after,
  change_reason,
  created_at
FROM wallet_balance_audit
WHERE wallet_id IN (
  SELECT w.id FROM wallets w
  WHERE w.user_id = (
    SELECT user_id FROM deposits 
    WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1'
  )
)
ORDER BY created_at DESC
LIMIT 20;
```

---

## 🔍 Diagnostic Queries

### Find All Corrupted Wallets

```sql
SELECT 
  w.id,
  w.user_id,
  w.currency_code,
  w.balance,
  COUNT(DISTINCT wt.id) as transaction_count
FROM wallets w
LEFT JOIN wallet_transactions wt ON wt.wallet_id = w.id
WHERE w.balance > 1000000  -- More than 1M (suspicious for BTC)
   OR w.balance > 10000000000  -- More than 10B (suspicious for PHP)
GROUP BY w.id, w.user_id, w.currency_code, w.balance
ORDER BY w.balance DESC;
```

### Show Balance Discrepancies

```sql
SELECT
  w.id as wallet_id,
  w.user_id,
  w.currency_code,
  w.balance as actual_balance,
  COALESCE(SUM(CASE
    WHEN wt.type IN ('deposit_pending', 'deposit_approved', 'transfer_in', 'refund') THEN wt.amount
    WHEN wt.type IN ('deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee') THEN -wt.amount
    WHEN wt.type = 'adjustment' THEN wt.amount
    ELSE 0
  END), 0) as calculated_balance,
  ABS(w.balance - COALESCE(SUM(CASE
    WHEN wt.type IN ('deposit_pending', 'deposit_approved', 'transfer_in', 'refund') THEN wt.amount
    WHEN wt.type IN ('deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee') THEN -wt.amount
    WHEN wt.type = 'adjustment' THEN wt.amount
    ELSE 0
  END), 0)) as discrepancy
FROM wallets w
LEFT JOIN wallet_transactions wt ON wt.wallet_id = w.id
GROUP BY w.id, w.user_id, w.currency_code, w.balance
HAVING ABS(w.balance - COALESCE(SUM(CASE
  WHEN wt.type IN ('deposit_pending', 'deposit_approved', 'transfer_in', 'refund') THEN wt.amount
  WHEN wt.type IN ('deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee') THEN -wt.amount
  WHEN wt.type = 'adjustment' THEN wt.amount
  ELSE 0
END), 0)) >= 0.01
ORDER BY discrepancy DESC;
```

---

## ⚙️ How to Use Going Forward

### Best Practice: Always Use Ledger as Source of Truth

**DO:**
```javascript
// Good: Read from wallet_transactions (source of truth)
const transactions = await db.query(`
  SELECT SUM(CASE
    WHEN type IN ('deposit_approved', 'transfer_in') THEN amount
    WHEN type IN ('withdrawal', 'transfer_out') THEN -amount
    ELSE 0
  END) as balance
  FROM wallet_transactions
  WHERE wallet_id = $1
`, [walletId]);
```

**DON'T:**
```javascript
// Bad: Direct balance field might be corrupted
const balance = await db.query(`
  SELECT balance FROM wallets WHERE id = $1
`, [walletId]);
```

### Reconciliation Script for Deposits

```sql
-- After any deposit update, verify balance is correct
WITH deposit_calc AS (
  SELECT 
    w.id,
    w.balance,
    COALESCE(SUM(CASE
      WHEN wt.type IN ('deposit_pending', 'deposit_approved', 'transfer_in', 'refund') THEN wt.amount
      WHEN wt.type IN ('deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee') THEN -wt.amount
      WHEN wt.type = 'adjustment' THEN wt.amount
      ELSE 0
    END), 0) as calculated
  FROM wallets w
  LEFT JOIN wallet_transactions wt ON wt.wallet_id = w.id
  WHERE w.id = $1
  GROUP BY w.id, w.balance
)
SELECT 
  id,
  balance,
  calculated,
  CASE 
    WHEN ABS(balance - calculated) < 0.01 THEN 'VALID'
    ELSE 'CORRUPTED'
  END as status
FROM deposit_calc;
```

---

## 📈 Migration Check Constraints

Added validation to prevent future corruption:

```sql
CHECK (
  (currency_code = 'BTC' AND balance < 21000000) OR
  (currency_code = 'PHP' AND balance < 999999999999) OR
  (currency_code NOT IN ('BTC', 'PHP'))
)
```

This constraint:
- ✅ Allows BTC balances up to 21M
- ✅ Allows PHP balances up to 999B
- ✅ Allows any amount for other currencies
- ❌ Rejects impossible balances

---

## 🚀 Implementation Checklist

- [ ] Verify the migration file is correct (line 252 should NOT have DEFERRABLE)
- [ ] Run the fixed migration on the database
- [ ] Execute the diagnostic script for transaction cbf899c8-78f2-46e7-a319-c119400b68b1
- [ ] Run verification queries to confirm balances are fixed
- [ ] Check audit trail in wallet_balance_audit table
- [ ] Review deposit metadata for completeness
- [ ] Update any application code that reads wallet balances (prefer transactions over balance field)
- [ ] Add monitoring for future suspicious balances

---

## 💡 Key Learnings

1. **Source of Truth**: `wallet_transactions` is the single source of truth, not `wallets.balance`
2. **Validation**: Always validate conversions (unit, decimal places, exchange rates)
3. **Audit Trail**: Track all balance changes for debugging
4. **Constraints**: Database constraints prevent impossible states
5. **Reconciliation**: Regular reconciliation catches errors early

---

## 📞 Support

If the fix didn't work or you encounter issues:

1. Check that the migration ran successfully (no errors)
2. Run the diagnostic script and review the output
3. Check for any new errors in the database logs
4. Verify wallet_transactions are correct (source of truth)
5. Look at wallet_balance_audit for suspicious changes

---

**Last Updated:** 2024
**Status:** Ready for production
