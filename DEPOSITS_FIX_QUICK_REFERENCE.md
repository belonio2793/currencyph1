# Deposits Balance Fix - Quick Reference

## 📋 Files to Deploy

### 1. Run this migration first:
```
supabase/migrations/0120_fix_deposits_metadata_and_wallet_balances.sql
```

### 2. Then run this fix script:
```
supabase/sql/diagnose_and_fix_transaction_cbf899c8.sql
```

---

## 🔍 Diagnostic Queries

### Find corrupted wallets
```sql
SELECT w.id, w.currency_code, w.balance
FROM wallets w
WHERE w.balance > 1000000 OR w.balance > 10000000000
ORDER BY w.balance DESC;
```

### Show balance discrepancies
```sql
SELECT
  w.id, w.currency_code, w.balance,
  COALESCE(SUM(CASE
    WHEN wt.type IN ('deposit_pending', 'deposit_approved', 'transfer_in', 'refund') THEN wt.amount
    WHEN wt.type IN ('deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee') THEN -wt.amount
    ELSE 0
  END), 0) as calculated,
  ABS(w.balance - COALESCE(SUM(...), 0)) as discrepancy
FROM wallets w
LEFT JOIN wallet_transactions wt ON wt.wallet_id = w.id
GROUP BY w.id, w.currency_code, w.balance
HAVING ABS(w.balance - COALESCE(SUM(...), 0)) >= 0.01;
```

---

## 🔧 Repair Queries

### Fix one wallet
```sql
SELECT * FROM fix_wallet_balance(wallet_uuid);
```

### Fix all corrupted wallets
```sql
SELECT * FROM fix_all_corrupted_wallets();
```

### Diagnose specific wallet
```sql
SELECT * FROM reconcile_wallet_balance(wallet_uuid);
```

---

## ✅ Verification Queries

### Check deposit details
```sql
SELECT id, user_id, amount, currency_code, status, metadata
FROM deposits
WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1';
```

### Check user's wallets
```sql
SELECT id, currency_code, balance, total_deposited, total_withdrawn
FROM wallets
WHERE user_id = (
  SELECT user_id FROM deposits 
  WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1'
);
```

### Check all transactions for deposit
```sql
SELECT type, amount, currency_code, balance_after, created_at
FROM wallet_transactions
WHERE reference_id = 'cbf899c8-78f2-46e7-a319-c119400b68b1'
ORDER BY created_at;
```

### Check audit trail
```sql
SELECT wallet_id, balance_before, balance_after, created_at
FROM wallet_balance_audit
ORDER BY created_at DESC LIMIT 20;
```

---

## 📊 Available Functions

| Function | Type | Purpose |
|----------|------|---------|
| `reconcile_wallet_balance(uuid)` | Read-only | Diagnose balance discrepancy |
| `fix_wallet_balance(uuid)` | Corrective | Fix single wallet |
| `fix_all_corrupted_wallets()` | Corrective | Bulk fix suspicious wallets |
| `improve_deposit_metadata()` | Trigger | Auto-capture deposit details |
| `log_wallet_balance_change()` | Trigger | Auto-log balance changes |

---

## 📊 Available Tables

| Table | Purpose |
|-------|---------|
| `wallets` | User wallet balances |
| `wallet_transactions` | Immutable transaction ledger |
| `wallet_balance_audit` | Audit trail of balance changes |
| `deposits` | Deposit records (now with metadata) |

---

## 💰 Balance Limits (Check Constraints)

| Currency | Max Balance |
|----------|------------|
| BTC | 21,000,000 |
| PHP | 999,999,999,999 |
| Others | No limit |

---

## 🎯 The Fix in 3 Steps

1. **Run Migration**
   ```
   supabase/migrations/0120_fix_deposits_metadata_and_wallet_balances.sql
   ```

2. **Run Diagnostic & Fix**
   ```
   supabase/sql/diagnose_and_fix_transaction_cbf899c8.sql
   ```

3. **Verify**
   ```sql
   -- Balances should now be reasonable
   SELECT * FROM wallets WHERE user_id = 'user-uuid' ORDER BY currency_code;
   ```

---

## 🚨 Troubleshooting

| Error | Solution |
|-------|----------|
| "CHECK constraints cannot be marked DEFERRABLE" | Use corrected migration file (DEFERRABLE removed) |
| "Function already exists" | OK! Uses `CREATE OR REPLACE` |
| "wallet_transactions table not found" | Migration 0115 must run first |
| Balance still wrong after fix | Run diagnostic script again, check for errors |

---

## 📚 Documentation

- **Quick overview:** This file
- **Step-by-step:** `DEPOSITS_FIX_ACTION_PLAN.md`
- **Full details:** `DEPOSITS_BALANCE_RECONCILIATION_FIX.md`
- **Executive summary:** `DEPOSITS_FIX_EXECUTIVE_SUMMARY.md`

---

## ✨ Best Practice

**Always use transactions as source of truth:**

```javascript
// ✅ GOOD
const balance = await db.query(`
  SELECT SUM(amount) FROM wallet_transactions 
  WHERE wallet_id = $1
`, [walletId]);

// ❌ BAD
const balance = await db.query(`
  SELECT balance FROM wallets WHERE id = $1
`, [walletId]);
```

---

## 🔐 Data Safety

- ✅ Transactions are immutable
- ✅ Balances are recalculated from transactions
- ✅ All changes are logged in audit table
- ✅ Constraints prevent impossible values
- ✅ Backwards compatible (no breaking changes)

---

**Last Updated:** 2024
**Status:** Ready to deploy
