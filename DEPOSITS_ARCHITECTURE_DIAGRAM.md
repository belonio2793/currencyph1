# Deposits Balance System - Architecture Diagram

## 📐 System Architecture (BEFORE FIX)

```
┌─────────────────────────────────────────────────────────────┐
│                     USER DEPOSITS                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   deposits table             │
        │  ├─ id                       │
        │  ├─ user_id                  │
        │  ├─ amount                   │
        │  ├─ currency_code            │
        │  ├─ status                   │
        │  └─ metadata (EMPTY! ❌)     │
        └──────┬───────────────────────┘
               │
               │ Approval Trigger
               ▼
        ┌──────────────────────────────┐
        │ wallet_transactions table     │
        │ (SOURCE OF TRUTH ✅)          │
        │  ├─ id                       │
        │  ├─ wallet_id                │
        │  ├─ type                     │
        │  ├─ amount                   │
        │  ├─ reference_id             │
        │  └─ balance_after            │
        └──────┬───────────────────────┘
               │
               │ [PROBLEM: Balance update not validated!]
               ▼
        ┌──────────────────────────────┐
        │   wallets table              │
        │  ├─ id                       │
        │  ├─ user_id                  │
        │  ├─ balance (❌ CORRUPTED!)  │
        │  ├─ currency_code            │
        │  └─ updated_at               │
        └──────────────────────────────┘

        ⚠️ ISSUES:
        • balance field updated without validation
        • No reconciliation mechanism
        • No audit trail
        • No metadata capture
        • No constraints to prevent corruption
```

---

## 📐 System Architecture (AFTER FIX)

```
┌─────────────────────────────────────────────────────────────┐
│                     USER DEPOSITS                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   deposits table             │
        │  ├─ id                       │
        │  ├─ user_id                  │
        │  ├─ amount                   │
        │  ├─ currency_code            │
        │  ├─ status                   │
        │  └─ metadata (RICH! ✅)      │
        │     ├─ exchange_rate         │
        │     ├─ conversion_valid      │
        │     ├─ received_amount       │
        │     └─ approval_details      │
        └──────┬───────────────────────┘
               │
               │ Approval Trigger
               │ + improve_deposit_metadata() [NEW ✅]
               ▼
        ┌──────────────────────────────┐
        │ wallet_transactions table     │
        │ (SOURCE OF TRUTH ✅)          │
        │  ├─ id                       │
        │  ├─ wallet_id                │
        │  ├─ type                     │
        │  ├─ amount                   │
        │  ├─ reference_id             │
        │  └─ balance_after            │
        └──────┬───────────────────────┘
               │
               │ Balance Update
               │ + log_wallet_balance_change() [NEW ✅]
               ▼
        ┌──────────────────────────────┐
        │   wallets table              │
        │  ├─ id                       │
        │  ├─ user_id                  │
        │  ├─ balance (✅ VERIFIED!)   │
        │  ├─ currency_code            │
        │  ├─ CHECK constraint ✅      │
        │  └─ updated_at               │
        └──────┬───────────────────────┘
               │
               ▼
        ┌──────────────────────────────┐
        │ wallet_balance_audit [NEW ✅]│
        │  ├─ id                       │
        │  ├─ wallet_id                │
        │  ├─ balance_before           │
        │  ├─ balance_after            │
        │  ├─ change_reason            │
        │  └─ created_at               │
        └──────────────────────────────┘

        ✅ IMPROVEMENTS:
        • Metadata captured automatically
        • Balance validated via constraint
        • Audit trail of all changes
        • Reconciliation functions available
        • Deposit metadata enriched
```

---

## 🔧 Reconciliation Functions

```
REQUEST: "Is this wallet's balance correct?"
        │
        ▼
reconcile_wallet_balance(wallet_id)  [NEW ✅]
        │
        ├─ Get actual balance from wallets table
        │
        ├─ Calculate balance from wallet_transactions:
        │  ├─ deposits_approved: +amount
        │  ├─ withdrawals: -amount
        │  ├─ transfers_in: +amount
        │  ├─ transfers_out: -amount
        │  └─ adjustments: ±amount
        │
        ├─ Compare: actual vs calculated
        │
        └─ RETURN:
           ├─ actual_balance
           ├─ calculated_balance
           ├─ discrepancy
           └─ is_valid (TRUE if < $0.01 difference)
```

---

## 🔨 Fix Functions

```
REQUEST: "Fix a corrupted wallet"
        │
        ├─ OPTION A: Single Wallet
        │  └─ fix_wallet_balance(wallet_id)  [NEW ✅]
        │     ├─ Calculate correct balance from transactions
        │     ├─ Update wallets.balance if discrepancy >= $0.01
        │     ├─ Log change in wallet_balance_audit
        │     └─ RETURN: old_balance, new_balance, fixed flag
        │
        └─ OPTION B: All Corrupted Wallets
           └─ fix_all_corrupted_wallets()  [NEW ✅]
              ├─ Find suspicious wallets
              │  ├─ BTC > 1,000,000
              │  └─ PHP > 10,000,000,000
              ├─ Fix each one using fix_wallet_balance
              └─ RETURN: total_checked, wallets_fixed, wallets_in_sync
```

---

## 📊 Data Flow with Fix

### Scenario: User deposits 10,000 PHP, converts to BTC

```
STEP 1: User initiates deposit
┌────────────────────────────────┐
│ deposits table INSERT          │
│ ├─ id: 'cbf899c8...'          │
│ ├─ user_id: 'user-123'        │
│ ├─ amount: 10000              │
│ ├─ currency_code: 'PHP'       │
│ └─ status: 'pending'          │
└────────────────────────────────┘

STEP 2: Admin approves deposit
┌────────────────────────────────┐
│ deposits table UPDATE          │
│ └─ status: 'pending' → 'approved'
└────────────────────────────────┘
        │
        ▼
        Trigger: trigger_auto_credit_on_deposit_approval()
        Trigger: improve_deposit_metadata()  [NEW ✅]
        │
        ├─ Creates wallet_transactions entry
        │  └─ type: 'deposit_approved'
        │  └─ amount: 10000
        │  └─ currency_code: 'PHP'
        │
        ├─ Enriches deposits.metadata  [NEW ✅]
        │  └─ exchange_rate, received_amount, etc.
        │
        └─ Updates wallets.balance
           └─ PHP wallet: +10000

STEP 3: Auto-audit (NEW ✅)
┌────────────────────────────────┐
│ wallet_balance_audit INSERT    │
│ ├─ wallet_id                   │
│ ├─ balance_before: 0           │
│ ├─ balance_after: 10000        │
│ ├─ change_reason: 'balance_update'
│ └─ created_at: NOW()           │
└────────────────────────────────┘

STEP 4: Verify (can run anytime)
┌────────────────────────────────┐
│ SELECT * FROM                  │
│ reconcile_wallet_balance(wallet_id)
│                                │
│ RETURN:                        │
│ ├─ actual_balance: 10000       │
│ ├─ calculated_balance: 10000   │
│ ├─ discrepancy: 0              │
│ └─ is_valid: TRUE ✅           │
└────────────────────────────────┘
```

---

## 🚨 What Happens Without the Fix

```
Without reconciliation functions:

User's PHP wallet balance: 5,179,990,012,320,011.00
User's BTC wallet balance: 10,186,804,350,678,487,000.00

When querying:
  SELECT balance FROM wallets WHERE user_id = 'user-123'
  
Returns: Impossible corrupted values
  - Can't withdraw (balance is wrong)
  - Can't see accurate portfolio (shows trillions)
  - Can't debug (no audit trail)
  - Can't fix (no reconciliation function)
```

---

## ✅ What Happens With the Fix

```
With reconciliation functions:

1. DIAGNOSE:
   SELECT * FROM reconcile_wallet_balance(wallet_id);
   
   Returns:
   - actual_balance: 5,179,990,012,320,011.00
   - calculated_balance: 10000 (from transactions)
   - discrepancy: 5,179,990,012,320,001.00
   - is_valid: FALSE ❌

2. FIX:
   SELECT * FROM fix_wallet_balance(wallet_id);
   
   Updates wallet to: 10000 (correct value)
   
3. VERIFY:
   SELECT * FROM reconcile_wallet_balance(wallet_id);
   
   Returns:
   - actual_balance: 10000
   - calculated_balance: 10000
   - discrepancy: 0
   - is_valid: TRUE ✅

4. AUDIT TRAIL:
   SELECT * FROM wallet_balance_audit 
   WHERE wallet_id = 'wallet-id'
   
   Shows: 5,179,990,012,320,011.00 → 10000
```

---

## 🔒 Validation Layers

```
LAYER 1: Database Constraints [NEW ✅]
┌─────────────────────────────────────────┐
│ CHECK (                                 │
│   (currency = 'BTC' AND balance < 21M) │
│   OR (currency = 'PHP' AND balance < 999B)
│ )                                       │
│                                         │
│ Prevents: Impossible balances           │
│ Rejects: BTC > 21M, PHP > 999B         │
└─────────────────────────────────────────┘

LAYER 2: Reconciliation Functions [NEW ✅]
┌─────────────────────────────────────────┐
│ reconcile_wallet_balance() can detect   │
│ any mismatch between:                   │
│  actual balance (wallets table)         │
│  vs calculated (wallet_transactions)    │
└─────────────────────────────────────────┘

LAYER 3: Audit Trail [NEW ✅]
┌─────────────────────────────────────────┐
│ Every balance change logged in          │
│ wallet_balance_audit table              │
│                                         │
│ Allows forensics if something goes wrong│
└─────────────────────────────────────────┘

LAYER 4: Metadata Enrichment [NEW ✅]
┌─────────────────────────────────────────┐
│ Deposit metadata captures:              │
│  - Exchange rates                       │
│  - Conversion amounts                   │
│  - Validation flags                     │
│  - Approval details                     │
│                                         │
│ Helps identify where corruption started│
└─────────────────────────────────────────┘
```

---

## 🎯 Function Call Hierarchy

```
User wants to fix corrupt wallet
        │
        ▼
fix_wallet_balance(wallet_id)
        │
        ├─ SELECT balance FROM wallets WHERE id = wallet_id
        │  (Get current corrupted balance)
        │
        ├─ SELECT SUM(...) FROM wallet_transactions
        │  (Calculate correct balance from transactions)
        │
        ├─ IF discrepancy >= 0.01 THEN
        │  │
        │  ├─ UPDATE wallets SET balance = calculated
        │  │  (Update the corrupted balance)
        │  │
        │  └─ TRIGGER: log_wallet_balance_change()
        │     │
        │     └─ INSERT INTO wallet_balance_audit
        │        (Log the change for audit trail)
        │
        └─ RETURN (old_balance, new_balance, fixed=TRUE)
```

---

## 📈 System Evolution

```
TIMELINE:

Version 1.0 (Original - BROKEN ❌)
├─ deposits → wallet_transactions → wallets
├─ NO reconciliation
├─ NO audit trail
└─ NO metadata

Version 2.0 (With Fix - FIXED ✅)
├─ deposits [+ metadata trigger]
├─ wallet_transactions [source of truth]
├─ wallets [+ constraint, + audit trigger]
├─ wallet_balance_audit [NEW - audit trail]
├─ 3 new reconciliation functions
└─ Self-healing via fix functions
```

---

## 🚀 Quick Reference

| Component | Before | After |
|-----------|--------|-------|
| **Metadata** | None | Rich JSONB with all details |
| **Validation** | None | CHECK constraint on balance |
| **Audit Trail** | None | wallet_balance_audit table |
| **Diagnostics** | None | reconcile_wallet_balance() |
| **Repair** | Manual SQL | fix_wallet_balance() |
| **Bulk Fix** | Impossible | fix_all_corrupted_wallets() |

---

**Status:** ✅ Architecture designed and implemented
**Readiness:** 100% - Ready for deployment
