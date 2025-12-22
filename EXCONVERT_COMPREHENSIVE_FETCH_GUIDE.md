# ExConvert Comprehensive Rate Fetch Guide

## Overview

This system fetches **all ~163 fiat currencies + all 31 supported cryptocurrencies** from ExConvert API and stores them in your SQL database. Users then fetch rates from the database, not from APIs on page load.

## Architecture

```
ExConvert API (unlimited requests)
    ↓
scripts/fetch-all-exconvert-rates.js (comprehensive fetcher)
    ↓
Database: pairs table + crypto_rates table
    ↓
supabase/functions/fetch-rates/ (returns cached DB data)
    ↓
Frontend (reads from DB via edge function)
```

## Running the Comprehensive Fetch

### First Time Setup

The script will fetch all fiat currencies to each other + all cryptocurrencies:

```bash
npm run fetch-all-exconvert-rates
```

This will:
- **Fiat pairs**: ~26,500 (163 × 162)
- **Crypto pairs**: ~2,300 (31 cryptos to 15 major fiats + 30 other cryptos)
- **Total pairs**: ~28,800
- Take approximately **2-3 hours** depending on network
- Show progress for each stage (fiat + crypto)
- Store results in `pairs` and `crypto_rates` tables

### Expected Output

```
🚀 Starting Comprehensive ExConvert Rate Fetch

📊 Configuration:
   Fiat currencies: 163
   Cryptocurrencies: 31
   Total symbols: 194
   Total pairs to fetch: 37,442
   Estimated time: ~94 minutes (at 150ms per request)

📊 Stage 1: Fetching fiat currency pairs...

⏳ Fiat progress: 20/163 (3080 pairs, 154.2s)
⏳ Fiat progress: 40/163 (6160 pairs, 308.5s)
...

📊 Stage 2: Fetching cryptocurrency pairs...

⏳ Crypto progress: 1/31 (46 pairs, 2345.1s)
⏳ Crypto progress: 2/31 (92 pairs, 2456.3s)
...

✨ Fetch Complete!

📈 Results:
   Total time: 94.25 minutes
   Fiat pairs fetched: 26300
   Crypto pairs fetched: 2290
   Successful fetches: 28590
   Failed fetches: 210
   Success rate: 99.3%
   Stored in database: 28590
```

## Configuration

Edit the script to adjust:

```javascript
// scripts/fetch-all-exconvert-rates.js

// Delay between requests (milliseconds)
await new Promise(resolve => setTimeout(resolve, 150)) // Adjust this

// Database batch size
const batchSize = 5000 // Adjust if you get transaction errors
```

## Scheduling (Optional)

To run this periodically (e.g., daily), you can:

### Option 1: Supabase Cron (Edge Function)
Create a scheduled edge function in `supabase/functions/scheduled-exconvert-fetch/`:
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// Call the script via HTTP or database API
```

### Option 2: External Scheduler (Recommended)
Use a service like:
- **GitHub Actions** (free, runs on schedule)
- **EasyCron** (free tier available)
- **IFTTT** + Webhooks
- **AWS EventBridge** + Lambda
- **Your own server** (cron job)

Example GitHub Actions workflow:
```yaml
name: Fetch ExConvert Rates Daily
on:
  schedule:
    - cron: '0 2 * * *' # 2 AM UTC daily
jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run fetch-all-exconvert
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          EXCONVERT: ${{ secrets.EXCONVERT }}
```

## Database Tables

### `pairs` Table
Stores all fiat currency pairs from ExConvert:
```sql
from_currency | to_currency | rate  | source_table | updated_at
USD           | PHP         | 58.79 | exconvert    | 2025-12-22...
EUR           | USD         | 1.173 | exconvert    | 2025-12-22...
```

### `crypto_rates` Table
Also populated for compatibility:
```sql
from_currency | to_currency | rate    | source | updated_at  | expires_at
BTC           | USD         | 103524  | exconvert | 2025-12-22 | 2025-12-23
ETH           | PHP         | 178577  | exconvert | 2025-12-22 | 2025-12-23
```

## Edge Function Behavior

After running the comprehensive fetch, the edge function (`/functions/v1/fetch-rates`) will:

1. **Check database first** - Returns all stored pairs instantly
2. **Supplement with CoinGecko** - Adds real-time crypto prices
3. **Fallback gracefully** - Uses OpenExchangeRates + CoinGecko if database is empty

## Checking Database Population

```bash
node scripts/test-check-db-rates.js
```

This shows:
- How many pairs are in the database
- Latest fetch timestamp
- Source of the data

## Troubleshooting

### Script times out or gets slow
- Increase delay between requests (may hit rate limits if too fast)
- Run at off-peak hours
- Check your internet connection

### Database insert errors
- Reduce `batchSize` in the script
- Check if tables have proper constraints
- Verify service role key has write permissions

### Some currencies fail to fetch
- This is normal - not all currency combinations are supported by ExConvert
- The script continues and stores what it can get
- Check the success rate in the output

## FAQ

**Q: Why fetch everything-to-everything?**
A: Because ExConvert has unlimited free requests, you get the most comprehensive coverage with direct currency pair data.

**Q: How often should I run this?**
A: Daily is recommended for most use cases. Weekly is fine for slower-changing rates.

**Q: Will this interfere with page loads?**
A: No - users fetch from the database, not from APIs. Page loads are fast.

**Q: What if ExConvert API goes down?**
A: Database rates stay available. Edge function falls back to OpenExchangeRates + CoinGecko.

**Q: Can I run multiple fetch scripts simultaneously?**
A: Not recommended - they'll conflict on database writes. Run sequentially.
