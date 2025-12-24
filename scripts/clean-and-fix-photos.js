#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const CORRUPTED_CHAR = '\ufffd'

let stats = {
  listingsScanned: 0,
  photosRemoved: 0,
  textsCleaned: 0,
  listingsFixed: 0,
  errors: 0
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isValidPhotoUrl(url) {
  if (!url || typeof url !== 'string') return false
  if (url.length < 20) return false
  if (!url.startsWith('http')) return false
  
  // Valid TripAdvisor and common photo domains
  const validDomains = [
    'tripadvisor.com',
    'tacdn.com',
    'media-cdn.tripadvisor.com',
    'dynamic-media-cdn.tripadvisor.com',
    'pix.media.tripadvisor.com',
    'unsplash.com',
    'imgur.com',
    'cloudinary.com',
    'images.pexels.com',
    'images.pixabay.com'
  ]
  
  const isValidDomain = validDomains.some(domain => url.includes(domain))
  if (!isValidDomain) return false
  
  // Check for common invalid patterns
  if (url.includes('null') || url.includes('undefined')) return false
  if (url.includes('%')) return false // Encoded characters usually indicate bad URLs
  
  return true
}

function cleanTextFields(listing) {
  let hasChanges = false
  const cleaned = { ...listing }

  const textFields = [
    'name', 'address', 'description', 'category', 'city', 'country',
    'tripadvisor_url', 'notes', 'title'
  ]

  for (const field of textFields) {
    if (cleaned[field] && typeof cleaned[field] === 'string') {
      if (cleaned[field].includes(CORRUPTED_CHAR)) {
        cleaned[field] = cleaned[field].replace(new RegExp(CORRUPTED_CHAR, 'g'), '')
        hasChanges = true
      }
    }
  }

  return { cleaned, hasChanges }
}

function cleanPhotos(photos) {
  if (!photos || !Array.isArray(photos)) {
    return { validPhotos: [], removed: 0 }
  }

  const validPhotos = photos.filter(p => isValidPhotoUrl(p))
  const removed = photos.length - validPhotos.length

  return { validPhotos, removed }
}

async function processListing(listing) {
  try {
    stats.listingsScanned++
    let needsUpdate = false
    const updates = {}

    // Clean text fields
    const { cleaned, hasChanges: textChanged } = cleanTextFields(listing)
    if (textChanged) {
      stats.textsCleaned++
      needsUpdate = true

      // Apply cleaned text fields
      for (const key in cleaned) {
        if (cleaned[key] !== listing[key]) {
          updates[key] = cleaned[key]
        }
      }
    }

    // Clean photos
    const photos = listing.photos || listing.photo_urls || []
    const { validPhotos, removed } = cleanPhotos(photos)

    if (removed > 0) {
      stats.photosRemoved += removed
      needsUpdate = true

      updates.photos = validPhotos.length > 0 ? validPhotos : null
      updates.photo_urls = validPhotos.length > 0 ? validPhotos : null
      updates.photo_count = validPhotos.length
    }

    // Apply updates if any
    if (needsUpdate) {
      updates.updated_at = new Date().toISOString()

      const { error: updateError } = await supabase
        .from('nearby_listings')
        .update(updates)
        .eq('id', listing.id)

      if (!updateError) {
        stats.listingsFixed++
      } else {
        console.error(`Error updating listing ${listing.id}:`, updateError.message)
        stats.errors++
      }
    }
  } catch (err) {
    console.error(`Error processing listing ${listing.id}:`, err.message)
    stats.errors++
  }
}

async function main() {
  try {
    console.log('🧹 Cleaning Photos and Corrupted Characters')
    console.log('═══════════════════════════════════════════════════════════════\n')

    // Fetch all listings in batches
    let offset = 0
    const batchSize = 100
    let moreData = true
    const startTime = Date.now()

    while (moreData) {
      process.stdout.write(`Fetching batch ${Math.floor(offset / batchSize) + 1}...`)

      const { data: listings, error: fetchError } = await supabase
        .from('nearby_listings')
        .select('*')
        .range(offset, offset + batchSize - 1)

      if (fetchError) {
        console.error('\n❌ Error fetching listings:', fetchError)
        stats.errors++
        break
      }

      if (!listings || listings.length === 0) {
        console.log('\n✅ Done fetching')
        moreData = false
        break
      }

      console.log(` Processing ${listings.length} listings...`)

      // Process each listing
      for (const listing of listings) {
        await processListing(listing)
        await sleep(10)
      }

      // Check if we got a full batch (means there might be more)
      if (listings.length < batchSize) {
        moreData = false
      } else {
        offset += batchSize
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log('\n\n📊 CLEANUP REPORT')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`Total listings scanned: ${stats.listingsScanned}`)
    console.log(`Listings cleaned: ${stats.listingsFixed}`)
    console.log(`Text fields cleaned: ${stats.textsCleaned}`)
    console.log(`Invalid photos removed: ${stats.photosRemoved}`)
    console.log(`Errors encountered: ${stats.errors}`)
    console.log(`⏱️  Total time: ${totalTime}s`)

    if (stats.listingsFixed > 0) {
      console.log(`\n✅ Successfully cleaned ${stats.listingsFixed} listings!`)
    } else {
      console.log('\n✅ All listings are clean!')
    }
  } catch (err) {
    console.error('❌ Fatal error:', err)
    process.exit(1)
  }
}

main().then(() => {
  process.exit(0)
}).catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
