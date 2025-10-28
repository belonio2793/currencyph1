#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import cheerio from 'cheerio'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY || process.env.SCRAPING_BEE

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase env (PROJECT_URL, SUPABASE_SERVICE_ROLE_KEY)')
  process.exit(1)
}
if (!SCRAPINGBEE_API_KEY) {
  console.error('❌ Missing SCRAPINGBEE_API_KEY env')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

const DEFAULT_CITIES = [
  'Abuyog','Alaminos','Alcala','Angeles','Antipolo','Aroroy','Bacolod','Bacoor','Bago','Bais','Balanga','Baliuag','Bangued','Bansalan','Bantayan','Bataan','Batac','Batangas City','Bayambang','Bayawan','Baybay','Bayugan','Biñan','Bislig','Bocaue','Bogo','Boracay','Borongan','Butuan','Cabadbaran','Cabanatuan','Cabuyao','Cadiz','Cagayan de Oro','Calamba','Calapan','Calbayog','Caloocan','Camiling','Canlaon','Caoayan','Capiz','Caraga','Carmona','Catbalogan','Cauayan','Cavite City','Cebu City','Cotabato City','Dagupan','Danao','Dapitan','Daraga','Dasmariñas','Davao City','Davao del Norte','Davao del Sur','Davao Oriental','Dipolog','Dumaguete','General Santos','General Trias','Gingoog','Guihulngan','Himamaylan','Ilagan','Iligan','Iloilo City','Imus','Isabela','Isulan','Kabankalan','Kidapawan','Koronadal','La Carlota','Laoag','Lapu-Lapu','Las Piñas','Laoang','Legazpi','Ligao','Limay','Lucena','Maasin','Mabalacat','Malabon','Malaybalay','Malolos','Mandaluyong','Mandaue','Manila','Marawi','Marilao','Masbate City','Mati','Meycauayan','Muntinlupa','Naga (Camarines Sur)','Navotas','Olongapo','Ormoc','Oroquieta','Ozamiz','Pagadian','Palo','Parañaque','Pasay','Pasig','Passi','Puerto Princesa','Quezon City','Roxas','Sagay','Samal','San Carlos (Negros Occidental)','San Carlos (Pangasinan)','San Fernando (La Union)','San Fernando (Pampanga)','San Jose (Antique)','San Jose del Monte','San Juan','San Pablo','San Pedro','Santiago','Silay','Sipalay','Sorsogon City','Surigao City','Tabaco','Tabuk','Tacurong','Tagaytay','Tagbilaran','Taguig','Tacloban','Talisay (Cebu)','Talisay (Negros Occidental)','Tanjay','Tarlac City','Tayabas','Toledo','Trece Martires','Tuguegarao','Urdaneta','Valencia','Valenzuela','Victorias','Vigan','Virac','Zamboanga City','Baguio','Bohol','Coron','El Nido','Makati','Palawan','Siargao'
]

const argv = process.argv.slice(2).join(' ')
const limitCities = Number((argv.match(/--limitCities=(\d+)/)||[])[1]||0)
const perCity = Number((argv.match(/--perCity=(\d+)/)||[])[1]||20)
const customCitiesArg = (argv.match(/--cities=([^\n]+)/)||[])[1]
const CUSTOM_CITIES = customCitiesArg ? customCitiesArg.split(',').map(s=>s.trim()).filter(Boolean) : null

async function beeFetch(url, opts = {}) {
  async function doFetch(renderJs) {
    const params = new URLSearchParams({ url, render_js: renderJs ? 'true' : 'false', country_code: 'ph', wait: '4000', block_resources: 'false', premium_proxy: 'true' })
    if (opts.params) Object.entries(opts.params).forEach(([k,v])=>params.set(k,String(v)))
    const resp = await fetch(`https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(SCRAPINGBEE_API_KEY)}&${params.toString()}`)
    if (!resp.ok) {
      const txt = await resp.text().catch(()=> '')
      const err = new Error(`Bee ${resp.status} ${resp.statusText}: ${txt.slice(0,200)}`)
      err.status = resp.status
      throw err
    }
    return await resp.text()
  }
  try {
    return await doFetch(true)
  } catch (e) {
    if (e.status && e.status >= 500) {
      await sleep(1200)
      return await doFetch(false)
    }
    if (e.status === 429) {
      await sleep(1500)
      return await doFetch(true)
    }
    throw e
  }
}

function parseSearch(html) {
  const $ = cheerio.load(html)
  const links = new Set()
  $('a[href^="/Attraction_Review"], a[href^="/Restaurant_Review"], a[href^="/Hotel_Review"], a[data-test-target="review-score"] ~ a[href*="-d"]').each((_, a)=>{
    const href = $(a).attr('href')
    if (href && /-d\d+-/.test(href)) links.add(`https://www.tripadvisor.com.ph${href.split('?')[0]}`)
  })
  // More robust: capture anchors in result cards
  $('[data-testid="results-list"] a[href*="-d"]').each((_, a)=>{
    const href = $(a).attr('href')
    if (href && /-d\d+-/.test(href)) links.add(`https://www.tripadvisor.com.ph${href.split('?')[0]}`)
  })
  // Fallback: scan JSON blobs
  if (links.size === 0) {
    const jsonMatches = html.match(/\"location_id\":\"?(\d+)/g) || []
    jsonMatches.slice(0, 50).forEach((m)=>{
      const id = (m.match(/(\d+)/)||[])[1]
      if (id) links.add(`https://www.tripadvisor.com.ph/Attraction_Review-d${id}`)
    })
  }
  return Array.from(links)
}

function safeNum(v){ const n = parseFloat(String(v||'').replace(/,/g,'')); return Number.isFinite(n)? n : null }
function textOrNull(t){ const s= (t||'').trim(); return s? s:null }

function parseJsonLd($){
  const out = { lat:null, lng:null, phone:null, website:null, hours:null, priceRange:null }
  $('script[type="application/ld+json"]').each((_,el)=>{
    try{
      const json = JSON.parse($(el).contents().text())
      const data = Array.isArray(json)? json.find(x=>x['@type']) : json
      if (!data) return
      if (data.geo){ out.lat = safeNum(data.geo.latitude); out.lng = safeNum(data.geo.longitude) }
      if (data.telephone){ out.phone = textOrNull(data.telephone) }
      if (data.url){ out.website = textOrNull(data.url) }
      if (data.priceRange){ out.priceRange = textOrNull(data.priceRange) }
      if (data.openingHoursSpecification){
        const hours = {}
        ;(data.openingHoursSpecification||[]).forEach((h)=>{
          const day = h.dayOfWeek || h['@type'] || 'Day'
          const open = h.opens || h.openingHours || h.open || null
          const close = h.closes || h.close || null
          const key = Array.isArray(day)? day.join(','): day
          hours[key] = open && close ? { open, close } : (open || close || null)
        })
        out.hours = hours
      }
    }catch(_){/* ignore */}
  })
  return out
}

function extractImages($){
  const urls = new Set()
  $('img').each((_,img)=>{ const src = $(img).attr('src')||$(img).attr('data-src'); if(src && /^https?:/.test(src)) urls.add(src) })
  $('meta[property="og:image"]').each((_,m)=>{ const c=$(m).attr('content'); if(c) urls.add(c) })
  return Array.from(urls).slice(0,50)
}

function extractAwards($){
  const awards=[]
  $('[data-automation="award"], .award, [class*="Award"]').each((_,el)=>{ const t=$(el).text().trim(); if(t) awards.push({ name:t }) })
  return awards.slice(0,20)
}

function extractReviews($){
  const reviews=[]
  $('[data-automation="review"]').slice(0,5).each((_,el)=>{
    const author = $(el).find('[data-automation="reviewer-name"]').text().trim()||null
    const title = $(el).find('[data-automation="review-title"]').text().trim()||null
    const text = $(el).find('q[data-automation="review-text"]').text().trim()||null
    const date = $(el).find('[data-automation="review-date"]').text().trim()||null
    const bubble = $(el).find('span.ui_bubble_rating').attr('class')||''
    const m = bubble.match(/bubble_(\d+)/)
    const rating = m? Number(m[1])/10 : null
    reviews.push({ author, title, text, date, rating })
  })
  return reviews
}

function slugify(name, id){
  const base = (name||'').toLowerCase().trim().replace(/[^\w\s-]/g,'').replace(/[\s_-]+/g,'-').replace(/^-+|-+$/g,'')
  return `${base}-${String(id||'').slice(-6)}`.slice(0, 200)
}

async function scrapeDetail(url, city){
  const html = await beeFetch(url)
  const $ = cheerio.load(html)

  const h1 = $('h1').first().text().trim() || $('[data-automation="main-h1"]').text().trim()
  const name = textOrNull(h1)
  const address = textOrNull($('[data-automation="address"], [class*="address"], [data-test-target="top-info-address"]').first().text())

  let lat=null, lng=null
  const ld = parseJsonLd($)
  lat = ld.lat; lng = ld.lng

  const ratingCls = $('span.ui_bubble_rating').first().attr('class')||''
  const rm = ratingCls.match(/bubble_(\d+)/)
  const rating = rm? Number(rm[1])/10 : null
  const reviewCount = safeNum($('a[data-automation="review-count"], [data-test-target="reviews-tab"]').first().text())

  const imageUrls = extractImages($)
  const primaryImage = imageUrls[0]||null

  const phone = textOrNull($('[data-automation="phone"]').first().text()) || ld.phone
  const website = textOrNull($('a[data-automation="website"]').attr('href')) || ld.website
  const description = textOrNull($('div[data-automation="description"], [data-test-target="amenity_text"]').first().text())

  const hours = ld.hours
  const priceRange = ld.priceRange || textOrNull($('[data-automation="price-range"]').text())
  const awards = extractAwards($)
  const reviews = extractReviews($)

  const idMatch = url.match(/-d(\d+)-/)
  const tripadvisor_id = idMatch? idMatch[1] : null

  const category = textOrNull($('[data-automation="breadcrumbs"] li').eq(1).text()) || null

  const now = new Date().toISOString()
  const listing = {
    tripadvisor_id,
    name,
    slug: slugify(name, tripadvisor_id),
    address,
    latitude: lat, longitude: lng, lat, lng,
    rating,
    review_count: reviewCount,
    category,
    source: 'tripadvisor',
    raw: { url, scraped_at: now },
    image_urls: imageUrls,
    primary_image_url: primaryImage,
    image_url: primaryImage,
    web_url: url,
    location_type: category,
    phone_number: phone,
    website,
    description,
    hours_of_operation: hours || {},
    photo_count: imageUrls.length || null,
    awards: awards.length? awards: null,
    price_range: priceRange || null,
    visibility_score: rating? Math.round(rating*20): null,
    highlights: [],
    best_for: [],
    review_details: reviews.length? reviews: null,
    ranking_in_city: null,
    ranking_in_category: null,
    amenities: [],
    accessibility_info: {},
    nearby_attractions: null,
    price_level: null,
    featured_image_url: primaryImage,
    verified: false,
    last_verified_at: null,
    fetch_status: 'success',
    fetch_error_message: null,
    ranking_position: null,
    num_reviews: reviewCount || null,
    ranking_string: null,
    cuisine: null,
    features: null,
    ranking_geo: null,
    phone: phone,
    email: null,
    subcategory: null,
    ranking_data: null,
    reviews_summary: null,
    tags: null,
    city: city,
    country: 'Philippines',
    region_name: null,
    currency: 'PHP',
    timezone: null,
    last_synced: now,
    updated_at: now
  }

  // Basic validation
  if (!listing.tripadvisor_id || !listing.name) throw new Error('Missing critical fields')
  return listing
}

async function upsertBatch(rows){
  if (!rows || rows.length===0) return 0
  const chunk = 25
  let total=0
  for (let i=0;i<rows.length;i+=chunk){
    const part = rows.slice(i,i+chunk)
    const { error } = await supabase
      .from('nearby_listings')
      .upsert(part, { onConflict: 'tripadvisor_id' })
    if (error) {
      console.error('Upsert error:', error.message)
    } else {
      total += part.length
    }
    await sleep(300)
  }
  return total
}

async function run(){
  const cities = CUSTOM_CITIES || (limitCities ? DEFAULT_CITIES.slice(0, limitCities) : DEFAULT_CITIES)
  let collected = 0
  for (const city of cities){
    try{
      console.log(`\n🔎 City: ${city}`)
      let searchUrl = `https://www.tripadvisor.com/Search?q=${encodeURIComponent(city + ' Philippines')}`
      // fallback to .com.ph if no results
      let html = await beeFetch(searchUrl)
      let links = parseSearch(html).slice(0, perCity)
      if (!links.length) {
        searchUrl = `https://www.tripadvisor.com.ph/Search?q=${encodeURIComponent(city + ' Philippines')}`
        html = await beeFetch(searchUrl)
        links = parseSearch(html).slice(0, perCity)
      }
      console.log(`  Found ${links.length} detail links`)
      const listings = []
      for (const link of links){
        try{
          const listing = await scrapeDetail(link, city)
          listings.push(listing)
          await sleep(500)
        }catch(e){
          console.warn('  Detail error:', e.message)
        }
        await sleep(400)
      }
      if (listings.length){
        const up = await upsertBatch(listings)
        collected += up
        console.log(`  ✓ Upserted ${up} listings for ${city}`)
      }
      await sleep(800)
    }catch(e){
      console.warn(`  City error ${city}:`, e.message)
      await sleep(1000)
    }
  }
  console.log(`\n✅ Done. Upserted total: ${collected}`)
}

run().catch(e=>{ console.error('Fatal:', e); process.exit(2) })
