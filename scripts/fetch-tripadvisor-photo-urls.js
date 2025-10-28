import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const TRIPADVISOR_KEY = process.env.TRIPADVISOR_API_KEY || process.env.TRIPADVISOR || process.env.VITE_TRIPADVISOR

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing PROJECT_URL or SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)
const BATCH_SIZE = Number(process.env.BATCH_SIZE) || 100
const MAX_IMAGES = 5

async function fetchTripAdvisorPhotos(tripadvisorId) {
  if (!TRIPADVISOR_KEY) return []
  try {
    const url = `https://api.content.tripadvisor.com/v2/location/${tripadvisorId}/photos?key=${TRIPADVISOR_KEY}&limit=20`
    const res = await fetch(url, {})
    if (!res.ok) return []
    const data = await res.json()
    if (!data || !data.data) return []
    const urls = []
    for (const photo of data.data) {
      if (photo.images?.large?.url) urls.push(photo.images.large.url)
      else if (photo.images?.original?.url) urls.push(photo.images.original.url)
      else if (photo.images?.medium?.url) urls.push(photo.images.medium.url)
    }
    // clean and dedupe
    return [...new Set(urls.map(u => (u || '').split(/[?#]/)[0]))].slice(0, MAX_IMAGES)
  } catch (err) {
    console.warn('TripAdvisor fetch error for id', tripadvisorId, err && err.message ? err.message : err)
    return []
  }
}

async function fetchBatch(offset) {
  const { data, error } = await supabase
    .from('nearby_listings')
    .select('id,tripadvisor_id,name,city,photo_urls')
    .order('id', { ascending: true })
    .range(offset, offset + BATCH_SIZE - 1)

  if (error) throw error
  return data || []
}

async function updatePhotoUrls(listingId, newUrls) {
  const { data: existing, error: fetchErr } = await supabase.from('nearby_listings').select('photo_urls').eq('id', listingId).single()
  if (fetchErr) throw fetchErr
  const cur = Array.isArray(existing?.photo_urls) ? existing.photo_urls : []
  const combined = [...new Set([...cur, ...newUrls])].slice(0, MAX_IMAGES)
  const { error } = await supabase.from('nearby_listings').update({ photo_urls: combined, updated_at: new Date().toISOString() }).eq('id', listingId)
  if (error) throw error
  return combined
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function processListing(listing) {
  if (!listing.tripadvisor_id) return { id: listing.id, status: 'no-id' }
  // ensure numeric id
  const tid = String(listing.tripadvisor_id).replace(/[^0-9]/g, '')
  if (!tid) return { id: listing.id, status: 'invalid-id' }

  // skip if already has enough
  if (Array.isArray(listing.photo_urls) && listing.photo_urls.length >= MAX_IMAGES) {
    return { id: listing.id, status: 'skip' }
  }

  const photos = await fetchTripAdvisorPhotos(tid)
  if (!photos || photos.length === 0) return { id: listing.id, status: 'no-photos' }

  try {
    const updated = await updatePhotoUrls(listing.id, photos)
    return { id: listing.id, status: 'updated', count: updated.length }
  } catch (err) {
    console.warn('DB update failed for id', listing.id, err && err.message ? err.message : err)
    return { id: listing.id, status: 'db-error' }
  }
}

async function main() {
  console.log('Starting TripAdvisor photo URL fetcher')
  let offset = 0
  let total = 0
  while (true) {
    const batch = await fetchBatch(offset)
    if (!batch || batch.length === 0) break
    console.log(`Processing batch offset=${offset} len=${batch.length}`)
    for (const l of batch) {
      try {
        const res = await processListing(l)
        total++
        console.log(`#${total} id=${l.id} - ${l.name} -> ${res.status}${res.count ? ' ('+res.count+')' : ''}`)
      } catch (err) {
        console.warn('Listing processing error', err && err.message ? err.message : err)
      }
      await sleep(300) // polite rate
    }
    offset += BATCH_SIZE
    await sleep(1000)
  }
  console.log('Done. Processed', total)
  process.exit(0)
}

main().catch(err => { console.error('Fatal', err); process.exit(1) })
