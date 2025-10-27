# Complete TripAdvisor Sync Setup for /nearby Page

## Overview

Your `/nearby` page fetches listings from a `nearby_listings` database table populated via a Supabase edge function that automatically syncs TripAdvisor data. This guide walks you through the complete setup.

---

## Architecture

```
TripAdvisor API (tripadvisor.com.ph)
    ↓
Supabase Edge Function (sync-tripadvisor-hourly)
    ↓ (runs via cron job daily or on-demand)
Supabase Database (nearby_listings table)
    ���
/nearby page displays listings with cards
    ↓ (click card → /nearby/:slug detail page)
/nearby/:slug detail page shows full information
```

---

## Step 1: Run Database Migration

This removes the UNIQUE constraint on `slug` column (caused "duplicate key" errors) and ensures all columns exist.

### In Supabase Dashboard:

1. Go to **SQL Editor** → **New Query**
2. Copy the entire contents from: `supabase/migrations/001_fix_schema.sql`
3. Click **Run** (or Ctrl+Enter)
4. Wait for "Query executed successfully"

**What this does:**
- ✅ Removes UNIQUE constraint on slug (allows multiple listings with similar names)
- ✅ Adds all required columns for UI rendering
- ✅ Creates performance indexes
- ✅ Sets up materialized views for fast queries

---

## Step 2: Verify Database Schema

In Supabase, run this query to confirm columns exist:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'nearby_listings'
ORDER BY ordinal_position;
```

You should see these key columns:
- ✅ `tripadvisor_id` (TEXT UNIQUE)
- ✅ `name` (TEXT)
- ✅ `rating` (NUMERIC)
- ✅ `review_count` (INTEGER)
- ✅ `category` (TEXT)
- ✅ `address` (TEXT)
- ✅ `image_url` (TEXT)
- ✅ `slug` (TEXT - no longer unique!)
- ✅ `latitude`, `longitude` (for maps)
- ✅ All other fields for detail page

---

## Step 3: Set Environment Variables

Ensure these are in your `.env.local` (in project root):

```bash
VITE_PROJECT_URL=https://corcofbmafdxehvlbesx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_TRIPADVISOR=451510296B594353B4EA0CD052DA6603
```

**Note:** If you're using the CLI, these should already be set. Check:
```bash
cat .env.local
```

---

## Step 4: Populate Initial Data

### Option A: Use Local Script (Recommended for First Run)

```bash
npm run sync-tripadvisor
```

This runs the local script which:
- Fetches from all ~100 Philippine cities
- Queries 9 categories each (attractions, museums, parks, etc.)
- Downloads images
- Generates unique slugs with ID suffixes
- Stores in database
- **Takes 5-10 minutes**

Output example:
```
📍 Starting sync for 30 cities × 9 categories
[1/270] Fetching attractions in Manila Philippines... ✓ 30 items
[2/270] Fetching museums in Manila Philippines... ✓ 28 items
...
✅ Sync complete! Upserted 5842 listings.
```

### Option B: Call Edge Function from UI

In `/nearby` page:
1. Click **"🔄 Fetch Philippines"** button
2. Confirm the dialog
3. Wait for completion
4. System shows stats (total fetched, unique, upserted)

---

## Step 5: Set Up Automatic Cron Job Sync

The edge function is already configured to run automatically via cron job.

### Configuration in `supabase/config.toml`:

```toml
[[functions]]
slug = "sync-tripadvisor-hourly"

[functions.scheduling]
cron = "0 0 * * *"  # Runs daily at 00:00 UTC
```

### Deploy the Edge Function:

```bash
supabase functions deploy sync-tripadvisor-hourly
```

Or if using remote Supabase:

```bash
supabase functions deploy sync-tripadvisor-hourly --project-ref corcofbmafdxehvlbesx
```

### Verify Deployment:

1. Go to Supabase Dashboard
2. **Edge Functions** → **sync-tripadvisor-hourly**
3. Should show "Active" status
4. Check **Logs** tab to see execution history

---

## Step 6: Test the /nearby Page

1. Go to your app → click **"Nearby"** button
2. You should see:
   - Stats: "X Total Listings", "Y Cities", "Z Categories", "W Avg Rating"
   - Featured cities section with cards
   - Search bar that works
   - City filter dropdown

3. Click any listing card → Should navigate to `/nearby/:slug` detail page
   - Shows full information
   - Photo gallery
   - Reviews, amenities, hours, contact info

---

## Slug Generation Explained

Since multiple locations can have the same name (e.g., "San Luis Parks" in different cities), slugs include the TripAdvisor ID:

```
Name: "San Luis Parks" (Manila)
TripAdvisor ID: a1b2c3d4e5f6
Slug: san-luis-parks-a1b2c3

Name: "San Luis Parks" (Laguna)  
TripAdvisor ID: f6e5d4c3b2a1
Slug: san-luis-parks-f6e5d4
```

Both URLs work:
- `/nearby/san-luis-parks-a1b2c3`
- `/nearby/san-luis-parks-f6e5d4`

---

## Data Sync Schedule

### Current Configuration:

| Frequency | Time | Cities | Categories | Estimated Time | Notes |
|-----------|------|--------|-----------|-----------------|-------|
| **Manual (Button)** | On-demand | ~100 | 9 | 5-10 mins | User clicks "🔄 Fetch Philippines" |
| **Automatic (Cron)** | 00:00 UTC daily | ~100 | 9 | 5-10 mins | Runs in background (see `config.toml`) |

### To Change Frequency:

Edit `supabase/config.toml`:

```toml
# Every 6 hours
cron = "0 0,6,12,18 * * *"

# Every 12 hours  
cron = "0 0,12 * * *"

# Every day at 9am UTC
cron = "0 9 * * *"

# Every week on Monday
cron = "0 0 * * 1"
```

---

## Monitoring & Debugging

### Check Sync Status

In Supabase Dashboard → **Edge Functions** → **sync-tripadvisor-hourly** → **Logs**:

Look for entries like:
```
Starting sync for 100 cities × 9 categories = 900 queries
✓ Fetched 30 items: attractions in Manila Philippines
✓ Fetched 28 items: museums in Manila Philippines
...
Total fetched: 8234
Unique listings: 5842
Successfully upserted: 5842
```

### Check Database

```sql
-- Count listings
SELECT COUNT(*) FROM nearby_listings;

-- Check latest updates
SELECT name, rating, updated_at 
FROM nearby_listings 
ORDER BY updated_at DESC 
LIMIT 10;

-- Find duplicates (should be none if slug generation works)
SELECT slug, COUNT(*) 
FROM nearby_listings 
WHERE slug IS NOT NULL
GROUP BY slug 
HAVING COUNT(*) > 1;
```

### Common Issues

| Issue | Solution |
|-------|----------|
| No listings appear | Run `npm run sync-tripadvisor` to populate |
| Edge function won't deploy | Check `supabase/functions/sync-tripadvisor-hourly/index.ts` syntax |
| Cron job not running | Verify `supabase/config.toml` has correct cron format |
| Duplicate slug errors | Run the SQL migration to remove UNIQUE constraint |
| Out of API quota | Reduce sync frequency or increase TripAdvisor tier |

---

## File Structure

```
project/
├── supabase/
│   ├── functions/
│   │   └── sync-tripadvisor-hourly/
│   │       ├── index.ts          ← Edge function (fetches from TripAdvisor)
│   │       └── deno.json
│   ├── migrations/
│   │   └── 001_fix_schema.sql    ← Database setup
│   └── config.toml               ← Cron job configuration
├── src/
│   ├── components/
│   │   ├── Nearby.jsx            ← Main /nearby page
│   │   ├── ListingCard.jsx       ← Card component
│   │   └── ListingDetail.jsx     ← Detail page component
│   └── lib/
│       ├── supabaseClient.js     ← Supabase connection
│       └── tripadvisorSync.js    ← Sync utilities
├── scripts/
│   └── sync-tripadvisor-locally.js  ← Local Node.js script for manual sync
└── .env.local                    ← Environment variables
```

---

## Performance Optimization

### For 5,000+ Listings:

1. **Pagination** - Already implemented (12 per page)
2. **Indexes** - Already created on rating, category, address
3. **Full-text search** - Already set up (search by name/description)
4. **Materialized views** - Created for fast top-rated and by-city queries

### Loading Strategies:

1. **Featured section** - Loads top 10 cities on page load
2. **Search** - Uses full-text index for instant results
3. **Category filter** - Uses indexed category column
4. **City filter** - Uses materialized view `listings_by_city`

---

## API Rate Limiting

TripAdvisor has rate limits on the free tier:
- ~500 requests/month
- 1 request/second

**Current sync strategy:**
- 100 cities × 9 categories = 900 requests
- 300ms delay between requests = safety buffer
- ~4.5 minutes total runtime

**Stays within limits** if run once per day.

---

## Troubleshooting

### Edge function returns 500 error

Check environment variables are set:
```bash
supabase secrets list
```

Should show:
- `VITE_TRIPADVISOR` (TripAdvisor API key)

### Listings don't appear after sync

1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Check database has data: 
   ```sql
   SELECT COUNT(*) FROM nearby_listings;
   ```
3. Check listings have slugs:
   ```sql
   SELECT COUNT(*) FROM nearby_listings WHERE slug IS NULL;
   ```

### Sync takes too long

Reduce cities synced by calling with custom parameter:
```javascript
// Call edge function with cityLimit parameter
fetch('/sync-tripadvisor-hourly', {
  method: 'POST',
  body: JSON.stringify({ cityLimit: 10 })  // Only first 10 cities
})
```

### Images not loading

1. Check storage bucket exists: Supabase Dashboard → **Storage**
2. Check images uploaded: Look in `nearby_listings/listings/` folder
3. Verify public access: Bucket should be "public"

---

## Next Steps

1. ✅ Run the SQL migration
2. ✅ Verify database schema
3. ✅ Run `npm run sync-tripadvisor` to populate data
4. ✅ Test `/nearby` page
5. ✅ Deploy edge function: `supabase functions deploy sync-tripadvisor-hourly`
6. ✅ Verify cron job running (check logs daily)
7. 🔄 Listings auto-update daily at 00:00 UTC

---

## Support

If you encounter issues:

1. **Check logs:** Supabase Dashboard → Edge Functions → Logs
2. **Check database:** Run diagnostic queries above
3. **Check environment:** Verify `.env.local` has all required variables
4. **Check deployment:** Confirm edge function is "Active"
5. **Check quota:** Verify TripAdvisor API isn't rate-limited

Happy building! 🚀
