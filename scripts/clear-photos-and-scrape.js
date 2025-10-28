#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import cheerio from 'cheerio'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const SCRAPINGBEE_API_KEY = 'OPYAXOKXYQ0SBE7LR23GJ3NH1R4M66NUM85WJO1SCFUOFGJ11LJP6ZKD1JBVKNGMGC3E1RQXF81NT4YS'

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)
const MAX_PHOTOS_PER_LISTING = 5
const BATCH_SIZE = 5

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithScrapingBee(url) {
  try {
    const encodedUrl = encodeURIComponent(url)
    const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1?api_key=${SCRAPINGBEE_API_KEY}&url=${encodedUrl}`

    const response = await fetch(scrapingBeeUrl)

    if (!response.ok) {
      console.warn(`  ⚠️  ScrapingBee error (${response.status})`)
      return null
    }

    const html = await response.text()
    return html
  } catch (err) {
    console.warn(`  ⚠️  Fetch error:`, err.message)
    return null
  }
}

function extractPhotoUrlsFromHtml(html) {
  try {
    const $ = cheerio.load(html)
    const photos = new Set()

    // TripAdvisor stores photos in various places
    // Look for image URLs in script tags and data attributes
    const scriptTags = $('script')
    scriptTags.each((i, script) => {
      const content = $(script).html() || ''
      
      // Match TripAdvisor CDN URLs
      const matches = content.match(/https:\/\/[^"']*media\.tacdn\.com[^"']*photo[^"']*url[^"]*https:\/\/[^"']*media\.tacdn\.com[^"']*\.jpg/g)
      if (matches) {
        matches.forEach(url => photos.add(url.split(/[?#]/)[0]))
      }

      // Alternative pattern
      const matches2 = content.match(/"url":"(https:\/\/[^"]*media\.tacdn\.com[^"]*\.jpg)"/g)
      if (matches2) {
        matches2.forEach(m => {
          const url = m.match(/"url":"([^"]+)"/)[1]
          if (url) photos.add(url.split(/[?#]/)[0])
        })
      }
    })

    // Also check img tags
    $('img[src*="tacdn.com"]').each((i, img) => {
      const src = $(img).attr('src')
      if (src && src.includes('tacdn.com')) {
        photos.add(src.split(/[?#]/)[0])
      }
    })

    return Array.from(photos).slice(0, MAX_PHOTOS_PER_LISTING)
  } catch (err) {
    console.warn(`  ⚠️  Parse error:`, err.message)
    return []
  }
}

async function scrapeTripAdvisorPhotos(listing) {
  if (!listing.tripadvisor_id) return []

  try {
    // Try multiple TripAdvisor URL formats
    const urls = [
      `https://www.tripadvisor.com/Tourism-g${listing.tripadvisor_id}-Philippines.html`,
      `https://www.tripadvisor.com.ph/Tourism-g${listing.tripadvisor_id}-Philippines.html`,
    ]

    for (const url of urls) {
      console.log(`  Fetching: ${url.substring(0, 60)}...`)
      const html = await fetchWithScrapingBee(url)

      if (!html) {
        console.log(`  ⚠️  No HTML returned`)
        continue
      }

      const photos = extractPhotoUrlsFromHtml(html)
      if (photos.length > 0) {
        return photos
      }
    }

    return []
  } catch (err) {
    console.warn(`  ⚠️  Scrape error:`, err.message)
    return []
  }
}

async function clearPhotoUrls() {
  console.log('🧹 Clearing all photo_urls...\n')

  try {
    const { error } = await supabase
      .from('nearby_listings')
      .update({ photo_urls: null })
      .neq('photo_urls', null)

    if (error) {
      console.error('❌ Error clearing photos:', error)
      return false
    }

    console.log('✓ Cleared all photo_urls\n')
    return true
  } catch (err) {
    console.error('❌ Error:', err.message)
    return false
  }
}

async function updateListing(listingId, photos) {
  try {
    const { error } = await supabase
      .from('nearby_listings')
      .update({
        photo_urls: photos.length > 0 ? photos : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', listingId)

    if (error) throw error
    return true
  } catch (err) {
    console.warn(`  ⚠️  DB error:`, err.message)
    return false
  }
}

async function processBatch(listings) {
  let successful = 0
  let failed = 0

  for (const listing of listings) {
    if (!listing.tripadvisor_id) {
      console.log(`  ✗ ${listing.name} - No TripAdvisor ID`)
      failed++
      continue
    }

    process.stdout.write(`  ${listing.name}... `)

    const photos = await scrapeTripAdvisorPhotos(listing)

    if (!photos || photos.length === 0) {
      console.log('✗ No photos found')
      failed++
    } else {
      const success = await updateListing(listing.id, photos)
      if (success) {
        console.log(`✓ ${photos.length} photos`)
        successful++
      } else {
        console.log('✗ Failed to save')
        failed++
      }
    }

    await sleep(2000) // Respect rate limits
  }

  return { successful, failed }
}

async function main() {
  console.log('🕷️  Scraping TripAdvisor photos...\n')

  // First clear existing photos
  const cleared = await clearPhotoUrls()
  if (!cleared) {
    process.exit(1)
  }

  try {
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('id, name, city, tripadvisor_id')
      .order('id', { ascending: true })
      .limit(100) // Start with first 100 for testing

    if (error) {
      console.error('❌ Error fetching listings:', error)
      process.exit(1)
    }

    console.log(`📋 Processing ${listings.length} listings\n`)

    let totalSuccessful = 0
    let totalFailed = 0

    for (let i = 0; i < listings.length; i += BATCH_SIZE) {
      const batch = listings.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(listings.length / BATCH_SIZE)

      console.log(`📦 Batch ${batchNum}/${totalBatches}`)
      const { successful, failed } = await processBatch(batch)
      totalSuccessful += successful
      totalFailed += failed

      if (i + BATCH_SIZE < listings.length) {
        console.log('\n⏳ Rate limiting (5s)...\n')
        await sleep(5000)
      }
    }

    console.log('\n' + '='.repeat(70))
    console.log('✅ Complete!')
    console.log(`   Successfully scraped: ${totalSuccessful}`)
    console.log(`   Failed: ${totalFailed}`)
    console.log('='.repeat(70))

    process.exit(0)
  } catch (err) {
    console.error('❌ Fatal error:', err)
    process.exit(1)
  }
}

main()
