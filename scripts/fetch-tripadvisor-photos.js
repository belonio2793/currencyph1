#!/usr/bin/env node
/*
fetch-tripadvisor-photos.js

Uses xAI Grok to find TripAdvisor listings and extract high-resolution photo URLs
Then downloads and uploads them to Supabase bucket
*/

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const X_API_KEY = process.env.X_API_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

if (!X_API_KEY) {
  console.error('❌ Missing X_API_KEY (Grok)')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function askGrok(prompt) {
  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${X_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2000
      }),
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.warn(`⚠️  Grok API error: ${res.status}`)
      return null
    }

    const data = await res.json()
    return data?.choices?.[0]?.message?.content || null
  } catch (err) {
    console.warn(`⚠️  Grok request error: ${err.message}`)
    return null
  }
}

async function downloadPhoto(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      if (!res.ok) {
        if (i < maxRetries - 1) await sleep(500)
        continue
      }

      const buffer = await res.buffer()
      return buffer
    } catch (err) {
      if (i < maxRetries - 1) await sleep(500)
    }
  }
  return null
}

async function uploadPhotoToSupabase(photoBuffer, listing, photoIndex) {
  try {
    const folderPath = `nearby_listings/${listing.id}`
    const fileName = `photo-${photoIndex}.jpg`
    const filePath = `${folderPath}/${fileName}`

    const { error: uploadError, data } = await supabase.storage
      .from('nearby_listings')
      .upload(filePath, photoBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      })

    if (uploadError) {
      console.error(`    ❌ Upload error: ${uploadError.message}`)
      return null
    }

    const { data: publicUrl } = supabase.storage
      .from('nearby_listings')
      .getPublicUrl(filePath)

    return publicUrl.publicUrl
  } catch (err) {
    console.error(`    ❌ Upload exception: ${err.message}`)
    return null
  }
}

async function findTripAdvisorPhotos(listing) {
  const query = `${listing.name}, ${listing.city || ''}, Philippines`
  const prompt = `Find the TripAdvisor page for "${query}". Extract the direct URLs to the 5-10 highest quality/resolution photos from the gallery section. Return ONLY a JSON array of photo URLs, nothing else. Example format: ["https://...", "https://...", ...]. If you cannot find the listing, return an empty array [].`

  console.log(`🔍 Searching Grok for: ${query}`)
  const response = await askGrok(prompt)

  if (!response) {
    console.log(`  ⚠️  No response from Grok`)
    return []
  }

  try {
    // Extract JSON array from response
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.log(`  ⚠️  No JSON array found in response`)
      return []
    }

    const urls = JSON.parse(jsonMatch[0])
    return urls.filter(url => typeof url === 'string' && url.startsWith('http'))
  } catch (err) {
    console.log(`  ⚠️  Failed to parse photo URLs: ${err.message}`)
    return []
  }
}

async function processListing(listing) {
  console.log(`\n📸 Processing: ${listing.name} (${listing.city})`)

  // Find photos on TripAdvisor
  const photoUrls = await findTripAdvisorPhotos(listing)

  if (photoUrls.length === 0) {
    console.log(`  ⚠️  No photos found`)
    return false
  }

  console.log(`  ✓ Found ${photoUrls.length} photos`)

  // Download and upload photos
  const uploadedUrls = []
  for (let i = 0; i < photoUrls.length; i++) {
    const url = photoUrls[i]
    console.log(`  ⬇️  Downloading photo ${i + 1}/${photoUrls.length}...`)

    const buffer = await downloadPhoto(url)
    if (!buffer) {
      console.log(`    ❌ Failed to download`)
      continue
    }

    console.log(`  ⬆️  Uploading to Supabase...`)
    const uploadedUrl = await uploadPhotoToSupabase(buffer, listing, i + 1)
    if (uploadedUrl) {
      uploadedUrls.push(uploadedUrl)
      console.log(`    ✓ Uploaded`)
    }

    await sleep(300)
  }

  // Update database
  if (uploadedUrls.length > 0) {
    const { error: dbError } = await supabase
      .from('nearby_listings')
      .update({
        photo_urls: uploadedUrls,
        updated_at: new Date().toISOString()
      })
      .eq('id', listing.id)

    if (dbError) {
      console.error(`  ❌ Database update error: ${dbError.message}`)
      return false
    }

    console.log(`  ✅ Updated database with ${uploadedUrls.length} photos`)
    return true
  }

  return false
}

async function main() {
  const args = process.argv.slice(2)
  let batchSize = 10
  let start = 0

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--batch' && args[i + 1]) batchSize = Number(args[i + 1])
    if (args[i] === '--start' && args[i + 1]) start = Number(args[i + 1])
  }

  console.log(`\n🎬 TripAdvisor Photo Fetcher`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`Batch: ${batchSize}, Starting from: ${start}\n`)

  // Get listings without photos
  const { data: listings, error } = await supabase
    .from('nearby_listings')
    .select('id,name,city')
    .is('photo_urls', null)
    .range(start, start + batchSize - 1)

  if (error) {
    console.error('❌ Error fetching listings:', error)
    process.exit(1)
  }

  if (!listings || listings.length === 0) {
    console.log('✅ No listings without photos found!')
    process.exit(0)
  }

  console.log(`Found ${listings.length} listings without photos\n`)

  let processed = 0
  let successful = 0

  for (const listing of listings) {
    processed++
    const success = await processListing(listing)
    if (success) successful++
    await sleep(1000) // Rate limiting
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`✅ Completed!`)
  console.log(`   Processed: ${processed}`)
  console.log(`   Successful: ${successful}`)
  console.log(`━━━━━━━━��━━━━━━━━━━━━━━━━━━\n`)
}

main().catch(err => {
  console.error('💥 Fatal error:', err)
  process.exit(1)
})
