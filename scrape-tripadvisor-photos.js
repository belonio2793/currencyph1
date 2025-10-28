import { createClient } from '@supabase/supabase-js'
import process from 'process'

const supabase = createClient(
  process.env.VITE_PROJECT_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

// Extract listing ID from TripAdvisor URL
function extractListingId(url) {
  const match = url.match(/-d(\d+)-/)
  return match ? match[1] : null
}

// Fetch photos from TripAdvisor listing page
async function fetchPhotosFromListing(listingId) {
  try {
    // TripAdvisor's photo API endpoint
    const photoUrl = `https://www.tripadvisor.com.ph/data/graphql`
    
    const query = {
      operationName: 'GetMediaGallery',
      variables: {
        locationId: `restaurant_${listingId}`,
        offset: 0,
        limit: 50,
        filters: []
      },
      query: `query GetMediaGallery($locationId: String!, $offset: Int!, $limit: Int!, $filters: [String!]!) {
        mediaGallery(locationId: $locationId, offset: $offset, limit: $limit, filters: $filters) {
          items {
            id
            url
            source {
              name
            }
          }
        }
      }`
    }

    const response = await fetch(photoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify(query)
    })

    if (!response.ok) return []

    const data = await response.json()
    
    if (!data.data?.mediaGallery?.items) return []
    
    // Extract photo URLs
    const photos = data.data.mediaGallery.items
      .map(item => item.url)
      .filter(url => url && typeof url === 'string')
      .slice(0, 20)
    
    return photos
  } catch (err) {
    console.warn(`GraphQL fetch error for listing ${listingId}:`, err.message)
    return []
  }
}

// Alternative: Scrape HTML page to extract image URLs
async function scrapePhotosFromPage(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) return []

    const html = await response.text()

    // Look for image URLs in common patterns
    const patterns = [
      // Dynamic media CDN pattern
      /https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo[^"'\s<>]+/gi,
      // Static media pattern  
      /https:\/\/static\.tacdn\.com\/img\/[^"'\s<>]+/gi,
      // Media tacdn pattern
      /https:\/\/media\.tacdn\.com\/[^"'\s<>]+\.jpg/gi
    ]

    const urls = new Set()
    
    for (const pattern of patterns) {
      const matches = html.match(pattern) || []
      matches.forEach(url => {
        // Clean up URL
        const cleanUrl = url.split(/['"]/)[0].split(/[\s<>]/)[0]
        if (cleanUrl && cleanUrl.startsWith('https://')) {
          urls.add(cleanUrl)
        }
      })
    }

    return Array.from(urls).slice(0, 20)
  } catch (err) {
    console.warn(`HTML scrape error for ${url}:`, err.message)
    return []
  }
}

async function processListing(listing) {
  if (!listing.web_url) {
    return { id: listing.id, status: 'no-url' }
  }

  console.log(`\nProcessing: ${listing.name}`)
  
  // Try GraphQL first
  const listingId = extractListingId(listing.web_url)
  let photos = []

  if (listingId) {
    photos = await fetchPhotosFromListing(listingId)
    if (photos.length > 0) {
      console.log(`  ✓ GraphQL: Found ${photos.length} photos`)
    }
  }

  // If GraphQL fails, try HTML scraping
  if (photos.length === 0) {
    photos = await scrapePhotosFromPage(listing.web_url)
    if (photos.length > 0) {
      console.log(`  ✓ HTML Scrape: Found ${photos.length} photos`)
    } else {
      console.log(`  ✗ No photos found`)
      return { id: listing.id, status: 'no-photos' }
    }
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

    console.log(`  ✓ Updated: ${photos.length} photos saved`)
    return { id: listing.id, status: 'updated', count: photos.length }
  } catch (err) {
    console.warn(`  ✗ DB error:`, err.message)
    return { id: listing.id, status: 'db-error' }
  }
}

async function main() {
  console.log('Starting TripAdvisor photo scraper...\n')

  const batchSize = 50
  let offset = 0
  let totalProcessed = 0
  let totalUpdated = 0

  while (true) {
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('id, name, web_url')
      .not('web_url', 'is', null)
      .is('photo_urls', null)
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
      totalProcessed++

      if (result.status === 'updated') {
        totalUpdated++
      }

      // Rate limit: 1 second between requests
      await new Promise(r => setTimeout(r, 1000))
    }

    offset += batchSize

    // Break between batches
    if (listings.length < batchSize) break
    console.log(`Waiting before next batch...`)
    await new Promise(r => setTimeout(r, 5000))
  }

  console.log(`\n\n=== RESULTS ===`)
  console.log(`Total processed: ${totalProcessed}`)
  console.log(`Total updated: ${totalUpdated}`)
  console.log(`Success rate: ${((totalUpdated / totalProcessed) * 100).toFixed(1)}%`)

  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
