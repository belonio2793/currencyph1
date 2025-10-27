#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const TRIPADVISOR_KEY = process.env.VITE_TRIPADVISOR || process.env.TRIPADVISOR

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables')
  console.error('Please set: PROJECT_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

// Comprehensive Philippine cities
const PHILIPPINES_CITIES = [
  // Metro Manila (NCR)
  'Manila', 'Quezon City', 'Makati', 'Pasig', 'Taguig', 'Caloocan', 'Las Piñas', 'Parañaque', 
  'Marikina', 'Mandaluyong', 'San Juan', 'Malabon', 'Navotas', 'Valenzuela',
  // Nearby NCR
  'Antipolo', 'Cainta', 'Tanay', 'Paete', 'Angono', 'Montalban', 'Norzagaray', 'Bulakan',
  'Malolos', 'San Fernando', 'Plaridel', 'Meycauayan', 'Obando', 'Calumpit',
  // Luzon - Tagalog Region
  'Baguio', 'Tagaytay', 'Cabanatuan', 'Muñoz', 'Gapan', 'Lucena', 'Tayabas',
  'Baler', 'Casiguran', 'Dingalan', 'Lipa', 'Nasugbu', 'Tanauan', 'Olongapo',
  // Luzon - Bicol Region
  'Legazpi', 'Naga', 'Sorsogon', 'Camarines Sur', 'Camarines Norte', 'Tabaco',
  // Visayas
  'Cebu City', 'Cebu', 'Iloilo City', 'Iloilo', 'Bacolod', 'Boracay', 'Aklan', 'Kalibo',
  'Capiz', 'Roxas', 'Antique', 'Guimaras', 'Jordan', 'Dumaguete', 'Siquijor', 'Tagbilaran',
  'Bohol', 'Lapu-Lapu', 'Mandaue', 'Talisay', 'Moalboal', 'Oslob', 'Alcoy', 'Carcar',
  'Toledo', 'Danao', 'Siargao', 'Surigao City', 'Butuan', 'General Santos', 'Cotabato',
  // Mindanao
  'Davao City', 'Davao', 'Cagayan de Oro', 'Zamboanga City', 'Iligan', 'Marawi', 'Butuan',
  'Surigao', 'Tandag', 'Bislig', 'Pagadian', 'Ozamiz', 'Dipolog', 'Dapitan', 'Koronadal',
  // Palawan
  'Puerto Princesa', 'El Nido', 'Coron', 'Busuanga', 'Linapacan', 'Balabac',
  // Tourist destinations
  'Boracay', 'Palawan', 'Siargao', 'Camiguin', 'General Luna', 'Port Barton',
  'Caticlan', 'San Juan La Union', 'Pagudpud', 'Vigan', 'Batanes', 'Marinduque'
]

const SEARCH_CATEGORIES = [
  'attractions', 'things to do', 'museums', 'historical sites', 'parks',
  'beaches', 'hotels', 'restaurants', 'churches', 'temples'
]

// Logging utility
const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  warn: (msg) => console.log(`⚠️  ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
  progress: (current, total, msg) => {
    const pct = ((current / total) * 100).toFixed(0)
    console.log(`[${pct}%] ${msg}`)
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fetch from TripAdvisor API
 */
async function fetchFromTripAdvisorAPI(query, retries = 3) {
  if (!TRIPADVISOR_KEY) {
    log.warn('TripAdvisor API key not available, skipping API fetch')
    return []
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const params = new URLSearchParams()
      params.append('query', query)
      params.append('limit', '15')

      const response = await fetch(
        `https://api.tripadvisor.com/api/partner/2.0/search?${params.toString()}`,
        {
          headers: {
            'X-TripAdvisor-API-Key': TRIPADVISOR_KEY,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      )

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited
          const wait = Math.pow(2, attempt) * 1000
          log.warn(`Rate limited, waiting ${wait}ms before retry...`)
          await sleep(wait)
          continue
        }
        return []
      }

      const data = await response.json()
      const items = data.data || data.results || []

      return items.map(item => {
        const addr = item.address_obj ? 
          [item.address_obj.street1, item.address_obj.city, item.address_obj.country]
            .filter(Boolean).join(', ') : 
          (item.address || item.address_string || '')

        return {
          tripadvisor_id: String(item.location_id || item.id || Math.random().toString(36).slice(2)),
          name: item.name || item.title || '',
          address: addr || null,
          latitude: item.latitude || item.lat || (item.address_obj?.latitude) || null,
          longitude: item.longitude || item.lon || (item.address_obj?.longitude) || null,
          rating: item.rating ? Number(item.rating) : null,
          review_count: item.review_count || item.num_reviews || 0,
          category: item.subcategory || item.category?.name || item.type || null,
          image: item.photo?.images?.original?.url || item.image_url || null,
          raw: item
        }
      })
    } catch (err) {
      log.warn(`API fetch attempt ${attempt} failed: ${err.message}`)
      if (attempt < retries) {
        await sleep(1000 * attempt)
      }
    }
  }

  return []
}

/**
 * Scrape TripAdvisor Philippines website for additional data
 */
async function scrapeTripadvisorPH(city, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const searchUrl = `https://www.tripadvisor.com.ph/Search?q=${encodeURIComponent(city + ' Philippines')}`

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })

      if (!response.ok) {
        return []
      }

      const html = await response.text()

      // Extract JSON-LD or structured data from page
      const jsonMatches = html.match(/"displayName":"([^"]+)"[^}]*"location_id":"?(\d+)"?[^}]*"longitude":(-?[\d.]+)[^}]*"latitude":(-?[\d.]+)/g) || []
      
      const results = []
      const seen = new Set()

      jsonMatches.forEach(match => {
        const nameMatch = match.match(/"displayName":"([^"]+)"/)
        const idMatch = match.match(/"location_id":"?(\d+)/)
        const latMatch = match.match(/"latitude":(-?[\d.]+)/)
        const lonMatch = match.match(/"longitude":(-?[\d.]+)/)

        if (nameMatch && idMatch && latMatch && lonMatch) {
          const name = nameMatch[1]
          const id = idMatch[1]

          if (!seen.has(id)) {
            seen.add(id)
            results.push({
              tripadvisor_id: String(id),
              name: name.replace(/\\u[\dA-Fa-f]{4}/g, u => String.fromCharCode(parseInt(u.replace(/\\u/, ''), 16))),
              address: null,
              latitude: parseFloat(latMatch[1]),
              longitude: parseFloat(lonMatch[1]),
              rating: null,
              review_count: 0,
              category: null,
              image: null,
              raw: { source: 'tripadvisor_ph_scrape' }
            })
          }
        }
      })

      return results
    } catch (err) {
      log.warn(`Scrape attempt ${attempt} for ${city} failed: ${err.message}`)
      if (attempt < retries) {
        await sleep(500)
      }
    }
  }

  return []
}

/**
 * Combine and deduplicate results
 */
function combineAndDeduplicate(apiResults, scrapeResults) {
  const map = {}

  // Add API results first (more detailed)
  for (const item of apiResults) {
    if (item.tripadvisor_id) {
      map[item.tripadvisor_id] = item
    }
  }

  // Add scrape results (fill in gaps)
  for (const item of scrapeResults) {
    if (item.tripadvisor_id && !map[item.tripadvisor_id]) {
      map[item.tripadvisor_id] = item
    }
  }

  return Object.values(map)
}

/**
 * Upsert listings to database in batches
 */
async function upsertBatch(rows) {
  if (!rows || rows.length === 0) return 0

  const chunkSize = 50
  let upsertedCount = 0

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)

    // Ensure all required fields
    const cleanedChunk = chunk.map(item => ({
      tripadvisor_id: item.tripadvisor_id || `temp-${Math.random()}`,
      name: item.name || 'Unknown',
      address: item.address,
      latitude: item.latitude ? Number(item.latitude) : null,
      longitude: item.longitude ? Number(item.longitude) : null,
      rating: item.rating ? Number(item.rating) : null,
      review_count: item.review_count ? Number(item.review_count) : 0,
      category: item.category,
      image: item.image,
      raw: item.raw
    }))

    const { error } = await supabase
      .from('nearby_listings')
      .upsert(cleanedChunk, { onConflict: 'tripadvisor_id' })

    if (error) {
      log.error(`Upsert error: ${error.message}`)
    } else {
      upsertedCount += chunk.length
      log.success(`Upserted ${chunk.length} listings (batch ${Math.floor(i / chunkSize) + 1})`)
    }

    await sleep(300)
  }

  return upsertedCount
}

/**
 * Main fetcher
 */
async function main() {
  try {
    log.info('🇵🇭 Starting TripAdvisor Philippines listing fetcher...\n')

    // Get existing count
    const { count: existingCount } = await supabase
      .from('nearby_listings')
      .select('*', { count: 'exact', head: true })

    log.info(`Current listings in database: ${existingCount || 0}\n`)

    const allListings = []
    const totalCities = PHILIPPINES_CITIES.length
    const totalWork = totalCities

    for (let i = 0; i < PHILIPPINES_CITIES.length; i++) {
      const city = PHILIPPINES_CITIES[i]
      log.progress(i + 1, totalWork, `Processing ${city}...`)

      // Fetch from both sources
      const apiResults = await fetchFromTripAdvisorAPI(`${city} Philippines attractions things to do`, 1)
      await sleep(300)

      const scrapeResults = await scrapeTripadvisorPH(city)
      await sleep(300)

      // Combine results
      const combined = combineAndDeduplicate(apiResults, scrapeResults)

      if (combined.length > 0) {
        log.success(`Found ${combined.length} listings in ${city}`)
        allListings.push(...combined)
      }

      // Rate limiting
      await sleep(400)
    }

    log.info(`\n📊 Total unique listings collected: ${allListings.length}`)

    if (allListings.length > 0) {
      log.info('💾 Upserting to database...\n')
      const upserted = await upsertBatch(allListings)

      log.success(`\n✨ Successfully upserted ${upserted} listings!`)

      // Get new count
      const { count: newCount } = await supabase
        .from('nearby_listings')
        .select('*', { count: 'exact', head: true })

      log.info(`\n📈 Database now contains: ${newCount || 0} listings`)
      log.info(`Added: ${(newCount || 0) - (existingCount || 0)} new listings`)
    } else {
      log.warn('No listings found')
    }

  } catch (err) {
    log.error(`Fatal error: ${err.message}`)
    console.error(err)
    process.exit(2)
  }
}

main()
