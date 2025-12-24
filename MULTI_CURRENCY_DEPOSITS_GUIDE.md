# Multi-Currency Deposits System

## Overview

The multi-currency deposit system enables users to deposit funds in **any currency** into **any user-created wallet** with automatic rate conversion and proper SQL insertion.

### Key Features

✅ **Cross-Currency Deposits**: Deposit BTC to PHP wallet, USD to EUR wallet, etc.
✅ **Automatic Conversion**: Exchange rates calculated in real-time or from database cache
✅ **All Currency Types**: Supports fiat-to-fiat, crypto-to-crypto, and cross-conversions
✅ **SQL Ready**: All data properly formatted and inserted into `public.deposits` table
✅ **Rate Caching**: Reduces API calls by checking database first

## Architecture

### Components

#### 1. **multiCurrencyDepositService** (`src/lib/multiCurrencyDepositService.js`)
Core service handling all deposit logic:
- `getExchangeRate(fromCurrency, toCurrency)` - Fetch or calculate rates
- `convertAmount(amount, fromCurrency, toCurrency)` - Convert and round amounts
- `createMultiCurrencyDeposit(options)` - Build and insert deposit record

#### 2. **Deposits Component** (`src/components/Deposits.jsx`)
Updated UI that allows:
- Selection of ANY currency to deposit
- Selection of ANY wallet as destination
- Real-time conversion preview
- Comprehensive deposit summary

#### 3. **Database Schema** (Already exists)
Deposits table with new fields:
- `received_currency` - Target wallet currency
- `exchange_rate` - Conversion rate used
- `converted_amount` - Final amount after conversion
- `metadata` - JSON for additional conversion details

## How It Works

### 1. User Selects Deposit Currency & Wallet

```javascript
// User can now do this (cross-currency)
Deposit 10000 BTC → PHP Wallet ✅ (Previously: ❌ Only matching currency)
Deposit 5000 USD → EUR Wallet ✅ (Previously: ❌ Only matching currency)
```

### 2. Service Gets Exchange Rate

```javascript
// If same currency, rate = 1
// If different, fetches from:
// 1. Database cache (rates table)
// 2. API (currencyAPI for fiat, cryptoRatesService for crypto)
// 3. Cross-rate calculation (crypto-to-crypto via USD)
```

### 3. Amount Conversion

```javascript
// Example: 10000 BTC to PHP
// 1. Get rate: 1 BTC = 2,800,000 PHP
// 2. Calculate: 10000 * 2800000 = 28,000,000,000 PHP
// 3. Round: 28,000,000,000.00 (2 decimals for PHP)
```

### 4. Insert into Database

```sql
INSERT INTO public.deposits (
  user_id,
  wallet_id,
  amount,                    -- 10000
  currency_code,             -- BTC
  received_currency,         -- PHP
  exchange_rate,             -- 2800000
  converted_amount,          -- 28000000000.00
  deposit_method,            -- 'solana'
  status,                    -- 'pending'
  metadata,                  -- { conversion_rate: 2800000, ... }
  created_at,
  updated_at
) VALUES (...)
```

## Usage Examples

### From Component Code

```javascript
import { multiCurrencyDepositService } from '../lib/multiCurrencyDepositService'

// Create a deposit
const result = await multiCurrencyDepositService.createMultiCurrencyDeposit({
  userId: 'user-123',
  walletId: 'wallet-456',
  amount: 10000,
  depositCurrency: 'BTC',        // Source currency
  walletCurrency: 'PHP',         // Target wallet currency
  depositMethod: 'solana',
  paymentReference: 'TXN123',
  metadata: { notes: 'Cross-currency deposit' }
})

if (result.success) {
  console.log('Deposit created:', result.deposit)
  console.log('Conversion:', result.conversion)
  // { rate: 2800000, toAmount: 28000000000, ... }
} else {
  console.error('Error:', result.error)
}
```

### From Script (Testing/Demo)

```javascript
// Run the demo script to generate test deposits
node scripts/generate-multi-currency-deposits.js
```

This generates sample deposits like:
- 10000 BTC → 28,000,000,000 PHP
- 5000 USD → 4,600 EUR
- 2 ETH → 340,000 CAD
- 50000 PHP → 900 USD

## Supported Currency Pairs

### Fiat-to-Fiat Conversions
All combinations of: PHP, USD, EUR, GBP, CAD, AUD, JPY, etc.

### Crypto-to-Crypto Conversions
- BTC ↔ ETH, SOL, ADA, XRP, DOGE, USDT, USDC, BCH, LTC
- Any combination with cross-rate via USD

### Cross Conversions
- Crypto-to-Fiat: BTC → PHP, ETH → EUR, etc.
- Fiat-to-Crypto: USD → BTC, EUR → ETH, etc.

## Exchange Rate Sources

### Database (Cache)
```sql
SELECT rate FROM rates 
WHERE currency_code = 'USD' 
  AND base_currency = 'PHP'
```

### APIs (Fallback)
- **Fiat**: `currencyAPI.getGlobalRates()` (OpenExchangeRates)
- **Crypto**: `getCryptoPrice()` (CoinGecko via cryptoRatesService)

### Calculation
For crypto-to-crypto: `rate = fromPrice / toPrice` (both in USD)

## Data Validation

### Deposit Record Validation
- User exists and owns wallet
- Wallet exists and matches user
- Amount > 0 and is valid number
- Currencies exist and are active
- Exchange rate is valid (finite, > 0)
- Converted amount is valid

### Amount Rounding
- Fiat currencies (USD, EUR, GBP, PHP, JPY): 2 decimal places
- Cryptocurrencies: 8 decimal places
- Exchange rate: 6 decimal places

## Database Insertion

### Success Flow
```
convertAmount() → getExchangeRate() → validation → INSERT → Success
```

### Error Handling
- Invalid rate: Error message with currency pair
- Network issue: Retry logic in cryptoRatesService
- Database constraint: User-friendly error (invalid wallet, etc.)
- Duplicate: UNIQUE constraint on `external_tx_id`

## Advanced Usage

### Get All Currency Pairs Available

```javascript
const pairs = await multiCurrencyDepositService.getAvailablePairs(userId)
// Returns array of:
// { from: { code, type, name }, to: { code, type, name } }
```

### Check Exchange Rate Before Deposit

```javascript
const rateData = await multiCurrencyDepositService.getExchangeRate('BTC', 'PHP')
// { rate: 2800000, fromCurrency: 'BTC', toCurrency: 'PHP', source: 'api' }
```

### Convert Amount Without Creating Deposit

```javascript
const conversion = await multiCurrencyDepositService.convertAmount(
  10000,    // amount
  'BTC',    // from
  'PHP'     // to
)
// { fromAmount, toAmount, rate, rateRounded, ... }
```

## Testing

### Generate Demo Deposits

```bash
# Requires environment variables:
# - VITE_PROJECT_URL
# - SUPABASE_SERVICE_ROLE_KEY

node scripts/generate-multi-currency-deposits.js
```

### Manual Testing
1. Go to `/deposits` page
2. Create wallets for different currencies (PHP, USD, EUR, etc.)
3. Try depositing:
   - 10000 BTC to PHP wallet
   - 5000 USD to EUR wallet
   - 2 ETH to CAD wallet
4. Verify in database: `SELECT * FROM deposits ORDER BY created_at DESC`

## SQL Queries for Analysis

### See All Multi-Currency Deposits
```sql
SELECT 
  amount, currency_code,
  converted_amount, received_currency,
  exchange_rate,
  created_at
FROM deposits
WHERE currency_code != received_currency
ORDER BY created_at DESC
```

### Calculate Total Value by Target Currency
```sql
SELECT 
  received_currency,
  SUM(converted_amount) as total_received,
  COUNT(*) as deposit_count
FROM deposits
GROUP BY received_currency
```

### Track Conversion Rates Used
```sql
SELECT 
  currency_code, received_currency,
  AVG(exchange_rate) as avg_rate,
  MAX(exchange_rate) as max_rate,
  MIN(exchange_rate) as min_rate,
  COUNT(*) as conversion_count
FROM deposits
WHERE currency_code != received_currency
GROUP BY currency_code, received_currency
```

## Common Issues & Solutions

### Issue: "Could not fetch exchange rates"
**Cause**: API is down or rate not available
**Solution**: Check `exchangeRates` state, ensure API keys are configured

### Issue: "Invalid rate calculated"
**Cause**: Rate is 0, negative, or NaN
**Solution**: Check source API response, verify currencies are active

### Issue: "Wallet not found or access denied"
**Cause**: Wrong wallet ID or user doesn't own wallet
**Solution**: Verify wallet belongs to user before deposit

### Issue: Database constraint error
**Cause**: Invalid wallet_id or user_id foreign key
**Solution**: Ensure wallet exists and is owned by user

## Future Enhancements

- [ ] Rate locking: Lock rate for 30 seconds after user selects
- [ ] Minimum conversion: Prevent conversions below threshold
- [ ] Fee calculation: Add platform fees to conversion
- [ ] Rate history: Track and display historical rates
- [ ] Bulk deposits: Process multiple deposits at once
- [ ] Scheduled deposits: Recurring deposits on fixed schedule

## Changelog

### v1.0 (Current)
- ✅ Multi-currency deposit support
- ✅ Automatic rate fetching and conversion
- ✅ Cross-currency pair handling
- ✅ Database integration
- ✅ Demo script with sample data

---

**Last Updated**: 2024
**Maintainer**: Currency.ph Development Team
