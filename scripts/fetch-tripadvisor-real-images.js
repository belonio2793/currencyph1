#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const TRIPADVISOR_KEY = process.env.VITE_TRIPADVISOR_API_KEY || process.env.TRIPADVISOR_API_KEY

if (!TRIPADVISOR_KEY) {
  console.error('❌ Missing TRIPADVISOR_API_KEY')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)
const BATCH_SIZE = 30
const CONCURRENT_REQUESTS = 2

/**
 * Fetch photos from TripAdvisor API
 */
async function fetchTripAdvisorPhotos(locationId) {
  try {
    const response = await fetch(
      `https://api.content.tripadvisor.com/v2/location/${locationId}/photos?key=${TRIPADVISOR_KEY}&limit=20`,
      { signal: AbortSignal.timeout(8000) }
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
          if (photo.images?.medium?.url) return photo.images.medium.url
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
 * Process a single listing
 */
async function processListing(listing) {
  const locationId = listing.tripadvisor_id
  const photos = await fetchTripAdvisorPhotos(locationId)

  if (photos.length === 0) {
    return 'skip'
  }

  try {
    // Update with real image
    const { error } = await supabase
      .from('nearby_listings')
      .update({
        image_url: photos[0],
        image_urls: photos,
        updated_at: new Date().toISOString(),
      })
      .eq('tripadvisor_id', locationId)

    if (error) {
      console.log(`✗ ${listing.name}`)
      return 'error'
    }

    console.log(`✓ ${listing.name}`)
    return 'success'
  } catch (err) {
    console.log(`✗ ${listing.name}`)
    return 'error'
  }
}

/**
 * Process listings concurrently
 */
async function processBatch(listings) {
  const results = []
  for (let i = 0; i < listings.length; i += CONCURRENT_REQUESTS) {
    const chunk = listings.slice(i, i + CONCURRENT_REQUESTS)
    const chunkResults = await Promise.all(chunk.map(processListing))
    results.push(...chunkResults)
    await new Promise(r => setTimeout(r, 300))
  }
  return results
}

/**
 * Main
 */
async function main() {
  console.log('🖼️  Fetching real TripAdvisor photos for listings...\n')

  try {
    // Get all listings
    console.log('📋 Fetching listings...')
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('tripadvisor_id, name')
      .order('rating', { ascending: false, nullsLast: true })

    if (error) {
      console.error('❌ Error:', error)
      process.exit(1)
    }

    console.log(`✓ Found ${listings.length} listings\n`)

    let processed = 0
    let successful = 0

    for (let i = 0; i < listings.length; i += BATCH_SIZE) {
      const batch = listings.slice(i, i + BATCH_SIZE)
      console.log(`📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(listings.length / BATCH_SIZE)}`)
      console.log(`Processing ${batch.length} listings...\n`)

      const results = await processBatch(batch)
      const successes = results.filter(r => r === 'success').length
      successful += successes
      processed += batch.length

      if (i + BATCH_SIZE < listings.length) {
        console.log('⏳ Rate limiting (1s)...\n')
        await new Promise(r => setTimeout(r, 1000))
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 Complete!')
    console.log(`   Processed: ${processed}`)
    console.log(`   Updated with real photos: ${successful}`)
    console.log('='.repeat(50))

    process.exit(0)
  } catch (err) {
    console.error('❌ Error:', err)
    process.exit(1)
  }
}

main()
