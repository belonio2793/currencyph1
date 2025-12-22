# Fix Cryptocurrency Rates Fetching (503 Error)

## Problem
The `fetch-rates` edge function is returning **503 Offline - resource not available**, which means the edge function is not responding or deployed properly.

## Root Cause
The edge function at `supabase/functions/fetch-rates/index.ts` requires:
1. **Deployment** - Must be deployed to Supabase
2. **Environment Variables** - Needs EXCONVERT_KEY, OPEN_EXCHANGE_RATES_API, SUPABASE credentials
3. **Database Tables** - Needs `pairs`, `cached_rates`, and `crypto_rates` tables to exist

## Solution: Step-by-Step Fix

### Step 1: Deploy the Edge Function
```bash
# From project root, deploy the fetch-rates edge function
supabase functions deploy fetch-rates
```

**Expected output:**
```
Deploying function 'fetch-rates'...
✓ Deployed function 'fetch-rates'
```

### Step 2: Verify Environment Variables in Supabase
The function uses these env vars (check in Supabase Dashboard → Project Settings → Edge Functions):

```
SUPABASE_URL: https://corcofbmafdxehvlbesx.supabase.co
SUPABASE_SERVICE_ROLE_KEY: [your-service-role-key]
EXCONVERT: af72701a-3f97e936-f7aaea2e-dd9fb482
OPEN_EXCHANGE_RATES_API: 1ff26c05f12941fcb75443e0b009e407
```

All these are already set in your environment_variables. They just need to be configured in Supabase.

### Step 3: Verify Required Database Tables Exist
The function stores rates in these tables:
- `pairs` - stores from_currency, to_currency, rate
- `crypto_rates` - stores cryptocurrency rates
- `cached_rates` - caches latest rates

**Check if tables exist:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('pairs', 'crypto_rates', 'cached_rates');
```

### Step 4: Seed Initial Data (Optional)
If tables are empty, run the seed script:
```bash
node scripts/seed-currency-rates.js
```

### Step 5: Test the Function
```bash
# Test the edge function
node scripts/test-fetch-rates.js
```

**Expected response:**
```json
{
  "success": true,
  "cached": false,
  "fetched_at": "2024-...",
  "source": "database",
  "total_fiat_pairs": 1000+,
  "cryptocurrencies": 30
}
```

## How the Function Works

### Priority Order for Fetching Rates:
1. **Database (Primary)** - Loads pre-populated rates from `pairs` table
2. **ExConvert API** - Falls back to ExConvert (31 cryptocurrencies, 163 fiat currencies)
3. **OpenExchangeRates + CoinGecko** - Final fallback for fiat + crypto rates
4. **Cache** - Returns last known good rates if all APIs fail

### Data Flow:
```
User calls currencyAPI.getGlobalRates()
    ↓
Edge function fetch-rates (via Supabase invoke)
    ↓
Checks fresh cache (1 hour TTL)
    ↓
Tries database pairs table
    ↓
Falls back to APIs (ExConvert, OpenExchangeRates, CoinGecko)
    ↓
Stores results in cached_rates and pairs tables
    ↓
Returns rates to client
```

## Monitoring & Debugging

### Check Edge Function Logs
```bash
# View real-time function logs
supabase functions logs fetch-rates
```

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| 503 Offline | Function not deployed - run `supabase functions deploy fetch-rates` |
| Timeout | Database is slow or offline - check RLS policies |
| Invalid rates (0.00 or NaN) | Filter in function removes invalid data automatically |
| No cached data | Run seed script: `node scripts/seed-currency-rates.js` |
| API rate limits | ExConvert has 100 requests/min, CoinGecko is free but throttled |

## What Was Changed

### New SQL Migration (059_add_wallet_type_column.sql)
- Added `type` column to `wallets` table (fiat, crypto, wire)
- Auto-populates type from currency type via trigger
- New view: `user_wallets_by_type` for querying wallets by type

### Updated Wallet Display Customizer
- Now shows both Fiat Currency and Cryptocurrency tabs
- Separated currency lists by type
- Users can add both fiat and crypto wallets
- Color-coded UI (blue for fiat, orange for crypto)

### Key Improvements
- Wallets now track their type in database
- Easy to filter/display wallets by type
- Crypto rates can be fetched independently
- Better wallet management for mixed currency portfolios

## Testing the Complete Flow

```bash
# 1. Deploy migration to Supabase
supabase db push

# 2. Deploy edge function
supabase functions deploy fetch-rates

# 3. Test fetch-rates function
node scripts/test-fetch-rates.js

# 4. Seed rates if needed
node scripts/seed-currency-rates.js

# 5. Test in app
# Navigate to /wallets
# Click "Add More Currencies"
# Select both fiat and crypto currencies
# Verify rates are fetched and displayed
```

## Additional Resources
- Edge Function: `supabase/functions/fetch-rates/index.ts`
- Currency API: `src/lib/currencyAPI.js`
- Wallet Service: `src/lib/walletService.js`
- Migration: `supabase/migrations/059_add_wallet_type_column.sql`

## Next Steps
1. Run `supabase functions deploy fetch-rates`
2. Verify function is responding (test via scripts/test-fetch-rates.js)
3. Check Supabase logs if errors persist
4. Consider increasing timeout for slow networks
