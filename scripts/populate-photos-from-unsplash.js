#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing PROJECT_URL or SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)
const UNSPLASH_KEY = '5GKxLbBwTKBvHOB1YEqjNuMTK-7GYCD6A5LT2UwCjKw'
const PHOTOS_PER_LISTING = 5

function getSearchTerm(listing) {
  const category = listing.category?.toLowerCase() || ''
  const location = listing.city || ''

  const categoryMap = {
    'restaurant': 'restaurant fine dining food',
    'hotel': 'luxury hotel room interior',
    'resort': 'beach resort tropical',
    'attraction': 'tourist landmark attraction',
    'museum': 'museum art gallery',
    'beach': 'beach tropical ocean Philippines',
    'mountain': 'mountain scenic landscape',
    'garden': 'botanical garden flowers',
    'cafe': 'cafe coffee shop',
    'bar': 'bar drinks lounge',
    'spa': 'spa wellness massage',
    'shopping': 'shopping mall retail',
  }

  let searchBase = 'Philippines tourism'
  for (const [key, value] of Object.entries(categoryMap)) {
    if (category.includes(key)) {
      searchBase = value
      break
    }
  }

  return `${searchBase} ${location}`.trim()
}

async function fetchUnsplashPhotos(searchTerm, count = PHOTOS_PER_LISTING) {
  try {
    const query = encodeURIComponent(searchTerm)
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${query}&client_id=${UNSPLASH_KEY}&per_page=${count}&orientation=landscape`,
      { signal: AbortSignal.timeout(10000) }
    )

    if (!response.ok) {
      console.warn(`  ⚠️  Unsplash API error: ${response.status}`)
      return null
    }

    const data = await response.json()
    if (data.results && data.results.length > 0) {
      return data.results
        .map(img => img.urls?.regular)
        .filter(Boolean)
        .slice(0, count)
    }
    return null
  } catch (err) {
    console.warn(`  ⚠️  Fetch error: ${err.message}`)
    return null
  }
}

async function updateListing(listing, photos) {
  try {
    const { error } = await supabase
      .from('nearby_listings')
      .update({
        photo_urls: photos,
        updated_at: new Date().toISOString(),
      })
      .eq('id', listing.id)

    if (error) {
      console.log(`  ✗ DB error: ${error.message}`)
      return false
    }

    return true
  } catch (err) {
    console.log(`  ✗ Error: ${err.message}`)
    return false
  }
}

async function processBatch(listings) {
  let successful = 0
  let failed = 0

  for (const listing of listings) {
    process.stdout.write(`  ${listing.name} (${listing.city})... `)

    const searchTerm = getSearchTerm(listing)
    const photos = await fetchUnsplashPhotos(searchTerm)

    if (!photos || photos.length === 0) {
      console.log('✗ No photos found')
      failed++
      await new Promise(r => setTimeout(r, 300))
      continue
    }

    const success = await updateListing(listing, photos)
    if (success) {
      console.log(`✓ Updated (${photos.length} photos)`)
      successful++
    } else {
      console.log('✗ Failed to update')
      failed++
    }

    await new Promise(r => setTimeout(r, 500))
  }

  return { successful, failed }
}

async function main() {
  console.log('🖼️  Populating photo_urls with Unsplash images...\n')

  try {
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('id, name, city, category, photo_urls')
      .order('id', { ascending: true })

    if (error) {
      console.error('❌ Error fetching listings:', error)
      process.exit(1)
    }

    console.log(`📋 Found ${listings.length} listings\n`)

    let totalSuccessful = 0
    let totalFailed = 0
    const BATCH_SIZE = 10

    for (let i = 0; i < listings.length; i += BATCH_SIZE) {
      const batch = listings.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(listings.length / BATCH_SIZE)

      console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, listings.length)})`)
      console.log('-'.repeat(60))

      const { successful, failed } = await processBatch(batch)
      totalSuccessful += successful
      totalFailed += failed

      if (i + BATCH_SIZE < listings.length) {
        console.log('\n⏳ Rate limiting (3s)...')
        await new Promise(r => setTimeout(r, 3000))
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('🎉 Complete!')
    console.log(`   Total processed: ${listings.length}`)
    console.log(`   Successfully updated: ${totalSuccessful}`)
    console.log(`   Failed: ${totalFailed}`)
    console.log(`   Success rate: ${Math.round((totalSuccessful / listings.length) * 100)}%`)
    console.log('='.repeat(60))

    process.exit(0)
  } catch (err) {
    console.error('❌ Fatal error:', err)
    process.exit(1)
  }
}

main()
