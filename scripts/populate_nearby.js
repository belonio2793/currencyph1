import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.PROJECT_URL || process.env.VITE_SUPABASE_URL || process.env.VITE_PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const TRIP_KEY = process.env.TRIPADVISOR || process.env.VITE_TRIPADVISOR || process.env.VITE_TRIPADVISOR_API_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Please set PROJECT_URL and SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}
if (!TRIP_KEY) {
  console.error('Please set TRIPADVISOR (or VITE_TRIPADVISOR) environment variable')
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

async function fetchPlacesFor(query, limit = 50) {
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
    const id = (it.location_id || it.id || it.place_id || it.location_id)
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

async function upsertBatch(rows) {
  if (!rows || rows.length === 0) return
  // limit batch size to 100
  const chunkSize = 100
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase.from('nearby_listings').upsert(chunk, { onConflict: 'tripadvisor_id' })
    if (error) {
      console.error('Upsert error:', error)
    } else {
      console.log(`Upserted ${chunk.length} rows`)
    }
    // small pause to avoid hammering DB
    await sleep(300)
  }
}

async function main() {
  try {
    console.log('Starting populate_nearby...')
    const allRows = []
    for (const city of cities) {
      try {
        console.log('Fetching for', city)
        const rows = await fetchPlacesFor(`${city} Philippines`, 50)
        console.log(`Fetched ${rows.length} items for ${city}`)
        allRows.push(...rows)
      } catch (err) {
        console.error(`Failed fetch for ${city}:`, err.message)
      }
      // be kind to TripAdvisor API
      await sleep(1000)
    }

    // dedupe by tripadvisor_id
    const dedup = {}
    for (const r of allRows) dedup[r.tripadvisor_id] = r
    const unique = Object.values(dedup)
    console.log(`Total unique items to upsert: ${unique.length}`)

    await upsertBatch(unique)
    console.log('Populate complete')
  } catch (err) {
    console.error('Populate failed:', err)
    process.exit(2)
  }
}

main()
