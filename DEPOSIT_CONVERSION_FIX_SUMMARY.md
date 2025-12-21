# Deposit Currency Conversion Fix - Summary

## Problem Identified

**Issue**: User sent 3443 BCH but received only 3443 PHP in wallet balance instead of ≈119,947,205.75 PHP.

### Root Cause

Two critical bugs were discovered:

1. **Missing Conversion in Deposit Approval**: The `process-deposit-approval` function was crediting wallets with the raw deposit amount without converting from the original currency to PHP.
   - Example: 3443 BCH → directly added as 3443 PHP (wrong!)
   - Should be: 3443 BCH → convert to PHP using exchange rate → add correct amount

2. **No Conversion Rate Calculation on Deposit Creation**: The `process-deposit` function was not calculating or storing the PHP-equivalent amount (`received_amount`) when crypto deposits were created.
   - The `received_amount` field existed in the database but was never populated
   - The `exchange_rate` field was not being calculated

## Solutions Implemented

### 1. Fixed Deposit Approval Function
**File**: `supabase/functions/process-deposit-approval/index.ts`

**Changes**:
- Now uses `received_amount` (PHP equivalent) instead of raw `amount` when crediting wallets
- Falls back to raw amount if `received_amount` is null (for older deposits without conversion data)
- Records conversion details in transaction metadata for audit trail
- Ensures crypto deposits are properly converted to PHP

**Code Logic**:
```typescript
const creditAmount = deposit.received_amount 
  ? parseFloat(deposit.received_amount)
  : parseFloat(deposit.amount)

const newBalance = parseFloat(wallet.balance) + creditAmount
```

### 2. Updated Process Deposit Function
**File**: `supabase/functions/process-deposit/index.ts`

**Changes**:
- Added `getCryptoPriceInPHP()` function to fetch crypto prices from CoinGecko API
- Added `convertToPhp()` function to convert fiat currencies using Open Exchange Rates API
- Updated all deposit processors to calculate `received_amount` and `exchange_rate`:
  - Crypto deposits (crypto_direct)
  - Bank transfers
  - GCash
  - PayMaya
  - Stripe

**Example for BCH Deposit**:
```
1. Get BCH price in PHP from CoinGecko (e.g., 34,821.58 PHP per BCH)
2. Calculate: 3443 BCH × 34,821.58 = 119,947,205.75 PHP
3. Store in deposits table:
   - received_amount: 119947205.75
   - exchange_rate: 34821.58
   - rate_source: 'coingecko'
   - rate_fetched_at: <timestamp>
4. When approved, credit wallet with 119,947,205.75 PHP (not 3443!)
```

### 3. Created Repair Script
**File**: `scripts/repair-deposit-conversions.js`

**Purpose**: Fix existing deposits that don't have conversion amounts

**What it does**:
1. Finds all deposits without `received_amount` (non-PHP currency)
2. Fetches current exchange rates from CoinGecko
3. Calculates PHP equivalent amounts
4. Updates deposit records with conversion data
5. If deposits were already approved, recalculates and fixes wallet balances

**Run the repair script**:
```bash
npm run repair-deposits
```

Or with Node directly:
```bash
SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." node scripts/repair-deposit-conversions.js
```

## Database Schema

### Deposits Table Fields for Conversion
```sql
received_amount NUMERIC(36, 8)      -- PHP equivalent of deposit
exchange_rate NUMERIC(18, 8)        -- Exchange rate used (e.g., 34821.58)
rate_source VARCHAR(50)             -- Source of rate (coingecko, openexchangerates)
rate_fetched_at TIMESTAMPTZ        -- When rate was fetched
```

### Wallet Transactions Metadata
Transactions now include conversion metadata:
```json
{
  "original_amount": 3443,
  "original_currency": "BCH",
  "exchange_rate": 34821.58,
  "received_amount": 119947205.75
}
```

## Fixing the Specific 3443 BCH Deposit

### Option 1: Use Repair Script (Recommended)
1. Run: `npm run repair-deposits`
2. Script will automatically find and fix the 3443 BCH deposit
3. It will also fix the wallet balance if the deposit was already approved

### Option 2: Manual Fix (For Verification)

```sql
-- 1. Check the deposit
SELECT id, user_id, wallet_id, amount, currency_code, status, received_amount
FROM deposits
WHERE amount = 3443 AND currency_code = 'BCH'
LIMIT 1;

-- 2. Get BCH/PHP rate (manually if needed)
-- Example: 1 BCH = 34821.58 PHP (check CoinGecko)

-- 3. Update the deposit
UPDATE deposits
SET 
  received_amount = 3443 * 34821.58,  -- 119947205.75
  exchange_rate = 34821.58,
  rate_source = 'coingecko',
  rate_fetched_at = NOW()
WHERE amount = 3443 AND currency_code = 'BCH';

-- 4. Fix wallet balance if deposit was approved
-- First, get all approved deposits for that wallet
SELECT id, amount, currency_code, received_amount
FROM deposits
WHERE wallet_id = <wallet_id>
  AND status IN ('completed', 'approved')
ORDER BY created_at;

-- 5. Calculate total PHP from all approved deposits
-- Then update wallet balance
UPDATE wallets
SET balance = <calculated_total_php>
WHERE id = <wallet_id>;

-- 6. Verify the fix
SELECT balance FROM wallets WHERE id = <wallet_id>;
```

## Prevention for Future Deposits

Starting immediately:
- ✅ All new crypto deposits will have conversion rates calculated automatically
- ✅ All new fiat deposits in non-PHP currencies will be converted to PHP
- ✅ Exchange rates and PHP amounts are stored for audit trail
- ✅ Wallet balance is credited with correct PHP equivalent amount

## Testing

To verify the fix works:

```javascript
// Test deposit creation with BCH
const response = await fetch('/functions/v1/process-deposit', {
  method: 'POST',
  body: JSON.stringify({
    userId: 'test-user-id',
    walletId: 'test-wallet-id',
    amount: 3443,
    currency: 'BCH',
    depositMethod: 'crypto_direct',
    methodDetails: {
      cryptoSymbol: 'BCH',
      chainId: 1
    }
  })
})

// Should return:
// {
//   "received_amount": 119947205.75,
//   "exchange_rate": 34821.58,
//   "rate_source": "coingecko"
// }
```

## Verification Steps

After running the repair script:

1. **Check deposit record**:
   ```sql
   SELECT id, amount, currency_code, received_amount, exchange_rate, status
   FROM deposits
   WHERE amount = 3443 AND currency_code = 'BCH';
   ```
   Should show `received_amount` populated with PHP equivalent.

2. **Check wallet balance**:
   ```sql
   SELECT id, balance
   FROM wallets
   WHERE id = <wallet_id>;
   ```
   Should show corrected balance (119,947,205.75+ if this was the only deposit).

3. **Check transaction history**:
   ```sql
   SELECT amount, description, metadata
   FROM wallet_transactions
   WHERE wallet_id = <wallet_id>
   ORDER BY created_at DESC;
   ```
   Should show transaction with 119,947,205.75 PHP and metadata with conversion details.

## Summary of Changes

| Component | Issue | Fix |
|-----------|-------|-----|
| process-deposit-approval | Not converting amount | Uses received_amount with fallback to amount |
| process-deposit | Not calculating conversion | Calculates received_amount and exchange_rate |
| Database | No conversion rate stored | Data populated from API calls |
| Wallet balance | Wrong amount credited | Credited with PHP equivalent |
| Audit trail | No conversion details | Metadata stores original amount and rate |

## Additional Notes

- The repair script is idempotent - can be run multiple times safely
- Current exchange rates are fetched fresh each time
- For deposits created long ago, rates will be current (not historical)
- If you need historical rates, those would need to be obtained separately
