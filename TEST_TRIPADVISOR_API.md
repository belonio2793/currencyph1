# Test TripAdvisor API - Single Listing Response

Test the TripAdvisor API to see what columns and data we can retrieve.

## Quick Test Methods

### Method 1: Python Script (Recommended)
Runs the detailed test and shows column mapping:

```bash
python test-tripadvisor-single-listing.py
```

This will:
- ✅ Test API connectivity
- ✅ Show full JSON response structure
- ✅ Extract all available columns
- ✅ Map API fields to nearby_listings table columns
- ✅ Show data completeness percentage
- ✅ Confirm readiness for full sync

**Expected Output:**
```
Status Code: 200 ✅
Items returned: 1
Columns that can be populated: 25+/30+
Data completeness: 85%+
✅ API Response contains enough data to populate ALL 47+ columns
```

### Method 2: curl Command (Direct Test)

```bash
curl -X GET \
  'https://api.tripadvisor.com/api/partner/2.0/locations/search?query=attractions%20in%20Manila%20Philippines&limit=1' \
  -H 'X-TripAdvisor-API-Key: 48FA28618E1349CCA99296F27323E7B9' \
  -H 'Accept: application/json' | jq '.'
```

Or without jq:
```bash
curl -X GET \
  'https://api.tripadvisor.com/api/partner/2.0/locations/search?query=attractions%20in%20Manila%20Philippines&limit=1' \
  -H 'X-TripAdvisor-API-Key: 48FA28618E1349CCA99296F27323E7B9' \
  -H 'Accept: application/json'
```

## What the Test Shows

The test script will display:

1. **Full API Response** - Complete JSON returned by TripAdvisor
2. **Available Keys** - All fields in the response
3. **Detailed Breakdown** - Organized by category:
   - Basic Info (name, type, location_id)
   - Address (street, city, country)
   - Coordinates (latitude, longitude)
   - Ratings & Reviews (rating, review_count)
   - Photos (photo_count, image URLs)
   - URLs (web_url, website)
   - Contact (phone)
   - Categories & Tags
   - Pricing (price_level, price_range)
   - Amenities & Features
   - Operating Hours
   - Rankings
   - Accessibility
   - Nearby Attractions
   - Verification Status
   - Reviews

4. **Column Mapping** - Shows which API fields map to which `nearby_listings` columns
5. **Completeness Score** - Percentage of columns that can be populated
6. **Status Summary** - Confirmation of API working status

## Expected Results

### Successful Response (Status 200)
```
✅ Status Code: 200
✅ API Response contains enough data to populate ALL 47+ columns
✅ Data completeness: 85%+ 
✅ Ready for full sync with 180+ cities
```

### Data Structure Example

```json
{
  "data": [
    {
      "location_id": "298573",
      "name": "National Museum of Fine Arts",
      "address_obj": {
        "street1": "P. Burgos Drive",
        "city": "Manila",
        "country": "Philippines"
      },
      "latitude": 14.5740,
      "longitude": 120.9754,
      "rating": 4.5,
      "review_count": 1023,
      "photo_count": 156,
      "web_url": "https://www.tripadvisor.com/Attraction_Review-g298573-d123456",
      "type": "Attraction",
      "category": "attractions",
      "description": "...",
      "phone": "+63 2 5254-5000",
      "website": "https://www.nationalmuseum.ph",
      "hours_of_operation": {...},
      "amenities": [...],
      "awards": [...],
      "accessibility_info": {...},
      ...
    }
  ]
}
```

## Columns That Will Be Populated

### From API (Always Available)
- ✅ `tripadvisor_id` - From `location_id`
- ✅ `name`
- ✅ `address` - Built from address_obj
- ✅ `city` - From address_obj
- ✅ `country` - From address_obj
- ✅ `latitude`
- ✅ `longitude`
- ✅ `rating`
- ✅ `review_count`
- ✅ `category`
- ✅ `location_type` - From `type`
- ✅ `source` - Set to "tripadvisor"
- ✅ `web_url`
- ✅ `updated_at` - Set to current time
- ✅ `slug` - Generated from name + ID

### From API (Usually Available)
- ⚠️ `image_url` - From photo.images.large.url
- ⚠️ `photo_urls` - Array of photo URLs
- ⚠️ `phone_number` - From phone field
- ⚠️ `website` - Direct or from web_url
- ⚠️ `description` - From description field
- ⚠️ `photo_count`
- ⚠️ `hours_of_operation`
- ⚠️ `amenities`
- ⚠️ `awards`
- ⚠️ `highlights`

### Generated/Calculated
- 🔧 `visibility_score` - Calculated from rating + reviews + images
- 🔧 `verified` - From verified field or defaulted
- 🔧 `fetch_status` - Set to "success"
- 🔧 `last_verified_at` - Set to current time

## Troubleshooting

### "Status Code: 401"
- API key is invalid
- Check: `48FA28618E1349CCA99296F27323E7B9` is correct
- Test with curl first to isolate the issue

### "Status Code: 403"
- API key is valid but quota exceeded
- Wait and retry, or check TripAdvisor API plan limits

### "Status Code: 429"
- Rate limiting triggered
- Wait before running full sync
- Use the rate limiting built into the sync scripts

### "No items returned"
- Query might be too specific
- Check network connectivity
- Verify TripAdvisor has data for that location

## Next Steps After Testing

### If Test Returns Status 200 ✅
```bash
# Test with one city (10 items)
python scripts/sync-tripadvisor.py --city=Manila --limit=10

# Then sync all cities (takes ~10 minutes)
python scripts/sync-tripadvisor.py

# Or use hybrid with optional Grok enrichment
python scripts/hybrid_tripadvisor_grok_sync.py
```

### If Test Fails ❌
1. Verify API key in environment variables
2. Check network connectivity
3. Confirm TripAdvisor API is accessible
4. Review error message in test output
5. Adjust API key or endpoint if needed

## Commands to Run Now

```bash
# 1. Test the API with single listing
python test-tripadvisor-single-listing.py

# 2. If successful, test with one city (10 items)
python scripts/sync-tripadvisor.py --city=Manila --limit=10

# 3. If that works, do full sync
python scripts/sync-tripadvisor.py
```

## Verification Checklist

After running the test, confirm:

- [ ] Status code is 200
- [ ] API returns listing data (not empty)
- [ ] Contains name, address, rating, reviews
- [ ] Contains photo/image URL(s)
- [ ] Contains hours, amenities, or other details
- [ ] Data completeness is 80%+
- [ ] Output shows "Ready for full sync"

If all boxes are checked ✅, you're ready to sync all 180+ cities!
