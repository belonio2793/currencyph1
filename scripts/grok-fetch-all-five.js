import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import cheerio from 'cheerio'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const X_API_KEY = process.env.X_API_KEY || process.env.XAI_API_KEY || process.env.GROK_API_KEY || process.env.X_API_KEY
const GROK_API_URL = process.env.GROK_API_URL || 'https://api.grok.ai/v1/search'
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

// Grok-only script: find up to 5 TripAdvisor listing gallery image URLs per listing
// and append them to nearby_listings.photo_urls (Supabase). Uses X_API_KEY & GROK_API_URL.

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const X_API_KEY = process.env.X_API_KEY || process.env.XAI_API_KEY || process.env.GROK_API_KEY
const GROK_API_URL = process.env.GROK_API_URL || 'https://api.grok.ai/v1/search'

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase PROJECT_URL or SERVICE_ROLE_KEY')
  process.exit(1)
}

if (!X_API_KEY) {
  console.error('Missing X_API_KEY (Grok) - set X_API_KEY or GROK_API_KEY in environment')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)
const BATCH = Number(process.env.BATCH_SIZE || 100)
const START = Number(process.env.START_INDEX || 0)
const MAX_IMAGES = 5

function cleanUrl(u) {
  try { return u.split(/[?#]/)[0] } catch { return u }
}

async function grokFindImages(query, attempt = 1) {
  const prompt = `Find the listing for the query: "${query}" on tripadvisor.com.ph and return up to ${MAX_IMAGES} direct high-resolution image URLs (full https URLs, typically on dynamic-media-cdn.tripadvisor.com) from the listing's photo gallery. Respond with any text or JSON that includes the direct image links.`

  try {
    const res = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${X_API_KEY}`
      },
      body: JSON.stringify({ query: prompt }),
      // node-fetch doesn't support timeout option in v2; implement via AbortController if needed
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn('Grok API returned status', res.status, text.slice(0, 200))
      return []
    }

    const data = await res.json().catch(() => null)
    const str = JSON.stringify(data || '')
    const matches = str.match(/https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp)/gi) || []
    // Prefer TripAdvisor CDN images
    const tripadvisorImgs = matches.filter(u => /dynamic-media-cdn\.tripadvisor\.com|media-cdn\.tripadvisor\.com/.test(u))
    const chosen = (tripadvisorImgs.length ? tripadvisorImgs : matches).map(cleanUrl)
    return [...new Set(chosen)].slice(0, MAX_IMAGES)
  } catch (err) {
    console.warn('Grok request error:', err && err.message ? err.message : err)
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
      return grokFindImages(query, attempt + 1)
    }
    return []
  }
}

async function fetchBatch(start, batchSize) {
  const { data, error } = await supabase
    .from('nearby_listings')
    .select('id,tripadvisor_id,name,city,photo_urls')
    .order('id', { ascending: true })
    .range(start, start + batchSize - 1)

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
  try {
    // Skip if already has 5 images
    if (Array.isArray(listing.photo_urls) && listing.photo_urls.length >= MAX_IMAGES) {
      console.log(`id=${listing.id} already has ${listing.photo_urls.length} photos, skipping`)
      return { id: listing.id, status: 'skip' }
    }

    const q = `${listing.name} ${listing.city || ''} TripAdvisor`.replace(/\s+/g, ' ').trim()
    console.log(`Processing id=${listing.id} name="${listing.name}"`)
    const imgs = await grokFindImages(q)
    if (!imgs || imgs.length === 0) {
      console.log('  grok found no images')
      return { id: listing.id, status: 'none' }
    }

    const updated = await updatePhotoUrls(listing.id, imgs)
    console.log(`  updated id=${listing.id} photo_urls=${updated.length}`)
    return { id: listing.id, status: 'updated', count: updated.length }
  } catch (err) {
    console.warn('  error processing listing', err && err.message ? err.message : err)
    return { id: listing.id, status: 'error' }
  }
}

async function main() {
  console.log('Starting Grok-only image harvest: will add up to', MAX_IMAGES, 'images per listing')
  let start = START
  while (true) {
    const batch = await fetchBatch(start, BATCH)
    if (!batch || batch.length === 0) break
    console.log(`Fetched batch start=${start} len=${batch.length}`)
    for (const l of batch) {
      await processListing(l)
      // polite delay between calls to Grok
      await sleep(600)
    }
    start += BATCH
    // pause between batches
    await sleep(2000)
  }
  console.log('Grok harvest complete')
  process.exit(0)
}

main().catch(err => { console.error('Fatal error', err); process.exit(1) })

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function processListing(listing) {
  const q = `${listing.name} ${listing.city || ''} TripAdvisor`.replace(/\s+/g, ' ').trim()
  console.log(`Processing id=${listing.id} name="${listing.name}"`) 

  // If already 5 or more photos, skip
  if (Array.isArray(listing.photo_urls) && listing.photo_urls.length >= MAX_IMAGES) {
    console.log('  already has >=5 photos, skipping')
    return {id: listing.id, status: 'skip'}
  }

  let imgs = []
  if (X_API_KEY) {
    imgs = await grokFindImages(q)
    if (imgs.length) console.log('  grok ->', imgs.length)
  }
  if (imgs.length === 0 && SCRAPING_BEE) {
    imgs = await scrapingBeeFindImages(q)
    if (imgs.length) console.log('  scrapingbee ->', imgs.length)
  }
  if (imgs.length === 0) {
    imgs = await fallbackScrapeDirect(q)
    if (imgs.length) console.log('  fallback ->', imgs.length)
  }

  if (imgs.length === 0) {
    console.log('  no images found')
    return {id: listing.id, status: 'none'}
  }

  imgs = imgs.slice(0, MAX_IMAGES)

  const updated = await updatePhotoUrls(listing.id, imgs)
  console.log(`  updated photo_urls (${updated.length})`)
  return { id: listing.id, status: 'updated', count: updated.length }
}

async function main() {
  console.log('Starting grok-fetch-all-five')
  // Determine count
  const { countRes, countErr } = await supabase.from('nearby_listings').select('id', { count: 'exact', head: false })
  // We'll fetch in pages until no more
  let start = START
  let totalProcessed = 0
  while (true) {
    const batch = await fetchBatch(start, BATCH)
    if (!batch || batch.length === 0) break
    console.log(`Fetched batch start=${start} len=${batch.length}`)
    for (const l of batch) {
      try {
        await processListing(l)
      } catch (err) {
        console.warn('  error processing listing:', err.message || err)
      }
      totalProcessed++
      await sleep(600) // polite delay between listings
    }
    start += BATCH
    // small pause between batches
    await sleep(2000)
  }
  console.log('Complete. total processed:', totalProcessed)
  process.exit(0)
}

main().catch(err => { console.error('Fatal error', err); process.exit(1) })
