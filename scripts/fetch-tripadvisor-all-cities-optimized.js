#!/usr/bin/env node

import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
const X_API_KEY = process.env.X_API_KEY
const SCRAPINGBEE_KEY = process.env.SCRAPINGBEE_API_KEY || 'Z3CQBBBPQIA4FQAQOHWJVO40ZKIRMM7LNUBVOQVAN2VP2PE2F1PQO9JGJZ5C9U9C9LRWK712V7P963C9'

if (!SUPABASE_URL || !SUPABASE_KEY || !X_API_KEY) {
  console.error('❌ Missing required credentials')
  console.error('  - VITE_PROJECT_URL:', SUPABASE_URL ? '✓' : '✗')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_KEY ? '✓' : '✗')
  console.error('  - X_API_KEY:', X_API_KEY ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const PHILIPPINE_CITIES = [
  'Manila', 'Cebu City', 'Davao City', 'Quezon City', 'Caloocan', 'Las Piñas', 'Makati', 'Pasig',
  'Taguig', 'Parañaque', 'Muntinlupa', 'Bacoor', 'Cavite City', 'Dasmariñas', 'Imus',
  'Boracay', 'Baguio', 'Bohol', 'Coron', 'El Nido', 'Palawan', 'Siargao', 'Valencia',
  'Iloilo City', 'Bacolod', 'Cagayan de Oro', 'Dumaguete', 'Lapu-Lapu', 'Mandaue',
  'Butuan', 'Calbayog', 'Catbalogan', 'Tacloban', 'Vigan', 'Dagupan', 'San Fernando',
  'Angeles City', 'Olongapo', 'Baliuag', 'Cabanatuan', 'Lucena', 'Tagaytay', 'Antipolo',
  'General Santos', 'Cotabato City', 'Koronadal', 'Zamboanga City', 'Dipolog',
  'Legazpi', 'Naga', 'Sorsogon', 'Masbate City', 'Roxas', 'Iloilo', 'Bacolod',
  'Kalibo', 'Caticlan', 'Puerto Princesa', 'Pagadian', 'General Santos'
]

const CATEGORIES = [
  { name: 'Hotels', type: 'hotel' },
  { name: 'Restaurants', type: 'restaurant' },
  { name: 'Attractions', type: 'attraction' }
]

let stats = {
  citiesProcessed: 0,
  listingsCreated: 0,
  listingsUpdated: 0,
  photosAdded: 0,
  errors: 0,
  startTime: Date.now()
}

const CHECKPOINT_FILE = path.join(__dirname, '.tripadvisor-fetch-checkpoint.json')

function saveCheckpoint(cityIndex) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({
    lastCityIndex: cityIndex,
    stats: stats,
    timestamp: new Date().toISOString()
  }, null, 2))
}

function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'))
    } catch (e) {
      return null
    }
  }
  return null
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function grokFetchListings(city, category) {
  try {
    const prompt = `Find the top 15 ${category.name} in ${city}, Philippines from TripAdvisor (tripadvisor.com.ph). 
Return a JSON array where each object has:
- name: string
- address: string  
- rating: number (0-5)
- review_count: number
- url: full tripadvisor.com.ph URL
- description: 1 sentence
- category: "${category.name}"

Just return the JSON array, no other text.`

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${X_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-2',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1500
      }),
      timeout: 30000
    })

    if (!response.ok) {
      console.warn(`⚠️  Grok API returned ${response.status}`)
      return []
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (!jsonMatch) return []
      const parsed = JSON.parse(jsonMatch[0])
      return Array.isArray(parsed) ? parsed : []
    } catch (e) {
      return []
    }
  } catch (err) {
    console.warn(`⚠️  Grok error: ${err.message}`)
    return []
  }
}

async function extractPhotosFromUrl(url) {
  try {
    if (!url || !url.includes('tripadvisor')) return []

    const scrapingResponse = await fetch('https://api.scrapingbee.com/api/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: SCRAPINGBEE_KEY,
        url: url,
        render_javascript: true,
        timeout: 30000
      })
    })

    if (!scrapingResponse.ok) return []

    const html = await scrapingResponse.text()
    const photoUrls = []

    // Extract TripAdvisor photo URLs
    const patterns = [
      /https:\/\/media-cdn\.tripadvisor\.com\/media\/photo-[a-zA-Z]\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[^"\s<>]+\.jpg/g,
      /https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo-[a-zA-Z]\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[^"\s<>]+\.jpg/g
    ]

    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(html)) !== null) {
        const url = match[0]
        if (!photoUrls.includes(url) && photoUrls.length < 8) {
          photoUrls.push(url)
        }
      }
    }

    return photoUrls
  } catch (err) {
    return []
  }
}

async function upsertListing(listing, city, categoryType) {
  try {
    // Check for existing
    const { data: existing } = await supabase
      .from('nearby_listings')
      .select('id')
      .ilike('name', listing.name)
      .eq('city', city)
      .maybeSingle()

    // Extract photos
    let photos = []
    if (listing.url) {
      photos = await extractPhotosFromUrl(listing.url)
      await sleep(1000) // Rate limit ScrapingBee
    }

    const listingRecord = {
      name: listing.name,
      address: listing.address || '',
      city: city,
      country: 'Philippines',
      category: listing.category || categoryType,
      rating: Math.min(5, Math.max(0, listing.rating || 0)),
      review_count: listing.review_count || 0,
      description: listing.description || '',
      tripadvisor_url: listing.url,
      photos: photos,
      photo_count: photos.length,
      updated_at: new Date().toISOString()
    }

    if (existing) {
      await supabase
        .from('nearby_listings')
        .update(listingRecord)
        .eq('id', existing.id)

      if (photos.length > 0) stats.photosAdded++
      stats.listingsUpdated++
    } else {
      listingRecord.created_at = new Date().toISOString()
      await supabase
        .from('nearby_listings')
        .insert([listingRecord])

      if (photos.length > 0) stats.photosAdded++
      stats.listingsCreated++
    }
  } catch (err) {
    console.warn(`⚠️  Error upserting ${listing.name}:`, err.message)
    stats.errors++
  }
}

async function processCityListings(city) {
  console.log(`\n  🏙️  ${city}`)
  let cityListingsCount = 0

  for (const category of CATEGORIES) {
    try {
      const listings = await grokFetchListings(city, category)
      if (listings.length === 0) continue

      console.log(`    📍 ${category.name}: ${listings.length} found`)

      for (const listing of listings) {
        await upsertListing(listing, city, category.type)
        await sleep(300)
      }

      cityListingsCount += listings.length
      await sleep(1000)
    } catch (err) {
      console.warn(`⚠️  Error fetching ${category.name} for ${city}`)
    }
  }

  stats.citiesProcessed++
  return cityListingsCount
}

async function main() {
  try {
    const checkpoint = loadCheckpoint()
    let startIndex = 0

    if (checkpoint && process.argv.includes('--resume')) {
      startIndex = checkpoint.lastCityIndex + 1
      Object.assign(stats, checkpoint.stats)
      console.log(`📍 Resuming from city ${startIndex + 1}...`)
    }

    console.log('\n🚀 TripAdvisor Comprehensive Fetch')
    console.log('═══════════════════════════════════════')
    console.log(`📊 Total cities: ${PHILIPPINE_CITIES.length}`)
    console.log(`📁 Categories: ${CATEGORIES.map(c => c.name).join(', ')}`)
    console.log(`⏱️  Starting...\n`)

    for (let i = startIndex; i < PHILIPPINE_CITIES.length; i++) {
      const city = PHILIPPINE_CITIES[i]
      const progress = `[${i + 1}/${PHILIPPINE_CITIES.length}]`

      process.stdout.write(`${progress} `)

      try {
        const count = await processCityListings(city)
        process.stdout.write(`✅ ${count} listings\n`)
      } catch (err) {
        console.error(`\n❌ Fatal error processing ${city}:`, err.message)
        stats.errors++
      }

      // Save checkpoint every 5 cities
      if ((i + 1) % 5 === 0) {
        saveCheckpoint(i)
        const elapsed = ((Date.now() - stats.startTime) / 1000 / 60).toFixed(1)
        console.log(`    ⏱️  Checkpoint saved (${elapsed}m elapsed)`)
      }
    }

    const totalTime = ((Date.now() - stats.startTime) / 1000 / 60).toFixed(1)

    console.log('\n\n📊 FINAL REPORT')
    console.log('═══════════════════════════════════════')
    console.log(`Cities processed: ${stats.citiesProcessed}/${PHILIPPINE_CITIES.length}`)
    console.log(`New listings created: ${stats.listingsCreated}`)
    console.log(`Existing listings updated: ${stats.listingsUpdated}`)
    console.log(`Listings with photos: ${stats.photosAdded}`)
    console.log(`Errors: ${stats.errors}`)
    console.log(`⏱️  Total time: ${totalTime} minutes`)

    // Clean up checkpoint
    if (fs.existsSync(CHECKPOINT_FILE)) {
      fs.unlinkSync(CHECKPOINT_FILE)
    }

  } catch (err) {
    console.error('\n❌ Fatal error:', err.message)
    process.exit(1)
  }
}

console.log('Initializing...')
main().then(() => {
  console.log('\n✅ Complete!\n')
  process.exit(0)
}).catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
