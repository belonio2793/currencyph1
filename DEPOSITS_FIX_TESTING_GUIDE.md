# Testing & Verification Guide: Deposits Three-Currency Fix

## Quick Start

The fix is now live in your code. Here's how to test it:

## Pre-Deployment Checklist

- [ ] SQL migration deployed: `0121_fix_deposit_currency_mapping.sql`
- [ ] Frontend code deployed: `src/components/Deposits.jsx` and `src/lib/multiCurrencyDepositService.js`
- [ ] Database migrations applied successfully
- [ ] No errors in Supabase logs

## Test Scenario 1: The Bug Case (90,000 USD via Ethereum)

This is the exact scenario from your bug report.

### Setup
1. User has a **PHP wallet**
2. User selects: **90,000 USD** (input)
3. User selects payment: **Ethereum**

### What You Should See in UI

#### Step 1: Amount Entry
```
How much would you like to deposit?
[90000] [USD dropdown]
```

#### Step 2: Method Selection
Shows all available payment methods (GCash, Bitcoin, Ethereum, etc.)

#### Step 3: Confirmation Page

Should display the **Three-Currency Model** clearly:

```
═══════════════════════════════════════════════════════════
🔄 Three-Currency Deposit Model
═══════════════════════════════════════════════════════════

1️⃣ INPUT CURRENCY (What you specify)
┌─────────────────────────────────────┐
│ 90,000.00 USD                       │
└─────────────────────────────────────┘

2️⃣ PAYMENT CURRENCY (How you pay)
┌─────────────────────────────────────┐
│ 0.03 ETH (approximately)            │
│ Send this amount via Ethereum       │
└─────────────────────────────────────┘

3️⃣ WALLET CURRENCY (What you receive)
┌─────────────────────────────────────┐
│ 4,500,000.00 PHP (approximately)    │
│ Credited to your PHP wallet         │
└─────────────────────────────────────┘

⚠️ Make sure you understand all three steps:
  • You specify: 90,000.00 USD
  • You send: 0.03 ETH
  • You receive: ~4,500,000.00 PHP
═══════════════════════════════════════════════════════════
```

#### CRITICAL WARNING Box

Should show:

```
⚠️ CRITICAL: Verify Before Sending
═══════════════════════════════════════════════════════════
You are making a multi-currency deposit. Understand all three steps:

1️⃣ You Specify: 90,000.00 USD
   This is the amount you're depositing in your chosen currency

2️⃣ You Send: 0.03 ETH
   This is the ACTUAL amount you need to send (different from step 1!)

3️⃣ You Receive: ~4,500,000.00 PHP
   This is what gets credited to your wallet

🔴 DO NOT send USD to an Ethereum address. You will lose your funds!
═══════════════════════════════════════════════════════════
```

### What Should Happen in Database

After confirming the deposit, check the database:

```sql
SELECT 
  id,
  user_id,
  input_amount,
  input_currency,
  payment_method_currency,
  payment_amount,
  currency_code,
  received_amount,
  status,
  created_at
FROM deposits
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**
```
id:                         (UUID)
user_id:                    (your-user-id)
input_amount:               90000.00        ✓ CORRECT
input_currency:             USD             ✓ CORRECT
payment_method_currency:    ETH             ✓ CORRECT
payment_amount:             0.03            ✓ CORRECT (approx)
currency_code:              PHP             ✓ CORRECT
received_amount:            4500000.00      ✓ CORRECT (approx)
status:                     pending
created_at:                 (timestamp)
```

### Success Modal

After submission, the success modal should show:

```
═══════════════════════════════════════════════════════════
                    ✓ Deposit Confirmed!
        Your deposit has been initiated successfully
═══════════════════════════════════════════════════════════

🔄 Deposit Details

1️⃣ You Specified
┌─────────────────────────────────────┐
│ 90,000.00 USD                       │
└─────────────────────────────────────┘

2️⃣ Send via ETHEREUM
┌─────────────────────────────────────┐
│ 0.03 ETH                            │
└─────────────────────────────────────┘

3️⃣ You'll Receive
┌─────────────────────────────────────┐
│ 4,500,000.00 PHP                    │
└─────────────────────────────────────┘

═══════════════════════════════════════════════════════════
```

## Test Scenario 2: Same Currency Deposit (10,000 PHP via GCash)

### Setup
1. User has a **PHP wallet**
2. User selects: **10,000 PHP**
3. User selects payment: **GCash**

### Expected Behavior
- **No three-currency warning** (currencies are the same)
- Should show: "✓ No conversion needed - same currency"
- `payment_method_currency` should be **NULL** in database
- `payment_amount` should be **NULL** in database
- `input_amount`: 10,000
- `received_amount`: 10,000

## Test Scenario 3: Fiat to Fiat Conversion (100 USD → PHP wallet)

### Setup
1. User has a **PHP wallet**
2. User selects: **100 USD**
3. User selects payment: **GCash** (fiat method)

### Expected Behavior
- **No three-currency warning** (both input and payment are fiat)
- Shows conversion: 100 USD → 5,000 PHP
- `payment_method_currency`: NULL (GCash doesn't have a currency code)
- Database should show conversion with proper rates

## Test Scenario 4: Crypto to Crypto (0.5 BTC → PHP wallet)

### Setup
1. User has a **PHP wallet**
2. User selects: **0.5 BTC**
3. User selects payment: **Bitcoin** (BTC address)

### Expected Behavior
- **No three-currency warning** (both are same cryptocurrency)
- Shows conversion from BTC to PHP
- Database shows single conversion chain

## Manual Verification Tests

### Test 1: Verify Three-Currency Model is Populated

```sql
-- Check that new columns are being used
SELECT 
  COUNT(*) as total_deposits,
  COUNT(CASE WHEN input_currency IS NOT NULL THEN 1 END) as with_input_currency,
  COUNT(CASE WHEN payment_method_currency IS NOT NULL THEN 1 END) as with_payment_currency
FROM deposits
WHERE created_at > NOW() - INTERVAL '1 day';
```

### Test 2: Verify Conversion Math

For multi-currency deposits, verify the math is correct:

```sql
-- For deposits with all three currencies
SELECT 
  id,
  input_amount,
  input_currency,
  payment_method_currency,
  payment_amount,
  received_amount,
  currency_code,
  -- Calculate expected payment amount
  (input_amount * (
    SELECT rate FROM pairs 
    WHERE from_currency = input_currency 
    AND to_currency = payment_method_currency
    LIMIT 1
  )) as expected_payment_amount,
  -- Calculate expected received amount
  (input_amount * (
    SELECT rate FROM pairs 
    WHERE from_currency = input_currency 
    AND to_currency = currency_code
    LIMIT 1
  )) as expected_received_amount
FROM deposits
WHERE payment_method_currency IS NOT NULL
AND created_at > NOW() - INTERVAL '7 days'
LIMIT 10;
```

### Test 3: Verify Validation Trigger

The database has a validation trigger that prevents invalid deposits. Test it:

```sql
-- This should FAIL with validation error
INSERT INTO deposits (
  user_id, wallet_id, amount,
  input_amount, input_currency,
  payment_method_currency, payment_amount,
  currency_code, received_amount,
  deposit_method, status
) VALUES (
  'test-user', 'test-wallet', 100,
  100, 'USD',
  'ETH', NULL,  -- Invalid: payment_amount is NULL but payment_method_currency is set
  'PHP', 5000,
  'ethereum', 'pending'
);
-- Expected: ERROR: Invalid deposit: payment_method_currency set but payment_amount is missing or <= 0
```

### Test 4: Check Three-Currency View

```sql
-- View all deposits with three-currency model
SELECT * FROM deposits_three_currency_model
WHERE created_at > NOW() - INTERVAL '7 days'
LIMIT 10;
```

## Verification Checklist

### UI/UX Verification
- [ ] Input currency selector shows all available currencies
- [ ] Payment method selection shows correct methods for selected currency
- [ ] Three-currency model displays correctly for multi-currency deposits
- [ ] Warning box appears for multi-currency deposits
- [ ] Success modal shows all three currencies
- [ ] No warnings/errors in browser console

### Database Verification
- [ ] New columns exist: input_amount, input_currency, payment_method_currency, payment_amount
- [ ] Deposits created after fix have values in new columns
- [ ] Conversion math is correct (can verify with rates table)
- [ ] Validation trigger prevents invalid deposits
- [ ] Indexes created successfully

### Logic Verification
- [ ] For 90,000 USD → ETH → PHP: input=90000 USD, payment≈0.03 ETH, received≈4.5M PHP
- [ ] For 100 PHP → GCash → PHP: input=100 PHP, payment=NULL, received=100 PHP
- [ ] All three currencies properly separated in code and database

### Existing Data
- [ ] Old deposits still work (backward compatible)
- [ ] Old deposits without new columns don't cause errors
- [ ] Migration helper can populate existing multi-currency deposits

## Troubleshooting

### Issue: Three-Currency Model Not Showing in UI

**Check:**
1. Is `selectedAddressMethod` set correctly?
2. Is `selectedCurrency !== selectedAddressMethod?.cryptoSymbol?.toUpperCase()`?
3. Check browser console for errors

**Fix:**
- Ensure Deposits.jsx changes were deployed
- Clear browser cache and reload
- Check that deposits component is using latest code

### Issue: Database Columns Don't Exist

**Check:**
1. Migration `0121_fix_deposit_currency_mapping.sql` was executed
2. Check Supabase > SQL Editor > Migrations

**Fix:**
```sql
-- Manually create columns if migration didn't run
ALTER TABLE deposits
ADD COLUMN IF NOT EXISTS input_amount NUMERIC(36, 8),
ADD COLUMN IF NOT EXISTS input_currency VARCHAR(16),
ADD COLUMN IF NOT EXISTS payment_method_currency VARCHAR(16),
ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(36, 8);
```

### Issue: Payment Amount Shows as NULL

**Check:**
1. Does `paymentMethodCurrency` parameter exist in service call?
2. Is exchange rate available in pairs table?
3. Check browser console for conversion errors

**Fix:**
- Ensure exchange rates are fetched: `SELECT * FROM pairs LIMIT 10;`
- Check that conversion service can fetch rates

### Issue: Success Modal Shows Old Format

**Check:**
1. Was Deposits.jsx redeployed?
2. Is browser showing cached version?

**Fix:**
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Clear browser cache
- Check that component uses `lastSuccessDeposit.payment_amount`

## Performance Testing

### Load Testing for Multi-Currency Conversions

```sql
-- This might be slow if many deposits exist
SELECT COUNT(*) FROM deposits
WHERE input_currency IS NOT NULL
  AND payment_method_currency IS NOT NULL
  AND payment_amount IS NOT NULL;
```

**Indexes should exist:**
```sql
SELECT * FROM pg_indexes
WHERE tablename = 'deposits'
AND indexname LIKE 'idx_deposits_%';
```

## Regression Testing

### Test Old Features Still Work

1. **GCash Deposits** (fiat): 10,000 PHP via GCash
2. **Crypto Direct**: 1 BTC to BTC wallet (same currency)
3. **Simple Conversion**: 100 USD to PHP wallet
4. **Multiple deposits**: Create 5+ deposits to ensure bulk behavior

## Sign-Off Checklist

Before considering the fix complete, verify:

- [ ] All four test scenarios work without errors
- [ ] Database has correct values in all columns
- [ ] UI displays three-currency model clearly for multi-currency deposits
- [ ] Warning box appears and is understandable
- [ ] Success modal shows accurate information
- [ ] No console errors or warnings
- [ ] Existing deposits still appear correctly
- [ ] Cannot accidentally send wrong amount (UI makes it clear)
- [ ] Performance is acceptable (no slowdowns)
- [ ] Ready for production use

## Support & Debugging

### Enable Debug Logging

In Deposits.jsx, look for console.debug statements. They show:
- Input currency
- Payment currency
- Exchange rates used
- Final amounts

Check browser DevTools Console (F12) for messages like:
```
[Deposits] Deposit success - Three-Currency Details: {
  inputAmount: 90000,
  inputCurrency: "USD",
  paymentMethodCurrency: "ETH",
  paymentAmount: 0.03,
  ...
}
```

### Database Debugging

```sql
-- View the most recent deposits with full details
SELECT 
  id, user_id, status,
  input_amount, input_currency,
  payment_method_currency, payment_amount,
  received_amount, currency_code,
  created_at
FROM deposits
ORDER BY created_at DESC
LIMIT 10;

-- Check metadata for audit trail
SELECT 
  id,
  metadata->>'input_currency' as meta_input_currency,
  metadata->>'payment_method_currency' as meta_payment_currency,
  notes->'three_currency_model' as three_currency_model,
  notes->'bug_fix_applied' as bug_fix_applied
FROM deposits
WHERE created_at > NOW() - INTERVAL '7 days'
LIMIT 10;
```

## Next Steps

Once you've verified all tests pass:

1. **Announce the fix** to users
2. **Run migration helper** to populate existing multi-currency deposits (optional)
3. **Monitor** for any edge cases in production
4. **Gather feedback** from users

---

## Questions?

If you encounter issues:
1. Check the troubleshooting section above
2. Review the main fix documentation: `DEPOSITS_THREE_CURRENCY_MODEL_FIX.md`
3. Check database logs in Supabase Dashboard
4. Check browser console for error messages
