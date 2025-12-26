# Deposit System Improvements Summary

## Issues Addressed

### 1. **Exchange Rate Problem**
- **Issue**: Exchange rate of 239,623.25413 for ADA→BTC conversion is incorrect
- **Root Cause**: Data stored in `public.pairs` table appears to have incorrect/corrupted values
- **Action Required**: 
  1. Audit `public.pairs` table for invalid rates
  2. Recalculate and update rates from reliable sources (CoinGecko, OpenExchangeRates, etc.)
  3. Add rate validation triggers to prevent invalid rates from being stored

### 2. **Hardcoded Capacity Limits**
- **Issue**: User balances limited to 99,999.00 and deposit methods had maxAmount constraints
- **Solution**: Removed all `maxAmount` field from deposit method configurations in `src/lib/depositService.js`
- **Affected Methods**:
  - Stripe (was: 99,999)
  - GCash (was: 50,000)
  - PayMaya (was: 50,000)
  - InstaPay (was: 100,000)
  - Coins.ph (was: 1,000,000)
  - Crypto Direct (was: 999,999)
  - Bank Transfer (was: 999,999)
  - Wise (was: 999,999)
  - Remitly (was: 10,000)
  - PayPal (was: 60,000)
  - Wallet Balance (was: 999,999)
  - dLocal (was: 500,000)
  - Circle (was: 999,999)
  - Flutterwave (was: 100,000)
  - Checkout.com (was: 500,000)
  - MoonPay (was: 50,000)
  - Ramp (was: 1,000,000)
  - Binance Pay (was: 999,999)
  - Crypto.com Pay (was: 500,000)

### 3. **Enhanced Wallet Transactions with Deposit Metadata**

#### SQL Migration Created: `0123_enhance_wallet_transactions_with_deposit_metadata.sql`

**New Columns Added to wallet_transactions:**
```sql
- original_amount (NUMERIC) - Original amount before conversion
- original_currency (TEXT) - Currency of original amount (ADA, USD, etc.)
- received_amount (NUMERIC) - Amount received after conversion
- received_currency (TEXT) - Currency of wallet where deposit received
- exchange_rate (NUMERIC) - Conversion rate applied
- rate_source (TEXT) - Source of rate (public.pairs, coingecko, manual, etc.)
- deposit_method (TEXT) - Method used (gcash, btc, ada, etc.)
- payment_reference (TEXT) - Payment reference from the method
- conversion_fee (NUMERIC) - Fee charged for conversion
- conversion_fee_currency (TEXT) - Currency of conversion fee
- net_received_amount (NUMERIC) - Amount after fees
- approved_at (TIMESTAMP) - When deposit was approved
- approved_by (UUID) - Who approved the deposit (system/admin/user ID)
- reversal_reason (TEXT) - Reason if deposit was reversed
```

**Indexes Created for Performance:**
1. `idx_wallet_tx_deposit_details` - Composite index on (deposit_id, type, original_currency, received_currency, created_at)
2. `idx_wallet_tx_currency_pair` - Index on (original_currency, received_currency) for conversion lookups
3. `idx_wallet_tx_exchange_rate` - Index on (exchange_rate, rate_source) for rate auditing

**Enhanced Metadata Structure:**
```json
{
  "approved_at": "2025-12-26T03:33:18.75391Z",
  "approved_by": "system",
  "currency_code": "BTC",
  "exchange_rate": 239623.25413000,
  "original_amount": 99999.00000000,
  "received_amount": 23962085789.79305000,
  "original_currency": "ADA",
  "received_currency": "BTC",
  "deposit_method": "ada",
  "payment_reference": "addr1vxs8l5cw4vczt00m4va5yqy3ygtgu6rdequn82ncq3umn3stg67g2",
  "rate_source": "public.pairs",
  "conversion_fee": null,
  "conversion_fee_currency": null,
  "net_received_amount": null
}
```

**Updated Functions:**
1. `record_ledger_transaction()` - Now accepts 21 parameters including all deposit metadata
2. `trigger_auto_credit_on_deposit_approval()` - Populates all new columns when creating wallet transactions
3. `sync_wallet_balance_on_deposit_delete()` - Updated to maintain audit trail with proper metadata

## Database Query Examples

### Get Complete Deposit History with Conversion Details
```sql
SELECT 
  wallet_id,
  original_amount,
  original_currency,
  received_amount,
  received_currency,
  exchange_rate,
  rate_source,
  approved_at,
  approved_by,
  created_at
FROM wallet_transactions 
WHERE wallet_id = '<wallet_id>' 
  AND type LIKE 'deposit_%'
ORDER BY created_at DESC;
```

### Audit Exchange Rates by Source
```sql
SELECT 
  rate_source,
  COUNT(*) as transaction_count,
  AVG(exchange_rate) as avg_rate,
  MIN(exchange_rate) as min_rate,
  MAX(exchange_rate) as max_rate
FROM wallet_transactions
WHERE type = 'deposit_approved' AND rate_source IS NOT NULL
GROUP BY rate_source;
```

### Find Deposits by Currency Pair
```sql
SELECT * FROM wallet_transactions
WHERE original_currency = 'ADA' 
  AND received_currency = 'BTC'
ORDER BY created_at DESC;
```

### Deposit Method Usage Statistics
```sql
SELECT 
  deposit_method,
  COUNT(*) as total_deposits,
  SUM(received_amount) as total_received,
  AVG(exchange_rate) as avg_rate
FROM wallet_transactions
WHERE type = 'deposit_approved' AND deposit_method IS NOT NULL
GROUP BY deposit_method
ORDER BY total_deposits DESC;
```

## Next Steps

### Immediate Actions Required

1. **Fix Exchange Rate Data**
   - Audit `public.pairs` table for all ADA→BTC conversions
   - Verify rate against CoinGecko API (current market rate ~0.00004 BTC per ADA)
   - If 239,623.25413 is stored, this represents INVERTED direction (BTC→ADA should be ~23962.x)
   - Update all incorrect historical rates
   - Consider implementing rate validation constraints in database

2. **Deploy SQL Migration**
   - Run migration `0123_enhance_wallet_transactions_with_deposit_metadata.sql` in Supabase
   - Verify all new columns are created
   - Test deposit functions with new parameters

3. **Update Deposit Recording Code**
   - Update `src/lib/multiCurrencyDepositService.js` to pass all 21 parameters to `record_ledger_transaction()`
   - Update `src/components/Deposits.jsx` to handle new metadata fields
   - Ensure rate sources are properly tracked (not just hardcoded to "public.pairs")

4. **Add Rate Source Validation**
   - Implement function to verify rates before storing
   - Add alerts for anomalous exchange rates
   - Log rate updates for audit trail

5. **Rate Fetching Strategy**
   - Consider PRIMARY source: CoinGecko API (most reliable for crypto)
   - SECONDARY source: OpenExchangeRates (for fiat rates)
   - TERTIARY fallback: `public.pairs` (but with validation)
   - Avoid hardcoding any rates

### Testing Recommendations

1. Test deposit with corrected ADA→BTC rate
2. Verify all new columns are populated correctly
3. Verify metadata JSON contains complete deposit information
4. Test queries for audit trails and reporting
5. Verify cascade delete still works (deposit deleted → related transactions deleted)

## Impact Analysis

### Positive Changes
✅ Unlimited deposit amounts (no artificial constraints)
✅ Complete audit trail with all deposit metadata
✅ Better performance with denormalized columns + indexes
✅ Easy reporting and analytics on conversion rates
✅ Separation of concerns (deposit data tracked separately from generic transactions)

### Breaking Changes
⚠️ Code calling `record_ledger_transaction()` needs to pass new parameters
⚠️ Applications reading wallet_transactions need to handle new columns (will be null for non-deposit transactions)
⚠️ Deposit approval process needs to pass rate_source and other metadata

### Performance Impact
✅ Positive: New indexes will speed up deposit-related queries
✅ Positive: Denormalized columns avoid joins
✅ Neutral: Trigger function is more complex but runs during write (not read)

## Rate Fix Priority

🚨 **HIGH PRIORITY**: The 239,623.25413 rate appears to be completely incorrect:
- Current market rate ADA→BTC: ~0.00004
- Stored rate: ~239,623 (inverted and wrong)
- User received 23,962,085,789 BTC for 99,999 ADA when should receive ~4 BTC

This needs immediate investigation and correction.

