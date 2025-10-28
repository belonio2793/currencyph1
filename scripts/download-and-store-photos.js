#!/usr/bin/env node
/*
download-and-store-photos.js

Download photos from TripAdvisor listings and store them in Supabase storage bucket.
Updates photo_urls column with public storage URLs.

Usage:
  node scripts/download-and-store-photos.js --batch=10 --limit=100

Environment variables required:
  VITE_PROJECT_URL
  VITE_SUPABASE_SERVICE_ROLE_KEY
*/

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { fileURLToPath } from 'url'

const execAsync = promisify(exec)

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

const BUCKET_NAME = 'nearby_listings'
const MAX_PHOTOS = 15
const TEMP_DIR = '/tmp/tripadvisor-photos'

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

// Parse arguments
const argv = process.argv.slice(2)
let BATCH = 10
let LIMIT = 999999
let START = 0

for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--batch' && argv[i+1]) { BATCH = Number(argv[i+1]); i++ }
  if (argv[i] === '--limit' && argv[i+1]) { LIMIT = Number(argv[i+1]); i++ }
  if (argv[i] === '--start' && argv[i+1]) { START = Number(argv[i+1]); i++ }
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true })
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function extractPhotoUrlsFromHTML(html) {
  const photoUrls = new Set()

  // Pattern 1: Dynamic media CDN
  const dynamicPattern = /https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo[a-zA-Z0-9\-_\/]*(?:\.jpg|\.png|\.webp)?/g
  const dynamicMatches = html.match(dynamicPattern) || []
  dynamicMatches.forEach(url => {
    const cleaned = url.split(/['"?]/)[0].trim()
    if (cleaned && !cleaned.includes('placeholder') && !cleaned.includes('logo')) {
      const baseUrl = cleaned.split('?')[0]
      if (baseUrl) photoUrls.add(baseUrl)
    }
  })

  // Pattern 2: Media tacdn
  const mediaPattern = /https:\/\/media\.tacdn\.com\/media\/photo[a-zA-Z0-9\-_\/]*(?:\.jpg|\.png|\.webp)?/g
  const mediaMatches = html.match(mediaPattern) || []
  mediaMatches.forEach(url => {
    const cleaned = url.split(/['"?]/)[0].trim()
    if (cleaned && !cleaned.includes('placeholder') && !cleaned.includes('logo')) {
      const baseUrl = cleaned.split('?')[0]
      if (baseUrl) photoUrls.add(baseUrl)
    }
  })

  // Pattern 3: Look for srcset and data attributes
  const srcPattern = /(https:\/\/(?:dynamic-media-cdn|media\.tacdn)\.com\/[^\s"'<>]+(?:\.jpg|\.png|\.webp))/g
  const srcMatches = html.match(srcPattern) || []
  srcMatches.forEach(url => {
    const cleaned = url.split('?')[0]
    if (cleaned && !cleaned.includes('placeholder') && !cleaned.includes('logo')) {
      photoUrls.add(cleaned)
    }
  })

  return Array.from(photoUrls).slice(0, MAX_PHOTOS)
}

async function fetchTripAdvisorPage(url) {
  try {
    console.log('    Fetching page with curl...')

    try {
      const { stdout } = await execAsync(
        `curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "${url}" | head -c 5000000`,
        { maxBuffer: 10 * 1024 * 1024 }
      )
      return stdout
    } catch (err) {
      // Fallback to fetch API
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })
      if (!response.ok) return null
      return await response.text()
    }
  } catch (err) {
    console.log(`    Error fetching page: ${err.message}`)
    return null
  }
}

async function downloadImage(imageUrl, filename) {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    })

    if (!response.ok) {
      return null
    }

    const buffer = await response.buffer()
    const filepath = path.join(TEMP_DIR, filename)
    fs.writeFileSync(filepath, buffer)
    return filepath
  } catch (err) {
    return null
  }
}

async function uploadToSupabase(filePath, storagePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath)
    const fileName = path.basename(filePath)
    const mimeType = filePath.endsWith('.png') ? 'image/png' :
                     filePath.endsWith('.webp') ? 'image/webp' : 'image/jpeg'

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false
      })

    if (error) {
      console.log(`    Upload error: ${error.message}`)
      return null
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath)

    return publicUrl
  } catch (err) {
    console.log(`    Upload error: ${err.message}`)
    return null
  }
}

async function processListing(listing) {
  if (!listing.web_url) {
    return { id: listing.id, status: 'no-url' }
  }

  console.log(`\n[ID: ${listing.id}] ${listing.name} (${listing.city})`)

  // Step 1: Fetch TripAdvisor page
  console.log('  Fetching TripAdvisor page...')
  const html = await fetchTripAdvisorPage(listing.web_url)

  if (!html) {
    console.log('  ✗ Failed to fetch page')
    return { id: listing.id, status: 'fetch-error' }
  }

  console.log('  ✓ Page fetched')

  // Step 2: Extract photo URLs from HTML
  console.log('  Extracting photo URLs...')
  const photoUrls = await extractPhotoUrlsFromHTML(html)

  if (photoUrls.length === 0) {
    console.log('  ✗ No photo URLs found')
    return { id: listing.id, status: 'no-photos' }
  }

  console.log(`  ✓ Found ${photoUrls.length} photos`)

  // Step 3: Download and upload each photo
  const uploadedUrls = []
  
  for (let i = 0; i < photoUrls.length; i++) {
    const photoUrl = photoUrls[i]
    const ext = photoUrl.includes('.png') ? 'png' : 
                photoUrl.includes('.webp') ? 'webp' : 'jpg'
    const filename = `listing-${listing.id}-photo-${i + 1}.${ext}`
    const storagePath = `photos/${listing.id}/${filename}`

    console.log(`    [${i + 1}/${photoUrls.length}] Downloading...`)
    
    const filepath = await downloadImage(photoUrl, filename)
    if (!filepath) {
      console.log(`      ✗ Download failed`)
      continue
    }

    console.log(`      ✓ Downloaded, uploading...`)
    
    const publicUrl = await uploadToSupabase(filepath, storagePath)
    if (!publicUrl) {
      console.log(`      ✗ Upload failed`)
      fs.unlinkSync(filepath)
      continue
    }

    uploadedUrls.push(publicUrl)
    console.log(`      ✓ Uploaded`)

    // Clean up temp file
    fs.unlinkSync(filepath)

    // Rate limit
    await sleep(500)
  }

  if (uploadedUrls.length === 0) {
    console.log('  ✗ No photos could be uploaded')
    return { id: listing.id, status: 'no-uploads' }
  }

  // Step 4: Update database
  console.log(`  Updating database with ${uploadedUrls.length} URLs...`)

  try {
    const { error } = await supabase
      .from('nearby_listings')
      .update({
        photo_urls: uploadedUrls,
        photo_count: uploadedUrls.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', listing.id)

    if (error) throw error

    console.log(`  ✓ Successfully stored ${uploadedUrls.length} photos`)
    return { id: listing.id, status: 'success', count: uploadedUrls.length }
  } catch (err) {
    console.log(`  ✗ Database error: ${err.message}`)
    return { id: listing.id, status: 'db-error' }
  }
}

async function main() {
  console.log('\n=== Download & Store TripAdvisor Photos ===\n')
  console.log(`Config: batch=${BATCH}, limit=${LIMIT}, start=${START}\n`)

  let offset = START
  let totalProcessed = 0
  let stats = { processed: 0, success: 0, failed: 0 }

  while (totalProcessed < LIMIT) {
    console.log(`\n--- Batch: offset=${offset}, limit=${BATCH} ---`)

    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('id, name, city, web_url')
      .not('web_url', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + BATCH - 1)

    if (error) {
      console.error('Database error:', error)
      break
    }

    if (!listings || listings.length === 0) {
      console.log('✓ No more listings')
      break
    }

    console.log(`Found ${listings.length} listings`)

    for (const listing of listings) {
      if (totalProcessed >= LIMIT) break

      const result = await processListing(listing)
      stats.processed++
      totalProcessed++

      if (result.status === 'success') {
        stats.success++
      } else {
        stats.failed++
      }

      await sleep(2000)
    }

    offset += BATCH

    if (listings.length < BATCH) {
      break
    }

    console.log(`\nWaiting before next batch...`)
    await sleep(5000)
  }

  console.log(`\n\n=== RESULTS ===`)
  console.log(`Processed: ${stats.processed}`)
  console.log(`Success: ${stats.success}`)
  console.log(`Failed: ${stats.failed}`)
  console.log(`Success rate: ${stats.processed > 0 ? ((stats.success / stats.processed) * 100).toFixed(1) : 0}%`)

  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
