# Quick Start: Grok CSV Enrichment

## TL;DR - Run in 2 Steps

### Step 1: Set Your API Key

```bash
export X_API_KEY="xai-qe0lzba8kfDmccd5EBClqO7ELZXxYG3hyyetV1b5D4dISqjStXLHcFElnYfmRD3ddy0gV4sHxnR3XZT3"
```

### Step 2: Run the Script

```bash
npm run grok-enrich-csv
```

That's it! ✅

---

## What Happens

1. Reads `nearby-listings.csv` (provided in project root)
2. Sends each listing to Grok API for enrichment
3. Fetches: descriptions, ratings, phone numbers, websites, amenities, photos
4. Updates Supabase `nearby_listings` table automatically
5. Shows progress in terminal

## Expected Time

- **4 sample listings:** ~15-20 seconds
- **100 listings:** ~3-5 minutes
- **1000 listings:** ~30-60 minutes

## Success Indicators

✅ You'll see this in the terminal:

```
✅ Upserted: Beach Resort - Imus (Imus)
��� Upserted: Heritage Site - Negros Occidental (Negros Occidental)
✅ Upserted: Traditional Eatery - Davao del Sur (Davao del Sur)
✅ Upserted: Malate Church (Manila)

Complete! Success: 4, Failures: 0
```

## Verify in Supabase

1. Open your Supabase dashboard
2. Go to Table Editor → `nearby_listings`
3. See new data in columns:
   - `name` (enriched)
   - `description` (enriched)
   - `rating` (enriched)
   - `review_count` (enriched)
   - `phone_number` (enriched)
   - `website` (enriched)
   - `amenities` (enriched)
   - `photo_urls` (enriched)

## Common Issues

| Issue | Fix |
|-------|-----|
| `X_API_KEY not found` | Run: `export X_API_KEY="xai-..."` |
| `CSV file not found` | File exists at: `./nearby-listings.csv` ✅ |
| `Supabase connection failed` | Credentials already set ✅ |
| API timeouts | Just rerun, the script continues where it left off |

## Add More Listings

1. Add rows to `nearby-listings.csv`
2. Include: `name`, `city`, `latitude`, `longitude`, `category`
3. Run: `npm run grok-enrich-csv` again

## For Full Documentation

See: `GROK_CSV_ENRICHMENT_GUIDE.md`

---

**Questions?** Check the guide or verify your environment variables:

```bash
echo "X_API_KEY: $X_API_KEY"
echo "PROJECT_URL: $PROJECT_URL"
echo "SERVICE_ROLE_KEY length: ${#SUPABASE_SERVICE_ROLE_KEY}"
```
