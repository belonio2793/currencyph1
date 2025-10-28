#!/usr/bin/env node
/*
grok-image-fetcher.js

Fetch a featured image for each nearby_listings row using Grok (X) or fallback to ScrapingBee scraping.
Updates nearby_listings.image_url and photo_urls (prepends found image).

Environment variables required:
  VITE_PROJECT_URL or PROJECT_URL
  VITE_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY
  X_API_KEY (Grok/X API key) - optional but preferred
  GROK_API_URL - optional, defaults to https://api.grok.ai/v1/search (override if needed)
  SCRAPING_BEE - optional fallback; if present, uses ScrapingBee to fetch TripAdvisor pages

Usage:
  X_API_KEY=... SCRAPING_BEE=... node scripts/grok-image-fetcher.js --batch=100 --start=0

This script is designed to be run locally or on a server where you have network access and the service role key.
*/

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import cheerio from 'cheerio'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const X_API_KEY = process.env.X_API_KEY || process.env.XAI_API_KEY || process.env.GROK_API_KEY
const GROK_API_URL = process.env.GROK_API_URL || 'https://api.grok.ai/v1/search'
const SCRAPING_BEE = process.env.SCRAPING_BEE || process.env.SCRAPINGBEE_API_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase PROJECT_URL or SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

// Simple arg parsing
const argv = process.argv.slice(2)
let BATCH = 100
let START = 0
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--batch' && argv[i+1]) { BATCH = Number(argv[i+1]); i++ }
  if (argv[i] === '--start' && argv[i+1]) { START = Number(argv[i+1]); i++ }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function grokSearchImage(query) {
  if (!X_API_KEY) return null

  // Build a direct prompt asking Grok to find a TripAdvisor page and return a direct image URL (first image)
  const prompt = `Find the TripAdvisor listing page for the query: "${query}". Respond with a single JSON object with keys: {"page_url": "<url>", "image_url": "<direct-image-url>"}. Only return valid JSON.`

  try {
    const res = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${X_API_KEY}`
      },
      body: JSON.stringify({
        query: prompt,
        // The payload shape depends on GROK provider; many providers accept {prompt} or {query} — adjust via GROK_API_URL env if needed
      }),
      timeout: 20000
    })

    if (!res.ok) {
      const t = await res.text()
      console.warn('Grok search failed', res.status, t.slice(0, 200))
      return null
    }

    const data = await res.json()

    // Heuristic: look for image_url in the response JSON
    // Support multiple shapes returned by different Grok endpoints
    if (!data) return null

    // Try a few common locations
    if (data.image_url && typeof data.image_url === 'string') return data.image_url
    if (data.result && typeof data.result === 'string') {
      // maybe raw text contains a URL — extract first https://...jpg/png/webp
      const m = data.result.match(/https?:\\/\\/[^\s\"']+\.(?:jpg|jpeg|png|webp)/i)
      if (m) return m[0]
    }

    // If there's a choices/outputs array (LLM-like), inspect it
    const searchPaths = ['output', 'outputs', 'choices', 'data', 'results']
    for (const p of searchPaths) {
      if (data[p]) {
        const str = JSON.stringify(data[p])
        const m = str.match(/https?:\\/\\/[^\s\"']+\.(?:jpg|jpeg|png|webp)/i)
        if (m) return m[0]
      }
    }

    // Last resort: scan entire JSON for URL-like strings
    const jsonStr = JSON.stringify(data)
    const m = jsonStr.match(/https?:\\/\\/[^\s\"']+\.(?:jpg|jpeg|png|webp)/i)
    if (m) return m[0]

    return null
  } catch (err) {
    console.warn('Grok request error:', err.message)
    return null
  }
}

async function scrapingBeeSearchImage(query) {
  if (!SCRAPING_BEE) return null
  try {
    const searchUrl = `https://www.tripadvisor.com/Search?q=${encodeURIComponent(query)}`
    const params = new URLSearchParams({ url: searchUrl, render_js: 'true', wait: '3000', premium_proxy: 'true' })
    const endpoint = `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(SCRAPING_BEE)}&${params.toString()}`
    const res = await fetch(endpoint, { timeout: 20000 })
    if (!res.ok) { console.warn('ScrapingBee search failed', res.status); return null }
    const html = await res.text()
    const $ = cheerio.load(html)

    // find first link to a detail page with -d<id>-
    let link = null
    $('a[href*="-d"]').each((_, a) => {
      const href = $(a).attr('href')
      if (href && /-d\d+-/.test(href)) {
        link = href.startsWith('http') ? href.split('?')[0] : `https://www.tripadvisor.com${href.split('?')[0]}`
        return false
      }
    })
    if (!link) return null

    // fetch detail page
    const detailParams = new URLSearchParams({ url: link, render_js: 'true', wait: '3000', premium_proxy: 'true' })
    const detailEndpoint = `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(SCRAPING_BEE)}&${detailParams.toString()}`
    const dres = await fetch(detailEndpoint, { timeout: 20000 })
    if (!dres.ok) { console.warn('ScrapingBee detail failed', dres.status); return null }
    const detailHtml = await dres.text()
    const $$ = cheerio.load(detailHtml)
    // try meta og:image
    const og = $$('meta[property="og:image"]').attr('content')
    if (og && og.startsWith('http')) return og
    // else first visible image
    const img = $$('img').map((i, el) => $$(el).attr('src') || $$(el).attr('data-src')).get().find(u => u && /^https?:/.test(u))
    if (img) return img
    return null
  } catch (err) {
    console.warn('ScrapingBee error:', err.message)
    return null
  }
}

async function processBatch(batchSize = BATCH, start = START) {
  console.log(`Fetching listings batch size=${batchSize} start=${start}`)
  const { data, error } = await supabase.from('nearby_listings').select('id,tripadvisor_id,name,city,image_url,photo_urls').order('id', { ascending: true }).range(start, start + batchSize - 1)
  if (error) { console.error('DB fetch error', error); return }
  const listings = data || []
  console.log(`Got ${listings.length} listings`)

  let processed = 0
  let updated = 0
  for (const l of listings) {
    processed++
    const id = l.id
    const name = l.name
    const city = l.city
    console.log(`\n[${processed}/${listings.length}] ${id} - ${name} (${city})`)

    // Skip if already has an image_url
    if (l.image_url) {
      console.log('  already has image_url, skipping')
      continue
    }

    const q = `${name} ${city || ''} TripAdvisor`.
      replace(/\s+/g, ' ').trim()

    let found = null

    // Try Grok first
    if (X_API_KEY) {
      console.log('  trying Grok...')
      found = await grokSearchImage(q)
      if (found) console.log('  grok ->', found)
    }

    // Fallback to ScrapingBee
    if (!found && SCRAPING_BEE) {
      console.log('  trying ScrapingBee...')
      found = await scrapingBeeSearchImage(q)
      if (found) console.log('  scrapingbee ->', found)
    }

    if (!found) {
      console.log('  no image found for listing')
      continue
    }

    // Update DB: set image_url and prepend to photo_urls
    const newPhotoUrls = Array.isArray(l.photo_urls) ? [found, ...l.photo_urls] : [found]
    const { error: upErr } = await supabase.from('nearby_listings').update({ image_url: found, photo_urls: newPhotoUrls, updated_at: new Date().toISOString() }).eq('id', id)
    if (upErr) {
      console.error('  DB update error', upErr)
    } else {
      console.log('  updated DB image_url')
      updated++
    }

    // polite delay
    await sleep(600)
  }

  console.log(`\nBatch complete. processed=${processed} updated=${updated}`)
}

async function main(){
  await processBatch(BATCH, START)
}

main().catch(err => { console.error('Fatal error', err); process.exit(1) })