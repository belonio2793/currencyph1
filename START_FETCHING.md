# 🎯 START FETCHING - One Command to Get Everything

## The Single Command

```bash
npm run fetch-all
```

That's all you need to type! 🚀

## What This Does

✅ Automatically checks everything
✅ Installs missing dependencies  
✅ Scrapes TripAdvisor Philippines
✅ Saves to your database
✅ Shows you the results

## How Long?

⏱️ **Total Time: 10-15 minutes**

- Environment check: 30 seconds
- Dependencies: 1-2 minutes  
- Scraping: 10-15 minutes
- Database save: 2-3 minutes

## What You'll See

### Starting
```
╔════════════════════════════════════════════════════════════╗
║   🌐 TripAdvisor Philippines Comprehensive Data Fetcher    ║
║      Fetching listings from tripadvisor.com.ph            ║
╚════════════════════════════════════════════════════════════╝

Step 1: Checking environment...
✓ Supabase URL configured
✓ Supabase credentials configured
```

### During Scraping
```
Step 4: Starting TripAdvisor scraper...

[1/30] Scraping Manila...
  📍 attractions ✓ Found 12 listings
  📍 hotels ✓ Found 8 listings
  📍 restaurants ✓ Found 15 listings
  💾 Saving 35 listings...
  ✓ Saved 35/35

[2/30] Scraping Cebu...
...
```

### When Done
```
╔════════════════════════════════════════════════════════════╗
║                  ✅ FETCH COMPLETE!                        ║
╚════════════════════════════════════════════════════════════╝

📊 Summary:
  Total Listings: ~300-500
  Philippine Cities: 30
  Categories: Attractions, Hotels, Restaurants
```

## Then Visit Your App

Open: **http://localhost:5173/nearby**

You'll see:
- 📊 Statistics (total listings, cities, avg rating)
- ⭐ Featured top-rated listings
- 🔤 A-Z alphabet selector with 30 cities
- 🔍 Search bar
- 💳 Beautiful listing cards
- 📍 Click any city to browse

## Cities You'll Get

### Major Metros
- Manila, Cebu, Davao, Quezon City, Makati

### Beach Destinations  
- Boracay, Palawan, El Nido, Coron, Siargao

### Other Popular Cities
- Baguio, Iloilo, Bacolod, Puerto Princesa, Dumaguete, Vigan, Subic Bay, Tagaytay, Antipolo, Cavite, Laguna, Pampanga, Batangas, Olongapo, and more (30 total)

## Categories

For each city you get:
- 🏛️ **Attractions** - Things to see & do
- 🏨 **Hotels** - Places to stay
- 🍽️ **Restaurants** - Where to eat

## Expected Results

**Database:**
- ~300-500+ listings
- 30 cities
- 3 categories
- All with ratings, reviews, addresses, links

**Your App:**
- A-Z city browser fully populated
- Statistics showing real counts
- Search working across all listings
- Every listing has images, ratings, reviews

## Quick Verification

After fetching completes, check:

1. **Visit the page**: http://localhost:5173/nearby
2. **See the header**: Should show statistics with real numbers
3. **Click "M"**: Should see Manila and Makati
4. **Click "Manila"**: Should see 25-35 Manila listings
5. **Search "hotel"**: Should return hotels across all cities

## If Something Goes Wrong

### Env Not Set
```bash
# Make sure these are set:
echo $PROJECT_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# If empty, check your .env file or set them:
export PROJECT_URL="your-url"
export SUPABASE_SERVICE_ROLE_KEY="your-key"

# Then run again:
npm run fetch-all
```

### Bash Not Found (Windows)
```bash
# Use Git Bash, WSL, or:
wsl bash scripts/fetch-all.sh
```

### npm Not Found
```bash
# Install Node.js from https://nodejs.org/
# Then run npm run fetch-all
```

### Scraper Taking Too Long
- ⏱️ This is normal (rate limiting for politeness)
- 📈 Check terminal for progress
- ⏸️ Let it run, typically 10-15 minutes

## What Happens to Demo Data?

The demo data (10 listings from earlier) will:
- ✅ Stay in the database
- ✅ Be mixed with new scraped data
- ✅ Not cause any conflicts
- ✅ Still be searchable

The script uses smart upserting, so no data is lost.

## After Fetching - What to Do

### 1. Explore the Data
```
Visit: http://localhost:5173/nearby
Click around the cities
Search for listings
View details
```

### 2. Share It
```
Your app now has 300-500 real listings
From 30 real Philippine cities
With real ratings and reviews
Perfect for users to explore!
```

### 3. Keep It Fresh
```
Run npm run fetch-all again anytime
Data auto-updates when run again
No conflicts or issues
Safe to run multiple times
```

### 4. Customize
```
Edit scripts/scrape-tripadvisor-ph.js to:
- Add more cities
- Change categories
- Modify what data to keep
```

## Files Involved

### What You Run
- `scripts/fetch-all.sh` ← Run this with `npm run fetch-all`

### What It Uses
- `scripts/scrape-tripadvisor-ph.js` ← Does the actual scraping
- `package.json` ← Has the npm script

### Databases
- Your Supabase `nearby_listings` table ← Gets populated

## The Complete Picture

```
npm run fetch-all
    ↓
scripts/fetch-all.sh (bash orchestrator)
    ↓
    ├─ Check environment variables ✓
    ├─ Check/install Node packages ✓
    ├─ Run scraper
    │   ├─ Scrape 30 cities
    │   ├─ Get attractions, hotels, restaurants
    │   └─ Save to database
    └─ Show results ✓
    
Results → Your /nearby page shows real data!
```

## Pro Tips

💡 **Tip 1**: Run with output redirection to save logs
```bash
npm run fetch-all | tee fetch-results.log
```

💡 **Tip 2**: Run in background on Linux/Mac
```bash
npm run fetch-all > fetch.log 2>&1 &
# Then check: tail -f fetch.log
```

💡 **Tip 3**: Reuse demo data if needed
```bash
npm run populate-demo
# Loads quick demo data (10 listings)
```

💡 **Tip 4**: Test API first
```bash
npm run test-api
# Checks API connectivity
```

## Final Checklist

Before running `npm run fetch-all`:
- [ ] Terminal is open
- [ ] You're in project directory
- [ ] Dev server running (separate terminal with `npm run dev`)
- [ ] Environment variables are set
- [ ] You have 15 minutes
- [ ] Internet connection is stable

## GO! 🚀

```bash
npm run fetch-all
```

Then grab a coffee ☕ and watch the listings populate!

After ~15 minutes:
- Visit http://localhost:5173/nearby
- See 30 cities
- See 300-500 listings
- Enjoy your Philippine travel guide! 🇵🇭

---

**Questions?** Check:
- `FETCH_ALL_GUIDE.md` - Detailed reference
- `ALPHABET_SELECTOR_GUIDE.md` - UI guide
- `DATABASE_SCHEMA_REFERENCE.md` - Data structure
- `FETCH_STATUS_AND_NEXT_STEPS.md` - Status report

**Ready?** Type: `npm run fetch-all` 💪
