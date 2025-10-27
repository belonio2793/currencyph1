# Comprehensive TripAdvisor Listings Setup Guide

This guide walks you through setting up the complete listing system with all TripAdvisor data fields, database schema, and automated fetching.

## Overview

The system automatically fetches comprehensive listing data from TripAdvisor Philippines including:
- Basic info (name, address, rating, reviews)
- Contact details (phone, website, hours)
- Rich content (description, highlights, best_for tags)
- Media (photos, galleries)
- Rankings and awards
- Amenities and accessibility
- Sample reviews
- Nearby attractions

## Step 1: Database Setup

### Option A: Using Supabase Dashboard (Recommended)

1. Open your Supabase project at https://app.supabase.com
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire content from `supabase/migrations/comprehensive_listings_setup.sql`
5. Paste it into the SQL editor
6. Click **Run**
7. Wait for completion (should take 30-60 seconds)

### Option B: Using Supabase CLI

```bash
# If you have the CLI installed
supabase db push
```

## Step 2: Environment Setup

Ensure your `.env` file has the TripAdvisor API key:

```bash
VITE_TRIPADVISOR=your_api_key_here
VITE_PROJECT_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Step 3: Fetch All Philippines Listings

### Quick Method: Using the Bash Script

```bash
# From project root
bash scripts/fetch-all-philippines-listings.sh
```

This script will:
- ✓ Load environment variables
- ✓ Install dependencies if needed
- ✓ Fetch listings from all major Philippine cities
- ✓ Deduplicate results
- ✓ Save to database
- ✓ Display summary statistics

**Duration**: 30-60 minutes depending on API rate limits

### Manual Method: Using Node.js

If the bash script doesn't work on your system:

```bash
# Install dependencies
npm install

# Run the edge function locally (optional)
supabase functions serve

# Or use the npm script
node scripts/fetch-listings-runner.js
```

### Using the Edge Function

After deployment, trigger via API:

```bash
curl -X POST https://your-supabase-url/functions/v1/fetch-comprehensive-listings \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

## Step 4: Update Frontend UI

The `ListingDetail` component automatically displays all the new fields:

- Photo gallery with navigation
- Highlights section
- Best for tags
- Hours of operation
- Amenities list
- Accessibility information
- Nearby attractions
- Recent reviews
- Awards and recognition
- Rankings and ratings

No additional configuration needed!

## Database Schema

### nearby_listings Table

```sql
-- Core fields
id BIGINT PRIMARY KEY
tripadvisor_id TEXT UNIQUE
name TEXT
slug TEXT UNIQUE
address TEXT
latitude DECIMAL
longitude DECIMAL

-- Ratings & Reviews
rating NUMERIC
review_count INTEGER
review_details JSONB

-- Details
description TEXT
category TEXT
location_type TEXT
highlights JSONB
best_for JSONB

-- Contact & Hours
phone_number TEXT
website TEXT
web_url TEXT
hours_of_operation JSONB

-- Admission
admission_fee TEXT
price_level INTEGER

-- Media
photo_count INTEGER
photo_urls TEXT[]
image_url TEXT
featured_image_url TEXT

-- Amenities
amenities JSONB
accessibility_info JSONB
nearby_attractions TEXT[]
awards JSONB

-- Metadata
source TEXT
verified BOOLEAN
last_verified_at TIMESTAMP
ranking_in_city TEXT
ranking_in_category INTEGER
lat DECIMAL (denormalized)
lng DECIMAL (denormalized)

-- Housekeeping
created_at TIMESTAMP
updated_at TIMESTAMP
raw JSONB
```

## API Endpoints

### Edge Functions

#### Fetch Comprehensive Listings
```
POST /functions/v1/fetch-comprehensive-listings
```

Fetches all listings for major Philippine cities and saves to database.

**Response**:
```json
{
  "success": true,
  "totalFetched": 2500,
  "uniqueListings": 2450,
  "saved": 2450,
  "successCount": 45,
  "errorCount": 0,
  "message": "Saved 2450 listings"
}
```

#### Populate Listing Slugs
```
POST /functions/v1/populate-listing-slugs
```

Generates URL-friendly slugs for all listings without them.

### Database Functions

#### Search Listings
```sql
SELECT * FROM search_listings('Manila', 20);
```

#### Get by Category
```sql
SELECT * FROM get_by_category('Restaurant', 30);
```

#### Get Nearby Listings
```sql
-- Get listings within 10km of coordinates
SELECT * FROM get_nearby_listings(14.5951, 120.9731, 10, 20);
```

## Data Fields Explanation

### highlights (JSONB Array)
Key features and attractions of the listing:
```json
["Historic Spanish fortress", "Beautiful architecture", "Museum exhibits"]
```

### best_for (JSONB Array)
Categories this listing is suitable for:
```json
["History enthusiasts", "Photography", "Cultural exploration"]
```

### hours_of_operation (JSONB Object)
Operating hours by day:
```json
{
  "Monday": "9:00 AM - 5:00 PM",
  "Tuesday": "9:00 AM - 5:00 PM",
  "Saturday": "Closed"
}
```

### amenities (JSONB Array)
Available facilities:
```json
["WiFi", "Parking", "Restrooms", "Restaurant", "Wheelchair accessible"]
```

### accessibility_info (JSONB Object)
Accessibility features:
```json
{
  "wheelchair_accessible": true,
  "details": "Ramp access available at main entrance"
}
```

### review_details (JSONB Array)
Sample reviews with metadata:
```json
[
  {
    "author": "John D.",
    "rating": 5,
    "text": "Amazing experience!",
    "date": "2024-01-15",
    "helpful_count": 25
  }
]
```

### awards (JSONB Array)
Recognition and awards:
```json
["Travelers' Choice", "Top Reviewed", "Best Historical Site"]
```

## Updating Listings

### Refresh Data for a Specific Listing

```javascript
import { tripadvisorComprehensiveFetcher } from './src/lib/tripadvisorComprehensiveFetcher'

const detailed = await tripadvisorComprehensiveFetcher.fetchListingDetails(locationId)
```

### Refresh All Listings

```bash
# Using bash script
bash scripts/fetch-all-philippines-listings.sh

# Using edge function
curl -X POST https://your-supabase-url/functions/v1/fetch-comprehensive-listings \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## Querying Examples

### Get Top-Rated Listings
```sql
SELECT name, rating, review_count, address
FROM nearby_listings
WHERE verified = true AND rating IS NOT NULL
ORDER BY rating DESC
LIMIT 10;
```

### Get Listings in a Specific City
```sql
SELECT name, slug, rating, image_url
FROM nearby_listings
WHERE verified = true AND address ILIKE '%Manila%'
ORDER BY rating DESC;
```

### Full-Text Search
```sql
SELECT name, slug, rating, image_url
FROM nearby_listings
WHERE verified = true AND 
  to_tsvector('english', name || ' ' || COALESCE(description, '')) @@ 
  plainto_tsquery('english', 'historical sites Manila');
```

### Get Top Listings by Category
```sql
SELECT name, slug, rating, category
FROM nearby_listings
WHERE verified = true AND category = 'Museum'
ORDER BY rating DESC, review_count DESC
LIMIT 10;
```

## Troubleshooting

### Issue: "Rate Limited" Errors

**Solution**: The script automatically handles rate limiting with delays between requests. If you get rate limited:
- Wait 10 seconds before retrying
- Reduce the limit parameter in `searchCity()` from 20 to 10
- Run fetch during off-peak hours

### Issue: "Database Connection Failed"

**Solution**:
1. Verify `.env` has correct Supabase credentials
2. Check that `nearby_listings` table exists
3. Ensure table has proper RLS policies (allow inserts)

### Issue: "TripAdvisor API Key Invalid"

**Solution**:
1. Verify API key in `.env` is correct
2. Check that key has appropriate permissions
3. Verify key hasn't expired

### Issue: Slugs Not Generated

**Solution**:
```bash
# Run slug population function
curl -X POST https://your-supabase-url/functions/v1/populate-listing-slugs \
  -H "Authorization: Bearer YOUR_KEY"
```

## Performance Tips

1. **Indexing**: All common query patterns are indexed (rating, category, slug, etc.)

2. **Pagination**: Always use LIMIT in queries:
```sql
SELECT * FROM nearby_listings 
WHERE verified = true 
ORDER BY rating DESC 
LIMIT 20 OFFSET 0;
```

3. **Materialized Views**: Refresh periodically for top listings:
```sql
REFRESH MATERIALIZED VIEW top_rated_listings;
REFRESH MATERIALIZED VIEW listings_by_city;
```

4. **Search**: Use the built-in search function:
```sql
SELECT * FROM search_listings('Baguio', 20);
```

## Monitoring

### Check Listing Status
```sql
SELECT 
  source,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE verified = true) as verified,
  AVG(rating) as avg_rating,
  MAX(updated_at) as last_updated
FROM nearby_listings
GROUP BY source;
```

### Find Incomplete Listings
```sql
SELECT tripadvisor_id, name, address
FROM nearby_listings
WHERE photo_urls IS NULL OR photo_urls = '{}'
LIMIT 20;
```

### Check Data Quality
```sql
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE name IS NOT NULL) as named,
  COUNT(*) FILTER (WHERE rating IS NOT NULL) as rated,
  COUNT(*) FILTER (WHERE photo_count > 0) as with_photos,
  COUNT(*) FILTER (WHERE description IS NOT NULL) as with_description
FROM nearby_listings;
```

## Scheduling

### Setup Automatic Updates (Every 24 Hours)

Edit `supabase/config.toml`:
```toml
[[functions]]
slug = "fetch-comprehensive-listings"

[functions.scheduling]
cron = "0 2 * * *"  # Run daily at 2 AM UTC
```

Then deploy:
```bash
supabase functions deploy fetch-comprehensive-listings
```

## Files Reference

- `supabase/migrations/comprehensive_listings_setup.sql` - Database schema
- `src/lib/tripadvisorComprehensiveFetcher.js` - Data fetcher library
- `scripts/fetch-all-philippines-listings.sh` - Main fetch script
- `supabase/functions/fetch-comprehensive-listings/` - Edge function
- `src/components/ListingDetail.jsx` - Updated detail page

## Support

For issues:
1. Check logs: `supabase functions logs fetch-comprehensive-listings`
2. Review database: Check `nearby_listings` table directly
3. Test API key: Verify TripAdvisor API access

## Next Steps

1. ✅ Run the SQL migration
2. ✅ Run the fetch script: `bash scripts/fetch-all-philippines-listings.sh`
3. ✅ Wait for completion
4. ✅ Visit `/nearby` to see the populated listings
5. ✅ Click on a listing to see all new comprehensive data

Enjoy your fully featured listing system! 🎉
