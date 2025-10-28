# 🖼️ Download TripAdvisor Images to Supabase Storage

Complete guide to download all TripAdvisor images from your nearby_listings and store them in Supabase storage bucket.

---

## 📋 What This Does

✅ Downloads images from all photo URLs in nearby_listings  
✅ Stores them in your Supabase `nearby_listings` storage bucket  
✅ Updates database with storage paths  
✅ Handles large batches efficiently  
✅ Runs as a Supabase Edge Function (serverless)  

---

## 🚀 Quick Start

### Prerequisites
Verify you have:
1. ✅ Supabase project configured
2. ✅ `nearby_listings` storage bucket created (auto-created by Edge Function)
3. ✅ `photo_urls` populated in nearby_listings table
4. ✅ Supabase Edge Function deployed

### Step 1: Deploy Edge Function

First, deploy the Edge Function to Supabase:

```bash
supabase functions deploy download-tripadvisor-images
```

Or push to Supabase via CLI:
```bash
supabase push
```

### Step 2: Run the Downloader

Once deployed, trigger it:

```bash
npm run download-images
```

Or with options:
```bash
LIMIT=50 npm run download-images
LIMIT=30 CITY="Manila" npm run download-images
```

---

## 📊 What Gets Stored

### Storage Bucket Structure
```
nearby_listings/
├── listings/
│   ├── 1/
│   │   ├── 1704067200000-photo-1.jpg
│   │   ├── 1704067201000-photo-2.jpg
│   │   └── 1704067202000-photo-3.jpg
│   ├── 2/
│   │   ├── 1704067203000-photo-1.jpg
│   │   └── 1704067204000-photo-2.jpg
│   └── ...
```

### Database Updates

For each listing, the `stored_image_paths` column is updated:

```json
{
  "id": 1,
  "name": "National Museum",
  "photo_urls": [
    "https://dynamic-media-cdn.tripadvisor.com/media/photo-a/01/2a/...",
    "https://dynamic-media-cdn.tripadvisor.com/media/photo-a/01/2b/..."
  ],
  "stored_image_paths": [
    "listings/1/1704067200000-photo-1.jpg",
    "listings/1/1704067201000-photo-2.jpg"
  ],
  "image_downloaded_at": "2024-01-15T10:30:00Z"
}
```

---

## ⚙️ Configuration

### Environment Variables (Auto-configured)

- **VITE_PROJECT_URL** - Your Supabase project URL
- **VITE_SUPABASE_ANON_KEY** - Public API key for Edge Function

### CLI Options

```bash
LIMIT=50           # Process up to N listings (default: 20)
CITY="Manila"      # Filter by city (optional)
```

### Examples

**Small test batch:**
```bash
LIMIT=5 npm run download-images
```

**Standard batch:**
```bash
npm run download-images
```

**Large batch for specific city:**
```bash
LIMIT=100 CITY="Manila" npm run download-images
```

---

## 📈 Performance

| Batch | Time | Storage | Notes |
|-------|------|---------|-------|
| 5 listings | 1-2 min | ~5-10 MB | Quick test |
| 20 listings | 4-6 min | ~20-40 MB | Standard |
| 50 listings | 10-15 min | ~50-100 MB | Recommended |
| 100 listings | 20-30 min | ~100-200 MB | Large batch |

**Per image:**
- Average size: ~200-500 KB
- Download time: ~0.5-2 seconds
- Upload to storage: ~0.5-1 second

---

## 🎯 Sample Output

```
================================================================================
🖼️  TRIGGER: Download TripAdvisor Images to Supabase Storage
================================================================================

📍 Function: https://yourproject.supabase.co/functions/v1/download-tripadvisor-images
📊 Limit: 20 listings
🚀 Sending request to Edge Function...

================================================================================
📊 RESULTS

  ✅ Success!

  📦 Listings processed: 20
  ✅ Images downloaded: 342
  ❌ Images failed: 8
  📈 Success rate: 97.7%

  📍 Sample results (first 5):

    1. National Museum (Manila)
       ✅ 18 | ❌ 0
    2. Rizal Park (Manila)
       ✅ 22 | ❌ 0
    3. Intramuros (Manila)
       ✅ 15 | ❌ 2
    4. Fort Santiago (Manila)
       ✅ 19 | ❌ 0
    5. Chinese Cemetery (Manila)
       ✅ 17 | ❌ 1

================================================================================
```

---

## 🔍 How It Works

### Flow Diagram

```
┌────────────────────────────────────┐
│ nearby_listings table              │
│ (id, name, photo_urls)             │
└────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│ Supabase Edge Function             │
│ download-tripadvisor-images        │
└────────────────────────────────────┘
             │
      ┌──────┴──────┐
      ▼             ▼
  FOR EACH      DOWNLOAD
  LISTING       IMAGE FROM
    │         PHOTO_URL
    │             │
    │         ┌───┴────┐
    │         ▼        ▼
    │       SUCCESS  TIMEOUT/ERROR
    │         │         │
    │         ▼         ▼
    │    GENERATE    MARK FAILED
    │    PATH NAME      │
    │         │         │
    │    UPLOAD TO  ┌───┘
    │    STORAGE │
    │         │
    ▼────────┴──────────▼
┌──────────────────────────┐
│ nearby_listings bucket   │
│ listings/{id}/photos...  │
└──────────────────────────┘
        │
        ▼
┌──────────────────────────────┐
│ Update DB with paths         │
│ stored_image_paths: [...]    │
│ image_downloaded_at: now     │
└──────────────────────────────┘
```

### Process Details

1. **Fetch Listings** - Get listings with photo_urls from database
2. **For Each Listing** - Iterate through configured limit
3. **Download Photos** - Fetch each photo URL with timeout & retry
4. **Validate** - Check file size > 0
5. **Store** - Upload to Supabase storage bucket
6. **Update DB** - Record paths and timestamp
7. **Rate Limit** - 300ms between downloads to be respectful

---

## 🛠️ Using Downloaded Images in Your App

### Get public URLs for downloaded images

```javascript
// Get a listing with downloaded images
const { data: listing } = await supabase
  .from('nearby_listings')
  .select('*')
  .eq('id', 1)
  .single();

// Get public URLs for stored images
if (listing.stored_image_paths) {
  const imageUrls = listing.stored_image_paths.map(path => {
    const { data } = supabase.storage
      .from('nearby_listings')
      .getPublicUrl(path);
    return data.publicUrl;
  });

  console.log('Stored images:', imageUrls);
}
```

### Display stored images

```jsx
{listing.stored_image_paths?.map((path, i) => {
  const { data } = supabase.storage
    .from('nearby_listings')
    .getPublicUrl(path);
  
  return (
    <img
      key={i}
      src={data.publicUrl}
      alt={`Photo ${i + 1}`}
    />
  );
})}
```

---

## 📁 File Structure

### Edge Function Files
```
supabase/functions/download-tripadvisor-images/
├── index.ts          # Main function logic
└── deno.json         # Dependencies
```

### Trigger Script
```
scripts/trigger-image-downloader.js
```

---

## 🔐 Security

✅ Uses service role key for database access  
✅ Images stored in authenticated bucket  
✅ Public URLs can be generated on-demand  
✅ Rate-limited to respect TripAdvisor  
✅ Timeout protections on downloads  

---

## ⚠️ Limits & Quotas

### Supabase Storage

- **Free tier**: 1 GB storage
- **Pro tier**: 100 GB storage
- **Enterprise**: Custom limits

### Bandwidth

- Downloads from TripAdvisor: ✅ Unlimited
- Serving from Supabase: Subject to tier limits

### Concurrent Downloads

- Edge Function: Can process multiple listings
- Per-image: Sequential with 300ms delays

---

## 🔧 Troubleshooting

### Issue: Edge Function not found

**Solution:**
```bash
supabase functions deploy download-tripadvisor-images
```

### Issue: No images downloaded

Check:
1. nearby_listings has photo_urls populated
2. photo_urls are valid HTTP URLs
3. TripAdvisor images are publicly accessible
4. Storage bucket exists

### Issue: Storage bucket not found

The function creates it automatically. If missing:
```bash
# In Supabase dashboard:
# Storage > Create bucket > Name: nearby_listings > Public
```

### Issue: Slow downloads

Normal for large batches. This is due to:
- Network latency
- Image size (100-500 KB each)
- Rate limiting (300ms between requests)

---

## 📊 Monitoring

### Check storage usage

```javascript
// In Supabase dashboard
Storage > nearby_listings > Check usage
```

### Check database updates

```sql
-- In SQL Editor
SELECT 
  id, name, city,
  array_length(photo_urls, 1) as photo_count,
  array_length(stored_image_paths, 1) as stored_count,
  image_downloaded_at
FROM nearby_listings
WHERE stored_image_paths IS NOT NULL
ORDER BY image_downloaded_at DESC
LIMIT 10;
```

---

## 🎓 Advanced Usage

### Resume interrupted downloads

Simply run again - the function checks what's already stored:
```bash
npm run download-images
```

### Download images for specific city

```bash
LIMIT=100 CITY="Cebu" npm run download-images
```

### Manual Edge Function invocation

```bash
curl -X POST https://yourproject.supabase.co/functions/v1/download-tripadvisor-images \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit": 50, "city": "Manila"}'
```

---

## ✅ Next Steps

1. **Deploy the function:**
   ```bash
   supabase functions deploy download-tripadvisor-images
   ```

2. **Test with small batch:**
   ```bash
   LIMIT=5 npm run download-images
   ```

3. **Check results:**
   - View Supabase Storage dashboard
   - Query database for `stored_image_paths`

4. **Run full batch:**
   ```bash
   npm run download-images
   ```

5. **Use in your app:**
   - Query `stored_image_paths`
   - Generate public URLs
   - Display in UI

---

## 📞 Support

Check logs in:
- Supabase Functions > Logs
- Console output from `npm run download-images`

Good luck! 🚀🖼️
