import { createClient } from '@supabase/supabase-js'
import process from 'process'

const supabase = createClient(
  process.env.VITE_PROJECT_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

const SCRAPINGBEE_KEY = 'DHOMQK5VZOIUQN9JJZHFR3WX07XFGTFFYFVCRM6AOLZFGI5S9Z60R23AQM2LUL84M2SNK4HH9NGMVDCG'
const MAX_PHOTOS = 20

// Fetch photos from TripAdvisor page using ScrapingBee
async function fetchPhotosFromScrapingBee(url) {
  try {
    console.log(`  Scraping: ${url.substring(0, 80)}...`)

    const scrapingBeeUrl = 'https://api.scrapingbee.com/api/v1/'
    
    const params = new URLSearchParams({
      api_key: SCRAPINGBEE_KEY,
      url: url,
      render_js: 'false',
      timeout: '15000'
    })

    const response = await fetch(`${scrapingBeeUrl}?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      console.log(`  ScrapingBee returned ${response.status}`)
      return []
    }

    const html = await response.text()

    // Extract image URLs from various patterns
    const photoUrls = new Set()

    // Pattern 1: Dynamic media CDN (most common for TripAdvisor)
    const dynamicPattern = /https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo[^"'\s<>]*\w+(?:\.jpg|\.png|\.webp)?/gi
    const dynamicMatches = html.match(dynamicPattern) || []
    dynamicMatches.forEach(url => {
      const cleaned = url.split(/['"]/)[0].split(/[\s<>]/)[0]
      if (cleaned && cleaned.startsWith('https://')) {
        // Clean up query parameters
        const baseUrl = cleaned.split('?')[0]
        if (baseUrl) photoUrls.add(baseUrl)
      }
    })

    // Pattern 2: Static tacdn images
    const staticPattern = /https:\/\/static\.tacdn\.com\/img\/[^"'\s<>]+/gi
    const staticMatches = html.match(staticPattern) || []
    staticMatches.forEach(url => {
      const cleaned = url.split(/['"]/)[0]
      if (cleaned && cleaned.startsWith('https://')) {
        photoUrls.add(cleaned)
      }
    })

    // Pattern 3: Media tacdn with photo ID
    const mediaPattern = /https:\/\/media\.tacdn\.com\/media\/photo[^"'\s<>]*[a-z0-9]+(?:\.jpg)?/gi
    const mediaMatches = html.match(mediaPattern) || []
    mediaMatches.forEach(url => {
      const cleaned = url.split(/['"]/)[0].split(/[\s<>]/)[0]
      if (cleaned && cleaned.startsWith('https://')) {
        photoUrls.add(cleaned)
      }
    })

    // Pattern 4: Look for srcset attributes with image URLs
    const srcsetPattern = /(https:\/\/[^"'\s]+?(?:\.jpg|\.png|\.webp))/gi
    const srcsetMatches = html.match(srcsetPattern) || []
    srcsetMatches.forEach(url => {
      if (url.includes('tacdn') || url.includes('dynamic-media-cdn') || url.includes('media.tacdn')) {
        const cleaned = url.split(/['"]/)[0].split(/[\s<>]/)[0]
        if (cleaned && cleaned.startsWith('https://')) {
          const baseUrl = cleaned.split('?')[0]
          if (baseUrl.includes('.jpg') || baseUrl.includes('.png') || baseUrl.includes('.webp')) {
            photoUrls.add(baseUrl)
          }
        }
      }
    })

    const photos = Array.from(photoUrls)
      .filter(url => !url.includes('placeholder') && !url.includes('logo'))
      .slice(0, MAX_PHOTOS)

    console.log(`  ✓ Found ${photos.length} photo URLs`)
    return photos
  } catch (err) {
    console.log(`  ✗ Error: ${err.message}`)
    return []
  }
}

// Process a single listing
async function processListing(listing) {
  if (!listing.web_url) {
    return { id: listing.id, status: 'no-url' }
  }

  console.log(`\n[ID: ${listing.id}] ${listing.name}`)

  // Skip if already has photos
  if (listing.photo_urls && Array.isArray(listing.photo_urls) && listing.photo_urls.length > 0) {
    console.log(`  Skip: Already has ${listing.photo_urls.length} photos`)
    return { id: listing.id, status: 'skip' }
  }

  // Fetch from ScrapingBee
  const photos = await fetchPhotosFromScrapingBee(listing.web_url)

  if (photos.length === 0) {
    console.log(`  No photos found`)
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

    console.log(`  ✓ Database updated with ${photos.length} photos`)
    return { id: listing.id, status: 'updated', count: photos.length }
  } catch (err) {
    console.log(`  ✗ DB Error: ${err.message}`)
    return { id: listing.id, status: 'db-error' }
  }
}

async function main() {
  console.log('=== TripAdvisor Photos via ScrapingBee ===\n')

  const batchSize = 20
  let offset = 0
  let stats = { processed: 0, updated: 0, skipped: 0, failed: 0 }

  while (true) {
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('id, name, web_url, photo_urls')
      .not('web_url', 'is', null)
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

      // Rate limit: 2 seconds between requests
      await new Promise(r => setTimeout(r, 2000))
    }

    offset += batchSize

    if (listings.length < batchSize) break

    console.log(`\nWaiting before next batch...`)
    await new Promise(r => setTimeout(r, 3000))
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
