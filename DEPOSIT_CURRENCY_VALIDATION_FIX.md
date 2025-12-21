# Deposit Currency Validation & Auto-Conversion Fix

## Overview

This fix addresses a critical bug where deposits in a different currency than the wallet were not being validated or converted. For example, a user deposited **3443 BCH** into a **PHP wallet**, and the system incorrectly credited 3443 PHP (worth millions) instead of converting the BCH to PHP.

## The Problem

### Root Cause
In `src/lib/depositStatusChangeService.js`, the `_calculateWalletImpact()` method:
- Took the deposit amount directly (e.g., 3443 BCH)
- Added it to the wallet balance **WITHOUT** checking if currencies matched
- Result: 3443 BCH was credited as 3443 PHP ❌

### Impact
- Users could accidentally deposit crypto into fiat wallets or vice versa
- No validation of currency compatibility
- No conversion or notification
- Balance integrity compromised

## The Solution

### Approach: Option B - Auto-Conversion with Confirmation
- ✅ Validate deposit currency matches wallet currency
- ✅ Auto-convert using current exchange rates from database
- ✅ Show confirmation modal with conversion details
- ✅ Store conversion metadata in database
- ✅ Create comprehensive audit trail
- ✅ Allow rejection if rates are unfavorable

## What's Changed

### 1. Database Schema (Migration: `0109_add_currency_conversion_to_deposits.sql`)

New columns added to `deposits` table:
```sql
-- Conversion tracking
received_amount NUMERIC(36, 8)    -- Original amount deposited
received_currency VARCHAR(16)     -- Original currency code
exchange_rate NUMERIC(36, 8)      -- Rate used for conversion
converted_amount NUMERIC(36, 8)   -- Final amount credited to wallet
conversion_status TEXT             -- pending | confirmed | rejected | none

-- Audit fields
approved_by UUID                  -- User who approved
approved_at TIMESTAMPTZ           -- When approved
version INTEGER                   -- Optimistic locking
idempotency_key UUID              -- Prevent duplicates
```

New table: `deposit_conversion_audit`
- Tracks all conversion actions with full audit trail
- Records: conversion_initiated, conversion_confirmed, conversion_rejected, conversion_applied

### 2. Service Updates

#### `src/lib/depositStatusChangeService.js`
**New Methods:**
- `_convertCurrency()` - Fetches exchange rate and calculates conversion
- `_recordConversionAudit()` - Records conversion in audit table

**Updated Methods:**
- `_calculateWalletImpact()` - Now validates currency and auto-converts
- `changeDepositStatus()` - Passes deposit currency to impact calculation
- `_updateWalletBalance()` - Stores conversion data in deposit record

**Key Changes:**
```javascript
// Before: No currency validation
const balanceAfter = balanceBefore + amount

// After: Currency validation + conversion
if (depositCurrency !== walletCurrency) {
  conversion = await this._convertCurrency(...)
  finalAmount = conversion.convertedAmount
}
const balanceAfter = balanceBefore + finalAmount
```

### 3. New Components & Services

#### `src/components/DepositConversionConfirmation.jsx`
Modal component for displaying conversion details:
- Original amount and currency
- Exchange rate (market rate shown)
- Final amount in wallet currency
- Rate source and timestamp
- Confirm/Reject buttons

#### `src/lib/depositConversionService.js`
Service for managing conversions:
- `needsConversion()` - Check if conversion needed
- `getConversionDetails()` - Fetch exchange rates
- `confirmConversion()` - Store confirmed conversion
- `rejectConversion()` - Reject conversion
- `getDepositsNeedingConversion()` - For admin dashboard
- `batchUpdateConversions()` - Bulk operations

### 4. Fix Script

#### `scripts/fix-incorrect-bch-deposit.js`
Corrects the existing 3443 BCH deposit:
1. Finds the incorrect deposit (3443 BCH → PHP wallet)
2. Gets current BCH/PHP exchange rate
3. Calculates correct PHP amount (~millions if BCH price is high)
4. Updates deposit with conversion data
5. Adjusts wallet balance
6. Creates transaction and audit entries

## Deployment Steps

### Step 1: Run Migration
```bash
# The migration will automatically run through Supabase
# It adds new columns and creates validation triggers
```

### Step 2: Deploy Code
Deploy the updated files:
- `src/lib/depositStatusChangeService.js`
- `src/components/DepositConversionConfirmation.jsx`
- `src/lib/depositConversionService.js`

### Step 3: Fix Existing Deposit (if needed)
```bash
# Only needed if you have the 3443 BCH deposit
npm run fix-incorrect-bch-deposit
```

This script will:
- Find the problematic deposit
- Calculate correct conversion
- Update all related records
- Create full audit trail

## Testing

### Test Case 1: Currency Mismatch
```
1. Create deposit: 1 BTC → PHP wallet
2. System should:
   - Fetch BTC/PHP exchange rate
   - Calculate: 1 BTC * rate = converted PHP amount
   - Show confirmation modal
   - Wait for user confirmation
   - Update deposit + wallet on approval
```

### Test Case 2: Same Currency
```
1. Create deposit: 1000 PHP → PHP wallet
2. System should:
   - Skip conversion
   - Set conversion_status = 'none'
   - Credit wallet directly
```

### Test Case 3: Unfavorable Rate
```
1. Create deposit: BCH amount when BTC is down
2. Modal shows: ⚠️ Unfavorable rate
3. User can reject conversion
4. Deposit stays in pending/rejected state
```

## API Response Example

### Before Approval (Pending Conversion)
```json
{
  "deposit": {
    "id": "uuid",
    "amount": 3443,
    "currency_code": "BCH",
    "conversion_status": "pending",
    "received_amount": null,
    "exchange_rate": null,
    "converted_amount": null
  },
  "conversion": {
    "fromCurrency": "BCH",
    "toCurrency": "PHP",
    "originalAmount": 3443,
    "exchangeRate": 1234.56,
    "convertedAmount": 4250281.08,
    "rateSource": "coingecko",
    "rateUpdatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### After Approval (Confirmed)
```json
{
  "deposit": {
    "id": "uuid",
    "amount": 3443,
    "currency_code": "BCH",
    "conversion_status": "confirmed",
    "received_amount": 3443,
    "received_currency": "BCH",
    "exchange_rate": 1234.56,
    "converted_amount": 4250281.08,
    "approved_at": "2024-01-15T10:35:00Z"
  },
  "walletUpdate": {
    "previousBalance": 1000,
    "newBalance": 4250282.08,
    "amountAdded": 4250281.08,
    "transactionType": "deposit_with_conversion"
  }
}
```

## Audit Trail Example

```sql
SELECT * FROM deposit_conversion_audit
WHERE deposit_id = 'uuid'
ORDER BY created_at DESC;

-- Shows:
-- 1. conversion_initiated - BCH/PHP rate fetched
-- 2. conversion_confirmed - User confirmed conversion
-- 3. conversion_applied - Wallet credited with converted amount
```

## Configuration

### Exchange Rate Sources
The system uses rates from `crypto_rates_valid` view:
- Primary: CoinGecko API (via `cryptoRatesService.js`)
- Fallback: Database cached rates
- Rate expiry: 1 hour

### Supported Conversions
- All fiat to crypto pairs
- All crypto to fiat pairs
- Cross-crypto conversions
- Rates must be in `crypto_rates` table

## Security & Validation

✅ **Validation Checks:**
- Currency exists in `currencies` table
- Exchange rate is current (within 1 hour)
- Conversion math is verified: `amount * rate = converted`
- User confirmation required before wallet update
- Immutability: Completed conversions cannot be modified

✅ **Audit Trail:**
- All conversions logged with timestamps
- Rate source and version tracked
- User approval documented
- Reversals recorded

✅ **Error Handling:**
- No exchange rate available → Deposit rejected with error
- Math mismatch → Database trigger raises exception
- Concurrent modifications → Optimistic locking prevents issues

## Rollback Plan

If needed to revert:

1. **Code Rollback**
   - Deploy previous version of depositStatusChangeService.js
   - Remove conversion components

2. **Database Rollback**
   ```bash
   # Revert migration - drops conversion columns
   # Keep: conversion_status = 'none' for existing deposits
   ```

3. **Data Safety**
   - Conversion data preserved in `deposit_conversion_audit`
   - Wallet balances adjusted by fix script remain correct
   - Transaction history maintained

## Monitoring

### Queries to Monitor:

```sql
-- Deposits with pending conversions
SELECT * FROM deposits
WHERE conversion_status = 'pending'
ORDER BY created_at DESC;

-- Recent conversions
SELECT * FROM deposit_conversion_audit
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Currency mismatches that need conversion
SELECT d.id, d.amount, d.currency_code, w.currency_code AS wallet_currency
FROM deposits d
JOIN wallets w ON d.wallet_id = w.id
WHERE d.currency_code != w.currency_code
  AND d.conversion_status IN ('pending', 'rejected');
```

## FAQ

### Q: What if the exchange rate changes while confirmation is shown?
**A:** The rate shown in the confirmation modal is the current rate. If the user delays confirmation, they can reject and initiate a new deposit (which will fetch the latest rate).

### Q: Can users see the conversion before approving?
**A:** Yes! The confirmation modal shows:
- Original amount + currency
- Exchange rate (with "favorable" / "unfavorable" indicator)
- Final amount they'll receive
- Rate source and update time

### Q: What happens if there's no exchange rate available?
**A:** Deposit is rejected with error message: "Cannot convert BCH to PHP. No exchange rate available."

### Q: How are rejected conversions handled?
**A:** Rejected deposits remain in pending status with `conversion_status = 'rejected'`. User must create a new deposit or contact support.

### Q: Can admins approve conversions with different rates?
**A:** Not directly. System uses current database rates. For manual overrides, admins would need to:
1. Update exchange rate in `crypto_rates` table
2. Re-approve deposit (which recalculates)

## Support

For issues:
1. Check `deposit_conversion_audit` table for what happened
2. Check `wallet_transactions` for balance impacts
3. Check `wallet_balance_reconciliation` for discrepancies
4. Review error logs in `deposit_audit_log`

## Version History

- **v1.0** (2024-01-15)
  - Initial implementation
  - Auto-conversion with confirmation
  - Full audit trail
  - Fix script for existing issue
