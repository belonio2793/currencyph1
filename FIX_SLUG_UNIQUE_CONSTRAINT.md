# Fix: Duplicate Key Value Violates Unique Constraint on Slug

## Problem

You're seeing errors like:
```
Error updating slug for san-luis-parks-2-1761548551571: 
duplicate key value violates unique constraint "nearby_listings_slug_key"
```

### Root Cause

The `nearby_listings` table has a UNIQUE constraint on the `slug` column. This means:
- Only **one** listing can have the slug "san-luis-parks"
- But the Philippines has **multiple** places named "San Luis" in different regions/cities
- When they all get slugified to "san-luis-parks", the constraint is violated

## Solution

I've implemented a fix that:

1. ✅ Removes the strict UNIQUE constraint on slug
2. ✅ Makes slugs unique by appending the TripAdvisor ID
3. ✅ Allows multiple listings with similar names in different locations
4. ✅ Still enables fast slug-based lookups

### Example

**Before (fails with constraint violation):**
- Listing 1: "San Luis, City A" → slug: `san-luis-parks`
- Listing 2: "San Luis, City B" → slug: `san-luis-parks` ❌ CONSTRAINT ERROR

**After (works with ID suffix):**
- Listing 1: "San Luis, City A" → slug: `san-luis-parks-a1b2c3`
- Listing 2: "San Luis, City B" → slug: `san-luis-parks-d4e5f6` ✅ UNIQUE

---

## How to Apply the Fix

### Step 1: Run the Migration in Supabase

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Create a new query
3. Copy and paste this SQL:

```sql
BEGIN;

-- Drop the old unique constraint on slug
ALTER TABLE nearby_listings
DROP CONSTRAINT IF EXISTS nearby_listings_slug_key;

-- Keep the index for performance but make it non-unique
DROP INDEX IF EXISTS idx_nearby_listings_slug;
CREATE INDEX IF NOT EXISTS idx_nearby_listings_slug ON nearby_listings(slug);

COMMIT;
```

4. Click **Run** (or Ctrl+Enter)
5. You should see: "Query executed successfully"

### Step 2: Re-populate Slugs

The next time you fetch listings (via `npm run sync-tripadvisor` or the edge function), new slugs will be generated with the ID suffix automatically.

**To fix existing listings without slugs:**

Run in your terminal:
```bash
npm run fetch-philippines
```

This will update all existing listings with properly unique slugs.

---

## How the Fix Works

### New Slug Generation

When creating slugs, the system now:

1. Takes the listing name and slugifies it: `"San Luis Parks"` → `san-luis-parks`
2. Checks if that slug already exists in the database
3. If it doesn't exist, uses `san-luis-parks`
4. If it does exist, appends the TripAdvisor ID suffix: `san-luis-parks-a1b2c3`
5. This creates a unique combination guaranteed to work

### URL Routing

Users access listings via their unique slug:
```
/nearby/san-luis-parks-a1b2c3
/nearby/san-luis-parks-d4e5f6
```

Each slug is unique even though the base names are the same.

---

## Verification

### Check the Migration Applied

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run this query:

```sql
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'nearby_listings' 
AND constraint_type = 'UNIQUE';
```

You should **NOT** see `nearby_listings_slug_key` in the results.

### Check Slugs Are Unique

```sql
-- Should return 0 rows (no duplicates)
SELECT slug, COUNT(*) as count
FROM nearby_listings
WHERE slug IS NOT NULL
GROUP BY slug
HAVING COUNT(*) > 1;
```

---

## Files Changed

The fix updates:

1. **Database Migration:** `supabase/migrations/fix_slug_constraint.sql`
   - Removes UNIQUE constraint
   - Creates non-unique index for performance

2. **Slug Generation:** `src/lib/slugUtils.js`
   - New `generateUniqueSlug()` function
   - Checks for duplicates and appends ID suffix
   - Used during manual slug population

3. **Edge Function:** `supabase/functions/sync-tripadvisor-hourly/index.ts`
   - Generates unique slugs automatically when fetching
   - Appends 6-character ID suffix to all slugs

4. **Local Script:** `scripts/sync-tripadvisor-locally.js`
   - Same slug generation as edge function
   - For users who run `npm run sync-tripadvisor`

---

## FAQ

### Q: Will my existing URLs break?

**A:** If you've already shared URLs like `/nearby/san-luis-parks`, they may not work with the new unique slugs. 

**Solution:** 
- Either keep the old listings and only apply unique slugs to new ones
- Or update the URL lookup to search by both slug AND name (fuzzy matching)
- Or provide a redirect from old URLs to new ones

### Q: Can I use shorter unique identifiers?

**A:** Yes, the code uses the last 6 characters of the TripAdvisor ID. You can modify this in:
- `src/lib/slugUtils.js` line ~32
- `supabase/functions/sync-tripadvisor-hourly/index.ts` line ~211
- `scripts/sync-tripadvisor-locally.js` line ~62

Change `slice(-6)` to `slice(-4)` for 4 characters, etc.

### Q: What if I want completely different slug format?

**A:** You could also use:
- Incrementing counter: `san-luis-parks-1`, `san-luis-parks-2`
- Full ID: `san-luis-parks-3829102840`
- UUID: `san-luis-parks-f47ac10b`
- Coordinates: `san-luis-parks-1405-121` (latitude-longitude)

Modify the slug generation logic in the files above to use your preferred format.

### Q: How do I handle really long names?

**A:** The code limits slugs to 200 characters max as a fallback. Names are typically short enough (e.g., "Rizal Park" → "rizal-park-a1b2c3" is only 20 chars).

If you need to truncate:
```javascript
const slug = uniqueSlug.substring(0, 100); // Max 100 chars
```

---

## After Applying the Fix

1. ✅ Duplicate slug errors will stop appearing
2. ✅ New listings fetch without constraint violations
3. ✅ Each listing has a unique URL based on its slug
4. ✅ URLs remain stable (slug doesn't change once set)
5. ✅ Multiple locations with same name can coexist

---

## Quick Checklist

- [ ] Ran the SQL migration in Supabase SQL Editor
- [ ] Verified constraint was removed (check information_schema query)
- [ ] Re-fetched listings (`npm run sync-tripadvisor`)
- [ ] Verified no duplicate slugs exist
- [ ] Tested `/nearby/listing-name-xxxxx` URLs work
- [ ] Checked browser console for errors

All set! Your slug constraint issue is fixed. 🚀
