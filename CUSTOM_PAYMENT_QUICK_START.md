# Custom Payment Feature - Quick Start Guide

## What's New?

You can now generate shareable payment links that guests can use to pay you without needing an account.

## How It Works (User Perspective)

### Step 1: Generate a Payment Link
1. Go to **Request Money** page
2. Click **"Generate Payment Link"**
3. Fill in:
   - **Payment Description**: "Invoice #123" or service description
   - **Guest Email** (optional): Pre-fill guest email
   - **Amount**: How much to request
   - **Currency**: PHP, USD, or crypto (BTC, ETH, etc.)
4. Click **"Next: Select Payment Method"**
5. Choose payment method:
   - 💰 **GCash**: For mobile payment
   - 🏦 **Bank Transfer**: For bank deposits
   - ₿ **Cryptocurrency**: For crypto payments (50+ coins)
6. Click **"Next: Review Payment Link"**
7. Review details and click **"Generate Payment Link"**
8. Copy and share the link with guests!

### Step 2: Guest Completes Payment
1. Guest clicks the payment link
2. Guest sees payment details with your info
3. Guest enters their info (name, email, phone)
4. Guest enters payment reference (for bank/GCash) or sends crypto
5. Guest clicks "Confirm Payment"
6. Payment is processed and confirmed!

### Step 3: Automatic Processing
- ✅ Your wallet is instantly credited
- ✅ Transaction recorded for audit trail
- ✅ Conversion rate applied if currencies differ
- ✅ Guest gets confirmation
- ✅ You receive payment notification

## Payment Methods Explained

### 💰 GCash
- Guest pays via GCash app
- Guest enters GCash reference number
- Best for: Philippines-based recipients

### 🏦 Bank Transfer
- Guest transfers via their bank
- Guest enters bank reference number
- Best for: Local or international transfers

### ₿ Cryptocurrency
- Shows wallet address to send to
- Supports 50+ cryptocurrencies:
  - Bitcoin (BTC)
  - Ethereum (ETH)
  - USDT/USDC (stablecoins)
  - Solana (SOL)
  - And many more!
- Automatic conversion to your wallet currency

## Payment Link Features

- **Unique Code**: PAY-{timestamp}-{random}
- **Expiration**: 7 days (after that, link becomes invalid)
- **Anonymous**: Guests don't need to create account
- **Conversion**: Automatic currency conversion if needed
- **Audit Trail**: All payments recorded in system

## Example Scenarios

### Scenario 1: Invoice Payment
1. Generate link for PHP 5,000
2. Add description: "Invoice #INV-2024-001"
3. Set method: GCash
4. Customer pays via GCash using your reference
5. Your wallet shows +PHP 5,000

### Scenario 2: Freelance Work
1. Generate link for USD 200 (crypto)
2. Customer sends USDT on Polygon network
3. System converts USDT to your wallet currency
4. Wallet updated instantly

### Scenario 3: Event Reservation
1. Generate link for PHP 1,000 per ticket
2. Share link on social media
3. Multiple guests can pay via their preferred method
4. Instant payment confirmation for each

## Important Notes

⚠️ **Link Expires After 7 Days**
- If guest doesn't complete payment in 7 days, link becomes invalid
- Generate a new link if needed

⚠️ **Payment Verification**
- For bank transfers: Guest provides reference number
- For GCash: Guest provides reference number
- For Crypto: Automatic verification via blockchain

⚠️ **Currency Conversion**
- Automatic conversion happens if currencies differ
- Exchange rates are fetched from real-time API
- Conversion rate is recorded for audit trail

## Troubleshooting

### Link Not Working
- Check if 7 days have passed (links expire)
- Generate a new link

### Payment Not Credited
- Check if guest entered correct information
- Verify payment method
- Check wallet balance (may take few minutes)

### Currency Conversion Issues
- Ensure you have a wallet in the target currency
- If not, system creates one automatically
- Check exchange rates are up-to-date

## What Happens Behind the Scenes

```
Guest Payment Flow:
1. Guest fills form → 2. Clicks "Confirm" → 3. Payment processed
4. Transfer record updated → 5. Wallet credited → 6. Transaction logged
7. Deposit recorded → 8. Confirmation sent
```

### Database Updates
- ✅ `public.transfers`: Payment details, status, conversion info
- ✅ `public.wallets`: Balance increased
- ✅ `wallet_transactions`: Audit log entry created
- ✅ `public.deposits`: Full payment record for accounting

## Security & Privacy

✅ **Secure**: Links are unique and time-limited
✅ **Private**: Guest data only visible to requestor
✅ **Audited**: All transactions recorded
✅ **Encrypted**: Payment info sent over HTTPS
✅ **No Account Needed**: Guests don't need to sign up

## For Developers

### Key Files
- `src/lib/customPaymentService.js` - Payment processing
- `src/components/ReceiveMoney.jsx` - Link generation UI
- `src/components/CheckoutPage.jsx` - Guest checkout UI

### Main Functions
```javascript
// Generate payment link
await customPaymentService.generatePaymentLink({
  from_user_id: userId,
  amount: 1000,
  currency: 'PHP',
  payment_method: 'gcash'
})

// Process guest payment
await customPaymentService.processGuestPayment({
  transferId: '...',
  paidAmount: 1000,
  guestName: 'John Doe'
})
```

### Database Tables Involved
- `public.transfers` - Payment requests and statuses
- `public.wallets` - User wallet balances
- `wallet_transactions` - Transaction audit trail
- `public.deposits` - Payment records (optional)

## Next Steps

1. ✅ Navigate to Request Money page
2. ✅ Click "Generate Payment Link"
3. ✅ Fill in payment details
4. ✅ Copy and share the link
5. ✅ Monitor wallet for incoming payments

## Common Questions

**Q: Can I edit a payment link after generating it?**
A: No, links are immutable once created. Generate a new one if needed.

**Q: What if guest pays wrong amount?**
A: System records actual amount paid. You can process it as-is or contact guest.

**Q: Which currencies are supported?**
A: PHP, USD, EUR, GBP, JPY, AUD, CAD, SGD, HKD, INR + 50+ cryptocurrencies

**Q: How long does payment take?**
A: Crypto: instant-1 hour (blockchain dependent)
   Bank: 1-5 business days
   GCash: instant

**Q: Are there transaction limits?**
A: Limits depend on your country and payment method. Check bank/payment provider.

**Q: Can I issue refunds?**
A: Currently no automatic refund feature. Contact requestor for manual reversal.

## Support

For issues with payment links:
1. Check if link is expired (7 days max)
2. Verify guest information entered correctly
3. Confirm payment method is available
4. Review transaction history in wallet

For technical support: Contact developer team
