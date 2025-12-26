# Deposit ID Tracking - Visual Relationships

## Schema Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                        DEPOSITS TABLE                           │
│                                                                 │
│  id (UUID, PK)                                                 │
│  user_id (FK → users)                                          │
│  wallet_id (FK → wallets)                                      │
│  amount                                                         │
│  currency_code                                                 │
│  status (pending|approved|reversed|rejected)                   │
│  created_at                                                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ ONE-TO-MANY RELATIONSHIP
                       │ NEW FOREIGN KEY: deposit_id
                       │ Constraint: ON DELETE CASCADE
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│              WALLET_TRANSACTIONS TABLE                          │
│                                                                 │
│  id (UUID, PK)                                                 │
│  wallet_id (FK → wallets)                                      │
│  user_id                                                       │
│  type (deposit_approved|deposit_reversed|balance_sync_on_del)  │
│  amount                                                         │
│  balance_before / balance_after                                │
│  reference_id (UUID)                                           │
│  deposit_id (UUID, FK → deposits.id) ← NEW COLUMN             │
│  metadata (JSONB)                                              │
│  created_at                                                    │
│                                                                 │
│  Indexes:                                                      │
│  - idx_wallet_tx_deposit_id (deposit_id)                       │
│  - idx_wallet_tx_deposit_type (deposit_id, type)               │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ BELONGS TO
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│                       WALLETS TABLE                             │
│                                                                 │
│  id (UUID, PK)                                                 │
│  user_id (FK → users)                                          │
│  currency_code                                                 │
│  balance                                                       │
│  created_at                                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Transaction Flow

### Deposit Approval Flow
```
1. Deposit Status Changes: pending → approved
   │
   ├─→ Trigger: trigger_auto_credit_on_deposit_approval()
   │
   ├─→ Call: record_ledger_transaction(
   │        p_wallet_id: deposits.wallet_id,
   │        p_user_id: deposits.user_id,
   │        p_type: 'deposit_approved',
   │        p_amount: COALESCE(received_amount, amount),
   │        p_reference_id: deposits.id,
   │        p_deposit_id: deposits.id  ← LINKS TO DEPOSIT
   │    )
   │
   ├─→ Update: wallets SET balance = balance + amount
   │
   └─→ Insert: wallet_transactions (
       wallet_id, user_id, type, amount,
       balance_before, balance_after,
       reference_id, deposit_id ← SET TO deposits.id,
       metadata, created_at
   )
```

### Deposit Deletion Flow
```
1. Delete Deposit: WHERE id = 'ABC123'
   │
   ├─→ Trigger: sync_wallet_balance_on_deposit_delete()
   │
   ├─→ Cascade Delete: DELETE FROM wallet_transactions
   │   WHERE deposit_id = 'ABC123'
   │   (FK constraint: ON DELETE CASCADE)
   │
   ├─→ Recalculate: wallet.balance = SUM(approved deposits)
   │
   └─→ Insert: wallet_transactions (
       type: 'balance_sync_on_delete',
       amount: balance_difference,
       deposit_id: NULL ← SURVIVES DELETION,
       reference_id: 'ABC123' ← TRACKS WHAT WAS DELETED,
       metadata: {
         deleted_deposit_id: 'ABC123',
         deleted_amount: <amount>,
         reason: 'Real-time balance sync on delete'
       }
   )
```

## Query Flow Examples

### Find All Transactions for a Deposit
```
Query:
  SELECT * FROM wallet_transactions
  WHERE deposit_id = 'ABC123'

Result Path:
  1. Use index: idx_wallet_tx_deposit_id
  2. Fast lookup: O(log n)
  3. Return all linked transactions
```

### Find Balance History
```
Query:
  SELECT wallet_id, balance_before, balance_after, created_at
  FROM wallet_transactions
  WHERE deposit_id = 'ABC123'
  ORDER BY created_at DESC

Result:
  wallet_tx_1: balance 9000 → 10000 (deposit_approved)
  wallet_tx_2: balance 10000 → 9000 (deposit_reversed - if applicable)
```

### Find What Happened After Deletion
```
Query:
  SELECT * FROM wallet_transactions
  WHERE type = 'balance_sync_on_delete'
  AND metadata->>'deleted_deposit_id' = 'ABC123'

Result:
  - Shows exactly what adjustment was made
  - When it happened
  - Why it happened (reason in metadata)
  - Wallet balance before/after the sync
```

## Data Integrity Guarantees

```
┌─────────────────────────────────────────────────────────────────┐
│          INTEGRITY CONSTRAINTS & GUARANTEES                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  FOREIGN KEY CONSTRAINT:                                        │
│  ├─ References: deposits.id                                     │
│  ├─ Behavior: ON DELETE CASCADE                                 │
│  └─ Result: Cannot have deposit_id pointing to non-existent dep │
│                                                                 │
│  CASCADE DELETE CHAIN:                                          │
│  ├─ deposits.id deleted                                         │
│  └─ wallet_transactions with deposit_id = deleted_id removed    │
│                                                                 │
│  AUDIT TRAIL SURVIVAL:                                          │
│  ├─ Balance sync records have deposit_id = NULL                 │
│  ├─ These records point to deleted deposit via reference_id     │
│  └─ Result: Complete deletion history preserved                 │
│                                                                 │
│  INDEX INTEGRITY:                                               │
│  ├─ idx_wallet_tx_deposit_id: O(log n) lookups                 │
│  ├─ idx_wallet_tx_deposit_type: fast type filtering             │
│  └─ Result: Consistent, fast query performance                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Field Mapping

### deposits → wallet_transactions
```
Deposit Record                    Links To                  Transaction Record
─────────────────────────────────────────────────────────────────────────────
id                           ─→  deposit_id
user_id                      ─→  user_id
wallet_id                    ─→  wallet_id
amount                       ─→  amount (for approval)
received_amount              ─→  amount (if conversion)
currency_code                ─→  metadata.currency_code
exchange_rate                ─→  metadata.exchange_rate
status                       ─→  type (pending→deposit_pending, etc)
approved_at                  ─→  created_at
```

## Backwards Compatibility Matrix

```
┌─────────────────────────────────────────────────────────────────┐
│  EXISTING CODE BEHAVIOR (After Migration)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ Existing queries:                                           │
│     SELECT * FROM wallet_transactions WHERE user_id = 'X'       │
│     → Still works (deposit_id column is nullable)               │
│                                                                 │
│  ✅ Function calls without p_deposit_id parameter:              │
│     record_ledger_transaction(wallet_id, user_id, type, ...)    │
│     → Still works (parameter is DEFAULT NULL)                   │
│                                                                 │
│  ✅ INSERT statements:                                          │
│     INSERT INTO wallet_transactions (...)                       │
│     → Still works (deposit_id is optional)                      │
│                                                                 │
│  ✅ Existing wallet_transactions rows:                          │
│     deposit_id = NULL (before migration)                        │
│     → Still valid and queryable                                 │
│                                                                 │
│  ✅ Delete operations:                                          │
│     DELETE FROM wallets WHERE id = 'X'                          │
│     → Still works (cascade still deletes transactions)          │
│                                                                 │
│  🆕 NEW - Direct deposit.id queries:                            │
│     SELECT * FROM wallet_transactions WHERE deposit_id = 'X'    │
│     → Now supported with fast index lookups                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Migration Timeline

```
Timeline:
─────────────────────────────────────────────────────────────────

Before Migration:
┌─────────────────────────────────────────┐
│ deposits (id, wallet_id, amount, ...)   │
│                                         │
└─────────────────────────────────────────┘
           ⚠️ (not linked)
                  │
┌─────────────────────────────────────────┐
│ wallet_transactions (wallet_id, type, ...) │
│ (no deposit_id column)                  │
└─────────────────────────────────────────┘

After Migration 0121:
┌─────────────────────────────────────────┐
│ deposits (id, wallet_id, amount, ...)   │
│                                         │
└─────────────────────────────────────────┘
           ✅ (linked)
                  │
┌─────────────────────────────────────────┐
│ wallet_transactions (wallet_id, type, ...) │
│ (+ deposit_id column with FK)           │
│ (+ idx_wallet_tx_deposit_id index)      │
│ (+ idx_wallet_tx_deposit_type index)    │
└─────────────────────────────────────────┘

After Migration 0122:
┌─────────────────────────────────────────┐
│ deposits (id, wallet_id, amount, ...)   │
│ (deleted)                               │
└─────────────────────────────────────────┘
           │ CASCADE DELETE
           │
┌─────────────────────────────────────────┐
│ wallet_transactions:                    │
│ - deposit_approved (deleted)            │
│ - balance_sync_on_delete (SURVIVES)     │
│ - (audit trail preserved)               │
└─────────────────────────────────────────┘
```

---

## Performance Characteristics

```
Operation                              Time Complexity    Notes
─────────────────────────────────────  ────────────────   ──────
Find all txs for deposit               O(log n)           Index
Find txs by deposit + type             O(log n)           Composite index
Count txs per deposit                  O(log n) + O(k)    Index + count
Sum amount per deposit                 O(log n) + O(k)    Index + aggregate
Query wallet balance history           O(log n) + O(k)    Index + full scan
Delete deposit (cascade)               O(k)               Cascade deletes
Create deposit approval                O(log n)           Index insert
Create balance sync                    O(log n)           Index insert

k = number of transactions per deposit (typically small)
n = total number of transactions (can be large)
→ Excellent scaling characteristics
```

---

Generated for: Deposit ID Tracking Implementation  
Purpose: Visual relationship documentation  
Usage: Architecture reference and troubleshooting guide
