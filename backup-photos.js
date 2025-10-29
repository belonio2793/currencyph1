#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET_NAME = 'nearby_listings'
const TEMP_DIR = '/tmp/photo_backup'
const MAX_CONCURRENT = 5

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables: VITE_PROJECT_URL and VITE_SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

// Ensure temp directory
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true })
}

console.log('======================================================')
console.log('  Backup Photos to Supabase Storage')
console.log('======================================================')
console.log('')
console.log('Configuration:')
console.log(`  Project URL: ${PROJECT_URL}`)
console.log(`  Bucket: ${BUCKET_NAME}`)
console.log(`  Temp directory: ${TEMP_DIR}`)
console.log('')

let totalPhotos = 0
let downloaded = 0
let uploaded = 0
let failed = 0

async function downloadImage(url, filename) {
  const filepath = path.join(TEMP_DIR, filename)

  // Skip if already cached
  if (fs.existsSync(filepath)) {
    console.log(`  ✓ Already cached: ${filename}`)
    return filepath
  }

  try {
    const cmd = `curl -s -L -f -A "Mozilla/5.0" --max-time 30 "${url}" -o "${filepath}"`
    execSync(cmd, { stdio: 'pipe' })
    console.log(`  ✓ Downloaded: ${filename}`)
    return filepath
  } catch (err) {
    console.log(`  ✗ Failed to download: ${url}`)
    return null
  }
}

async function uploadImage(filepath, bucketPath) {
  if (!fs.existsSync(filepath)) {
    return null
  }

  try {
    const fileBuffer = fs.readFileSync(filepath)
    const ext = path.extname(filepath).toLowerCase()
    
    let contentType = 'image/jpeg'
    if (ext === '.png') contentType = 'image/png'
    else if (ext === '.webp') contentType = 'image/webp'
    else if (ext === '.gif') contentType = 'image/gif'

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(bucketPath, fileBuffer, {
        contentType,
        upsert: true
      })

    if (error) {
      console.log(`  ✗ Upload failed: ${error.message}`)
      return null
    }

    console.log(`  ✓ Uploaded to storage: ${bucketPath}`)
    return bucketPath
  } catch (err) {
    console.log(`  ✗ Upload error: ${err.message}`)
    return null
  }
}

async function main() {
  // Fetch all listings with photo_urls
  console.log('Fetching listings with photos...')
  console.log('')

  const { data: listings, error } = await supabase
    .from('nearby_listings')
    .select('id, name, photo_urls')
    .not('photo_urls', 'is', null)
    .limit(10000)

  if (error) {
    console.error('❌ Failed to fetch listings:', error.message)
    process.exit(1)
  }

  if (!listings || listings.length === 0) {
    console.log('⚠️  No listings with photos found')
    process.exit(0)
  }

  console.log(`Found ${listings.length} listings with photos`)
  console.log('')

  // Process each listing
  for (const listing of listings) {
    const { id, name, photo_urls } = listing
    console.log(`[ID: ${id}] ${name}`)

    // Handle both array and comma-separated string formats
    let urls = []
    if (Array.isArray(photo_urls)) {
      urls = photo_urls.filter(u => u && typeof u === 'string')
    } else if (typeof photo_urls === 'string') {
      urls = photo_urls
        .split(',')
        .map(u => u.trim())
        .filter(u => u && u.startsWith('http'))
    }

    // Download and upload each photo
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]
      totalPhotos++

      // Extract filename from URL
      let filename = url
        .split('/')
        .pop()
        .split('?')[0]
        .substring(0, 200)

      if (!filename || filename.length < 3) {
        filename = `photo_${id}_${i + 1}.jpg`
      }

      // Download
      const filepath = await downloadImage(url, filename)
      if (!filepath) {
        failed++
        continue
      }

      downloaded++

      // Upload to Supabase
      const bucketPath = `listings/${id}/${filename}`
      const uploadResult = await uploadImage(filepath, bucketPath)

      if (uploadResult) {
        uploaded++
      } else {
        failed++
      }
    }
  }

  // Cleanup
  console.log('')
  console.log('Cleaning up temp files...')
  try {
    execSync(`rm -rf ${TEMP_DIR}`)
  } catch (err) {
    // Ignore cleanup errors
  }

  // Summary
  console.log('')
  console.log('======================================================')
  console.log('  Summary')
  console.log('======================================================')
  console.log(`Total photos found: ${totalPhotos}`)
  console.log(`Downloaded: ${downloaded}`)
  console.log(`Uploaded to Supabase: ${uploaded}`)
  console.log(`Failed: ${failed}`)
  console.log('')

  if (uploaded > 0) {
    console.log(`✓ Successfully backed up ${uploaded} photos to Supabase storage!`)
    console.log('')
    console.log(`Photos are stored in: ${BUCKET_NAME}/listings/{listing_id}/{filename}`)
  } else {
    console.log('⚠️  No photos were uploaded. Check errors above.')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
