# Populate Nearby Listings - Quick Start

## Run Now (Automated)

```bash
npm run populate-nearby-batch
```

That's it! This single command:
1. ✅ Searches TripAdvisor via Google Custom Search (60-90 min)
2. ✅ Fetches TripAdvisor pages for details (90-150 min)
3. ✅ Populates all columns in nearby_listings
4. ✅ Shows progress and statistics

**Total time**: ~2.5-4 hours

**Result**: 30,000+ complete listings on /nearby page

## Individual Steps

If you want to run steps separately:

```bash
# Step 1: Search & create base listings (60-90 min)
npm run populate-nearby-google

# Step 2: Enrich with TripAdvisor data (90-150 min)
npm run enrich-nearby-data

# Or run both with one command
npm run populate-nearby-full
```

## Monitor Progress

- Watch the console output for real-time progress
- Check `/nearby` page in your app to see results
- Visit Supabase dashboard to view database

## What Gets Populated

✅ **Base listing data** (from Step 1):
- Name, TripAdvisor ID, URL
- City, country, category
- Basic rating & review count

✅ **Complete enrichment data** (from Step 2):
- Up to 20 photos per listing
- Operating hours by day
- Amenities & accessibility info
- Contact phone & website
- Price level
- Full address

## Coverage

- **150+ Philippine cities** (Complete nationwide coverage)
- **3 categories** (Restaurants, Hotels, Attractions)
- **30,000+ total listings**

## Troubleshooting

### "Rate limited" error?
Wait 24 hours or reduce processing:
```bash
LIMIT=10 npm run enrich-nearby-data
```

### Fetch failed errors?
Non-critical - some listings won't have full data. Try again:
```bash
npm run enrich-nearby-data
```

### No listings added?
They may already exist. Check with:
```bash
npm run check-tripadvisor
```

## Done!

Visit http://localhost:5173/nearby to see all populated listings.

---

For detailed information, see: **POPULATE_NEARBY_GOOGLE_GUIDE.md**
