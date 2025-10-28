import { createClient } from '@supabase/supabase-js'
import process from 'process'

const supabase = createClient(
  process.env.VITE_PROJECT_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

const TRIPADVISOR_KEY = '48FA28618E1349CCA99296F27323E7B9'
const MAX_PHOTOS = 20

// Fetch location details and photos from TripAdvisor API
async function fetchPhotosFromAPI(locationId) {
  try {
    console.log(`  Fetching photos for location ID: ${locationId}`)
    
    const url = `https://api.content.tripadvisor.com/v2/location/${locationId}/photos?key=${TRIPADVISOR_KEY}&limit=50`
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    })

    if (!response.ok) {
      console.log(`  API returned ${response.status}`)
      return []
    }

    const data = await response.json()
    
    if (!data.data || !Array.isArray(data.data)) {
      console.log(`  No photo data in response`)
      return []
    }

    const photos = data.data
      .map(photo => {
        // Try to get the largest available image
        if (photo.images?.large?.url) return photo.images.large.url
        if (photo.images?.original?.url) return photo.images.original.url
        if (photo.images?.medium?.url) return photo.images.medium.url
        return null
      })
      .filter(url => url && typeof url === 'string')
      .slice(0, MAX_PHOTOS)

    console.log(`  ✓ Found ${photos.length} photos`)
    return photos
  } catch (err) {
    console.log(`  ✗ API Error: ${err.message}`)
    return []
  }
}

// Process a single listing
async function processListing(listing) {
  if (!listing.tripadvisor_id) {
    return { id: listing.id, status: 'no-id' }
  }

  const listingId = String(listing.tripadvisor_id).trim()
  console.log(`\n[ID: ${listing.id}] ${listing.name}`)
  
  // Skip if already has photos
  if (listing.photo_urls && Array.isArray(listing.photo_urls) && listing.photo_urls.length > 0) {
    console.log(`  Skip: Already has ${listing.photo_urls.length} photos`)
    return { id: listing.id, status: 'skip' }
  }

  // Fetch from API
  const photos = await fetchPhotosFromAPI(listingId)
  
  if (photos.length === 0) {
    return { id: listing.id, status: 'no-photos' }
  }

  // Update database
  try {
    const { error } = await supabase
      .from('nearby_listings')
      .update({
        photo_urls: photos,
        photo_count: photos.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', listing.id)

    if (error) throw error

    console.log(`  ✓ Database updated`)
    return { id: listing.id, status: 'updated', count: photos.length }
  } catch (err) {
    console.log(`  ✗ DB Error: ${err.message}`)
    return { id: listing.id, status: 'db-error' }
  }
}

async function main() {
  console.log('=== TripAdvisor Photos Fetcher ===\n')
  console.log(`API Key: ${TRIPADVISOR_KEY.substring(0, 8)}...`)

  const batchSize = 50
  let offset = 0
  let stats = { processed: 0, updated: 0, skipped: 0, failed: 0 }

  while (true) {
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('id, name, tripadvisor_id, photo_urls')
      .not('tripadvisor_id', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + batchSize - 1)

    if (error) {
      console.error('Database error:', error)
      break
    }

    if (!listings || listings.length === 0) {
      console.log('\nNo more listings to process')
      break
    }

    console.log(`\n--- Batch: offset=${offset}, count=${listings.length} ---`)

    for (const listing of listings) {
      const result = await processListing(listing)
      stats.processed++

      if (result.status === 'updated') stats.updated++
      else if (result.status === 'skip') stats.skipped++
      else if (result.status === 'no-photos') stats.failed++

      // Rate limit: 1 second between requests
      await new Promise(r => setTimeout(r, 1000))
    }

    offset += batchSize

    if (listings.length < batchSize) break

    console.log(`\nWaiting 5 seconds before next batch...`)
    await new Promise(r => setTimeout(r, 5000))
  }

  console.log(`\n\n=== FINAL RESULTS ===`)
  console.log(`Total processed: ${stats.processed}`)
  console.log(`Updated with photos: ${stats.updated}`)
  console.log(`Already had photos: ${stats.skipped}`)
  console.log(`No photos found: ${stats.failed}`)
  console.log(`Success rate: ${((stats.updated / stats.processed) * 100).toFixed(1)}%`)

  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
