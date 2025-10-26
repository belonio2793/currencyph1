# TripAdvisor Photo Import Guide

This guide will help you import all photos from TripAdvisor for your nearby listings and save them to your Supabase bucket.

## Quick Start (5 minutes)

### Step 1: Run the Database Migration

First, you need to add the image storage columns to your database:

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project: `corcofbmafdxehvlbesx`
3. Go to **SQL Editor**
4. Click "New Query"
5. Copy and paste the contents of `supabase/migrations/add_image_urls_to_listings.sql`
6. Click **Run** to execute the migration

This adds:
- `image_urls` column (array of URLs)
- `primary_image_url` column (for quick thumbnail access)
- Auto-update timestamps

### Step 2: Create the Supabase Storage Bucket

1. In the Supabase dashboard, go to **Storage**
2. Click **+ New bucket**
3. Name it: `nearby_listings`
4. Uncheck "Private bucket" to make it public
5. Click **Create bucket**

### Step 3: Set Up the Storage Bucket Policies

In the **Storage** section, click on the `nearby_listings` bucket:

1. Click **Policies** tab
2. Create the following policies:
   - **Allow public read access**: 
     ```
     (true)
     ```
   - **Allow authenticated users to upload**:
     ```
     (auth.role() = 'authenticated')
     ```

### Step 4: Run the Photo Import Script

Choose one of the methods below:

#### Method A: Using Node.js (Recommended)

```bash
# Install dependencies (if not already installed)
npm install

# Run the photo import script
npm run import-photos
```

Or directly with Node:

```bash
node scripts/import-photos.js
```

#### Method B: Using Bash Script

```bash
# Make the script executable
chmod +x scripts/import-tripadvisor-photos.sh

# Run the script
./scripts/import-tripadvisor-photos.sh
```

## What Happens During Import

The script will:

1. **Fetch all listings** from your `nearby_listings` table
2. **Search TripAdvisor** for each listing using:
   - TripAdvisor API (if `TRIPADVISOR_KEY` is available)
   - Web scraping fallback (if API fails)
3. **Download images** from TripAdvisor's CDN
4. **Upload to Supabase** Storage bucket
5. **Update database** with image URLs

## Progress Tracking

The script shows real-time progress:

```
[0.0%] (1/100) Processing: Intramuros, Manila
[✓] Found 10 images for "Intramuros, Manila"
[✓] Uploaded image 1/10 for "Intramuros, Manila"
[✓] Uploaded image 2/10 for "Intramuros, Manila"
...
[100%] Import completed!
  Total listings: 100
  Successful: 98
  Failed: 2
  Total images uploaded: 876
```

## Troubleshooting

### "Missing PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY"

Your environment variables aren't set. Make sure these are available:

```bash
export VITE_PROJECT_URL=https://corcofbmafdxehvlbesx.supabase.co
export VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
export VITE_TRIPADVISOR=your-tripadvisor-api-key  # Optional
```

Or set them in your `.env` file:

```
VITE_PROJECT_URL=https://corcofbmafdxehvlbesx.supabase.co
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
VITE_TRIPADVISOR=451510296B...
```

### "No images found for..."

Some listings may not have images available on TripAdvisor. The script logs these as warnings but continues processing other listings.

### "Upload failed" errors

Common causes:
- **Storage bucket doesn't exist**: Create `nearby_listings` bucket in Supabase
- **No write permissions**: Check bucket policies allow authenticated uploads
- **Quota exceeded**: Supabase free tier has storage limits (1GB)

### Script hangs or times out

The script has built-in timeouts:
- Download timeout: 15 seconds per image
- Request timeout: 10 seconds per API call
- Rate limiting: 2-second delay between listings

If it still times out, you can:
1. **Reduce batch size**: Edit `BATCH_DELAY` in the script
2. **Run in batches**: Filter listings by category or city

## Advanced Usage

### Import photos for specific listings

Edit the Node.js script to filter listings:

```javascript
// In scripts/import-photos.js, modify the fetchListings function:
const { data, error } = await supabase
  .from('nearby_listings')
  .select('id, tripadvisor_id, name, category')
  .eq('category', 'Church')  // Only churches
  .order('id', { ascending: true })
```

### Adjust image quality and count

Edit these constants in the script:

```javascript
const MAX_IMAGES_PER_LISTING = 10  // Change to 5 or 15
const DOWNLOAD_TIMEOUT = 15000      // Change to 20000 for slower connections
const BATCH_DELAY = 2000            // Change to 5000 for more rate limiting
```

### Manual cleanup

If you need to reset and re-import:

```sql
-- Delete all image URLs (keeps listing data)
UPDATE nearby_listings 
SET image_urls = '{}', primary_image_url = NULL;

-- Or delete specific bucket files
-- Navigate to Storage in Supabase, select nearby_listings bucket, and delete manually
```

## Performance Notes

- **First time import**: 100 listings with 10 images each = ~1000 files uploaded
- **Estimated time**: 30-60 minutes (depends on TripAdvisor response times)
- **Bandwidth**: ~500MB-1GB (depends on image sizes)
- **Storage used**: Supabase free tier includes 1GB

## Testing with a Single Listing

To test the script before full import:

```bash
# Temporary edit the Node.js script to test with 1 listing:
# Change fetchListings() to:
const listings = await supabase
  .from('nearby_listings')
  .select('id, tripadvisor_id, name, category')
  .limit(1)  // Only fetch 1 listing
  .order('id', { ascending: true })

# Then run:
node scripts/import-photos.js
```

## Next Steps

After photos are imported:

1. **Verify in database**:
   ```sql
   SELECT id, name, image_urls, array_length(image_urls, 1) as photo_count
   FROM nearby_listings
   WHERE image_urls IS NOT NULL AND array_length(image_urls, 1) > 0
   LIMIT 10;
   ```

2. **Update your frontend** to use the new `image_urls`:
   ```javascript
   // In your React components
   const imageUrl = listing.image_urls?.[0] || listing.primary_image_url
   const allImages = listing.image_urls || []
   ```

3. **Create a gallery component** to show all imported photos

## Support

If you encounter issues:

1. Check the logs:
   - Node.js: Console output directly
   - Bash: Check `import-photos-*.log` file

2. Verify Supabase setup:
   - [Supabase Documentation](https://supabase.com/docs)
   - Check bucket exists and is public
   - Check storage policies

3. TripAdvisor API:
   - Verify API key is valid
   - Check quota hasn't been exceeded
   - See [TripAdvisor API Docs](https://tripadvisor-content-api.readme.io/)

## FAQ

**Q: Why are some listings not getting images?**
A: TripAdvisor may not have photos for all listings, or they may be behind a paywall. The script skips these safely.

**Q: Can I run this multiple times?**
A: Yes! The script uses `upsert`, so running it again will update listings with new/additional photos.

**Q: How do I use the photos in my app?**
A: The `image_urls` column is an array. Use the first image as thumbnail: `listing.image_urls[0]`

**Q: Can I schedule this to run automatically?**
A: Yes! You can create a cron job:
   ```bash
   # Add to crontab to run weekly
   0 2 * * 0 cd /path/to/project && npm run import-photos
   ```

**Q: What if my Supabase bucket runs out of space?**
A: Upgrade your plan or implement image cleanup: delete old images or resize before upload.

---

**Created**: 2024
**Last Updated**: 2024
