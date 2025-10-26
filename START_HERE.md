# ⚡ Quick Start: Import TripAdvisor Photos

## What You'll Get
- 📸 All TripAdvisor photos for every listing automatically downloaded
- 💾 Photos stored in your Supabase bucket (`nearby_listings`)
- 📊 Database updated with photo URLs ready to use

## 3 Steps (5 minutes)

### Step 1: Update Your Database
Go to [Supabase Dashboard](https://app.supabase.com) → SQL Editor → New Query

Copy this entire SQL block and paste it:

```sql
-- Add image_urls column to nearby_listings table
ALTER TABLE nearby_listings 
ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

-- Add primary_image_url for quick access
ALTER TABLE nearby_listings 
ADD COLUMN IF NOT EXISTS primary_image_url TEXT;

-- Create index for image queries
CREATE INDEX IF NOT EXISTS idx_nearby_listings_has_images ON nearby_listings(image_urls) WHERE image_urls IS NOT NULL AND array_length(image_urls, 1) > 0;

-- Update trigger for updated_at timestamp
DROP TRIGGER IF EXISTS update_nearby_listings_timestamp ON nearby_listings;

CREATE OR REPLACE FUNCTION update_nearby_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_nearby_listings_timestamp
  BEFORE UPDATE ON nearby_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_nearby_listings_updated_at();
```

Click **Run** ✓

### Step 2: Create Storage Bucket
Still in Supabase Dashboard:
1. Go to **Storage** (left sidebar)
2. Click **+ New bucket**
3. Name: `nearby_listings`
4. **Uncheck** "Private bucket" (make it public)
5. Click **Create bucket** ✓

### Step 3: Run the Import
In your terminal:

```bash
npm run import-photos
```

That's it! ⏳ Let it run (30-60 minutes depending on listings)

You'll see progress like this:
```
[0.0%] (1/100) Processing: Intramuros, Manila
[✓] Found 10 images for "Intramuros, Manila"
[✓] Uploaded image 1/10 for "Intramuros, Manila"
...
[100%] Import completed!
  Total listings: 100
  Successful: 98
  Failed: 2
  Total images uploaded: 876
```

## After Import Completes

### Verify It Worked
Run this in Supabase SQL Editor:

```sql
SELECT name, array_length(image_urls, 1) as photo_count
FROM nearby_listings
WHERE image_urls IS NOT NULL AND array_length(image_urls, 1) > 0
LIMIT 5;
```

Should show listings with photo counts like: `Intramuros, Manila | 10`

### Use in Your App
In your React components:

```javascript
// Single thumbnail
<img src={listing.primary_image_url} alt={listing.name} />

// All images gallery
{listing.image_urls?.map((url, i) => (
  <img key={i} src={url} alt={`${listing.name} ${i+1}`} />
))}
```

## Troubleshooting

### "npm: command not found"
Install Node.js from https://nodejs.org/ first

### "Missing VITE_PROJECT_URL"
Your environment variables aren't set. They should be automatically available, but if not:

```bash
# These should already be in your env:
echo $VITE_PROJECT_URL
echo $VITE_SUPABASE_SERVICE_ROLE_KEY
echo $VITE_TRIPADVISOR
```

### "No images found" warnings
Normal! Some listings don't have photos on TripAdvisor. Script continues safely.

### "Upload failed" errors
Check that:
1. Bucket `nearby_listings` exists (and is public)
2. You're not over storage quota (free tier = 1GB)

## Upgrade for More Storage?
Free tier: 1 GB (good for ~100-200 listings)
Pro tier: 100 GB ($50/month, no commitment)

## Full Documentation
- **Complete Guide**: Read `IMPORT_PHOTOS_GUIDE.md` for advanced options
- **Technical Summary**: See `PHOTO_IMPORT_SUMMARY.md` for architecture

## Need Help?
1. Check the full guide: `IMPORT_PHOTOS_GUIDE.md`
2. Run the test:
   ```bash
   # Edit scripts/import-photos.js line ~170
   # Change: .limit(999999)  →  .limit(1)
   # Then run: npm run import-photos
   ```

---

**Time to complete**: 45-60 minutes  
**Cost**: FREE (using free Supabase tier)  
**Next**: Commit this, then use photos in your UI!
