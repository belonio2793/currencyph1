# 🚀 TripAdvisor Sync with Edge Functions & Image Storage

Complete setup guide for hourly TripAdvisor data fetching with automatic image downloading and storage.

---

## 📋 What's Included

### 1. **Supabase Edge Function** (`sync-tripadvisor-hourly`)
- Fetches listings from all 80+ Philippine cities
- Supports 9 categories per city
- Handles deduplication
- Rate-limited API calls (300ms between requests)
- Automatic hourly scheduling via cron job

### 2. **Image Storage Bucket** (`listing-images`)
- Public access for all images
- Automatic image download and storage
- Lazy loading with fallbacks
- CDN-optimized delivery

### 3. **Database Enhancements**
- New columns: `image_url`, `stored_image_path`, `image_downloaded_at`
- Helper functions for distance-based and full-text search
- Automatic timestamp updates
- Comprehensive indexes for performance

### 4. **Frontend Components**
- Reusable `ListingCard` component with image support
- `imageManager.js` utility for image caching and downloading
- Lazy loading with skeleton states
- Proper error handling and fallbacks

---

## 🔧 Installation Steps

### Step 1: Set Up Environment Variables

Make sure you have these environment variables set in your Supabase project:

```bash
# Supabase Project Settings
VITE_PROJECT_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# TripAdvisor API Key (optional - will use mock data if not set)
VITE_TRIPADVISOR=your-tripadvisor-api-key
```

### Step 2: Run Database Migrations

**Option A: Using Supabase CLI**
```bash
supabase db push
```

**Option B: Manual SQL in Supabase Dashboard**
1. Go to your Supabase project → SQL Editor
2. Create a new query
3. Copy and paste the contents of `supabase/migrations/add_image_support.sql`
4. Run the query

### Step 3: Set Up Storage Bucket

```bash
# Run the storage setup script
node scripts/setup-image-storage.js
```

This will:
- ✅ Create the `listing-images` bucket
- ✅ Set up public access policies
- ✅ Configure proper permissions

### Step 4: Deploy Edge Function

```bash
# Option A: Using Supabase CLI
supabase functions deploy sync-tripadvisor-hourly

# Option B: Using curl (if CLI is not available)
curl -X POST https://your-project.supabase.co/functions/v1/sync-tripadvisor-hourly \
  -H "Authorization: Bearer your-service-role-key" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### Step 5: Verify Edge Function

Test the function manually:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/sync-tripadvisor-hourly \
  -H "Authorization: Bearer your-service-role-key" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "totalFetched": 2500,
  "uniqueListings": 2300,
  "upserted": 2300,
  "message": "Synced 2300 listings..."
}
```

### Step 6: Enable Cron Scheduling

1. Go to Supabase Dashboard → Edge Functions
2. Find `sync-tripadvisor-hourly`
3. Click on it and enable "Scheduled"
4. Set cron expression: `0 * * * *` (runs every hour at minute 0)

**Alternative:** Edit `supabase/config.toml`:
```toml
[[functions]]
slug = "sync-tripadvisor-hourly"

[functions.scheduling]
cron = "0 * * * *"  # Every hour
```

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│         TripAdvisor Sync System                         │
└─────────────────────────────────────────────────────────┘

1. SCHEDULED SYNC (Every Hour)
   ├─ supabase/functions/sync-tripadvisor-hourly
   ├─ Fetches: 80+ cities × 9 categories
   ├─ Rate: 300ms between requests
   └─ Output: 2,500-3,500 unique listings

2. DATA STORAGE
   ├─ nearby_listings table
   │  ├─ tripadvisor_id (unique)
   │  ├─ name, address, coordinates
   │  ├─ rating, review_count
   │  ├─ image_url (original)
   │  ├─ stored_image_path (in bucket)
   │  └─ updated_at timestamp
   └─ listing-images bucket (public)
      ├─ CDN-optimized delivery
      └─ Fallback to original URLs

3. FRONTEND DISPLAY
   ├─ ListingCard component
   ├─ imageManager utility
   ├─ Lazy loading with caching
   └─ Error handling & fallbacks

4. OPERATIONS
   ├─ Background sync service
   ├─ Vote system
   ├─ Save/favorite listings
   └─ Search & filtering
```

---

## 🖼️ Image Handling

### How Images Work

1. **Original Image URL** (from TripAdvisor)
   - Stored in `image_url` column
   - Used as fallback if download fails

2. **Stored Image Path** (in Supabase Storage)
   - Stored in `stored_image_path` column
   - Public URL via CDN
   - Preferred when available

3. **Download Process**
   - Edge function can download during sync
   - Or lazy-load on frontend via `imageManager`
   - Automatic retry on failure

### Image Download Logic

```javascript
// In ListingCard component
const imageUrl = await imageManager.getImageUrl(listing)

// Returns (in order of preference):
// 1. Stored image from bucket
// 2. Original TripAdvisor image_url
// 3. Placeholder image
```

### Batch Download Images

```javascript
// Download images for a set of listings
await imageManager.batchDownloadImages(listings, (progress) => {
  console.log(`${progress.completed}/${progress.total}`)
})
```

---

## 🔄 Sync Workflow

### Automatic Hourly Sync

Every hour at minute 0:

```
1. Edge function triggers
   ↓
2. Fetches data from TripAdvisor API
   └─ 80+ cities × 9 categories = 720+ queries
   └─ Rate limited: 300ms between requests
   ↓
3. Deduplicates by tripadvisor_id
   ↓
4. Updates database with UPSERT
   └─ Preserves existing images
   └─ Updates ratings & metadata
   ↓
5. Returns statistics
```

### Manual Sync

To trigger sync manually:

```bash
# Via Supabase CLI
supabase functions invoke sync-tripadvisor-hourly

# Via curl
curl -X POST https://your-project.supabase.co/functions/v1/sync-tripadvisor-hourly \
  -H "Authorization: Bearer $(supabase secrets get SUPABASE_SERVICE_ROLE_KEY)" \
  -H "Content-Type: application/json"

# Via your app (in browser console)
fetch('https://your-project.supabase.co/functions/v1/sync-tripadvisor-hourly', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json'
  }
}).then(r => r.json()).then(console.log)
```

---

## 🧪 Testing

### Test Edge Function Directly

```bash
supabase functions invoke sync-tripadvisor-hourly
```

### Test Image Manager

```javascript
// In browser console
import { imageManager } from './src/lib/imageManager.js'

// Get image URL for a listing
const url = await imageManager.getImageUrl(listing)
console.log('Image URL:', url)

// Check cache stats
console.log(imageManager.getCacheStats())

// Batch download images
await imageManager.batchDownloadImages(listings, (progress) => {
  console.log(`Downloaded: ${progress.completed}/${progress.total}`)
})
```

### Test Database Queries

```sql
-- Check total listings
SELECT COUNT(*) FROM nearby_listings;

-- Check listings with images
SELECT COUNT(*) FROM nearby_listings WHERE stored_image_path IS NOT NULL;

-- Check latest sync
SELECT COUNT(*), MAX(updated_at) FROM nearby_listings;

-- Search nearby
SELECT * FROM get_nearby_listings(14.5994, 120.9842, 10);

-- Full text search
SELECT * FROM search_listings('Manila Museum');
```

---

## 📈 Monitoring & Maintenance

### Check Sync Status

```sql
-- Last sync timestamp
SELECT MAX(updated_at) FROM nearby_listings;

-- Listings by source
SELECT source, COUNT(*) FROM nearby_listings GROUP BY source;

-- Listings with images
SELECT 
  COUNT(*) as total,
  COUNT(stored_image_path) as with_stored_images,
  COUNT(image_url) as with_original_urls
FROM nearby_listings;

-- Average sync freshness (hours)
SELECT 
  EXTRACT(EPOCH FROM (NOW() - MAX(updated_at))) / 3600 as hours_since_sync
FROM nearby_listings;
```

### View Edge Function Logs

1. Go to Supabase Dashboard → Edge Functions
2. Click `sync-tripadvisor-hourly`
3. View "Invocations" tab
4. Check logs for each run

### Performance Optimization

```sql
-- Analyze table
ANALYZE nearby_listings;

-- Vacuum to clean up
VACUUM FULL nearby_listings;

-- Check index usage
SELECT * FROM pg_stat_user_indexes WHERE relname = 'nearby_listings';
```

---

## 🐛 Troubleshooting

### Issue: Edge Function Returns Error

**Check logs:**
```bash
supabase functions logs sync-tripadvisor-hourly
```

**Common causes:**
- Missing environment variables → Set in Supabase Project Settings
- TripAdvisor API key invalid → Get new key or use mock data
- Database connection issue → Check service role key

### Issue: Images Not Displaying

**Check database:**
```sql
SELECT COUNT(*) FROM nearby_listings WHERE image_url IS NOT NULL;
SELECT COUNT(*) FROM nearby_listings WHERE stored_image_path IS NOT NULL;
```

**Check storage bucket:**
- Supabase Dashboard → Storage → listing-images
- Verify bucket exists and is public

**Check imageManager:**
```javascript
// In browser console
const url = await imageManager.getImageUrl(listing)
console.log('URL:', url)
```

### Issue: Sync Running Too Slowly

**Optimize:**
1. Reduce number of cities in edge function
2. Increase rate limit (change 300 to 200ms)
3. Reduce categories per city
4. Run during off-peak hours

### Issue: High Database Usage

**Solutions:**
1. Reduce sync frequency (change cron to every 12 hours)
2. Compress old listings (archive if older than X days)
3. Remove duplicate entries:

```sql
DELETE FROM nearby_listings a
WHERE a.ctid::text > (
  SELECT b.ctid::text
  FROM nearby_listings b
  WHERE a.tripadvisor_id = b.tripadvisor_id
  LIMIT 1
);
```

---

## 📱 Frontend Integration

### Using ListingCard Component

```jsx
import ListingCard from './ListingCard'

function MyComponent() {
  return (
    <ListingCard
      listing={listing}
      onSave={(listing) => saveListing(listing)}
      onView={(listing) => viewDetails(listing)}
      onVote={(id, vote) => handleVote(id, vote)}
      isSaved={false}
      isAuthenticated={true}
      voteCounts={{ thumbsUp: 5, thumbsDown: 1 }}
      userVote="up"
    />
  )
}
```

### Using imageManager

```jsx
import { imageManager } from './lib/imageManager'

async function downloadListing Images(listings) {
  await imageManager.batchDownloadImages(listings, (progress) => {
    setDownloadProgress(progress.percentage)
  })
}

async function getListingImageUrl(listing) {
  return await imageManager.getImageUrl(listing)
}
```

---

## 🔐 Security Considerations

### API Keys
- ✅ Service role key only used in edge functions
- ✅ Anon key for frontend operations
- ✅ Never expose service role key in client code

### Storage
- ✅ listing-images bucket is public (for images only)
- ✅ No sensitive data in storage
- ✅ Signed URLs can be generated for time-limited access

### Database
- ✅ RLS policies protect user-specific data
- ✅ Public listings readable by anyone
- ✅ Votes and favorites isolated by user

---

## 📝 File Structure

```
supabase/
├── functions/
│   └── sync-tripadvisor-hourly/
│       ├── index.ts (main function)
│       └── deno.json (dependencies)
├── migrations/
│   └── add_image_support.sql (database schema)
└── config.toml (cron scheduling)

src/
├── components/
│   ├── Nearby.jsx (main component - UPDATED)
│   ├── ListingCard.jsx (NEW - reusable card)
│   └── ... other components
├── lib/
│   ├── imageManager.js (NEW - image handling)
│   ├── tripadvisorSync.js (existing)
│   └── ... other utilities
└── styles/

scripts/
└── setup-image-storage.js (NEW - bucket setup)
```

---

## ✅ Verification Checklist

- [ ] Database migration applied
- [ ] Storage bucket created
- [ ] Edge function deployed
- [ ] Cron scheduling enabled
- [ ] Environment variables set
- [ ] Edge function tested manually
- [ ] Images displaying in UI
- [ ] Hourly sync running
- [ ] Database growing with new listings
- [ ] Performance monitoring in place

---

## 🚀 Next Steps

1. **Complete the setup** following steps above
2. **Monitor the first sync** for any errors
3. **Adjust settings** based on your needs:
   - Sync frequency (hourly, every 12 hours, daily)
   - Number of cities/categories
   - Image storage strategy
4. **Implement notifications** when sync completes
5. **Add analytics** to track listing growth

---

## 📞 Support

If you encounter issues:

1. Check the logs: `supabase functions logs sync-tripadvisor-hourly`
2. Review database: `SELECT * FROM nearby_listings LIMIT 1;`
3. Test manually: `curl -X POST https://your-project.supabase.co/functions/v1/sync-tripadvisor-hourly`

For detailed setup help, refer to:
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [PostgreSQL Full Text Search](https://www.postgresql.org/docs/current/textsearch.html)

---

**Setup completed! Your TripAdvisor listings will now sync automatically every hour with images stored and displayed beautifully. 🎉**
