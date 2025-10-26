# Next Steps: Populate Manila Listings

## What's Been Set Up

1. ✅ **AdminPopulate Component** - Created at `src/components/AdminPopulate.jsx`
   - Provides UI to trigger listing population
   - Accessible via "Admin" button in the app

2. ✅ **Database Migration** - Created at `supabase/migrations/create_nearby_listings.sql`
   - Defines `nearby_listings` table for TripAdvisor data
   - Defines `listing_votes` table for user votes
   - Defines `pending_listings` table for community submissions
   - Includes row-level security policies

3. ✅ **Supabase Edge Function** - Located at `supabase/functions/populate-tripadvisor/index.ts`
   - Fetches from TripAdvisor API for all Philippine cities
   - Automatically deduplicates listings
   - Safely stores results in the database

4. ✅ **Nearby Component Updated** - Enhanced with Featured filter
   - Default view shows top 10 cities
   - Can filter by Featured, All, or A-Z

## To Populate Listings

### Step 1: Set Up Database Schema

1. Open your Supabase project: https://app.supabase.com
2. Go to **SQL Editor**
3. Create a new query and copy the entire content from:
   ```
   supabase/migrations/create_nearby_listings.sql
   ```
4. Click **Run** to execute

**What this does:**
- Creates the `nearby_listings` table
- Creates the `listing_votes` table for voting
- Creates the `pending_listings` table for user submissions
- Creates the `approval_votes` table for community moderation
- Sets up indexes for performance
- Enables row-level security

### Step 2: Deploy the Edge Function

The edge function should already exist, but ensure it's deployed:

1. In Supabase dashboard, go to **Edge Functions**
2. You should see `populate-tripadvisor` listed
3. If not present, it will be deployed automatically when first called

**Note:** Environment variables (VITE_TRIPADVISOR, SUPABASE_URL, etc.) are automatically available to edge functions.

### Step 3: Trigger Population from App

1. Go to your running app
2. Click the **Admin** button at the top
3. Click **Start Population**
4. Wait for completion (2-5 minutes for ~150 cities)
5. You'll see success message with counts

**Expected Result:**
```
Total fetched: ~1500-2000 listings
Unique saved: ~1200-1500 listings (after deduplication)
```

## Testing

After population completes:

1. **Go to Nearby page** (from home navbar)
2. **Featured filter** should be selected (default)
3. **Popular destinations** should show 10 top cities
4. Click on **Manila** to see listings
5. Listings should display with:
   - Name
   - Address
   - Rating (if available)
   - Category
   - Save button
   - Vote buttons (👍 👎)

## Troubleshooting

### "Table nearby_listings does not exist"
- Ensure the migration SQL was executed in Supabase
- Check the Table Editor to see if tables are created

### "Function not found" or "Permission denied"
- Ensure Supabase service role key is set in environment
- Check edge function logs in Supabase dashboard

### No listings appear after population
- Check that the function completed successfully
- Verify the SQL migration ran without errors
- Clear browser cache and refresh

### Listings appear but no rating/address
- TripAdvisor API may not have complete data for all listings
- This is expected - data varies by location
- Ratings and addresses will be populated where available

## Optional: Manual Testing with curl

Test the edge function directly:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/populate-tripadvisor \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

## Architecture Overview

```
App (AdminPopulate Component)
    ↓
Supabase Edge Function (populate-tripadvisor)
    ↓
TripAdvisor API
    ↓
Supabase Database (nearby_listings table)
    ↓
Nearby Component (displays listings)
```

## What's Next After Population

1. **Search & Filter** - Add search by name/category
2. **User Submissions** - Community members can add listings
3. **Moderation** - Community votes on pending listings
4. **Reviews** - Allow users to add reviews to listings
5. **Analytics** - Track which listings are most popular
6. **Export** - Allow downloading listing data

---

Questions? Check:
- `POPULATE_LISTINGS.md` - Detailed population guide
- `docs/API_INTEGRATION.md` - API setup guide
- Supabase documentation: https://supabase.com/docs
