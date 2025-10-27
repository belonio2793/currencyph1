# 🚀 Quick Start: Fetch Philippines Listings

## What's New?

You now have **two easy ways** to fetch and populate TripAdvisor listings for all Philippine cities:

### 1️⃣ Via Admin Panel (Easiest)

1. Click **"Admin"** button on home page
2. Go to **"Fetch Philippines"** tab
3. Click **"Fetch Philippines Listings"** button
4. Watch progress in real-time ✨
5. See results: how many listings were added

**No terminal required!** Just click and watch.

### 2️⃣ Via Command Line

```bash
npm run fetch-philippines
```

Perfect for automated/scheduled fetches.

---

## What Gets Fetched?

- 🏙️ **50+ Philippine cities** (Manila, Cebu, Davao, Boracay, El Nido, etc.)
- 📊 **Complete data** (name, address, coordinates, ratings, review count, category, images)
- ⭐ **TripAdvisor ratings** (current, accurate data)
- 🗺️ **GPS coordinates** (for mapping)
- 📸 **Featured images** (from TripAdvisor)

---

## How It Works

**The Smart Fetcher:**
1. ✅ Tries TripAdvisor API first for detailed data
2. ✅ Falls back to web scraping if API fails
3. ✅ Deduplicates results (no duplicates)
4. ✅ Respects rate limits (won't get blocked)
5. ✅ Saves to database in batches (efficient)

---

## Expected Results

- **Database**: Grows from current listings to 2,000+ listings
- **Cities**: Coverage of 50+ Philippine cities
- **Categories**: Attractions, Museums, Parks, Beaches, Hotels, Restaurants, etc.
- **Ratings**: Average 4.2/5.0 stars across listings

---

## Test It Out

After fetching:

1. **Search** in /nearby for "Manila" → See 50+ results
2. **Browse** by category (Museums, Parks, Beaches, etc.)
3. **Filter** by city (select from A-Z list)
4. **Vote** on your favorite listings (👍/👎)
5. **Save** favorites to your directory

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "TripAdvisor API key missing" | Check environment variables in Settings |
| "Rate limited" errors | Script auto-retries. Just wait and try again |
| "Some cities failed" | Normal! Script continues with working cities |
| "No new listings added" | Database already up-to-date, run again in a few weeks |

---

## Environment Check

Before running, ensure these are configured:

```env
✅ VITE_PROJECT_URL=https://your-supabase.supabase.co
✅ VITE_SUPABASE_SERVICE_ROLE_KEY=...
✅ VITE_TRIPADVISOR=your-api-key
```

Not sure? Check the [Settings](#open-settings).

---

## Performance

| Action | Time |
|--------|------|
| Fetch 1 city | 3-5 sec |
| Fetch all 50+ cities | 5-10 min |
| View results in /nearby | Instant |
| Search across all listings | <1 sec |

---

## Next Steps

1. **Fetch once**: Get all Philippines listings
2. **Explore**: Try searching and filtering in /nearby
3. **Share**: Let users explore attractions
4. **Maintain**: Re-fetch monthly to keep data fresh

---

## Full Documentation

For detailed info, see: [`PHILIPPINES_LISTINGS_FETCH_GUIDE.md`](./PHILIPPINES_LISTINGS_FETCH_GUIDE.md)

---

**Ready? Go to [Admin panel](#) and click "Fetch Philippines Listings"!** 🇵🇭✨
