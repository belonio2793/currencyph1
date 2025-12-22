# Exchange Rates Hourly Sync - Setup & Testing Guide

## Overview

The `fetch-rates` edge function now runs **every hour** to fetch all world currencies and cryptocurrencies from ExConvert API (primary source) with fallbacks to OpenExchangeRates and CoinGecko.

**Data Stored:**
- 50+ fiat currencies
- 30 cryptocurrencies  
- All pairs stored in `crypto_rates` table with 1-hour expiration
- ~1,500+ exchange rate pairs per sync

**API Sources (Priority):**
1. **ExConvert** (primary) - Unlimited free requests
2. **OpenExchangeRates** (fallback) - Fiat currencies
3. **CoinGecko** (fallback) - Cryptocurrencies
4. **Cached data** (stale fallback) - Last known rates

## Environment Setup

Ensure these variables are set in your Supabase & Netlify:

```
EXCONVERT=af72701a-3f97e936-f7aaea2e-dd9fb482
VITE_EXCONVERT=af72701a-3f97e936-f7aaea2e-dd9fb482
OPEN_EXCHANGE_RATES_API=1ff26c05f12941fcb75443e0b009e407
VITE_OPEN_EXCHANGE_RATES_API=1ff26c05f12941fcb75443e0b009e407
```

Both Supabase and Netlify already have these configured.

## Deployment

### 1. Deploy the Edge Function

```bash
supabase functions deploy fetch-rates
```

### 2. Verify Cron Configuration

The function is configured to run every hour (at minute 0) in `supabase/config.toml`:

```toml
[[functions]]
slug = "fetch-rates"

[functions.scheduling]
cron = "0 * * * *"  # Every hour at :00
```

To modify the schedule:
- `"0 * * * *"` = Every hour at 0 minutes
- `"*/30 * * * *"` = Every 30 minutes  
- `"0 */6 * * *"` = Every 6 hours
- `"0 0 * * *"` = Daily at midnight

## Testing

### Quick Manual Test

```bash
npm run test:fetch-rates
```

This calls the function and displays:
- ✅ Success/failure status
- 📊 Number of rates stored
- 🔄 Data source used
- ⏱️ Timestamp

**Script:** `scripts/test-fetch-rates.js`

### Check Database Status

```bash
npm run check:rates-status
```

This displays:
- 📈 Rates by source
- 💰 Unique currencies (50+ fiat + 30 crypto)
- 📦 Total exchange rate pairs stored
- ⏰ Expired entries

**Script:** `scripts/check-rates-status.js`

### Add to package.json

```json
{
  "scripts": {
    "test:fetch-rates": "node scripts/test-fetch-rates.js",
    "check:rates-status": "node scripts/check-rates-status.js"
  }
}
```

## Implementation Details

### Function Flow

```
1. GET /fetch-rates
   ↓
2. Check cache (if fresh within 1 hour, return)
   ↓
3. Try ExConvert API:
   - Fetch all 50+ fiat currencies
   - Fetch all 30 cryptocurrencies
   - Store 1,500+ pairs in crypto_rates table
   ↓
4. If ExConvert fails:
   - Fall back to OpenExchangeRates (fiat)
   - Fall back to CoinGecko (crypto)
   ↓
5. If all fail:
   - Return cached data (even if stale)
   - Return error with 500 status
```

### Database Table: `crypto_rates`

```sql
CREATE TABLE crypto_rates (
  id UUID PRIMARY KEY,
  from_currency VARCHAR(20) NOT NULL,
  to_currency VARCHAR(20) NOT NULL,
  rate NUMERIC(36, 18) NOT NULL,
  source VARCHAR(50) NOT NULL,
  updated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  UNIQUE(from_currency, to_currency)
);

CREATE INDEX idx_crypto_rates_from_to ON crypto_rates(from_currency, to_currency);
CREATE INDEX idx_crypto_rates_updated_at ON crypto_rates(updated_at DESC);
```

### Response Format

```json
{
  "success": true,
  "cached": false,
  "fetched_at": "2024-12-22T15:00:00.000Z",
  "source": "exconvert",
  "total_rates_stored": 1520,
  "currency_pairs": 78,
  "message": "Successfully fetched and stored rates from exconvert"
}
```

## Currencies Included

### Fiat (50+)
USD, EUR, GBP, JPY, AUD, CAD, CHF, CNY, SEK, NZD, MXN, SGD, HKD, NOK, KRW, TRY, RUB, INR, BRL, ZAR, PHP, THB, MYR, IDR, VND, PKR, BDT, AED, SAR, QAR, KWD, JOD, ILS, EGP, NGN, KES, GHS, CLP, PEN, COP, UYU, ARS, VEF, CZK, HUF, PLN, RON, BGN, HRK, RSD

### Crypto (30)
BTC, ETH, LTC, DOGE, XRP, ADA, SOL, AVAX, DOT, LINK, UNI, AAVE, USDC, USDT, BNB, XLM, TRX, HBAR, TON, SUI, BCH, SHIB, PYUSD, WLD, XAUT, PEPE, HYPE, ASTER, ENA, SKY

## Monitoring

### Check Recent Syncs

Monitor function logs in Supabase Dashboard:
```
Supabase → Project → Edge Functions → fetch-rates → Logs
```

Watch for:
- ✅ `ExConvert succeeded`
- ⚠️ `Fallback to secondary sources`
- ❌ `All primary APIs failed`

### Performance Notes

- ExConvert: ~80-120 API calls for all currencies (fast)
- Storage: ~1,500 pairs in `crypto_rates` table
- Memory: Minimal (under 50MB per run)
- Runtime: ~2-5 minutes per sync
- Cost: Free with ExConvert unlimited tier

## Troubleshooting

### Rates Not Updating

1. Check function deployment:
   ```bash
   supabase functions list
   ```

2. Check environment variables in Supabase:
   - Dashboard → Settings → Secrets
   - Verify `EXCONVERT` key is set

3. Check logs:
   ```bash
   supabase functions logs fetch-rates
   ```

4. Test manually:
   ```bash
   npm run test:fetch-rates
   ```

### API Endpoints Failing

1. ExConvert down? → Falls back to OpenExchangeRates + CoinGecko
2. All APIs down? → Uses stale cached data
3. No cached data? → Returns empty response with error

Check which source succeeded in logs: `[fetch-rates] ... succeeded`

### Storage Issues

If rates aren't storing:

1. Check database connection:
   ```bash
   npm run check:rates-status
   ```

2. Check table permissions:
   ```sql
   SELECT * FROM crypto_rates LIMIT 1;
   ```

3. Verify table structure:
   ```sql
   \d crypto_rates
   ```

## Next Steps

1. ✅ Deploy function: `supabase functions deploy fetch-rates`
2. ✅ Test manually: `npm run test:fetch-rates`
3. ✅ Check database: `npm run check:rates-status`
4. ✅ Wait for hourly cron: Watch logs at XX:00 each hour
5. 📊 Monitor success rate over 24 hours
6. 🎯 Integrate rates into UI/API endpoints

## Integration Points

Fetch rates from database:
```javascript
// Get single pair
const { data } = await supabase
  .from('crypto_rates')
  .select('*')
  .eq('from_currency', 'BTC')
  .eq('to_currency', 'PHP')
  .single()

// Get all rates for a currency
const { data } = await supabase
  .from('crypto_rates')
  .select('*')
  .eq('from_currency', 'BTC')
  .order('updated_at', { ascending: false })
```

## Files Modified

- `supabase/functions/fetch-rates/index.ts` - Updated edge function
- `supabase/config.toml` - Added cron job configuration
- `scripts/test-fetch-rates.js` - New test script
- `scripts/check-rates-status.js` - New status check script
