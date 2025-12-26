# Deposit ID Tracking - Deployment Guide

## Overview
This guide walks through applying the deposit_id tracking feature to your database.

**Estimated Time**: 5-10 minutes  
**Risk Level**: Low  
**Reversible**: Yes (rollback instructions included)

---

## Prerequisites

✅ Check you have these:
- PostgreSQL client (psql) installed
- Database connection configured
- Migrations exist at the paths mentioned
- Backup of your database (recommended)

---

## Option 1: Using Bash Script (Recommended)

### Step 1: Make script executable
```bash
chmod +x DEPLOY_DEPOSIT_TRACKING.sh
```

### Step 2: Run the deployment script
```bash
bash DEPLOY_DEPOSIT_TRACKING.sh
```

**Output should look like:**
```
==========================================
Deposit ID Tracking Deployment
==========================================

Step 1: Applying migration 0121...
   - Adding deposit_id column to wallet_transactions
   - Creating foreign key constraint
   - Creating performance indexes
   - Updating record_ledger_transaction() function
   - Updating trigger_auto_credit_on_deposit_approval() trigger

✅ Migration 0121 applied successfully!

Step 2: Applying migration 0122...
   - Updating sync_wallet_balance_on_deposit_delete() function
   - Preserving audit trail on deposit deletion
   - Setting deposit_id = NULL for sync records

✅ Migration 0122 applied successfully!

==========================================
✅ Deployment Complete!
==========================================
```

---

## Option 2: Manual psql Commands

### Step 1: Apply migration 0121
```bash
psql < supabase/migrations/0121_add_deposit_id_to_wallet_transactions.sql
```

**Wait for it to complete.** You should see:
```
BEGIN
ALTER TABLE
ALTER TABLE
CREATE INDEX
CREATE INDEX
CREATE OR REPLACE FUNCTION
CREATE OR REPLACE FUNCTION
COMMENT ON COLUMN
COMMENT ON INDEX
COMMENT ON INDEX
COMMIT
```

### Step 2: Apply migration 0122
```bash
psql < supabase/migrations/0122_update_delete_trigger_with_deposit_id.sql
```

**Wait for it to complete.** You should see:
```
BEGIN
CREATE OR REPLACE FUNCTION
SELECT
COMMIT
```

---

## Option 3: With Database Credentials

If your database requires explicit credentials:

```bash
# Set environment variables
export PGHOST=localhost
export PGPORT=5432
export PGUSER=postgres
export PGPASSWORD=your_password
export PGDATABASE=your_database

# Run migrations
psql < supabase/migrations/0121_add_deposit_id_to_wallet_transactions.sql
psql < supabase/migrations/0122_update_delete_trigger_with_deposit_id.sql
```

Or pass them inline:
```bash
psql -h localhost -p 5432 -U postgres -d your_database < supabase/migrations/0121_add_deposit_id_to_wallet_transactions.sql
psql -h localhost -p 5432 -U postgres -d your_database < supabase/migrations/0122_update_delete_trigger_with_deposit_id.sql
```

---

## Verification Steps

After running the migrations, verify everything worked:

### Step 1: Check column exists
```bash
psql -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'deposit_id';"
```

**Expected output:**
```
 column_name | data_type
─────────────┼───────────
 deposit_id  | uuid
```

### Step 2: Check foreign key constraint
```bash
psql -c "SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'wallet_transactions' AND constraint_name = 'fk_wallet_transactions_deposit_id';"
```

**Expected output:**
```
         constraint_name
─────────────────────────────────────────
 fk_wallet_transactions_deposit_id
```

### Step 3: Check indexes
```bash
psql -c "SELECT indexname FROM pg_indexes WHERE tablename = 'wallet_transactions' AND indexname LIKE 'idx_wallet_tx_deposit%';"
```

**Expected output:**
```
       indexname
──────────────────────────────
 idx_wallet_tx_deposit_id
 idx_wallet_tx_deposit_type
```

### Step 4: Quick functionality test
```bash
psql -c "SELECT COUNT(*) as deposit_linked_transactions FROM wallet_transactions WHERE deposit_id IS NOT NULL;"
```

**Expected**: Count > 0 for new deposits, 0 for existing deposits (that's normal)

---

## Troubleshooting

### Error: "relation wallet_transactions does not exist"
**Solution**: Make sure you're connecting to the correct database
```bash
psql -d your_database < supabase/migrations/0121_add_deposit_id_to_wallet_transactions.sql
```

### Error: "permission denied"
**Solution**: You need higher privileges. Try as superuser:
```bash
psql -U postgres < supabase/migrations/0121_add_deposit_id_to_wallet_transactions.sql
```

### Error: "constraint already exists"
**Solution**: This is safe - it means the migration was already applied
```sql
-- Check if constraint exists
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'wallet_transactions' 
  AND constraint_name = 'fk_wallet_transactions_deposit_id';
```

### Migrations failed midway
**Solution**: Roll back and retry (see Rollback section below)

---

## Rollback (if needed)

**⚠️ Only do this if migrations fail or you need to undo.**

```sql
-- Drop the new constraint and column
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS fk_wallet_transactions_deposit_id;
ALTER TABLE wallet_transactions DROP COLUMN IF EXISTS deposit_id;

-- Drop the indexes
DROP INDEX IF EXISTS idx_wallet_tx_deposit_id;
DROP INDEX IF EXISTS idx_wallet_tx_deposit_type;
```

Then run the migrations again from the start.

---

## Testing the Feature

### Test 1: Find deposit transactions
```sql
SELECT id, wallet_id, type, deposit_id 
FROM wallet_transactions 
WHERE deposit_id IS NOT NULL 
LIMIT 5;
```

### Test 2: Find transactions for a specific deposit
```sql
-- First, get a deposit ID
SELECT id FROM deposits WHERE status = 'approved' LIMIT 1;

-- Then query its transactions
SELECT * FROM wallet_transactions 
WHERE deposit_id = '<deposit_id>'
ORDER BY created_at DESC;
```

### Test 3: Test cascade delete
```sql
-- Get a deposit to test with
SELECT id, wallet_id FROM deposits WHERE status = 'approved' LIMIT 1;

-- Count its transactions before delete
SELECT COUNT(*) as tx_before FROM wallet_transactions 
WHERE deposit_id = '<deposit_id>';

-- Delete it
DELETE FROM deposits WHERE id = '<deposit_id>';

-- Check cascade worked (should be 0)
SELECT COUNT(*) as tx_after FROM wallet_transactions 
WHERE deposit_id = '<deposit_id>';

-- Check audit trail exists
SELECT * FROM wallet_transactions 
WHERE type = 'balance_sync_on_delete' 
  AND reference_id = '<deleted_deposit_id>';
```

---

## Post-Deployment

### ✅ Checklist
- [ ] Both migrations applied successfully
- [ ] Verification commands all returned expected results
- [ ] No errors in database logs
- [ ] Application still functioning normally
- [ ] Database backup verified (optional but recommended)

### 📝 Documentation Update
- [ ] Update API docs to mention `deposit_id` field
- [ ] Update DB schema documentation
- [ ] Notify team about new feature
- [ ] Update admin tools if applicable

### 🔍 Monitoring
- [ ] Monitor database performance
- [ ] Check application error logs
- [ ] Verify queries using new indexes run fast
- [ ] Monitor disk space (new indexes take space)

---

## Success Criteria

✅ You're successful when:
1. Both migrations completed without errors
2. All verification queries return expected results
3. New deposit transactions have `deposit_id` populated
4. Cascade delete removes related transactions
5. Balance sync records are created with `deposit_id = NULL`
6. Application continues to function normally

---

## Next Steps

Now that deployment is complete:

1. **Read the documentation**:
   - `DEPOSIT_ID_TRACKING_QUICK_START.md` - Quick reference
   - `DEPOSIT_ID_TRACKING_IMPLEMENTATION.md` - Detailed specs

2. **Use the new feature**:
   - See `DEPOSIT_TRACKING_INDEX.md` for query examples
   - Try the verification steps above

3. **Monitor performance**:
   - Check that indexes are being used
   - Monitor slow query logs

4. **Update systems**:
   - Notify team members
   - Update documentation
   - Update admin tools if needed

---

## Support

**Questions?**
- See `DEPOSIT_TRACKING_INDEX.md` for documentation index
- See `DEPOSIT_ID_TRACKING_DIAGRAM.md` for visual diagrams
- Review migration files for detailed comments

**Issues?**
- Check troubleshooting section above
- Review database logs for error details
- Contact database administrator if needed

---

## Summary

| Item | Status |
|------|--------|
| Migration 0121 | Applied ✅ |
| Migration 0122 | Applied ✅ |
| Verification | Complete ✅ |
| Feature | Active ✅ |
| Documentation | Available ✅ |

**You're all set!** The deposit_id tracking feature is now live on your database.

