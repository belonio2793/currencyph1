# 🚀 Comprehensive Data Fetcher - fetch-all.sh

## Overview

`fetch-all.sh` is a complete bash script that automates the entire process of:
1. ✅ Checking environment & dependencies
2. ✅ Installing required packages
3. ✅ Scraping TripAdvisor Philippines
4. ✅ Populating your database
5. ✅ Verifying results

## Quick Start

### One Command to Fetch Everything:
```bash
npm run fetch-all
```

or

```bash
bash scripts/fetch-all.sh
```

That's it! The script handles everything.

## What Happens

### Step 1: Environment Check (30 seconds)
```
✓ Supabase URL configured
✓ Supabase credentials configured
```

### Step 2: Dependencies Check (1-2 minutes)
```
✓ Node.js v18.16.0
✓ npm 9.6.7
✓ node-fetch installed
✓ cheerio installed
✓ @supabase/supabase-js installed
```

### Step 3: Running Scraper (10-15 minutes)
```
🚀 TripAdvisor Philippines Web Scraper
======================================

[1/30] Scraping Manila...
  📍 attractions (https://www.tripadvisor.com/Tourism-g298573-...)
    ✓ Found 12 listings
  📍 hotels (https://www.tripadvisor.com/Tourism-g298573-...)
    ✓ Found 8 listings
  📍 restaurants (https://www.tripadvisor.com/Tourism-g298573-...)
    ✓ Found 15 listings

  💾 Saving 35 listings...
  ✓ Saved 35/35

[2/30] Scraping Cebu...
...
```

### Step 4: Final Summary
```
📊 Summary:
  Total Listings: ~300-500
  Philippine Cities: 30
  Categories: Attractions, Hotels, Restaurants
```

## Estimated Timeline

| Phase | Duration | What's Happening |
|-------|----------|------------------|
| Env Check | ~30 sec | Validating configuration |
| Deps Install | ~1-2 min | Installing npm packages |
| Scraping | ~10-15 min | Fetching from TripAdvisor |
| Database | ~2-3 min | Saving to Supabase |
| **Total** | **~15-20 min** | **Complete!** |

## What Gets Scraped

### Cities (30 total)
- Major: Manila, Cebu, Davao, Quezon City, Makati
- Islands: Boracay, Palawan, El Nido, Coron, Siargao
- Provinces: Baguio, Iloilo, Bacolod, Puerto Princesa, Dumaguete, Vigan, and more

### Categories (3 types per city)
- ✈️ Attractions (things to do)
- 🏨 Hotels (places to stay)
- 🍽️ Restaurants (where to eat)

### Data per Listing
- Name, address, location (city, country)
- Rating (1-5 stars)
- Number of reviews
- Category & type
- TripAdvisor link
- Description
- Highlights

## Expected Results

After running `npm run fetch-all`:

**Database:**
- 300-500+ listings total
- 30 Philippine cities
- All 3 categories represented

**Your /nearby page will show:**
- ✅ Statistics header with total counts
- ✅ Featured (top-rated) listings
- ✅ Full A-Z city selector (30 cities)
- ✅ Search across all listings
- ✅ Beautiful listing cards with details

## Prerequisites

### Environment Variables Required
```bash
# Supabase
PROJECT_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# OR use VITE_ prefix versions
VITE_PROJECT_URL=...
VITE_SUPABASE_SERVICE_ROLE_KEY=...
```

### System Requirements
- Node.js v14+ (check with: `node --version`)
- npm v6+ (check with: `npm --version`)
- Internet connection
- ~100MB disk space

## Running the Script

### Method 1: Using npm (Recommended)
```bash
npm run fetch-all
```

### Method 2: Using bash directly
```bash
bash scripts/fetch-all.sh
```

### Method 3: Using node directly
```bash
node scripts/scrape-tripadvisor-ph.js
```

## Progress Tracking

The script shows real-time progress:

```
[1/30] Scraping Manila...
  📍 attractions ✓ Found 12 listings
  📍 hotels ✓ Found 8 listings
  📍 restaurants ✓ Found 15 listings
  💾 Saving 35 listings...
  ✓ Saved 35/35

[2/30] Scraping Cebu...
...

📊 Final Summary
================
Cities Processed: 30
Total Scraped:    ~400
Total Upserted:   ~350
Duration:         12.5 minutes
✅ Complete!
```

## After the Fetch Completes

### 1. Verify Data Loaded
Go to http://localhost:5173/nearby

You should see:
- Statistics showing total listings count
- Multiple cities in the A-Z selector
- Featured listings section
- All categories represented

### 2. Test the UI
```
1. Click "M" → See Manila, Makati
2. Click "Manila" → See Manila listings
3. Search "hotel" → See all hotels
4. Click a listing → See full details
```

### 3. Check Database
Query in Supabase SQL Editor:
```sql
SELECT 
  COUNT(*) as total,
  COUNT(DISTINCT city) as cities,
  COUNT(DISTINCT category) as categories
FROM nearby_listings
WHERE source = 'tripadvisor_web';
```

Expected result:
```
total: 350-500
cities: 30
categories: 3
```

## Troubleshooting

### "Environment variable not set"
**Solution:**
```bash
# Check what's set
echo $PROJECT_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# If empty, set them before running
export PROJECT_URL="https://..."
export SUPABASE_SERVICE_ROLE_KEY="eyJh..."

npm run fetch-all
```

### "Command not found: bash"
**Solution:**
```bash
# On Windows, use:
wsl bash scripts/fetch-all.sh
# Or use Git Bash

# On Mac/Linux:
bash scripts/fetch-all.sh
```

### "npm: command not found"
**Solution:**
```bash
# Install Node.js from https://nodejs.org/
# Or use package manager:
# macOS: brew install node
# Ubuntu: sudo apt install nodejs npm
```

### "Permission denied: scripts/fetch-all.sh"
**Solution:**
```bash
chmod +x scripts/fetch-all.sh
bash scripts/fetch-all.sh
```

### "No listings appeared after fetch"
**Solution:**
1. Check script output for errors
2. Verify database connectivity
3. Refresh page (Ctrl+Shift+R hard refresh)
4. Check browser console for errors
5. Verify data was saved: Run SQL query above

### "Scraper is slow/hanging"
**Solution:**
- Network may be slow (script waits between requests)
- TripAdvisor may be rate limiting (script handles this)
- Let it run, it typically completes in 10-15 minutes
- Check terminal for progress updates

## Advanced Options

### Run Only Scraper (Skip Env Check)
```bash
node scripts/scrape-tripadvisor-ph.js
```

### Test API First
```bash
npm run test-api
```

### Populate Demo Data Instead
```bash
npm run populate-demo
```

## Script Files

### Main Orchestrator
- `scripts/fetch-all.sh` - Complete bash script (what you run)

### Scrapers
- `scripts/scrape-tripadvisor-ph.js` - Web scraper (called by bash script)
- `scripts/populate-demo-listings.js` - Demo data loader
- `scripts/fetch-all-cities-listings.js` - Original API-based fetcher

### Configuration
- `package.json` - npm scripts and dependencies
- `.env` or environment variables - Supabase credentials

## FAQ

**Q: How long does it take?**
A: 10-15 minutes total, mostly spent scraping (rate-limited for politeness)

**Q: Will it affect my existing data?**
A: No, it uses UPSERT which creates or updates records, never deletes

**Q: Can I run it multiple times?**
A: Yes, it's safe to run multiple times. Duplicate data is merged.

**Q: What if it fails halfway?**
A: Just run again. It picks up where it left off.

**Q: Can I modify what gets scraped?**
A: Yes, edit the PHILIPPINE_CITIES array in `scrape-tripadvisor-ph.js`

**Q: Can I change rate limiting?**
A: Yes, modify `sleep(1000)` values in `scrape-tripadvisor-ph.js`

**Q: Is this scraping legal?**
A: See TripAdvisor's Terms of Service. This is for educational/development use.

## Support

If issues occur:

1. **Check the output** - Script provides detailed error messages
2. **Verify environment** - `npm run test-api`
3. **Check network** - Ensure internet connectivity
4. **Review logs** - See full output in terminal
5. **Try demo data** - `npm run populate-demo` (fallback)

## Summary

```bash
# One command to fetch everything:
npm run fetch-all

# Then visit: http://localhost:5173/nearby
# Enjoy exploring Philippine listings! 🇵🇭
```

---

**Ready?** Run `npm run fetch-all` and watch the magic happen! ✨
