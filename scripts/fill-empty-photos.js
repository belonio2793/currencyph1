#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const SCRAPINGBEE_API_KEY = 'IQA11BPV1NYZEFAX4Q3SMM3DQZIBZWXY4O47IPRDBQPGAVZTQPKB4C2GAMXOEZJTEJ9TU5J2GQJJXSOP'

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase env (PROJECT_URL, SUPABASE_SERVICE_ROLE_KEY)')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

function sleep(ms) { 
  return new Promise(r => setTimeout(r, ms)) 
}

async function beeFetch(url) {
  const params = new URLSearchParams({
    url,
    render_js: 'true',
    country_code: 'ph',
    wait: '3000',
    block_resources: 'false',
    premium_proxy: 'true'
  })

  const resp = await fetch(
    `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(SCRAPINGBEE_API_KEY)}&${params.toString()}`,
    { timeout: 60000 }
  )

  if (!resp.ok) {
    if (resp.status === 429) {
      console.log('    ⚠️ Rate limited, waiting...')
      await sleep(3000)
      return beeFetch(url)
    }
    throw new Error(`HTTP ${resp.status}`)
  }

  return await resp.text()
}

function extractImageUrls(html) {
  const urls = new Set()

  // Match all image URLs from tacdn.com
  const imgRegex = /(https:\/\/[a-z0-9\-.]*tacdn\.com[^\s"'<>)]*)/gi
  let match
  while ((match = imgRegex.exec(html)) !== null) {
    let url = match[1].trim()
    // Remove trailing punctuation that might have been captured
    url = url.replace(/[,;)\]]*$/, '')
    // Remove query parameters
    url = url.split('?')[0]
    // Remove fragments
    url = url.split('#')[0]
    if (url.startsWith('https://') && url.length > 20) {
      urls.add(url)
    }
  }

  return Array.from(urls).slice(0, 50)
}

async function scrapeListingPhotos(listing) {
  try {
    if (!listing.web_url) {
      return { success: false, reason: 'no_url' }
    }

    console.log(`    📸 Scraping ${listing.web_url.substring(0, 60)}...`)
    const html = await beeFetch(listing.web_url)
    const photoUrls = extractImageUrls(html)

    if (!photoUrls.length) {
      return { success: false, reason: 'no_photos', found: 0 }
    }

    console.log(`       ✓ Found ${photoUrls.length} images`)

    const { error } = await supabase
      .from('nearby_listings')
      .update({
        photo_urls: photoUrls,
        photo_count: photoUrls.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', listing.id)

    if (error) {
      return { success: false, reason: 'db_error', error: error.message }
    }

    return { success: true, count: photoUrls.length }
  } catch (e) {
    return { success: false, reason: 'scrape_error', error: e.message }
  }
}

async function run() {
  console.log('🔍 Finding listings with empty photo_urls...\n')

  try {
    // Get listings with empty photo_urls
    const { data: listings, error: fetchError } = await supabase
      .from('nearby_listings')
      .select('id, name, city, web_url, photo_urls')
      .or('photo_urls.is.null,photo_urls.eq.{}')
      .limit(100)

    if (fetchError) {
      console.error('❌ Failed to fetch listings:', fetchError.message)
      process.exit(1)
    }

    if (!listings || listings.length === 0) {
      console.log('✅ No listings with empty photo_urls found!')
      process.exit(0)
    }

    console.log(`📊 Found ${listings.length} listings with empty photo_urls\n`)

    let success = 0
    let failed = 0

    for (let i = 0; i < listings.length; i++) {
      const listing = listings[i]
      console.log(`[${i + 1}/${listings.length}] ${listing.city} - ${listing.name}`)

      const result = await scrapeListingPhotos(listing)

      if (result.success) {
        console.log(`       ✅ Updated with ${result.count} photos`)
        success++
      } else {
        console.log(`       ❌ Failed (${result.reason}${result.error ? ': ' + result.error : ''})`)
        failed++
      }

      // Stagger requests
      await sleep(1000)
    }

    console.log(`\n✅ Complete!`)
    console.log(`   ✓ Updated: ${success}`)
    console.log(`   ✗ Failed: ${failed}`)

  } catch (e) {
    console.error('❌ Fatal error:', e.message)
    process.exit(1)
  }
}

run()
