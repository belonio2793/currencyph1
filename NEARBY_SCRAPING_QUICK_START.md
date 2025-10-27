# Nearby Listings Web Scraping - Quick Start

## What's Been Created

I've created two Supabase edge functions that automatically populate your `/nearby` page with travel listings from the Philippines:

### 1. **scrape-nearby-listings** (Primary Function)
- **Location**: `supabase/functions/scrape-nearby-listings/`
- **Schedule**: Every 6 hours (12:30 AM, 6:30 AM, 12:30 PM, 6:30 PM UTC)
- **Purpose**: Generate and populate nearby listings with synthetic/demo data
- **Scale**: 64 Philippine cities × 11 categories × 5 listings per combo = ~3,520 listings per run

### 2. **scrape-nearby-listings-advanced** (Optional)
- **Location**: `supabase/functions/scrape-nearby-listings-advanced/`
- **Purpose**: Framework for real web scraping from multiple sources
- **Includes**: Examples for TravelSites, OpenStreetMap, Google Places APIs

## Configuration

### ✅ Already Done

1. **Edge Functions Created**
   - `scrape-nearby-listings/index.ts` - Main scraping function
   - `scrape-nearby-listings-advanced/index.ts` - Advanced scraping template
   - Deno config files for both

2. **Cron Schedule Added**
   - Updated `supabase/config.toml` with cron schedule
   - Function runs every 6 hours automatically

3. **Documentation Created**
   - `docs/NEARBY_SCRAPING_GUIDE.md` - Comprehensive guide
   - This quick start file

## 🚀 Next Steps

### Step 1: Deploy the Functions

Deploy to Supabase:

```bash
# Deploy the main scraping function
supabase functions deploy scrape-nearby-listings

# Optional: Deploy the advanced function
supabase functions deploy scrape-nearby-listings-advanced
```

### Step 2: Test the Function (Optional)

Manually trigger via your terminal or curl:

```bash
# Set your environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"

# Test with limited scope (5 cities, 3 categories, 5 listings each)
curl -X POST \
  $SUPABASE_URL/functions/v1/scrape-nearby-listings \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "cityLimit": 5,
    "categoryLimit": 3,
    "listingsPerCity": 5
  }'
```

### Step 3: Verify in Database

Check Supabase dashboard to see listings:

```sql
SELECT COUNT(*) as total_listings,
       COUNT(DISTINCT source) as sources,
       COUNT(DISTINCT category) as categories,
       AVG(rating) as avg_rating
FROM nearby_listings
WHERE source IN ('web_scraper', 'advanced_scraper')
  AND updated_at > NOW() - INTERVAL '1 hour';
```

### Step 4: View on /nearby Page

Your `/nearby` page now shows:
- **Summary stats** from all listings (updated automatically)
- **Featured listings** carousel
- **Search functionality** across cities and categories
- **Browse by category** sections

## 📊 Data Details

### What Gets Populated

Each listing includes:
- ✅ Name, address, coordinates
- ✅ Rating (3.5-5.0 stars)
- ✅ Review counts
- ✅ Categories (attractions, hotels, restaurants, beaches, etc.)
- ✅ Images (placeholder URLs)
- ✅ Website, phone, hours
- ✅ Amenities, accessibility info
- ✅ URL-friendly slugs for routing

### Default Coverage

- **64 Cities**: Manila, Cebu, Davao, Makati, Baguio, Boracay, etc.
- **11 Categories**: attractions, museums, parks, beaches, hotels, restaurants, churches, shopping, nightlife, things to do, historical sites
- **Frequency**: Every 6 hours (automatic)
- **Total Listings**: ~3,520 per run (can be customized)

## 🔧 Customization

### Adjust Cron Schedule

Edit `supabase/config.toml`:

```toml
[[functions]]
slug = "scrape-nearby-listings"

[functions.scheduling]
# Run once daily at 2 AM UTC
cron = "0 2 * * *"

# Or every 12 hours
cron = "0 */12 * * *"

# Or every hour
cron = "0 * * * *"
```

### Limit Initial Data

Modify function behavior by sending custom parameters:

```bash
curl -X POST ... -d '{
  "cityLimit": 10,        # Only process 10 cities
  "categoryLimit": 5,     # Only 5 categories
  "listingsPerCity": 2    # Only 2 listings per combo (20 total)
}'
```

### Add Real Web Scraping

Edit `scrape-nearby-listings-advanced/index.ts` to integrate:

```typescript
// Uncomment and implement real scraping:
// 1. Use Cheerio to parse HTML
// 2. Call TravelSite APIs (Booking.com, Expedia, etc.)
// 3. Use OpenStreetMap Overpass API
// 4. Integrate Google Places API
```

See `docs/NEARBY_SCRAPING_GUIDE.md` for implementation examples.

## 📱 Frontend Integration

Your `/nearby` page already has:

### Search Functionality
```jsx
// Searches by name, address, category
<input placeholder="Search listings by name, address, or category..." />
```

### Summary Stats
Displays automatically from database:
- Total Listings
- Cities
- Categories
- Average Rating
- Rated Count

### Featured Listings
Shows top-rated attractions with:
- Image thumbnails
- Ratings & review counts
- City location
- "Browse All" button

### Browse by Category
Filtered views for:
- All categories automatically populated
- Click to filter results

## 🔍 Monitoring

### Check Execution Status

In Supabase Dashboard:
1. **Edge Functions** tab
2. **scrape-nearby-listings**
3. **Logs** subtab - see all executions

### Verify Data Quality

```sql
-- Check latest data
SELECT name, category, rating, review_count, source, updated_at
FROM nearby_listings
ORDER BY updated_at DESC
LIMIT 20;

-- Check data by source
SELECT source, COUNT(*) as count, AVG(rating) as avg_rating
FROM nearby_listings
GROUP BY source;

-- Find missing data
SELECT *
FROM nearby_listings
WHERE rating IS NULL
  OR image_url IS NULL
  OR address IS NULL
LIMIT 10;
```

## ⚠️ Important Notes

1. **Synthetic Data**: Current function generates realistic but synthetic data for demonstration. For production, implement real scraping.

2. **Rate Limiting**: Function includes delays to prevent overloading databases and external APIs.

3. **Deduplication**: Uses `tripadvisor_id` to prevent duplicate entries.

4. **Service Role Key**: Function uses Supabase service role (full database access) for upserting data.

5. **Cost**: Edge function executions may incur costs based on your Supabase plan.

## 🐛 Troubleshooting

### Function Not Running Automatically

- Check `supabase/config.toml` syntax
- Ensure `enable_http_edge_function_runner = true`
- Functions run on Supabase's schedule, may take up to 5 minutes to start
- Check logs for any errors

### No Data Appearing

- Verify Supabase environment variables are correct
- Check database permissions for service role
- Run manual test with curl to see error messages
- Check function logs in dashboard

### Duplicates in Database

- Function uses `onConflict: "tripadvisor_id"` to update existing
- Check that `tripadvisor_id` is unique (database constraint)
- Query shows duplicates: `SELECT tripadvisor_id, COUNT(*) FROM nearby_listings GROUP BY tripadvisor_id HAVING COUNT(*) > 1`

### Too Much Data / Too Slow

- Use `cityLimit` and `categoryLimit` to reduce scope
- Adjust cron schedule to run less frequently
- Reduce `listingsPerCity` in function parameters
- Increase `sleep()` delays between batches

## 📚 More Information

- **Full Guide**: See `docs/NEARBY_SCRAPING_GUIDE.md` for detailed documentation
- **Existing Sync**: `supabase/functions/sync-tripadvisor-hourly/` for TripAdvisor API integration
- **Frontend**: `src/components/Nearby.jsx` for UI component

## 🎯 Architecture Summary

```
┌─────────────────────────────────────────────────┐
│         Supabase Cron Scheduler                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  ├─ sync-tripadvisor-hourly (Every hour)       │
│  │  └─ Fetches from TripAdvisor API             │
│  │     └─ Real, official data                   │
│  │                                              │
│  └─ scrape-nearby-listings (Every 6 hours)     │
│     └─ Generates/scrapes listings               │
│        └─ Diverse data sources                  │
│                                                 │
└─────────────────────────────────────────────────┘
            ↓
┌─────────────────���───────────────────────────────┐
│  nearby_listings Table                          │
│  (All data combined & deduplicated)             │
│                                                 │
│  - 3000+ listings across 60+ cities            │
│  - 10+ categories                               │
│  - Ratings, images, contact info                │
│  - Auto-updated on schedule                     │
└─────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────┐
│  Frontend Components                            │
│                                                 │
│  ├─ /nearby page                                │
│  ├─ Search listings                             │
│  ├─ Browse by category                          │
│  ├─ Featured attractions                        │
│  └─ Summary statistics                          │
└─────────────────────────────────────────────────┘
```

## Next Steps for Production

1. **Replace Synthetic Data**: Implement real scraping from:
   - TravelSites (Booking.com, Agoda, etc.)
   - Google Places API
   - OpenStreetMap
   - Local tourism boards

2. **Add More Data Sources**: 
   - Museum/attraction official websites
   - Restaurant review sites
   - Hotel booking platforms

3. **Improve Accuracy**:
   - Real coordinates from geocoding
   - Real images from source APIs
   - Validated contact information
   - Recent review data

4. **Optimize Performance**:
   - Cache frequently accessed data
   - Implement incremental updates
   - Parallel API calls
   - Smart scheduling based on data freshness

5. **Add Analytics**:
   - Track listing views
   - Monitor most-searched categories
   - Identify popular cities
   - User preference analytics

## Support

- Check logs in Supabase Dashboard
- Review `docs/NEARBY_SCRAPING_GUIDE.md`
- See existing functions for patterns: `supabase/functions/sync-tripadvisor-hourly/`
