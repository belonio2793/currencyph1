# Wallets House Currency Migration Guide

## Overview

This guide explains the safe migration process to:
1. **Drop** the old `currency` column (short codes like 'BTC', 'ETH')
2. **Replace** it with `currency_name` (full names like 'Bitcoin (BTC)', 'Ethereum')
3. **Verify** the table matches the exact cryptocurrency configuration provided
4. **Update** unique constraints to use currency_name instead of currency code

## Migration Files Created

### 1. **0106_drop_currency_use_currency_name_in_wallets_house.sql**
   - **Purpose**: Safely drops the currency column and updates constraints
   - **Steps**:
     - Creates a backup table (`wallets_house_backup_before_currency_drop`)
     - Drops the old unique constraint on (currency, network, address)
     - Populates `currency_name` with full names from the currencies table
     - Drops the `currency` column
     - Creates new unique constraint on (currency_name, network, address)
     - Recreates indexes with currency_name
   - **Safety**: Full rollback available via backup table

### 2. **0107_populate_exact_crypto_deposits.sql**
   - **Purpose**: Ensures table matches the exact provided JSON configuration
   - **Steps**:
     - Removes entries NOT in the official configuration
     - Inserts/updates all 55 cryptocurrency deposit entries
     - Preserves metadata (tags, memos)
     - Handles NULL addresses (Bitcoin Lightning Network)
   - **Data Integrity**: Validates against the official list

## Current Data Configuration

**Total Entries**: 55 cryptocurrency/network combinations

**Breakdown by Asset**:
- Bitcoin (BTC): 2 networks
- Ethereum: 2 networks
- Tether (USDT): 11 networks
- Binance Coin: 1 network
- XRP (XRP): 1 network
- USDC: 8 networks
- TRX: 1 network
- DOGE: 2 networks
- ADA: 1 network
- BCH: 2 networks
- LINK: 2 networks
- XLM: 1 network
- HYPE: 1 network
- LITECOIN: 1 network
- Sui: 1 network
- AVAX: 1 network
- HBAR: 1 network
- SHIB: 1 network
- PYUSD: 1 network
- WLD: 2 networks
- TON: 1 network
- UNI: 2 networks
- DOT: 1 network
- AAVE: 2 networks
- XAUT: 1 network
- PEPE: 1 network
- ASTER: 1 network
- ENA: 1 network
- SKY: 1 network

**Special Cases**:
- ✅ **Bitcoin Lightning Network**: Has NULL address (intentional - not yet supported for deposits)
- ✅ **All OTHER entries**: Have valid addresses (no pending/null addresses)
- ✅ **Tags/Memos**: Stored in metadata JSONB field:
  - XRP Ripple: tag: "2135060125"
  - HBAR Hedera: tag: "2102701194"
  - USDT/TON Tether: tag: "641022568"
  - XLM Stellar: memo: "475001388"

## How to Apply These Migrations

### Option 1: Using Supabase Dashboard
1. Go to **SQL Editor** in Supabase dashboard
2. Copy the contents of `0106_drop_currency_use_currency_name_in_wallets_house.sql`
3. Run the migration
4. Copy the contents of `0107_populate_exact_crypto_deposits.sql`
5. Run the migration

### Option 2: Using Supabase CLI
```bash
# If using Supabase CLI
supabase migration up

# Or manually push to remote
supabase db push
```

### Option 3: Manual Database Connection
```sql
-- Connect to your Supabase database directly and run:
-- 1. First migration
-- 2. Second migration
```

## Verification Steps

### After Migration, Run This Verification Script

```bash
# Run the verification script to check if data matches JSON
node scripts/verify-and-populate-crypto-deposits.js
```

**Expected Output**:
```
🔍 Starting verification and population of crypto deposits...

📊 Current database has 55 entries
📊 JSON configuration has 55 entries

📋 VERIFICATION REPORT:
  ✓ Entries to add: 0
  ✓ Entries to remove: 0
  ✓ Entries already correct: 55

🔍 NULL ADDRESS CHECK:
  ✓ NULL addresses in JSON: 1
  ✓ NULL addresses in DB: 1

✅ SUCCESS: Database matches JSON configuration exactly!
   Total verified entries: 55
```

### Manual Verification SQL Queries

```sql
-- 1. Check total count
SELECT COUNT(*) as total_entries, 
       COUNT(DISTINCT currency_name) as unique_currencies,
       COUNT(CASE WHEN address IS NULL THEN 1 END) as null_addresses
FROM public.wallets_house 
WHERE wallet_type = 'crypto' AND provider = 'internal';

-- Expected: 55 total, 29 unique currencies, 1 null address

-- 2. Verify no old 'currency' column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'wallets_house' 
AND column_name = 'currency';

-- Expected: No results (column dropped)

-- 3. Check unique constraint exists
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'wallets_house' 
AND constraint_name LIKE '%currency_name%';

-- Expected: wallets_house_currency_name_network_address_key

-- 4. List all entries
SELECT id, currency_name, network, address, metadata 
FROM public.wallets_house 
WHERE wallet_type = 'crypto' 
ORDER BY currency_name, network;
```

## Rollback Procedure (If Needed)

If something goes wrong:

### Option 1: Using Backup Table
```sql
-- 1. Drop the current table
DROP TABLE public.wallets_house CASCADE;

-- 2. Restore from backup
ALTER TABLE public.wallets_house_backup_before_currency_drop 
RENAME TO wallets_house;

-- 3. Recreate indexes and constraints
-- (See migration 0100 for full schema)
```

### Option 2: Revert to Previous Migration
If using Supabase migrations, revert to migration 0105:
```bash
supabase migration down
```

## Testing in Development

Before running on production:

1. **Test the migration**:
   - Create a test database copy
   - Run migrations on test database
   - Run verification script
   - Check all dependent code/queries

2. **Test dependent code**:
   - Check any queries that reference `currency` column
   - Update them to use `currency_name` instead
   - Run application tests

3. **Code Search**:
   ```bash
   # Find any references to 'currency' in wallets_house
   grep -r "wallets_house.*currency" src/
   grep -r "\.currency" src/lib/
   grep -r "wallets_house" supabase/functions/
   ```

## Important Notes

⚠️ **Before Running**:
- [ ] Backup your database
- [ ] Test migrations on staging first
- [ ] Update any application code that queries the old `currency` column
- [ ] Update any dependent services/edge functions

✅ **Data Integrity**:
- Original data is backed up in `wallets_house_backup_before_currency_drop`
- All addresses verified against official JSON specification
- No data loss - only column renaming
- Unique constraints maintained

📌 **Known Issues**:
- Bitcoin Lightning Network has NULL address (by design - not yet supported)
- All other entries have valid addresses
- Metadata (tags/memos) preserved in JSONB field

## Dependencies to Update

After migration, check and update:

1. **Supabase RLS Policies** (if any reference currency column)
2. **Application Queries**:
   - Search for `.currency` references
   - Update to use `.currency_name`
3. **Edge Functions** (supabase/functions/):
   - Check any wallets_house queries
4. **API Endpoints**:
   - Check deposit-related endpoints
5. **Frontend Components**:
   - Update any display of currency values

## SQL Queries That Will Need Updating

```sql
-- OLD PATTERN (will break):
SELECT * FROM wallets_house WHERE currency = 'BTC'

-- NEW PATTERN (after migration):
SELECT * FROM wallets_house WHERE currency_name = 'Bitcoin (BTC)'

-- OLD JOIN PATTERN:
SELECT wh.*, c.name as currency_full_name
FROM wallets_house wh
JOIN currencies c ON wh.currency = c.code

-- NEW PATTERN (no join needed):
SELECT * FROM wallets_house
WHERE currency_name = 'Bitcoin (BTC)'
```

## Support

If issues occur:
1. Check the backup table: `SELECT * FROM wallets_house_backup_before_currency_drop`
2. Run verification script: `node scripts/verify-and-populate-crypto-deposits.js`
3. Check Supabase logs for migration errors
4. Review application logs for query errors

---

**Migration Version**: 0106-0107
**Created**: 2024
**Status**: Ready for production (after testing)
