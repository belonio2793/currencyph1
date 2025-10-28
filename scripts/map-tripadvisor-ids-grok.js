import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const X_API_KEY = process.env.X_API_KEY || process.env.XAI_API_KEY || process.env.GROK_API_KEY
const GROK_API_URL = process.env.GROK_API_URL || 'https://api.grok.ai/v1/search'

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase PROJECT_URL or SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!X_API_KEY) {
  console.error('Missing X_API_KEY for Grok - set X_API_KEY in env')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)
const BATCH = Number(process.env.BATCH_SIZE || 100)
const START = Number(process.env.START_INDEX || 0)

async function grokFindListingUrl(query, attempt = 1) {
  const prompt = `Find the TripAdvisor listing page (on tripadvisor.com.ph) for the query: "${query}". Respond with a single JSON object: { "page_url": "<url>" }. Only return valid JSON.`
  try {
    const res = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${X_API_KEY}` },
      body: JSON.stringify({ query: prompt }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn('Grok API returned', res.status, text.slice(0,200))
      return null
    }

    const text = await res.text()
    // try to extract JSON object from response
    let obj = null
    try { obj = JSON.parse(text) } catch (e) {
      // try to find JSON within text
      const m = text.match(/\{[\s\S]*\}/)
      if (m) {
        try { obj = JSON.parse(m[0]) } catch {}
      }
    }
    if (obj && obj.page_url) return obj.page_url

    // fallback: extract first tripadvisor url from text
    const urlMatch = text.match(/https?:\/\/[^\s"']*tripadvisor\.[^\s"']*/i)
    if (urlMatch) return urlMatch[0].split('?')[0]

    return null
  } catch (err) {
    console.warn('Grok request error:', err && err.message ? err.message : err)
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
      return grokFindListingUrl(query, attempt + 1)
    }
    return null
  }
}

function extractTripadvisorIdFromUrl(url) {
  if (!url) return null
  // try -d123456- pattern
  const m = url.match(/-d(\d+)-/)
  if (m) return m[1]
  // try location/<id>
  const m2 = url.match(/location\/(\d+)/)
  if (m2) return m2[1]
  // try /Attraction_Review-g...-d123456- pattern
  const m3 = url.match(/-d(\d+)(?:[\-_]|$)/)
  if (m3) return m3[1]
  return null
}

async function fetchBatch(start, batchSize) {
  const { data, error } = await supabase
    .from('nearby_listings')
    .select('id,tripadvisor_id,name,city,web_url,raw')
    .is('tripadvisor_id', null)
    .order('id', { ascending: true })
    .range(start, start + batchSize - 1)
  if (error) throw error
  return data || []
}

async function updateTripadvisorId(listingId, tripId) {
  const { error } = await supabase.from('nearby_listings').update({ tripadvisor_id: String(tripId), updated_at: new Date().toISOString() }).eq('id', listingId)
  if (error) console.warn('Failed to update tripadvisor_id for', listingId, error.message)
  return !error
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function processListing(listing) {
  try {
    console.log(`Processing id=${listing.id} name="${listing.name}"`) 
    // prefer web_url/raw if contains tripadvisor link
    if (listing.web_url) {
      const url = String(listing.web_url)
      const id = extractTripadvisorIdFromUrl(url)
      if (id) {
        await updateTripadvisorId(listing.id, id)
        console.log('  used web_url ->', id)
        return { id: listing.id, status: 'updated', tripId: id }
      }
    }

    // try raw field JSON for tripadvisor reference
    try {
      if (listing.raw) {
        const raw = typeof listing.raw === 'string' ? JSON.parse(listing.raw) : listing.raw
        const possible = JSON.stringify(raw)
        const m = possible.match(/\b(\d{5,12})\b/g)
        if (m) {
          // heuristic: test first candidate via TripAdvisor photos endpoint could be expensive; we'll trust pattern
          const candidate = m[0]
          await updateTripadvisorId(listing.id, candidate)
          console.log('  used raw ->', candidate)
          return { id: listing.id, status: 'updated', tripId: candidate }
        }
      }
    } catch (e) {}

    // Use Grok to find best TripAdvisor listing page URL
    const q = `${listing.name} ${listing.city || ''} TripAdvisor`.trim()
    const pageUrl = await grokFindListingUrl(q)
    if (!pageUrl) {
      console.log('  Grok returned no URL')
      return { id: listing.id, status: 'no-url' }
    }

    const tid = extractTripadvisorIdFromUrl(pageUrl)
    if (!tid) {
      console.log('  Could not extract id from', pageUrl)
      return { id: listing.id, status: 'no-id' }
    }

    await updateTripadvisorId(listing.id, tid)
    console.log('  updated tripadvisor_id ->', tid)
    return { id: listing.id, status: 'updated', tripId: tid }
  } catch (err) {
    console.warn('  error', err && err.message ? err.message : err)
    return { id: listing.id, status: 'error' }
  }
}

async function main() {
  console.log('Starting Grok-based TripAdvisor ID mapping')
  let start = START
  while (true) {
    const batch = await fetchBatch(start, BATCH)
    if (!batch || batch.length === 0) break
    console.log(`Fetched batch start=${start} len=${batch.length}`)
    for (const l of batch) {
      await processListing(l)
      await sleep(800)
    }
    start += BATCH
    await sleep(2000)
  }
  console.log('Mapping complete')
  process.exit(0)
}

main().catch(err => { console.error('Fatal', err); process.exit(1) })
