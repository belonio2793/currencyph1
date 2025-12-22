# Payment Transfer System - Complete Implementation Guide

## Overview

This document describes the complete implementation of a multi-step payment transfer system with currency conversion, wallet management, and transaction recording.

## System Components

### 1. Core Services

#### PaymentTransferService (`src/lib/paymentTransferService.js`)
The heart of the payment transfer system. Handles:
- **Transfer Creation**: Creates transfer records with sender/recipient wallets and amounts
- **Conversion Handling**: Built-in exchange rate calculation
- **Wallet Updates**: Atomic operations using database functions
- **Transaction Recording**: Immutable audit trail in wallet_transactions
- **Transfer History**: Query and retrieve transfer records

**Key Methods:**
```javascript
// Create a transfer request
await paymentTransferService.createTransferRequest(
  senderUserId,
  recipientUserId,
  {
    senderAmount: 1000,
    senderCurrency: 'PHP',
    recipientAmount: 20,
    recipientCurrency: 'USD',
    senderWalletId: '...',
    recipientWalletId: '...',
    description: 'Payment for services',
    exchangeRate: 0.02,
    rateSource: 'system'
  }
)

// Complete a transfer (atomic operation via DB function)
await paymentTransferService.completeTransfer(transferId, {
  payment_method: 'wallet',
  notes: 'Payment received'
})

// Validate transfer before processing
const validation = await paymentTransferService.validateTransfer(transferId)

// Get transfer history
const history = await paymentTransferService.getTransferHistory(userId)

// Generate payment link
const link = paymentTransferService.generatePaymentLink(transferId)
```

### 2. UI Components

#### SendPaymentRequest (`src/components/SendPaymentRequest.jsx`)
3-step payment request interface:
1. **Step 1: Enter Amount**
   - Select sender wallet
   - Enter amount in sender's preferred currency
   - Automatic currency conversion to recipient's preferred currency
   - Real-time exchange rate display

2. **Step 2: Select Recipient**
   - Search for recipient by email or name
   - Select recipient wallet
   - Amount summary and conversion preview

3. **Step 3: Finalization**
   - Review payment summary with all details
   - Display user profile information (email, name, phone)
   - Enter payment description
   - One-click confirmation to complete transfer

**Features:**
- Progressive disclosure (one step at a time)
- Responsive design for mobile and desktop
- Real-time validation and error handling
- Built-in currency conversion
- Conversion rate display with source information

#### PaymentRequestModal (`src/components/PaymentRequestModal.jsx`)
2-step modal for requesting payments via chat:
1. **Step 1: Select Recipient**
   - Search users by email or name
   - Select from results

2. **Step 2: Enter Request Details**
   - Amount and currency
   - Description of what the payment is for
   - Optional due date
   - Summary with all details

**Features:**
- Creates a conversation with the recipient
- Sends a structured message with payment request details
- Message type: `payment_request` for special handling
- Due date tracking for reminders

#### DynamicCheckoutPage (`src/components/DynamicCheckoutPage.jsx`)
Responsive 2-step checkout for payment confirmation:
1. **Step 1: Review Payment**
   - Payment summary (sender, recipient, amount)
   - Exchange rate information
   - Payment description
   - Confirmation prompt

2. **Step 2: Finalize**
   - Payment method selection (Wallet Transfer, Bank Transfer)
   - Additional notes/reference
   - Final confirmation with warning
   - Process payment

**Features:**
- Full-screen responsive layout
- Progress indicator
- Sticky payment summary on desktop
- Real-time validation
- Error handling with clear messages
- Success confirmation with transaction ID

### 3. Database Functions

#### process_payment_transfer
Atomic function that:
1. Locks transfer record and both wallets
2. Validates transfer and balances
3. Updates both wallet balances
4. Creates debit transaction for sender
5. Creates credit transaction for recipient
6. Updates transfer status to 'completed'
7. Commits all changes atomically

Returns: `{success, message, transfer_id, new_sender_balance, new_recipient_balance}`

#### validate_transfer
Validates a transfer before processing:
- Checks transfer exists and is pending
- Verifies sender wallet exists and has sufficient balance
- Confirms recipient wallet exists
- Provides specific validation error messages

Returns: `{is_valid, validation_error, transfer_id}`

### 4. Database Tables

#### transfers
Stores all payment transfer records:
```sql
CREATE TABLE transfers (
  id UUID PRIMARY KEY,
  from_user_id UUID,          -- Sender user ID
  to_user_id UUID,            -- Recipient user ID
  from_wallet_id UUID,        -- Sender wallet
  to_wallet_id UUID,          -- Recipient wallet
  sender_amount NUMERIC,      -- Amount debited from sender
  sender_currency VARCHAR,    -- Sender's currency
  recipient_amount NUMERIC,   -- Amount credited to recipient
  recipient_currency VARCHAR, -- Recipient's currency
  exchange_rate NUMERIC,      -- Conversion rate used
  rate_source VARCHAR,        -- Source of rate (system, manual, etc)
  rate_fetched_at TIMESTAMPTZ,
  status TEXT,                -- pending, processing, completed, failed, cancelled
  fee NUMERIC,                -- Optional fee
  description TEXT,           -- Payment description
  metadata JSONB,             -- Additional data
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
```

#### wallet_transactions
Immutable audit trail:
```sql
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY,
  wallet_id UUID,             -- Which wallet
  user_id UUID,               -- User who owns the wallet
  amount NUMERIC,             -- Transaction amount (always positive)
  currency_code VARCHAR,      -- Currency
  transaction_type VARCHAR,   -- transfer_debit, transfer_credit, etc
  description TEXT,           -- What happened
  reference_id UUID,          -- Link to transfers.id
  balance_before NUMERIC,     -- Balance before transaction
  balance_after NUMERIC,      -- Balance after transaction
  metadata JSONB,             -- Exchange rates, notes, etc
  created_at TIMESTAMPTZ
);
```

#### wallets
Updated in real-time:
```sql
CREATE TABLE wallets (
  id UUID PRIMARY KEY,
  user_id UUID,
  currency_code VARCHAR,
  balance NUMERIC,            -- Always in sync with transactions
  updated_at TIMESTAMPTZ,
  ...
);
```

## Integration Points

### 1. App.jsx Routes

The new payment transfer features are integrated into the main app routing:

```javascript
// Import new components (lazy-loaded)
const SendPaymentRequest = lazy(() => import('./components/SendPaymentRequest'))
const DynamicCheckoutPage = lazy(() => import('./components/DynamicCheckoutPage'))

// Route detection in activeTab state
if (path.startsWith('/payment/')) return 'payment-checkout'

// Render in appropriate locations
{activeTab === 'send-payment' && 
  <SendPaymentRequest userId={userId} onClose={() => setActiveTab('wallet')} />}

{activeTab === 'payment-checkout' && 
  <DynamicCheckoutPage />}
```

### 2. Wallet Page Integration

Add button to SendMoney/Wallet page to access SendPaymentRequest:
```javascript
<button onClick={() => setActiveTab('send-payment')}>
  Send Money (New)
</button>
```

### 3. Chat Integration

PaymentRequestModal can be triggered from any user profile or chat:
```javascript
<PaymentRequestModal 
  userId={currentUserId}
  recipientUserId={targetUserId}
  onSuccess={(result) => {
    // Update chat with payment request
  }}
/>
```

## Data Flow

### Creating a Transfer

```
1. User opens SendPaymentRequest component
2. Enters amount and selects currencies (Step 1)
3. Searches and selects recipient (Step 2)
4. Reviews and confirms payment (Step 3)
5. PaymentTransferService.createTransferRequest() called
6. Transfer record created with status='pending'
7. Payment link generated (e.g., /payment/{transferId})
8. User can share link or send chat request
```

### Completing a Transfer

```
1. Recipient opens payment link → DynamicCheckoutPage
2. Reviews payment details (Step 1)
3. Selects payment method and confirms (Step 2)
4. PaymentTransferService.completeTransfer() called
5. Database function process_payment_transfer() executes:
   a. Locks transfer and both wallets
   b. Validates all conditions
   c. Updates sender wallet balance (-amount)
   d. Updates recipient wallet balance (+amount)
   e. Creates debit transaction (wallet_transactions)
   f. Creates credit transaction (wallet_transactions)
   g. Updates transfer status to 'completed'
   h. Commits transaction atomically
6. Success confirmation shown
7. Transaction ID and completion timestamp displayed
```

## Testing

### Unit Tests

Test individual service methods:
```javascript
// Test transfer creation
const result = await paymentTransferService.createTransferRequest(...)
assert(result.success === true)
assert(result.transfer.status === 'pending')

// Test transfer completion
const completed = await paymentTransferService.completeTransfer(transferId)
assert(completed.success === true)
assert(completed.transfer.status === 'completed')

// Test validation
const validation = await paymentTransferService.validateTransfer(invalidTransferId)
assert(validation.valid === false)
assert(validation.error !== null)
```

### Integration Tests

Test complete flow from request to completion:
```
1. Create test users (sender, recipient)
2. Create test wallets for both users
3. Add balance to sender wallet
4. Create transfer via service
5. Verify transfer record exists
6. Complete transfer via service
7. Verify both wallets updated correctly
8. Verify wallet_transactions created for both
9. Verify transfer status = 'completed'
10. Verify balances match transaction sum
```

### End-to-End Tests

Test full UI flow:
```
1. Login as sender
2. Navigate to SendPaymentRequest
3. Enter amount (1000 PHP)
4. Search and select recipient
5. Confirm payment
6. Verify success message
7. Logout and login as recipient
8. Open payment link
9. Review and confirm
10. Verify success page
11. Check wallet balance increase
12. Check transaction history
```

## Error Handling

The system handles various error cases:

### Transfer Validation Errors
- Sender wallet not found
- Insufficient balance
- Recipient wallet not found
- Transfer already completed/failed
- Invalid amounts

### Conversion Errors
- Exchange rate fetch failure (falls back to 1:1)
- Unsupported currency pairs

### Processing Errors
- Database connection failure
- Row-level locking timeout
- Concurrent modification conflicts (prevented by row locking)

### UI Errors
- User not authenticated
- Required fields missing
- Invalid selections
- Network timeouts

## Security Considerations

### RLS (Row Level Security)
- Users can only view their own transfers
- Service role required for inserts/updates
- Transfers visible to both sender and recipient

### Data Validation
- All amounts validated as positive numbers
- User IDs validated as UUIDs
- Wallet existence verified before operations

### Atomic Operations
- Database functions ensure all-or-nothing semantics
- No partial transfers possible
- Prevents race conditions via row-level locking

### Audit Trail
- All transactions recorded in wallet_transactions
- Immutable ledger prevents tampering
- Full history available for disputes

## Configuration

### Environment Variables
The system uses existing environment variables:
- `VITE_SUPABASE_ANON_KEY` - Client auth
- `VITE_PROJECT_URL` - Supabase project URL

### Currency Exchange Rates
Rates fetched from CurrencyAPI via existing currencyAPI service:
- Real-time rates for cross-currency transfers
- Fallback to 1:1 if API unavailable
- Rate source and timestamp tracked in transfer record

## Troubleshooting

### Transfer Stuck in Pending
1. Verify sender wallet has sufficient balance
2. Check transfer status in database
3. Call validateTransfer() to get specific error
4. If validation passes, retry completeTransfer()

### Wallet Balance Mismatch
1. Check wallet_transactions for all transfers
2. Sum all transaction amounts
3. Should equal (initial_balance + credits - debits)
4. If mismatch, use recalculate_wallet_balance() function

### Payment Link Not Working
1. Verify transfer ID in URL
2. Check that recipient is logged in as correct user
3. Verify transfer status is 'pending'
4. Check transfer recipient_user_id matches current user

## Future Enhancements

- [ ] Batch transfers (one sender to multiple recipients)
- [ ] Scheduled/recurring transfers
- [ ] Transfer limits and restrictions
- [ ] Fee structures (percentage or fixed)
- [ ] Dispute resolution system
- [ ] Escrow for marketplace transactions
- [ ] Real-time transfer notifications
- [ ] Mobile app deep linking for payment links
- [ ] QR code generation for payment links
- [ ] Webhook notifications for payment updates

## Support

For issues or questions:
1. Check error messages in browser console
2. Review database logs for function errors
3. Verify wallet balances and transaction records
4. Check RLS policies are configured correctly
5. Ensure database migration 0120 is applied

---

**Last Updated**: 2024
**Version**: 1.0
**Status**: Production Ready
