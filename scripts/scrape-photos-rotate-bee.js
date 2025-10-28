#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import cheerio from 'cheerio'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase env (PROJECT_URL, SUPABASE_SERVICE_ROLE_KEY)')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

// ScrapingBee API keys for rotation
const SCRAPINGBEE_KEYS = [
  'OPYAXOKXYQ0SBE7LR23GJ3NH1R4M66NUM85WJO1SCFUOFGJ11LJP6ZKD1JBVKNGMGC3E1RQXF81NT4YS',
  'Z3CQBBBPQIA4FQAQOHWJVO40ZKIRMM7LNUBVOQVAN2VP2PE2F1PQO9JGJZ5C9U9C9LRWK712V7P963C9'
]

let currentKeyIndex = 0

function sleep(ms) { 
  return new Promise(r => setTimeout(r, ms)) 
}

function getNextKey() {
  const key = SCRAPINGBEE_KEYS[currentKeyIndex]
  currentKeyIndex = (currentKeyIndex + 1) % SCRAPINGBEE_KEYS.length
  return key
}

async function beeFetch(url, opts = {}) {
  const apiKey = getNextKey()
  
  async function doFetch(renderJs) {
    const params = new URLSearchParams({ 
      url, 
      render_js: renderJs ? 'true' : 'false', 
      country_code: 'ph', 
      wait: '4000', 
      block_resources: 'false', 
      premium_proxy: 'true' 
    })
    
    if (opts.params) {
      Object.entries(opts.params).forEach(([k, v]) => params.set(k, String(v)))
    }
    
    const resp = await fetch(
      `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(apiKey)}&${params.toString()}`
    )
    
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      const err = new Error(`Bee ${resp.status} ${resp.statusText}: ${txt.slice(0, 200)}`)
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
      console.log('  ⚠️ Rate limit hit, rotating API key and retrying...')
      await sleep(1500)
      return await doFetch(true)
    }
    throw e
  }
}

function extractPhotoUrls(html) {
  const $ = cheerio.load(html)
  const urls = new Set()
  
  // Extract from img tags with tacdn.com (TripAdvisor's image CDN)
  $('img').each((_, img) => {
    const src = $(img).attr('src') || $(img).attr('data-src')
    if (src && src.includes('tacdn.com')) {
      urls.add(src)
    }
  })
  
  // Extract from picture elements
  $('picture source').each((_, el) => {
    const src = $(el).attr('srcset')
    if (src) {
      const matches = src.match(/https?:\/\/[^\s,]+/g)
      if (matches) {
        matches.forEach(url => {
          if (url.includes('tacdn.com')) {
            urls.add(url.split(' ')[0])
          }
        })
      }
    }
  })
  
  // Extract from data attributes
  $('[data-image-url]').each((_, el) => {
    const src = $(el).attr('data-image-url')
    if (src && src.includes('tacdn.com')) {
      urls.add(src)
    }
  })
  
  // Extract from background-image styles
  $('[style*="background-image"]').each((_, el) => {
    const style = $(el).attr('style')
    const matches = style.match(/url\(['"]?([^'")\s]+)['"]?\)/g)
    if (matches) {
      matches.forEach(match => {
        const url = match.replace(/url\(['"]?|['"]?\)/g, '')
        if (url.includes('tacdn.com')) {
          urls.add(url)
        }
      })
    }
  })
  
  // Extract from meta tags
  $('meta[property="og:image"]').each((_, el) => {
    const content = $(el).attr('content')
    if (content && content.includes('tacdn.com')) {
      urls.add(content)
    }
  })
  
  // Extract from JSON-LD
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).text())
      if (json.image) {
        const images = Array.isArray(json.image) ? json.image : [json.image]
        images.forEach(img => {
          if (typeof img === 'string' && img.includes('tacdn.com')) {
            urls.add(img)
          } else if (typeof img === 'object' && img.url && img.url.includes('tacdn.com')) {
            urls.add(img.url)
          }
        })
      }
    } catch (e) {
      // Ignore JSON parsing errors
    }
  })
  
  // Filter out duplicates and invalid URLs
  return Array.from(urls)
    .filter(url => url && url.startsWith('http'))
    .map(url => {
      // Clean up URLs - remove query params that might cause duplicates
      return url.split('?')[0].split('&')[0]
    })
    .filter((url, idx, arr) => arr.indexOf(url) === idx)
    .slice(0, 100) // Limit to 100 photos per listing
}

function mergePhotoUrls(existingUrls, newUrls) {
  // Combine and deduplicate
  const combined = new Set([...(existingUrls || []), ...newUrls])
  return Array.from(combined)
}

async function scrapeListingPhotos(listing) {
  try {
    if (!listing.web_url) {
      console.log(`    ⚠️ No TripAdvisor URL for "${listing.name}"`)
      return null
    }
    
    console.log(`    🔍 Scraping: ${listing.name}`)
    const html = await beeFetch(listing.web_url)
    const photoUrls = extractPhotoUrls(html)
    
    if (!photoUrls.length) {
      console.log(`    ⚠️ No photos found`)
      return null
    }
    
    const existingPhotos = listing.photo_urls || []
    const mergedPhotos = mergePhotoUrls(existingPhotos, photoUrls)
    const newCount = mergedPhotos.length - existingPhotos.length
    
    console.log(`    ✓ Found ${photoUrls.length} photos (${newCount} new, ${existingPhotos.length} existing)`)
    
    return {
      id: listing.id,
      photo_urls: mergedPhotos,
      photo_count: mergedPhotos.length,
      updated_at: new Date().toISOString()
    }
  } catch (e) {
    console.log(`    ❌ Error: ${e.message}`)
    return null
  }
}

async function updateListing(update) {
  const { error } = await supabase
    .from('nearby_listings')
    .update({
      photo_urls: update.photo_urls,
      photo_count: update.photo_count,
      updated_at: update.updated_at
    })
    .eq('id', update.id)
  
  if (error) {
    console.log(`      DB error: ${error.message}`)
    return false
  }
  return true
}

async function run() {
  console.log('🚀 Starting TripAdvisor Photo Gallery Scraper')
  console.log(`📌 Using ${SCRAPINGBEE_KEYS.length} API keys with rotation\n`)
  
  try {
    // Get all listings from nearby_listings
    const { data: listings, error: fetchError } = await supabase
      .from('nearby_listings')
      .select('id, name, web_url, photo_urls, city')
      .order('id', { ascending: true })
    
    if (fetchError) {
      console.error('❌ Failed to fetch listings:', fetchError.message)
      process.exit(1)
    }
    
    if (!listings || listings.length === 0) {
      console.error('❌ No listings found in database')
      process.exit(1)
    }
    
    console.log(`📊 Found ${listings.length} listings to process\n`)
    
    let processed = 0
    let updated = 0
    let errors = 0
    
    // Process listings in batches with delays
    for (let i = 0; i < listings.length; i++) {
      const listing = listings[i]
      const progress = `[${i + 1}/${listings.length}]`
      
      console.log(`${progress} ${listing.city}`)
      
      try {
        const update = await scrapeListingPhotos(listing)
        processed++
        
        if (update) {
          const success = await updateListing(update)
          if (success) {
            updated++
          } else {
            errors++
          }
        }
        
        // Stagger requests to avoid rate limiting
        await sleep(800)
      } catch (e) {
        console.log(`    ❌ Fatal error: ${e.message}`)
        errors++
        await sleep(1000)
      }
    }
    
    console.log(`\n✅ Complete!`)
    console.log(`   Processed: ${processed}`)
    console.log(`   Updated: ${updated}`)
    console.log(`   Errors: ${errors}`)
    
  } catch (e) {
    console.error('❌ Fatal error:', e.message)
    process.exit(1)
  }
}

run()
