# 🚀 Complete Wallet Recovery & Data Integrity Plan

## 📊 Current State

You cleared all `public.wallets` values and deleted `wallet_transactions`. The header is still showing corrupted amounts because it's reading from the cleared wallets table.

**Issue:** The header displays are not calculating properly; the deposit flow isn't creating wallet_transactions; metadata isn't being inserted

---

## ✅ Complete Recovery in 4 Steps

### **STEP 1: Reset & Rebuild Wallet Data** (5 minutes)

**What it does:**
- Clears any remaining corrupted wallet balances
- Deletes all existing (empty) wallet_transactions
- Rebuilds wallet_transactions from all approved deposits in the deposits table
- Recalculates correct balances
- Creates proper wallet totals

**File to run:**
```
supabase/sql/reset_and_rebuild_wallets.sql
```

**Action:**
1. Go to Supabase SQL Editor
2. Copy & paste the entire file
3. Click "RUN"
4. Watch the output - you'll see all phases complete
5. Verify: Check that wallet balances are now reasonable (not in quadrillions!)

**Expected output:**
```
═══════════════════════════════════════════════════════════
REBUILD COMPLETE!
═══════════════════════════════════════════════════════════
```

---

### **STEP 2: Fix Deposits Metadata & Structure** (3 minutes)

**What it does:**
- Ensures deposits table has all required columns (metadata, exchange_rate, received_amount, approval fields)
- Creates enhanced metadata function
- Triggers metadata insertion on deposit status changes
- Enriches all existing approved deposits with complete metadata

**File to run:**
```
supabase/sql/fix_deposits_metadata_insertion.sql
```

**Action:**
1. Go to Supabase SQL Editor
2. Copy & paste the entire file
3. Click "RUN"
4. Verify: All approved deposits should now have rich metadata

**Expected output:**
```
═══════════════════════════════════════════════════════════
DEPOSITS METADATA SETUP COMPLETE!
═══════════════════════════════════════════════════════════
```

---

### **STEP 3: Fix the Header Display** (2 minutes)

**What needs fixing:**
The Navbar currently reads `totalBalanceConverted` from App.jsx, which comes from reading the `wallets.balance` field (which is the derived/calculated field, not the source of truth).

**Update needed in:** `src/App.jsx`

**Current loadTotalBalance function (WRONG):**
```javascript
const loadTotalBalance = async (uid) => {
  // Reads wallets.balance directly - this is the problem!
  const wallets = await currencyAPI.getWallets(uid)
  const promises = (wallets || []).map(async (w) => {
    const bal = Number(w.balance || 0)
    // ... converts to PHP
  })
}
```

**Fixed loadTotalBalance function (CORRECT):**
```javascript
const loadTotalBalance = async (uid) => {
  if (!uid || uid.includes('guest-local')) {
    setTotalBalancePHP(0)
    return
  }

  try {
    // Get wallets and calculate from wallet_transactions (source of truth)
    const { data: wallets, error: walletsError } = await supabase
      .from('wallets')
      .select('id, user_id, currency_code')
      .eq('user_id', uid)

    if (walletsError || !wallets) {
      setTotalBalancePHP(0)
      return
    }

    const total = await Promise.all(
      wallets.map(async (w) => {
        try {
          // Calculate balance from wallet_transactions
          const { data: txns, error: txnError } = await supabase
            .from('wallet_transactions')
            .select('type, amount')
            .eq('wallet_id', w.id)

          if (txnError || !txns) return 0

          // Calculate: deposits + - withdrawals
          let balance = 0
          txns.forEach(tx => {
            if (['deposit_pending', 'deposit_approved', 'transfer_in', 'refund'].includes(tx.type)) {
              balance += Number(tx.amount || 0)
            } else if (['deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee'].includes(tx.type)) {
              balance -= Number(tx.amount || 0)
            }
          })

          // Convert to PHP if needed
          if (w.currency_code === 'PHP') return balance
          
          const converted = await convertCryptoToPHP(w.currency_code, balance)
          return converted
        } catch (e) {
          console.warn(`Failed to calculate balance for wallet ${w.id}:`, e.message)
          return 0
        }
      })
    )

    setTotalBalancePHP(total.reduce((sum, b) => sum + (Number(b) || 0), 0))
  } catch (err) {
    console.error('Error loading total balance:', err)
    setTotalBalancePHP(0)
  }
}
```

---

### **STEP 4: Fix the /wallets Page Display** (2 minutes)

**What needs fixing:**
The Wallet.jsx component needs to display balances calculated from wallet_transactions, not from the wallets.balance field.

**Update needed in:** `src/components/Wallet.jsx`

**Key changes:**
1. When displaying wallet balance, calculate from wallet_transactions
2. Show transaction history correctly
3. Display total_deposited and total_withdrawn correctly

**Critical function to add to walletService.js:**
```javascript
/**
 * Calculate wallet balance from transaction history
 * This is the source of truth - always use this for balance
 */
async function getWalletBalanceFromTransactions(walletId) {
  try {
    const { data: transactions, error } = await supabase
      .from('wallet_transactions')
      .select('type, amount')
      .eq('wallet_id', walletId)

    if (error) {
      console.warn('Error fetching wallet transactions:', error)
      return 0
    }

    let balance = 0
    (transactions || []).forEach(tx => {
      if (['deposit_pending', 'deposit_approved', 'transfer_in', 'refund'].includes(tx.type)) {
        balance += Number(tx.amount || 0)
      } else if (['deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee'].includes(tx.type)) {
        balance -= Number(tx.amount || 0)
      }
    })

    return balance
  } catch (err) {
    console.error('Error calculating wallet balance:', err)
    return 0
  }
}
```

Then in Wallet.jsx, use this for all balance displays instead of `wallet.balance`.

---

## 🔄 Data Flow Architecture (After Fixes)

```
User Makes a Deposit
        │
        ▼
deposits table
  ├─ id, user_id, amount, currency_code, status, ...
  └─ metadata (JSONB - conversion details, exchange rates, etc.)
        │
        ├─ On status='approved'
        │  └─ INSERT wallet_transactions entry
        │
        └─ UPDATE wallets.balance
                (via trigger + recalculation)
        │
        ▼
wallet_transactions (SOURCE OF TRUTH)
  ├─ type='deposit_approved'
  ├─ amount (what was credited)
  ├─ reference_id (links back to deposit)
  └─ created_at
        │
        ├─ Used for: Balance calculations
        ├─ Used for: Transaction history
        └─ Used for: Audit trail
        │
        ▼
wallets table (DERIVED/CACHED)
  ├─ balance (SUM of all transactions)
  ├─ total_deposited (SUM of deposits)
  ├─ total_withdrawn (SUM of withdrawals)
  └─ updated_at
        │
        ▼
Frontend displays (recalculate from transactions)
  ├─ Header: Shows calculated totals
  ├─ /wallets page: Shows individual wallet balances
  └─ Transaction history: Shows transaction list
```

---

## 🎯 Critical Principle: Source of Truth

**ALWAYS use `wallet_transactions` as the source of truth for balance**

✅ **CORRECT:**
```javascript
// Calculate balance from transactions
const balance = await getWalletBalanceFromTransactions(walletId)
```

❌ **WRONG:**
```javascript
// Don't trust the cached balance field
const balance = wallet.balance  // Could be corrupted!
```

---

## 📋 Execution Checklist

- [ ] **STEP 1:** Run `reset_and_rebuild_wallets.sql`
  - Expected: "REBUILD COMPLETE!" message
  - Verify: Check that wallet balances are now 0 or reasonable amounts

- [ ] **STEP 2:** Run `fix_deposits_metadata_insertion.sql`
  - Expected: "DEPOSITS METADATA SETUP COMPLETE!" message
  - Verify: Check that approved deposits have rich metadata

- [ ] **STEP 3:** Update `src/App.jsx` loadTotalBalance function
  - Use: wallet_transactions for balance calculation
  - Not: wallets.balance field directly
  - Test: Header should show correct totals

- [ ] **STEP 4:** Update `src/components/Wallet.jsx`
  - Use: getWalletBalanceFromTransactions() for displays
  - Update: Balance calculation throughout
  - Test: /wallets page should show correct balances

- [ ] **VERIFICATION:**
  - Header shows correct amounts (PHP and BTC reasonable)
  - /wallets page shows individual balances
  - Transaction history displays correctly
  - No "NaN" or "undefined" values in UI

---

## 🔒 Going Forward: Best Practices

### 1. **Deposit Insertion**
When a new deposit is created:
```
deposits (insert) → status='pending'
            ↓
     (user approves)
            ↓
      status='approved' → triggers:
            ├─ improve_deposit_metadata() [enriches metadata]
            ├─ trigger_auto_credit_on_deposit_approval() [creates wallet_transactions entry]
            └─ log_wallet_balance_change() [logs to audit table]
```

### 2. **Balance Calculation**
Never read balance from `wallets.balance` for critical operations:
```
Always use: SUM(wallet_transactions WHERE wallet_id = X)
Instead of: wallets.balance
```

### 3. **Wallet Metadata**
Every deposit must capture:
- Original amount & currency
- Exchange rate (if conversion)
- Received amount
- Conversion validation flag
- Approval details
- Reference information

---

## 🚨 If Something Goes Wrong

### Problem: "deposit not crediting to wallet"
**Solution:** Check that:
1. Deposit status is 'approved' (not 'pending')
2. Wallet exists for the currency
3. wallet_transactions entry was created
4. Run: `SELECT * FROM wallet_transactions WHERE reference_id = 'deposit-id'`

### Problem: "Balance still shows corrupted amount"
**Solution:**
1. Verify wallet_transactions have been populated
2. Recalculate from transactions: `SELECT SUM(...) FROM wallet_transactions`
3. Manually update wallets.balance with calculated value

### Problem: "Header shows 0.00 for everything"
**Solution:**
1. Check wallet_transactions table has entries
2. Verify deposits are 'approved' status
3. Check that currency conversion is working
4. Run verification queries from Step 1

---

## 📊 Database Validation Queries

Run these after the fixes to verify everything works:

**Check wallet balances:**
```sql
SELECT user_id, currency_code, balance, total_deposited, total_withdrawn
FROM wallets
WHERE balance != 0
ORDER BY user_id, currency_code;
```

**Check transaction count:**
```sql
SELECT COUNT(*) as transaction_count,
  COUNT(CASE WHEN type LIKE 'deposit%' THEN 1 END) as deposits,
  COUNT(CASE WHEN type = 'withdrawal' THEN 1 END) as withdrawals
FROM wallet_transactions;
```

**Check deposits with metadata:**
```sql
SELECT COUNT(*) as total,
  COUNT(CASE WHEN metadata IS NOT NULL THEN 1 END) as with_metadata
FROM deposits
WHERE status = 'approved';
```

**Check for balance mismatches:**
```sql
SELECT w.id, w.currency_code, w.balance,
  COALESCE(SUM(CASE
    WHEN wt.type IN ('deposit_approved') THEN wt.amount
    WHEN wt.type IN ('withdrawal') THEN -wt.amount
    ELSE 0
  END), 0) as calculated
FROM wallets w
LEFT JOIN wallet_transactions wt ON wt.wallet_id = w.id
GROUP BY w.id, w.currency_code, w.balance
HAVING ABS(w.balance - COALESCE(SUM(...), 0)) >= 0.01;
```

---

## 🎓 Key Learnings

1. **Derived vs Source:** wallets.balance is derived, wallet_transactions is source
2. **Always Verify:** When reading balances, recalculate from transactions
3. **Metadata is Critical:** Store full context (exchange rates, approvals, etc.)
4. **Audit Trail:** Log all balance changes for forensics
5. **Constraints Help:** Database constraints prevent impossible values

---

**Status:** Ready to execute
**Time estimate:** 12 minutes total (4 steps × 3 minutes each)
**Risk level:** Low (immutable transactions, multiple verification points)

---

**Next:** Run STEP 1 now!
