# Payment Links Testing & Implementation Guide

## Overview
The payment links system allows merchants to create dynamic checkout pages that can be shared via URL. The checkout page accepts URL parameters and dynamically renders based on the payment link configuration.

## Issues Fixed

### 1. **GuestCheckoutFlow Bug** ✅ FIXED
**Issue**: `feeData` was referenced before being calculated, causing wallet payments to fail.
**Fix**: 
- Moved fee calculation to top of component (reactive calculation)
- Restructured payment confirmation logic to calculate fees first
- Added proper validation before processing payments

### 2. **Dynamic Routing** ✅ FIXED
**Issue**: Payment links generated URLs that didn't propagate when visited (e.g., `/payment/test`)
**Fix**:
- Improved URL parsing in PaymentCheckoutPage
- Added comprehensive error messages with URL debugging info
- Added popstate listener to handle browser navigation
- Proper extraction of slugs from various URL formats

### 3. **User Balance Integration** ✅ FIXED
**Issue**: Checkout didn't properly check user wallet balances
**Fix**:
- Added wallet loading in GuestCheckoutFlow
- Implemented balance validation before wallet payment
- Added proper error messages for insufficient balance
- Display wallet balance in payment method selection

### 4. **Checkout Template** ✅ ENHANCED
**Issue**: Checkout page wasn't truly dynamic with parameters
**Fix**:
- Added support for URL query parameters
- Query params merged into payment link metadata
- Support for custom fields in payment links
- Dynamic styling based on metadata (colors, branding)

## Creating a Test Payment Link

### Step 1: Create a Merchant
1. Go to **Payments Hub** (from sidebar)
2. Click **Settings** tab
3. Click **Create Merchant**
4. Fill in merchant details:
   - Merchant Name: e.g., "Test Store"
   - Description: e.g., "Test payments"
   - Default Currency: PHP

### Step 2: Create a Payment Link
1. In Payments Hub, select your merchant from the dropdown
2. Click **Payment Links** tab
3. Click **+ New Payment Link**
4. Fill in the form:
   - **Link Name**: e.g., "Test Payment"
   - **Description**: e.g., "Test checkout for PHP 500"
   - **Fixed Amount**: 500.00
   - **Currency**: PHP

### Step 3: Get the Payment Link URL
1. In the Payment Links list, find your link
2. Copy the generated URL (e.g., `https://currency.ph/payment/test-payment`)
3. The URL is automatically copied to clipboard

## Testing the Checkout

### Direct Payment (No Link Required)
You can test a direct payment without creating a payment link:
```
https://currency.ph/payment/direct?merchant_id=YOUR_MERCHANT_ID&name=Test+Order&amount=100&currency=PHP
```

### Via Payment Link
Simply visit the generated link:
```
https://currency.ph/payment/test-payment
```

### With URL Parameters
Payment links support additional parameters:
```
https://currency.ph/payment/test-payment?order_id=12345&customer_name=John+Doe&custom_field=custom_value
```

All parameters are merged into the payment metadata.

## Checkout Flow

### For Authenticated Users
1. **Payment Method Selection** → Choose wallet_balance, bank_transfer, credit_card, e_wallet, or crypto
2. **Balance Verification** (for wallet) → System checks wallet balance
3. **Payment Processing** → Execute payment or show deposit instructions

### For Guest Users
1. **Guest Information** → Enter name, email, phone
2. **Custom Fields** (if configured) → Fill any custom fields from payment link
3. **Payment Method Selection** → Choose from available methods
4. **Payment Processing** → Execute payment or show deposit instructions
5. **Success** → Display confirmation with details

## Fee Structure

Fees are calculated based on payment method:
- **Wallet Balance**: 0%
- **Bank Transfer**: 2%
- **Credit Card**: $0.50 + 2.9%
- **E-Wallet**: 2.5%
- **Crypto**: 3%

Fees are automatically calculated and displayed before payment.

## Testing Wallet Payments

1. **Create a Merchant** (see above)
2. **Create a Payment Link** with amount 500 PHP
3. **Ensure you have balance**: Check Wallets page for PHP balance
4. **Visit payment link**: https://currency.ph/payment/your-link-slug
5. **Select "Wallet Balance"**: Payment method (only shows if you have sufficient balance)
6. **Click "Pay Now"**: Payment processes immediately
7. **Verify Success**: Check payment history in Payments Hub

## Testing External Payments

For bank transfers, credit cards, e-wallets, and crypto:

1. Select the payment method
2. Click "Continue"
3. You'll see:
   - Payment instructions step-by-step
   - Animated "Awaiting Payment" indicator
   - Total amount to send
4. Click "I've Completed the Payment" to mark as complete
5. In real integration, webhooks would auto-confirm

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Payment link not found | Invalid slug or link deleted | Check URL, verify link exists in Payments Hub |
| Insufficient balance | Wallet doesn't have enough funds | Deposit more funds to wallet |
| No merchant found | Merchant ID invalid | Create new merchant in Settings |
| Invalid checkout URL | URL format incorrect | Use generated URL from Payment Links |

### Debug Information
The error page displays:
- Error message explaining the issue
- Full URL that was attempted (helps debug URL generation)
- Buttons to return home or go back

## URL Format Examples

**Valid Payment Link URLs:**
```
/payment/my-payment-link
/payment/test-product-1
/payment/order-123
```

**Valid Invoice URLs:**
```
/invoice/INV-2024-001
/invoice/uuid-here
```

**URL with Parameters:**
```
/payment/test-payment?order_id=123&customer=John&amount=500
```

## Payment Link Metadata

Payment links support metadata for customization:

```javascript
{
  custom_logo: "https://example.com/logo.png",
  custom_title: "Order Total",
  custom_description: "Professional Services",
  brand_color: "#10b981",
  text_color: "#1f2937",
  bg_color: "#f8fafc",
  bg_image: "https://example.com/bg.jpg",
  custom_fields: [
    {
      name: "order_id",
      label: "Order ID",
      type: "text",
      placeholder: "e.g., ORD-2024-001",
      required: true
    },
    {
      name: "service",
      label: "Service Type",
      type: "select",
      options: ["Design", "Development", "Consulting"],
      required: true
    }
  ]
}
```

## Troubleshooting

### Payment Link URL Not Working
1. ✅ Verify the payment link exists in Payments Hub
2. ✅ Check the URL slug matches exactly (case-sensitive)
3. ✅ Ensure the merchant is active
4. ✅ Test with a fresh browser tab (clear cache)
5. ✅ Check browser console for errors

### Wallet Payment Not Processing
1. ✅ Verify you have sufficient balance
2. ✅ Ensure wallet currency matches payment currency
3. ✅ Check user is authenticated
4. ✅ Verify merchant is created and active

### Balance Not Showing
1. ✅ Ensure you're logged in
2. ✅ Deposit funds to your wallet first
3. ✅ Refresh the page
4. ✅ Check Wallets page to confirm balance

## API Integration

For programmatic creation of payment links:

```javascript
const paymentLink = await paymentsService.createPaymentLink(merchantId, {
  name: 'Monthly Subscription',
  description: 'Monthly subscription fee',
  amount: 1500,
  currency: 'PHP',
  expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  metadata: {
    custom_logo: 'https://...',
    custom_fields: [...]
  }
});

// Get the URL
const checkoutUrl = `${window.location.origin}/payment/${paymentLink.url_slug}`;
```

## Success Criteria

✅ Payment links are generated with valid URLs
✅ Visiting `/payment/slug` loads the checkout page
✅ Checkout page displays merchant info and product details
✅ User balance is checked for wallet payments
✅ Fees are calculated and displayed correctly
✅ Payment intents are created for all payment methods
✅ Success page displays after payment
✅ Payment records are created in the ledger
✅ URL parameters are properly merged into metadata
✅ Custom fields from metadata are rendered dynamically

## Notes

- Payment links are merchant-specific (each merchant has their own links)
- The checkout page is responsive and works on mobile
- Payment processing logic depends on having a valid merchant
- Wallet balances must be in the same currency as the payment link
- URLs are automatically generated and guaranteed to be unique per merchant
