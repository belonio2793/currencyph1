# Nearby Listings Web Scraping & Cron Job Guide

## Overview

This guide explains how the `scrape-nearby-listings` edge function works and how to manage the automated population of the `/nearby` listings page.

## Architecture

### Edge Function: `scrape-nearby-listings`

Located at: `supabase/functions/scrape-nearby-listings/index.ts`

**Purpose**: Automatically scrape, format, and upsert travel/attraction listings into the `nearby_listings` table on a scheduled cron job.

**Schedule**: Every 6 hours at minute 30 (configured in `supabase/config.toml`)
- `30 */6 * * *` = 12:30 AM, 6:30 AM, 12:30 PM, 6:30 PM (UTC)

## Database Schema

The `nearby_listings` table stores location data with the following key fields:

### Core Fields
- `id` - Primary key
- `tripadvisor_id` - Unique identifier from data source
- `name` - Location name
- `address` - Full address
- `latitude` / `longitude` - Geographic coordinates
- `rating` - Numeric rating (1-5)
- `category` - Location type (attractions, museums, parks, beaches, hotels, restaurants, churches, shopping, nightlife, things to do, historical sites)

### Metadata
- `source` - Data source (tripadvisor, web_scraper, sample)
- `raw` - Original unprocessed data
- `slug` - URL-friendly identifier
- `verified` - Boolean indicating verification status
- `fetch_status` - Status of last fetch attempt (pending, success, failed)
- `fetch_error_message` - Error message if fetch failed

### Extended Data
- `review_count` - Number of reviews
- `image_urls` - Array of image URLs
- `primary_image_url` - Featured image
- `web_url` - Link to original source
- `location_type` - Specific type classification
- `phone_number` - Contact number
- `website` - Business website
- `description` - Location description
- `hours_of_operation` - Operating hours object
- `price_level` - Price tier indicator
- `highlights` - Array of feature highlights
- `amenities` - Array of available amenities
- `accessibility_info` - Accessibility features object

## Function Behavior

### What It Does

1. **City Coverage**: Processes 64 Philippine cities by default
   - Manila, Cebu, Davao, Quezon City, Makati, Baguio, Boracay, etc.

2. **Category Coverage**: Scrapes 11 categories
   - attractions, museums, parks, beaches, hotels
   - restaurants, churches, shopping, nightlife, things to do, historical sites

3. **Data Generation**:
   - Generates synthetic/realistic listing data for demonstration
   - Assigns approximate coordinates based on city location
   - Creates unique IDs and slugs for each listing
   - Adds metadata: ratings, review counts, amenities, etc.

4. **Data Upsert**:
   - Deduplicates by `tripadvisor_id`
   - Performs batch upserts in chunks of 50
   - Avoids duplicate entries
   - Rate-limited to prevent API/database overload

### Parameters (POST Request)

You can customize the function behavior by sending a POST request with parameters:

```json
{
  "cityLimit": 5,           // Process only first N cities
  "categoryLimit": 3,       // Process only first N categories
  "listingsPerCity": 10     // Listings per city-category combo
}
```

**Example**: With `cityLimit: 2, categoryLimit: 3, listingsPerCity: 5`
- Process: 2 cities × 3 categories × 5 listings = 30 listings

## Usage

### Trigger Manually

```bash
# Via curl
curl -X POST https://your-project.supabase.co/functions/v1/scrape-nearby-listings \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "cityLimit": 5,
    "categoryLimit": 5,
    "listingsPerCity": 8
  }'

# Or use GET for defaults
curl https://your-project.supabase.co/functions/v1/scrape-nearby-listings
```

### Automatic Cron Schedule

The function runs automatically every 6 hours via Supabase cron:
- Configured in `supabase/config.toml`
- Runs with default parameters (all cities, all categories, 5 listings per city-category)

### Add to npm Scripts

Edit `package.json` to add:

```json
{
  "scripts": {
    "scrape-nearby": "curl -X POST https://your-project.supabase.co/functions/v1/scrape-nearby-listings -H 'Authorization: Bearer YOUR_ANON_KEY' -H 'Content-Type: application/json'",
    "scrape-nearby-test": "curl -X POST https://your-project.supabase.co/functions/v1/scrape-nearby-listings -H 'Authorization: Bearer YOUR_ANON_KEY' -H 'Content-Type: application/json' -d '{\"cityLimit\": 3, \"listingsPerCity\": 5}'"
  }
}
```

## Response Format

### Success Response (200)

```json
{
  "success": true,
  "totalScraped": 1650,
  "uniqueListings": 1650,
  "upserted": 1650,
  "successCount": 1540,
  "errorCount": 12,
  "message": "Scraped and upserted 1650 listings from 1540 successful queries",
  "timestamp": "2025-10-28T10:30:00.000Z"
}
```

### Error Response (500)

```json
{
  "error": "Missing Supabase environment variables",
  "details": "Error details string"
}
```

## Integration with Existing Functions

### Relationship with `sync-tripadvisor-hourly`

| Function | Schedule | Source | Purpose |
|----------|----------|--------|---------|
| `sync-tripadvisor-hourly` | Every hour (0 * * * *) | TripAdvisor API | Real data from official API |
| `scrape-nearby-listings` | Every 6 hours (30 */6 * * *) | Web scraping | Additional synthetic/supplementary data |

**Strategy**: 
- Use TripAdvisor sync for authoritative data
- Use web scraper for variety, testing, and supplementary data
- Both use `onConflict: "tripadvisor_id"` to avoid duplicates
- Combine results on frontend for comprehensive listings

## Advanced: Implement Real Web Scraping

To add real web scraping (instead of synthetic data generation), modify the `scrapeWebListings()` function:

### Option 1: Use Cheerio for HTML Parsing

```typescript
import { load } from "https://esm.sh/cheerio@1";

async function scrapeWebListings(
  city: string,
  category: string,
  limit: number = 10
): Promise<NearbyListing[]> {
  const url = `https://example.com/listings/${city}/${category}`;
  
  const response = await fetch(url);
  const html = await response.text();
  const $ = load(html);
  
  const listings: NearbyListing[] = [];
  
  $(".listing-card").slice(0, limit).each((i, elem) => {
    const listing: NearbyListing = {
      tripadvisor_id: $(elem).attr("data-id"),
      name: $(elem).find(".title").text(),
      address: $(elem).find(".address").text(),
      rating: parseFloat($(elem).find(".rating").attr("data-rating") || "0"),
      latitude: parseFloat($(elem).attr("data-lat") || "0"),
      longitude: parseFloat($(elem).attr("data-lng") || "0"),
      category: category,
      source: "web_scraper",
      slug: generateSlug($(elem).find(".title").text(), $(elem).attr("data-id")),
      updated_at: new Date().toISOString(),
    };
    
    listings.push(listing);
  });
  
  return listings;
}
```

### Option 2: Use Multiple Public APIs

```typescript
async function scrapeWebListings(
  city: string,
  category: string,
  limit: number = 10
): Promise<NearbyListing[]> {
  const apis = [
    `https://api.openstreetmap.org/...`,
    `https://api.google.com/places/...`,
    `https://api.foursquare.com/...`
  ];
  
  const results: NearbyListing[] = [];
  
  for (const api of apis) {
    try {
      const response = await fetch(api);
      const data = await response.json();
      // Parse and transform data...
      results.push(...transformedData);
    } catch (err) {
      console.error(`API error: ${err}`);
    }
  }
  
  return results.slice(0, limit);
}
```

### Option 3: Integrate with Google Places API

```typescript
async function scrapeWithGooglePlaces(
  city: string,
  category: string,
  googleApiKey: string
): Promise<NearbyListing[]> {
  const query = `${category} in ${city} Philippines`;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json`;
  
  const params = new URLSearchParams({
    query: query,
    key: googleApiKey,
    language: "en"
  });
  
  const response = await fetch(`${url}?${params}`);
  const data = await response.json();
  
  return data.results.map((place: any) => ({
    tripadvisor_id: place.place_id,
    name: place.name,
    address: place.formatted_address,
    latitude: place.geometry.location.lat,
    longitude: place.geometry.location.lng,
    rating: place.rating,
    review_count: place.user_ratings_total,
    source: "google_places",
    image_url: place.photos?.[0]?.photo_reference,
    category: category,
    slug: generateSlug(place.name, place.place_id),
    updated_at: new Date().toISOString()
  }));
}
```

## Monitoring & Troubleshooting

### Check Execution Logs

In Supabase Dashboard:
1. Go to **Edge Functions**
2. Click **scrape-nearby-listings**
3. View **Logs** tab for execution history

### Common Issues

**No listings upserted**
- Check environment variables in Supabase project settings
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- Check database permissions for service role

**Cron not running**
- Verify `supabase/config.toml` has correct cron syntax
- Ensure `enable_http_edge_function_runner = true` in config.toml
- Redeploy edge functions after config changes

**Duplicate entries**
- The function uses `onConflict: "tripadvisor_id"` to prevent duplicates
- Check that `tripadvisor_id` is unique in your data

**Rate limiting**
- The function includes 200ms delays between requests
- Adjust `sleep(200)` to increase/decrease rate
- Use `cityLimit` and `categoryLimit` to test with smaller datasets first

## Performance Considerations

### Current Performance

- **Cities**: 64 × **Categories**: 11 × **Listings/combo**: 5
- **Total**: ~3,520 listings per run
- **Time**: ~15-20 minutes (due to rate limiting)
- **Frequency**: Every 6 hours

### Optimization Strategies

1. **Reduce Frequency**
   ```toml
   cron = "30 0 * * 0"  # Once per week (Sunday 12:30 AM)
   cron = "30 */12 * * *"  # Every 12 hours
   ```

2. **Limit Scope**
   - Process only popular cities: `cityLimit: 10`
   - Process only popular categories: `categoryLimit: 6`
   - Reduce listings per combo: `listingsPerCity: 2`

3. **Parallel Processing**
   - Use `Promise.all()` for concurrent city processing
   - Implement batch fetching instead of sequential

4. **Caching**
   - Store last update timestamp
   - Skip re-processing recent listings
   - Only scrape stale data

## Next Steps

1. **Deploy Function**: `supabase functions deploy scrape-nearby-listings`
2. **Test Manually**: Make a POST request with test parameters
3. **Monitor Logs**: Watch first execution in Supabase dashboard
4. **Iterate**: Adjust parameters based on results
5. **Real Scraping**: Implement actual web scraping or API integration
6. **Scale**: Add more data sources and categories as needed

## Related Files

- Edge function: `supabase/functions/scrape-nearby-listings/index.ts`
- Function config: `supabase/functions/scrape-nearby-listings/deno.json`
- Cron schedule: `supabase/config.toml`
- Frontend page: `src/components/Nearby.jsx`
- Existing TripAdvisor sync: `supabase/functions/sync-tripadvisor-hourly/index.ts`
