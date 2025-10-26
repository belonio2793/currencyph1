import { supabase } from './supabaseClient'

const PHILIPPINE_CITIES = [
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
  const key = import.meta.env.VITE_TRIPADVISOR || import.meta.env.VITE_TRIPADVISOR_API_KEY
  if (!key) throw new Error('TripAdvisor API key not configured')

  const params = new URLSearchParams()
  params.append('query', query)
  params.append('limit', String(limit))

  const url = `https://api.tripadvisor.com/api/partner/2.0/search?${params.toString()}`
  const res = await fetch(url, {
    headers: {
      'X-TripAdvisor-API-Key': key,
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
    const addr = it.address_obj
      ? [it.address_obj.street1, it.address_obj.city, it.address_obj.country].filter(Boolean).join(', ')
      : it.address || it.address_string || ''
    const id = it.location_id || it.id || it.place_id
    return {
      tripadvisor_id: id ? String(id) : `tmp-${Math.random().toString(36).slice(2, 10)}`,
      name: it.name || it.title || it.poi_name || '',
      address: addr || null,
      latitude: it.latitude || it.lat || (it.address_obj && it.address_obj.latitude) || null,
      longitude: it.longitude || it.lon || (it.address_obj && it.address_obj.longitude) || null,
      rating: it.rating ? Number(it.rating) : null,
      category: it.subcategory || (it.category && it.category.name) || null,
      source: 'tripadvisor',
      raw: it
    }
  })
}

async function upsertBatch(rows) {
  if (!rows || rows.length === 0) return 0

  const chunkSize = 100
  let upsertedCount = 0

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase.from('nearby_listings').upsert(chunk, { onConflict: 'tripadvisor_id' })

    if (error) {
      console.error('Upsert error:', error)
      throw error
    } else {
      upsertedCount += chunk.length
    }

    await sleep(300)
  }

  return upsertedCount
}

export async function populateAllTripAdvisorListings(onProgress) {
  try {
    const allRows = []
    let totalFetched = 0

    for (const city of PHILIPPINE_CITIES) {
      try {
        if (onProgress) onProgress(`Fetching listings for ${city}...`)

        const rows = await fetchPlacesFor(`${city} Philippines`, 50)
        totalFetched += rows.length
        allRows.push(...rows)

        console.log(`Fetched ${rows.length} items for ${city}`)
      } catch (err) {
        console.error(`Failed fetch for ${city}:`, err.message)
        if (onProgress) onProgress(`Error fetching ${city}: ${err.message}`)
      }

      await sleep(1000)
    }

    if (onProgress) onProgress(`Deduplicating ${allRows.length} listings...`)

    // Dedupe by tripadvisor_id
    const dedup = {}
    for (const r of allRows) {
      dedup[r.tripadvisor_id] = r
    }
    const unique = Object.values(dedup)

    if (onProgress) onProgress(`Saving ${unique.length} unique listings to database...`)

    const upserted = await upsertBatch(unique)

    if (onProgress) onProgress(`✓ Complete! Fetched ${totalFetched} total, saved ${upserted} unique listings`)

    return {
      success: true,
      totalFetched,
      uniqueSaved: upserted,
      message: `Fetched ${totalFetched} total, saved ${upserted} unique listings`
    }
  } catch (err) {
    console.error('Populate failed:', err)
    if (onProgress) onProgress(`✗ Error: ${err.message}`)
    throw err
  }
}
