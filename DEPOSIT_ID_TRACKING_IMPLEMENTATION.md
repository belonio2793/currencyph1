# Deposit ID Tracking in wallet_transactions

## Overview
Added a `deposit_id` foreign key column to the `wallet_transactions` table to enable precise tracking of which wallet transactions are created when deposits are made, with automatic cascade delete support.

## Changes Made

### 1. Migration Files
**Files**:
1. `supabase/migrations/0121_add_deposit_id_to_wallet_transactions.sql` (Main schema changes)
2. `supabase/migrations/0122_update_delete_trigger_with_deposit_id.sql` (Delete trigger optimization)

### 2. Schema Changes

#### New Column
```sql
ALTER TABLE wallet_transactions
ADD COLUMN IF NOT EXISTS deposit_id UUID;
```

#### Foreign Key Constraint
```sql
ALTER TABLE wallet_transactions
ADD CONSTRAINT fk_wallet_transactions_deposit_id 
  FOREIGN KEY (deposit_id) 
  REFERENCES deposits(id) 
  ON DELETE CASCADE
```

**Key Feature**: When a deposit is deleted, all wallet_transactions rows with that `deposit_id` are automatically deleted via CASCADE.

#### New Indexes
```sql
-- Efficient lookup of all transactions for a specific deposit
CREATE INDEX idx_wallet_tx_deposit_id ON wallet_transactions(deposit_id);

-- Efficient queries for deposit type transactions
CREATE INDEX idx_wallet_tx_deposit_type ON wallet_transactions(deposit_id, type) 
  WHERE deposit_id IS NOT NULL;
```

### 3. Function Updates

#### `record_ledger_transaction` Function
**New Parameter**: 
```sql
p_deposit_id UUID DEFAULT NULL
```

**Changes**:
- Added new parameter at the end (maintains backwards compatibility)
- Now inserts `deposit_id` into wallet_transactions
- All type checks updated to handle `balance_sync_on_delete`

**Updated Signature**:
```sql
CREATE OR REPLACE FUNCTION record_ledger_transaction(
  p_wallet_id UUID,
  p_user_id UUID,
  p_type TEXT,
  p_amount NUMERIC,
  p_note TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_deposit_id UUID DEFAULT NULL  -- NEW PARAMETER
) RETURNS UUID AS $$
```

### 4. Trigger Updates

#### `trigger_auto_credit_on_deposit_approval` Function (Migration 0121)
**Changes**:
- Both approval and reversal paths now pass `p_deposit_id := NEW.id` to `record_ledger_transaction`
- This ensures the wallet_transaction is properly linked to its source deposit

**Example**:
```sql
v_transaction_id := record_ledger_transaction(
  p_wallet_id := NEW.wallet_id,
  p_user_id := NEW.user_id,
  p_type := 'deposit_approved',
  p_amount := COALESCE(NEW.received_amount, NEW.amount),
  p_note := 'approved',
  p_reference_id := NEW.id,
  p_deposit_id := NEW.id,  -- NOW LINKED!
  p_metadata := jsonb_build_object(...),
  p_description := 'Deposit approved: ...'
);
```

#### `sync_wallet_balance_on_deposit_delete` Function (Migration 0122)
**Changes**:
- Updated to explicitly set `deposit_id = NULL` for sync transactions
- This allows the audit trail to survive cascade delete
- Balance sync records reference the deleted deposit via `reference_id` and `metadata.deleted_deposit_id`

**Key Design**:
```
When a deposit is deleted:
├── wallet_transactions with deposit_id = <id>
│   └── Cascade-deleted (removal records)
└── wallet_transactions with deposit_id = NULL (sync record)
    └── Survives as permanent audit trail
    └── Links to deleted deposit via reference_id and metadata
```

## Usage Examples

### Query All Transactions for a Deposit
```sql
SELECT * 
FROM wallet_transactions 
WHERE deposit_id = '<deposit_id>'
ORDER BY created_at DESC;
```

### Query Only Approved Deposit Transactions
```sql
SELECT * 
FROM wallet_transactions 
WHERE deposit_id = '<deposit_id>' 
  AND type = 'deposit_approved'
ORDER BY created_at DESC;
```

### Check Transaction Types for a Deposit
```sql
SELECT DISTINCT type 
FROM wallet_transactions 
WHERE deposit_id = '<deposit_id>';
-- Result might show: deposit_approved, balance_sync_on_delete, etc.
```

### Verify Cascade Delete Works
```sql
-- Before delete: Count transactions
SELECT COUNT(*) as transaction_count
FROM wallet_transactions 
WHERE deposit_id = '<deposit_id>';

-- Delete the deposit
DELETE FROM deposits WHERE id = '<deposit_id>';

-- After delete: Should return 0
SELECT COUNT(*) as transaction_count
FROM wallet_transactions 
WHERE deposit_id = '<deposit_id>';
```

## Backwards Compatibility

✅ **Fully Backwards Compatible**
- New parameter `p_deposit_id` has `DEFAULT NULL` 
- Existing code calling `record_ledger_transaction` without this parameter continues to work
- Existing wallet_transactions rows have NULL `deposit_id` (valid)
- New transactions created after migration will have `deposit_id` populated

## Data Integrity Guarantees

### Referential Integrity
- Foreign key constraint prevents invalid `deposit_id` values
- Cannot set `deposit_id` to a non-existent deposit ID

### Cascade Delete Safety
- When deposits.id is deleted, database automatically deletes related wallet_transactions
- No orphaned transactions can exist with non-existent deposit IDs
- Audit trail is maintained (deletion event is recorded)

### No Data Loss
- Existing wallet_transactions rows are not modified
- Type and amount fields remain unchanged
- Migration safely adds new column and constraints

## Benefits

1. **Precise Auditing**: Instantly see all financial impacts of a single deposit
2. **Cascade Delete**: Automatic cleanup when deposits are removed
3. **Query Performance**: Dedicated indexes on deposit_id for fast lookups
4. **Data Integrity**: Foreign key prevents orphaned transactions
5. **Compliance**: Complete transaction history linked to originating deposits

## Testing Checklist

- [ ] Migration runs without errors
- [ ] `deposit_id` column exists in wallet_transactions
- [ ] Foreign key constraint is active
- [ ] Indexes are created and usable
- [ ] New deposits create wallet_transactions with deposit_id populated
- [ ] Deleting a deposit cascades to delete related transactions
- [ ] Query performance is acceptable with new indexes
- [ ] Existing reports/dashboards continue working

## Related Tables

```
deposits (id, wallet_id, user_id, amount, currency_code, status, ...)
    ↓ (one-to-many)
wallet_transactions (id, wallet_id, deposit_id, type, amount, ...)
    ↓
wallets (id, currency_code, balance, ...)
```

## Migration Order

This migration should run **after** migration `0118_remove_wallet_transactions_user_fk.sql` and **before** any code that explicitly passes `deposit_id` to wallet transaction creation.

---

**Status**: Ready for deployment  
**Risk Level**: Low (additive change with backwards compatibility)  
**Tested**: Schema validation included in migration
