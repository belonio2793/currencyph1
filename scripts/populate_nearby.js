import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.PROJECT_URL || process.env.VITE_SUPABASE_URL || process.env.VITE_PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const TRIP_KEY = process.env.TRIPADVISOR || process.env.VITE_TRIPADVISOR || process.env.VITE_TRIPADVISOR_API_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Please set PROJECT_URL and SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

const cities = [
  'Manila',
  'Cebu',
  'Davao',
  'Baguio',
  'Iloilo',
  'Bacolod',
  'Cagayan de Oro',
  'Zamboanga',
  'Boracay',
  'Puerto Princesa',
  'El Nido',
  'Tagbilaran',
  'General Luna',
  'Olongapo',
  'San Juan La Union',
  'Vigan',
  'Legazpi',
  'Tagaytay',
  'Bohol',
  'Coron'
]

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Fallback: Use TripAdvisor API if scraping is not available
async function fetchPlacesForViaAPI(query, limit = 50) {
  if (!TRIP_KEY) {
    throw new Error('TRIPADVISOR API key not available')
  }

  const params = new URLSearchParams()
  params.append('query', query)
  params.append('limit', String(limit))

  const url = `https://api.tripadvisor.com/api/partner/2.0/search?${params.toString()}`
  const res = await fetch(url, {
    headers: {
      'X-TripAdvisor-API-Key': TRIP_KEY,
      'Accept': 'application/json'
    }
  })
  
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`TripAdvisor API error: ${res.status} ${text}`)
  }
  
  const json = await res.json()
  const items = json.data || json.results || json || []
  
  return (items || []).map(it => {
    const addr = it.address_obj ? [it.address_obj.street1, it.address_obj.city, it.address_obj.country].filter(Boolean).join(', ') : (it.address || it.address_string || '')
    const id = (it.location_id || it.id || it.place_id)
    return {
      tripadvisor_id: id ? String(id) : `tmp-${Math.random().toString(36).slice(2,10)}`,
      name: it.name || it.title || it.poi_name || '',
      address: addr || null,
      latitude: it.latitude || it.lat || (it.address_obj && it.address_obj.latitude) || null,
      longitude: it.longitude || it.lon || (it.address_obj && it.address_obj.longitude) || null,
      rating: it.rating ? Number(it.rating) : null,
      category: it.subcategory || (it.category && it.category.name) || null,
      raw: it
    }
  })
}

// Web scraping approach - scrape from tripadvisor.com.ph
async function fetchPlacesForViaScraping(city, maxResults = 50) {
  try {
    const query = encodeURIComponent(`${city} Philippines`)
    const url = `https://www.tripadvisor.com.ph/Search?q=${query}`
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status}`)
    }
    
    const html = await res.text()
    
    // Simple regex-based extraction for basic info
    // This is a basic approach; full scraping would need Puppeteer for JS-rendered content
    const listingRegex = /"displayName":"([^"]+)","longitude":(-?[\d.]+),"latitude":(-?[\d.]+)/g
    
    const results = []
    let match
    const seen = new Set()
    
    while ((match = listingRegex.exec(html)) !== null && results.length < maxResults) {
      const name = match[1]
      const longitude = parseFloat(match[2])
      const latitude = parseFloat(match[3])
      
      if (!seen.has(name) && latitude && longitude) {
        seen.add(name)
        results.push({
          tripadvisor_id: `web-${Math.random().toString(36).slice(2,10)}`,
          name: name,
          address: null,
          latitude: latitude,
          longitude: longitude,
          rating: null,
          category: null,
          raw: { source: 'web_scrape' }
        })
      }
    }
    
    return results
  } catch (err) {
    console.warn(`Scraping failed for ${city}, falling back to API:`, err.message)
    return null
  }
}

async function fetchPlacesFor(city, limit = 50) {
  // Try scraping first
  const scrapedResults = await fetchPlacesForViaScraping(city, limit)
  if (scrapedResults && scrapedResults.length > 0) {
    return scrapedResults
  }
  
  // Fall back to API
  try {
    return await fetchPlacesForViaAPI(`${city} Philippines`, limit)
  } catch (err) {
    console.error(`Both scraping and API failed for ${city}:`, err.message)
    return []
  }
}

async function upsertBatch(rows) {
  if (!rows || rows.length === 0) return
  
  const chunkSize = 100
  let upsertedCount = 0
  
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase.from('nearby_listings').upsert(chunk, { onConflict: 'tripadvisor_id' })
    
    if (error) {
      console.error('Upsert error:', error)
    } else {
      console.log(`Upserted ${chunk.length} rows`)
      upsertedCount += chunk.length
    }
    
    await sleep(300)
  }
  
  return upsertedCount
}

async function main() {
  try {
    console.log('Starting populate_nearby...')
    const allRows = []
    
    for (const city of cities) {
      try {
        console.log(`Fetching for ${city}...`)
        const rows = await fetchPlacesFor(city, 50)
        console.log(`Fetched ${rows.length} items for ${city}`)
        allRows.push(...rows)
      } catch (err) {
        console.error(`Failed to fetch ${city}:`, err.message)
      }
      
      await sleep(1000)
    }
    
    // Dedupe by tripadvisor_id
    const dedup = {}
    for (const r of allRows) {
      dedup[r.tripadvisor_id] = r
    }
    const unique = Object.values(dedup)
    
    console.log(`Total unique items to upsert: ${unique.length}`)
    
    const upserted = await upsertBatch(unique)
    console.log(`Populate complete. Upserted ${upserted} listings`)
  } catch (err) {
    console.error('Populate failed:', err)
    process.exit(2)
  }
}

main()
