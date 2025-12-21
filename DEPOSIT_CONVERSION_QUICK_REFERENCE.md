# Deposit Currency Conversion - Quick Reference

## For Developers

### Check if Conversion is Needed
```javascript
import { depositConversionService } from './lib/depositConversionService'

// Check if deposit needs conversion
const needsConversion = await depositConversionService.needsConversion(deposit, wallet)

if (needsConversion) {
  const conversion = await depositConversionService.getConversionDetails(deposit, wallet)
  // Show confirmation modal
}
```

### Get Conversion Details
```javascript
const conversion = await depositConversionService.getConversionDetails(deposit, wallet)

console.log(conversion)
// {
//   fromCurrency: 'BCH',
//   toCurrency: 'PHP',
//   originalAmount: 3443,
//   exchangeRate: 1234.56,
//   convertedAmount: 4250281.08,
//   rateSource: 'coingecko',
//   rateUpdatedAt: '2024-01-15T10:30:00Z',
//   timestamp: '2024-01-15T10:31:00Z'
// }
```

### Show Confirmation Modal
```jsx
import { DepositConversionConfirmation } from './components/DepositConversionConfirmation'

function DepositApprovalPage() {
  const [showConversion, setShowConversion] = useState(false)
  const [conversion, setConversion] = useState(null)

  const handleApprove = async (depositId) => {
    const deposit = await fetchDeposit(depositId)
    const wallet = await fetchWallet(deposit.wallet_id)

    if (deposit.currency_code !== wallet.currency_code) {
      const conv = await depositConversionService.getConversionDetails(deposit, wallet)
      setConversion(conv)
      setShowConversion(true)
      return
    }

    // Same currency - approve directly
    await approveDeposit(depositId)
  }

  const handleConfirmConversion = async () => {
    await depositConversionService.confirmConversion(depositId, conversion)
    await approveDeposit(depositId)
    setShowConversion(false)
  }

  return (
    <>
      {/* Your approval button */}
      <button onClick={() => handleApprove(depositId)}>Approve</button>

      {/* Conversion modal */}
      <DepositConversionConfirmation
        isOpen={showConversion}
        deposit={deposit}
        walletCurrency={wallet.currency_code}
        conversion={conversion}
        onConfirm={handleConfirmConversion}
        onReject={() => setShowConversion(false)}
        onClose={() => setShowConversion(false)}
      />
    </>
  )
}
```

### Confirm Conversion
```javascript
// After user confirms in modal
const result = await depositConversionService.confirmConversion(depositId, conversion)

if (result.success) {
  console.log('Conversion confirmed')
  // Proceed with deposit approval
  await approveDeposit(depositId)
} else {
  console.error('Conversion failed:', result.error)
}
```

### Reject Conversion
```javascript
const result = await depositConversionService.rejectConversion(
  depositId,
  'User rejected unfavorable rate'
)

if (result.success) {
  console.log('Conversion rejected - deposit stays pending')
  // User can try again or contact support
}
```

### Get Audit History
```javascript
const audit = await depositConversionService.getConversionAudit(depositId)

// Shows all conversion actions:
// - conversion_initiated
// - conversion_confirmed
// - conversion_rejected
// - conversion_applied

audit.forEach(entry => {
  console.log(`${entry.action}: ${entry.received_amount} ${entry.received_currency} → ${entry.converted_amount} ${entry.wallet_currency}`)
})
```

## For Admin UI

### Get All Conversions Needing Approval
```javascript
const pendingConversions = await depositConversionService.getDepositsNeedingConversion(100)

// Shows deposits with currency mismatches that are pending
pendingConversions.forEach(d => {
  console.log(`${d.currency_code} → ${d.wallets[0].currency_code}: ${d.amount}`)
})
```

### Bulk Approve/Reject Conversions
```javascript
const results = await depositConversionService.batchUpdateConversions([
  {
    depositId: 'uuid-1',
    approved: true,
    conversion: conversionData1
  },
  {
    depositId: 'uuid-2',
    approved: false  // Reject
  },
  // ... more
])

console.log(`Successful: ${results.successful}, Failed: ${results.failed}`)
if (results.errors.length > 0) {
  results.errors.forEach(e => console.error(`${e.depositId}: ${e.error}`))
}
```

## Database Queries

### Check Deposits Needing Conversion
```sql
SELECT d.id, d.amount, d.currency_code,
       w.currency_code as wallet_currency,
       d.conversion_status
FROM deposits d
JOIN wallets w ON d.wallet_id = w.id
WHERE d.currency_code != w.currency_code
  AND d.status = 'pending'
ORDER BY d.created_at DESC;
```

### View Conversion Audit Trail
```sql
SELECT * FROM deposit_conversion_audit
WHERE deposit_id = 'uuid'
ORDER BY created_at DESC;
```

### Check Exchange Rates
```sql
SELECT * FROM crypto_rates_valid
WHERE from_currency = 'BCH'
  AND to_currency = 'PHP'
ORDER BY updated_at DESC
LIMIT 1;
```

### Find Old Conversions
```sql
SELECT d.id, d.amount, d.currency_code,
       d.received_currency, d.exchange_rate,
       d.converted_amount, d.conversion_status
FROM deposits d
WHERE d.conversion_status IN ('confirmed', 'rejected')
  AND d.created_at > NOW() - INTERVAL '7 days'
ORDER BY d.created_at DESC;
```

## API Endpoints (if implementing)

### Check Conversion Needed
```
GET /api/deposits/:depositId/conversion-status

Response:
{
  "needsConversion": true,
  "fromCurrency": "BCH",
  "toCurrency": "PHP"
}
```

### Get Conversion Details
```
GET /api/deposits/:depositId/conversion-details

Response:
{
  "fromCurrency": "BCH",
  "toCurrency": "PHP",
  "originalAmount": 3443,
  "exchangeRate": 1234.56,
  "convertedAmount": 4250281.08,
  "rateSource": "coingecko",
  "rateUpdatedAt": "2024-01-15T10:30:00Z"
}
```

### Confirm Conversion
```
POST /api/deposits/:depositId/confirm-conversion

Body:
{
  "exchangeRate": 1234.56,
  "convertedAmount": 4250281.08
}

Response:
{
  "success": true,
  "conversion_status": "confirmed"
}
```

### Reject Conversion
```
POST /api/deposits/:depositId/reject-conversion

Body:
{
  "reason": "Unfavorable rate"
}

Response:
{
  "success": true,
  "conversion_status": "rejected"
}
```

## Common Scenarios

### Scenario 1: User Deposits Crypto to Fiat Wallet
```
1. Deposit: 1 BCH → PHP wallet
2. System detects currency mismatch
3. Fetches BTC/PHP rate (1 BCH = 1234.56 PHP)
4. Calculates: 1 * 1234.56 = 1234.56 PHP
5. Shows modal to user
6. User sees: "1 BCH → 1234.56 PHP"
7. User confirms
8. Wallet credited with 1234.56 PHP
9. Audit logged
```

### Scenario 2: User Deposits Same Currency
```
1. Deposit: 1000 PHP → PHP wallet
2. System detects same currency
3. Skips conversion (sets conversion_status = 'none')
4. Wallet credited with 1000 PHP
5. No confirmation modal shown
6. Fast processing
```

### Scenario 3: User Rejects Conversion
```
1. Deposit: 1 BCH → PHP wallet
2. Modal shown with rate
3. User thinks rate is unfavorable
4. User clicks "Reject"
5. Deposit stays pending with conversion_status = 'rejected'
6. User can create new deposit later if rate improves
```

### Scenario 4: Exchange Rate Unavailable
```
1. Deposit: 1 XYZ → PHP wallet (XYZ is obscure coin)
2. No exchange rate in database
3. Deposit rejected with error
4. User notified to use different currency or contact support
5. Audit logged with error reason
```

## Error Handling

### Handle Missing Rate
```javascript
try {
  const conversion = await depositConversionService.getConversionDetails(deposit, wallet)
  
  if (!conversion) {
    // No rate available
    showError(`Cannot convert ${deposit.currency_code}. Please use another currency.`)
    return
  }

  // Show conversion modal
} catch (error) {
  console.error('Failed to get conversion details:', error)
  showError('Unable to process conversion. Please try again.')
}
```

### Handle Confirmation Error
```javascript
try {
  const result = await depositConversionService.confirmConversion(depositId, conversion)
  
  if (!result.success) {
    showError(`Conversion failed: ${result.error}`)
    return
  }

  showSuccess('Conversion confirmed. Processing deposit...')
} catch (error) {
  console.error('Confirmation error:', error)
  showError('System error. Please contact support.')
}
```

## Monitoring & Alerts

### Set Up Alerts For:
1. ⚠️ Deposits with conversion_status = 'rejected'
   - May indicate users unhappy with rates
   - Consider improving rate sources

2. ⚠️ Stale exchange rates (> 1 hour old)
   - Check `crypto_rates` table
   - Ensure rate population is working

3. ⚠️ Conversion audit errors
   - Check `deposit_conversion_audit` for errors
   - Investigate failed conversions

4. ⚠️ Unusual conversion amounts
   - Monitor for fraud
   - Check if rates are reasonable

## Performance Tips

1. **Cache conversion details** - Don't fetch rates repeatedly
2. **Batch operations** - Use `batchUpdateConversions()` for bulk approvals
3. **Index queries** - Use provided indexes on conversion_status, approved_at
4. **Clean old rates** - Regular cleanup of expired rates in `crypto_rates`

## Testing

### Test with Different Currencies
```javascript
// Test crypto to fiat
const deposit = { amount: 1, currency_code: 'BTC', wallet_id: 'php-wallet' }

// Test fiat to crypto
const deposit = { amount: 1000, currency_code: 'PHP', wallet_id: 'btc-wallet' }

// Test cross-crypto
const deposit = { amount: 1, currency_code: 'BTC', wallet_id: 'eth-wallet' }

// Test same currency (should skip conversion)
const deposit = { amount: 1000, currency_code: 'PHP', wallet_id: 'php-wallet' }
```

### Test Error Cases
```javascript
// Missing exchange rate
// Use currency pair not in database

// Stale rate
// Manually expire rate in database

// Math mismatch
// Try to insert mismatched conversion data
```

---

**Last Updated:** 2024-01-15
**Version:** 1.0
