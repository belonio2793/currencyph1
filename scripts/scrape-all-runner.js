#!/usr/bin/env node
/*
 Robust TripAdvisor scraper runner using ScrapingBee and Supabase.
 Usage:
  SCRAPING_BEE=your_key VITE_PROJECT_URL=https://... VITE_SUPABASE_SERVICE_ROLE_KEY=... node scripts/scrape-all-runner.js

 The script resumes progress in .scrape_progress.json and logs to stdout.
*/

import { createClient } from '@supabase/supabase-js'
import cheerio from 'cheerio'
import fs from 'fs'
import path from 'path'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const SCRAPING_BEE = process.env.SCRAPING_BEE || process.env.SCRAPINGBEE_API_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase PROJECT_URL or SERVICE_ROLE_KEY env vars')
  process.exit(1)
}
if (!SCRAPING_BEE) {
  console.warn('SCRAPING_BEE not set — scraper will likely fail');
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

// List of cities to process (can be extended)
const CITIES = [
  'Manila','Cebu City','Davao City','Quezon City','Makati','Baguio','Boracay','Puerto Princesa','Iloilo City','Pasig','Taguig','Caloocan','Las Piñas','Parañaque','Marikina','Muntinlupa','Cagayan de Oro','General Santos','Dagupan','Lucena','Batangas City','Bacolod','Zamboanga City','Butuan','Iloilo','Olongapo','Roxas','San Fernando','Naga','Santa Rosa','Calamba'
]

const PROGRESS_FILE = path.join(process.cwd(), '.scrape_progress.json')
let progress = { cityIndex: 0, cityProcessed: {} }
if (fs.existsSync(PROGRESS_FILE)) {
  try { progress = JSON.parse(fs.readFileSync(PROGRESS_FILE,'utf8')) } catch(e) { console.warn('Failed to read progress file, starting fresh') }
}

function saveProgress() { fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2)) }

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)) }

async function beeFetch(url){
  const params = new URLSearchParams({ url, render_js: 'true', country_code: 'ph', wait: '3000', block_resources: 'false', premium_proxy: 'true' })
  const endpoint = `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(SCRAPING_BEE || '')}&${params.toString()}`
  try{
    const res = await fetch(endpoint, { timeout: 20000 })
    if (!res.ok) throw new Error(`ScrapingBee ${res.status}`)
    return await res.text()
  }catch(err){
    throw err
  }
}

function parseSearch(html){
  const $ = cheerio.load(html)
  const links = new Set()
  $('a[href*="-d"]').each((_, a)=>{
    const href = $(a).attr('href')
    if (href && /-d\d+-/.test(href)) links.add((href.startsWith('http')?href:`https://www.tripadvisor.com${href.split('?')[0]}`))
  })
  if (links.size===0) {
    const m = html.match(/"location_id":"?(\d+)/g) || []
    m.slice(0,50).forEach(x=>{const id=(x.match(/(\d+)/)||[])[1]; if(id) links.add(`https://www.tripadvisor.com/Attraction_Review-d${id}`)})
  }
  return Array.from(links)
}

function parseJsonLd($){
  const out = { lat:null, lng:null, phone:null, website:null, hours:null, priceRange:null }
  $('script[type="application/ld+json"]').each((_,el)=>{
    try{
      const json = JSON.parse($(el).contents().text())
      const data = Array.isArray(json)? json.find(x=>x['@type']): json
      if(!data) return
      if (data.geo){ out.lat = parseFloat(data.geo.latitude); out.lng = parseFloat(data.geo.longitude) }
      if (data.telephone) out.phone = data.telephone
      if (data.url) out.website = data.url
      if (data.priceRange) out.priceRange = data.priceRange
    }catch(e){}
  })
  return out
}

function extractImages($){
  const urls = new Set()
  $('img').each((_,img)=>{ const src = $(img).attr('src')||$(img).attr('data-src'); if(src && /^https?:/.test(src)) urls.add(src) })
  $('meta[property="og:image"]').each((_,m)=>{ const c=$(m).attr('content'); if(c) urls.add(c) })
  return Array.from(urls).slice(0,50)
}

async function scrapeDetail(url, city){
  const html = await beeFetch(url)
  const $ = cheerio.load(html)
  const h1 = $('h1').first().text().trim() || $('[data-automation="main-h1"]').text().trim()
  const name = h1 || null
  const ld = parseJsonLd($)
  const ratingCls = $('span.ui_bubble_rating').first().attr('class')||''
  const rm = ratingCls.match(/bubble_(\d+)/)
  const rating = rm? Number(rm[1])/10 : null
  const reviewCountText = $('a[data-automation="review-count"]').first().text() || $('a[href*="#REVIEWS"]').first().text()
  const reviewCount = reviewCountText ? Number((reviewCountText||'').replace(/[^0-9]/g,'')) : null
  const imageUrls = extractImages($)
  const primaryImage = imageUrls[0]||null
  const address = $('[data-automation="address"]').first().text().trim() || null
  const phone = $('[data-automation="phone"]').first().text().trim() || ld.phone || null
  const website = $('[data-automation="website"]').attr('href') || ld.website || null
  const description = $('[data-automation="description"]').first().text().trim() || null
  const idMatch = url.match(/-d(\d+)-/) || html.match(/"location_id":"?(\d+)/)
  const tripadvisor_id = idMatch? String(idMatch[1] || idMatch[2]) : null

  const listing = {
    tripadvisor_id,
    name,
    slug: (name? name.toLowerCase().replace(/[^
\w\s-]/g,'').replace(/\s+/g,'-').slice(0,150): null),
    address,
    latitude: ld.lat || null,
    longitude: ld.lng || null,
    rating,
    review_count: reviewCount,
    category: null,
    location_type: null,
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

  if(!listing.tripadvisor_id || !listing.name) throw new Error('Missing critical fields')
  return listing
}

async function upsertListing(listing){
  const { error } = await supabase.from('nearby_listings').upsert(listing, { onConflict: 'tripadvisor_id' })
  if (error) throw error
}

async function processCity(city, resumeUrls = []){
  try{
    console.log(`\n=== City: ${city} ===`)
    const searchUrl = `https://www.tripadvisor.com/Search?q=${encodeURIComponent(city + ' Philippines')}`
    let html
    try{ html = await beeFetch(searchUrl) } catch(e){ console.warn('Search Bee failed for', city, e.message); return 0 }
    let links = parseSearch(html)
    if (links.length===0){
      try{ html = await beeFetch(`https://www.tripadvisor.com.ph/Search?q=${encodeURIComponent(city + ' Philippines')}`); links = parseSearch(html) }catch(e){}
    }
    console.log(`Found ${links.length} detail links for ${city}`)
    // if resuming, filter out already processed
    if (resumeUrls && resumeUrls.length) links = links.filter(l => !resumeUrls.includes(l))

    let upserted = 0
    for (const link of links){
      try{
        const listing = await scrapeDetail(link, city)
        await upsertListing(listing)
        upserted++
        console.log(`✓ Upserted ${listing.name} (${listing.tripadvisor_id})`)
      }catch(e){ console.warn('Detail scrape/upsert failed for', link, e.message) }
      await sleep(700)
    }
    return upserted
  }catch(e){ console.error('processCity error', e); return 0 }
}

async function run(){
  console.log('Starting scrape-all-runner')

  for (let i = progress.cityIndex; i < CITIES.length; i++){
    const city = CITIES[i]
    const resumed = progress.cityProcessed?.[city] || []
    try{
      const count = await processCity(city, resumed)
      progress.cityIndex = i + 1
      progress.cityProcessed[city] = (progress.cityProcessed[city] || []).concat([])
      saveProgress()
      console.log(`City ${city} processed. upserted=${count}`)
    }catch(e){ console.error('City run failed:', city, e.message) }
    await sleep(1500)
  }

  console.log('All cities processed')
}

run().catch(e=>{ console.error('Fatal:', e); process.exit(1) })