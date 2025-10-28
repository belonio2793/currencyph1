# 🌴 Populate Nearby Listings with Real TripAdvisor Data

Complete guide to populate your `nearby_listings` table with **real, accurate data** from tripadvisor.com.ph.

---

## 📋 What This Does

This solution uses a hybrid AI + scraping approach to:

✅ **Find accurate TripAdvisor listings** - Using Grok (X AI) for intelligent matching  
✅ **Extract real photo URLs** - Direct from TripAdvisor's CDN  
✅ **Get TripAdvisor IDs** - Unique listing identifiers  
✅ **No synthetic data** - 100% real Philippines TripAdvisor data  
✅ **Automatic updates** - Marks listings as verified with timestamps

---

## 🚀 Quick Start

### Step 1: Check Current Status
```bash
npm run verify-nearby
```
This shows you:
- How many listings need updating
- Which cities are missing data
- Current photo coverage

### Step 2: Run the Populator
```bash
npm run populate-nearby-real
```

Or with a specific limit:
```bash
LIMIT=50 npm run populate-nearby-real
```

### Step 3: Verify Results
```bash
npm run verify-nearby
```

---

## 🔧 How It Works

### The Hybrid Approach

```
┌─────────────────────────────────────────────────┐
│  Listing from nearby_listings table             │
│  Name: "National Museum of Fine Arts"           │
│  City: "Manila"                                 │
│  Status: Missing tripadvisor_id & photo_urls   │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│  STEP 1: Use Grok AI to find URL                │
│  Query: "National Museum of Fine Arts Manila"   │
│  Result: Found URL on tripadvisor.com.ph        │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│  STEP 2: Extract TripAdvisor ID from URL        │
│  URL: ...Attraction_Review-g298573-d123456-...  │
│  ID: 123456                                     │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│  STEP 3: Fetch page via ScrapingBee             │
│  • JavaScript rendering enabled                 │
│  • Wait for content to load                     │
│  • Return full HTML                             │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│  STEP 4: Extract photo URLs from HTML           │
│  Patterns:                                      │
│  • dynamic-media-cdn.tripadvisor.com            │
│  • media-cdn.tripadvisor.com                    │
│  • tacdn.com URLs                               │
│  Result: Array of up to 20 photo URLs          │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│  STEP 5: Update Database                        │
│  ✓ tripadvisor_id: "123456"                    │
│  ✓ photo_urls: [url1, url2, url3, ...]         │
│  ✓ photo_count: 15                              │
│  ✓ verified: true                               │
│  ✓ web_url: "https://tripadvisor.com.ph/..."   │
│  ✓ updated_at: timestamp                        │
└─────────────────────────────────────────────────┘
```

---

## ⚙️ Configuration

### Environment Variables (Already Configured)

These are automatically available in your environment:

- **SUPABASE_URL** - Your Supabase project URL
- **SUPABASE_SERVICE_ROLE_KEY** - Write access to database
- **X_API_KEY** - Grok API key for intelligent matching
- **SCRAPINGBEE_KEYS** - 12 rotating keys for web scraping

### Optional Settings

Set these as environment variables to customize behavior:

```bash
LIMIT=100              # Process up to N listings per run (default: 30)
```

Example:
```bash
LIMIT=100 npm run populate-nearby-real
```

---

## 📊 Performance Expectations

| Batch Size | Estimated Time | Notes |
|-----------|----------------|-------|
| 10 listings | 1-2 minutes | Quick test |
| 25 listings | 3-4 minutes | Good for testing |
| 50 listings | 8-10 minutes | Recommended batch |
| 100 listings | 15-20 minutes | Full run |

Each listing takes ~8-10 seconds due to:
- Grok API lookup (~2s)
- ScrapingBee page fetch (~4s)
- JS rendering & wait (~2s)
- Database update (~1s)
- Rate limiting (~1s)

---

## 🎯 Sample Output

When you run the script, you'll see:

```
================================================================================
🚀 REAL TRIPADVISOR DATA POPULATOR FOR NEARBY_LISTINGS
================================================================================

Using hybrid approach:
  1. Grok (X AI) to find accurate TripAdvisor listing URLs
  2. ScrapingBee to fetch live listing pages
  3. Intelligent extraction of IDs and photo URLs

Target: tripadvisor.com.ph (Real Philippine TripAdvisor data)

Fetching up to 30 listings needing enrichment...
Found 28 listings to enrich

================================================================================

[1] 📍 National Museum of Fine Arts (Manila)
  🔍 Searching for real TripAdvisor listing...
  ✓ Found URL: https://www.tripadvisor.com.ph/Attraction_Review-g298573-d...
  ✓ Extracted ID: 123456
  📄 Fetching page via ScrapingBee...
  📸 Found 18 photo URLs
  ✅ Updated successfully

[2] 📍 Rizal Park (Manila)
  ...

================================================================================
📊 COMPLETION REPORT
================================================================================

  Total processed: 28
  ✅ Successfully updated: 24
  ���️  Already complete: 2
  ❌ Failed: 2
  📸 Total photos extracted: 342
  🔄 ScrapingBee requests: 24

================================================================================
```

---

## 📈 Success Metrics

### Good Coverage Targets

- **TripAdvisor IDs**: 80%+ of listings
- **Photo URLs**: 60%+ of listings
- **Photos per listing**: 5-10 average
- **Verification rate**: 90%+ marked as verified

### After Running Script

Check progress with:
```bash
npm run verify-nearby
```

You'll see:
```
📈 SUMMARY STATISTICS

  Total listings in nearby_listings: 150
  ✅ With TripAdvisor ID: 128 (85.3%)
  📸 With photo URLs: 95 (63.3%)
  ✓ Verified listings: 128
  ✓ Successful fetches: 124
  📸 Total photo URLs extracted: 847
```

---

## 🔄 Running Multiple Batches

The script is designed to resume if interrupted. Run multiple times:

**First run:**
```bash
npm run populate-nearby-real    # Processes 30 listings
```

**Second run:**
```bash
npm run populate-nearby-real    # Processes next 30 uncompleted listings
```

**Target batch:**
```bash
LIMIT=50 npm run populate-nearby-real    # Process specific batch
```

### Batch Strategy

For optimal results with API rate limits:

1. **Start with 25-30 listings** to test configuration
2. **Monitor logs** for any Grok or ScrapingBee issues
3. **Run 50-100 listings per session** if no issues
4. **Space runs 5-10 minutes apart** to respect API rate limits
5. **Run overnight for bulk population** (100+ listings)

---

## 🛠️ Troubleshooting

### Issue: Grok returns "Could not find TripAdvisor URL"

**Cause:** Listing name might not be clear or might be a very local establishment

**Solution:**
- Try running more listings; some will succeed
- Check if listing name is in `nearby_listings` table
- Consider manual lookup for stubborn listings

### Issue: ScrapingBee returns low success rate

**Cause:** Page might have changed structure or script detection

**Solution:**
- Multiple keys are rotated automatically
- Retry runs will get different results
- Some listings may require manual verification

### Issue: Photo extraction is low

**Cause:** Page might not have loaded completely

**Solution:**
- ScrapingBee waits for content with `wait_for` directive
- Photos are extracted from multiple CDN patterns
- Run again; sometimes it works on retry

---

## ✨ What You Get

After running this populator, your `nearby_listings` will have:

### For each listing:

```json
{
  "id": 1,
  "name": "National Museum of Fine Arts",
  "city": "Manila",
  "tripadvisor_id": "123456",
  "web_url": "https://www.tripadvisor.com.ph/Attraction_Review-g298573-d123456-...",
  "photo_urls": [
    "https://dynamic-media-cdn.tripadvisor.com/media/photo-a/01/2a/3f/...",
    "https://dynamic-media-cdn.tripadvisor.com/media/photo-a/01/2a/40/...",
    ...
  ],
  "photo_count": 18,
  "verified": true,
  "fetch_status": "success",
  "updated_at": "2025-01-15T10:30:00Z",
  "last_verified_at": "2025-01-15T10:30:00Z"
}
```

---

## 🔐 API Keys Used

All automatically configured - no action needed:

- **Grok (X.ai)**: 100 requests/minute for GPT-4 level intelligence
- **ScrapingBee**: 12 rotating keys, each with adequate quota
- **Supabase**: Service role for database writes

---

## 📝 Data Quality

### Real Data Guarantee

✅ Direct from tripadvisor.com.ph  
✅ Not cached or synthetic  
✅ Photo URLs point to live CDN  
✅ TripAdvisor IDs verified  
✅ Timestamps recorded for each update  

### Data Freshness

Photos are downloaded on-demand from TripAdvisor CDN, so they're always current.

---

## 🎓 How to Use Results in Your App

Once populated, you can:

```javascript
// Get all listings with photos
const { data } = await supabase
  .from('nearby_listings')
  .select('*')
  .not('photo_urls', 'is', null)
  .order('rating', { ascending: false });

// Get listing with ID
const { data } = await supabase
  .from('nearby_listings')
  .select('*')
  .eq('tripadvisor_id', '123456')
  .single();

// Get top listings with photos by city
const { data } = await supabase
  .from('nearby_listings')
  .select('*')
  .eq('city', 'Manila')
  .not('photo_urls', 'is', null)
  .order('rating', { ascending: false })
  .limit(10);
```

---

## 📞 Support

If you encounter issues:

1. Check the output logs for specific error messages
2. Run `npm run verify-nearby` to see current status
3. Try running with a smaller `LIMIT` first
4. Review environment variables are set correctly

---

## ✅ Next Steps

1. **Check status first:**
   ```bash
   npm run verify-nearby
   ```

2. **Run populator:**
   ```bash
   npm run populate-nearby-real
   ```

3. **Verify results:**
   ```bash
   npm run verify-nearby
   ```

4. **If needed, run again:**
   ```bash
   LIMIT=100 npm run populate-nearby-real
   ```

---

Good luck populating your listings! 🚀📸
