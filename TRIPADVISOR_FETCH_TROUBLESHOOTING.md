# TripAdvisor Fetch Troubleshooting

## Issue: "Failed to fetch" Error

If you see the error "Failed to fetch: TypeError: Failed to fetch" when clicking the "🔄 Fetch Philippines" button, this means the edge function endpoint is not accessible.

### Root Causes

1. **Edge function not deployed** - The function exists in your code but wasn't deployed to Supabase
2. **Local development** - Edge functions don't run locally in development by default
3. **Network/CORS issue** - The browser can't reach the Supabase endpoint
4. **Wrong environment variables** - Supabase URL or API key is incorrect

### Solutions (In Order)

#### ✅ Solution 1: Use Local Sync Script (Recommended)

Instead of the edge function, use the local Node.js script that does the same thing:

**Step 1:** Open your terminal

**Step 2:** Run:
```bash
npm run sync-tripadvisor
```

**Step 3:** Wait 5-10 minutes for the sync to complete

This script will:
- Query all Philippine cities (100+)
- Fetch all categories (attractions, museums, restaurants, etc.)
- Download images
- Store everything in your database
- Show progress as it goes

**Output Example:**
```
📍 Starting sync for 30 cities × 9 categories
Total queries: 270

[1/270] Fetching attractions in Manila Philippines... ✓ 30 items
[2/270] Fetching museums in Manila Philippines... ✓ 28 items
...
📊 Results:
  Total fetched: 8234
  Successful queries: 268
  Failed queries: 2
  Unique listings: 5842
💾 Upserting to database...
✓ Upserted 100 listings...
✅ Sync complete! Upserted 5842 listings.
```

---

#### ✅ Solution 2: Deploy Edge Function to Supabase

If you want to use the edge function approach:

**Step 1:** Install Supabase CLI
```bash
npm install -g supabase
```

**Step 2:** Deploy edge function
```bash
supabase functions deploy sync-tripadvisor-hourly
```

**Step 3:** Set up authentication in Supabase
- Go to Supabase Dashboard → Project Settings → API
- Copy your **Anon Public Key**
- Verify it's in your `.env.local` as `VITE_SUPABASE_ANON_KEY`

**Step 4:** Test from UI
- Go to `/nearby` page
- Click "🔄 Fetch Philippines"

---

#### ✅ Solution 3: Check Environment Variables

If using the edge function, verify these are set:

```bash
# Check your .env.local file contains:
VITE_PROJECT_URL=https://corcofbmafdxehvlbesx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_TRIPADVISOR=451510296B594353B4EA0CD052DA6603
```

If using the local script, verify these are set:

```bash
# For npm run sync-tripadvisor, check:
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_TRIPADVISOR=451510296B594353B4EA0CD052DA6603
VITE_PROJECT_URL=https://corcofbmafdxehvlbesx.supabase.co
```

Create `.env.local` in your project root if it doesn't exist:
```bash
touch .env.local
```

---

### Error Details

#### "Error updating slug for [listing]: [object Object]"

**What this means:** The database query succeeded but there was an error updating the slug field.

**Causes:**
- Duplicate slug (multiple listings with same name)
- Invalid characters in the listing name
- Database constraint violation

**Fix:** This is now handled better with automatic slug generation. The script should skip these gracefully.

---

### Performance Tips

**For Local Script:**
- Run during off-peak hours (the script makes ~900 API calls)
- Don't close the terminal while running
- Takes 5-10 minutes to complete
- Safe to run multiple times (uses upsert, not insert)

**For Edge Function:**
- Schedule to run once per 24 hours (free TripAdvisor API has limits)
- Set up in Supabase Dashboard → Database → Cron Jobs
- Monitor logs in Supabase Dashboard → Edge Functions → Logs

---

### Verify It Worked

**In Supabase Dashboard:**

1. Go to **Table Editor → nearby_listings**
2. Check row count increased (should see 3000-10000+ rows)
3. Sample a few rows - check fields are populated:
   - `name` ✓
   - `rating` ✓
   - `address` ✓
   - `slug` ✓
   - `category` ✓

**In Your App:**

1. Go to `/nearby` page
2. You should see:
   - "Listings in [city]" updates when clicking cities
   - Cards display with images
   - Search results working
   - Stats showing total listings, cities, categories

---

### Still Having Issues?

#### Slug errors persist
These are usually harmless - they happen when there are duplicate names. The script will continue despite them.

#### No listings appear after sync
1. Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Check database has data: `SELECT COUNT(*) FROM nearby_listings`
3. Check slugs generated: `SELECT DISTINCT slug FROM nearby_listings LIMIT 5`

#### Script won't start
1. Ensure `.env.local` exists with required keys
2. Try: `npm install` to ensure dependencies are installed
3. Check Node.js version: `node --version` (need v16+)

#### TripAdvisor API errors in script output
- These are normal - some cities/category combos have no results
- Script continues and fetches what's available
- Final count will still be high (3000-10000+ listings)

---

## Quick Command Reference

```bash
# Run local sync (no edge function needed)
npm run sync-tripadvisor

# Install dependencies if needed
npm install

# Check environment variables
cat .env.local

# Deploy edge function (if you want to)
supabase functions deploy sync-tripadvisor-hourly
```

---

## Which Solution to Choose?

| Method | Pros | Cons |
|--------|------|------|
| **Local Script** (`npm run sync-tripadvisor`) | ✓ Works offline ✓ No deployment needed ✓ Full debugging | - Takes 5-10 mins |
| **Edge Function** | ✓ Can automate with cron ✓ Runs in background | - Needs deployment ✓ Limited free tier |
| **Combination** | ✓ Use script initially, then edge function for updates | - Slightly more setup |

**Recommendation:** Use the local script first to populate your database, then set up the edge function for ongoing updates.

---

## Still Need Help?

1. Check Supabase Dashboard → Edge Functions → Logs (if using edge function)
2. Check browser console (F12 → Console tab) for detailed error messages
3. Verify TripAdvisor API key is valid: https://developer.tripadvisor.com/

Good luck! 🚀
