import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import cheerio from 'https://esm.sh/cheerio@1.0.0-rc.12'

const SCRAPING_BEE = Deno.env.get('SCRAPING_BEE') || Deno.env.get('SCRAPINGBEE_API_KEY') || ''
const TRIPADVISOR_KEY = Deno.env.get('TRIPADVISOR') || Deno.env.get('VITE_TRIPADVISOR') || ''

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

async function beeFetch(url: string) {
  if (!SCRAPING_BEE) throw new Error('SCRAPING_BEE env not set')
  const params = new URLSearchParams({ url, render_js: 'true', country_code: 'ph', wait: '3000', block_resources: 'false', premium_proxy: 'true' })
  const endpoint = `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(SCRAPING_BEE)}&${params.toString()}`
  const res = await fetch(endpoint)
  if (!res.ok) throw new Error(`ScrapingBee ${res.status}`)
  return await res.text()
}

function parseSearch(html: string): string[] {
  const $ = cheerio.load(html)
  const links = new Set<string>()
  $('a[href*="-d"]').each((_, a) => {
    const href = $(a).attr('href')
    if (href && /-d\d+-/.test(href)) links.add(href.startsWith('http') ? href.split('?')[0] : `https://www.tripadvisor.com${href.split('?')[0]}`)
  })
  if (links.size === 0) {
    const matches = html.match(/"location_id":"?(\d+)/g) || []
    matches.slice(0, 50).forEach((m) => {
      const id = (m.match(/(\d+)/) || [])[1]
      if (id) links.add(`https://www.tripadvisor.com/Attraction_Review-d${id}`)
    })
  }
  return Array.from(links)
}

function extractImages($: cheerio.CheerioAPI) {
  const urls = new Set<string>()
  $('img').each((_, img) => {
    const src = $(img).attr('src') || $(img).attr('data-src')
    if (src && /^https?:/.test(src)) urls.add(src)
  })
  $('meta[property="og:image"]').each((_, m) => { const c = $(m).attr('content'); if (c) urls.add(c) })
  return Array.from(urls).slice(0, 50)
}

function parseJsonLd($: cheerio.CheerioAPI) {
  const out: any = { lat: null, lng: null, phone: null, website: null }
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).contents().text())
      const data = Array.isArray(json) ? json.find((x: any) => x['@type']) : json
      if (!data) return
      if (data.geo) { out.lat = Number(data.geo.latitude); out.lng = Number(data.geo.longitude) }
      if (data.telephone) out.phone = data.telephone
      if (data.url) out.website = data.url
    } catch (_) { }
  })
  return out
}

async function scrapeDetail(url: string, city: string) {
  const html = await beeFetch(url)
  const $ = cheerio.load(html)
  const name = $('h1').first().text().trim() || null
  const ld = parseJsonLd($)
  const ratingCls = $('span.ui_bubble_rating').first().attr('class') || ''
  const rm = ratingCls.match(/bubble_(\d+)/)
  const rating = rm ? Number(rm[1]) / 10 : null
  const reviewCountText = $('a[data-automation="review-count"]').first().text() || $('a[href*="#REVIEWS"]').first().text() || ''
  const reviewCount = reviewCountText ? Number((reviewCountText || '').replace(/[^0-9]/g, '')) : null
  const imageUrls = extractImages($)
  const primaryImage = imageUrls[0] || null
  const address = $('[data-automation="address"]').first().text().trim() || null
  const phone = $('[data-automation="phone"]').first().text().trim() || ld.phone || null
  const website = $('[data-automation="website"]').attr('href') || ld.website || null
  const description = $('[data-automation="description"]').first().text().trim() || null
  const idMatch = url.match(/-d(\d+)-/) || (html.match(/"location_id":"?(\d+)/) as RegExpMatchArray | null)
  const tripadvisor_id = idMatch ? String(idMatch[1] || idMatch[2]) : null

  if (!tripadvisor_id || !name) throw new Error('Missing required listing fields')

  return {
    tripadvisor_id,
    name,
    slug: name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 150),
    address,
    latitude: ld.lat || null,
    longitude: ld.lng || null,
    rating,
    review_count: reviewCount,
    phone_number: phone,
    website,
    description,
    image_url: primaryImage,
    image_urls: imageUrls,
    primary_image_url: primaryImage,
    photo_urls: imageUrls,
    featured_image_url: primaryImage,
    source: 'tripadvisor',
    verified: false,
    last_synced: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    city: city
  }
}

Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_PROJECT_URL')
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY')
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Missing Supabase env' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    const CITIES = (Deno.env.get('CITIES') || 'Manila,Cebu City,Davao City,Quezon City,Makati,Baguio,Boracay,Puerto Princesa,Iloilo City,Pasig,Taguig').split(',')
    const results: any[] = []

    for (const city of CITIES) {
      try {
        const searchUrl = `https://www.tripadvisor.com/Search?q=${encodeURIComponent(city + ' Philippines')}`
        let html = ''
        try { html = await beeFetch(searchUrl) } catch (e) { console.warn('search failed', city, e.message); continue }
        let links = parseSearch(html)
        if (links.length === 0) {
          try { html = await beeFetch(`https://www.tripadvisor.com.ph/Search?q=${encodeURIComponent(city + ' Philippines')}`); links = parseSearch(html) } catch (_) { }
        }

        for (const link of links) {
          try {
            const listing = await scrapeDetail(link, city)
            // upsert
            const { error } = await supabase.from('nearby_listings').upsert(listing, { onConflict: 'tripadvisor_id' })
            if (error) console.warn('upsert error', error)
            results.push({ city, tripadvisor_id: listing.tripadvisor_id, name: listing.name })
          } catch (err) {
            console.warn('detail error', link, err.message)
          }
          await sleep(700)
        }

        await sleep(1500)
      } catch (err) {
        console.warn('city loop error', city, err.message)
      }
    }

    return new Response(JSON.stringify({ success: true, upserted: results.length, details: results.slice(0, 50) }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('fatal', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
