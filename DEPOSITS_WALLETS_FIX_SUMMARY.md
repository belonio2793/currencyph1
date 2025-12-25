# Deposits and Wallets System Fix Summary

## Problem Statement
When deposits were approved, the amounts were not being inserted into the `public.wallets` table, but the user interface was still displaying debit amounts. The display should be a reconciliation from the SQL database, not the other way around.

## Root Causes Identified

### 1. **Trigger Column Name Mismatch** (Critical)
**File:** `supabase/migrations/0109_add_auto_credit_on_approved_deposits.sql`

The trigger `credit_wallet_on_deposit_approved()` was referencing columns that don't exist in the actual schema:
- Used `transaction_type` → Schema defines `type`
- Used `reference_type` → Schema has no such column
- Referenced `transaction_id` → Schema has no such column
- Used incorrect column names: `balance_after`, `status`, `created_at` with wrong structure

**Impact:** The trigger would fail silently when trying to insert into `wallet_transactions`, preventing wallet balance updates.

### 2. **Service Layer User ID Error** (Critical)
**File:** `src/lib/depositStatusChangeService.js` (lines 459)

The `wallet_transactions` insert was using `user_id: adminId` instead of the deposit owner's user ID:
```javascript
// WRONG:
user_id: adminId, // Will be the user who approved it
// RIGHT:
user_id: deposit.user_id, // The user who made the deposit
```

**Impact:** Wallet transactions were incorrectly attributed to the admin instead of the user.

### 3. **Missing Real-time Updates in UI**
**File:** `src/components/Deposits.jsx`

The Deposits component did not have a real-time subscription to deposit changes, so when an admin approved a deposit, the UI would not update immediately.

**Impact:** Users wouldn't see the status change of their deposits until they manually refreshed the page.

## Solutions Implemented

### 1. Fixed Trigger Column Names ✅
**File:** `supabase/migrations/0109_add_auto_credit_on_approved_deposits.sql`

Changed the `wallet_transactions` insert statement to use correct column names:

```sql
-- BEFORE (WRONG):
INSERT INTO wallet_transactions (
  user_id,
  wallet_id,
  transaction_type,      -- ❌ Should be 'type'
  amount,
  currency_code,
  reference_id,
  reference_type,        -- ❌ Column doesn't exist
  description,
  balance_after,
  status,                -- ❌ Column doesn't exist
  created_at
)

-- AFTER (CORRECT):
INSERT INTO wallet_transactions (
  user_id,
  wallet_id,
  type,                  -- ✅ Correct column name
  amount,
  currency_code,
  reference_id,
  description,
  balance_before,        -- ✅ Added to track full reconciliation
  balance_after
)
```

**Key Changes:**
- `transaction_type` → `type`
- Removed `reference_type` (doesn't exist in schema)
- Removed `status` and `created_at` (auto-handled by schema)
- Added `balance_before` for complete reconciliation
- Removed unnecessary `transaction_id` return handling

### 2. Fixed Service Layer User ID ✅
**File:** `src/lib/depositStatusChangeService.js` (lines 450-465)

```javascript
// BEFORE (WRONG):
const { error: txError } = await this.supabase
  .from('wallet_transactions')
  .insert([{
    wallet_id: walletId,
    user_id: adminId,  // ❌ WRONG: Admin's ID
    // ... rest of fields
  }])

// AFTER (CORRECT):
const { error: txError } = await this.supabase
  .from('wallet_transactions')
  .insert([{
    wallet_id: walletId,
    user_id: deposit.user_id,  // ✅ CORRECT: Deposit owner's ID
    // ... rest of fields
  }])
```

**Key Changes:**
- Changed `user_id: adminId` to `user_id: deposit.user_id`
- Updated transaction description formatting for consistency
- Ensured `amount` field uses `Math.abs()` for correct ledger recording

### 3. Added Real-time Subscription to Deposits ✅
**File:** `src/components/Deposits.jsx` (after line 206)

Added a new `useEffect` hook that subscribes to `postgres_changes` on the deposits table:

```javascript
// Subscribe to real-time deposit updates
useEffect(() => {
  if (!userId || userId.includes('guest')) return

  const channel = supabase
    .channel(`deposits-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'deposits',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        console.debug('[Deposits] Deposit update detected:', payload.eventType)
        // Reload deposits when any change is detected
        loadInitialData()
      }
    )
    .subscribe()

  return () => {
    channel.unsubscribe()
  }
}, [userId])
```

**Benefits:**
- When an admin approves a deposit, the status updates in real-time
- When wallet balance is updated, the UI immediately reflects the change
- No need for manual page refresh
- Works in conjunction with existing Wallet component subscriptions

## Data Flow After Fix

### Correct Deposit Approval Workflow:

1. **Admin approves deposit** via AdminDepositManager
   ```
   → depositStatusChangeService.changeDepositStatus()
   ```

2. **Service calculates wallet impact**
   ```
   → Fetches current wallet balance
   → Handles currency conversion if needed
   → Calculates balance_before and balance_after
   ```

3. **Updates SQL Atomically**
   ```
   → UPDATE wallets SET balance = balance_after
   → INSERT INTO wallet_transactions (ledger entry)
   → INSERT INTO wallet_balance_reconciliation (audit trail)
   → INSERT INTO deposit_audit_log (admin action log)
   ```

4. **Database trigger fires (backup mechanism)**
   ```
   → credit_wallet_on_deposit_approved() [UPDATED]
   → Validates wallet exists
   → Updates wallet balance
   → Records transaction (now with correct columns)
   ```

5. **Real-time UI updates**
   ```
   → postgres_changes event fired
   → Deposits component receives update
   → loadInitialData() reloads fresh data from DB
   → Wallet component updates balance
   → User sees changes immediately
   ```

## Verification Checklist

### Database Level
- [ ] Run: `SELECT * FROM wallet_transactions ORDER BY created_at DESC LIMIT 10;`
  - Verify `type` column has 'deposit' or 'deposit_reversal'
  - Verify `user_id` matches deposit owner, NOT admin
  - Verify `balance_before` and `balance_after` are populated
  
- [ ] Run: `SELECT balance FROM wallets WHERE id = '<wallet_id>';`
  - Verify balance increased by the converted deposit amount
  - Check `updated_at` timestamp is recent

- [ ] Run: `SELECT status FROM deposits WHERE id = '<deposit_id>';`
  - Verify status is 'approved'
  - Check `approved_at` is populated

### Application Level
- [ ] Wallet page (`/wallets`)
  - Open browser DevTools → Network tab
  - Approve a test deposit
  - Verify `postgres_changes` event in Supabase channel
  - Verify wallet balance updates in real-time
  - Check console logs show: `'Deposit update detected: UPDATE'`

- [ ] Deposits page (`/deposits`)
  - Check Recent Deposits table
  - Verify approved deposit shows status: 'approved'
  - Verify amount matches wallet currency conversion

- [ ] Reconciliation
  - Total deposits = SUM of approved deposits in wallet_transactions
  - Wallet balance = SUM of wallet_transactions for that wallet
  - No orphaned transactions (every transaction has matching wallet)

## Migration Notes

### For Production Deployment:
1. Deploy the migration `0109_add_auto_credit_on_approved_deposits.sql` (already fixed)
2. Deploy the service update `src/lib/depositStatusChangeService.js`
3. Deploy the UI update `src/components/Deposits.jsx`
4. Monitor logs for any errors during deposit approvals

### Backward Compatibility:
- The trigger fix uses correct column names that match the actual schema
- The service layer change only affects new transactions
- Real-time subscriptions are non-breaking additions

### Reconciliation for Past Deposits:
If wallet balances drifted before this fix, run:
```sql
-- Run as service_role user to fix any corrupted balances
SELECT reconcile_wallet_balance_from_transactions(wallet_id)
FROM wallets
WHERE user_id = '<user_id>';
```

## Testing Recommendations

### Manual Test Case:
1. Create a test user account
2. Create a PHP wallet for the user
3. Note the current wallet balance (should be 0)
4. Create a pending deposit (e.g., 1000 PHP)
5. Approve the deposit
6. **Verify in Database:**
   - Wallet balance increased to 1000
   - wallet_transactions has 1 entry with type='deposit'
   - deposit status is 'approved'
7. **Verify in UI:**
   - Deposits page shows approved status immediately
   - Wallets page shows updated balance immediately

### Automated Test Case:
```javascript
// Test in your test suite
async function testDepositApproval() {
  // 1. Create test deposit
  const deposit = await createTestDeposit(userId, 1000, 'PHP')
  
  // 2. Get wallet balance before
  const walletBefore = await getWalletBalance(walletId)
  expect(walletBefore.balance).toBe(0)
  
  // 3. Approve deposit
  const result = await depositStatusChangeService.changeDepositStatus(
    deposit.id, 
    'approved',
    { adminId: 'admin-id' }
  )
  expect(result.success).toBe(true)
  
  // 4. Verify wallet updated
  const walletAfter = await getWalletBalance(walletId)
  expect(walletAfter.balance).toBe(1000)
  
  // 5. Verify transaction recorded
  const txCount = await countWalletTransactions(walletId)
  expect(txCount).toBe(1)
  
  // 6. Verify transaction correctness
  const tx = await getLatestWalletTransaction(walletId)
  expect(tx.user_id).toBe(userId)  // NOT adminId!
  expect(tx.type).toBe('deposit')
  expect(tx.amount).toBe(1000)
  expect(tx.balance_before).toBe(0)
  expect(tx.balance_after).toBe(1000)
}
```

## Files Modified

| File | Changes | Impact |
|------|---------|--------|
| `supabase/migrations/0109_add_auto_credit_on_approved_deposits.sql` | Fixed column names in trigger | Critical - enables wallet crediting |
| `src/lib/depositStatusChangeService.js` | Fixed user_id in wallet_transactions insert | Critical - correct transaction attribution |
| `src/components/Deposits.jsx` | Added real-time subscription to deposit changes | Important - immediate UI updates |

## Summary

These fixes ensure that:
✅ Wallet balances are updated correctly when deposits are approved
✅ Wallet transactions are properly recorded with correct user attribution
✅ UI displays refresh immediately when changes occur in the database
✅ The database is the source of truth, not the UI state
✅ Complete audit trail is maintained for all wallet changes

The system now follows the principle: **UI = Reconciliation of Database Data**, not the reverse.
