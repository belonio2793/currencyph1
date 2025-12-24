# Wallet Type Fix - Implementation Summary

## Overview

Fixed the issue where cryptocurrency wallets (like BNB) were being incorrectly labeled as **fiat** instead of **crypto**.

## What Was Done

### 1. ✅ Updated `supabase/sql/wallet_schema.sql`

**Change:** Added 7 missing cryptocurrencies to the initial currencies table:
- BNB (Binance Coin)
- TRX (Tron)  
- XLM (Stellar Lumens)
- SUI (Sui)
- HBAR (Hedera)
- TON (Telegram)

**Why:** These cryptocurrencies were missing from the initial schema, causing wallet creation to default to 'fiat' type.

### 2. ✅ Created Migration: `supabase/migrations/0110_fix_wallet_types_crypto.sql`

**What it does:**
- Adds all known cryptocurrencies to the currencies table with `type='crypto'`
- Updates existing wallets that were incorrectly marked as 'fiat'
- Ensures the database trigger has correct reference data

**Key Operations:**
```sql
-- Add missing cryptos
INSERT INTO currencies (code, name, type, ...) 
VALUES ('BNB', ..., 'crypto', ...) 
ON CONFLICT DO UPDATE ...

-- Fix existing wallets
UPDATE wallets SET type='crypto'
WHERE currency_code IN ('BTC', 'ETH', 'BNB', ...)
AND type='fiat'
```

### 3. ✅ Created Verification Script: `scripts/verify-wallet-types.js`

**What it does:**
- Checks that all known cryptocurrencies exist in the currencies table
- Verifies wallets have the correct type based on currency
- Reports any issues found
- Provides guidance on how to fix issues

**Usage:**
```bash
node scripts/verify-wallet-types.js
```

## The Root Cause

The issue occurred because:

1. **Missing Currency Data**: BNB and other cryptos weren't in the `currencies` table initially
2. **Default Fallback**: When creating a wallet for a missing currency, the code defaults to `type='fiat'`
3. **Trigger Limitations**: The database trigger could only work with currencies that existed in the table
4. **Old Wallets**: Wallets created before the fix remained with incorrect types

## How It's Fixed

### New Wallet Creation Flow (After Fix)

```
Create Wallet for BNB
   ↓
Check currencies table → BNB found with type='crypto' ✓
   ↓
Insert wallet with type='crypto'
   ↓
Database trigger confirms type (already set, no changes)
   ↓
Wallet appears in "Cryptocurrency" section ✓
```

### Existing Wallet Fix

The migration updates all wallets that were created with the wrong type:

```sql
-- Before fix: BNB wallet marked as 'fiat'
SELECT * FROM wallets WHERE currency_code='BNB' AND type='fiat';  
-- Result: Multiple rows ✓ Need fixing

-- After migration
SELECT * FROM wallets WHERE currency_code='BNB' AND type='fiat';
-- Result: No rows (all updated to 'crypto') ✓ Fixed
```

## Next Steps

### IMPORTANT: Apply the Migration

The migration file has been created but needs to be applied to your database:

1. **Via Supabase Console:**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your project
   - Go to "SQL Editor"
   - Create a new query
   - Copy the contents of `supabase/migrations/0110_fix_wallet_types_crypto.sql`
   - Run it

2. **Via Supabase CLI (if available):**
   ```bash
   supabase db push
   ```

3. **Verify the Fix:**
   ```bash
   # After applying migration
   node scripts/verify-wallet-types.js
   
   # Expected output:
   # ✅ All checks passed! Wallet types appear to be correct.
   ```

## Testing the Fix

### Quick Manual Test

1. **Create a new BNB wallet:**
   - Go to Wallet page
   - Click "Add More Currencies"
   - Search for and select "BNB (Binance Coin)"
   - Click "Add"

2. **Verify it's in the right section:**
   - Click the "Cryptocurrency" tab
   - Should see BNB listed ✓
   - Click the "Fiat Currency" tab
   - Should NOT see BNB ✓

### Database Verification

```sql
-- Check BNB in currencies table
SELECT code, type FROM currencies WHERE code = 'BNB';
-- Expected: ('BNB', 'crypto')

-- Check wallets for BNB
SELECT type, COUNT(*) as count FROM wallets 
WHERE currency_code = 'BNB' GROUP BY type;
-- Expected: only rows with type='crypto'
```

## Files Modified/Created

| File | Type | Purpose |
|------|------|---------|
| `supabase/sql/wallet_schema.sql` | Modified | Added missing cryptocurrencies |
| `supabase/migrations/0110_fix_wallet_types_crypto.sql` | NEW | Main fix migration |
| `scripts/verify-wallet-types.js` | NEW | Verification script |
| `WALLET_TYPE_FIX_GUIDE.md` | NEW | Detailed documentation |
| `WALLET_FIX_IMPLEMENTATION_SUMMARY.md` | NEW | This file |

## Understanding the System

### How Wallet Type is Determined

**During Creation:**
1. App queries `currencies` table for the currency code
2. Gets the `type` field from the currency record
3. If currency doesn't exist → defaults to `'fiat'`
4. Creates wallet with that type

**In Database:**
A trigger ensures the type is set even if app logic fails:
```sql
TRIGGER wallet_type_trigger
  ON wallets BEFORE INSERT
  EXECUTES set_wallet_type()
    -- Queries currencies table to find type
    -- Defaults to 'fiat' if not found
```

**In UI:**
The Wallet component filters wallets by type:
```javascript
const cryptoWallets = wallets.filter(w => w.currency_type === 'crypto')
const fiatWallets = wallets.filter(w => w.currency_type === 'fiat')
```

## Known Cryptocurrencies

The fix ensures these cryptocurrencies are marked as `type='crypto'`:

**Major Coins:**
- BTC (Bitcoin), ETH (Ethereum), BNB (Binance Coin)
- XRP, SOL (Solana), ADA (Cardano), DOGE (Dogecoin)

**Stablecoins:**
- USDT (Tether), USDC (USD Coin), BUSD (Binance USD), PYUSD (PayPal USD)

**Layer 2 & Other:**
- MATIC (Polygon), LINK (Chainlink), AVAX (Avalanche)
- TRX (Tron), XLM (Stellar), LTC (Litecoin), BCH (Bitcoin Cash)
- SUI, TON, HBAR, UNI (Uniswap), AAVE, and more

## If Something Goes Wrong

### Symptom: Wallets still showing in wrong category

**Check:**
1. Was the migration applied?
   ```sql
   SELECT * FROM currencies WHERE code = 'BNB';
   -- Should return: type='crypto'
   ```

2. Were existing wallets updated?
   ```sql
   SELECT type, COUNT(*) FROM wallets WHERE currency_code='BNB' GROUP BY type;
   -- Should only return: type='crypto' rows
   ```

3. Clear browser cache and refresh

### Symptom: Migration fails

**Possible issues:**
1. Migration already applied - check if currencies have type='crypto'
2. Database connection issue - verify Supabase is accessible
3. Constraint violation - check if currencies table has data integrity issues

**Solution:**
1. Check the error message carefully
2. Run verification script to see current state
3. If needed, manually run the UPDATE statements from the migration

## Performance Impact

- **Minimal:** This is data update only
- **No schema changes** to wallets table structure
- **No migration** of data between tables
- **Safe to run** multiple times

## Rollback (if needed)

If you need to rollback, manually run:
```sql
-- Revert wallet types (change crypto back to fiat)
UPDATE wallets SET type='fiat' 
WHERE type='crypto' AND currency_code NOT IN (
  SELECT code FROM currencies WHERE type='crypto'
);

-- Delete added currencies (optional, keep them for future use)
DELETE FROM currencies WHERE type='crypto' AND code IN (
  'BNB', 'TRX', 'XLM', 'SUI', 'HBAR', 'TON'
);
```

## Questions?

Refer to:
- **Detailed Guide:** `WALLET_TYPE_FIX_GUIDE.md`
- **Verification:** Run `node scripts/verify-wallet-types.js`
- **Code:** Check `src/lib/walletService.js` and `src/lib/payments.js` for wallet creation logic

## Summary Checklist

- [x] Root cause identified: Missing cryptocurrencies in currencies table
- [x] Schema updated: Added missing cryptos to wallet_schema.sql
- [x] Migration created: 0110_fix_wallet_types_crypto.sql
- [x] Verification script created: verify-wallet-types.js
- [x] Documentation written: WALLET_TYPE_FIX_GUIDE.md
- [ ] **TODO: Apply migration to database** ← You are here
- [ ] Verify fix with script
- [ ] Test manually (create new wallet)
- [ ] Mark issue as resolved

---

**Status:** Ready for migration application ✓
