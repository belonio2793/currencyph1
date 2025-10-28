# Photo Extraction - Quick Reference

## 30-Second Summary

Extract real TripAdvisor photos into your database using Grok AI + ScrapingBee.

```bash
node scripts/test-photo-extraction.js      # Test first (1 min)
node scripts/grok-photo-urls-extractor.js  # Extract photos (3+ sec per listing)
```

## Commands

```bash
# Test (always do this first)
node scripts/test-photo-extraction.js

# Extract photos - default (10 listings)
node scripts/grok-photo-urls-extractor.js

# Extract photos - with options
node scripts/grok-photo-urls-extractor.js --batch=50 --limit=500

# Via npm
yarn extract-photo-urls

# Resume from specific ID
node scripts/grok-photo-urls-extractor.js --start=2500 --batch=50
```

## Options Explained

| Option | What | Example |
|--------|------|---------|
| `--batch=N` | How many to process at once | `--batch=50` |
| `--limit=N` | Total to process max | `--limit=1000` |
| `--start=N` | Which ID to start from | `--start=500` |
| `--force` | Re-process existing photos | `--force` |

## Process

```
1. ScrapingBee fetches TripAdvisor page
2. Grok AI extracts photo URLs from HTML
3. Fallback to regex if needed
4. Filter fake/placeholder images
5. Save 1-20 URLs to photo_urls column
6. Update photo_count and timestamp
```

## Expected Output

```
[ID: 1234] Ruth's Chris Steak House Manila (Manila)
  Fetching TripAdvisor page...
  ✓ Page fetched, analyzing photos...
  Grok found: 8 photos
  ✓ Updated with 8 photos
    First URL: https://dynamic-media-cdn.tripadvisor.com/media/photo-s/...

=== FINAL RESULTS ===
Total processed: 10
Updated with photos: 8
Already had photos: 2
Success rate: 80.0%
```

## Check Progress

```sql
-- How many have photos?
SELECT COUNT(*) FILTER (WHERE photo_urls IS NOT NULL)
FROM nearby_listings;

-- Last 10 updated
SELECT id, name, photo_count, updated_at 
FROM nearby_listings 
WHERE updated_at > NOW() - INTERVAL '1 hour'
LIMIT 10;
```

## Troubleshoot

| Problem | Solution |
|---------|----------|
| No photos extracted | Run test: `node scripts/test-photo-extraction.js` |
| Rate limited | Reduce batch: `--batch=5` |
| API error | Check internet, retry later |
| Stuck? | Run specific listing: `--batch=1 --start=<id>` |

## Timing

| Size | Time |
|------|------|
| 10 | 1-2 min |
| 50 | 4-8 min |
| 100 | 8-15 min |
| 500 | 45+ min |

## Files

| File | What |
|------|------|
| `scripts/grok-photo-urls-extractor.js` | Main script |
| `scripts/test-photo-extraction.js` | Test script |
| `PHOTO_URLS_QUICK_START.md` | Full quick start |
| `GROK_PHOTO_URLS_EXTRACTION.md` | Complete guide |
| `PHOTO_EXTRACTION_IMPLEMENTATION.md` | Technical details |

## Key Points

✅ Uses real Grok AI + ScrapingBee  
✅ Extracts `dynamic-media-cdn.tripadvisor.com` URLs  
✅ Removes fakes/placeholders automatically  
✅ Up to 20 photos per listing  
✅ Rotates 4 ScrapingBee keys  
✅ Resume-able from any point  

## Start Here

```bash
# 1. Test (1 min)
node scripts/test-photo-extraction.js

# 2. Extract first batch (5-10 min)
node scripts/grok-photo-urls-extractor.js

# 3. Check results
SELECT COUNT(*) FROM nearby_listings WHERE photo_urls IS NOT NULL;

# 4. Scale up when ready
node scripts/grok-photo-urls-extractor.js --batch=100 --limit=5000
```

---

That's it! See other guides for details.
