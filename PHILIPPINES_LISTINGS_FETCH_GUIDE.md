# 🇵🇭 Philippines Listings Fetcher Guide

## Overview

This guide explains how to fetch comprehensive TripAdvisor listings for all Philippine cities and populate your /nearby database.

## What's Included

- **Philippines Fetcher Utility** (`src/lib/tripadvisorPhilippinesFetcher.js`)
  - Smart fetching from TripAdvisor API
  - Rate limiting and error handling
  - Deduplication of listings
  - City-based organization

- **CLI Script** (`scripts/fetch-philippines-listings.js`)
  - Automated fetching from command line
  - Progress reporting
  - Batch database operations
  - Both API and web scraping fallback

- **Admin UI** (Updated AdminPopulate component)
  - New "Fetch Philippines" tab
  - Real-time progress tracking
  - Before/after statistics
  - Success/error reporting

## Methods to Fetch

### Method 1: Using Admin Panel (Recommended for UI)

1. Navigate to `/admin` (click "Admin" button on home page)
2. Click the "Fetch Philippines" tab
3. Click "Fetch Philippines Listings" button
4. Watch the progress bar as cities are processed
5. View results showing how many listings were added

**Advantages:**
- Real-time UI feedback
- No terminal required
- Error handling with user-friendly messages
- Automatic before/after statistics

### Method 2: Using CLI Script (Recommended for bulk operations)

```bash
npm run fetch-philippines
```

**Output:**
- Progress percentage and city name
- Number of listings found per city
- Final statistics and database updates
- Total new listings added

**Example output:**
```
[INFO] 🇵🇭 Starting TripAdvisor Philippines listing fetcher...
[INFO] Current listings in database: 1,234

[20%] Processing Manila...
[SUCCESS] Found 45 listings in Manila
[25%] Processing Cebu...
[SUCCESS] Found 32 listings in Cebu
...

[STATS] Total unique listings collected: 2,156
[SUCCESS] Successfully upserted 922 listings!
[INFO] Database now contains: 2,156 listings
[INFO] Added: 922 new listings
```

## What Gets Fetched

The fetcher processes **50+ Philippine cities** including:

- **Metro Manila**: Manila, Quezon City, Makati, Pasig, Taguig, etc.
- **Nearby NCR**: Antipolo, Cainta, Tanay, Montalban, etc.
- **Luzon**: Baguio, Tagaytay, Cabanatuan, Lucena, Legazpi, etc.
- **Visayas**: Cebu, Iloilo, Bacolod, Boracay, Dumaguete, Siquijor, etc.
- **Mindanao**: Davao, Cagayan de Oro, Zamboanga, Iligan, etc.
- **Palawan**: Puerto Princesa, El Nido, Coron, etc.
- **Tourist Destinations**: Siargao, General Luna, Port Barton, San Juan La Union, etc.

## Data Collected Per Listing

- ✅ TripAdvisor ID
- ✅ Name
- ✅ Address
- ✅ Latitude/Longitude
- ✅ Rating (1-5 stars)
- ✅ Review count
- ✅ Category (Museum, Beach, Hotel, Restaurant, etc.)
- ✅ Featured image URL
- ✅ Raw TripAdvisor data

## How It Works

### Smart Fetching Process

1. **API First**: Tries TripAdvisor API for detailed data
2. **Web Scraping Fallback**: If API fails, scrapes TripAdvisor.com.ph website
3. **Deduplication**: Combines results, removes duplicates by ID
4. **Batch Save**: Efficiently saves to database in chunks of 50
5. **Rate Limiting**: Respects API limits with 300-400ms delays

### Data Quality

- **Ratings**: Direct from TripAdvisor (accurate)
- **Review Counts**: Current counts from TripAdvisor
- **Categories**: Automatically classified (attraction, museum, beach, etc.)
- **Coordinates**: Precise GPS coordinates for mapping
- **Images**: Featured images from TripAdvisor listings

## Using the Fetcher Programmatically

```javascript
import { tripadvisorPhilippinesFetcher } from '@/lib/tripadvisorPhilippinesFetcher'

// Get all Philippine cities
const cities = tripadvisorPhilippinesFetcher.getPhilippineCities()

// Fetch listings for a single city
const listings = await tripadvisorPhilippinesFetcher.fetchListingsForCity('Manila')

// Fetch and save listings for multiple cities with progress tracking
const result = await tripadvisorPhilippinesFetcher.fetchAndSaveListings(
  cities,
  (progress) => {
    console.log(`${progress.city}: ${progress.found} listings`)
  }
)

// Get cities with missing data
const missing = await tripadvisorPhilippinesFetcher.getMissingListings(100)

// Get listing counts by city
const counts = await tripadvisorPhilippinesFetcher.getListingCountByCity()
```

## Environment Variables

Ensure these are set in your `.env` file:

```env
VITE_PROJECT_URL=https://your-supabase-url.supabase.co
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_TRIPADVISOR=your-tripadvisor-api-key
```

## Troubleshooting

### Issue: "TripAdvisor API key not available"
**Solution:** Set the `VITE_TRIPADVISOR` environment variable with your TripAdvisor API key

### Issue: "Rate limited" errors
**Solution:** The script automatically retries with exponential backoff. Wait a few minutes and retry.

### Issue: "Some cities had errors"
**Solution:** This is normal for some cities. The script continues with other cities and reports the count of failed cities.

### Issue: "No listings found for city X"
**Solution:** Some smaller cities may not have data on TripAdvisor. The script handles this gracefully.

## Database Schema

The fetcher stores data in the `nearby_listings` table:

```sql
CREATE TABLE nearby_listings (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tripadvisor_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  rating DECIMAL(3, 1),
  review_count INTEGER DEFAULT 0,
  category TEXT,
  image TEXT,
  raw JSONB,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
)
```

## Performance Notes

- **Single city**: ~3-5 seconds (API fetch + database insert)
- **All 50+ cities**: ~5-10 minutes depending on API response times
- **Database operations**: Batched for efficiency (50 records per batch)
- **API rate limits**: ~5 requests per second (respected by script)

## Next Steps

After fetching listings:

1. **Verify in /nearby**: Navigate to /nearby and search for a city
2. **Check Admin Stats**: View the statistics dashboard
3. **Test Search**: Try searching for "Manila", "Beach", "Museum"
4. **Browse Categories**: Click category buttons to filter
5. **Vote and Save**: Users can vote on and save their favorites

## Tips for Best Results

1. **Run during off-peak hours** to minimize API throttling
2. **Check environment variables** before running
3. **Monitor progress** in real-time via Admin panel
4. **Run periodically** (monthly/quarterly) to keep data fresh
5. **Use the CLI script** for batch operations, Admin UI for one-offs

## Automatic Sync

The app includes background sync that periodically updates:
- Last updated timestamps
- Listing freshness

Currently syncs every 24 hours. Configure in App.jsx:
```javascript
backgroundSync.start(24) // Sync every 24 hours
```

## Support

For issues:
1. Check TripAdvisor API key is valid
2. Verify Supabase connection
3. Check browser console for errors
4. Review logs in Admin panel
5. Check this guide's troubleshooting section

---

**Happy fetching! 🌍 Your Philippines /nearby section is now comprehensive and up-to-date.**
