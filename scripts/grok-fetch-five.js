import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import cheerio from 'cheerio'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const X_API_KEY = process.env.X_API_KEY || process.env.XAI_API_KEY || process.env.GROK_API_KEY
const GROK_API_URL = process.env.GROK_API_URL || 'https://api.grok.ai/v1/search'
const SCRAPING_BEE = process.env.SCRAPING_BEE || process.env.SCRAPINGBEE_API_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase PROJECT_URL or SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

// Simple arg parsing
const argv = process.argv.slice(2)
let name = null
let city = null
for (let i = 0; i < argv.length; i++) {
  if ((argv[i] === '--name' || argv[i] === '-n') && argv[i+1]) { name = argv[i+1]; i++ }
  if ((argv[i] === '--city' || argv[i] === '-c') && argv[i+1]) { city = argv[i+1]; i++ }
}

if (!name) {
  console.error('Usage: node scripts/grok-fetch-five.js --name "Place Name" [--city "City"]')
  process.exit(1)
}

function cleanUrl(u) {
  try {
    return u.split(/[?#]/)[0]
  } catch {
    return u
  }
}

async function grokFindImages(query) {
  if (!X_API_KEY) return []
  const prompt = `Find the TripAdvisor listing page for the query: "${query}". Return a single JSON object exactly like {"page_url":"<url>","image_urls":["<url1>","<url2>","<url3>","<url4>","<url5>"]} with up to 5 direct high-resolution image URLs from the listing gallery. Only return valid JSON.`

  try {
    const res = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${X_API_KEY}`
      },
      body: JSON.stringify({ query: prompt }),
      timeout: 20000
    })

    if (!res.ok) {
      const t = await res.text()
      console.warn('Grok search failed', res.status, t.slice(0,200))
      return []
    }

    const data = await res.json()
    // try to extract image_urls from common places
    if (!data) return []
    // check direct fields
    if (Array.isArray(data.image_urls)) return data.image_urls.map(cleanUrl).slice(0,5)
    if (data.image_urls && typeof data.image_urls === 'string') {
      const m = data.image_urls.match(/https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp)/gi)
      if (m) return m.map(cleanUrl).slice(0,5)
    }
    // search within JSON
    const jsonStr = JSON.stringify(data)
    const m = jsonStr.match(/https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp)/gi)
    if (m) return [...new Set(m.map(cleanUrl))].slice(0,5)

    return []
  } catch (err) {
    console.warn('Grok error', err.message)
    return []
  }
}

async function scrapingBeeFindImages(query) {
  if (!SCRAPING_BEE) return []
  try {
    // search page
    const searchUrl = `https://www.tripadvisor.com/Search?q=${encodeURIComponent(query)}`
    const params = new URLSearchParams({ url: searchUrl, render_js: 'true', wait: '3000', premium_proxy: 'true' })
    const endpoint = `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(SCRAPING_BEE)}&${params.toString()}`
    const res = await fetch(endpoint, { timeout: 20000 })
    if (!res.ok) { console.warn('ScrapingBee search failed', res.status); return [] }
    const html = await res.text()
    const $ = cheerio.load(html)

    // find first listing link
    let link = null
    $('a[href*="-d"]').each((_, a) => {
      const href = $(a).attr('href')
      if (href && /-d\d+-/.test(href)) {
        link = href.startsWith('http') ? href.split('?')[0] : `https://www.tripadvisor.com${href.split('?')[0]}`
        return false
      }
    })
    if (!link) return []

    // fetch detail
    const detailParams = new URLSearchParams({ url: link, render_js: 'true', wait: '3000', premium_proxy: 'true' })
    const detailEndpoint = `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(SCRAPING_BEE)}&${detailParams.toString()}`
    const dres = await fetch(detailEndpoint, { timeout: 20000 })
    if (!dres.ok) { console.warn('ScrapingBee detail failed', dres.status); return [] }
    const detailHtml = await dres.text()

    // Extract image URLs by regex
    const patterns = [
      /https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo-[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/gi,
      /https:\/\/media-cdn\.tripadvisor\.com\/media\/photo-[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/gi,
      /https:\/\/www\.tripadvisor\.com\/photo-\/[^"]+\.(?:jpg|jpeg|png|webp)/gi
    ]

    const all = []
    for (const p of patterns) {
      const m = detailHtml.match(p) || []
      all.push(...m)
    }

    const cleaned = [...new Set(all.map(cleanUrl))].slice(0,5)
    return cleaned
  } catch (err) {
    console.warn('ScrapingBee error', err.message)
    return []
  }
}

async function fallbackScrapeDirect(query) {
  // Try direct TripAdvisor search without scrapingbee (may be blocked)
  try {
    const url = `https://www.tripadvisor.com/Search?q=${encodeURIComponent(query)}`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 })
    if (!res.ok) return []
    const html = await res.text()
    const m = html.match(/https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo-[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/gi) || []
    return [...new Set(m.map(cleanUrl))].slice(0,5)
  } catch (err) {
    return []
  }
}

async function findListingInDb(name, city) {
  const q = supabase.from('nearby_listings').select('id,tripadvisor_id,name,city,photo_urls').ilike('name', `%${name}%`).limit(50)
  const { data, error } = await q
  if (error) throw error
  if (!data || data.length === 0) return null
  if (!city) return data[0]
  const match = data.find(d => (d.city || '').toLowerCase().includes((city||'').toLowerCase()))
  return match || data[0]
}

async function updatePhotoUrls(listingId, newUrls) {
  // Get existing
  const { data: existing, error: fetchErr } = await supabase.from('nearby_listings').select('photo_urls').eq('id', listingId).single()
  if (fetchErr) throw fetchErr
  const cur = Array.isArray(existing.photo_urls) ? existing.photo_urls : []
  const combined = [...new Set([...cur, ...newUrls])]
  const { error } = await supabase.from('nearby_listings').update({ photo_urls: combined, updated_at: new Date().toISOString() }).eq('id', listingId)
  if (error) throw error
  return combined
}

async function main() {
  const query = `${name}${city ? ' ' + city : ''} TripAdvisor`
  console.log('Searching DB for listing matching:', name, city || '')
  const listing = await findListingInDb(name, city)
  if (!listing) {
    console.error('No local listing matched')
    process.exit(1)
  }

  console.log('Found listing:', listing.name, 'id=', listing.id, 'tripadvisor_id=', listing.tripadvisor_id)

  // Try Grok first
  let images = []
  if (X_API_KEY) {
    console.log('Trying Grok for images...')
    images = await grokFindImages(query)
    if (images.length) console.log('Grok returned', images.length, 'images')
  }

  if (images.length === 0 && SCRAPING_BEE) {
    console.log('Trying ScrapingBee...')
    images = await scrapingBeeFindImages(query)
    if (images.length) console.log('ScrapingBee returned', images.length, 'images')
  }

  if (images.length === 0) {
    console.log('Trying direct scrape fallback...')
    images = await fallbackScrapeDirect(query)
    if (images.length) console.log('Fallback returned', images.length, 'images')
  }

  if (images.length === 0) {
    console.error('No images found for listing')
    process.exit(1)
  }

  // Keep up to 5 high-res
  images = images.slice(0,5)

  // Update DB append
  const updated = await updatePhotoUrls(listing.id, images)
  console.log('Updated photo_urls length:', updated.length)
  console.log('New photo_urls:', updated)
  process.exit(0)
}

main().catch(err => { console.error('Fatal error', err); process.exit(1) })
