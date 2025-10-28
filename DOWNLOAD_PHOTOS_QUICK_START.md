# Download TripAdvisor Photos - Quick Start

## What This Does

Downloads photos **directly from TripAdvisor** and stores them in your Supabase storage bucket.

✅ Real photos (not URLs)  
✅ Stored in your bucket  
✅ Always accessible  
✅ Organized by listing ID  

## One-Minute Start

### Step 1: Run the Script

```bash
# Make script executable
chmod +x download-tripadvisor-photos.sh

# Run it
./download-tripadvisor-photos.sh
```

**That's it!** It will:
- Download photos from first 10 listings
- Upload to Supabase storage
- Update your database

### Step 2: Check Results

```bash
# Check how many photos were stored
curl -X GET "https://[YOUR_DB_URL]/rest/v1/nearby_listings?select=id,name,photo_count&order=updated_at.desc&limit=10" \
  -H "Authorization: Bearer [YOUR_KEY]"

# Or use SQL
SELECT id, name, photo_count 
FROM nearby_listings 
WHERE photo_urls IS NOT NULL 
ORDER BY updated_at DESC LIMIT 10;
```

## Usage Examples

### Process More Listings

```bash
# Next 50 listings
./download-tripadvisor-photos.sh 50

# Next 100 listings
./download-tripadvisor-photos.sh 50 100

# Resume from specific point (e.g., after ID 1000)
./download-tripadvisor-photos.sh 50 5000 1000
```

### Using npm

```bash
yarn download-photos --batch=50
# or
npm run download-photos -- --batch=50 --limit=100
```

## Expected Output

```
======================================================
  Download & Store TripAdvisor Photos
======================================================

Configuration:
  Batch size: 10
  Limit: 999999
  Start offset: 0

✓ Node.js found: v18.x.x

Starting download process...

--- Batch: offset=0, limit=10 ---
Found 10 listings

[ID: 1234] Ruth's Chris Steak House (Manila)
  Fetching TripAdvisor page...
  ✓ Page fetched
  Extracting photo URLs...
  ✓ Found 8 photos
    [1/8] Downloading...
      ✓ Downloaded, uploading...
      ✓ Uploaded
    [2/8] Downloading...
      ✓ Downloaded, uploading...
      ✓ Uploaded
    ... (remaining photos)
  Updating database with 8 URLs...
  ✓ Successfully stored 8 photos

[ID: 1235] Manila Ocean Park (Manila)
  ... similar output ...

=== RESULTS ===
Processed: 10
Success: 8
Failed: 2
Success rate: 80.0%

✓ Download process completed
```

## Timing

| Size | Time |
|------|------|
| 10 photos | 5-10 min |
| 50 photos | 25-50 min |
| 100 photos | 50-100 min |

Each photo takes ~30-60 seconds (download + upload).

## Database Update

**Before:**
```
id  | name | photo_urls | photo_count
----+------+------------+-------------
123 | Ruth's Chris | NULL | NULL
```

**After:**
```
id  | name | photo_urls | photo_count
----+------+----------+-------------
123 | Ruth's | [3 storage URLs] | 3
```

## Where Photos Are Stored

In Supabase storage bucket: `nearby_listings/photos/{listing_id}/`

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

## API Keys Required

Already set up:
- ✅ `VITE_PROJECT_URL`
- ✅ `VITE_SUPABASE_SERVICE_ROLE_KEY`

## Troubleshooting

### "curl: command not found"
Install curl:
```bash
# macOS
brew install curl

# Ubuntu/Debian
sudo apt-get install curl

# Windows
# Download from https://curl.se/download.html
```

### "Permission denied"
```bash
chmod +x download-tripadvisor-photos.sh
./download-tripadvisor-photos.sh
```

### Script stops partway through
Resume from last successful ID:

```sql
SELECT MAX(id) FROM nearby_listings 
WHERE photo_urls IS NOT NULL;
-- Returns: 2500

-- Resume:
```

```bash
./download-tripadvisor-photos.sh 50 5000 2500
```

### Photos not downloading
- Check TripAdvisor URL is valid (manually visit it)
- Check you have internet connection
- Try with single listing: `node scripts/download-and-store-photos.js --batch=1 --start=<id>`

## Commands Reference

```bash
# Simple: first 10
./download-tripadvisor-photos.sh

# With batch size
./download-tripadvisor-photos.sh 50

# With batch, limit, start offset
./download-tripadvisor-photos.sh 50 200 0

# Via Node directly
node scripts/download-and-store-photos.js --batch=50 --limit=200

# Via npm
yarn download-photos -- --batch=50
```

## Check Progress

```sql
-- Count photos stored
SELECT COUNT(*) as total_with_photos
FROM nearby_listings
WHERE photo_urls IS NOT NULL;

-- Average photos per listing
SELECT AVG(array_length(photo_urls, 1)) as avg_photos
FROM nearby_listings
WHERE photo_urls IS NOT NULL;

-- Recently updated
SELECT id, name, photo_count, updated_at
FROM nearby_listings
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC;
```

## What Happens Next

Once photos are downloaded and stored:

1. ✅ Update your UI to display `photo_urls`
2. ✅ Show photo gallery in listing cards
3. ✅ Create image carousel for detail pages
4. ✅ Add photo filters to listings

## Next Step

**Run it now:**

```bash
chmod +x download-tripadvisor-photos.sh
./download-tripadvisor-photos.sh
```

Then check your database in 5-10 minutes! 🚀

---

For more details, see: `DOWNLOAD_PHOTOS_GUIDE.md`
