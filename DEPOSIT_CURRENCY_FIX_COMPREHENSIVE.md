# Deposit Currency & Amount Validation - Comprehensive Fix

## Executive Summary

**Problem**: Deposits are being credited to wallets with incorrect amounts due to:
1. Database triggers using raw `amount` instead of `received_amount` (PHP-converted value)
2. No validation constraints to catch currency mismatches
3. No audit trail for currency conversion issues
4. Crypto deposits stored with wrong `currency_code` (PHP instead of BCH, etc)

**Scope**: This is a **systemic issue** affecting all deposit types, not just crypto.

**Impact**: Any crypto or multi-currency deposit gets credited with the wrong amount (usually 1/30,000 of intended).

---

## Root Causes Identified

### 1. **Trigger Bug - Most Critical**

**Location**: `supabase/migrations/0109_add_auto_credit_on_approved_deposits.sql`

**Problem**:
```sql
-- WRONG - Uses raw amount without conversion
v_new_balance := COALESCE(v_wallet_balance, 0) + NEW.amount;
```

**Effect**: 
- 3443 BCH deposit → adds 3443 to wallet (should add 119,947,205.75)
- Happens automatically when deposit status is set to 'approved'
- Affects ALL deposit types that have a conversion rate

**The Bug Flow**:
```
1. User deposits 3443 BCH
2. System calculates: received_amount = 3443 * 34837.99 = 119,947,205.75 PHP
3. Deposit is marked as 'approved'
4. Trigger fires and executes:
   v_new_balance = wallet.balance + NEW.amount
   v_new_balance = 0 + 3443 = 3443  ❌ WRONG!
5. Should be: 0 + 119,947,205.75 = 119,947,205.75 ✅
```

### 2. **Currency Code Mismatch**

**Problem**: Deposits are stored with `currency_code = 'PHP'` even when depositing BCH, ETH, etc.

**Why It Matters**:
```
{
  "amount": 3443,
  "currency_code": "PHP",  ❌ WRONG - should be "BCH"
  "received_amount": 119947205.75,
  "exchange_rate": 34837.99
}
```

This causes confusion when:
- Displaying deposit history (shows 3443 PHP, not 3443 BCH)
- Calculating balances (currency_code is wrong)
- Auditing transactions (currency doesn't match)

### 3. **No Validation Constraints**

**Missing Safeguards**:
- ❌ No CHECK constraint to validate currency_code
- ❌ No trigger to catch currency/amount mismatches before insertion
- ❌ No audit log for suspicious deposits
- ❌ No function to detect and alert on currency issues

### 4. **Second Trigger with Same Bug**

**Location**: `supabase/migrations/024_fix_wallet_update_in_trigger.sql`

This trigger also uses `NEW.amount` directly without checking `received_amount`.

---

## The Complete Fix

### Part 1: Fix the Trigger (CRITICAL)

**File**: `supabase/migrations/fix_deposit_trigger_currency_validation.sql`

**Change**:
```sql
-- OLD (WRONG)
v_new_balance := COALESCE(v_wallet_balance, 0) + NEW.amount;

-- NEW (FIXED)
v_credit_amount := COALESCE(NEW.received_amount, NEW.amount);
v_new_balance := COALESCE(v_wallet_balance, 0) + v_credit_amount;
```

**How It Works**:
- If `received_amount` exists (crypto conversion happened) → use it
- Otherwise → use `amount` (for PHP deposits)
- This ensures crypto deposits are credited with the PHP-equivalent amount

### Part 2: Add Validation Function

Prevents invalid deposits from being created:

```sql
CREATE FUNCTION validate_deposit_currency()
-- Checks:
✓ currency_code is not null
✓ amount is positive
✓ received_amount is positive (if set)
✓ currency_code matches the deposit type
```

### Part 3: Add Audit Table & Function

Creates a log of suspicious deposits:

```sql
CREATE TABLE deposit_currency_audit
-- Tracks:
✓ Currency mismatches
✓ Missing conversions
✓ Invalid amounts
✓ When fixed and by whom
```

### Part 4: Add Safeguard Trigger

Prevents manual SQL mistakes:

```sql
CREATE TRIGGER trg_safeguard_deposit_currency_on_update
-- Prevents:
✓ Changing currency_code to PHP if it had a conversion
✓ Other dangerous currency changes
```

### Part 5: Create Views for Transparency

```sql
CREATE VIEW deposits_with_conversions
-- Shows:
✓ All deposits with currency conversions
✓ Original amount → converted amount
✓ Exchange rates used
✓ Current wallet balance
```

---

## How to Apply These Fixes

### Step 1: Apply the Migration

Run the migration through Supabase:

```bash
# Option A: Using Supabase CLI
supabase db push

# Option B: Manual via Supabase Dashboard
# Copy content of supabase/migrations/fix_deposit_trigger_currency_validation.sql
# Go to SQL Editor → paste and execute
```

### Step 2: Verify the Trigger Works

```sql
-- Check if trigger is active
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'trg_credit_wallet_on_approved';

-- Should return: trg_credit_wallet_on_approved | deposits
```

### Step 3: Audit Existing Deposits

```sql
-- Find deposits with currency issues
SELECT * FROM audit_deposit_currency_issues();

-- View all affected deposits
SELECT * FROM deposit_currency_audit WHERE fixed = FALSE;
```

### Step 4: Run the Repair Script

Apply the repair for the 3443 BCH deposit (already created):

```bash
npm run repair-deposits
```

Or manually:
```sql
-- Copy from supabase/migrations/repair_bch_deposit.sql
```

---

## Verification

After applying the fix, verify with these queries:

```sql
-- 1. Check trigger is updated
SELECT pg_get_functiondef(
  (SELECT oid FROM pg_proc WHERE proname = 'credit_wallet_on_deposit_approved')
);
-- Should show: v_credit_amount := COALESCE(NEW.received_amount, NEW.amount);

-- 2. Check deposits with conversions display correctly
SELECT * FROM deposits_with_conversions LIMIT 5;

-- 3. Check for any currency audit issues
SELECT * FROM deposit_currency_audit WHERE fixed = FALSE;

-- 4. Test with a new test deposit to ensure trigger uses received_amount
-- Create deposit with received_amount, mark as approved, check wallet balance
```

---

## Future Prevention

All these safeguards are now in place:

| Issue | Safeguard | Location |
|-------|-----------|----------|
| Trigger using wrong amount | Updated trigger to use received_amount | credit_wallet_on_deposit_approved() |
| Invalid currency codes | Validation trigger | validate_deposit_currency() |
| Undetected currency mismatches | Audit function | audit_deposit_currency_issues() |
| Manual SQL mistakes | Safeguard trigger | safeguard_deposit_currency_on_update() |
| Lack of visibility | View created | deposits_with_conversions |
| No audit trail | Audit table created | deposit_currency_audit |

---

## Affected Deposits

This issue affects any deposit where:
- `received_amount IS NOT NULL` (has a conversion)
- `exchange_rate IS NOT NULL` (has a conversion)
- `currency_code != 'PHP'` (non-PHP currency)

**Most Common Scenarios**:
- Bitcoin (BTC) deposits → credited at exchange rate of 1, not rate
- Ethereum (ETH) deposits → same issue
- Stablecoins (USDT, USDC) → same issue
- Other cryptos → same issue
- Multi-currency fiat transfers → same issue

---

## Testing Checklist

After applying the fix:

- [ ] Migration applied successfully
- [ ] Trigger `trg_credit_wallet_on_approved` exists and updated
- [ ] Validation trigger `trg_validate_deposit_currency` exists
- [ ] Audit table `deposit_currency_audit` created
- [ ] View `deposits_with_conversions` accessible
- [ ] Repair script fixes the 3443 BCH deposit
- [ ] Wallet balance shows 119,947,205.75 PHP (not 3443)
- [ ] Transaction history shows conversion details
- [ ] New test deposits work correctly with conversions

---

## Files Modified/Created

1. **supabase/migrations/fix_deposit_trigger_currency_validation.sql** - Main fix
   - Updates trigger to use received_amount
   - Adds validation constraints
   - Creates audit functionality
   - Creates safeguards

2. **supabase/migrations/repair_bch_deposit.sql** - Repair script
   - Fixes the 3443 BCH deposit
   - Corrects wallet balance
   - Creates audit transaction

3. **scripts/repair-deposit-conversions.js** - Batch repair script
   - Fixes multiple deposits at once
   - Runs via `npm run repair-deposits`

4. **DEPOSIT_CONVERSION_FIX_SUMMARY.md** - Earlier documentation
   - Details on the initial crypto deposit fix
   - Repair process

---

## Monitoring & Ongoing

**After Fix Applied**:

1. **Monitor for regressions**:
   ```sql
   -- Run monthly
   SELECT * FROM deposit_currency_audit WHERE fixed = FALSE;
   ```

2. **Verify all deposits marked as approved have correct balances**:
   ```sql
   SELECT 
     COUNT(*) as total_approved,
     COUNT(CASE WHEN received_amount IS NOT NULL THEN 1 END) as with_conversions,
     COUNT(CASE WHEN exchange_rate IS NOT NULL THEN 1 END) as with_rates
   FROM deposits
   WHERE status IN ('approved', 'completed');
   ```

3. **Check for any wallet balance discrepancies**:
   ```sql
   SELECT * FROM wallet_balance_reconciliation 
   WHERE status = 'pending' OR status = 'failed';
   ```

---

## Questions?

- **Why did this happen?** The code was written to support PHP deposits, then crypto support was added later but the trigger wasn't updated.

- **Why wasn't it caught earlier?** No validation constraints or audit functions - system trusted developers to use it correctly.

- **Will it happen again?** No - the new validation and safeguard triggers will prevent it.

- **Should we add more checks?** Yes - consider adding alerts when conversions are > 10x or < 0.1x the original amount.
