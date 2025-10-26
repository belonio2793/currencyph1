# TripAdvisor Philippines Comprehensive Population Guide

This guide covers how to populate your database with ALL TripAdvisor listings across the Philippines.

## What Gets Populated

✅ **120+ Philippine Cities & Municipalities**
✅ **9 Search Categories** (attractions, museums, parks, beaches, restaurants, etc.)
✅ **Real-time Data** from TripAdvisor API or high-quality mock data
✅ **Automatic Deduplication** (no duplicate entries)
✅ **Database Auto-Update** (overwrites existing listings)

## Method 1: Web UI (Easiest)

### Step 1: Go to Admin Page
Click the **Admin** button in the top navigation

### Step 2: Select Population Type
1. Click **Full TripAdvisor API** tab
2. Read the description
3. Click **Start Full Population** button

### Step 3: Monitor Progress
- Real-time progress bar shows % completion
- Message updates show what's being processed
- Takes 10-30 minutes depending on API responsiveness

### Step 4: See Results
Success message shows:
- Total listings collected
- Total unique listings
- Total inserted into database

**Example Output:**
```
✓ Success!
Total fetched: 2,847
Unique saved: 2,847
Successfully populated 2,847 unique listings from 120 Philippine cities across 9 categories
```

## Method 2: Command Line

### Quick Start
```bash
# Install dependencies
npm install

# Run population script
npm run populate-all
```

### Alternative: Direct Node.js
```bash
node scripts/populate-all-listings.js
```

### Alternative: Bash Script
```bash
chmod +x scripts/populate-all-listings.sh
./scripts/populate-all-listings.sh
```

### Progress Output
```
==================================================
  TripAdvisor Philippines Comprehensive Population
==================================================

Cities to process: 120
Categories: 9
Total operations: 1,080

[0.1%] Manila - attractions
[0.2%] Manila - things to do
[0.3%] Manila - museums
...
[100.0%] Calamian - churches

Collected 2,847 unique listings

Inserting into database...
[1/57] Database insert batch - 50/2,847
[2/57] Database insert batch - 100/2,847
...
[57/57] Database insert batch - 2,847/2,847

==================================================
✓ Population completed!
  Total listings collected: 2,847
  Total inserted: 2,847
==================================================
```

## Method 3: Scheduled/Automated

### Using Cron Job
Run the population every Sunday at 2 AM:

```bash
# Edit crontab
crontab -e

# Add this line:
0 2 * * 0 cd /path/to/project && npm run populate-all >> /var/log/population.log 2>&1
```

### Using npm Task
```bash
# One-time run
npm run populate-all

# Watch for automatic reruns (requires nodemon)
npm install -D nodemon
nodemon --exec "npm run populate-all" --watch scripts
```

## Architecture

### How It Works

```
┌─────────────────────────────────────────────────┐
│ User clicks "Start Full Population" button      │
└────────────────┬────────────────────────────────┘
                 │
        ┌────────▼────────┐
        │ React Component │
        └────────┬────────┘
                 │
    ┌────────────▼─────────────┐
    │ populateTripadvisorListings()
    │ (src/lib/populateTripadvisorListings.js)
    └────────────┬──────────────┘
                 │
    ┌────────────▼──────────────────┐
    │ For each city × category:      │
    │ • Try TripAdvisor API          │
    │ • Fallback to mock data        │
    │ • Deduplicate by listing ID    │
    └────────────┬──────────────────┘
                 │
    ┌────────────▼───────────────┐
    │ Insert in batches (50/batch)│
    │ Update progress UI          │
    │ Rate limit: 300ms/request   │
    └────────────┬───────────────┘
                 │
    ┌────────────▼────────────────┐
    │ Supabase Database           │
    │ nearby_listings table        │
    └─────────────────────────────┘
```

### Data Flow

1. **Fetch Phase** (120 cities × 9 categories)
   - Query TripAdvisor API
   - Get 10 results per query
   - Fallback to mock data if API fails
   - Deduplicate by `tripadvisor_id`

2. **Insert Phase**
   - Batch insert (50 records per batch)
   - `upsert` mode (overwrites existing)
   - Conflict resolution by `tripadvisor_id`
   - Auto-update `updated_at` timestamp

3. **Result**
   - ~2,800-3,500 unique listings
   - Ready to use in your app
   - Images can be imported separately

## Configuration

### Environment Variables Required

```bash
# Supabase credentials (required)
VITE_PROJECT_URL=https://your-project.supabase.co
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# TripAdvisor API (optional - uses mock data fallback if not set)
VITE_TRIPADVISOR=your-api-key
```

### Advanced Configuration

Edit `src/lib/populateTripadvisorListings.js` to customize:

```javascript
// Change cities included
const PHILIPPINES_CITIES = [
  'Manila', 'Cebu', 'Davao', // ... add or remove cities
]

// Change search categories
const SEARCH_CATEGORIES = [
  'attractions',
  'museums',
  'parks'
  // ... customize categories
]

// Change batch size
const batchSize = 100  // Default: 50

// Change rate limit
await new Promise(resolve => setTimeout(resolve, 500))  // Default: 300ms
```

## Verification

### Check Database
In Supabase SQL Editor:

```sql
-- Count total listings
SELECT COUNT(*) as total_listings
FROM nearby_listings;

-- See sample listings
SELECT name, category, rating, address
FROM nearby_listings
LIMIT 10;

-- See listings by category
SELECT category, COUNT(*) as count
FROM nearby_listings
GROUP BY category
ORDER BY count DESC;

-- See listings by city (from raw data)
SELECT COUNT(*) as count, raw->>'city' as city
FROM nearby_listings
WHERE raw->>'city' IS NOT NULL
GROUP BY raw->>'city'
ORDER BY count DESC
LIMIT 20;
```

### Expected Results
- **Total listings**: 2,500-3,500 unique
- **Per city**: 20-50 listings on average
- **Categories**: All 9 categories represented
- **Ratings**: 3.0-5.0 scale

### Sample Queries

```sql
-- Get top-rated attractions
SELECT name, rating, category, address
FROM nearby_listings
WHERE category = 'Attraction'
ORDER BY rating DESC
LIMIT 10;

-- Get all beaches
SELECT name, rating, reviewCount
FROM nearby_listings
WHERE category = 'Beach'
ORDER BY rating DESC;

-- Get everything in Manila
SELECT name, category, rating
FROM nearby_listings
WHERE raw->>'city' = 'Manila'
ORDER BY rating DESC;
```

## Troubleshooting

### "Missing environment variables"
```bash
# Check if variables are set
echo $VITE_PROJECT_URL
echo $VITE_SUPABASE_SERVICE_ROLE_KEY

# If not set, add to .env file
VITE_PROJECT_URL=https://...
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### "TripAdvisor API returning nothing"
- API key may be invalid
- API quota may be exceeded
- Script will automatically fall back to mock data
- Check the console logs for details

### "Database insert errors"
- Check if `nearby_listings` table exists
- Verify service role key has INSERT permissions
- Check Supabase quota limits

### "Slow population"
- Rate limiting is intentional (300ms per request)
- Total time: ~10-30 minutes for 1,080 API calls
- Consider running overnight for large-scale population

### "Progress bar not showing"
- Check browser console for errors
- Make sure you're on the admin page
- Refresh the page and try again

## Performance Notes

| Metric | Value |
|--------|-------|
| **Cities** | 120 |
| **Categories** | 9 |
| **Requests** | 1,080 (120 × 9) |
| **Results/Request** | 10 |
| **Rate Limit** | 300ms between requests |
| **Total Time** | 10-30 minutes |
| **Unique Listings** | 2,500-3,500 |
| **Database Size** | ~50-100 MB |

## Next Steps

After population:

1. **Import Photos**
   ```bash
   npm run import-photos
   ```

2. **Verify in App**
   - Go to Nearby tab
   - See listings from all cities
   - Browse by category

3. **Use in Frontend**
   ```javascript
   // Display listings
   listings.map(listing => (
     <div key={listing.id}>
       <h3>{listing.name}</h3>
       <p>{listing.category}</p>
       <p>Rating: {listing.rating}/5</p>
     </div>
   ))
   ```

4. **Create Filters**
   - Filter by category
   - Filter by rating
   - Filter by city
   - Search by name

## FAQ

**Q: Will it overwrite existing listings?**
A: Yes, it uses `upsert` with conflict on `tripadvisor_id`. Same ID = overwrite.

**Q: Can I run it multiple times?**
A: Yes! It's safe to run multiple times. Duplicate IDs are merged.

**Q: How long does it take?**
A: ~15-30 minutes depending on API responsiveness. Show progress bar so users know it's working.

**Q: What if API fails?**
A: Script automatically uses high-quality mock data. Better than nothing, and still gives you 2,000+ listings.

**Q: Can I populate just one city?**
A: Yes, edit `src/lib/populateTripadvisorListings.js` and change `PHILIPPINES_CITIES` array.

**Q: Can I add more categories?**
A: Yes, edit the `SEARCH_CATEGORIES` array in the same file.

**Q: Where are the images?**
A: Use `npm run import-photos` after population to download TripAdvisor images.

---

**Created**: 2024
**Last Updated**: 2024
**Version**: 1.0
