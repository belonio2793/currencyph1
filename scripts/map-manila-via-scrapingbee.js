#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import cheerio from 'cheerio'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY || process.env.SCRAPING_BEE

if (!PROJECT_URL || !SERVICE_ROLE_KEY) { console.error('Missing Supabase env'); process.exit(1) }
if (!SCRAPINGBEE_API_KEY) { console.error('Missing SCRAPING_BEE key'); process.exit(1) }

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

function sleep(ms){return new Promise(r=>setTimeout(r,ms))}

async function beeFetch(url){
  const params = new URLSearchParams({ url, render_js: 'true', country_code: 'ph', wait: '3000', block_resources: 'false', premium_proxy: 'true' })
  const resp = await fetch(`https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(SCRAPINGBEE_API_KEY)}&${params.toString()}`)
  if (!resp.ok) throw new Error(`Bee ${resp.status}`)
  return await resp.text()
}

function parseSearch(html){
  const $ = cheerio.load(html)
  const links = new Set()
  $('a[href*="-d"]').each((_, a)=>{
    const href = $(a).attr('href')
    if (href && /-d\d+-/.test(href)) links.add((href.startsWith('http')?href:`https://www.tripadvisor.com${href.split('?')[0]}`))
  })
  if (links.size===0){
    const m = html.match(/"location_id":"?(\d+)/g) || []
    m.slice(0,20).forEach(x=>{const id=(x.match(/(\d+)/)||[])[1]; if(id) links.add(`https://www.tripadvisor.com/Attraction_Review-d${id}`)})
  }
  return Array.from(links)
}

async function scrapeDetail(url){
  const html = await beeFetch(url)
  const $ = cheerio.load(html)
  const name = $('h1').first().text().trim()
  const idMatch = url.match(/-d(\d+)-/) || html.match(/"location_id":"?(\d+)/)
  const tripadvisor_id = idMatch? String(idMatch[1] || idMatch[2]) : null
  const image = $('meta[property="og:image"]').attr('content') || $('img').first().attr('src') || null
  return { tripadvisor_id, name, image, web_url: url }
}

async function main(){
  const { data, error } = await supabase.from('nearby_listings').select('id, tripadvisor_id, name, city').ilike('city','%manila%').like('tripadvisor_id','php_%').limit(200)
  if (error) { console.error(error); process.exit(1) }
  const listings = data || []
  console.log(`Processing ${listings.length} Manila listings`)
  let updated = 0
  for (const l of listings){
    try{
      const q = `${l.name} Manila`.trim()
      const searchUrl = `https://www.tripadvisor.com/Search?q=${encodeURIComponent(q)}`
      const html = await beeFetch(searchUrl)
      const links = parseSearch(html)
      if (!links.length){
        const html2 = await beeFetch(`https://www.tripadvisor.com.ph/Search?q=${encodeURIComponent(q)}`)
        const links2 = parseSearch(html2)
        links.push(...links2)
      }
      if (links.length===0){ console.log(`✗ No links for: ${l.name}`); await sleep(400); continue }
      const detail = await scrapeDetail(links[0])
      if (!detail.tripadvisor_id){ console.log(`✗ Could not extract id for ${l.name}`); await sleep(400); continue }
      const { error: upErr } = await supabase.from('nearby_listings').update({ tripadvisor_id: detail.tripadvisor_id, image_url: detail.image, web_url: detail.web_url, updated_at: new Date().toISOString() }).eq('id', l.id)
      if (upErr){ console.log(`✗ DB update failed for ${l.name}:`, upErr.message) }
      else { updated++; console.log(`✓ ${l.name} → ${detail.tripadvisor_id}`) }
      await sleep(500)
    }catch(e){ console.log(`✗ Error for ${l.name}:`, e.message); await sleep(700) }
  }
  console.log(`Done. Updated ${updated}/${listings.length}`)
}

main().catch(e=>{ console.error(e); process.exit(1) })
