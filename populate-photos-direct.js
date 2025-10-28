import { createClient } from '@supabase/supabase-js'
import process from 'process'

const supabase = createClient(
  process.env.VITE_PROJECT_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

const MAX_PHOTOS = 20

// Fetch and extract photo URLs from TripAdvisor listing page
async function extractPhotosFromPage(url) {
  try {
    console.log(`  Fetching: ${url.substring(0, 70)}...`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    })

    if (!response.ok) {
      console.log(`  ✗ HTTP ${response.status}`)
      return []
    }

    const html = await response.text()
    const photoUrls = new Set()

    // Pattern 1: dynamic-media-cdn.tripadvisor.com URLs (most reliable)
    const dynamicPattern = /https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo[^"'\s<>]*(?:jpg|png|webp)/gi
    const dynamicMatches = html.match(dynamicPattern) || []
    dynamicMatches.forEach(url => {
      const baseUrl = url.split('?')[0].split('#')[0]
      if (baseUrl && baseUrl.length > 20) {
        photoUrls.add(baseUrl)
      }
    })

    // Pattern 2: media-cdn.tacdn.com images
    const mediaCdnPattern = /https:\/\/media-cdn\.tripadvisor\.com\/media\/photo[^"'\s<>]*(?:jpg|png|webp)/gi
    const mediaCdnMatches = html.match(mediaCdnPattern) || []
    mediaCdnMatches.forEach(url => {
      const baseUrl = url.split('?')[0].split('#')[0]
      if (baseUrl && baseUrl.length > 20) {
        photoUrls.add(baseUrl)
      }
    })

    // Pattern 3: Look in img tags specifically
    const imgTagPattern = /<img[^>]+src=["']([^"']*tacdn[^"']*(?:jpg|png|webp)[^"']*)["']/gi
    let imgMatch
    while ((imgMatch = imgTagPattern.exec(html)) !== null) {
      const url = imgMatch[1]
      if (url && url.length > 20) {
        const baseUrl = url.split('?')[0].split('#')[0]
        if (baseUrl) photoUrls.add(baseUrl)
      }
    }

    // Pattern 4: Look for srcSet attributes
    const srcsetPattern = /srcset=["']([^"']*)["']/gi
    let srcsetMatch
    while ((srcsetMatch = srcsetPattern.exec(html)) !== null) {
      const srcset = srcsetMatch[1]
      const urls = srcset.match(/https:\/\/[^\s,]+/g) || []
      urls.forEach(url => {
        if (url.includes('tacdn') || url.includes('dynamic-media-cdn')) {
          const baseUrl = url.split('?')[0].split('#')[0].trim()
          if (baseUrl && baseUrl.length > 20) {
            photoUrls.add(baseUrl)
          }
        }
      })
    }

    const result = Array.from(photoUrls)
      .filter(url => !url.includes('placeholder') && !url.includes('default') && !url.includes('logo'))
      .slice(0, MAX_PHOTOS)

    console.log(`  ✓ Extracted ${result.length} photo URLs`)
    return result
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

  // Extract photos from page
  const photos = await extractPhotosFromPage(listing.web_url)

  if (photos.length === 0) {
    console.log(`  No photos extracted`)
    return { id: listing.id, status: 'no-photos' }
  }

  // Update database with photos
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
  console.log('=== TripAdvisor Photos - Direct Extraction ===\n')

  const batchSize = 10
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

      // Rate limit: 2 second delay between requests
      await new Promise(r => setTimeout(r, 2000))
    }

    offset += batchSize

    if (listings.length < batchSize) break

    console.log(`\nWaiting 3 seconds before next batch...`)
    await new Promise(r => setTimeout(r, 3000))
  }

  console.log(`\n\n=== FINAL RESULTS ===`)
  console.log(`Total processed: ${stats.processed}`)
  console.log(`✓ Updated with photos: ${stats.updated}`)
  console.log(`⊘ Already had photos: ${stats.skipped}`)
  console.log(`✗ No photos found: ${stats.failed}`)
  console.log(`Success rate: ${((stats.updated / stats.processed) * 100).toFixed(1)}%`)

  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
