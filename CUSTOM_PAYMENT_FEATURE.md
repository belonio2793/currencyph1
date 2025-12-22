# Custom Payment Feature Implementation

## Overview
A complete guest checkout system that allows authenticated users to generate shareable payment links. Guests can then complete payments which are automatically processed, with amounts credited to the requestor's wallet and tracked through the database.

## Features Implemented

### 1. **Custom Payment Link Generation** (`customPaymentService.js`)
- Generate unique payment links with codes for guest checkout
- Support for multiple payment methods:
  - GCash (mobile payment)
  - Bank Transfer
  - Cryptocurrency (50+ supported coins)
- Automatic expiration (7 days default)
- Support for anonymous guests or identified guests (email-based)

### 2. **Request Money Enhancement** (`ReceiveMoney.jsx`)
- New "Generate Payment Link" option in Request Money mode
- Two request modes:
  - "To Specific User" - Send payment request to known user (existing feature)
  - "Generate Payment Link" - Create guest checkout link (new)
- Payment description field for invoice/reference tracking
- Optional guest email pre-population
- Real-time payment method selection

### 3. **Guest Checkout Page** (`CheckoutPage.jsx`)
- Multi-step checkout process:
  - **Step 1**: View payment details and confirm amount
  - **Step 2**: Enter guest information (name, email, phone)
  - **Step 3**: Success confirmation
- Payment method-specific fields:
  - GCash/Bank: Payment reference number
  - Crypto: Copy-to-clipboard wallet addresses
- Currency conversion support
- Guest can modify payment amount if needed

### 4. **Database Integration**

#### public.transfers Table
```sql
- id (unique)
- from_user_id (requestor)
- to_email (guest email, optional)
- guest_checkout (boolean flag)
- amount
- currency
- payment_method (gcash, bank, crypto)
- crypto_network (if crypto selected)
- status (pending_payment → processing → completed/failed)
- payment_code (unique shareable code)
- paid_amount (final amount received)
- paid_currency (actual currency paid)
- conversion_rate (if currencies differ)
- payment_reference (for fiat methods)
- guest_name, guest_email, guest_phone
- created_at, completed_at
- expires_at (7 days default)
```

#### public.wallets
- Updated with deposit amount after successful payment
- balance increased by converted amount
- updated_at timestamp

#### wallet_transactions
- New transaction record created for each deposit:
  - type: 'deposit'
  - amount: converted amount
  - currency: wallet currency
  - balance_before / balance_after
  - description: Payment reference
  - metadata: transfer_id, payment_type, processing details

#### public.deposits
- Audit trail record with full payment details:
  - user_id, guest_email
  - amount, currency, received_amount
  - payment_method, crypto_network
  - reference_number
  - exchange_rate (if converted)
  - status: 'completed'

### 5. **Payment Processing Flow**

```
User generates link
    ↓
Guest receives shareable link
    ↓
Guest opens CheckoutPage
    ↓
Guest confirms payment details
    ↓
Guest enters payment info
    ↓
Guest completes payment
    ↓
API processes:
  1. Update transfers table (status: completed)
  2. Calculate conversion rate (if needed)
  3. Credit sender's wallet
  4. Create wallet_transactions record
  5. Create deposits audit record
  ↓
Success confirmation sent to guest
```

## API/Service Methods

### customPaymentService

#### `generatePaymentLink(paymentData)`
Generates a unique payment code and transfer record
- Input: from_user_id, to_email, amount, currency, payment_method, crypto_network, description
- Output: { success, transfer, paymentLink, paymentCode }
- Stores in public.transfers table

#### `getPaymentDetails(paymentCode, transferId)`
Retrieves payment details for checkout
- Validates expiration
- Fetches sender info
- Loads crypto deposit addresses
- Returns: { transfer, senderInfo, depositAddresses, isExpired }

#### `processGuestPayment(paymentData)`
Processes guest payment submission
- Input: transferId, paidAmount, paidCurrency, paymentReference, guestEmail, guestName, guestPhone
- Actions:
  1. Update transfer record with payment details
  2. Calculate rate conversion
  3. Credit sender's wallet (creates wallet if needed)
  4. Create wallet_transactions record
  5. Create deposits audit record
- Returns: { success, transfer, wallet, transaction, deposit }

#### `creditSenderWallet(userId, amount, currency, transferId)`
Credits the sender's wallet
- Finds or creates wallet for currency
- Updates balance
- Creates transaction record

#### `getCryptoDepositAddress(cryptoCode, network)`
Fetches crypto deposit addresses
- First tries wallets_house table
- Falls back to CRYPTOCURRENCY_DEPOSITS
- Filters by network if specified

## URL Routes

### Payment Link Format
```
https://yourapp.com/checkout?code=PAY-{timestamp}-{random}&transferId={transferId}
```

### Checkout Page
- Route: `/checkout`
- Parameters: `?code=PAY-...&transferId=...`
- Unauthenticated guest access allowed

## Database Fields

### New transfers columns for custom payments:
- `payment_code` (unique): PAY-{timestamp}-{random}
- `guest_checkout` (boolean): flag for guest payments
- `paid_amount`: actual amount received
- `paid_currency`: actual currency received
- `conversion_rate`: rate applied
- `payment_reference`: fiat method reference
- `guest_name`, `guest_email`, `guest_phone`
- `expires_at`: link expiration timestamp
- `completed_at`: payment completion timestamp

## Security Features

1. **Expiration**: Links expire after 7 days
2. **Status Validation**: Cannot process already-completed payments
3. **User Verification**: Payment credits only if from_user_id exists
4. **Audit Trail**: All payments recorded in deposits table
5. **Transaction Logging**: Every wallet change tracked in wallet_transactions
6. **Rate Validation**: Currency conversion verified through exchange rate API

## Error Handling

- Expired link detection
- Duplicate payment prevention
- Currency conversion failures (falls back to 1:1 rate)
- Wallet creation on demand
- Transaction recording with error logging
- User-friendly error messages

## Testing Scenarios

### Scenario 1: GCash Payment
1. User generates link for PHP 500 GCash payment
2. Guest opens link, confirms amount
3. Guest enters: name, email, GCash reference
4. System creates transfer, credits wallet PHP 500
5. Wallet transaction created
6. Deposits record created

### Scenario 2: Crypto Payment with Conversion
1. User generates link for USD 100 crypto payment
2. Guest sends BTC equivalent
3. System gets BTC-to-PHP rate
4. Converts amount to PHP
5. Credits wallet in PHP
6. Records conversion rate in transfers

### Scenario 3: No Pre-filled Email
1. User generates link without email
2. Guest completes payment
3. Guest email saved in transfer record
4. Can use email for future communication

## Future Enhancements

1. QR code generation for payment links
2. Webhook notifications on payment completion
3. Payment reminders for expired links
4. Bulk payment link generation
5. Custom payment scheduling
6. Refund/reversal functionality
7. Multi-currency wallet settlement
8. Payment analytics dashboard
9. Email notifications to guests
10. SMS payment confirmations

## Environment Variables

No new environment variables required. Uses existing:
- `VITE_PROJECT_URL`: For checkout link generation
- `VITE_SUPABASE_*`: Database access

## Files Modified

1. **src/lib/customPaymentService.js** (NEW)
   - 477 lines
   - Complete payment processing logic

2. **src/components/ReceiveMoney.jsx** (MODIFIED)
   - Added custom payment mode
   - New request mode toggle
   - Custom payment description & email fields
   - Custom payment link generation flow
   - Updated Step 2 & 3 handling

3. **src/components/CheckoutPage.jsx** (NEW)
   - 337 lines
   - Guest checkout interface
   - Multi-step form
   - Payment confirmation

## Database Migrations Needed

If new columns don't exist on transfers table:
```sql
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS payment_code TEXT UNIQUE;
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS guest_checkout BOOLEAN DEFAULT FALSE;
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS paid_amount NUMERIC;
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS paid_currency VARCHAR(10);
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC;
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS guest_name TEXT;
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS guest_email TEXT;
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS guest_phone TEXT;
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
```

## Integration Notes

1. Ensure CheckoutPage is routed in your app router
2. Update sitemap/navigation if needed
3. Consider adding webhook handlers for third-party payment confirmations
4. Implement email notifications for payment completion
5. Add payment analytics to dashboard
