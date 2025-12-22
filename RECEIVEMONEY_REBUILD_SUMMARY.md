# ReceiveMoney Page Rebuild - Complete Implementation

## Overview
The `/receive` page has been completely rebuilt to support:
- Multi-wallet receiving (fiat & crypto)
- Guest checkout with email
- Multiple payment methods (GCash, Bank Transfer, Crypto)
- Automatic deposit recording and wallet crediting
- Full audit trail with wallet_transactions

## Components

### 1. **ReceiveMoney Component** (`src/components/ReceiveMoney.jsx`)
The main UI component with a 4-step wizard flow:

#### Step 1: Select Receiving Wallet
- Users can choose from their existing wallets
- Or use guest checkout mode with email
- Shows wallet ID, account number, and balance

#### Step 2: Select Payment Method
- **Fiat Methods:**
  - GCash (mobile wallet)
  - Bank Transfer (direct deposit)
- **Crypto Methods:**
  - 50+ cryptocurrencies (BTC, ETH, USDT, USDC, etc.)
  - Multiple networks per crypto

#### Step 3: Payment Details
- Optional amount specification
- Currency selection (PHP, USD, EUR)
- For crypto: select specific network and address
- Shows summary before confirmation

#### Step 4: Confirmation
- Review all details
- Select crypto receive address if applicable
- Create receive link

#### After Creation
- Unique receive link generated
- Copy to clipboard
- Share with sender
- Shows recent deposit history

## Database Tables

### `deposits` (Existing)
Records all incoming payments:
```sql
{
  id: UUID,
  user_id: UUID (nullable for guests),
  guest_email: VARCHAR,
  wallet_id: UUID,
  amount: DECIMAL,
  currency_code: VARCHAR,
  payment_method: VARCHAR ('gcash'|'bank'|'crypto'),
  crypto_network: VARCHAR,
  crypto_address: VARCHAR,
  reference_number: VARCHAR,
  received_amount: DECIMAL (PHP equivalent),
  exchange_rate: DECIMAL,
  status: VARCHAR ('pending'|'confirmed'|'failed'),
  metadata: JSONB,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}
```

### `wallet_transactions` (Existing)
Audit trail for wallet balance changes:
```sql
{
  id: UUID,
  wallet_id: UUID,
  user_id: UUID,
  type: VARCHAR ('deposit'|'withdrawal'|'transfer'|...),
  amount: DECIMAL,
  currency: VARCHAR,
  balance_before: DECIMAL,
  balance_after: DECIMAL,
  description: TEXT,
  metadata: JSONB,
  created_at: TIMESTAMP
}
```

### `wallets` (Existing)
User wallets:
```sql
{
  id: UUID,
  user_id: UUID,
  currency_code: VARCHAR,
  account_number: VARCHAR,
  balance: DECIMAL,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}
```

### `receive_links` (Optional)
Track receive links (if table created):
```sql
{
  id: VARCHAR (PRIMARY KEY),
  user_id: UUID (nullable),
  guest_email: VARCHAR,
  wallet_id: UUID,
  amount: DECIMAL,
  currency: VARCHAR,
  method: VARCHAR,
  crypto_network: VARCHAR,
  crypto_address: VARCHAR,
  status: VARCHAR,
  created_at: TIMESTAMP
}
```

## Service: receiveMoneyService

Located at: `src/lib/receiveMoneyService.js`

### Key Functions

#### `recordDeposit(depositData)`
Records a new deposit and optionally credits wallet
- Creates deposit record
- Auto-credits wallet if confirmed
- Creates audit transaction

**Example:**
```javascript
const deposit = await receiveMoneyService.recordDeposit({
  user_id: 'user-123',
  wallet_id: 'wallet-456',
  amount: 5000,
  currency_code: 'PHP',
  payment_method: 'gcash',
  reference_number: 'GCH123456',
  received_amount: 5000,
  status: 'confirmed'
})
```

#### `creditWallet(walletId, amount, currencyCode, depositId)`
Credits a wallet and creates transaction record
- Updates wallet balance
- Creates wallet_transactions entry
- Atomic operations

#### `convertCryptoToPhp(amount, cryptoCode)`
Converts crypto amount to PHP equivalent
- Fetches latest rates from cached_rates
- Returns PHP amount

#### `confirmDeposit(depositId, receivedPhpAmount)`
Marks pending deposit as confirmed
- Updates deposit status
- Credits wallet automatically

#### `getDepositHistory(walletId, limit)`
Retrieves deposit history for a wallet
- Shows last N deposits
- Sorted by date

#### `createReceiveLink(linkData)`
Creates receive link record
- Stores link metadata
- Optional (works without database table)

## Payment Method Details

### GCash
- Payment method: `payment_method: 'gcash'`
- Requires reference number for verification
- Direct mobile wallet transfer

### Bank Transfer
- Payment method: `payment_method: 'bank'`
- Shows bank account details
- Requires transfer verification

### Cryptocurrency
- Payment method: `payment_method: 'crypto'`
- 50+ supported cryptocurrencies
- Multi-network support (ERC-20, BEP-20, etc.)
- Receive addresses in `cryptoAddresses` from `src/data/cryptoDeposits.js`

## Crypto Deposits Data

From `src/data/cryptoDeposits.js` - 54 currency/network combinations:

- **Bitcoin (BTC)** - Bitcoin network
- **Ethereum (ETH)** - ERC-20, Arbitrum One
- **Tether (USDT)** - 11 networks
- **USDC** - 10 networks
- **XRP, Binance Coin, and more**

Each includes:
- Currency name
- Network
- Receive address
- Optional metadata (tags, destination tags)

## Guest Checkout Flow

When user doesn't have account:

1. Enter email address
2. Select payment method
3. Specify amount
4. System generates receive link with guest email
5. Funds can be received to wallet specified OR
6. Guest can create account later to claim funds

## Deposit Status Flow

```
PENDING → CONFIRMED → (funds credited to wallet)
    ↓
  FAILED → (rejected, no credit)
```

Webhook/API should:
1. Detect payment confirmation
2. Call `confirmDeposit()` with verified amount
3. Auto-credits wallet + creates transaction

## Integration Points

### 1. Payment Processor Integration
When payment received from GCash/Bank API:
```javascript
// Verify payment
const verified = await paymentProvider.verify(referenceNumber)

// Confirm deposit
await receiveMoneyService.confirmDeposit(
  depositId,
  verified.amountPhp
)
```

### 2. Crypto Webhook
When blockchain confirms deposit:
```javascript
// Get deposit by crypto address + amount
const deposit = await getDepositByAddress(address, amount)

// Confirm and credit
await receiveMoneyService.confirmDeposit(
  deposit.id,
  convertedPhpAmount
)
```

### 3. Guest Account Creation
When guest creates account:
```javascript
// Create user
const newUser = await createUser(guestEmail)

// Update deposits to link to new user
await updateDepositsForGuest(guestEmail, newUser.id)
```

## Exchange Rate Calculation

For crypto deposits:
1. Fetch live rate from `cached_rates.crypto_prices`
2. Convert received crypto amount to PHP
3. Store in `received_amount` field
4. Credit wallet with PHP amount

```javascript
const phpAmount = cryptoAmount * rate
```

## Wallet Balance Updates

When deposit confirmed:
1. `wallets.balance` += received_amount
2. Create `wallet_transactions` record
3. Transaction type: `'deposit'`
4. Metadata includes deposit_id and source

Example transaction:
```javascript
{
  wallet_id: 'wallet-123',
  type: 'deposit',
  amount: 5000,
  currency: 'PHP',
  balance_before: 10000,
  balance_after: 15000,
  description: 'Deposit received via receive link',
  metadata: {
    deposit_id: 'deposit-456',
    source: 'receive_money',
    status: 'completed'
  }
}
```

## Security Considerations

1. **Guest Email Verification**: Email should be verified before funds credited
2. **Amount Verification**: Confirm received amount matches expected
3. **Address Verification**: For crypto, verify sender address if needed
4. **Rate Locking**: Lock exchange rate at time of link creation
5. **Audit Trail**: All transactions logged in wallet_transactions
6. **RLS Policies**: Users can only see their own deposits

## Future Enhancements

1. **Receive Links Expiration**: Auto-expire old links
2. **Rate Locking**: Lock exchange rate when link created
3. **Webhook Verification**: HMAC signing for payment webhooks
4. **Bulk Receive Links**: Generate multiple links at once
5. **Receive Analytics**: Track which methods are most used
6. **Multi-currency Support**: Accept any currency, convert on credit
7. **Partial Payments**: Allow overpayment/underpayment handling
8. **Auto-Invoicing**: Generate invoices from receive links

## Testing Checklist

- [ ] Create receive link with user wallet
- [ ] Create receive link with guest email
- [ ] Test all payment methods display correctly
- [ ] Test crypto network selection
- [ ] Test receive link copying
- [ ] Test amount and currency fields
- [ ] Verify deposit records created in database
- [ ] Verify wallet_transactions created
- [ ] Test manual deposit confirmation
- [ ] Verify wallet balance updated correctly
- [ ] Test deposit history display
- [ ] Test guest email receipt

## Deployment Notes

1. Ensure `deposits` table exists with all required fields
2. Ensure `wallet_transactions` table has proper schema
3. Verify `cached_rates` table populated with crypto prices
4. Deploy `receiveMoneyService.js` for deposit handling
5. Update wallet receive addresses for all crypto networks
6. Configure payment processor webhooks to call confirmation flow
7. Test end-to-end payment flow before going live

## Error Handling

All functions include error handling:
- Database connection failures
- Missing wallet/deposit records
- Invalid amounts
- Crypto rate fetch failures
- Graceful fallbacks

## Performance

- Exchange rates cached in memory
- Crypto addresses loaded once at startup
- Database queries indexed by user_id and wallet_id
- Async operations prevent UI blocking

---

**Status**: ✅ Complete - Full rebuild with all requested features implemented
