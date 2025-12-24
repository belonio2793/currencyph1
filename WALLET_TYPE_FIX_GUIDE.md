# Wallet Type Fix Guide

## Problem Statement

Cryptocurrency wallets were being labeled as **fiat** instead of **crypto**, causing display and categorization issues in the wallets interface.

**Example Issue:**
- User creates a wallet for BNB (Binance Coin)
- The wallet is incorrectly marked as type='fiat' instead of type='crypto'
- The UI shows BNB under "Fiat Currencies" instead of "Cryptocurrency"

## Root Causes

### 1. Missing Cryptocurrencies in Currencies Table
The initial `wallet_schema.sql` did not include some cryptocurrencies (like BNB, TRX, SUI, TON, HBAR) in the `currencies` table. When wallets were created for these currencies:
- The `createWallet()` function would not find them in the currencies table
- It would default to `type = 'fiat'` as a fallback
- The wallet would be created with the wrong type

### 2. Existing Wallets with Incorrect Types
Wallets created before the fix would remain with the incorrect type in the database.

### 3. Database Trigger Limitations
While migration 059 added a database trigger (`set_wallet_type()`) to auto-populate the type, it could only work for cryptocurrencies that exist in the currencies table at the time of wallet creation.

## Solution

### Changes Made

#### 1. Updated `supabase/sql/wallet_schema.sql`
Added missing cryptocurrencies to the initial currencies table INSERT statement:
- **BNB** - Binance Coin
- **TRX** - Tron
- **XLM** - Stellar Lumens
- **SUI** - Sui
- **HBAR** - Hedera
- **TON** - Telegram

#### 2. Created Migration `0110_fix_wallet_types_crypto.sql`
This migration:
- Ensures ALL known cryptocurrencies are in the currencies table with `type='crypto'`
- Updates existing wallets with incorrect types:
  - Finds wallets marked as 'fiat' but with cryptocurrency codes
  - Updates their type to 'crypto'
- Syncs wallets with their currency definitions

#### 3. Verification Script `scripts/verify-wallet-types.js`
Node.js script to verify the fix:
- Checks that all known cryptocurrencies exist in the currencies table
- Verifies wallets have the correct type
- Reports any mismatches
- Suggests remediation steps

## How It Works

### Wallet Creation Flow

```
1. User creates wallet for currency (e.g., BNB)
                ↓
2. createWallet() function called
   - Queries currencies table for currency details
   - Checks if currency.type = 'crypto' or 'fiat'
                ↓
3. If currency found → uses currency.type
   If NOT found → defaults to 'fiat'
                ↓
4. Inserts wallet with type value
                ↓
5. Database trigger `set_wallet_type()` runs:
   - If type not provided → queries currencies to find it
   - If currency not found → defaults to 'fiat'
```

### The Fix Ensures

1. **All cryptocurrencies exist** in the currencies table before any wallet creation
2. **App-level logic** finds the correct type when creating wallets
3. **Database trigger** has a complete currencies reference
4. **Existing wallets** are corrected to have the right type

## Implementation

### Step 1: Apply the Migration

The migration file `supabase/migrations/0110_fix_wallet_types_crypto.sql` will:

```sql
-- Add missing cryptocurrencies to currencies table
INSERT INTO public.currencies (code, name, type, symbol, decimals, active)
VALUES ('BNB', 'Binance Coin', 'crypto', 'BNB', 8, TRUE), ...
ON CONFLICT (code) DO UPDATE SET type = 'crypto', active = TRUE;

-- Fix existing wallets with wrong types
UPDATE public.wallets w
SET type = 'crypto'
WHERE type = 'fiat' 
  AND currency_code IN ('BTC', 'ETH', 'BNB', 'XRP', ...);
```

**Note:** The migration file should be placed in `supabase/migrations/` and Supabase will apply it automatically.

### Step 2: Verify the Fix

Run the verification script:

```bash
node scripts/verify-wallet-types.js
```

**Output Example:**
```
=== Checking Currencies Table ===
✓ Found 50 currencies in database
  - Crypto currencies: 25
  - Fiat currencies: 25

=== Checking Wallets Table ===
✓ Found 1,234 active wallets
  - Crypto wallets: 450
  - Fiat wallets: 784

=== Summary ===
✅ All checks passed! Wallet types appear to be correct.
```

## Testing

### Manual Testing

1. **Create a new wallet for BNB:**
   - Go to Wallet page → "Add More Currencies"
   - Select "BNB (Binance Coin)"
   - Click Add
   - Verify it appears under "Cryptocurrency" tab, not "Fiat Currencies"

2. **Check existing wallets:**
   - Go to Wallet page
   - Click the "Cryptocurrency" tab
   - Verify BNB and other crypto wallets are listed
   - Click the "Fiat Currency" tab
   - Verify no crypto wallets appear there

### Database Verification

```sql
-- Check that BNB exists in currencies table
SELECT * FROM currencies WHERE code = 'BNB';
-- Expected: type = 'crypto'

-- Check that wallets for BNB have correct type
SELECT currency_code, type, COUNT(*) as count
FROM wallets
WHERE currency_code = 'BNB'
GROUP BY currency_code, type;
-- Expected: all should have type = 'crypto'

-- Check the trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'wallet_type_trigger';
```

## Files Changed

| File | Change |
|------|--------|
| `supabase/sql/wallet_schema.sql` | Added BNB and other missing cryptocurrencies |
| `supabase/migrations/0110_fix_wallet_types_crypto.sql` | NEW: Fix migration |
| `scripts/verify-wallet-types.js` | NEW: Verification script |
| `WALLET_TYPE_FIX_GUIDE.md` | NEW: This documentation |

## Related Code

### createWallet() in `src/lib/walletService.js`
```javascript
// Fetch currency details to get the correct type
let currencyType = 'fiat' // Default fallback
const { data: currencyData } = await supabase
  .from('currencies')
  .select('name, type, symbol, decimals')
  .eq('code', currencyCode)
  .single()

if (!currencyError && currencyData) {
  currencyType = currencyData.type || 'fiat'  // Uses correct type if found
}

// Insert wallet with type
const { data } = await supabase
  .from('wallets')
  .insert([{ ..., type: currencyType }])
```

### Database Trigger in `supabase/migrations/059_add_wallet_type_column.sql`
```sql
CREATE OR REPLACE FUNCTION public.set_wallet_type()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type IS NULL THEN
    SELECT type INTO NEW.type
    FROM public.currencies
    WHERE code = NEW.currency_code;
    
    IF NEW.type IS NULL THEN
      NEW.type := 'fiat';  -- Default fallback
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## FAQ

**Q: Will this affect existing wallets?**
A: Yes. The migration will update existing wallets with incorrect types. This is the intended fix.

**Q: What if a wallet has type=NULL?**
A: The trigger defaults to 'fiat'. The fix ensures all wallets get proper types.

**Q: Can I run this multiple times?**
A: Yes. The migration uses `ON CONFLICT ... DO UPDATE` which is idempotent.

**Q: What about future wallet creation?**
A: Future wallets will be created with the correct type automatically because:
1. The currencies table will have the correct entries
2. The app-level logic will find the type
3. The database trigger will enforce it

**Q: How do I know if the fix worked?**
A: Run `scripts/verify-wallet-types.js` to check.

## Troubleshooting

### Issue: BNB still shows as "Fiat Currency"

**Solution:**
1. Verify migration was applied:
   ```sql
   SELECT * FROM currencies WHERE code = 'BNB';
   ```
2. If BNB doesn't exist, manually run the INSERT from migration 0110
3. Update wallets for BNB:
   ```sql
   UPDATE wallets SET type = 'crypto' 
   WHERE currency_code = 'BNB' AND type = 'fiat';
   ```
4. Refresh the page (may need to clear cache)

### Issue: Migration fails with "currency not found"

**Solution:**
The wallet_schema.sql must be applied first. Ensure migration order is correct.

### Issue: Verification script shows missing cryptocurrencies

**Solution:**
The migration hasn't been applied yet, or there was an error applying it. Check Supabase migration logs.

## Future Improvements

1. **Auto-detect currency type** from blockchain explorers for unknown currencies
2. **Add validation** to prevent manual insertion of cryptos as fiat
3. **Enhanced UI** to show currency type icons/badges
4. **Currency catalog** that auto-syncs with external data sources

## References

- Migration: `supabase/migrations/059_add_wallet_type_column.sql` (original trigger)
- Migration: `supabase/migrations/0110_fix_wallet_types_crypto.sql` (fix)
- Schema: `supabase/sql/wallet_schema.sql` (currencies table definition)
- Code: `src/lib/walletService.js` (createWallet function)
- Code: `src/lib/payments.js` (alternative createWallet)
