#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY || 'OPYAXOKXYQ0SBE7LR23GJ3NH1R4M66NUM85WJO1SCFUOFGJ11LJP6ZKD1JBVKNGMGC3E1RQXF81NT4YS'

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing PROJECT_URL or SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)
const MAX_PHOTOS = 5
const BATCH_SIZE = 10

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function extractPhotoUrls(html) {
  try {
    // Look for photo URLs in various common patterns
    const patterns = [
      // TripAdvisor photo CDN pattern
      /https:\/\/media\.tacdn\.com\/media\/[^"'\s<>]+/g,
      // Original image URLs
      /https:\/\/[^"'\s<>]*tacdn\.com[^"'\s<>]+/g,
      // Data attributes with image URLs
      /data-[a-z-]*url[^"']*["']([^"']+photo[^"']+)["']/gi,
    ]

    const urls = new Set()
    
    for (const pattern of patterns) {
      const matches = html.match(pattern)
      if (matches) {
        matches.forEach(url => {
          // Clean and validate URL
          const cleanUrl = url.split(/[?#]/)[0] // Remove query params
          if (cleanUrl && cleanUrl.includes('tacdn.com') && cleanUrl.includes('photo')) {
            urls.add(cleanUrl)
          }
        })
      }
    }

    // Convert to array and limit
    return Array.from(urls).slice(0, MAX_PHOTOS)
  } catch (err) {
    console.warn('  ⚠️  Error extracting photo URLs:', err.message)
    return []
  }
}

async function scrapeTripAdvisorPhotos(tripadvisorId) {
  if (!tripadvisorId) return []

  try {
    const tripAdvisorUrl = `https://www.tripadvisor.com/Tourism-g${tripadvisorId}-Philippines.html`

    // ScrapingBee API format: https://app.scrapingbee.com/api/v1?api_key=xxx&url=xxx
    const encodedUrl = encodeURIComponent(tripAdvisorUrl)
    const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1?api_key=${SCRAPINGBEE_API_KEY}&url=${encodedUrl}`

    const response = await fetch(scrapingBeeUrl, {
      method: 'GET',
      timeout: 30000,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.warn(`  ⚠️  ScrapingBee error (${response.status}):`, errorText.substring(0, 100))
      return []
    }

    // ScrapingBee returns HTML directly as text
    const html = await response.text()
    if (!html) {
      console.warn('  ⚠️  No HTML received from ScrapingBee')
      return []
    }

    const photos = await extractPhotoUrls(html)
    return photos
  } catch (err) {
    console.warn(`  ⚠️  Scrape error:`, err.message)
    return []
  }
}

async function updatePhotoUrls(listingId, newUrls) {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('nearby_listings')
      .select('photo_urls')
      .eq('id', listingId)
      .single()

    if (fetchErr) throw fetchErr

    // Combine with existing URLs and deduplicate
    const current = Array.isArray(existing?.photo_urls) ? existing.photo_urls : []
    const combined = [...new Set([...current, ...newUrls])].slice(0, MAX_PHOTOS)

    const { error: updateErr } = await supabase
      .from('nearby_listings')
      .update({
        photo_urls: combined.length > 0 ? combined : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', listingId)

    if (updateErr) throw updateErr

    return combined
  } catch (err) {
    console.warn('  ⚠️  DB update error:', err.message)
    return []
  }
}

async function processBatch(listings) {
  let successful = 0
  let skipped = 0
  let failed = 0

  for (const listing of listings) {
    // Skip if already has photos
    if (Array.isArray(listing.photo_urls) && listing.photo_urls.length >= MAX_PHOTOS) {
      console.log(`  ⊘ ${listing.name} - Already has ${listing.photo_urls.length} photos`)
      skipped++
      continue
    }

    if (!listing.tripadvisor_id) {
      console.log(`  ✗ ${listing.name} - No TripAdvisor ID`)
      failed++
      continue
    }

    process.stdout.write(`  ${listing.name} (${listing.city})... `)

    const photos = await scrapeTripAdvisorPhotos(listing.tripadvisor_id)

    if (!photos || photos.length === 0) {
      console.log('✗ No photos found')
      failed++
      await sleep(2000) // Longer delay between failed attempts
      continue
    }

    const updated = await updatePhotoUrls(listing.id, photos)
    if (updated && updated.length > 0) {
      console.log(`✓ Updated (${updated.length} photos)`)
      successful++
    } else {
      console.log('✗ Failed to update')
      failed++
    }

    await sleep(1500) // Rate limit between requests
  }

  return { successful, skipped, failed }
}

async function main() {
  console.log('🕷️  Scraping TripAdvisor photos using ScrapingBee...\n')

  try {
    // Get listings without enough photos
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('id, name, city, tripadvisor_id, photo_urls')
      .order('id', { ascending: true })

    if (error) {
      console.error('❌ Error fetching listings:', error)
      process.exit(1)
    }

    // Filter listings that need photos
    const needPhotos = listings.filter(
      l => !Array.isArray(l.photo_urls) || l.photo_urls.length < MAX_PHOTOS
    )

    console.log(`📋 Total listings: ${listings.length}`)
    console.log(`📸 Already have max photos: ${listings.length - needPhotos.length}`)
    console.log(`🔍 Need photos: ${needPhotos.length}\n`)

    let totalSuccessful = 0
    let totalSkipped = 0
    let totalFailed = 0

    for (let i = 0; i < needPhotos.length; i += BATCH_SIZE) {
      const batch = needPhotos.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(needPhotos.length / BATCH_SIZE)

      console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, needPhotos.length)})`)
      console.log('-'.repeat(70))

      const { successful, skipped, failed } = await processBatch(batch)
      totalSuccessful += successful
      totalSkipped += skipped
      totalFailed += failed

      if (i + BATCH_SIZE < needPhotos.length) {
        console.log('\n⏳ Rate limiting (5s before next batch)...')
        await sleep(5000)
      }
    }

    console.log('\n' + '='.repeat(70))
    console.log('🎉 Complete!')
    console.log(`   Total processed: ${needPhotos.length}`)
    console.log(`   Successfully updated: ${totalSuccessful}`)
    console.log(`   Skipped (already had photos): ${totalSkipped}`)
    console.log(`   Failed: ${totalFailed}`)
    console.log(`   Success rate: ${Math.round((totalSuccessful / (needPhotos.length - totalSkipped || 1)) * 100)}%`)
    console.log('='.repeat(70))

    process.exit(0)
  } catch (err) {
    console.error('❌ Fatal error:', err)
    process.exit(1)
  }
}

main()
