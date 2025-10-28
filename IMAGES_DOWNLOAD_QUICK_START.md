# 🖼️ Download TripAdvisor Images - Quick Start

## 📋 Three Steps

### Step 1: Deploy Edge Function
```bash
supabase functions deploy download-tripadvisor-images
```

### Step 2: Run Downloader
```bash
npm run download-images
```

### Step 3: Check Results
Images are now in Supabase storage bucket at:
```
nearby_listings/listings/{id}/{timestamp}-photo-N.jpg
```

---

## 🎯 Common Commands

**Test with 5 listings:**
```bash
LIMIT=5 npm run download-images
```

**Standard batch (20):**
```bash
npm run download-images
```

**Large batch (100):**
```bash
LIMIT=100 npm run download-images
```

**Specific city:**
```bash
LIMIT=50 CITY="Manila" npm run download-images
```

---

## ���� Expected Results

- **5 listings**: 1-2 min, ~10-25 MB
- **20 listings**: 4-6 min, ~40-100 MB
- **50 listings**: 10-15 min, ~100-250 MB
- **100 listings**: 20-30 min, ~200-500 MB

---

## 🗄️ Storage Bucket

**Name:** `nearby_listings`  
**Structure:**
```
listings/
├── 1/photo-1.jpg
├── 1/photo-2.jpg
├── 2/photo-1.jpg
└── ...
```

---

## 🖥️ Use in Your App

```javascript
// Get listing with downloaded images
const { data: listing } = await supabase
  .from('nearby_listings')
  .select('*')
  .eq('id', 1)
  .single();

// Get public image URLs
const imageUrls = listing.stored_image_paths?.map(path => {
  const { data } = supabase.storage
    .from('nearby_listings')
    .getPublicUrl(path);
  return data.publicUrl;
}) || [];

// Display
<img src={imageUrls[0]} alt="Listing" />
```

---

## 🚀 Status

- ✅ Edge Function created
- ✅ Trigger script created  
- ✅ NPM command added
- ⏭️ Ready to deploy!

---

## Next: Deploy

```bash
supabase functions deploy download-tripadvisor-images
npm run download-images
```

Done! 🎉
