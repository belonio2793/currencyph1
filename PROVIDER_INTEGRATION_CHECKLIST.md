# Provider Integration Checklist

Use this checklist for each payment provider as you set up accounts.

---

## 🌍 dLocal Integration

**Provider**: https://dlocal.com  
**Coverage**: 50+ countries (LatAm, Africa, Asia)  
**Priority**: HIGH (emerging markets)

### Setup Checklist

- [ ] Sign up account at dlocal.com
- [ ] Complete business verification
- [ ] Get API credentials (Key + Secret)
- [ ] Get webhook secret
- [ ] Test integration in sandbox mode

### Code Integration

- [ ] Add to `.env.local`:
  ```bash
  DLOCAL_API_KEY=xxx
  DLOCAL_WEBHOOK_SECRET=xxx
  ```
- [ ] Implement `processDlocalDeposit()` in `supabase/functions/process-deposit/index.ts`
- [ ] Implement webhook handler in `supabase/functions/deposit-webhook/index.ts`
- [ ] Update `src/lib/depositService.js`:
  ```javascript
  available: true,
  comingSoon: false
  ```
- [ ] Deploy functions: `supabase functions deploy process-deposit`

### Testing

- [ ] Test deposit initiation in development
- [ ] Verify deposit record created in database
- [ ] Test webhook with sandbox credentials
- [ ] Verify balance credit on successful payment
- [ ] Test with multiple currencies (BRL, MXN, ARS, etc.)

### Production Deployment

- [ ] Update API keys to production
- [ ] Configure production webhook URL
- [ ] Monitor first 10 transactions
- [ ] Check balance updates in real-time
- [ ] Set up alerts for failed deposits

### Documentation

- [ ] Add dLocal to README.md
- [ ] Update supported payment methods list
- [ ] Document regional coverage

---

## 🔵 Circle Integration

**Provider**: https://circle.com/api  
**Focus**: Stablecoin (USDC) payments  
**Priority**: HIGH (crypto ecosystem)

### Setup Checklist

- [ ] Sign up at circle.com
- [ ] Complete API setup
- [ ] Get API key
- [ ] Get webhook secret
- [ ] Set up USDC wallet for receiving

### Code Integration

- [ ] Add to `.env.local`:
  ```bash
  CIRCLE_API_KEY=xxx
  CIRCLE_WEBHOOK_SECRET=xxx
  CIRCLE_WALLET_ID=xxx
  ```
- [ ] Implement `processCircleDeposit()` in process-deposit
- [ ] Implement webhook handler in deposit-webhook
- [ ] Update depositService.js for Circle activation
- [ ] Deploy functions

### Testing

- [ ] Test USDC payment on testnet
- [ ] Verify wallet receives USDC
- [ ] Test webhook processing
- [ ] Test multi-chain support (ETH, Polygon, Arbitrum, Solana)
- [ ] Verify balance credit

### Production Deployment

- [ ] Switch to production API key
- [ ] Update wallet IDs for mainnet
- [ ] Configure mainnet RPC endpoints
- [ ] Monitor transactions
- [ ] Test USDC → platform balance conversion

---

## 🌊 Flutterwave Integration

**Provider**: https://flutterwave.com  
**Coverage**: Africa (Nigeria, Kenya, Ghana, Tanzania, Uganda, South Africa)  
**Priority**: HIGH (Africa expansion)

### Setup Checklist

- [ ] Sign up at flutterwave.com
- [ ] Complete KYC verification
- [ ] Get merchant ID
- [ ] Get API key
- [ ] Get webhook secret
- [ ] Set up bank account for receiving

### Code Integration

- [ ] Add to `.env.local`:
  ```bash
  FLUTTERWAVE_API_KEY=xxx
  FLUTTERWAVE_WEBHOOK_SECRET=xxx
  FLUTTERWAVE_MERCHANT_ID=xxx
  ```
- [ ] Implement `processFlutterWaveDeposit()` in process-deposit
- [ ] Implement webhook handler in deposit-webhook
- [ ] Update depositService.js for Flutterwave
- [ ] Deploy functions

### Testing

- [ ] Test mobile money payment (Nigeria)
- [ ] Test bank transfer (Kenya)
- [ ] Test card payment
- [ ] Verify webhook processing
- [ ] Test multiple currencies (NGN, KES, GHS, ZAR, etc.)

### Production Deployment

- [ ] Switch API key to production
- [ ] Configure production webhook URL
- [ ] Monitor live transactions
- [ ] Set up SMS notifications for users

---

## 🛒 Checkout.com Integration

**Provider**: https://www.checkout.com  
**Coverage**: Europe + Global  
**Priority**: MEDIUM (European expansion)

### Setup Checklist

- [ ] Sign up at checkout.com
- [ ] Complete merchant verification
- [ ] Get API key
- [ ] Get webhook secret
- [ ] Set up bank account

### Code Integration

- [ ] Add to `.env.local`:
  ```bash
  CHECKOUT_API_KEY=xxx
  CHECKOUT_WEBHOOK_SECRET=xxx
  ```
- [ ] Implement `processCheckoutDeposit()` in process-deposit
- [ ] Implement webhook handler
- [ ] Update depositService.js
- [ ] Deploy functions

### Testing

- [ ] Test card payments (EUR, GBP, etc.)
- [ ] Test SEPA transfers
- [ ] Verify webhook processing
- [ ] Test 3D Secure flows

### Production Deployment

- [ ] Use production API key
- [ ] Monitor compliance requirements
- [ ] Track card rejection rates

---

## 🌙 MoonPay Integration

**Provider**: https://www.moonpay.com  
**Focus**: Global crypto on/off ramp  
**Priority**: HIGH (crypto onboarding)

### Setup Checklist

- [ ] Sign up at moonpay.com
- [ ] Complete business verification
- [ ] Get API key
- [ ] Get secret key
- [ ] Configure receiving wallets

### Code Integration

- [ ] Add to `.env.local`:
  ```bash
  MOONPAY_API_KEY=xxx
  MOONPAY_SECRET_KEY=xxx
  ```
- [ ] Implement `processMoonPayDeposit()` in process-deposit
- [ ] Implement webhook handler
- [ ] Update depositService.js
- [ ] Deploy functions

### Testing

- [ ] Test purchasing BTC
- [ ] Test purchasing ETH
- [ ] Test USDC purchases
- [ ] Verify wallet receipt
- [ ] Test webhook confirmations

### Production Deployment

- [ ] Switch to production credentials
- [ ] Configure production wallet addresses
- [ ] Monitor deposit flows

---

## 🚀 Ramp Integration

**Provider**: https://ramp.network  
**Focus**: Privacy-focused crypto ramp  
**Priority**: MEDIUM (privacy users)

### Setup Checklist

- [ ] Sign up at ramp.network
- [ ] Request API access
- [ ] Get API key
- [ ] Configure host API key
- [ ] Set receiving wallets

### Code Integration

- [ ] Add to `.env.local`:
  ```bash
  RAMP_API_KEY=xxx
  RAMP_HOST_API_KEY=xxx
  ```
- [ ] Implement Ramp SDK widget integration
- [ ] Update depositService.js
- [ ] Handle payment confirmations
- [ ] Deploy functions

### Testing

- [ ] Test widget in sandbox
- [ ] Test crypto purchases
- [ ] Verify payments received
- [ ] Test webhook handling

### Production Deployment

- [ ] Use production credentials
- [ ] Monitor widget usage
- [ ] Track conversion rates

---

## 📊 Binance Pay Integration

**Provider**: https://pay.binance.com  
**Focus**: Crypto-native, lowest fees  
**Priority**: HIGH (crypto-first users)

### Setup Checklist

- [ ] Create business account at binance.com
- [ ] Complete identity verification
- [ ] Set up Binance Pay
- [ ] Get API key + secret
- [ ] Configure receiving address

### Code Integration

- [ ] Add to `.env.local`:
  ```bash
  BINANCE_PAY_API_KEY=xxx
  BINANCE_PAY_SECRET_KEY=xxx
  ```
- [ ] Implement `processBinancePayDeposit()` in process-deposit
- [ ] Implement webhook handler
- [ ] Update depositService.js
- [ ] Deploy functions

### Testing

- [ ] Test BUSD payment
- [ ] Test USDT payment
- [ ] Test BNB payment
- [ ] Verify balance updates
- [ ] Test webhook processing

### Production Deployment

- [ ] Use production credentials
- [ ] Monitor for API rate limits
- [ ] Track low fee impact on margins

---

## 🎯 Crypto.com Pay Integration

**Provider**: https://crypto.com/pay  
**Focus**: Merchant crypto acceptance  
**Priority**: MEDIUM (alternative to Binance)

### Setup Checklist

- [ ] Sign up at crypto.com/pay
- [ ] Complete business verification
- [ ] Get API key
- [ ] Get secret key
- [ ] Configure wallets

### Code Integration

- [ ] Add to `.env.local`:
  ```bash
  CRYPTO_COM_PAY_API_KEY=xxx
  CRYPTO_COM_PAY_SECRET_KEY=xxx
  ```
- [ ] Implement payment processor
- [ ] Implement webhook handler
- [ ] Update depositService.js
- [ ] Deploy functions

### Testing

- [ ] Test USDC payments
- [ ] Test USDT payments
- [ ] Test CRO payments
- [ ] Verify receipts

### Production Deployment

- [ ] Switch to production
- [ ] Monitor settlement rates
- [ ] Track fiat conversion if needed

---

## General Post-Integration Checklist

For EACH provider after activation:

### Monitoring
- [ ] Set up alerts for failed deposits
- [ ] Monitor payment success rate (target: >95%)
- [ ] Track average processing time
- [ ] Monitor webhook failure rate

### User Communication
- [ ] Update documentation
- [ ] Add to payment methods page
- [ ] Create help articles
- [ ] Notify users of new option

### Analytics
- [ ] Track daily active users
- [ ] Track total volume
- [ ] Track average transaction size
- [ ] Compare with other methods

### Compliance
- [ ] Verify KYC requirements met
- [ ] Monitor transaction limits
- [ ] Track regulatory changes
- [ ] Update terms of service

### Performance
- [ ] API response time < 2 seconds
- [ ] Webhook processing < 5 seconds
- [ ] Balance updates within 1 minute
- [ ] Error rate < 1%

---

## Quick Reference: Files to Update Per Provider

For each provider, update these files:

1. **`.env.local`** - Add API credentials
2. **`src/lib/depositService.js`** - Set available: true, comingSoon: false
3. **`supabase/functions/process-deposit/index.ts`** - Add processor function
4. **`supabase/functions/deposit-webhook/index.ts`** - Add webhook handler
5. **`README.md`** - Document new payment method
6. **Documentation** - Add to payment methods list

---

## Deployment Script

After completing integration:

```bash
# 1. Test locally
npm run dev
# → Test deposit flow with new method

# 2. Deploy functions
supabase functions deploy process-deposit
supabase functions deploy deposit-webhook

# 3. Verify deployment
curl https://your-project.supabase.co/functions/v1/process-deposit -X OPTIONS

# 4. Test in production with sandbox credentials
# → Make test deposit

# 5. Monitor logs
supabase functions list
supabase functions logs process-deposit --limit 50

# 6. Switch to production credentials
# → Update .env.local with production API keys

# 7. Redeploy with production keys (if using environment variables)
supabase functions deploy process-deposit
```

---

## Status Tracking

| Provider | Account | API Key | Backend | Webhook | Testing | Deployed | Live |
|----------|---------|---------|---------|---------|---------|----------|------|
| dLocal | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Circle | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Flutterwave | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Checkout | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| MoonPay | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Ramp | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Binance Pay | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Crypto.com | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |

---

**Print this document and check off items as you complete provider integrations!**

**Last Updated**: December 2025  
**Version**: 1.0
