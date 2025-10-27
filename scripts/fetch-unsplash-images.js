#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)
const BATCH_SIZE = 25
const CONCURRENT_REQUESTS = 3

/**
 * Get search term from listing category
 */
function getSearchTerm(category) {
  const categoryMap = {
    'restaurant': 'restaurant food dining',
    'hotel': 'luxury hotel accommodation',
    'resort': 'beach resort tropical',
    'attraction': 'tourist attraction landmark',
    'museum': 'museum art culture',
    'beach': 'beach tropical ocean',
    'mountain': 'mountain scenic landscape',
    'garden': 'botanical garden flowers',
    'cafe': 'cafe coffee shop',
    'bar': 'bar drinks nightlife',
    'spa': 'spa wellness relaxation',
    'shopping': 'shopping mall retail',
  }

  const normalized = category?.toLowerCase() || 'philippines'

  for (const [key, value] of Object.entries(categoryMap)) {
    if (normalized.includes(key)) {
      return value
    }
  }

  return 'Philippines tourism attraction'
}

/**
 * Fetch image from Unsplash
 */
async function fetchUnsplashImage(searchTerm, retries = 2) {
  try {
    const query = encodeURIComponent(searchTerm)
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${query}&client_id=5GKxLbBwTKBvHOB1YEqjNuMTK-7GYCD6A5LT2UwCjKw&per_page=1&orientation=landscape`,
      { signal: AbortSignal.timeout(8000) }
    )

    if (!response.ok) {
      if (retries > 0 && response.status !== 401) {
        await new Promise(r => setTimeout(r, 500))
        return fetchUnsplashImage(searchTerm, retries - 1)
      }
      return null
    }

    const data = await response.json()
    if (data.results?.[0]?.urls?.regular) {
      return data.results[0].urls.regular
    }
    return null
  } catch (err) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 500))
      return fetchUnsplashImage(searchTerm, retries - 1)
    }
    return null
  }
}

/**
 * Process a single listing
 */
async function processListing(listing) {
  const searchTerm = getSearchTerm(listing.category)
  const imageUrl = await fetchUnsplashImage(searchTerm)

  if (!imageUrl) {
    return { success: false, reason: 'no_image' }
  }

  try {
    const { error } = await supabase
      .from('nearby_listings')
      .update({
        image_url: imageUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('tripadvisor_id', listing.tripadvisor_id)

    if (error) {
      console.log(`✗ ${listing.name}`)
      return { success: false, reason: 'db_error' }
    }

    console.log(`✓ ${listing.name}`)
    return { success: true, reason: 'updated' }
  } catch (err) {
    console.log(`✗ ${listing.name}`)
    return { success: false, reason: 'error' }
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
    await new Promise(r => setTimeout(r, 200))
  }
  return results
}

/**
 * Main
 */
async function main() {
  console.log('🖼️  Fetching real photos from Unsplash for all listings...\n')

  try {
    // Get all listings
    console.log('📋 Fetching listings...')
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('tripadvisor_id, name, category')
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
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(listings.length / BATCH_SIZE)
      
      console.log(`📦 Batch ${batchNum}/${totalBatches}`)
      console.log(`Processing ${batch.length} listings...\n`)

      const results = await processBatch(batch)
      const successes = results.filter(r => r.success).length
      successful += successes
      processed += batch.length

      const percentage = Math.round((processed / listings.length) * 100)
      console.log(`Progress: ${processed}/${listings.length} (${percentage}%)\n`)

      if (i + BATCH_SIZE < listings.length) {
        console.log('⏳ Rate limiting (2s)...\n')
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('🎉 Complete!')
    console.log(`   Total processed: ${processed}`)
    console.log(`   Updated with real photos: ${successful}`)
    console.log(`   Success rate: ${Math.round((successful / processed) * 100)}%`)
    console.log('='.repeat(60))

    process.exit(0)
  } catch (err) {
    console.error('❌ Error:', err)
    process.exit(1)
  }
}

main()
