# 🚀 Quick Start: Extract TripAdvisor Photo URLs

## What This Does

Populates the `photo_urls` column in your `nearby_listings` table with **real photos directly from TripAdvisor** using:
- ✅ Grok AI for intelligent extraction
- ✅ ScrapingBee for reliable scraping
- ✅ Real `dynamic-media-cdn.tripadvisor.com` URLs
- ✅ Automatic filtering of fake/fallback images

## One-Minute Setup

### 1. Test Your Setup (Recommended First)

```bash
node scripts/test-photo-extraction.js
```

This will:
- ✓ Check all API keys
- ✓ Test with 1-3 real listings
- ✓ Show you what photos will be extracted

### 2. Run the Extractor

**Option A: Process first 10 listings (safe)**
```bash
node scripts/grok-photo-urls-extractor.js
```

**Option B: Process with custom batch size**
```bash
node scripts/grok-photo-urls-extractor.js --batch=50 --limit=100
```

**Option C: Use npm script**
```bash
yarn extract-photo-urls
```

## What Happens

For each listing:
1. ✓ Fetches TripAdvisor listing page
2. ✓ Sends to Grok AI for analysis
3. ✓ Extracts real photo URLs
4. ✓ Filters out fakes/placeholders
5. ✓ Saves up to 20 photos to database
6. ✓ Updates `photo_urls` and `photo_count` columns

## Expected Results

**Before:**
```json
{
  "id": 1234,
  "name": "Ruth's Chris Steak House",
  "photo_urls": null,
  "photo_count": null
}
```

**After:**
```json
{
  "id": 1234,
  "name": "Ruth's Chris Steak House",
  "photo_urls": [
    "https://dynamic-media-cdn.tripadvisor.com/media/photo-s/1f/ab/c0/...",
    "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/1f/ab/c0/...",
    "https://dynamic-media-cdn.tripadvisor.com/media/photo-e/1f/ab/c0/..."
  ],
  "photo_count": 3
}
```

## Command Options

| Command | What It Does |
|---------|------------|
| `node scripts/grok-photo-urls-extractor.js` | Process 10 listings (default) |
| `--batch=20` | Process 20 listings per batch |
| `--limit=500` | Stop after 500 total listings |
| `--start=100` | Start from database offset 100 |
| `--force` | Re-process even if photos exist |
| `--batch=50 --limit=1000` | Combine options |

## Monitoring

### Check Progress

```sql
-- Count listings with photos
SELECT COUNT(*) FILTER (WHERE photo_urls IS NOT NULL)
FROM nearby_listings;

-- View recently updated listings
SELECT id, name, photo_count, updated_at 
FROM nearby_listings 
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC LIMIT 20;
```

### Resume If Interrupted

The script saves progress. To resume:

```bash
# Find where it stopped
SELECT MAX(id) FROM nearby_listings WHERE photo_urls IS NOT NULL;

# Resume from that point (e.g., ID 5000)
node scripts/grok-photo-urls-extractor.js --start=5000
```

## Using the Photos

### Frontend Display

Once populated, use in your components:

```jsx
function ListingPhotos({ photoUrls }) {
  return (
    <div className="photo-gallery">
      {photoUrls?.map((url, i) => (
        <img key={i} src={url} alt={`Photo ${i + 1}`} />
      ))}
    </div>
  )
}
```

### Query All Listings with Photos

```sql
SELECT id, name, city, photo_count 
FROM nearby_listings 
WHERE photo_urls IS NOT NULL 
ORDER BY photo_count DESC;
```

## Performance

| Metric | Time |
|--------|------|
| Per listing | 3-5 seconds |
| 100 listings | ~5-8 minutes |
| 1000 listings | ~50-80 minutes |

API costs are minimal - you have sufficient quotas.

## Troubleshooting

### "No photos found" for valid listings

1. Run test script: `node scripts/test-photo-extraction.js`
2. Check TripAdvisor URL is valid
3. Verify internet connection
4. Run with `--force` to retry

### API errors

1. Verify X_API_KEY is set correctly
2. Check Grok API has quota remaining
3. The script auto-rotates through 4 ScrapingBee keys
4. Reduce batch size if rate limited: `--batch=5`

### Still stuck?

1. Check full guide: [GROK_PHOTO_URLS_EXTRACTION.md](./GROK_PHOTO_URLS_EXTRACTION.md)
2. Run single listing test: `--batch=1 --start=<id>`
3. Check Supabase logs for database errors

## Alternative: Server-Side Processing

There's also an edge function version at `supabase/functions/extract-photo-urls/` for automated/scheduled processing. See the full guide for details.

## Next Steps

1. ✅ Test with: `node scripts/test-photo-extraction.js`
2. ✅ Run on first batch: `node scripts/grok-photo-urls-extractor.js`
3. ✅ Monitor progress in database
4. ✅ Scale up when confident: `node scripts/grok-photo-urls-extractor.js --batch=50 --limit=5000`
5. ✅ Use photos in your UI

## API Keys Used

Your environment already has:
- ✓ `X_API_KEY` (Grok/XAI)
- ✓ `VITE_PROJECT_URL` (Supabase)
- ✓ `VITE_SUPABASE_SERVICE_ROLE_KEY` (Supabase)

The script includes 4 pre-configured ScrapingBee keys - no additional setup needed!

---

**Ready?** Run: `node scripts/test-photo-extraction.js`

Then: `node scripts/grok-photo-urls-extractor.js`
