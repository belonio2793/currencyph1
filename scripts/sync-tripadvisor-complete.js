#!/usr/bin/env node
/**
 * sync-tripadvisor-complete.js
 * 
 * Fetch complete TripAdvisor data for all nearby_listings rows
 * Matches by name + city, updates with full details (photos, ratings, reviews, etc.)
 * 
 * Usage:
 *   node scripts/sync-tripadvisor-complete.js --city=Manila --limit=50
 *   node scripts/sync-tripadvisor-complete.js --all-cities
 *   node scripts/sync-tripadvisor-complete.js --resume
 * 
 * Environment variables:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   TRIPADVISOR_API_KEY (provided)
 */

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import { promises as fs } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Config
const SUPABASE_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL || 'https://corcofbmafdxehvlbesx.supabase.co'
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const TRIPADVISOR_API_KEY = 'REPLACE_ENV.TRIPADVISOR_API_KEY'
const TA_SEARCH_ENDPOINT = 'https://api.content.tripadvisor.com/api/v1/location/search'
const TA_DETAILS_ENDPOINT = 'https://api.content.tripadvisor.com/api/v1/location/{locationId}/details'

const BATCH_SIZE = 20
const REQUEST_DELAY = 500 // ms between API calls (respect rate limits)
const CHECKPOINT_FILE = join(__dirname, '..', 'ta_sync_checkpoint.json')
const BACKUP_FILE = join(__dirname, '..', 'ta_sync_backup.json')

// Parse args
const args = process.argv.slice(2)
let targetCity = null
let allCities = false
let limit = 0
let resume = false

for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--city=')) {
    targetCity = args[i].split('=')[1]
  }
  if (args[i] === '--all-cities') {
    allCities = true
  }
  if (args[i].startsWith('--limit=')) {
    limit = parseInt(args[i].split('=')[1]) || 0
  }
  if (args[i] === '--resume') {
    resume = true
  }
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// Sleep helper
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// Extract location ID from TripAdvisor URL or return null
function extractLocationIdFromUrl(url) {
  if (!url) return null
  const match = url.match(/d(\d+)/)
  return match ? match[1] : null
}

// Fetch location details from TripAdvisor
async function fetchTripAdvisorDetails(locationId) {
  try {
    const url = TA_DETAILS_ENDPOINT.replace('{locationId}', locationId)
    const response = await fetch(
      `${url}?language=en&key=${TRIPADVISOR_API_KEY}`
    )

    if (!response.ok) {
      console.warn(`  ⚠️  TripAdvisor API error ${response.status} for location ${locationId}`)
      return null
    }

    const data = await response.json()
    return data
  } catch (err) {
    console.warn(`  ⚠️  Failed to fetch TripAdvisor details:`, err.message)
    return null
  }
}

// Search TripAdvisor by name + city
async function searchTripAdvisor(name, city) {
  try {
    const query = `${name}, ${city}`
    const response = await fetch(
      `${TA_SEARCH_ENDPOINT}?query=${encodeURIComponent(query)}&language=en&key=${TRIPADVISOR_API_KEY}`
    )

    if (!response.ok) {
      console.warn(`  ⚠️  TripAdvisor search error ${response.status}`)
      return null
    }

    const data = await response.json()
    if (data.data && data.data.length > 0) {
      return data.data[0] // Return first (best) match
    }
    return null
  } catch (err) {
    console.warn(`  ⚠️  Failed to search TripAdvisor:`, err.message)
    return null
  }
}

// Transform TripAdvisor data to listing format
function transformTripAdvisorData(taData, localListing) {
  if (!taData) return localListing

  const photos = taData.photos ? taData.photos.map(p => p.url || p.source_url).filter(Boolean) : []

  return {
    ...localListing,
    tripadvisor_id: taData.location_id || localListing.tripadvisor_id,
    name: taData.name || localListing.name,
    web_url: taData.web_url || localListing.web_url,
    address: taData.address_obj?.address_string || localListing.address,
    latitude: taData.latitude || localListing.latitude,
    longitude: taData.longitude || localListing.longitude,
    rating: taData.rating ? parseFloat(taData.rating) : localListing.rating,
    review_count: taData.review_count || localListing.review_count,
    category: taData.category?.name || localListing.category,
    location_type: taData.category?.key || localListing.location_type,
    
    // Photos
    photo_urls: photos.length > 0 ? photos : localListing.photo_urls,
    photo_count: photos.length || localListing.photo_count,
    primary_image_url: photos[0] || localListing.primary_image_url,
    featured_image_url: photos[0] || localListing.featured_image_url,
    image_url: photos[0] || localListing.image_url,
    
    // Contact
    phone_number: taData.phone || localListing.phone_number,
    website: taData.website || localListing.website,
    
    // Details
    description: taData.description || localListing.description,
    hours_of_operation: taData.hours || localListing.hours_of_operation,
    
    // Metadata
    raw: taData,
    verified: true,
    last_verified_at: new Date().toISOString(),
    fetch_status: 'success',
    fetch_error_message: null,
    updated_at: new Date().toISOString()
  }
}

// Main sync function
async function main() {
  console.log('🔄 Starting TripAdvisor sync...\n')

  // Load checkpoint if resuming
  let processedCount = 0
  let lastCity = null
  if (resume) {
    try {
      const checkpoint = JSON.parse(await fs.readFile(CHECKPOINT_FILE, 'utf-8'))
      processedCount = checkpoint.processedCount || 0
      lastCity = checkpoint.lastCity
      console.log(`✅ Resuming from checkpoint: ${processedCount} processed, last city: ${lastCity}\n`)
    } catch (err) {
      console.log('📝 No checkpoint found, starting fresh\n')
    }
  }

  // Get all cities from nearby_listings
  console.log('📍 Fetching cities from nearby_listings...')
  const { data: allListings, error: fetchErr } = await supabase
    .from('nearby_listings')
    .select('id, name, city, latitude, longitude, tripadvisor_id, web_url')
    .order('city')

  if (fetchErr) {
    console.error('❌ Failed to fetch listings:', fetchErr)
    process.exit(1)
  }

  console.log(`✅ Loaded ${allListings.length} listings\n`)

  // Backup original data
  await fs.writeFile(BACKUP_FILE, JSON.stringify(allListings, null, 2))
  console.log(`✅ Backup saved to ${BACKUP_FILE}\n`)

  // Group by city
  const byCity = {}
  allListings.forEach(listing => {
    const city = listing.city || 'Unknown'
    if (!byCity[city]) byCity[city] = []
    byCity[city].push(listing)
  })

  const citiesToProcess = targetCity ? [targetCity] : Object.keys(byCity)
  console.log(`🏙️  Cities to process: ${citiesToProcess.join(', ')}\n`)

  // Process each city
  for (const city of citiesToProcess) {
    if (!byCity[city]) {
      console.log(`⚠️  City not found: ${city}`)
      continue
    }

    console.log(`\n📍 Processing city: ${city}`)
    const cityListings = byCity[city]
    const toProcess = limit > 0 ? cityListings.slice(0, limit) : cityListings

    const updates = []

    for (let i = 0; i < toProcess.length; i++) {
      const listing = toProcess[i]
      const progress = `[${processedCount + i + 1}/${allListings.length}]`

      console.log(`\n${progress} ${listing.name}`)

      // Try to get TripAdvisor data
      let taData = null

      // Strategy 1: If already has valid tripadvisor_id, fetch details
      if (listing.tripadvisor_id && !listing.tripadvisor_id.includes('unsplash')) {
        console.log(`  🔍 Fetching details for existing ID: ${listing.tripadvisor_id}`)
        taData = await fetchTripAdvisorDetails(listing.tripadvisor_id)
      }

      // Strategy 2: If has TripAdvisor URL, extract ID and fetch
      if (!taData && listing.web_url && listing.web_url.includes('tripadvisor')) {
        const locationId = extractLocationIdFromUrl(listing.web_url)
        if (locationId) {
          console.log(`  🔍 Fetching details from URL ID: ${locationId}`)
          taData = await fetchTripAdvisorDetails(locationId)
        }
      }

      // Strategy 3: Search TripAdvisor by name + city
      if (!taData) {
        console.log(`  🔎 Searching TripAdvisor for: "${listing.name}" in ${city}`)
        const searchResult = await searchTripAdvisor(listing.name, city)
        if (searchResult) {
          console.log(`  ✅ Found: ${searchResult.name} (ID: ${searchResult.location_id})`)
          taData = await fetchTripAdvisorDetails(searchResult.location_id)
        }
      }

      // Transform and prepare update
      if (taData) {
        console.log(`  📝 Updating with TripAdvisor data`)
        const updated = transformTripAdvisorData(taData, listing)
        updates.push(updated)
      } else {
        console.log(`  ⚠️  No TripAdvisor data found, keeping local data`)
        updates.push({
          ...listing,
          fetch_status: 'not_found',
          fetch_error_message: 'Could not find on TripAdvisor'
        })
      }

      // Batch upsert when we reach batch size
      if (updates.length >= BATCH_SIZE || i === toProcess.length - 1) {
        console.log(`\n  💾 Upserting ${updates.length} records...`)
        try {
          const { error: upsertErr } = await supabase
            .from('nearby_listings')
            .upsert(updates, { onConflict: 'id' })

          if (upsertErr) {
            console.error(`  ❌ Upsert error:`, upsertErr)
          } else {
            console.log(`  ✅ Upserted ${updates.length} records`)
            processedCount += updates.length
          }
        } catch (err) {
          console.error(`  ❌ Upsert failed:`, err.message)
        }

        updates.length = 0

        // Save checkpoint
        await fs.writeFile(CHECKPOINT_FILE, JSON.stringify({
          processedCount,
          lastCity: city,
          timestamp: new Date().toISOString()
        }))

        // Respect rate limits
        await sleep(REQUEST_DELAY)
      }
    }
  }

  console.log(`\n✅ Sync complete! Processed: ${processedCount} listings`)
  console.log(`📊 Checkpoint saved to ${CHECKPOINT_FILE}`)
}

main().catch(err => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
