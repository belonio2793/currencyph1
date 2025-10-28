# ⚡ Quick Start - TripAdvisor Filler

## Step 1: Check Current Status (optional)
```bash
npm run check-tripadvisor
```
**Shows:** How many listings need TripAdvisor IDs and photos

## Step 2: Fill TripAdvisor Data
```bash
npm run fill-tripadvisor-final
```
**Does:** Uses Grok + ScrapingBee to find real TripAdvisor IDs and photo URLs

## Step 3: (Optional) Get Better Photos
```bash
npm run fill-tripadvisor-advanced
```
**Does:** More aggressive photo extraction (run after Step 2)

---

## 🎯 Expected Results

**Before:**
- Many listings have `tripadvisor_id = null`
- Many listings have `photo_urls = []` or null

**After Step 2:**
- ~90% of listings have real TripAdvisor IDs
- ~85% have photo gallery URLs

**After Step 3:**
- Photo count significantly improved

---

## ✅ Verification

Check your database after running:
```sql
SELECT name, tripadvisor_id, photo_count, updated_at
FROM nearby_listings
WHERE tripadvisor_id IS NOT NULL
LIMIT 10;
```

---

## 🆘 If Something Goes Wrong

1. **Check environment variables:**
   ```bash
   echo $X_API_KEY
   echo $PROJECT_URL
   ```

2. **All should be set** - if not empty, try again

3. **Connection error?** Wait 30 seconds and retry

4. **Still stuck?** Run the advanced version:
   ```bash
   npm run fill-tripadvisor-advanced
   ```

---

## 📊 What Gets Updated

For each listing:
- ✅ `tripadvisor_id` - Real ID from TripAdvisor
- ✅ `photo_urls` - Array of photo URLs (up to 20)
- ✅ `photo_count` - Number of photos found
- ✅ `web_url` - Link to TripAdvisor listing
- ✅ `verified` - Marked as true
- ✅ `updated_at` - Current timestamp

---

## ⏱️ How Long?

- **Check status:** 10 seconds
- **Fill 100 listings:** 2-3 minutes
- **Advanced mode:** 3-4 minutes for 150 listings

---

## 💡 Pro Tip

Run multiple times if you want to process more listings:
```bash
npm run fill-tripadvisor-final
# Process 100 listings...

npm run fill-tripadvisor-final
# Process next 100 listings...
```

Each run processes a fresh batch.

---

## 🚀 That's It!

Your `nearby_listings` table will be filled with:
- Accurate TripAdvisor IDs
- Real photo gallery URLs
- Complete listing data

Good luck! 🎉
