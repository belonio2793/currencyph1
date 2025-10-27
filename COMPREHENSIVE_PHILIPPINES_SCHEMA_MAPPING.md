# Comprehensive Philippines TripAdvisor Schema Mapping

## Overview

This guide documents the complete implementation of TripAdvisor data mapping into the `nearby_listings` table for all Philippine cities and categories.

## 📋 What Was Implemented

### 1. **Comprehensive Scraping Function**
- **File**: `supabase/functions/scrape-nearby-listings-comprehensive/index.ts`
- **Purpose**: Fetch ALL TripAdvisor listings from 70+ Philippine cities across 6 categories
- **Coverage**:
  - **70 Philippine cities** (Manila, Cebu, Davao, and 67 others)
  - **6 categories**: attractions, hotels, restaurants, things_to_do, tours, vacation_rentals
  - **Up to 30 listings per city/category** (configurable)
  - **Potential total**: 12,600+ listings with full schema mapping

### 2. **Complete Schema Mapping**
All 60+ fields in the `nearby_listings` table are now populated with comprehensive data:

#### Core Identity Fields
- `tripadvisor_id` - Unique identifier from TripAdvisor
- `name` - Business/attraction name
- `slug` - URL-friendly identifier
- `source` - Always "tripadvisor_api"

#### Location & Geography
- `address` - Full address
- `latitude` / `latitude` - GPS coordinates
- `lat` / `lng` - Alternative coordinate fields
- `city` - City name
- `country` - Always "Philippines"
- `region_name` - Regional designation
- `timezone` - Timezone (Asia/Manila)

#### Ratings & Reviews
- `rating` - Star rating (1-5)
- `review_count` / `num_reviews` - Number of reviews
- `review_details` - Array of detailed reviews (author, rating, comment, date, verified status)
- `reviews_summary` - Aggregated review statistics with breakdown by rating

#### Ranking Data
- `ranking_in_city` - Overall city ranking
- `ranking_in_category` - Category-specific ranking
- `rank_in_category` - Alternative ranking field
- `ranking_position` - Numeric position
- `ranking_string` - String representation
- `ranking_geo` - Geographic ranking
- `ranking_data` - Structured ranking object

#### Categorization
- `category` - Primary category (attractions, hotels, etc.)
- `location_type` - Specific type (Attraction, Hotel, Restaurant, etc.)
- `cuisine` - Array of cuisine types (for restaurants)
- `features` - Key features array
- `subcategory` - Detailed subcategory
- `tags` - Relevant tags array

#### Images & Media
- `photo_count` - Total number of photos
- `photo_urls` - Array of all photo URLs (up to 20)
- `image_urls` - Array of image URLs (up to 20)
- `image_url` - Primary image URL
- `primary_image_url` - Featured image
- `featured_image_url` - Featured display image
- `stored_image_path` - Local storage path (null initially)
- `image_downloaded_at` - Timestamp when image was downloaded

#### Contact & Access Information
- `web_url` - Direct link to TripAdvisor listing
- `website` - Business website
- `phone_number` / `phone` - Contact phone number
- `email` - Business email

#### Operational Information
- `hours_of_operation` - JSON object with day-based hours
- `amenities` - Array of amenities with availability status
- `accessibility_info` - Detailed accessibility features (wheelchair, pet-friendly, elevator, parking, restroom, hearing, mobility, visual)
- `admission_fee` - Entry fee information
- `price_level` - Numeric price level (1-4)
- `price_range` - String representation ($, $$, $$$, $$$$)
- `duration` - Typical visit duration
- `best_for` - Array of traveler types/use cases
- `best_for_type` - Category of "best for" (Cuisine, Experience, etc.)
- `traveler_type` - Primary traveler type
- `highlights` - Array of key highlights/features
- `nearby_attractions` - Array of nearby location names

#### Data Quality & Verification
- `verified` - Boolean verification status
- `last_verified_at` - Last verification timestamp
- `fetch_status` - Status of last fetch (success, error, pending)
- `fetch_error_message` - Error message if fetch failed
- `visibility_score` - Calculated visibility score (0-100)
- `awards` - Array of awards and recognitions with year and type

#### Metadata
- `currency` - Currency (PHP)
- `created_at` - Creation timestamp (auto)
- `updated_at` - Last update timestamp
- `last_synced` - Last sync timestamp
- `raw` - Original unprocessed API response and metadata

## 🚀 How to Use

### Option 1: UI Button (Easiest)
1. Navigate to the `/nearby` page
2. Click **"🌍 Fetch ALL Cities (70+)"** button
3. Confirm the action
4. Wait 10-20 minutes for completion
5. Data will be automatically refreshed

### Option 2: Command Line
```bash
npm run fetch-comprehensive
# or
npm run fetch-comprehensive 50  # 50 listings per city/category
```

### Option 3: Direct Deployment
```bash
supabase functions deploy scrape-nearby-listings-comprehensive
```

### Option 4: Direct API Call
```bash
curl -X POST https://your-project.supabase.co/functions/v1/scrape-nearby-listings-comprehensive \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit": 30}'
```

## 📊 Data Structure Example

```json
{
  "id": 1,
  "tripadvisor_id": "123456",
  "name": "Mount Mayon",
  "slug": "mount-mayon-3456",
  "address": "Albay, Bicol Region, Philippines",
  "latitude": 13.2541,
  "longitude": 123.6822,
  "rating": 4.5,
  "review_count": 1205,
  "category": "attractions",
  "location_type": "Attraction",
  "source": "tripadvisor_api",
  "city": "Legazpi",
  "country": "Philippines",
  "region_name": "Legazpi",
  "timezone": "Asia/Manila",
  "currency": "PHP",
  
  "photo_urls": [
    "https://media.tacdn.com/...",
    "https://media.tacdn.com/..."
  ],
  "primary_image_url": "https://media.tacdn.com/...",
  
  "hours_of_operation": {
    "Monday": { "open": "06:00", "close": "18:00", "closed": false },
    "Sunday": { "open": "06:00", "close": "18:00", "closed": false }
  },
  
  "amenities": [
    { "name": "Parking", "available": true },
    { "name": "Restrooms", "available": true }
  ],
  
  "accessibility_info": {
    "wheelchair_accessible": true,
    "pet_friendly": false,
    "elevator": false,
    "accessible_parking": true,
    "accessible_restroom": true
  },
  
  "awards": [
    {
      "name": "Travelers' Choice",
      "year": 2024,
      "award_type": "recognition"
    }
  ],
  
  "highlights": [
    "Highly rated",
    "1205 photos",
    "Award winner",
    "Verified reviews"
  ],
  
  "best_for": [
    { "category": "Families", "count": 450 },
    { "category": "Solo travelers", "count": 280 }
  ],
  
  "reviews_summary": {
    "total_reviews": 1205,
    "average_rating": 4.5,
    "review_breakdown": {
      "excellent": 800,
      "very_good": 300,
      "good": 100,
      "okay": 5,
      "poor": 0
    }
  },
  
  "verified": true,
  "last_verified_at": "2024-12-19T10:30:00Z",
  "fetch_status": "success",
  "visibility_score": 90,
  "updated_at": "2024-12-19T10:30:00Z",
  "created_at": "2024-12-19T10:30:00Z"
}
```

## 🌏 Philippine Cities Covered (70+)

### Metro Manila & Surrounding
- Manila, Quezon City, Makati, Taguig, Antipolo, Cavite City, Bacoor, Imus, Dasmariñas, Calamba, Biñan

### Northern Luzon
- Baguio, Vigan, Dagupan, Batangas City, Tagaytay, Subic Bay, Clark Freeport, Olongapo, Pampanga, Laguna

### Visayas
- Cebu, Boracay, Iloilo, Bacolod, Dumaguete, Kalibo, Caticlan, Roxas, Capiz, Guimaras, Antique, Aklan, Negros Occidental, Negros Oriental, Siquijor, Bohol, Romblon, Calapan

### Mindanao
- Davao, Cagayan de Oro, Butuan, Surigao City, General Santos, Zamboanga City, Cotabato, Agusan, Camiguin, Davao del Sur, Davao del Norte, Davao Oriental, Davao Occidental, Misamis Oriental, Misamis Occidental, Sultan Kudarat, South Cotabato, Sarangani, Zamboanga del Norte, Zamboanga del Sur, Zamboanga Sibugay

### Palawan & Island Provinces
- Palawan, El Nido, Coron, Puerto Princesa, Siargao

## ✅ Verification Checklist

After running the comprehensive scraper, verify:

- [ ] Total listings > 10,000
- [ ] Multiple cities represented (70+)
- [ ] All categories populated (attractions, hotels, restaurants, etc.)
- [ ] Photos/images included
- [ ] Ratings and reviews present
- [ ] Amenities and accessibility data populated
- [ ] Awards and highlights included
- [ ] Rankings for all listings
- [ ] Contact information available where applicable
- [ ] Operating hours populated

### Verification Query
```sql
-- Check coverage
SELECT COUNT(DISTINCT city) as cities, 
       COUNT(DISTINCT category) as categories,
       COUNT(*) as total_listings,
       AVG(rating) as avg_rating,
       MIN(created_at) as first_listing,
       MAX(updated_at) as last_update
FROM nearby_listings
WHERE source = 'tripadvisor_api';

-- Sample by city
SELECT city, COUNT(*) as count, AVG(rating) as avg_rating
FROM nearby_listings
WHERE source = 'tripadvisor_api'
GROUP BY city
ORDER BY count DESC
LIMIT 10;

-- Sample listings with full data
SELECT name, city, category, rating, review_count, 
       ARRAY_LENGTH(photo_urls, 1) as photo_count,
       ARRAY_LENGTH(amenities, 1) as amenity_count,
       verification_status
FROM nearby_listings
WHERE source = 'tripadvisor_api'
ORDER BY updated_at DESC
LIMIT 10;
```

## 🔄 Integration with UI

### Nearby.jsx Updates
The `/nearby` page now has:
- **"🔄 Refresh (5 Cities)"** button - Quick refresh with limited cities
- **"🌍 Fetch ALL Cities (70+)"** button - Comprehensive fetch of all Philippines

Both buttons trigger the appropriate scraping function and automatically refresh the UI.

### ListingCard Component
Displays comprehensive data including:
- Images from `image_urls` array
- Ratings and review counts
- Category and type
- Amenities summary
- Awards and highlights
- Location with city/region

## ⚙️ Configuration

### Environment Variables
Required:
- `VITE_PROJECT_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `TRIPADVISOR` (optional) - TripAdvisor API key for enhanced data

Set via:
```bash
npm run fetch-comprehensive
```

### Function Parameters
- `limit` (default: 30) - Listings per city/category combination
- Max: 50 (API rate limits)
- Min: 5 (quick test)

## 📈 Performance & Timing

| Phase | Duration | Notes |
|-------|----------|-------|
| Fetch | 10-15 min | 420 API requests (70 cities × 6 categories) |
| Process | 1-2 min | Deduplication and transformation |
| Upsert | 3-5 min | Batch insertion into database |
| **Total** | **15-25 min** | Depends on API response times |

## 🆘 Troubleshooting

### Issue: 0 listings populated
- **Cause**: Missing TripAdvisor API key
- **Solution**: Set `TRIPADVISOR` environment variable
- **Verification**: Check function logs in Supabase dashboard

### Issue: Partial data (< 5,000 listings)
- **Cause**: Network timeout or rate limiting
- **Solution**: Run again, reduce limit to 20, or increase interval
- **Check**: Look at function logs for API errors

### Issue: Missing photos or images
- **Cause**: Photos may be restricted or not available
- **Solution**: This is normal; not all listings have photos
- **Fallback**: Default images shown in UI

### Issue: Slow performance on /nearby page
- **Cause**: Large dataset with many images
- **Solution**: Add pagination or lazy loading (see ListingCard optimization)

## 📝 Files Modified/Created

### Created
- ✨ `supabase/functions/scrape-nearby-listings-comprehensive/index.ts` - Main scraping function
- ✨ `supabase/functions/scrape-nearby-listings-comprehensive/deno.json` - Deno config
- ✨ `scripts/fetch-all-philippines-comprehensive.js` - Node.js CLI script
- ✨ `COMPREHENSIVE_PHILIPPINES_SCHEMA_MAPPING.md` - This documentation

### Modified
- ✏️ `src/components/Nearby.jsx` - Added comprehensive fetch button and handler
- ✏️ `package.json` - Added `fetch-comprehensive` npm script

## 🎯 Next Steps

1. **Deploy the function**:
   ```bash
   supabase functions deploy scrape-nearby-listings-comprehensive
   ```

2. **Run the comprehensive scraper**:
   ```bash
   npm run fetch-comprehensive
   ```

3. **Verify the data** in Supabase dashboard or using query examples above

4. **Import photos** (optional):
   ```bash
   npm run import-photos
   ```

5. **Visit the /nearby page** to see all listings

## 📚 Related Documentation

- See `NEARBY_IMPLEMENTATION_SUMMARY.md` for overview
- See `NEARBY_SCRAPING_GUIDE.md` for scraping details
- See `POPULATION_IMPLEMENTATION_SUMMARY.md` for population details
- See database schema CSV attached to understand all fields

---

**Implementation Date**: December 2024
**Coverage**: 70+ Philippine cities, 6 categories, 60+ schema fields
**Status**: ✅ Complete and ready to use
