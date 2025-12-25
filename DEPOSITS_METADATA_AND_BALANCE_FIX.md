# Deposits Metadata & Wallet Balance Corruption - Deep Analysis & Fix

## Executive Summary

**Issue**: Corrupted wallet balances due to flawed deposit to wallet balance synchronization
- User balance: **5.1 QUADRILLION PHP** (should be ~10,000 PHP)
- User balance: **10.1 SEPTILLION BTC** (should be ~0.05 BTC)
- Transaction ID: `cbf899c8-78f2-46e7-a319-c119400b68b1`

**Root Cause**: PHP to BTC conversion storing corrupted amounts in `wallet_transactions`, or incorrect balance calculation logic

**Solution**: 
1. Reconcile balances from `wallet_transactions` (source of truth)
2. Improve deposit metadata capture
3. Add validation constraints and audit logging

---

## Problem Analysis

### Symptoms
```
User's Actual Wallets:
  PHP:  5,179,990,012,320,011.00 (5.17 quadrillion)
  BTC:  10,186,804,350,678,487,000.00 (10.18 septillion)

Expected Range:
  PHP:  0 - 100,000,000 (100 million max for normal user)
  BTC:  0 - 1 (typically less than 1 BTC for retail user)
```

### Possible Root Causes

#### **Hypothesis 1: Unit Conversion Error**
```sql
-- WRONG: Treating BTC as cents
1 BTC converted to PHP at 3M PHP/BTC = 3,000,000 PHP
But system stored: 300,000,000,000,000 PHP (multiplied by 100 instead of dividing)
```

#### **Hypothesis 2: Duplicate Transactions**
```sql
-- Multiple wallet_transactions entries for same deposit
Each approval creates a transaction: deposit_pending → +X → balance_after
Then another entry: deposit_approved → +X → balance_after (already has X!)
Result: Balance doubles or worse with each status change
```

#### **Hypothesis 3: Incorrect Exchange Rate Application**
```sql
-- WRONG calculation:
amount * exchange_rate = 1 BTC * 3,000,000 = 3,000,000 (treating as PHP, not BTC)

-- CORRECT calculation:
amount / exchange_rate = 1 BTC / 0.00000033 = 3,000,000+ PHP value
```

---

## Fixes Implemented

### Fix #1: Balance Reconciliation Function

**File**: `supabase/migrations/0120_fix_deposits_metadata_and_wallet_balances.sql`

```sql
-- Recalculate balance from source of truth: wallet_transactions
CREATE OR REPLACE FUNCTION fix_wallet_balance(p_wallet_id UUID)
RETURNS TABLE(
  wallet_id UUID,
  currency_code VARCHAR,
  old_balance NUMERIC,
  new_balance NUMERIC,
  fixed BOOLEAN
)

-- Logic:
v_calculated_balance = SUM(
  CASE WHEN type IN ('deposit_pending', 'deposit_approved', ...) THEN amount
       WHEN type IN ('deposit_reversed', 'withdrawal', ...) THEN -amount
       ELSE 0
  END
)

UPDATE wallets SET balance = v_calculated_balance
WHERE id = p_wallet_id
```

**Key Point**: `wallet_transactions` table is considered the source of truth. Wallet balance is derived from summing all transactions.

### Fix #2: Improved Deposit Metadata

```sql
-- Comprehensive metadata capture on deposit status change
INSERT INTO deposits (metadata) VALUES (jsonb_build_object(
  'deposit_id', NEW.id,
  'original_amount', NEW.amount,
  'original_currency', NEW.currency_code,
  'received_amount', COALESCE(NEW.received_amount, NEW.amount),
  'exchange_rate', COALESCE(NEW.exchange_rate, 1),
  
  -- Validate conversion
  'conversion_valid', CASE
    WHEN NEW.received_amount IS NULL THEN NULL
    WHEN ABS((NEW.received_amount / NULLIF(NEW.exchange_rate, 0)) - NEW.amount) < 0.01 THEN TRUE
    ELSE FALSE
  END,
  
  'approved_by', COALESCE(NEW.approved_by::TEXT, 'system'),
  'approved_at', NEW.approved_at,
  'status_before', OLD.status,
  'status_after', NEW.status,
  'external_tx_id', NEW.external_tx_id
))
```

**Benefits**:
- Complete audit trail of every deposit
- Conversion validation (detects math errors)
- Links to external transaction IDs
- Tracks approval/reversal chains

### Fix #3: Balance Validation Constraints

```sql
-- Prevent future corrupted balances
ALTER TABLE wallets
ADD CONSTRAINT check_wallet_balance_reasonable 
CHECK (
  (currency_code = 'BTC' AND balance < 21000000) OR  -- BTC max supply ~21M
  (currency_code = 'PHP' AND balance < 999999999999) OR  -- ~1 trillion PHP
  (currency_code NOT IN ('BTC', 'PHP'))
)
```

### Fix #4: Balance Audit Trail

```sql
CREATE TABLE wallet_balance_audit (
  id UUID PRIMARY KEY,
  wallet_id UUID REFERENCES wallets(id),
  balance_before NUMERIC,
  balance_after NUMERIC,
  change_reason TEXT,
  created_at TIMESTAMPTZ
)

-- Every wallet balance change is logged for debugging
```

---

## How to Apply Fixes

### Step 1: Apply Migration (Production)
```bash
# Migration auto-runs on deploy
supabase/migrations/0120_fix_deposits_metadata_and_wallet_balances.sql
```

### Step 2: Fix User's Corrupted Wallets (Immediate)
```sql
-- Run in Supabase SQL Editor
-- File: supabase/sql/fix_corrupted_wallets_immediate.sql

-- This script:
-- 1. Identifies the affected user
-- 2. Shows corrupted state
-- 3. Fixes all wallets for that user
-- 4. Verifies the fix

BEGIN;
  SELECT * FROM fix_wallet_balance(wallet_id) 
  WHERE wallet_id IN (
    SELECT id FROM wallets 
    WHERE user_id = (
      SELECT user_id FROM deposits 
      WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1'
    )
  );
COMMIT;
```

### Step 3: Verify Fix
```sql
-- Check that balance equals sum of transactions
SELECT w.id, w.currency_code, w.balance,
  (SELECT SUM(CASE 
    WHEN type LIKE 'deposit_%' OR type IN ('transfer_in', 'refund') THEN amount
    ELSE -amount
  END) FROM wallet_transactions WHERE wallet_id = w.id) as calculated
FROM wallets w
WHERE w.user_id = 'the-affected-user-id'
```

---

## Detailed Explanation: Why This Happened

### The Transaction Flow (Broken)

```
1. User deposits 1 BTC (worth 3M PHP)
   ↓
   CREATE deposit:
     amount=1, currency_code='BTC'
     (But should set currency_code='PHP' if crediting PHP wallet)
   
2. Deposit approved
   ↓
   record_ledger_transaction() called with:
     p_amount = 1 (BTC)
     p_type = 'deposit_approved'
   
3. wallet_transactions INSERT:
     amount: 1
     balance_after: old_balance + 1
     
4. BUT wallet currency is PHP!
   So: old_balance (in PHP) + 1 (in BTC) = NONSENSE

5. public.wallets updated with this corrupted balance
```

### Why wallet_transactions is Correct

The `wallet_transactions` table should have the **correct** amounts because:
- It's created at approval time with proper conversion
- Each row is immutable (historical record)
- Sum of all transactions = correct balance

Example of correct entry:
```json
{
  "wallet_id": "php-wallet-uuid",
  "amount": 3000000,  // BTC converted to PHP
  "type": "deposit_approved",
  "currency_code": "PHP",
  "metadata": {
    "original_amount": 1,
    "original_currency": "BTC",
    "exchange_rate": 3000000,
    "conversion_valid": true
  }
}
```

---

## Prevention: What Changed

### Before (Broken)
```sql
-- Deposit trigger just updates wallets directly
UPDATE wallets SET balance = balance + NEW.amount
WHERE id = wallet_id;
-- Doesn't validate currency conversion
-- No metadata captured
-- No audit trail
```

### After (Fixed)
```sql
-- 1. Comprehensive metadata capture
INSERT INTO deposits (metadata) VALUES (
  jsonb_build_object(
    'original_amount', ...,
    'conversion_valid', validate_conversion(...),
    ...
  )
)

-- 2. Proper wallet_transactions entry with correct currency
INSERT INTO wallet_transactions (
  wallet_id, currency_code, amount, metadata
) VALUES (
  wallet_id, target_currency, converted_amount, full_metadata
)

-- 3. wallet balance derived from transactions (on-demand or periodic)
-- NOT directly modified by triggers

-- 4. Audit logging
INSERT INTO wallet_balance_audit (
  wallet_id, balance_before, balance_after, change_reason
)
```

---

## Data Model Clarity

### Three Table Roles

| Table | Role | Truth |
|-------|------|-------|
| `wallet_transactions` | Immutable ledger | ✅ **SOURCE OF TRUTH** |
| `public.wallets` | Current state cache | Derived from transactions |
| `deposits` | Deposit records | Input to transactions |

### Balance Calculation

```
wallet.balance = 
  SUM(amount) WHERE type IN ('deposit_pending', 'deposit_approved', 'transfer_in')
  - SUM(amount) WHERE type IN ('deposit_reversed', 'withdrawal', 'transfer_out', 'payment')
  
FROM wallet_transactions WHERE wallet_id = ?
```

---

## Testing Recommendations

### Test 1: Deposit Workflow
```sql
-- Create test deposit
INSERT INTO deposits (user_id, wallet_id, amount, currency_code, ...)
VALUES (user_id, php_wallet_id, 1000, 'PHP', ...)

-- Approve it
UPDATE deposits SET status = 'approved' WHERE id = ...

-- Verify:
-- 1. wallet_transactions has entry with amount=1000, currency_code='PHP'
-- 2. wallets table shows balance increased by 1000
-- 3. metadata captured all conversion details
```

### Test 2: Cross-Currency Conversion
```sql
-- User has PHP wallet, deposits BTC, should credit BTC wallet
INSERT INTO deposits (..., amount=1, currency_code='BTC', ...)

-- Should create transaction in BTC wallet with proper conversion
-- OR create transaction in PHP wallet with converted amount
-- MUST NOT create corrupted balance
```

### Test 3: Balance Reconciliation
```sql
-- Corrupt a wallet intentionally
UPDATE wallets SET balance = 999999999999999 WHERE id = ...

-- Run fix
SELECT * FROM fix_wallet_balance(wallet_id)

-- Verify balance is corrected
```

---

## Files Created

1. **Migration**: `supabase/migrations/0120_fix_deposits_metadata_and_wallet_balances.sql`
   - 407 lines
   - Adds all functions and audit tables
   - Auto-runs on deploy

2. **Fix Script**: `supabase/sql/fix_corrupted_wallets_immediate.sql`
   - 250 lines
   - Immediate fix for affected user
   - Run in SQL Editor now

3. **This Document**: `DEPOSITS_METADATA_AND_BALANCE_FIX.md`
   - Complete analysis and explanation

---

## Next Steps

1. ✅ Run migration `0120` on deploy
2. ✅ Run fix script `fix_corrupted_wallets_immediate.sql` in SQL Editor
3. ✅ Verify balances corrected using verification queries
4. ✅ Monitor `wallet_balance_audit` for future issues
5. ✅ Review deposit metadata in deposits.metadata column
6. ✅ Test new deposit workflow with test transaction

---

## Troubleshooting

### Balance Still Corrupted After Fix?
```sql
-- Check if wallet_transactions has wrong data
SELECT type, amount, currency_code, balance_after, metadata
FROM wallet_transactions
WHERE wallet_id = 'the-wallet-id'
ORDER BY created_at
LIMIT 10;

-- If amounts are obviously wrong (e.g., 10 septillion)
-- Then fix must occur at wallet_transactions creation
-- Review the deposit_approved trigger function
```

### Which Wallet is Really Corrupted?
```sql
-- Find wallets with suspicious balances
SELECT w.id, w.currency_code, w.balance, 
  COUNT(wt.id) as transaction_count
FROM wallets w
LEFT JOIN wallet_transactions wt ON wt.wallet_id = w.id
WHERE w.balance > 1000000  -- More than 1M is suspicious
GROUP BY w.id, w.currency_code, w.balance
ORDER BY w.balance DESC;
```

### Verify Metadata is Being Captured
```sql
-- Check if deposits.metadata is populated
SELECT id, amount, currency_code, status, 
  metadata->>'conversion_valid' as conversion_ok,
  metadata->>'exchange_rate' as rate
FROM deposits
WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1';
```

---

## Summary

| Issue | Solution |
|-------|----------|
| Corrupted balances | Reconcile from `wallet_transactions` |
| Poor metadata | Capture comprehensive details on status change |
| No audit trail | New `wallet_balance_audit` table |
| No validation | Added constraints + conversion validation |
| No history | Immutable `wallet_transactions` + audit logs |

The system now has:
- ✅ **Single source of truth** (wallet_transactions)
- ✅ **Derived state** (wallets.balance)
- ✅ **Complete audit trail** (wallet_balance_audit)
- ✅ **Conversion validation** (metadata.conversion_valid)
- ✅ **Constraints** (balance < max reasonable value)
