import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import cheerio from 'cheerio'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const X_API_KEY = process.env.X_API_KEY || process.env.XAI_API_KEY || process.env.GROK_API_KEY || process.env.X_API_KEY
const GROK_API_URL = process.env.GROK_API_URL || 'https://api.grok.ai/v1/search'
const SCRAPING_BEE = process.env.SCRAPING_BEE || process.env.SCRAPINGBEE_API_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase PROJECT_URL or SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

const BATCH = Number(process.env.BATCH_SIZE || 100)
const START = Number(process.env.START_INDEX || 0)
const MAX_IMAGES = 5

function cleanUrl(u) {
  try { return u.split(/[?#]/)[0] } catch { return u }
}

async function grokFindImages(query) {
  if (!X_API_KEY) return []
  const prompt = `Find the TripAdvisor listing page for the query: "${query}". Return a JSON or text containing up to ${MAX_IMAGES} direct high-resolution image URLs from the TripAdvisor listing gallery. Only include fully qualified https URLs ending with jpg/jpeg/png/webp.`
  try {
    const res = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${X_API_KEY}` },
      body: JSON.stringify({ query: prompt }),
      timeout: 20000
    })
    if (!res.ok) {
      console.warn('Grok failed', res.status)
      return []
    }
    const data = await res.json()
    const str = JSON.stringify(data)
    const m = str.match(/https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp)/gi) || []
    return [...new Set(m.map(cleanUrl))].slice(0, MAX_IMAGES)
  } catch (err) {
    console.warn('Grok error', err.message)
    return []
  }
}

async function scrapingBeeFindImages(query) {
  if (!SCRAPING_BEE) return []
  try {
    const searchUrl = `https://www.tripadvisor.com/Search?q=${encodeURIComponent(query)}`
    const params = new URLSearchParams({ url: searchUrl, render_js: 'true', wait: '3000', premium_proxy: 'true' })
    const endpoint = `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(SCRAPING_BEE)}&${params.toString()}`
    const res = await fetch(endpoint, { timeout: 20000 })
    if (!res.ok) { console.warn('ScrapingBee search failed', res.status); return [] }
    const html = await res.text()
    const $ = cheerio.load(html)
    let link = null
    $('a[href*="-d"]').each((_, a) => {
      const href = $(a).attr('href')
      if (href && /-d\d+-/.test(href)) {
        link = href.startsWith('http') ? href.split('?')[0] : `https://www.tripadvisor.com${href.split('?')[0]}`
        return false
      }
    })
    if (!link) return []
    const detailParams = new URLSearchParams({ url: link, render_js: 'true', wait: '3000', premium_proxy: 'true' })
    const detailEndpoint = `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(SCRAPING_BEE)}&${detailParams.toString()}`
    const dres = await fetch(detailEndpoint, { timeout: 20000 })
    if (!dres.ok) { console.warn('ScrapingBee detail failed', dres.status); return [] }
    const detailHtml = await dres.text()
    const patterns = [
      /https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo-[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/gi,
      /https:\/\/media-cdn\.tripadvisor\.com\/media\/photo-[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/gi
    ]
    const all = []
    for (const p of patterns) {
      const m = detailHtml.match(p) || []
      all.push(...m)
    }
    const cleaned = [...new Set(all.map(cleanUrl))].slice(0, MAX_IMAGES)
    return cleaned
  } catch (err) {
    console.warn('ScrapingBee error', err.message)
    return []
  }
}

async function fallbackScrapeDirect(query) {
  try {
    const url = `https://www.tripadvisor.com/Search?q=${encodeURIComponent(query)}`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 })
    if (!res.ok) return []
    const html = await res.text()
    const m = html.match(/https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo-[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/gi) || []
    return [...new Set(m.map(cleanUrl))].slice(0, MAX_IMAGES)
  } catch (err) {
    return []
  }
}

async function fetchBatch(start, batchSize) {
  const { data, error } = await supabase.from('nearby_listings').select('id,tripadvisor_id,name,city,photo_urls').order('id', { ascending: true }).range(start, start + batchSize - 1)
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
