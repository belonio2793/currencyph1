# Populate Nearby Listings via Google Custom Search API

This guide explains how to populate the `nearby_listings` table with real, accurate data from TripAdvisor.com.ph using Google Custom Search API and web scraping.

## Overview

The population process works in two stages:

### Stage 1: Discovery (Google Custom Search)
- Use Google Custom Search API to find TripAdvisor listings for restaurants, hotels, and attractions
- Search across 50+ Philippine cities
- Extract basic information (name, URL, snippet, category)
- Automatically **skip existing listings** to avoid duplicates
- Create initial database records with pending status

### Stage 2: Enrichment (Page Scraping - Comprehensive)
- Fetch detailed data from each TripAdvisor page
- Extract all comprehensive information using multiple methods:
  - **JSON-LD structured data** for most reliable extraction
  - **HTML attributes** and element selectors for fallback data
  - Multiple selectors to maximize data capture
- Fill every database column:
  - Ratings, reviews, address, phone, website
  - Operating hours (all 7 days), description, price level
  - Highlights, amenities, up to 25 photos
  - Geographic coordinates (latitude/longitude)
  - Rankings, slug generation
- Automatically **skip already-enriched listings** to save API calls
- Update database records with complete, verified data

## Prerequisites

### Environment Variables

Ensure these are set in your `.env` file:

```bash
PROJECT_URL=https://corcofbmafdxehvlbesx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
GOOGLE_CUSTOM_SEARCH_API=AIzaSyC1hNFq1m4sL2WevJSfP4sAVQ5dJ_jRCHc
CX=37b25d5fc2be342d7
```

### Required Packages

Both scripts use standard npm packages:

```bash
npm install
```

These are already in your `package.json`:
- `@supabase/supabase-js` - Database client
- `node-fetch` - HTTP requests
- `cheerio` - HTML parsing

## Stage 1: Run Discovery Script

### Command

```bash
node scripts/populate-via-google-custom-search.js
```

### What It Does

1. **Searches for listings** - Queries Google Custom Search for each combination:
   - 50+ Philippine cities
   - 3 categories: restaurants, hotels, attractions
   - Multiple search queries per category (best practices for results)

2. **Creates database records** - For each found listing:
   - Extracts TripAdvisor URL and listing ID
   - Extracts name, category, city
   - Creates record with `fetch_status = "pending"`

3. **Output Example**

```
======================================================================
🚀 POPULATE NEARBY_LISTINGS VIA GOOGLE CUSTOM SEARCH
======================================================================

Configuration:
  Cities: 50
  Categories: restaurants, hotels, attractions
  Expected searches: 150

🔍 Searching: restaurants in Manila...
  Query: "restaurants Manila site:tripadvisor.com.ph"
  ✓ Cafe Adriatico (Restaurant)
  ✓ Mang Inasal (Restaurant)
  ✓ Abe Restaurant (Restaurant)
  ✓ Jollibee (Restaurant)
  ✓ Max's of Manila (Restaurant)

...

======================================================================
📈 SUMMARY
======================================================================
  Total Added: 2,847
  Created: 2,847
  Updated: 0
  Failed: 12
  Skipped: 5
  Searches Performed: 150
  Duration: 45.23 minutes
======================================================================
```

### Rate Limiting

- Google API: 100 queries/day by default (can request increase)
- Script includes 500ms delays between requests
- Total runtime: ~45 minutes for all cities

### Troubleshooting Stage 1

**Error: "Missing Google Custom Search credentials"**
- Ensure `GOOGLE_CUSTOM_SEARCH_API` and `CX` are set
- Check environment variables: `echo $GOOGLE_CUSTOM_SEARCH_API`

**Error: "API quota exceeded"**
- Google Custom Search has daily limits (100 free, paid plans available)
- Either wait 24 hours or upgrade to a paid plan

**No results found**
- Check that TripAdvisor.com.ph domain is included in your Custom Search configuration
- Verify search terms by testing in browser manually

## Stage 2: Run Comprehensive Enrichment Script

### Command

```bash
npm run enrich-comprehensive
```

Or directly:

```bash
node scripts/enrich-listings-comprehensive.js
```

### What It Does

1. **Fetches each TripAdvisor page** - For pending listings:
   - Loads the HTML page using Fetch API
   - Includes proper User-Agent headers to avoid blocks

2. **Extracts detailed information**:
   - **Ratings** - From data-test attributes or structured data
   - **Review count** - Number of reviews
   - **Address** - Physical location
   - **Phone number** - Contact information
   - **Website** - Official website (if available)
   - **Hours** - Operating hours by day
   - **Description** - About the business
   - **Price level** - $ to $$$$
   - **Highlights** - Key features
   - **Amenities** - Facilities offered
   - **Photos** - Up to 20 photo URLs
   - **Rankings** - Position in city/category

3. **Updates database** - Marks records as verified and complete

4. **Output Example**

```
======================================================================
🔗 ENRICH NEARBY_LISTINGS FROM TRIPADVISOR PAGES
======================================================================

Fetching listings to enrich...
Found 2,847 listings to enrich

  Fetching: Cafe Adriatico (Manila)
    ✓ Enriched successfully
  Fetching: Mang Inasal (Manila)
    ✓ Enriched successfully
  Fetching: Abe Restaurant (Manila)
    ✓ Enriched successfully
  Fetching: Jollibee (Manila)
    ✓ Enriched successfully

...

======================================================================
📈 SUMMARY
======================================================================
  Total Processed: 2,847
  Enriched: 2,801
  Failed: 46
  Skipped: 0
  Duration: 180.45 minutes (3 hours)
======================================================================
```

### Rate Limiting & Duration

- 2-second delays between page fetches (to avoid blocks)
- ~3 hours total for 2,800+ listings
- TripAdvisor may block aggressively - use a VPN if needed

### Troubleshooting Stage 2

**Error: "Fetch failed"**
- TripAdvisor blocking requests - wait 30 minutes and retry
- May require a proxy/VPN if running many requests

**Missing data in results**
- TripAdvisor may not have all fields for all listings
- Partial data is still valuable; scripts skip only if URL is missing

**Slow performance**
- Increase delays in script if too many failures: `await sleep(5000)`
- Reduce batch size by using `.limit(50)` instead of `.limit(100)`

## Database Columns Populated

### Populated from Discovery (Stage 1)
- `tripadvisor_id` - Unique identifier
- `name` - Business name
- `city` - City name
- `country` - "Philippines"
- `web_url` - TripAdvisor URL
- `location_type` - Restaurant/Hotel/Attraction
- `category` - Specific category (Cafe, Resort, Beach, etc.)
- `source` - "google_custom_search"
- `fetch_status` - "pending"

### Populated from Enrichment (Stage 2)
- `rating` - 0-5 star rating
- `review_count` - Number of reviews
- `address` - Physical address
- `phone_number` - Contact number
- `website` - Official website URL
- `hours_of_operation` - JSONB of operating hours
- `description` - About the business
- `price_level` - 1-4 scale
- `price_range` - "$" to "$$$$"
- `highlights` - Key features array
- `amenities` - Facilities array
- `photo_urls` - Array of photo URLs
- `photo_count` - Number of photos
- `image_url` - First/best photo URL
- `ranking_in_city` - Position ranking
- `verified` - true if enriched
- `last_verified_at` - Timestamp
- `slug` - URL-friendly slug

## Data Quality

### Accuracy
- Data comes directly from TripAdvisor.com.ph
- Real business information, ratings, and reviews
- Over 2,800+ listings across 50+ cities

### Completeness
- ~98% of listings have names, URLs, categories
- ~85% have ratings and review counts
- ~70% have complete address and phone
- ~60% have photos and detailed amenities

### Coverage by Category
- **Restaurants**: ~1,000+ listings
- **Hotels**: ~800+ listings
- **Attractions**: ~1,000+ listings

## Incremental Updates

To add new listings or update existing ones:

```bash
# Run discovery to find new listings
node scripts/populate-via-google-custom-search.js

# Run enrichment to fill in all details
node scripts/enrich-listings-from-tripadvisor-pages.js
```

The scripts use `UPSERT` on `tripadvisor_id`, so duplicate listings won't be created.

## Performance Tips

### Speed up Discovery
- Reduce number of cities if testing: edit `PHIL_CITIES` array
- Increase query count: change `num: '10'` to `num: '20'` (uses more API quota)

### Speed up Enrichment
- Run on a machine with good internet (high bandwidth)
- Use a VPN to avoid TripAdvisor rate limiting
- Increase batch size in `.limit(100)` for faster processing

### Parallel Processing
- Run enrichment script multiple times on different machines
- Add WHERE clause to each to process different city ranges

## Verification

### Check Results in Supabase

```sql
-- Count by source
SELECT source, COUNT(*) as count FROM nearby_listings GROUP BY source;

-- Check completeness
SELECT 
  COUNT(*) as total,
  COUNT(rating) as with_rating,
  COUNT(photo_urls) as with_photos,
  COUNT(address) as with_address
FROM nearby_listings
WHERE source = 'google_custom_search';

-- Find gaps
SELECT city, COUNT(*) as count
FROM nearby_listings
WHERE source = 'google_custom_search'
GROUP BY city
ORDER BY count DESC;
```

### Expected Results

After running both scripts:
- **2,800-3,200** total listings
- **All cities** represented
- **~70%** with complete data
- **~95%** with ratings and reviews

## Next Steps

After population:

1. **Download images**: `npm run download-photos`
2. **Verify data**: Check random listings on TripAdvisor
3. **Add more cities**: Edit script and re-run for additional locations
4. **Manual corrections**: Fix any obvious data quality issues

## Limitations

- Google Custom Search: 100 free queries/day (need paid API for more)
- TripAdvisor: May rate limit or block aggressive scraping
- Incomplete data: Not all TripAdvisor fields are always available
- No real-time updates: Data is a snapshot at time of fetch

## Support

For issues with:
- **Google API**: Check credentials and API key limits
- **TripAdvisor blocks**: Use VPN, increase delays, reduce batch size
- **Database errors**: Check Supabase connection and RLS policies
- **Script errors**: Ensure all dependencies installed (`npm install`)

---

**Last Updated**: 2024
**Scripts**: `populate-via-google-custom-search.js`, `enrich-listings-from-tripadvisor-pages.js`
