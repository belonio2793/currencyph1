# /Nearby Page Documentation

## Overview

The `/nearby` page displays listings from the `nearby_listings` database table. It provides users with an alphabetical city-based browsing experience and full-text search capabilities across Philippine destinations.

## Database Integration

### Environment Variables

The application uses the following environment variables to connect to Supabase:

```env
# Supabase Project URL
VITE_PROJECT_URL=https://corcofbmafdxehvlbesx.supabase.co

# Supabase Anonymous Key (for client-side operations)
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase Service Role Key (for server-side operations)
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

These variables are automatically loaded from `.env.local` and made available via Vite's `import.meta.env` object.

### Database Table Schema

The `nearby_listings` table contains all listing data:

```sql
CREATE TABLE nearby_listings (
  id BIGINT PRIMARY KEY,
  tripadvisor_id TEXT UNIQUE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude FLOAT,
  longitude FLOAT,
  rating FLOAT,
  category TEXT,
  raw JSONB,
  updated_at TIMESTAMP,
  created_at TIMESTAMP
);
```

#### Column Requirements

Each listing must have the following fields populated:

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `id` | BIGINT | Yes | Unique identifier |
| `tripadvisor_id` | TEXT | Yes | TripAdvisor unique ID (must be unique) |
| `name` | TEXT | Yes | Listing name/title |
| `address` | TEXT | Yes | Full address (used for city filtering) |
| `latitude` | FLOAT | Optional | Geographic latitude |
| `longitude` | FLOAT | Optional | Geographic longitude |
| `rating` | FLOAT | Optional | Average rating (0-5) |
| `category` | TEXT | Optional | Listing category (e.g., "Hotel", "Restaurant") |
| `raw` | JSONB | Optional | Extended metadata from TripAdvisor |
| `updated_at` | TIMESTAMP | Automatic | Last update timestamp |
| `created_at` | TIMESTAMP | Automatic | Creation timestamp |

## Data Access Pattern

### City-Based Filtering

The `/nearby` page supports 168 Philippine cities arranged alphabetically:

```javascript
const PHILIPPINE_CITIES = [
  'Abuyog', 'Alaminos', 'Alcala', 'Angeles', 'Antipolo', 'Aroroy', 'Bacolod',
  'Bacoor', 'Bago', 'Bais', 'Balanga', 'Baliuag', 'Bangued', 'Bansalan',
  'Bantayan', 'Bataan', 'Batac', 'Batangas City', 'Bayambang', 'Bayawan',
  // ... additional cities
  'Zamboanga City'
]
```

When a user selects a city, listings are filtered using:

```javascript
query = query.ilike('address', `%${selectedCity}%`)
```

This searches the `address` field for city names (case-insensitive).

### Search Functionality

Full-text search is performed across multiple columns:

```javascript
const { data } = await supabase
  .from('nearby_listings')
  .select('*')
  .or(`name.ilike.%${searchQuery}%,address.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
  .limit(50)
```

Searches cover:
- **name**: Listing name
- **address**: Full address
- **category**: Type of listing
- **description**: Extended details (if available in raw data)

## Component Structure

### Nearby.jsx

Main component at `src/components/Nearby.jsx` that handles:

1. **Data Loading**
   - Loads statistics from the database
   - Calculates average ratings across all listings
   - Counts total listings and cities covered

2. **City Browsing**
   - Displays all 168 Philippine cities in alphabetical order
   - Allows selection to filter listings by city
   - Shows "All Cities" button to view all listings

3. **Search**
   - Searches across name, address, category fields
   - Shows up to 50 results per search
   - Case-insensitive matching

4. **Listings Display**
   - Renders listings in a 2-column responsive grid
   - Sorted by rating (highest first)
   - Pagination with 12 items per page
   - Integrates with ListingCard component

## Data Statistics

The page displays the following statistics loaded from the database:

```javascript
{
  total: count,                    // Total listings in nearby_listings
  cities: PHILIPPINE_CITIES.length, // Number of cities (168)
  avgRating: averageRating,        // Calculated average of all ratings
  withRatings: ratingsCount        // Count of listings with ratings
}
```

## Database Queries Used

### Load Statistics
```javascript
// Count total listings
const { data: countData } = await supabase
  .from('nearby_listings')
  .select('*', { count: 'exact' })
  .limit(0)

// Get average rating
const { data: ratingData } = await supabase
  .from('nearby_listings')
  .select('rating')
  .not('rating', 'is', null)
```

### Load Listings by City
```javascript
let query = supabase.from('nearby_listings').select('*')

if (selectedCity) {
  query = query.ilike('address', `%${selectedCity}%`)
}

const { data } = await query
  .order('rating', { ascending: false })
  .range(from, to)
```

### Search Listings
```javascript
const { data } = await supabase
  .from('nearby_listings')
  .select('*')
  .or(
    `name.ilike.%${searchQuery}%,address.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
  )
  .limit(50)
```

## Listing Requirements

For listings to appear and function properly in the `/nearby` page:

### Mandatory Fields
- ✅ `name` - Must be non-empty
- ✅ `address` - Must contain city name (required for city filtering)
- ✅ `tripadvisor_id` - Must be unique (prevents duplicates)

### Important Fields
- ⚠️ `rating` - Recommended for sorting functionality (listings sorted by rating)
- ⚠️ `category` - Recommended for content organization

### Optional Fields
- 🔹 `latitude`, `longitude` - For future map functionality
- 🔹 `raw` - Extended metadata from TripAdvisor
- 🔹 `description` - For enhanced search results

## Data Entry Checklist

When adding new listings to `nearby_listings`:

- [ ] Populate `name` field with descriptive title
- [ ] Populate `address` field with FULL address including city name
- [ ] Provide unique `tripadvisor_id` (prevent duplicates)
- [ ] Include `rating` value (0.0-5.0) if available
- [ ] Set appropriate `category` (Hotel, Restaurant, Attraction, etc.)
- [ ] Include coordinates if location data is available
- [ ] Store raw TripAdvisor data in `raw` JSONB column
- [ ] Ensure address city name matches one from PHILIPPINE_CITIES list

## City Name Formatting

When populating the address field, ensure city names match exactly with the list:

```
✅ Correct: "Makati City, Metro Manila" (contains "Makati" or city name)
❌ Incorrect: "Metro Manila" (without city name)
✅ Correct: "Cebu City, Cebu"
✅ Correct: "Quezon City, NCR"
```

The filtering uses case-insensitive matching (`ilike`), so:
- "manila" matches "Manila"
- "cebu city" matches "Cebu City"

## Performance Considerations

### Database Indexes

Ensure the following indexes exist on `nearby_listings`:

```sql
-- For city filtering
CREATE INDEX IF NOT EXISTS idx_nearby_address ON nearby_listings(address);

-- For ratings sorting
CREATE INDEX IF NOT EXISTS idx_nearby_rating ON nearby_listings(rating DESC);

-- For unique constraint on tripadvisor_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_tripadvisor_id ON nearby_listings(tripadvisor_id);
```

### Query Optimization

- **Pagination**: Limited to 12 items per page to reduce data transfer
- **Search**: Limited to 50 results per search to optimize performance
- **Sorting**: Results sorted by rating for consistent ordering
- **Case-insensitive matching**: Uses `ilike` for user-friendly search

## Error Handling

The Nearby component includes error handling for:

1. **Failed stats loading** - Logs to console, uses default stats
2. **Failed listing queries** - Displays "Failed to load listings" error
3. **Search failures** - Displays "Search failed" error message
4. **Fetch operation errors** - Detailed error messages with HTTP status

All errors are logged to browser console with context for debugging.

## Future Enhancements

Potential improvements to the `/nearby` page:

1. **Map Integration** - Display listings on interactive map using latitude/longitude
2. **Advanced Filtering** - Filter by rating, category, distance from location
3. **Bookmarking** - Save favorite listings for quick access
4. **Reviews/Comments** - Add user-contributed reviews
5. **Photo Gallery** - Display multiple photos per listing
6. **Real-time Sync** - Update listings from TripAdvisor in real-time
7. **Recommendations** - AI-powered listing suggestions
8. **Comparison Tool** - Compare multiple listings side-by-side

## Troubleshooting

### No listings appear

1. Verify `nearby_listings` table has data:
   ```sql
   SELECT COUNT(*) FROM nearby_listings;
   ```

2. Check environment variables are loaded:
   - Open browser DevTools (F12)
   - Check Network tab for Supabase requests

3. Verify RLS policies allow reading:
   ```sql
   SELECT * FROM nearby_listings LIMIT 1;
   ```

### City filtering not working

1. Check address field format:
   ```sql
   SELECT DISTINCT address FROM nearby_listings LIMIT 10;
   ```

2. Verify city name matches PHILIPPINE_CITIES list exactly (case-sensitive in the list)

3. Check that address contains city name:
   ```sql
   SELECT * FROM nearby_listings WHERE address NOT ILIKE '%City%' LIMIT 5;
   ```

### Search returns no results

1. Verify search columns have data:
   ```sql
   SELECT COUNT(*) FROM nearby_listings WHERE name IS NOT NULL;
   SELECT COUNT(*) FROM nearby_listings WHERE description IS NOT NULL;
   ```

2. Check that search query matches available data

3. Review browser console for SQL errors

## Support

For issues or questions about the `/nearby` page:

1. Check this documentation first
2. Review browser console for errors (F12)
3. Verify database has correct data using SQL queries
4. Check that environment variables are properly configured
5. Contact development team for assistance
