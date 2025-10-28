# Download & Store TripAdvisor Photos

## Overview

This solution downloads photos directly from TripAdvisor listing pages and stores them in your Supabase storage bucket. This is more reliable than URL extraction because:

✅ You control the images (no external CDN dependencies)  
✅ Consistent file storage and organization  
✅ Direct public URLs always work  
✅ Better quality control  

## Quick Start

### Option 1: Bash Script (Recommended)

```bash
# Make script executable
chmod +x download-tripadvisor-photos.sh

# Run with defaults (first 10 listings)
./download-tripadvisor-photos.sh

# Or specify: batch size, limit, start offset
./download-tripadvisor-photos.sh 50 200 0  # 50 per batch, 200 total, start at 0
```

### Option 2: Node.js Script

```bash
# Default: first 10 listings
node scripts/download-and-store-photos.js

# With options
node scripts/download-and-store-photos.js --batch=50 --limit=200 --start=0
```

### Option 3: npm Script

```bash
yarn download-photos
# or
npm run download-photos -- --batch=50
```

## What Happens

For each listing:

```
1. Fetch the TripAdvisor listing page
   ↓
2. Extract photo URLs from the HTML
   ↓
3. Download each photo image file
   ↓
4. Upload to Supabase storage bucket (nearby_listings/photos/{id}/)
   ↓
5. Get public URL for each uploaded photo
   ↓
6. Update database photo_urls column with storage URLs
   ↓
7. Update photo_count field
```

## Result

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
    "https://corcofbmafdxehvlbesx.supabase.co/storage/v1/object/public/nearby_listings/photos/1234/listing-1234-photo-1.jpg",
    "https://corcofbmafdxehvlbesx.supabase.co/storage/v1/object/public/nearby_listings/photos/1234/listing-1234-photo-2.jpg",
    "https://corcofbmafdxehvlbesx.supabase.co/storage/v1/object/public/nearby_listings/photos/1234/listing-1234-photo-3.jpg"
  ],
  "photo_count": 3
}
```

## Command Examples

### Process First 10 Listings
```bash
./download-tripadvisor-photos.sh
# or
node scripts/download-and-store-photos.js
```

### Process 50 Listings per Batch
```bash
./download-tripadvisor-photos.sh 50
# or
node scripts/download-and-store-photos.js --batch=50
```

### Process 500 Total Listings
```bash
./download-tripadvisor-photos.sh 50 500
# or
node scripts/download-and-store-photos.js --batch=50 --limit=500
```

### Resume from Specific Offset
```bash
# Check where you left off
SELECT MAX(id) FROM nearby_listings WHERE photo_urls IS NOT NULL;

# E.g., if returns 2500, resume from there
./download-tripadvisor-photos.sh 50 999999 2500
```

## Command Options

### Bash Script
```bash
./download-tripadvisor-photos.sh [BATCH] [LIMIT] [START]

BATCH = Listings per batch (default: 10)
LIMIT = Total listings to process (default: 999999)
START = Starting database offset (default: 0)

Examples:
./download-tripadvisor-photos.sh           # 10, no limit, start 0
./download-tripadvisor-photos.sh 50        # 50, no limit, start 0
./download-tripadvisor-photos.sh 50 200    # 50, limit 200, start 0
./download-tripadvisor-photos.sh 50 200 100  # 50, limit 200, start 100
```

### Node.js Script
```bash
node scripts/download-and-store-photos.js [OPTIONS]

--batch=N    Listings per batch
--limit=N    Total to process
--start=N    Starting offset

Examples:
node scripts/download-and-store-photos.js
node scripts/download-and-store-photos.js --batch=50
node scripts/download-and-store-photos.js --batch=50 --limit=200 --start=100
```

## Monitoring Progress

### Check Real-Time Updates
```sql
-- How many photos stored so far?
SELECT COUNT(*) as with_photos
FROM nearby_listings
WHERE photo_urls IS NOT NULL
AND array_length(photo_urls, 1) > 0;

-- Recently updated listings
SELECT id, name, city, photo_count, updated_at
FROM nearby_listings
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC
LIMIT 20;

-- Average photos per listing
SELECT AVG(photo_count) as avg_photos
FROM nearby_listings
WHERE photo_urls IS NOT NULL;

-- Check storage usage
SELECT COUNT(*) as total_photos
FROM nearby_listings
WHERE photo_urls IS NOT NULL;
```

## Storage Organization

Photos are organized in Supabase storage as:

```
nearby_listings/
├── photos/
│   ├── 1234/
│   │   ├── listing-1234-photo-1.jpg
│   │   ├── listing-1234-photo-2.jpg
│   │   └── listing-1234-photo-3.jpg
│   ├── 1235/
│   │   ├── listing-1235-photo-1.jpg
│   │   └── listing-1235-photo-2.jpg
│   └── ...
```

Each listing gets its own folder for easy organization.

## Performance

| Metric | Time | Notes |
|--------|------|-------|
| Per listing | 30-60 sec | Includes download + upload |
| 10 listings | 5-10 min | First batch |
| 50 listings | 25-50 min | Medium batch |
| 100 listings | 50-100 min | Large batch |

**Note:** Time varies based on:
- Photo count per listing (up to 15)
- File sizes (typically 1-5 MB per photo)
- Network speeds
- TripAdvisor page load time

## Troubleshooting

### Script Can't Find Node.js
```bash
# Install Node.js or verify path
which node
node --version
```

### Permission Denied on Bash Script
```bash
# Make it executable
chmod +x download-tripadvisor-photos.sh
```

### Supabase Storage Upload Fails
- Check bucket exists: `nearby_listings`
- Verify bucket is public (storage policies)
- Check service role key is valid
- Verify environment variables set

```bash
# Test connection
echo $VITE_PROJECT_URL
echo $VITE_SUPABASE_SERVICE_ROLE_KEY
```

### Photos Not Downloading
- Check TripAdvisor URL is accessible
- Verify page has photos (manually check URL)
- Try single listing: `--batch=1 --start=<id>`
- Check disk space for temp files (/tmp)

### Database Update Fails
- Check listing ID exists
- Verify service role key has write access
- Check database connection

## Resume Failed Batch

If the script is interrupted:

```bash
# Find last successful ID
SELECT MAX(id) FROM nearby_listings 
WHERE photo_urls IS NOT NULL AND updated_at > NOW() - INTERVAL '1 hour';

# Resume from that point
./download-tripadvisor-photos.sh 50 999999 <LAST_ID>
```

## Advantages Over URL Extraction

| Aspect | URL Extraction | Download & Store |
|--------|---|---|
| **Reliability** | Dependent on TripAdvisor CDN | Your own storage |
| **Permanence** | URLs can break | Always available |
| **Control** | External CDN | Full control |
| **Organization** | Just URLs | Organized storage |
| **Bandwidth** | Paid by TripAdvisor | Supabase free tier |
| **Performance** | Fast (no upload) | Slower (includes upload) |
| **Cost** | Free | Minimal storage cost |

## Database Schema

The script updates:

```sql
-- Column: photo_urls (TEXT[])
-- Public storage URLs for all photos

-- Column: photo_count (INTEGER)
-- Count of successfully stored photos

-- Column: updated_at (TIMESTAMP)
-- Timestamp of last update
```

## Next Steps

1. ✅ Run first batch: `./download-tripadvisor-photos.sh`
2. ✅ Monitor progress in database
3. ✅ Verify photos display in your app
4. ✅ Scale up: `./download-tripadvisor-photos.sh 50 5000`
5. ✅ Display in UI: Use photo_urls in components

## Display in Components

```jsx
function ListingPhotos({ photoUrls }) {
  return (
    <div className="photo-gallery">
      {photoUrls?.map((url, idx) => (
        <img 
          key={idx}
          src={url}
          alt={`Photo ${idx + 1}`}
          className="listing-photo"
        />
      ))}
    </div>
  )
}
```

---

**Ready to start?**

```bash
./download-tripadvisor-photos.sh
```

Or use npm:

```bash
yarn download-photos
```
