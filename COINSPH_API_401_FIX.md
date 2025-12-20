# Coins.ph API 401 Unauthorized Error - Fixed

## Problem
The application was receiving `401 Unauthorized` errors from Coins.ph API when trying to fetch cryptocurrency prices and market data:

```
[CoinsPhApi] GET /openapi/quote/v1/ticker/price: API Error: 401
```

## Root Cause
The ticker/price endpoints (`/openapi/quote/v1/ticker/price`, `/openapi/quote/v1/ticker/24hr`, etc.) were marked as **public endpoints** (`isPublic = true`), meaning they were being called **without authentication headers or request signatures**.

However, Coins.ph API **requires authentication for ALL endpoints** - including market data endpoints that appear to be public. The API was rejecting unauthenticated requests with a 401 error.

## Solution
Changed all market data endpoints from `isPublic = true` to `isPublic = false` in the CoinsPhApi class:

### Modified Endpoints:
- `getPrice()` - Get current crypto price
- `getTicker()` - Get 24h ticker stats
- `getKlines()` - Get candlestick data
- `getOrderBook()` - Get order book depth
- `getRecentTrades()` - Get recent trades
- `getExchangeInfo()` - Get exchange information
- `ping()` - Ping server
- `getServerTime()` - Get server time

### Files Changed:
1. **src/lib/coinsPhApi.js**
   - Updated all market data endpoints to use authenticated requests
   - Added comments explaining Coins.ph requires auth for all endpoints

2. **supabase/functions/coinsph-proxy/index.ts**
   - Added debug logging to help diagnose authentication issues
   - Logs whether API key and secret are available

## How Authentication Works

When `isPublic = false`, the Edge Function:
1. Reads `COINSPH_API_KEY` and `COINSPH_API_SECRET` from environment variables
2. Adds timestamp to request parameters
3. Signs request with HMAC-SHA256 using the secret
4. Adds API key to `X-MBX-APIKEY` header
5. Sends authenticated request to Coins.ph API

## Requirements for This Fix

The Supabase Edge Function environment must have:
- `COINSPH_API_KEY` - Your Coins.ph API key
- `COINSPH_API_SECRET` - Your Coins.ph API secret

These should be set in your Supabase project settings.

## Testing

To verify the fix works:

```javascript
import { coinsPhApi } from './lib/coinsPhApi'

// This should now work without 401 errors
const price = await coinsPhApi.getPrice('BTCPHP')
console.log('BTC Price:', price.price)
```

## Expected Behavior After Fix

✅ Price fetches should succeed with 200 status
✅ Market data endpoints should return data
✅ No more 401 Unauthorized errors
✅ Application should display crypto prices correctly

## Troubleshooting

If you still get 401 errors after this fix:

1. **Verify API Credentials**
   - Check that COINSPH_API_KEY is correct
   - Check that COINSPH_API_SECRET is correct
   - Ensure they haven't been rotated in Coins.ph dashboard

2. **Check Supabase Environment Variables**
   - Verify the secrets are set in Supabase project
   - Restart the Edge Function after changing environment variables

3. **Check Logs**
   - View Supabase Edge Function logs to see debug output
   - Look for "Authenticated request setup" messages

4. **API Key Permissions**
   - Verify the API key has the required permissions
   - Some API keys might be restricted to certain endpoints

## References

- Coins.ph API Documentation: https://api.pro.coins.ph/docs
- HMAC-SHA256 Signature: Required for all authenticated endpoints
