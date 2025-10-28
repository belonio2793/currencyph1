#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const TRIPADVISOR_KEY = process.env.VITE_TRIPADVISOR_API_KEY || process.env.TRIPADVISOR_API_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)
const BATCH_SIZE = 50
const CONCURRENT_FETCHES = 3

/**
 * Fetch photos from TripAdvisor API
 */
async function fetchTripAdvisorPhotos(tripadvisorId) {
  if (!TRIPADVISOR_KEY) {
    return []
  }

  try {
    const response = await fetch(
      `https://api.content.tripadvisor.com/v2/location/${tripadvisorId}/photos?key=${TRIPADVISOR_KEY}&limit=20`,
      { signal: AbortSignal.timeout(10000) }
    )

    if (!response.ok) {
      return []
    }

    const data = await response.json()
    if (data.data && Array.isArray(data.data)) {
      return data.data
        .map(photo => {
          if (photo.images?.large?.url) return photo.images.large.url
          if (photo.images?.original?.url) return photo.images.original.url
          return null
        })
        .filter(Boolean)
    }
    return []
  } catch (err) {
    return []
  }
}

/**
 * Generate placeholder image URL
 */
function generatePlaceholder(name, category) {
  const colors = ['FF6B6B', '4ECDC4', '45B7D1', 'FFA07A', '98D8C8']
  const color = colors[Math.floor(Math.random() * colors.length)]
  const text = encodeURIComponent((category || name).substring(0, 20))
  return `https://via.placeholder.com/600x400?text=${text}&bg=${color}&textColor=ffffff`
}

/**
 * Download and store image
 */
async function downloadAndStore(imageUrl, tripadvisorId) {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      return null
    }

    const buffer = await response.arrayBuffer()

    // Determine extension
    const contentType = response.headers.get('content-type')
    let ext = 'jpg'
    if (contentType?.includes('png')) ext = 'png'
    else if (contentType?.includes('webp')) ext = 'webp'

    const fileName = `listings/${tripadvisorId}.${ext}`

    const { error } = await supabase.storage
      .from('nearby_listings')
      .upload(fileName, buffer, { contentType, upsert: true })

    if (error) {
      return null
    }

    return fileName
  } catch (err) {
    return null
  }
}

/**
 * Process a single listing
 */
async function processListing(listing) {
  // Skip if already has image
  if (listing.stored_image_path || listing.image_url) {
    return 'skip'
  }

  // Only process listings with a numeric TripAdvisor ID
  if (!listing.tripadvisor_id || !/^\d+$/.test(String(listing.tripadvisor_id))) {
    console.log(`⊘ Skipping (no numeric TripAdvisor ID): ${listing.name}`)
    return 'skip'
  }

  // Try to fetch from TripAdvisor
  let imageUrl = null
  const photos = await fetchTripAdvisorPhotos(listing.tripadvisor_id)

  if (photos.length > 0) {
    imageUrl = photos[0]
  } else {
    // No photos found — skip (do not generate placeholders)
    console.log(`⊘ No TripAdvisor photos for: ${listing.name} (${listing.tripadvisor_id})`)
    return 'skip'
  }

  try {
    // Download and store
    let storedPath = null
    if (imageUrl) {
      storedPath = await downloadAndStore(imageUrl, listing.tripadvisor_id)
    }

    // Update database
    const { error } = await supabase
      .from('nearby_listings')
      .update({
        image_url: imageUrl,
        stored_image_path: storedPath,
        image_downloaded_at: new Date().toISOString(),
      })
      .eq('tripadvisor_id', listing.tripadvisor_id)

    if (error) {
      console.log(`✗ Failed to update: ${listing.name}`)
      return 'error'
    }

    console.log(`✓ ${listing.name}`)
    return 'success'
  } catch (err) {
    console.log(`✗ Error processing: ${listing.name}`)
    return 'error'
  }
}

/**
 * Process listings with concurrency
 */
async function processBatch(listings) {
  const results = []
  for (let i = 0; i < listings.length; i += CONCURRENT_FETCHES) {
    const chunk = listings.slice(i, i + CONCURRENT_FETCHES)
    const chunkResults = await Promise.all(chunk.map(processListing))
    results.push(...chunkResults)

    // Rate limit
    await new Promise(r => setTimeout(r, 500))
  }
  return results
}

/**
 * Main
 */
async function main() {
  console.log('📸 Fetching TripAdvisor images and storing for listings...\n')

  try {
    // Get all listings without images
    console.log('📋 Fetching listings without images...')
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('tripadvisor_id, name, category, image_url, stored_image_path')
      .is('image_url', null)
      .is('stored_image_path', null)
      .order('rating', { ascending: false, nullsLast: true })

    if (error) {
      console.error('❌ Error:', error)
      process.exit(1)
    }

    console.log(`✓ Found ${listings.length} listings needing images\n`)

    if (listings.length === 0) {
      console.log('✓ All listings have images!')
      process.exit(0)
    }

    let processed = 0
    let successful = 0

    for (let i = 0; i < listings.length; i += BATCH_SIZE) {
      const batch = listings.slice(i, i + BATCH_SIZE)
      console.log(`\n📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(listings.length / BATCH_SIZE)}`)
      console.log(`Processing ${batch.length} listings...\n`)

      const results = await processBatch(batch)
      const successes = results.filter(r => r === 'success' || r === 'skip').length
      successful += successes
      processed += batch.length

      if (i + BATCH_SIZE < listings.length) {
        console.log('⏳ Rate limiting (2s)...')
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 Complete!')
    console.log(`   Processed: ${processed}`)
    console.log(`   Successful: ${successful}`)
    console.log('='.repeat(50))

    process.exit(0)
  } catch (err) {
    console.error('❌ Error:', err)
    process.exit(1)
  }
}

main()
