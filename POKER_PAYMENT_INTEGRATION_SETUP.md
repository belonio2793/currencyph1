# Poker Payment Integration Setup Guide

## Overview
This guide walks you through setting up the payment system for poker chip purchases. The system integrates with `public.payments` and supports multiple payment methods including wallet balance, bank transfers, credit cards, e-wallets, and cryptocurrency.

## What Was Created

### 1. **Payment Products Setup Script**
- **File**: `scripts/setup-poker-payment-products.js`
- **Purpose**: Creates payment products and prices for all 9 poker chip packages
- **Merchant**: Currency.ph (UUID: `336c05a0-3b97-417b-90c4-eca4560346cf`)

### 2. **Poker Payment Service**
- **File**: `src/lib/pokerPaymentService.js`
- **Features**:
  - Load payment products for poker chips
  - Manage payment links for products
  - Process wallet-based payments
  - Handle payment intents for other payment methods
  - Record payments in the public.payments ledger
  - Track purchase history and revenue stats

### 3. **Updated ChipTransactionModal**
- **File**: `src/components/ChipTransactionModal.jsx`
- **Features**:
  - Loads payment products instead of static chip packages
  - Falls back to `poker_chip_packages` if payment products don't exist
  - Supports wallet balance payments
  - Supports alternative payment methods (bank transfer, cards, e-wallets, crypto)
  - Integrates with the public.payments system
  - Records chip purchases with payment IDs for tracking

### 4. **Database Migration**
- **File**: `supabase/migrations/add_poker_payment_integration.sql`
- **Changes**:
  - Adds `product_id` column to chip_purchases (links to payment products)
  - Adds `payment_id` column to chip_purchases (links to payment records)
  - Adds `payment_method` column to chip_purchases
  - Creates indexes for faster lookups

## Step-by-Step Setup Instructions

### Step 1: Run the Database Migration
Execute the migration to add payment integration columns:
```bash
# Option A: Via Supabase Dashboard
# 1. Go to Supabase Dashboard → SQL Editor
# 2. Create a new query
# 3. Copy and paste the contents of supabase/migrations/add_poker_payment_integration.sql
# 4. Click "Run"

# Option B: Via CLI
supabase migration up
```

### Step 2: Create Payment Products
Run the setup script to create products for all poker chip packages:
```bash
# First, ensure environment variables are set
# Then run:
node scripts/setup-poker-payment-products.js
```

**Expected Output**:
```
Setting up payment products for poker chips under merchant 336c05a0-3b97-417b-90c4-eca4560346cf...
✓ Found merchant: Currency.ph

Creating 9 payment products...
✓ Created product: 280K Chips (ID: xxx-xxx-xxx-xxx)
  ✓ Created price: $4.99 USD
✓ Created product: 1M Chips (ID: xxx-xxx-xxx-xxx)
  ✓ Created price: $4.99 USD
... (7 more products)

✅ Successfully created 9 poker chip payment products!
```

### Step 3: Verify the Setup
Check that products were created successfully:
```sql
-- In Supabase SQL Editor, run:
SELECT id, name, description, is_active
FROM products
WHERE merchant_id = '336c05a0-3b97-417b-90c4-eca4560346cf'
ORDER BY created_at DESC;
```

Check that prices were created:
```sql
SELECT p.id as price_id, prod.name, p.amount, p.currency
FROM prices p
JOIN products prod ON p.product_id = prod.id
WHERE prod.merchant_id = '336c05a0-3b97-417b-90c4-eca4560346cf'
ORDER BY p.created_at DESC;
```

## How It Works

### Payment Flow

#### 1. **Wallet Balance Payment** (Authenticated Users with Wallets)
```
User selects wallet → Clicks "BUY NOW"
  ↓
Check wallet balance
  ↓
Record wallet transaction (debit)
  ↓
Create payment record in public.payments
  ↓
Update player_poker_chips balance
  ↓
Record chip_purchases entry
  ↓
Success notification
```

#### 2. **Alternative Payment Methods** (Bank Transfer, Cards, E-Wallets, Crypto)
```
User selects payment method → Clicks "OTHER PAYMENT"
  ↓
Get or create payment link
  ↓
Open payment checkout page
  ↓
Process payment through selected method
  ↓
DB triggers update public.payments on completion
  ↓
Chips credited upon successful payment
```

#### 3. **Guest Users**
```
Guest user (local storage) → Clicks "ADD CHIPS"
  ↓
Add chips to localStorage
  ↓
No payment processing (test/demo only)
```

## Key Features

### Multi-Currency Support
- Products priced in USD
- Wallet payments use wallet currency (PHP, etc.)
- Automatic conversion if needed

### Payment Methods
1. **Wallet Balance** - Instant, no fees
2. **Bank Transfer** - Manual verification, 2% fee
3. **Credit/Debit Card** - Instant, $0.50 + 2.9% fee
4. **E-Wallet (GCash, PayMaya)** - Instant, 2.5% fee
5. **Cryptocurrency** - Instant, 3% fee

### Transaction Tracking
- All payments recorded in `public.payments` ledger
- Chip purchases linked to payment records
- Complete audit trail with payment IDs
- Revenue reporting per product

## Data Structure

### Payment Products
```json
{
  "id": "product-uuid",
  "merchant_id": "336c05a0-3b97-417b-90c4-eca4560346cf",
  "name": "1M Chips",
  "description": "1,000,000 chips + 100,000 bonus",
  "is_active": true,
  "metadata": {
    "chip_amount": 1000000,
    "bonus_chips": 100000,
    "total_chips": 1100000,
    "display_order": 2,
    "is_first_purchase_special": true,
    "is_most_popular": false,
    "is_flash_sale": false,
    "product_type": "poker_chips"
  }
}
```

### Chip Purchases Entry
```json
{
  "user_id": "user-uuid",
  "product_id": "product-uuid",
  "payment_id": "payment-uuid",
  "chips_purchased": 1000000,
  "bonus_chips_awarded": 100000,
  "total_chips_received": 1100000,
  "usd_price_paid": 4.99,
  "payment_status": "completed",
  "payment_method": "wallet",
  "created_at": "2024-01-01T12:00:00Z"
}
```

## API Reference

### Load Poker Chip Products
```javascript
import { pokerPaymentService } from '@/lib/pokerPaymentService'

const products = await pokerPaymentService.getPokerChipProducts()
```

### Get Product Price
```javascript
const price = await pokerPaymentService.getProductPrices(productId)
// Returns: { id, product_id, amount, currency, ... }
```

### Process Wallet Payment
```javascript
const result = await pokerPaymentService.processWalletPayment(
  userId,
  productId,
  chipPackageData,
  walletId,
  amount
)
// Returns: { transaction, payment }
```

### Create Non-Wallet Payment
```javascript
const paymentLink = await pokerPaymentService.getOrCreatePaymentLink(productId)
// Returns URL: /payment/{paymentLink.slug}
```

### Get Purchase History
```javascript
const history = await pokerPaymentService.getUserPokerPurchaseHistory(userId)
```

### Get Revenue Stats
```javascript
const stats = await pokerPaymentService.getPokerChipSalesStats()
// Returns: { totalRevenue, totalTransactions, averageTransaction }
```

## Troubleshooting

### Problem: "No products found" in ChipTransactionModal
**Solution**: Run the setup script to create payment products
```bash
node scripts/setup-poker-payment-products.js
```

### Problem: Wallet payment fails with "Insufficient balance"
**Solution**: Ensure user has a wallet with sufficient USD balance. You may need to:
1. Add funds to the wallet
2. Convert balance to USD if it's in another currency

### Problem: Payment link doesn't open
**Solution**: Ensure the payment link exists and is active:
```sql
SELECT * FROM payment_links 
WHERE product_id = 'your-product-id'
AND is_active = true;
```

### Problem: Chips not credited after payment
**Solution**: Check if the payment status is 'succeeded':
```sql
SELECT status, metadata FROM payments 
WHERE customer_id = 'user-id' 
AND status = 'succeeded'
LIMIT 1;
```

## Security Considerations

1. **RLS Policies**: Ensure proper row-level security is enabled on:
   - `products` table (merchant access)
   - `prices` table (merchant access)
   - `payments` table (customer/merchant access)
   - `payment_links` table (merchant access)

2. **Wallet Transactions**: All wallet debits use the atomic `record_wallet_transaction` RPC to prevent race conditions

3. **Payment Verification**: The system verifies wallet balance before processing payments

4. **Audit Trail**: All transactions are recorded in `payments` and `chip_purchases` tables with full metadata

## Future Enhancements

1. **Subscription Plans**: Add recurring chip packages
2. **Promotional Codes**: Implement discount codes
3. **Bulk Discounts**: Offer tiered pricing
4. **Referral Rewards**: Bonus chips for referrals
5. **Payment Analytics**: Dashboard showing payment trends
6. **Webhook Notifications**: Real-time purchase notifications

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the payment system documentation
3. Check the database schema in migrations
4. Verify merchant account is active and configured

---

**Status**: ✅ Payment integration complete and ready to use
**Merchant ID**: 336c05a0-3b97-417b-90c4-eca4560346cf
**Last Updated**: 2024
