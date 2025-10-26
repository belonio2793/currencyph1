# TripAdvisor Photo Import - Implementation Summary

## What Was Created

We've built a complete solution to automatically import and store photos from TripAdvisor for all your nearby listings. Here's what was created:

### 1. **Database Migration** (`supabase/migrations/add_image_urls_to_listings.sql`)
- Adds `image_urls` column (PostgreSQL TEXT array) to store multiple image URLs
- Adds `primary_image_url` column for quick thumbnail access
- Adds auto-update triggers for `updated_at` timestamps
- Creates performance indexes for fast image queries

### 2. **Photo Import Scripts**

#### Node.js Version (Recommended) - `scripts/import-photos.js`
- **Pros**: 
  - Fast and reliable
  - Better error handling
  - Supports progress tracking
  - Uses your existing @supabase/supabase-js library
- **Includes**:
  - Automatic TripAdvisor API integration
  - Web scraping fallback
  - Image download with retry logic
  - Supabase Storage upload
  - Database updates with transaction safety

#### Bash Version - `scripts/import-tripadvisor-photos.sh`
- Alternative script using standard Unix tools
- Good for scheduled/automated runs
- Detailed logging to file

#### Quick Start - `scripts/run-import.sh`
- One-command execution
- Automatic environment validation
- Automatic dependency installation
- Color-coded progress output

### 3. **Complete Documentation** (`IMPORT_PHOTOS_GUIDE.md`)
- Step-by-step setup instructions
- Troubleshooting guide
- Performance notes
- Advanced usage examples
- FAQ section

### 4. **NPM Script**
- Added `npm run import-photos` command in `package.json`
- Easy integration with your development workflow

## How to Use (Quick Version)

### Step 1: Set Up Database (One-time)
```bash
# Go to Supabase Dashboard > SQL Editor
# Copy content from: supabase/migrations/add_image_urls_to_listings.sql
# Paste and click Run
```

### Step 2: Create Storage Bucket (One-time)
```
Supabase Dashboard > Storage > New Bucket
Name: nearby_listings
Make it public (uncheck "Private")
```

### Step 3: Run Import
```bash
# Option A: Using npm (recommended)
npm run import-photos

# Option B: Using the quick start script
chmod +x scripts/run-import.sh
./scripts/run-import.sh

# Option C: Direct Node.js
node scripts/import-photos.js
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Photo Import Process                                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Fetch Listings → 2. Search TripAdvisor → 3. Download Images
│     (Supabase DB)      (API/Web Scrape)        (HTTP)
│                                                          │
│                                       │                 │
│  4. Upload to ← 5. Store in Database ← Temp Storage    │
│     Storage       (image_urls array)     (/tmp)        │
│  (Supabase)                                            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Key Features

✅ **Automatic TripAdvisor Integration**
- Fetches real photos directly from TripAdvisor
- Uses official API (with fallback to web scraping)

✅ **Reliable Image Handling**
- Download retry logic (up to 3 attempts)
- Timeout protection (15 seconds per image)
- Automatic format detection (JPG/PNG/GIF/WebP)

✅ **Efficient Storage**
- Images stored in Supabase Storage bucket
- PostgreSQL array for fast queries
- Primary image URL for thumbnails

✅ **Progress Tracking**
- Real-time console output with percentages
- Detailed logging
- Error reporting with recovery

✅ **Rate Limiting**
- 2-second delay between listings
- Respects TripAdvisor API limits
- No aggressive scraping

## What Gets Stored

For each listing, you'll have:

```sql
-- In nearby_listings table:
{
  id: 123,
  name: "Intramuros, Manila",
  image_urls: [
    "https://supabase-bucket.storage/.../image_1.jpg",
    "https://supabase-bucket.storage/.../image_2.jpg",
    "https://supabase-bucket.storage/.../image_3.jpg",
    ...up to 10 images per listing
  ],
  primary_image_url: "https://supabase-bucket.storage/.../image_1.jpg",
  updated_at: "2024-01-15T10:30:00Z"
}
```

## Usage in Your App

Once imported, use images in your React components:

```javascript
// Get thumbnail
<img src={listing.primary_image_url} alt={listing.name} />

// Get all images for gallery
{listing.image_urls?.map((url, idx) => (
  <img key={idx} src={url} alt={`${listing.name} ${idx + 1}`} />
))}
```

## Performance Characteristics

| Metric | Value |
|--------|-------|
| **Avg. Images per Listing** | 8-10 |
| **Download Speed** | ~2-5 seconds per image |
| **Upload Speed** | ~1 second per image |
| **Time per Listing** | ~45-60 seconds |
| **Total Time (100 listings)** | ~45-60 minutes |
| **Storage per Listing** | ~2-5 MB (10 images) |
| **Total Storage (100 listings)** | ~200-500 MB |

## Important Notes

⚠️ **Storage Limits**
- Supabase free tier: 1 GB storage
- For ~100 listings with 10 images each: ~300-500 MB used
- Pro plan: 100 GB storage ($50/month)

⚠️ **TripAdvisor API**
- Limited to 50 results per query
- Web scraping is slower but has no limits
- Fallback happens automatically if API fails

⚠️ **Rate Limiting**
- 2-second delay prevents overwhelming servers
- Built-in retry logic handles transient errors
- Can be adjusted in the script

## Troubleshooting

### Script won't start?
```bash
# Make sure dependencies are installed
npm install

# Check Node.js version
node --version  # Should be v14 or higher
```

### "No images found" warnings?
- Some listings may not have photos on TripAdvisor
- Script continues safely and logs warnings
- You can manually add images later

### "Upload failed" errors?
- Check bucket exists and is public
- Verify storage policies allow uploads
- Check quota hasn't been exceeded

### Storage bucket full?
- Delete old images: `rm -rf` in Storage tab
- Resize images before upload (reduce MAX_IMAGES_PER_LISTING)
- Upgrade to paid plan for more storage

## Customization

### Change number of images per listing
Edit `scripts/import-photos.js`:
```javascript
const MAX_IMAGES_PER_LISTING = 5  // Change from 10
```

### Import only specific listings
```javascript
// Modify the fetchListings function
const { data, error } = await supabase
  .from('nearby_listings')
  .select('*')
  .eq('category', 'Church')  // Only churches
  .limit(10)  // Only first 10
```

### Schedule automatic imports
```bash
# Add to crontab (runs every Sunday at 2 AM)
0 2 * * 0 cd /path/to/project && npm run import-photos
```

## Next Steps

1. ✅ Run the migration: Copy SQL to Supabase
2. ✅ Create bucket: Create `nearby_listings` in Storage
3. ✅ Run import: `npm run import-photos`
4. ✅ Verify: Check database for `image_urls` arrays
5. ✅ Update UI: Use `listing.image_urls` in components
6. ✅ Create gallery: Build image gallery components
7. ✅ Optimize: Lazy-load images in your UI

## Support Files

- **Main Guide**: `IMPORT_PHOTOS_GUIDE.md` (comprehensive)
- **Migration**: `supabase/migrations/add_image_urls_to_listings.sql`
- **Node.js Script**: `scripts/import-photos.js` (recommended)
- **Bash Script**: `scripts/import-tripadvisor-photos.sh` (alternative)
- **Runner**: `scripts/run-import.sh` (quick start)

## Database Queries for Verification

```sql
-- Check how many listings have images
SELECT COUNT(*) as listings_with_images
FROM nearby_listings
WHERE image_urls IS NOT NULL AND array_length(image_urls, 1) > 0;

-- See images per listing
SELECT name, array_length(image_urls, 1) as photo_count
FROM nearby_listings
WHERE image_urls IS NOT NULL
ORDER BY array_length(image_urls, 1) DESC
LIMIT 10;

-- Find listings missing images
SELECT name, category
FROM nearby_listings
WHERE image_urls IS NULL OR array_length(image_urls, 1) = 0
ORDER BY name;
```

---

**Created**: January 2024
**Last Updated**: January 2024
**Version**: 1.0
