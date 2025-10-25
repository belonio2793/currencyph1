# Currency.ph API Integration Guide

## Overview
This document provides setup and integration instructions for all external APIs used by Currency.ph.

---

## 1. Supabase Setup

### Create Supabase Project
1. Go to https://supabase.com and sign up
2. Create a new project (select free tier)
3. Wait for database to initialize (~1-2 minutes)
4. Get your project credentials:
   - **Project URL**: https://your-project-id.supabase.co
   - **Anon Key**: Found in "Settings > API"

### Environment Variables
```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Initialize Database
1. Go to "SQL Editor" in Supabase dashboard
2. Copy the schema from `docs/SUPABASE_SCHEMA.md`
3. Paste and execute the full initialization script
4. Verify tables appear in "Table Editor"

### Enable Real-time Subscriptions
1. Go to "Database > Replication"
2. Enable replication for tables: `users`, `projects`, `contributions`, `votes`
3. Verify in frontend: Check React DevTools → subscriptions

---

## 2. Payment Gateway Integration

### GCash (Dragonpay)

#### Sandbox Registration
1. Go to https://developer.gcash.com
2. Sign up for sandbox account
3. Create test merchant account
4. Get credentials:
   - **Merchant ID**: Your merchant account ID
   - **API Key**: Secret API key for server-side calls

#### Environment Variables
```bash
VITE_GCASH_SANDBOX_URL=https://sandbox.dragonpay.com
VITE_GCASH_MERCHANT_ID=your-merchant-id
VITE_GCASH_API_KEY=your-secret-api-key
```

#### Integration Flow
```javascript
// 1. Frontend: User clicks "Add via GCash"
const handleGCash = async (amount) => {
  // 2. Call backend edge function to create payment request
  const response = await fetch('/api/payments/gcash/create', {
    method: 'POST',
    body: JSON.stringify({ amount, userId })
  });
  const { redirectUrl } = await response.json();
  
  // 3. Redirect to GCash sandbox
  window.location.href = redirectUrl;
  
  // 4. User completes payment in GCash
  // 5. GCash redirects back with payment confirmation
  // 6. Webhook updates Supabase contributions table
};
```

#### Supabase Edge Function (create function via dashboard)
```typescript
// supabase/functions/payments/gcash/create/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const { amount, userId } = await req.json();
  
  // 1. Create payment request in GCash API
  const gcashResponse = await fetch('https://sandbox.dragonpay.com/api/pay/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('GCASH_API_KEY')}`
    },
    body: JSON.stringify({
      merchantId: Deno.env.get('GCASH_MERCHANT_ID'),
      amount,
      description: `Currency.ph deposit - ₱${amount}`
    })
  });
  
  const { paymentUrl } = await gcashResponse.json();
  
  // 2. Store pending transaction in Supabase
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  );
  
  await supabase.from('contributions').insert({
    user_id: userId,
    project_id: null, // General fund
    amount,
    payment_method: 'gcash',
    status: 'pending'
  });
  
  return new Response(JSON.stringify({ redirectUrl: paymentUrl }));
});
```

### Maya (Stripe)

#### Sandbox Registration
1. Go to https://developer.maya.ph
2. Sign up and create test account
3. Get Stripe test keys from Maya dashboard

#### Environment Variables
```bash
VITE_STRIPE_PUBLIC_KEY=pk_test_your_public_key
VITE_STRIPE_SECRET_KEY=sk_test_your_secret_key # Server-side only
```

#### Integration Flow
```javascript
import Stripe from '@stripe/stripe-js';

const handleMaya = async (amount) => {
  const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);
  
  // 1. Call backend to create payment intent
  const response = await fetch('/api/payments/stripe/intent', {
    method: 'POST',
    body: JSON.stringify({ amount, userId })
  });
  const { clientSecret } = await response.json();
  
  // 2. Redirect to Stripe payment form
  const result = await stripe.confirmCardPayment(clientSecret, {
    payment_method: {
      card: cardElement,
      billing_details: { name: 'user@example.com' }
    }
  });
  
  if (result.paymentIntent.status === 'succeeded') {
    // 3. Payment confirmed
    updateBalance(amount);
  }
};
```

### Bank Card (Stripe)

Same as Maya integration (Stripe handles both).

---

## 3. Fiat Rate API (OANDA)

#### Registration
1. Go to https://developer.oanda.com
2. Sign up for free account
3. Create API token in account settings
4. Get your **Account ID** and **API Token**

#### Environment Variables
```bash
VITE_OANDA_API_KEY=your-api-token
VITE_OANDA_ACCOUNT_ID=your-account-id
```

#### Real-time Rate Fetching
```javascript
// src/lib/cryptoAPI.js
export const getPhpUsdRate = async () => {
  const response = await fetch('https://api-fxpractice.oanda.com/v3/instruments/USD_PHP/candles', {
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_OANDA_API_KEY}`,
      'Accept-Datetime-Format': 'Unix'
    },
    params: {
      granularity: 'M1', // 1-minute candle
      price: 'BBA',
      count: 1
    }
  });
  
  const { candles } = await response.json();
  return parseFloat(candles[0].bid.c); // Closing price
};

// Usage in BalanceSection
const phpToUsd = async (phpAmount) => {
  const rate = await getPhpUsdRate();
  return phpAmount / rate;
};
```

---

## 4. Cryptocurrency Rates (AbstractAPI)

#### Registration
1. Go to https://www.abstractapi.com/api/cryptocurrency
2. Sign up for free account
3. Get your **API Key**

#### Environment Variables
```bash
VITE_ABSTRACTAPI_KEY=your-api-key
```

#### Real-time Crypto Rate Fetching
```javascript
export const getCryptoPrices = async () => {
  const response = await fetch(
    `https://api.abstractapi.com/v1/crypto/token_exchange_rate?api_key=${import.meta.env.VITE_ABSTRACTAPI_KEY}`,
    {
      params: {
        base: 'USD',
        target: 'BTC,ETH,USDC',
        get_latest: true
      }
    }
  );
  
  return await response.json();
};

// Usage: Convert PHP to BTC
export const phpToBtc = async (phpAmount) => {
  const phpUsdRate = await getPhpUsdRate();
  const usdAmount = phpAmount / phpUsdRate;
  
  const prices = await getCryptoPrices();
  const btcUsdRate = prices.data.BTC.exchange_rate;
  
  return usdAmount / btcUsdRate;
};
```

---

## 5. Chainlink Oracle (Future - Production)

#### Purpose
On-chain price feeds for Polygon smart contracts.

#### Integration (for future production)
```solidity
// contracts/CurrencyPHToken.sol
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract CurrencyPHToken {
    AggregatorV3Interface internal phpUsdPriceFeed;
    AggregatorV3Interface internal btcUsdPriceFeed;
    
    constructor() {
        // Polygon mainnet price feeds
        phpUsdPriceFeed = AggregatorV3Interface(0x...); // PHP/USD
        btcUsdPriceFeed = AggregatorV3Interface(0x...);  // BTC/USD
    }
    
    function getLatestPrice(address feed) public view returns (int) {
        (,int price,,,) = AggregatorV3Interface(feed).latestRoundData();
        return price;
    }
}
```

#### Chainlink Feeds Available
- **PHP/USD**: Chainlink doesn't have PHP yet → Use OANDA
- **BTC/USD**: Address varies by chain
- **ETH/USD**: Address varies by chain

---

## 6. Geofencing (IP-based Region Detection)

#### Supabase Edge Function
```typescript
// supabase/functions/middleware/geofence/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip');
  
  // Use GeoIP service (free options: ip-api.com, ipstack.com)
  const geoResponse = await fetch(`https://ip-api.com/json/${clientIp}`);
  const { countryCode } = await geoResponse.json();
  
  const allowedRegions = ['PH', 'ID', 'MY', 'TH', 'VN', 'SG', 'TW'];
  
  if (!allowedRegions.includes(countryCode)) {
    return new Response('Service not available in your region', { status: 403 });
  }
  
  return new Response('OK', { status: 200 });
});
```

#### Frontend Usage
```javascript
// Check region on app load
useEffect(() => {
  const checkRegion = async () => {
    const response = await fetch('/.netlify/functions/geofence');
    if (response.status === 403) {
      navigate('/restricted'); // Show region-blocked page
    }
  };
  checkRegion();
}, []);
```

---

## Testing Credentials

### GCash Sandbox
- **Test Phone**: Any valid format (sandbox doesn't validate)
- **Test Amount**: ₱500 - ₱100,000
- **Expected Result**: Immediate confirmation

### Stripe Test Cards
| Card | Number | Expiry | CVC |
|------|--------|--------|-----|
| Visa | 4242 4242 4242 4242 | 12/25 | 123 |
| Mastercard | 5555 5555 5555 4444 | 12/25 | 123 |

### OANDA Sandbox
- Use `fxpractice.oanda.com` (free, no real trading)
- Rates are real-time but trading is simulated

### AbstractAPI
- Free tier: 500 requests/month
- Response time: ~500ms per request
- No caching → Implement frontend caching

---

## Error Handling

### Payment API Errors
```javascript
const handlePaymentError = (error) => {
  if (error.code === 'INSUFFICIENT_FUNDS') {
    alert('Insufficient balance. Please add funds first.');
  } else if (error.code === 'REGION_BLOCKED') {
    alert('Service not available in your region.');
  } else if (error.code === 'NETWORK_ERROR') {
    alert('Network error. Please try again.');
  }
};
```

### Rate API Errors
```javascript
// Implement fallback rates if API fails
const getCryptoRateWithFallback = async () => {
  try {
    return await getCryptoPrices();
  } catch (error) {
    console.warn('AbstractAPI error, using fallback rates');
    return fallbackRates; // Last known good rates
  }
};
```

---

## Rate Limiting & Caching

### API Quotas
| API | Free Tier | Limit |
|-----|-----------|-------|
| OANDA | Yes | 2,000 requests/month |
| AbstractAPI | Yes | 500 requests/month |
| GCash | Yes (sandbox) | Unlimited |
| Stripe | Yes (test) | Unlimited |

### Caching Strategy
```javascript
const cacheRates = {
  php_usd: { value: 56.5, timestamp: Date.now() },
  btc_usd: { value: 45000, timestamp: Date.now() }
};

const getRateWithCache = async (pair, maxAge = 60000) => {
  const cached = cacheRates[pair];
  if (cached && Date.now() - cached.timestamp < maxAge) {
    return cached.value;
  }
  
  const fresh = await fetchRate(pair);
  cacheRates[pair] = { value: fresh, timestamp: Date.now() };
  return fresh;
};
```

---

## Monitoring & Debugging

### Sentry Integration (Future)
```javascript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_ENV
});

// Track API calls
Sentry.captureMessage('GCash payment initiated', 'info');
```

### Logs
- Check Supabase logs: "Logs" tab in dashboard
- Check edge function logs: `supabase functions --tail`
- Check frontend errors: Browser DevTools console

---

## Checklist: API Setup

- [ ] Supabase project created + database initialized
- [ ] Environment variables configured
- [ ] GCash sandbox account created
- [ ] Stripe test account created
- [ ] OANDA API token obtained
- [ ] AbstractAPI key obtained
- [ ] Supabase edge functions deployed
- [ ] Payment flow tested with test credentials
- [ ] Real-time rate fetching working
- [ ] Error handling implemented
- [ ] Caching implemented for rate APIs

---

## Next Steps

1. Create `.env.local` from `.env.example`
2. Fill in all API credentials
3. Test each API individually with cURL/Postman
4. Deploy Supabase edge functions
5. Run integration tests
6. Monitor logs for errors

---

## Support

- **Supabase Support**: https://supabase.com/docs/guides/getting-started
- **Stripe Docs**: https://stripe.com/docs
- **OANDA API Docs**: https://developer.oanda.com/rest-live-v20/introduction/
- **AbstractAPI Docs**: https://www.abstractapi.com/api/cryptocurrency
