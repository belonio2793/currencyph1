# Deposit ID Tracking - Quick Start

## What Was Added

Added `deposit_id` foreign key to `wallet_transactions` to track which transactions are created by deposits.

## Two Migrations Required

```bash
# Migration 1: Add column, FK, indexes, and update functions
supabase/migrations/0121_add_deposit_id_to_wallet_transactions.sql

# Migration 2: Update delete trigger for audit trail
supabase/migrations/0122_update_delete_trigger_with_deposit_id.sql
```

## Key Features

✅ **Linking**: All deposit approval/reversal transactions have `deposit_id` set  
✅ **Cascade Delete**: Deleting a deposit removes related transactions  
✅ **Audit Trail**: Balance sync records survive deletion for audit purposes  
✅ **Backwards Compatible**: Existing code continues to work  
✅ **Indexed**: Fast queries by deposit_id  

## Common Queries

### Find all transactions for a deposit
```sql
SELECT * FROM wallet_transactions 
WHERE deposit_id = '<deposit_id>'
ORDER BY created_at DESC;
```

### Find only the approval transaction
```sql
SELECT * FROM wallet_transactions 
WHERE deposit_id = '<deposit_id>' 
  AND type = 'deposit_approved';
```

### Check what happened when a deposit was deleted
```sql
SELECT * FROM wallet_transactions 
WHERE type = 'balance_sync_on_delete' 
  AND metadata->>'deleted_deposit_id' = '<deposit_id>';
```

### Verify cascade delete worked
```sql
SELECT COUNT(*) FROM wallet_transactions 
WHERE deposit_id = '<deleted_deposit_id>';
-- Should return 0
```

## What Happens When a Deposit Is Deleted

1. **Cascade Delete**: All `wallet_transactions` with `deposit_id = <id>` are deleted
2. **Sync Record**: A new `balance_sync_on_delete` transaction is created with:
   - `deposit_id = NULL` (survives deletion)
   - `reference_id = <deleted_deposit_id>` (links to what was deleted)
   - `metadata.deleted_deposit_id = <deleted_deposit_id>` (explicit tracking)

## Schema Changes

```sql
-- New column
ALTER TABLE wallet_transactions ADD COLUMN deposit_id UUID;

-- New foreign key (cascade delete)
ALTER TABLE wallet_transactions
ADD CONSTRAINT fk_wallet_transactions_deposit_id 
  FOREIGN KEY (deposit_id) REFERENCES deposits(id) ON DELETE CASCADE;

-- New indexes
CREATE INDEX idx_wallet_tx_deposit_id ON wallet_transactions(deposit_id);
CREATE INDEX idx_wallet_tx_deposit_type ON wallet_transactions(deposit_id, type);
```

## Updated Functions

### `record_ledger_transaction()`
- **New Parameter**: `p_deposit_id UUID DEFAULT NULL`
- **Change**: Now inserts `deposit_id` into wallet_transactions
- **Backwards Compatible**: Parameter is optional

### `trigger_auto_credit_on_deposit_approval()`
- **Change**: Now passes `p_deposit_id := NEW.id` when calling `record_ledger_transaction`
- **Effect**: Both `deposit_approved` and `deposit_reversed` transactions are linked to the deposit

### `sync_wallet_balance_on_deposit_delete()`
- **Change**: Explicitly sets `deposit_id = NULL` for sync transactions
- **Effect**: Audit trail survives cascade delete

## Testing the Feature

```sql
-- 1. Get a test deposit
SELECT id FROM deposits WHERE status = 'approved' LIMIT 1;

-- 2. Query its transactions
SELECT id, type, deposit_id FROM wallet_transactions 
WHERE deposit_id = '<id>';

-- 3. Delete the deposit
DELETE FROM deposits WHERE id = '<id>';

-- 4. Verify cascade worked (should be 0 rows)
SELECT COUNT(*) FROM wallet_transactions WHERE deposit_id = '<id>';

-- 5. Check audit trail created (should have 1 row)
SELECT * FROM wallet_transactions 
WHERE type = 'balance_sync_on_delete' 
  AND reference_id = '<id>';
```

## Data Integrity

- ✅ Foreign key prevents invalid `deposit_id` values
- ✅ Cascade delete removes related records automatically
- ✅ No orphaned transactions possible
- ✅ Audit trail permanently preserved
- ✅ Complete history reconstructable from metadata

## Backwards Compatibility

- ✅ Existing code works unchanged
- ✅ Optional parameter with DEFAULT NULL
- ✅ Existing wallet_transactions have NULL `deposit_id` (valid)
- ✅ New deposits get `deposit_id` populated automatically

---

**For detailed information**: See `DEPOSIT_ID_TRACKING_IMPLEMENTATION.md`
