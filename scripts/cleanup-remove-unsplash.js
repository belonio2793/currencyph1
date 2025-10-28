#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const SCRAPINGBEE_API_KEY = 'IQA11BPV1NYZEFAX4Q3SMM3DQZIBZWXY4O47IPRDBQPGAVZTQPKB4C2GAMXOEZJTEJ9TU5J2GQJJXSOP'

const UNSPLASH_MOUNTAIN = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4'

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
      await sleep(3000)
      return beeFetch(url)
    }
    throw new Error(`HTTP ${resp.status}`)
  }

  return await resp.text()
}

function extractImageUrls(html) {
  const urls = new Set()
  const imgRegex = /(https:\/\/[a-z0-9\-.]*tacdn\.com[^\s"'<>)]*)/gi
  let match
  while ((match = imgRegex.exec(html)) !== null) {
    let url = match[1].trim()
    url = url.replace(/[,;)\]]*$/, '')
    url = url.split('?')[0]
    url = url.split('#')[0]
    if (url.startsWith('https://') && url.length > 20) {
      urls.add(url)
    }
  }
  return Array.from(urls).slice(0, 50)
}

async function removeUnsplashFromPhotos() {
  console.log('🧹 Step 1: Removing unsplash mountain image from all listings...\n')

  try {
    const { data: listings, error: fetchError } = await supabase
      .from('nearby_listings')
      .select('id, name, photo_urls')
      .order('id', { ascending: true })

    if (fetchError) {
      console.error('❌ Failed to fetch listings:', fetchError.message)
      return false
    }

    if (!listings || listings.length === 0) {
      console.log('✅ No listings found')
      return true
    }

    let updated = 0
    let scanned = 0

    for (const listing of listings) {
      scanned++
      if (listing.photo_urls && Array.isArray(listing.photo_urls)) {
        const filtered = listing.photo_urls.filter(url => !url.includes(UNSPLASH_MOUNTAIN))
        
        if (filtered.length !== listing.photo_urls.length) {
          const removed = listing.photo_urls.length - filtered.length
          console.log(`[${scanned}/${listings.length}] ${listing.name}: Removing ${removed} unsplash URLs`)

          const { error } = await supabase
            .from('nearby_listings')
            .update({
              photo_urls: filtered,
              photo_count: filtered.length,
              updated_at: new Date().toISOString()
            })
            .eq('id', listing.id)

          if (!error) {
            updated++
          } else {
            console.log(`       ❌ Update failed: ${error.message}`)
          }
        }
      }
    }

    console.log(`\n✅ Cleanup complete: Updated ${updated} listings\n`)
    return true
  } catch (e) {
    console.error('❌ Error during cleanup:', e.message)
    return false
  }
}

async function fillEmptyPhotos() {
  console.log('📸 Step 2: Filling empty photo_urls from TripAdvisor...\n')

  try {
    const { data: listings, error: fetchError } = await supabase
      .from('nearby_listings')
      .select('id, name, city, web_url, photo_urls')
      .or('photo_urls.is.null,photo_urls.eq.{}')
      .limit(100)

    if (fetchError) {
      console.error('❌ Failed to fetch listings:', fetchError.message)
      return false
    }

    if (!listings || listings.length === 0) {
      console.log('✅ No listings with empty photo_urls found!')
      return true
    }

    console.log(`📊 Found ${listings.length} listings with empty photo_urls\n`)

    let success = 0
    let failed = 0

    for (let i = 0; i < listings.length; i++) {
      const listing = listings[i]
      console.log(`[${i + 1}/${listings.length}] ${listing.city} - ${listing.name}`)

      try {
        if (!listing.web_url) {
          console.log(`       ⚠️ No TripAdvisor URL`)
          failed++
          continue
        }

        console.log(`       📸 Scraping photos...`)
        const html = await beeFetch(listing.web_url)
        const photoUrls = extractImageUrls(html)

        if (!photoUrls.length) {
          console.log(`       ❌ No photos found`)
          failed++
        } else {
          console.log(`       ✓ Found ${photoUrls.length} photos`)

          const { error } = await supabase
            .from('nearby_listings')
            .update({
              photo_urls: photoUrls,
              photo_count: photoUrls.length,
              updated_at: new Date().toISOString()
            })
            .eq('id', listing.id)

          if (error) {
            console.log(`       ❌ DB error: ${error.message}`)
            failed++
          } else {
            success++
          }
        }
      } catch (e) {
        console.log(`       ❌ Error: ${e.message}`)
        failed++
      }

      await sleep(1000)
    }

    console.log(`\n✅ Fill complete!`)
    console.log(`   ✓ Updated: ${success}`)
    console.log(`   ✗ Failed: ${failed}`)
    return true
  } catch (e) {
    console.error('❌ Fatal error:', e.message)
    return false
  }
}

async function run() {
  console.log('🚀 Starting cleanup and fill photos process\n')
  console.log('=' .repeat(60))

  const cleanupSuccess = await removeUnsplashFromPhotos()
  if (!cleanupSuccess) {
    console.error('❌ Cleanup failed')
    process.exit(1)
  }

  await sleep(1000)

  const fillSuccess = await fillEmptyPhotos()
  if (!fillSuccess) {
    console.error('❌ Fill photos failed')
    process.exit(1)
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ All done! 🎉\n')
}

run()
