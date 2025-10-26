# Populate TripAdvisor Listings Guide

## Quick Start

### Step 1: Set Up Database Tables

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project: `corcofbmafdxehvlbesx`
3. Go to **SQL Editor**
4. Copy and paste the content from `supabase/migrations/create_nearby_listings.sql`
5. Click **Run** to execute the migration

This creates:
- `nearby_listings` table - stores TripAdvisor data
- `listing_votes` table - stores user votes (thumbs up/down)
- `pending_listings` table - stores user submissions awaiting approval

### Step 2: Populate Listings

1. In the app, click the **Admin** button at the top
2. Read the instructions on the admin page
3. Click **Start Population**
4. Wait for the process to complete (2-5 minutes for all 100+ cities)

The system will fetch listings from the TripAdvisor API for all Philippine cities and save them to the database.

### What Gets Populated

The script fetches listings for all these categories of locations:
- Major cities (Manila, Cebu, Davao, etc.)
- Tourist destinations (Boracay, Palawan, Siargao, etc.)
- All municipalities and cities in the Philippines (~150 locations)

### Result

After completion, you'll see:
- ✓ Total listings fetched
- ✓ Unique listings saved (deduplicated by TripAdvisor ID)

## Nearby Listings Features

Once populated, users can:

### Browse Listings
- Filter by **Featured** (top 10 cities) - default view
- Filter by **All** cities or search by letter (A-Z)
- Click on a city to see listings

### Vote on Listings
- Vote up (👍) or down (👎) on listings
- Vote counts are visible to all users
- Voting requires login

### Save to Directory
- Click **Save** to add listings to personal directory
- View saved listings in the "Saved Directory" section
- Manage and organize saved businesses

### Submit New Listings
- Click **Add Business** to submit a new listing
- Submit information: name, address, category, rating, description
- Listings go to community review for approval

## API Integration

The populate function uses the **TripAdvisor Content API**:
- Endpoint: `https://api.tripadvisor.com/api/partner/2.0/search`
- Authentication: Via `VITE_TRIPADVISOR` environment variable
- Rate limit: ~1 request/second to avoid throttling

## Troubleshooting

### "Missing environment variables" error
- Ensure VITE_TRIPADVISOR key is set in Supabase edge function environment
- Check that Supabase service role key is available

### "TripAdvisor API error: 403" error
- Verify the API key is valid
- Check TripAdvisor API quota

### "Table nearby_listings does not exist" error
- Run the migration SQL again
- Verify you're in the correct Supabase project

### No listings appear after population
- Check that the SQL migration was executed successfully
- Verify the edge function completed without errors
- Check browser console for any fetch errors

## Manual Cleanup

To reset and repopulate:

```sql
-- Delete all listings
DELETE FROM nearby_listings;

-- Delete all votes (optional)
DELETE FROM listing_votes;

-- Restart population from Admin page
```

## Next Steps

After population is complete:
1. Test the Nearby Listings feature with some cities
2. Test voting functionality
3. Test saving listings to personal directory
4. Deploy to production environment
