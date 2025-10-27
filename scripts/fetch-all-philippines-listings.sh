#!/bin/bash

###############################################################################
# Comprehensive TripAdvisor Philippines Listings Fetcher
# 
# This script fetches all attractions, restaurants, and venues from TripAdvisor
# for every city and municipality in the Philippines.
#
# Usage: bash scripts/fetch-all-philippines-listings.sh
#
# Prerequisites:
#   - Node.js installed
#   - .env file with VITE_TRIPADVISOR API key set
#   - Supabase credentials configured
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}TripAdvisor Philippines Comprehensive Fetcher${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check if .env file exists
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo -e "${RED}Error: .env file not found in $PROJECT_DIR${NC}"
    echo -e "${YELLOW}Please create a .env file with VITE_TRIPADVISOR API key${NC}"
    exit 1
fi

# Check if API key is set
if ! grep -q "VITE_TRIPADVISOR" "$PROJECT_DIR/.env"; then
    echo -e "${RED}Error: VITE_TRIPADVISOR not found in .env${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Environment configuration found${NC}"
echo ""

# Create a Node.js script to handle the fetching
FETCH_SCRIPT="$PROJECT_DIR/scripts/fetch-listings-runner.js"

cat > "$FETCH_SCRIPT" << 'NODEJS_SCRIPT'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: `${dirname(__dirname)}/.env` })

const TRIPADVISOR_API_KEY = process.env.VITE_TRIPADVISOR
const SUPABASE_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!TRIPADVISOR_API_KEY) {
  console.error('❌ VITE_TRIPADVISOR API key not found in environment')
  process.exit(1)
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Supabase credentials not found')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

function generateSlug(str) {
  if (!str) return ''
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function formatListingData(rawData) {
  if (!rawData) return null

  return {
    tripadvisor_id: String(rawData.location_id || rawData.id),
    name: rawData.name || '',
    slug: generateSlug(rawData.name || ''),
    description: rawData.description || rawData.overview || '',
    address: rawData.address || rawData.address_string || '',
    latitude: rawData.latitude || rawData.address_obj?.latitude || null,
    longitude: rawData.longitude || rawData.address_obj?.longitude || null,
    rating: rawData.rating ? Number(rawData.rating) : null,
    review_count: rawData.num_reviews || rawData.review_count || 0,
    category: rawData.subcategory || rawData.category?.name || rawData.type || '',
    location_type: rawData.location_type || rawData.type || '',
    phone_number: rawData.phone || rawData.telephone || null,
    website: rawData.website || rawData.web_url || null,
    web_url: rawData.web_url || null,
    image_url: rawData.photo?.images?.large?.url || rawData.image_url || null,
    featured_image_url: rawData.photo?.images?.original?.url || rawData.featured_image || null,
    photo_count: rawData.num_photos || 0,
    photo_urls: extractPhotoUrls(rawData),
    hours_of_operation: extractHours(rawData),
    admission_fee: rawData.admission || rawData.price_range || null,
    price_level: rawData.price_level || null,
    amenities: extractAmenities(rawData),
    accessibility_info: extractAccessibility(rawData),
    awards: extractAwards(rawData),
    ranking_in_city: rawData.ranking?.ranking || null,
    ranking_in_category: rawData.ranking?.ranking_category ? parseInt(rawData.ranking.ranking_category) : null,
    highlights: extractHighlights(rawData),
    best_for: extractBestFor(rawData),
    nearby_attractions: extractNearbyAttractions(rawData),
    review_details: extractReviewDetails(rawData),
    lat: rawData.latitude ? parseFloat(rawData.latitude) : null,
    lng: rawData.longitude ? parseFloat(rawData.longitude) : null,
    source: 'tripadvisor',
    verified: true,
    last_verified_at: new Date().toISOString(),
    raw: rawData
  }
}

function extractPhotoUrls(data) {
  const urls = []
  if (data.photos && Array.isArray(data.photos)) {
    for (const photo of data.photos.slice(0, 20)) {
      if (photo.images?.large?.url) urls.push(photo.images.large.url)
      else if (photo.images?.original?.url) urls.push(photo.images.original.url)
    }
  }
  if (data.photo?.images?.large?.url) urls.unshift(data.photo.images.large.url)
  return urls.filter((url, idx, arr) => arr.indexOf(url) === idx).slice(0, 50)
}

function extractHours(data) {
  if (!data.hours) return {}
  const hours = {}
  const dayMap = { 0: 'Monday', 1: 'Tuesday', 2: 'Wednesday', 3: 'Thursday', 4: 'Friday', 5: 'Saturday', 6: 'Sunday' }
  if (Array.isArray(data.hours)) {
    for (const entry of data.hours) {
      const day = dayMap[entry.day]
      if (day && entry.open_time && entry.close_time) hours[day] = `${entry.open_time} - ${entry.close_time}`
    }
  }
  return hours
}

function extractAmenities(data) {
  if (data.amenities && Array.isArray(data.amenities)) {
    return data.amenities.map(a => typeof a === 'string' ? a : a.name).filter(Boolean)
  }
  return []
}

function extractAccessibility(data) {
  const accessibility = {}
  if (data.access_info) accessibility.details = data.access_info
  if (data.is_wheelchair_accessible !== undefined) accessibility.wheelchair_accessible = data.is_wheelchair_accessible
  return accessibility
}

function extractAwards(data) {
  const awards = []
  if (data.awards && Array.isArray(data.awards)) {
    for (const award of data.awards) {
      if (award.award_type || award.display_name) awards.push(award.award_type || award.display_name)
    }
  }
  return awards
}

function extractHighlights(data) {
  if (data.highlights && Array.isArray(data.highlights)) {
    return data.highlights.filter(Boolean).slice(0, 15)
  }
  if (data.description) {
    const sentences = data.description.split('.').filter(s => s.trim().length > 10).slice(0, 5)
    return sentences.map(s => s.trim())
  }
  return []
}

function extractBestFor(data) {
  if (data.best_for && Array.isArray(data.best_for)) {
    return data.best_for.filter(Boolean).slice(0, 10)
  }
  return []
}

function extractNearbyAttractions(data) {
  if (data.nearby_attractions && Array.isArray(data.nearby_attractions)) {
    return data.nearby_attractions.map(a => typeof a === 'string' ? a : a.name).filter(Boolean).slice(0, 20)
  }
  return []
}

function extractReviewDetails(data) {
  const reviews = []
  if (data.reviews && Array.isArray(data.reviews)) {
    for (const review of data.reviews.slice(0, 5)) {
      reviews.push({
        author: review.author || review.user?.username || 'Anonymous',
        rating: review.rating || 0,
        text: review.text || review.review_text || '',
        date: review.published_date || review.date || null,
        helpful_count: review.helpful_count || 0
      })
    }
  }
  return reviews
}

async function fetchListingDetails(locationId, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(
        `https://api.tripadvisor.com/api/partner/2.0/location/${locationId}/details?language=en`,
        {
          headers: {
            'X-TripAdvisor-API-Key': TRIPADVISOR_API_KEY,
            'Accept': 'application/json'
          }
        }
      )

      if (!response.ok) {
        if (response.status === 429) {
          console.log(`⏳ Rate limited, waiting 10 seconds...`)
          await new Promise(r => setTimeout(r, 10000))
          continue
        }
        return null
      }

      const data = await response.json()
      return formatListingData(data)
    } catch (err) {
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 2000))
      } else {
        console.error(`Failed to fetch details for ${locationId}:`, err.message)
      }
    }
  }
  return null
}

async function searchCity(city, limit = 20) {
  try {
    const params = new URLSearchParams()
    params.append('query', `${city} Philippines`)
    params.append('limit', String(Math.min(limit, 30)))

    const response = await fetch(
      `https://api.tripadvisor.com/api/partner/2.0/locations/search?${params.toString()}`,
      {
        headers: {
          'X-TripAdvisor-API-Key': TRIPADVISOR_API_KEY,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      }
    )

    if (!response.ok) {
      console.warn(`Search error for ${city}: ${response.status}`)
      return []
    }

    const data = await response.json()
    const items = data.data || []

    const listings = []
    for (const item of items) {
      if (!item.location_id) continue
      
      const detailed = await fetchListingDetails(item.location_id)
      if (detailed) {
        listings.push(detailed)
      }
      await new Promise(r => setTimeout(r, 800))
    }

    return listings
  } catch (err) {
    console.error(`Error searching ${city}:`, err.message)
    return []
  }
}

async function saveListings(listings) {
  if (!listings || listings.length === 0) {
    return { success: false, message: 'No listings to save' }
  }

  try {
    const chunkSize = 10

    for (let i = 0; i < listings.length; i += chunkSize) {
      const chunk = listings.slice(i, i + chunkSize)

      const { error } = await supabase
        .from('nearby_listings')
        .upsert(chunk, { onConflict: 'tripadvisor_id' })

      if (error) {
        console.error(`Error saving batch ${i}-${i + chunkSize}:`, error)
        continue
      }

      await new Promise(r => setTimeout(r, 300))
    }

    return {
      success: true,
      saved: listings.length,
      message: `Saved ${listings.length} listings`
    }
  } catch (err) {
    console.error('Error saving listings:', err)
    return {
      success: false,
      message: err.message,
      saved: 0
    }
  }
}

const PHILIPPINES_CITIES = [
  'Manila', 'Cebu', 'Davao', 'Quezon City', 'Makati', 'Baguio', 'Boracay',
  'Puerto Princesa', 'Iloilo', 'Pasig', 'Taguig', 'Parañaque', 'Bacoor',
  'Cavite City', 'Imus', 'Dasmariñas', 'Tagaytay', 'Batangas City', 'Lipa',
  'Calamba', 'Santa Rosa', 'Antipolo', 'Marikina', 'Mandaluyong', 'San Juan',
  'Malabon', 'Navotas', 'Caloocan', 'Valenzuela', 'Angeles City', 'San Fernando',
  'Tarlac', 'Cabanatuan', 'Nueva Ecija', 'Baler', 'Vigan', 'Ilocos',
  'Dagupan', 'Lingayen', 'Urdaneta', 'Dumaguete', 'Negros Oriental', 'Siquijor',
  'Tacloban', 'Leyte', 'Samar', 'Biliran', 'Coron', 'El Nido', 'Roxas',
  'Cagayan de Oro', 'Misamis Oriental', 'Iligan', 'Marawi', 'Zamboanga',
  'Basilan', 'Sulu', 'Koronadal', 'General Santos', 'Sipalay', 'San Carlos'
]

async function main() {
  console.log(`\n📍 Fetching listings from ${PHILIPPINES_CITIES.length} Philippine cities\n`)

  const allListings = []
  let successCount = 0
  let errorCount = 0
  const startTime = Date.now()

  for (let i = 0; i < PHILIPPINES_CITIES.length; i++) {
    const city = PHILIPPINES_CITIES[i]
    const progress = `[${i + 1}/${PHILIPPINES_CITIES.length}]`

    process.stdout.write(`${progress} Fetching ${city}... `)

    try {
      const listings = await searchCity(city, 20)

      if (listings.length > 0) {
        allListings.push(...listings)
        successCount++
        console.log(`✓ Found ${listings.length} listings`)
      } else {
        console.log(`⊘ No listings found`)
      }
    } catch (err) {
      console.log(`✗ Error: ${err.message}`)
      errorCount++
    }

    process.stdout.write(`   Total collected: ${allListings.length} listings\n`)
  }

  // Deduplicate
  console.log(`\n🔄 Deduplicating listings...`)
  const deduped = {}
  for (const listing of allListings) {
    deduped[listing.tripadvisor_id] = listing
  }
  const unique = Object.values(deduped)

  console.log(`✓ Unique listings: ${unique.length}`)

  // Save to database
  console.log(`\n💾 Saving to database...`)
  const saveResult = await saveListings(unique)

  if (saveResult.success) {
    console.log(`✓ ${saveResult.saved} listings saved successfully`)
  } else {
    console.log(`✗ Error: ${saveResult.message}`)
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(0)
  console.log(`\n📊 Summary:`)
  console.log(`   Cities searched: ${successCount}/${PHILIPPINES_CITIES.length}`)
  console.log(`   Total found: ${allListings.length}`)
  console.log(`   Unique: ${unique.length}`)
  console.log(`   Saved: ${saveResult.saved || 0}`)
  console.log(`   Errors: ${errorCount}`)
  console.log(`   Duration: ${duration}s`)
  console.log()

  process.exit(saveResult.success ? 0 : 1)
}

main()
NODEJS_SCRIPT

echo -e "${BLUE}Running comprehensive fetch...${NC}"
echo ""

# Check if dependencies are installed
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    cd "$PROJECT_DIR"
    npm install
fi

# Run the fetch script
cd "$PROJECT_DIR"
node "$FETCH_SCRIPT"

# Clean up
rm -f "$FETCH_SCRIPT"

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}✓ Fetch operation complete!${NC}"
echo -e "${GREEN}================================================${NC}"
