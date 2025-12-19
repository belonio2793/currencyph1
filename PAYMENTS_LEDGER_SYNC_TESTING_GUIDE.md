# Payments Ledger Sync Testing Guide

## Overview

This document outlines how to verify and test the sync triggers that automatically populate the `public.payments` table from `payment_intents` and `deposit_intents` tables.

## Migration Verification

The sync triggers are defined in: `supabase/migrations/102_create_payments_all_encompassing.sql`

### Triggers Created

1. **Payment Intent Sync Trigger** (`tr_sync_payment_intent_to_payments`)
   - Function: `sync_payment_intent_to_payments()`
   - Event: AFTER UPDATE on `public.payment_intents`
   - Condition: When `status` changes to `'succeeded'`
   - Action: Inserts/updates payment record in `public.payments`

2. **Deposit Intent Sync Trigger** (`tr_sync_deposit_intent_to_payments`)
   - Function: `sync_deposit_intent_to_payments()`
   - Event: AFTER UPDATE on `public.deposit_intents`
   - Condition: When `status` changes to `'completed'`
   - Action: Inserts/updates payment record in `public.payments`

## Test Scenarios

### Scenario 1: Payment Intent Success Sync

**Prerequisites:**
- A merchant exists in `public.merchants`
- A payment link exists in `public.payment_links` (optional)
- An invoice exists in `public.invoices` (optional)

**Steps:**

1. Create a payment intent:
```javascript
const paymentIntent = await paymentsService.createPaymentIntent(
  merchantId,
  {
    payer_id: userId,
    guest_email: 'test@example.com',
    guest_name: 'Test User',
    amount: 100.00,
    currency: 'PHP',
    source_type: 'payment_link',
    reference_id: paymentLinkId,
    payment_link_id: paymentLinkId,
    metadata: {
      payment_method: 'credit_card',
      fee_amount: 2.90,
      net_amount: 97.10
    }
  }
)
```

2. Update payment intent to succeeded:
```javascript
await paymentsService.updatePaymentIntent(paymentIntent.id, {
  status: 'succeeded'
})
```

3. **Verify the sync:**
   - Check `public.payments` table for a record with:
     - `payment_intent_id` = payment_intent.id
     - `status` = 'succeeded'
     - `amount` = 100.00
     - `merchant_id` = merchantId
     - `completed_at` is set
   - Verify `reference_number` is auto-generated (PAY-XXXXXXXX-YYYYMMDD format)

### Scenario 2: Deposit Intent Completion Sync

**Prerequisites:**
- A user (auth.users) exists
- No merchant required for deposits

**Steps:**

1. Create a deposit intent:
```javascript
const depositIntent = await paymentsService.createDepositIntent(
  userId,
  {
    amount: 500.00,
    currency: 'PHP',
    deposit_method: 'bank_transfer',
    metadata: {
      fee_amount: 10.00,
      net_amount: 490.00
    }
  }
)
```

2. Update deposit intent to completed:
```javascript
await paymentsService.updateDepositIntent(depositIntent.id, {
  status: 'completed'
})
```

3. **Verify the sync:**
   - Check `public.payments` table for a record with:
     - `deposit_intent_id` = depositIntent.id
     - `status` = 'succeeded'
     - `amount` = 500.00
     - `payment_type` = 'deposit'
     - `customer_id` = userId
     - `completed_at` is set

### Scenario 3: Guest Payment via Payment Link

**Prerequisites:**
- Guest checkout flow is working

**Steps:**

1. Navigate to a payment link URL: `/payment/{slug}`
2. Complete guest checkout as an unauthenticated user
3. Select payment method (e.g., bank_transfer)
4. Complete the payment

**Verify:**
- Guest name and email should be captured in `public.payments.guest_name` and `public.payments.guest_email`
- `payment_method` should be set to selected method
- Fee calculation should be correct based on payment method
- `net_amount` should equal `amount - fee_amount`

### Scenario 4: Invoice Payment

**Prerequisites:**
- An invoice exists with due amount > 0

**Steps:**

1. Navigate to invoice URL: `/invoice/{invoiceId}`
2. Complete guest or authenticated checkout
3. Successfully pay the invoice amount

**Verify:**
- `public.payments` record should have:
   - `invoice_id` = invoiceId
   - `amount` = invoice.amount_due
   - Status should be 'succeeded'

## Field Mapping Verification

Verify that all fields are correctly mapped from source tables to `public.payments`:

### From payment_intents to payments
- `payment_intent.merchant_id` → `payments.merchant_id` ✓
- `payment_intent.payer_id` → `payments.customer_id` ✓
- `payment_intent.id` → `payments.payment_intent_id` ✓
- `payment_intent.invoice_id` → `payments.invoice_id` ✓
- `payment_intent.payment_link_id` → `payments.payment_link_id` ✓
- `payment_intent.guest_email` → `payments.guest_email` ✓
- `payment_intent.guest_name` → `payments.guest_name` ✓
- `payment_intent.amount` → `payments.amount` ✓
- `payment_intent.currency` → `payments.currency` ✓
- `payment_intent.metadata` → `payments.metadata` ✓
- Status set to 'succeeded' in payments ✓
- `payment_type` set to 'payment' ✓

### From deposit_intents to payments
- `deposit_intent.user_id` → `payments.customer_id` ✓
- `deposit_intent.id` → `payments.deposit_intent_id` ✓
- `deposit_intent.amount` → `payments.amount` ✓
- `deposit_intent.currency` → `payments.currency` ✓
- `deposit_intent.deposit_method` → `payments.payment_method` ✓
- `deposit_intent.metadata` → `payments.metadata` ✓
- Status set to 'succeeded' in payments ✓
- `payment_type` set to 'deposit' ✓

## UI Verification

### PaymentsOverview Tab
- [ ] Recent Payments table shows latest 10 payments from `public.payments`
- [ ] Gross Revenue displays sum of succeeded payment amounts
- [ ] Net Revenue displays sum of `net_amount` column
- [ ] Total Fees displays sum of `fee_amount` column
- [ ] Payment Type breakdown shows accurate counts and amounts
- [ ] Payment Method breakdown shows accurate counts and amounts

### Payment History Tab
- [ ] Can view all payments from `public.payments` with full details
- [ ] Filtering works by status, type, and method
- [ ] Search works by reference number, guest name, or email
- [ ] Sorting works by date and amount
- [ ] Pagination displays all records correctly
- [ ] Fee and net amount columns are visible and accurate
- [ ] Reference numbers are auto-generated and unique

### Payment Analytics Tab
- [ ] Revenue metrics calculate correctly
- [ ] Date range filtering works (week, month, quarter, year, all)
- [ ] Revenue breakdown by type shows accurate percentages
- [ ] Revenue breakdown by method shows accurate percentages
- [ ] Daily trend chart displays data correctly
- [ ] Fee calculations are accurate

## Troubleshooting

### Payment Record Not Created After Payment Intent Succeeds

**Check:**
1. Verify `payment_intents` record status is actually 'succeeded'
2. Check if the OLD status was different (trigger only fires on status change)
3. Verify triggers are enabled:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname LIKE 'tr_sync%';
   ```
4. Check database logs for trigger errors
5. Verify RLS policies don't prevent insertion

### Incomplete Data in Payment Record

**Check:**
1. Verify all required metadata is passed in `createPaymentIntent` call
2. Confirm `payment_method` is included in metadata or passed separately
3. Verify fee calculation logic in `paymentsService.calculateFee()`
4. Check if NULL values are being inserted and need default handling

### Fee Not Calculated Correctly

**Check:**
1. Verify `calculateFee()` function is being called with correct payment method
2. Confirm fee structure in `calculateFee()` is appropriate for your business
3. Verify `net_amount` is calculated as `amount - fee_amount`
4. Check if fees are being passed in metadata properly

## Performance Considerations

- `public.payments` has indexes on:
  - `merchant_id` - for merchant-specific queries
  - `customer_id` - for customer-specific queries
  - `payment_intent_id` - for payment intent lookups
  - `deposit_intent_id` - for deposit intent lookups
  - `status` - for filtering by payment status
  - `created_at` - for date-based sorting
  - `reference_number` - for reference lookups

- Triggers are optimized to:
  - Only insert when status changes (conditional trigger)
  - Use ON CONFLICT to handle idempotent updates
  - Batch insert operations where possible

## Manual Sync Helper

If a payment record needs to be created manually (for recovery):

```javascript
// In paymentsService
const payment = await paymentsService.ensurePaymentSyncedFromIntent(paymentIntentId)

// Or for deposits
const payment = await paymentsService.ensurePaymentSyncedFromDeposit(depositIntentId)
```

These functions check if a record exists and create it if necessary.

## Automated Testing

The following scenarios should be tested in your test suite:

```javascript
// Test 1: Payment intent sync
test('Payment record synced when payment intent succeeds', async () => {
  const intent = await createPaymentIntent(...)
  await updatePaymentIntent(intent.id, { status: 'succeeded' })
  const payment = await getPaymentByIntentId(intent.id)
  expect(payment).toBeDefined()
  expect(payment.status).toBe('succeeded')
})

// Test 2: Deposit intent sync
test('Payment record synced when deposit intent completes', async () => {
  const deposit = await createDepositIntent(...)
  await updateDepositIntent(deposit.id, { status: 'completed' })
  const payment = await getPaymentByDepositId(deposit.id)
  expect(payment).toBeDefined()
  expect(payment.payment_type).toBe('deposit')
})

// Test 3: Fee calculation
test('Fee calculated correctly for each payment method', async () => {
  const methods = ['wallet_balance', 'bank_transfer', 'credit_card', 'e_wallet', 'crypto']
  methods.forEach(method => {
    const result = calculateFee(100, method)
    expect(result.netAmount).toBe(100 - result.feeAmount)
  })
})

// Test 4: Analytics calculations
test('Analytics calculations use correct fields from payments table', async () => {
  const payments = await getPaymentsByMerchant(merchantId)
  const totalFees = payments.reduce((sum, p) => sum + p.fee_amount, 0)
  const netRevenue = payments.reduce((sum, p) => sum + p.net_amount, 0)
  // Verify calculations match API responses
})
```

## Deployment Checklist

- [ ] Migration 102 has been applied to database
- [ ] All sync triggers are created and enabled
- [ ] RLS policies allow service role to insert into `public.payments`
- [ ] Fee structure in `calculateFee()` is finalized
- [ ] Payment method mappings are complete
- [ ] UI components (Overview, History, Analytics) are integrated
- [ ] Tests are written and passing
- [ ] Monitoring/alerting is set up for failed syncs
- [ ] Database backups are in place before deployment

## Monitoring

After deployment, monitor:
- Number of payments in `public.payments` table
- Lag between payment intent update and payment record creation (should be < 1 second)
- Fee calculation accuracy
- RLS policy violations or access errors
- Trigger execution times and failures

---

**Last Updated:** 2024
**Status:** Testing Guide Ready
