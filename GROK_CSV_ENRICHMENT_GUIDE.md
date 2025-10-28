# Grok AI CSV Enrichment for TripAdvisor Listings

This guide walks you through enriching your TripAdvisor listings CSV with Grok AI and automatically updating your Supabase database.

## What This Does

- ✅ Reads your `nearby-listings.csv` file
- ✅ Uses **Grok API** to fetch real TripAdvisor data for each listing
- ✅ Enriches fields: name, address, phone, website, description, ratings, reviews, amenities, hours
- ✅ Automatically upserts all records to your Supabase `nearby_listings` table
- ✅ Provides detailed progress reporting

## Prerequisites

1. **Grok API Key** (you have this: `xai-qe0lzba8kfDmccd5EBClqO7ELZXxYG3hyyetV1b5D4dISqjStXLHcFElnYfmRD3ddy0gV4sHxnR3XZT3`)
2. **Supabase Credentials** (already in environment)
3. **Node.js 16+** installed locally
4. **CSV file** at the project root: `nearby-listings.csv`

## Setup

### Step 1: Environment Variables

Make sure these are set in your terminal/system:

```bash
# Grok API Key
export X_API_KEY="xai-qe0lzba8kfDmccd5EBClqO7ELZXxYG3hyyetV1b5D4dISqjStXLHcFElnYfmRD3ddy0gV4sHxnR3XZT3"

# Supabase (should already be set)
export PROJECT_URL="https://corcofbmafdxehvlbesx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Step 2: Verify CSV File

Your `nearby-listings.csv` file should be in the project root with columns:
- `id`, `name`, `city`, `latitude`, `longitude`, `category`, `rating`, `review_count`, `phone_number`, `website`, `description`, etc.

The provided sample has 4 listings from different Philippine cities.

### Step 3: Install Dependencies (if needed)

```bash
npm install
# or
yarn install
```

## Usage

### Option A: Using NPM Script (Recommended)

```bash
npm run grok-enrich-csv
```

### Option B: Direct Node.js

```bash
node scripts/grok-enrich-csv-listings.js
```

### Option C: Using Shell Script

```bash
chmod +x scripts/enrich-listings-from-grok.sh
./scripts/enrich-listings-from-grok.sh
```

## Expected Output

```
��� Reading CSV file...
📊 Parsed 4 listings from CSV
🚀 Starting enrichment with Grok API...

[1/4] Processing: Beach Resort - Imus (Imus)
✅ Upserted: Beach Resort - Imus (Imus)

[2/4] Processing: Heritage Site - Negros Occidental (Negros Occidental)
✅ Upserted: Heritage Site - Negros Occidental (Negros Occidental)

[3/4] Processing: Traditional Eatery - Davao del Sur (Davao del Sur)
✅ Upserted: Traditional Eatery - Davao del Sur (Davao del Sur)

[4/4] Processing: Malate Church (Manila)
✅ Upserted: Malate Church (Manila)

==================================================
✅ Complete! Success: 4, Failures: 0
📊 Total processed: 4/4
==================================================
```

## What Gets Updated in Supabase

For each listing, the script enriches these fields:

| Field | Source | Example |
|-------|--------|---------|
| `name` | Grok | "Aristocrat Restaurant" |
| `address` | Grok | "Corner of Roxas Boulevard and Magdalo Street, Manila" |
| `phone_number` | Grok | "+63 2 5521-2503" |
| `website` | Grok | "https://aristocrat.com.ph" |
| `description` | Grok | "Classic Filipino restaurant serving authentic dishes since 1936" |
| `rating` | Grok | 4.5 (0-5 scale) |
| `review_count` | Grok | 1850 |
| `price_range` | Grok | "$$" or "$$$" |
| `hours_of_operation` | Grok | "9:00 AM - 10:00 PM" |
| `amenities` | Grok | ["WiFi", "Parking", "Air Conditioning"] |
| `photo_urls` | Grok | ["https://example.com/photo1.jpg"] |
| `web_url` | Grok | TripAdvisor listing URL |
| `verified` | Script | true |
| `updated_at` | Script | Current timestamp |

## Advanced Options

### Process Only Specific Cities

Edit `scripts/grok-enrich-csv-listings.js` and add a filter:

```javascript
// Add after parsing CSV
const listings = parseCSV(csvContent)
  .filter(l => ['Manila', 'Cebu', 'Davao'].includes(l.city))
```

### Adjust Rate Limiting

Modify the delay between API calls (in milliseconds):

```javascript
const batchSize = 3      // Process 3 listings before pause
const delayMs = 2000     // Wait 2000ms (2 seconds)
```

### Test a Single Listing

Create a test file:

```javascript
// test-single.js
import { enrich } from './scripts/grok-enrich-csv-listings.js'

const testListing = {
  name: 'Test Hotel',
  city: 'Manila',
  category: 'hotels'
}

const result = await grokEnrichListing(testListing)
console.log(result)
```

## Troubleshooting

### ❌ "Missing X_API_KEY"

```bash
# Solution: Set the environment variable
export X_API_KEY="xai-qe0lzba8kfDmccd5EBClqO7ELZXxYG3hyyetV1b5D4dISqjStXLHcFElnYfmRD3ddy0gV4sHxnR3XZT3"

# Verify it's set
echo $X_API_KEY
```

### ❌ "CSV file not found"

```bash
# Solution: Ensure nearby-listings.csv is in project root
ls -la nearby-listings.csv

# Or update the CSV path in the script:
# Line in grok-enrich-csv-listings.js:
const csvPath = path.join(__dirname, '..', 'your-csv-name.csv')
```

### ❌ Grok API Errors (401, 403)

```
❌ Grok API error (401): Invalid authentication
```

**Solution:** Your API key is invalid or expired. Check:
1. The key is correct
2. The key hasn't expired
3. The key has API permissions enabled

### ❌ Supabase Connection Failed

```
❌ Missing Supabase credentials. Set PROJECT_URL and SERVICE_ROLE_KEY
```

**Solution:** Ensure environment variables are set:
```bash
export PROJECT_URL="https://corcofbmafdxehvlbesx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

### ❌ Rate Limiting (429 Too Many Requests)

```
❌ Grok API error (429)
```

**Solution:** Increase the delay:
```javascript
const batchSize = 1      // Process only 1 per batch
const delayMs = 5000     // Wait 5 seconds between batches
```

## Performance

- **Listings/Hour:** ~50-100 (depends on rate limiting)
- **API Calls:** 1 per listing
- **Average Response Time:** 1-3 seconds per listing
- **Network:** Secure, uses bearer token authentication

## Data Validation

The script automatically:
- Removes empty/null values before upserting
- Converts numbers (rating, review_count) to proper types
- Parses coordinates as floats
- Sets timestamps to ISO 8601 format
- Marks all records as `verified: true`

## Next Steps

After enrichment:

1. **Verify Data Quality**
   ```bash
   # Check a specific listing
   npm run check-listings-by-city Manila
   ```

2. **Backup Original CSV**
   ```bash
   cp nearby-listings.csv nearby-listings.backup.csv
   ```

3. **Monitor Supabase**
   - Open Supabase dashboard
   - Go to Table Editor
   - Select `nearby_listings` table
   - Verify the enriched data

4. **Update Your Frontend**
   - The app should automatically reflect new data from Supabase
   - Clear browser cache if needed

## Example: Custom CSV Processing

If you want to process an external CSV file:

```bash
# Copy your CSV to the project root
cp /path/to/your/listings.csv ./nearby-listings.csv

# Run enrichment
npm run grok-enrich-csv

# Verify results
grep -c "✅" output.log
```

## Support

For issues:
1. Check the troubleshooting section above
2. Review logs in your terminal
3. Verify CSV format matches expectations
4. Test API key directly: `echo $X_API_KEY`

## Security Notes

- ✅ API key is used only for Grok API calls
- ✅ Service role key is used only for Supabase writes
- ✅ No data is logged or stored externally
- ✅ All connections use HTTPS
- ⚠️ Never commit `.env` files with secrets
- ⚠️ Store sensitive keys in environment variables only

## License & Attribution

This script is part of your currency.ph project.
Grok API is provided by xAI (https://x.ai)
