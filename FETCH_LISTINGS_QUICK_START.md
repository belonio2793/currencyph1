# 🚀 Quick Start: Fetch All Philippine Cities Listings

## ⚡ TL;DR - 3 Simple Steps

### Step 1: Verify Environment Variables
Make sure you have these set in your environment:
```
PROJECT_URL=https://corcofbmafdxehvlbesx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
TRIPADVISOR=451510296B594353B4EA0CD052DA6603
```

### Step 2: Run the Fetcher
```bash
npm run fetch-all-cities-node
```

### Step 3: Watch the Progress
The script will:
- Fetch listings from 170+ Philippine cities
- Extract 3 categories (attractions, restaurants, hotels) per city
- Save 15,000+ total listings to your database
- Take about 45-60 minutes

## What Gets Saved

Each listing includes:
- ✅ Name, address, location (lat/lng)
- ✅ Rating, review count, reviews
- ✅ Photos (up to 20 per listing)
- ✅ Category & location type
- ✅ Website, phone, hours
- ✅ Amenities, awards, pricing
- ✅ Accessibility info, duration
- ✅ City & country (Philippines)

## Beautiful UI Updates

### The /nearby Page Now Has:
1. **Professional Header** with gradient background
2. **Live Statistics**:
   - Total listings count
   - Number of cities covered
   - Average rating across all listings
3. **Featured Section** - top-rated listings
4. **Search** - by name, address, category, city
5. **Browse by City** - alphabetical A-Z navigation
6. **Responsive Cards** with:
   - High-quality images
   - Star ratings
   - Photo counts
   - Quick contact links (website, phone)
   - Price & duration info
   - Social voting (👍 👎)

## Expected Output

```
🚀 TripAdvisor Philippines Comprehensive Fetcher
================================================

[1/170] Fetching Abuyog...
  ✓ Listed 15 attractions
  ✓ Listed 8 restaurants
  ✓ Listed 3 hotels
  💾 Saving 26 listings...
  
[2/170] Fetching Alaminos...
...

📊 Final Summary
================
Total Scraped:  15,420
Total Upserted: 14,893
Duration:       54 minutes
✅ Complete!
```

## Troubleshooting

### "Environment variables not set"
→ Make sure `PROJECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `TRIPADVISOR` are in your environment

### "No listings found"
→ This is normal for small cities. The script continues to the next city.

### "API rate limit errors"
→ The script automatically handles this with delays. Just let it run.

### "Database connection error"
→ Verify your Supabase URL and service role key are correct

## Database Queries to Verify Success

### Check total listings
```sql
SELECT COUNT(*) FROM nearby_listings;
-- Should be 10,000+
```

### Check cities covered
```sql
SELECT COUNT(DISTINCT city) FROM nearby_listings;
-- Should be 170+
```

### Check data quality
```sql
SELECT 
  COUNT(*) as total,
  COUNT(DISTINCT city) as cities,
  AVG(rating) as avg_rating,
  COUNT(image_url) as listings_with_images
FROM nearby_listings;
```

### See sample data
```sql
SELECT name, city, rating, review_count, category
FROM nearby_listings
WHERE rating IS NOT NULL
ORDER BY rating DESC
LIMIT 10;
```

## After Fetching

1. **Go to the app** → /nearby page
2. **See the header** → Stats should show total listings
3. **Check featured** → Top-rated listings displayed
4. **Try search** → Search for a city or category
5. **Browse cities** → Click on letters A-Z to see city listings

## Advanced Options

### Run in background (Linux/Mac)
```bash
npm run fetch-all-cities-node > fetch.log 2>&1 &
```

### Run specific part again
Edit `scripts/fetch-all-cities-listings.js` and modify the `PHILIPPINE_CITIES` array to include only certain cities.

### Check progress while running
```bash
# Count current listings
sqlite3 your_database.db "SELECT COUNT(*) FROM nearby_listings;"
```

## Performance Tips

- Run during off-peak hours (late night, early morning)
- Don't interrupt the script (it resumes efficiently)
- Your database will be updated incrementally
- Safe to run multiple times (uses upsert)

---

**That's it!** 🎉 Run `npm run fetch-all-cities-node` and wait for the ✅ Complete message!
