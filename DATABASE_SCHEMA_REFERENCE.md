# Database Schema Reference: nearby_listings

## Column Descriptions

### Core Identification
| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| tripadvisor_id | VARCHAR(255) UNIQUE | TripAdvisor unique identifier |
| slug | TEXT UNIQUE | URL-friendly slug (auto-generated) |
| source | VARCHAR(50) | Data source (e.g., "tripadvisor_api") |

### Basic Information
| Column | Type | Description |
|--------|------|-------------|
| name | VARCHAR(255) NOT NULL | Listing name |
| address | TEXT | Physical address |
| city | VARCHAR(255) | City name (NEW) |
| country | VARCHAR(255) | Country name (NEW - defaults to "Philippines") |
| location_type | TEXT | Type: "Attraction", "Hotel", "Restaurant" |
| category | VARCHAR(255) | Detailed category from TripAdvisor |
| description | TEXT | Full description of the listing |

### Geographic Data
| Column | Type | Description |
|--------|------|-------------|
| latitude | DECIMAL(10, 8) | Latitude coordinate |
| longitude | DECIMAL(11, 8) | Longitude coordinate |
| lat | DECIMAL(10, 8) | Alternative latitude field |
| lng | DECIMAL(11, 8) | Alternative longitude field |

### Rating & Review Data
| Column | Type | Description |
|--------|------|-------------|
| rating | DECIMAL(3, 2) | Rating from 0-5 |
| review_count | INTEGER | Total number of reviews |
| review_details | JSONB | Array of review objects |

### Images & Media
| Column | Type | Description |
|--------|------|-------------|
| image_url | TEXT | Primary image URL |
| featured_image_url | TEXT | Featured image URL |
| primary_image_url | TEXT | Primary image URL (alternative) |
| photo_urls | TEXT[] | Array of all photo URLs (up to 20) |
| photo_count | INTEGER | Total photos available |
| stored_image_path | TEXT | Path to locally stored image |
| image_downloaded_at | TIMESTAMP | When image was downloaded |

### Contact & Website
| Column | Type | Description |
|--------|------|-------------|
| website | TEXT | Official website URL |
| web_url | TEXT | TripAdvisor page URL |
| phone_number | TEXT | Contact phone number |

### Details & Features
| Column | Type | Description |
|--------|------|-------------|
| highlights | JSONB | Array of key highlights |
| amenities | JSONB | Array of amenities offered |
| awards | JSONB | Array of awards/certifications |
| hours_of_operation | JSONB | Operating hours by day |
| accessibility_info | JSONB | Wheelchair, parking, etc. |
| nearby_attractions | TEXT[] | Array of nearby POIs |
| best_for | JSONB | What types of visitors enjoy it |

### Pricing & Duration
| Column | Type | Description |
|--------|------|-------------|
| price_level | INTEGER | 1-4 scale ($, $$, $$$, $$$$) |
| price_range | VARCHAR(10) | Human-readable: "$", "$$", "$$$", "$$$$" |
| duration | VARCHAR(50) | Recommended visit duration |

### Rankings & Visibility
| Column | Type | Description |
|--------|------|-------------|
| ranking_in_city | TEXT | Ranking within city |
| ranking_in_category | INTEGER | Ranking within category |
| visibility_score | DECIMAL(5,2) | Calculated visibility (0-100) |
| verified | BOOLEAN | Data verified from API |

### Data Status
| Column | Type | Description |
|--------|------|-------------|
| fetch_status | TEXT | "success", "pending", "error" |
| fetch_error_message | TEXT | Error message if fetch failed |
| last_verified_at | TIMESTAMP | Last time data was verified |
| updated_at | TIMESTAMP | Last update timestamp |
| created_at | TIMESTAMP | Record creation timestamp |

### Raw Data
| Column | Type | Description |
|--------|------|-------------|
| raw | JSONB | Full TripAdvisor API response |

## Sample Data Structure

### Complete Listing Object

```json
{
  "id": 12345,
  "tripadvisor_id": "298573-d123456",
  "slug": "national-museum-of-fine-arts-d123",
  "name": "National Museum of Fine Arts",
  "address": "P. Burgos Drive, Rizal Park, Manila, 1000",
  "city": "Manila",
  "country": "Philippines",
  "category": "attractions",
  "location_type": "Attraction",
  "description": "The National Museum of the Philippines is the national museum of the Philippines...",
  "latitude": 14.5740,
  "longitude": 120.9754,
  "lat": 14.5740,
  "lng": 120.9754,
  "rating": 4.5,
  "review_count": 1023,
  "review_details": [
    {
      "author": "Juan D.",
      "rating": 5,
      "comment": "Amazing collection of Filipino art",
      "date": "2024-01-15T10:30:00Z",
      "verified": true,
      "helpful_count": 45
    }
  ],
  "image_url": "https://media.tacdn.com/media/.../photo.jpg",
  "featured_image_url": "https://media.tacdn.com/media/.../featured.jpg",
  "photo_urls": [
    "https://media.tacdn.com/media/.../1.jpg",
    "https://media.tacdn.com/media/.../2.jpg"
  ],
  "photo_count": 156,
  "website": "https://www.nationalmuseum.ph",
  "web_url": "https://www.tripadvisor.com/Attraction_Review-g298573-d123456",
  "phone_number": "+63 2 5254-5000",
  "highlights": [
    "Detailed info",
    "156 photos",
    "15 amenities",
    "Award winner",
    "Highly rated",
    "Verified reviews"
  ],
  "amenities": [
    {"name": "Wheelchair Accessible", "available": true},
    {"name": "Restrooms", "available": true},
    {"name": "Gift Shop", "available": true}
  ],
  "awards": [
    {"name": "Certificate of Excellence", "year": 2023}
  ],
  "hours_of_operation": {
    "Monday": {"open": "10:00", "close": "17:00", "closed": false},
    "Tuesday": {"open": "10:00", "close": "17:00", "closed": false},
    "Wednesday": {"open": "10:00", "close": "17:00", "closed": false},
    "Thursday": {"open": "10:00", "close": "17:00", "closed": false},
    "Friday": {"open": "10:00", "close": "17:00", "closed": false},
    "Saturday": {"open": "10:00", "close": "17:00", "closed": false},
    "Sunday": {"open": "10:00", "close": "17:00", "closed": false}
  },
  "accessibility_info": {
    "wheelchair_accessible": true,
    "pet_friendly": false,
    "elevator": true,
    "accessible_parking": true,
    "accessible_restroom": true
  },
  "nearby_attractions": [],
  "best_for": ["Visit"],
  "price_level": 2,
  "price_range": "$$",
  "duration": "2-4 hours",
  "ranking_in_city": "3 of 50",
  "visibility_score": 90.0,
  "verified": true,
  "fetch_status": "success",
  "last_verified_at": "2024-01-20T10:00:00Z",
  "updated_at": "2024-01-20T10:00:00Z",
  "created_at": "2024-01-20T10:00:00Z",
  "source": "tripadvisor_api"
}
```

## Indexes

The following indexes are created for optimal query performance:

```sql
CREATE INDEX idx_nearby_listings_city ON nearby_listings(city);
CREATE INDEX idx_nearby_listings_country ON nearby_listings(country);
CREATE INDEX idx_nearby_listings_city_country ON nearby_listings(city, country);
CREATE INDEX idx_nearby_listings_slug ON nearby_listings(slug);
CREATE INDEX idx_nearby_listings_rating ON nearby_listings(rating DESC);
CREATE INDEX idx_nearby_listings_category ON nearby_listings(category);
CREATE INDEX idx_nearby_listings_location_type ON nearby_listings(location_type);
CREATE INDEX idx_nearby_listings_verified ON nearby_listings(verified);
CREATE INDEX idx_nearby_listings_updated_at ON nearby_listings(updated_at DESC);
CREATE INDEX idx_nearby_listings_address ON nearby_listings(address);
CREATE INDEX idx_nearby_listings_lat_lng ON nearby_listings(latitude, longitude);
CREATE INDEX idx_nearby_listings_fts ON nearby_listings USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(category, '')));
```

## Common Queries

### Find listings by city
```sql
SELECT * FROM nearby_listings 
WHERE city = 'Manila' 
ORDER BY rating DESC NULLS LAST;
```

### Find top attractions
```sql
SELECT * FROM nearby_listings 
WHERE location_type = 'Attraction'
AND rating IS NOT NULL
ORDER BY rating DESC, review_count DESC
LIMIT 20;
```

### Search by name/description
```sql
SELECT * FROM nearby_listings
WHERE name ILIKE '%museum%'
OR description ILIKE '%museum%'
ORDER BY rating DESC;
```

### Find highly-rated restaurants
```sql
SELECT name, city, rating, review_count, phone_number, website
FROM nearby_listings
WHERE location_type = 'Restaurant'
AND rating >= 4.0
AND review_count > 50
ORDER BY rating DESC, review_count DESC;
```

### Statistics by city
```sql
SELECT 
  city,
  COUNT(*) as total_listings,
  AVG(rating) as avg_rating,
  COUNT(DISTINCT location_type) as types_available,
  COUNT(image_url) as with_images
FROM nearby_listings
GROUP BY city
ORDER BY total_listings DESC;
```

### Missing data report
```sql
SELECT 
  COUNT(*) FILTER (WHERE image_url IS NULL) as missing_images,
  COUNT(*) FILTER (WHERE phone_number IS NULL) as missing_phone,
  COUNT(*) FILTER (WHERE website IS NULL) as missing_website,
  COUNT(*) FILTER (WHERE hours_of_operation = '{}' OR hours_of_operation IS NULL) as missing_hours
FROM nearby_listings;
```

## Update Frequency

The `updated_at` and `last_verified_at` timestamps are set to the current time whenever:
- A listing is first added
- An existing listing's data is updated
- Listings are refreshed via the fetcher script

## Data Guarantees

✅ **Guaranteed to have**:
- tripadvisor_id (unique)
- name
- city
- country (defaults to "Philippines")
- source (defaults to "tripadvisor_api")

⚠️ **May be NULL**:
- image_url, website, phone_number
- rating, review_count, review_details
- hours_of_operation, amenities, awards
- Any derived or optional fields

📊 **Data completeness depends on**:
- TripAdvisor API data availability
- Listing age and popularity
- Data extraction success rate

---

For the complete fetcher documentation, see `COMPREHENSIVE_PHILIPPINES_FETCHER.md`
