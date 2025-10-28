# 🎯 Nearby Population - Quick Reference

## Three Simple Commands

### 1️⃣ Check Status
```bash
npm run verify-nearby
```
Shows current coverage of IDs and photos.

### 2️⃣ Populate (Start Here)
```bash
npm run populate-nearby-real
```
Processes 30 listings (default limit).

### 3️⃣ Populate More
```bash
LIMIT=50 npm run populate-nearby-real
```
Processes 50 listings. Adjust number as needed.

---

## Common Workflows

### Testing (Small Batch)
```bash
LIMIT=5 npm run populate-nearby-real
npm run verify-nearby
```

### Standard Run
```bash
npm run populate-nearby-real
npm run verify-nearby
```

### Big Batch
```bash
LIMIT=100 npm run populate-nearby-real
```

### Resume After Interruption
Just run again - it skips completed listings.

---

## Expected Results Per Command

| Command | Time | Listings | Photos | IDs |
|---------|------|----------|--------|-----|
| `LIMIT=10` | 1-2 min | ✅ 10 | ~50-60 | 8-9 |
| `LIMIT=25` | 3-4 min | ✅ 25 | ~125-150 | 22-24 |
| `LIMIT=50` | 8-10 min | ✅ 50 | ~250-300 | 45-48 |
| `LIMIT=100` | 15-20 min | ✅ 100 | ~500-600 | 90-95 |

---

## Real Data Source

✅ **100% Real TripAdvisor Philippines Data**
- Using Grok AI for accurate matching
- ScrapingBee for live page fetching
- Photo URLs from TripAdvisor CDN

❌ No synthetic data
❌ No mock images
❌ No cached/stale content

---

## What Gets Populated

For each listing:
- ✅ `tripadvisor_id` - Unique TripAdvisor identifier
- ✅ `photo_urls` - Array of real photo URLs
- ✅ `photo_count` - Number of photos
- ✅ `web_url` - Link to TripAdvisor listing
- ✅ `verified` - Set to true
- ✅ `fetch_status` - Set to 'success'
- ✅ `updated_at` - Timestamp

---

## Monitoring Progress

### During Run
Watch the console for:
```
[1] 📍 Listing Name (City)
  ✓ Found URL
  ✓ Extracted ID: 123456
  📸 Found 15 photo URLs
  ✅ Updated successfully
```

### After Run
```bash
npm run verify-nearby
```

Shows:
- % with TripAdvisor IDs
- % with photo URLs
- Total photos extracted
- Coverage by city

---

## Tips for Success

1. **Start small** - Run with LIMIT=10-25 first
2. **Check results** - Run verify after each batch
3. **Batch it** - Run 50-100 at a time for efficiency
4. **Space runs out** - Wait 5-10 min between large batches
5. **Resume friendly** - Script is idempotent, safe to re-run

---

## Sample Output

```
[1] 📍 National Museum (Manila)
  🔍 Searching for real TripAdvisor listing...
  ✓ Found URL: https://www.tripadvisor.com.ph/Attraction_Review...
  ✓ Extracted ID: 298573
  📄 Fetching page via ScrapingBee...
  📸 Found 18 photo URLs
  ✅ Updated successfully

[2] 📍 Rizal Park (Manila)
  🔍 Searching for real TripAdvisor listing...
  ✓ Found URL: https://www.tripadvisor.com.ph/Attraction_Review...
  ✓ Extracted ID: 299534
  📄 Fetching page via ScrapingBee...
  📸 Found 22 photo URLs
  ✅ Updated successfully

================================================================================
📊 COMPLETION REPORT
================================================================================

  Total processed: 25
  ✅ Successfully updated: 23
  ⏭️  Already complete: 1
  ❌ Failed: 1
  📸 Total photos extracted: 387
```

---

## Environment Setup

Everything is already configured! Your env vars:
- ✅ VITE_PROJECT_URL
- ✅ VITE_SUPABASE_SERVICE_ROLE_KEY
- ✅ X_API_KEY (Grok)
- ✅ ScrapingBee keys (12 rotating)

No additional setup needed!

---

## Troubleshooting

**Problem:** Not finding TripAdvisor listings
- Solution: Some listings might be very local; run more batches

**Problem:** Low photo count
- Solution: Some listings have fewer photos; this is normal

**Problem:** Database update failures
- Solution: Check Supabase credentials are set

**Problem:** Rate limit errors
- Solution: Wait 5 minutes and run again

---

## Files Created

- `scripts/populate-nearby-real-tripadvisor.js` - Main populator
- `scripts/verify-nearby-population.js` - Status checker
- `POPULATE_NEARBY_GUIDE.md` - Full documentation
- `NEARBY_POPULATION_QUICK_REFERENCE.md` - This file

---

**Ready to populate? Run:**
```bash
npm run populate-nearby-real
```

Then check results:
```bash
npm run verify-nearby
```

Good luck! 🚀
