#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET_NAME = 'nearby_listings'
const BATCH_SIZE = 10
const CONCURRENT_DOWNLOADS = 3

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables: VITE_PROJECT_URL and VITE_SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

/**
 * Download image from URL and return as buffer
 */
async function downloadImage(imageUrl) {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 15000,
    })

    if (!response.ok) {
      console.warn(`  ⚠️  Failed to download: HTTP ${response.status}`)
      return null
    }

    return await response.arrayBuffer()
  } catch (err) {
    console.warn(`  ⚠️  Download error: ${err.message}`)
    return null
  }
}

/**
 * Determine file extension from content type or URL
 */
function getFileExtension(contentType, url) {
  if (contentType?.includes('png')) return 'png'
  if (contentType?.includes('webp')) return 'webp'
  if (contentType?.includes('gif')) return 'gif'
  if (url?.includes('.png')) return 'png'
  if (url?.includes('.webp')) return 'webp'
  if (url?.includes('.gif')) return 'gif'
  return 'jpg'
}

/**
 * Upload image to Supabase storage
 */
async function uploadImage(buffer, fileName, contentType) {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType,
        upsert: true,
      })

    if (error) {
      console.warn(`  ⚠️  Upload error: ${error.message}`)
      return null
    }

    return data?.path || fileName
  } catch (err) {
    console.warn(`  ⚠️  Upload exception: ${err.message}`)
    return null
  }
}

/**
 * Process a single listing
 */
async function processListing(listing) {
  // Get first available image URL
  let imageUrl = null
  if (Array.isArray(listing.image_urls) && listing.image_urls.length > 0) {
    imageUrl = listing.image_urls[0]
  } else if (Array.isArray(listing.photo_urls) && listing.photo_urls.length > 0) {
    imageUrl = listing.photo_urls[0]
  } else if (listing.image_url) {
    imageUrl = listing.image_url
  } else if (listing.primary_image_url) {
    imageUrl = listing.primary_image_url
  } else if (listing.featured_image_url) {
    imageUrl = listing.featured_image_url
  }

  if (!imageUrl) {
    console.log(`⊘ ${listing.name} - No image URL found`)
    return false
  }

  if (listing.stored_image_path) {
    console.log(`✓ ${listing.name} - Already has stored image`)
    return true
  }

  console.log(`↓ ${listing.name}`)

  // Download image
  const buffer = await downloadImage(imageUrl)
  if (!buffer) {
    console.log(`  ✗ Failed to download image`)
    return false
  }

  // Determine file type and generate filename
  const ext = getFileExtension(null, imageUrl)
  const fileName = `listings/${listing.tripadvisor_id}.${ext}`

  // Upload to storage
  const storedPath = await uploadImage(buffer, fileName, `image/${ext}`)
  if (!storedPath) {
    console.log(`  ✗ Failed to upload image`)
    return false
  }

  // Update database
  try {
    const { error } = await supabase
      .from('nearby_listings')
      .update({
        stored_image_path: storedPath,
        image_downloaded_at: new Date().toISOString(),
      })
      .eq('tripadvisor_id', listing.tripadvisor_id)

    if (error) {
      console.log(`  ✗ Failed to update database: ${error.message}`)
      return false
    }

    console.log(`  ✓ Stored and mapped`)
    return true
  } catch (err) {
    console.log(`  ✗ Update error: ${err.message}`)
    return false
  }
}

/**
 * Process listings with concurrency control
 */
async function processBatch(listings) {
  const results = []
  for (let i = 0; i < listings.length; i += CONCURRENT_DOWNLOADS) {
    const chunk = listings.slice(i, i + CONCURRENT_DOWNLOADS)
    const chunkResults = await Promise.all(chunk.map(processListing))
    results.push(...chunkResults)
  }
  return results
}

/**
 * Main function
 */
async function main() {
  console.log('📸 Downloading and mapping TripAdvisor images to listings...\n')

  try {
    // Get all listings that need images
    console.log('📋 Fetching listings...')
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('tripadvisor_id, name, image_urls, photo_urls, image_url, primary_image_url, featured_image_url, stored_image_path')
      .order('rating', { ascending: false, nullsLast: true })

    if (error) {
      console.error('❌ Failed to fetch listings:', error)
      process.exit(1)
    }

    console.log(`✓ Found ${listings.length} total listings\n`)

    // Filter listings that need images
    const needsImages = listings.filter(l => !l.stored_image_path && (
      (Array.isArray(l.image_urls) && l.image_urls.length > 0) ||
      (Array.isArray(l.photo_urls) && l.photo_urls.length > 0) ||
      l.image_url ||
      l.primary_image_url ||
      l.featured_image_url
    ))

    console.log(`🎯 Need images: ${needsImages.length}`)
    console.log(`✓ Already have images: ${listings.length - needsImages.length}\n`)

    if (needsImages.length === 0) {
      console.log('✓ All listings already have images!')
      process.exit(0)
    }

    // Process in batches
    let processed = 0
    let successful = 0
    let failed = 0

    for (let i = 0; i < needsImages.length; i += BATCH_SIZE) {
      const batch = needsImages.slice(i, i + BATCH_SIZE)
      console.log(`\n📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(needsImages.length / BATCH_SIZE)}`)
      console.log(`Processing ${batch.length} listings...\n`)

      const results = await processBatch(batch)
      results.forEach(success => {
        if (success) successful++
        else failed++
      })
      processed += results.length

      // Rate limit between batches
      if (i + BATCH_SIZE < needsImages.length) {
        console.log('⏳ Rate limiting (2s)...')
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 Results:')
    console.log(`   Total processed: ${processed}`)
    console.log(`   ✓ Successful: ${successful}`)
    console.log(`   ✗ Failed: ${failed}`)
    console.log('='.repeat(50))

    process.exit(0)
  } catch (err) {
    console.error('❌ Fatal error:', err)
    process.exit(1)
  }
}

main()
