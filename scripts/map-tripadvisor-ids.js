import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const TRIPADVISOR_KEY = process.env.TRIPADVISOR_API_KEY || process.env.TRIPADVISOR || process.env.VITE_TRIPADVISOR

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing PROJECT_URL or SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!TRIPADVISOR_KEY) {
  console.error('Missing TripAdvisor API key (TRIPADVISOR_API_KEY or TRIPADVISOR)')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)
const BATCH = Number(process.env.BATCH_SIZE || 100)
const START = Number(process.env.START_INDEX || 0)

function normalize(s) { return (s || '').toString().toLowerCase().replace(/[\s\W_]+/g, ' ').trim() }

async function searchTripAdvisor(query) {
  try {
    const url = `https://api.tripadvisor.com/api/partner/2.0/locations/search?query=${encodeURIComponent(query)}&limit=10`;
    const res = await fetch(url, {
      headers: { 'X-TripAdvisor-API-Key': TRIPADVISOR_KEY }
    })
    if (!res.ok) {
      const text = await res.text().catch(()=>'')
      console.warn('TripAdvisor search failed', res.status, text.slice(0,200))
      return []
    }
    const data = await res.json().catch(()=>null)
    return data?.data || []
  } catch (err) {
    console.warn('TripAdvisor search error', err && err.message ? err.message : err)
    return []
  }
}

async function fetchBatch(start, batchSize) {
  const { data, error } = await supabase
    .from('nearby_listings')
    .select('id,tripadvisor_id,name,city,slug')
    .order('id', { ascending: true })
    .range(start, start + batchSize - 1)

  if (error) throw error
  return data || []
}

async function updateTripadvisorId(listingId, tripId) {
  const { error } = await supabase.from('nearby_listings').update({ tripadvisor_id: String(tripId), updated_at: new Date().toISOString() }).eq('id', listingId)
  if (error) throw error
}

function scoreMatch(listingName, listingCity, candidate) {
  const name = normalize(listingName)
  const city = normalize(listingCity)
  const candName = normalize(candidate.name || '')
  const candCity = normalize(candidate.address_obj?.city || candidate.address || '')
  let score = 0
  if (candName && name && candName === name) score += 50
  if (candName && name && candName.includes(name)) score += 30
  if (city && candCity && candCity.includes(city)) score += 20
  // boost if category matches
  if (candidate.subcategory && typeof candidate.subcategory === 'string' && candidate.subcategory.toLowerCase().includes('restaurant')) score += 5
  return score
}

async function processListing(listing) {
  try {
    if (listing.tripadvisor_id && String(listing.tripadvisor_id).match(/^\d+$/)) {
      console.log(`id=${listing.id} already has numeric tripadvisor_id=${listing.tripadvisor_id}, skipping`)
      return { id: listing.id, status: 'skip' }
    }

    const q = `${listing.name} ${listing.city || ''} Philippines`.replace(/\s+/g,' ').trim()
    const results = await searchTripAdvisor(q)
    if (!results || results.length === 0) {
      console.log(`id=${listing.id} no search results for "${q}"`)
      return { id: listing.id, status: 'no-results' }
    }

    // score candidates
    let best = null
    let bestScore = -1
    for (const cand of results) {
      const s = scoreMatch(listing.name, listing.city, cand)
      if (s > bestScore) { best = cand; bestScore = s }
    }

    if (!best || bestScore <= 0) {
      // fallback to first
      best = results[0]
    }

    const tripId = best.location_id || best.location_id || best.place_id || best.id || best.locationId || best.location_id
    if (!tripId) {
      console.log(`id=${listing.id} matched candidate but no id found in response`) 
      return { id: listing.id, status: 'no-id' }
    }

    await updateTripadvisorId(listing.id, tripId)
    console.log(`id=${listing.id} updated tripadvisor_id=${tripId} (score=${bestScore})`)
    return { id: listing.id, status: 'updated', tripId }
  } catch (err) {
    console.warn('error processing listing', err && err.message ? err.message : err)
    return { id: listing.id, status: 'error' }
  }
}

async function main() {
  console.log('Mapping TripAdvisor IDs for listings...')
  let start = START
  while (true) {
    const batch = await fetchBatch(start, BATCH)
    if (!batch || batch.length === 0) break
    console.log(`Processing batch start=${start} len=${batch.length}`)
    for (const l of batch) {
      await processListing(l)
      await new Promise(r => setTimeout(r, 500))
    }
    start += BATCH
    await new Promise(r => setTimeout(r, 1500))
  }
  console.log('Done')
  process.exit(0)
}

main().catch(err => { console.error('Fatal', err); process.exit(1) })
