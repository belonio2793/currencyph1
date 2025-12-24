# Deposit Validation Improvements

## Problem Statement

The deposits page was sending incomplete or malformed data to the database, resulting in SQL errors:

1. **P0001 Error**: PL/pgSQL validation functions failing with invalid currency conversions
2. **22P02 Error**: Invalid UUID type casting (e.g., "system" being cast as UUID)
3. **RLS Policy Violations**: Row-level security blocking crypto_rates inserts from user context

## Root Cause

All calculations and validations were happening **in the database** (via triggers and functions) instead of **on the client**, causing:
- Incomplete data being submitted
- No pre-validation of inputs
- RLS policy conflicts
- Malformed SQL queries

## Solution

### 1. New Validation Service (`src/lib/depositValidationService.js`)

Moved all validations to the frontend **before** any database operations:

```javascript
// Validate input
const inputValidation = validateDepositInput(amount, selectedCurrency, selectedWallet)

// Validate wallet compatibility
const walletValidation = validateWalletCurrency(wallet, currency)

// Calculate converted amount
const result = calculateConvertedAmount(
  amount,
  fromCurrency,
  fromRate,
  toCurrency,
  toRate,
  depositType
)

// Build complete deposit record
const depositRecord = buildDepositRecord({...})
```

### 2. Updated Deposits Component

The `handleInitiateDeposit` function now:

1. **Validates all inputs locally** before any database operations
2. **Calculates conversions** with proper error handling
3. **Builds a complete, valid deposit record** with all required fields
4. **Only then** inserts into the database

### 3. Flow Diagram

```
User Action
    ↓
Client-side Validation (depositValidationService.js)
├── Validate amount, currency, wallet
├── Check wallet currency match
├── Validate payment method
└── Validate GCash reference (if applicable)
    ↓
Calculate Converted Amount
├── Check if rates available
├── Validate rates (must be finite and positive)
├── Perform calculation
└── Validate result (must be finite and positive)
    ↓
Build Deposit Record
├── Validate all fields
├── Format data correctly
└── Prepare metadata
    ↓
Database Insert
└── Send clean, validated data (SAFE!)
```

## Key Features

### Type Validation

- **UUID validation**: Ensures wallet IDs are valid UUIDs
- **Currency code validation**: Only alphanumeric, max 10 chars (e.g., BTC, USD, BNB)
- **Number validation**: Ensures rates and amounts are finite, positive numbers
- **String sanitization**: Limits length, removes special characters

### Calculation Safety

- **Rate validation**: Checks that exchange rates are available, valid, and non-zero
- **Calculation validation**: Ensures result is finite and positive
- **Decimal precision**: Rounds to 2 places for fiat, 8 for crypto
- **Conversion tracking**: Records conversion rate for audit trail

### GCash Integration

- **Reference validation**: Requires 5-50 character alphanumeric reference
- **Format checking**: Only allows standard GCash reference formats
- **Error messaging**: Clear feedback if reference is missing or invalid

## Error Handling

All errors are caught before reaching the database:

```javascript
if (!inputValidation.isValid) {
  setError(inputValidation.errors.join('; '))
  return
}

if (!walletValidation.isValid) {
  setError(walletValidation.errors.join('; '))
  return
}
```

If an error somehow gets to the database, it's caught and translated to user-friendly messages:

```javascript
if (err.code === 'PGRST116') {
  setError('Database connection error. Please try again.')
} else if (err.message.includes('foreign key')) {
  setError('Invalid wallet selected. Please create a new wallet.')
}
```

## Best Practices Implemented

### ✅ Do

- Validate inputs on the client BEFORE sending to database
- Calculate amounts with proper error handling
- Use consistent type checking and validation
- Provide specific error messages to users
- Log errors for debugging without exposing sensitive data

### ❌ Don't

- Send unvalidated or incomplete data to database
- Perform complex calculations in database triggers
- Rely on RLS policies for data validation
- Use database constraints for business logic validation
- Store sensitive data in error messages

## Migration Path

If you have existing deposits table entries with invalid data:

1. Create a cleanup script in `supabase/migrations/`
2. Use a database transaction to fix entries
3. Add NOT NULL constraints gradually
4. Test thoroughly before applying to production

Example migration:

```sql
-- Fix deposits with NULL converted_amount
UPDATE deposits
SET received_amount = amount,
    conversion_rate = 1,
    updated_at = NOW()
WHERE converted_amount IS NULL
  AND status = 'pending';
```

## Testing

To test the validation service:

```javascript
import { validateDepositInput, calculateConvertedAmount } from '../lib/depositValidationService'

// Test validation
const validation = validateDepositInput('100', 'BTC', wallet_uuid)
console.assert(validation.isValid === true)

// Test calculation
const result = calculateConvertedAmount(
  '0.5',
  'BTC',
  45000,  // BTC rate in PHP
  'PHP',
  1,      // PHP rate
  'cryptocurrency'
)
console.assert(result.isValid === true)
console.assert(result.amount > 0)
```

## Files Changed

1. **NEW**: `src/lib/depositValidationService.js` (368 lines)
   - Core validation and calculation logic

2. **MODIFIED**: `src/components/Deposits.jsx`
   - Updated `handleInitiateDeposit` function
   - Added import for validation service
   - Added comprehensive error handling

3. **MODIFIED**: `src/lib/cryptoRatesService.js`
   - Disabled database writes to avoid RLS issues
   - Rates cached in-memory instead

## Future Improvements

1. **Edge Functions**: For critical operations, use Supabase Edge Functions with service role
2. **Audit Logging**: Log all validation failures for analytics
3. **Rate Caching**: Implement Redis-based rate caching
4. **Batch Validation**: Validate multiple deposits in parallel
5. **Webhooks**: Send deposit events to external services

## Support

If you encounter SQL errors in deposits:

1. Check the browser console for validation error messages
2. Review the deposit record builder output
3. Verify wallet currency matches deposit currency
4. Ensure exchange rates are available
5. Check for invalid characters in reference numbers
