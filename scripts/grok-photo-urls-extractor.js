#!/usr/bin/env node
/*
grok-photo-urls-extractor.js

Fetch real photo URLs from TripAdvisor listings using Grok AI + ScrapingBee.
Extracts URLs from dynamic-media-cdn.tripadvisor.com directly.
Removes fallback/fake images and populates photo_urls column.

Environment variables required:
  VITE_PROJECT_URL or PROJECT_URL
  VITE_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY
  X_API_KEY (Grok/X API key)

ScrapingBee API keys:
  Multiple keys provided to rotate and avoid rate limiting

Usage:
  X_API_KEY=... node scripts/grok-photo-urls-extractor.js --batch=10 --start=0 --limit=50

This script is designed to be run locally where you have network access.
*/

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const X_API_KEY = process.env.X_API_KEY || process.env.XAI_API_KEY || process.env.GROK_API_KEY

const SCRAPINGBEE_KEYS = [
  'Z3CQBBBPQIA4FQAQOHWJVO40ZKIRMM7LNUBVOQVAN2VP2PE2F1PQO9JGJZ5C9U9C9LRWK712V7P963C9',
  'OPYAXOKXYQ0SBE7LR23GJ3NH1R4M66NUM85WJO1SCFUOFGJ11LJP6ZKD1JBVKNGMGC3E1RQXF81NT4YS',
  'IQA11BPV1NYZEFAX4Q3SMM3DQZIBZWXY4O47IPRDBQPGAVZTQPKB4C2GAMXOEZJTEJ9TU5J2GQJJXSOP',
  'DHOMQK5VZOIUQN9JJZHFR3WX07XFGTFFYFVCRM6AOLZFGI5S9Z60R23AQM2LUL84M2SNK4HH9NGMVDCG'
]

const MAX_PHOTOS = 20
let currentKeyIndex = 0

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase PROJECT_URL or SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

if (!X_API_KEY) {
  console.error('Missing X_API_KEY (Grok) environment variable')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

// Parse command line arguments
const argv = process.argv.slice(2)
let BATCH = 10
let START = 0
let LIMIT = 999999
let SKIP_EXISTING = true

for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--batch' && argv[i+1]) { BATCH = Number(argv[i+1]); i++ }
  if (argv[i] === '--start' && argv[i+1]) { START = Number(argv[i+1]); i++ }
  if (argv[i] === '--limit' && argv[i+1]) { LIMIT = Number(argv[i+1]); i++ }
  if (argv[i] === '--force') { SKIP_EXISTING = false }
}

function sleep(ms) { 
  return new Promise(r => setTimeout(r, ms)) 
}

function getNextScrapingBeeKey() {
  const key = SCRAPINGBEE_KEYS[currentKeyIndex]
  currentKeyIndex = (currentKeyIndex + 1) % SCRAPINGBEE_KEYS.length
  return key
}

// Extract image URLs from HTML using regex patterns
function extractPhotoUrlsFromHTML(html) {
  const photoUrls = new Set()

  // Pattern 1: Dynamic media CDN (preferred format)
  // https://dynamic-media-cdn.tripadvisor.com/media/photo-...
  const dynamicPattern = /https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo[a-zA-Z0-9\-_\/]*(?:\.jpg|\.png|\.webp)?/g
  const dynamicMatches = html.match(dynamicPattern) || []
  dynamicMatches.forEach(url => {
    const cleaned = url.split(/['"?]/)[0].trim()
    if (cleaned && cleaned.startsWith('https://dynamic-media-cdn.tripadvisor.com')) {
      // Remove query parameters and normalize
      const baseUrl = cleaned.split('?')[0].split('#')[0]
      if (baseUrl && !baseUrl.includes('placeholder') && !baseUrl.includes('logo')) {
        photoUrls.add(baseUrl)
      }
    }
  })

  // Pattern 2: Media tacdn images (backup)
  const mediaPattern = /https:\/\/media\.tacdn\.com\/media\/photo[a-zA-Z0-9\-_\/]*(?:\.jpg|\.png|\.webp)?/g
  const mediaMatches = html.match(mediaPattern) || []
  mediaMatches.forEach(url => {
    const cleaned = url.split(/['"?]/)[0].trim()
    if (cleaned && cleaned.startsWith('https://media.tacdn.com')) {
      const baseUrl = cleaned.split('?')[0].split('#')[0]
      if (baseUrl && !baseUrl.includes('placeholder') && !baseUrl.includes('logo')) {
        photoUrls.add(baseUrl)
      }
    }
  })

  // Pattern 3: Extract from data attributes and srcset
  const srcsetPattern = /(?:src|data-src|data-image)=["']?(https:\/\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp))/g
  let match
  while ((match = srcsetPattern.exec(html)) !== null) {
    const url = match[1]
    if ((url.includes('tacdn') || url.includes('dynamic-media-cdn')) && !url.includes('placeholder') && !url.includes('logo')) {
      const baseUrl = url.split('?')[0].split('#')[0]
      if (baseUrl) {
        photoUrls.add(baseUrl)
      }
    }
  }

  return Array.from(photoUrls).slice(0, MAX_PHOTOS)
}

// Fetch HTML from TripAdvisor using ScrapingBee
async function fetchTripAdvisorPage(url) {
  const scrapingBeeKey = getNextScrapingBeeKey()

  try {
    console.log(`    [Scraping with ScrapingBee key index ${currentKeyIndex - 1}]`)
    
    const params = new URLSearchParams({
      api_key: scrapingBeeKey,
      url: url,
      render_js: 'false',
      timeout: '15000'
    })

    const response = await fetch(`https://api.scrapingbee.com/api/v1/?${params}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 20000
    })

    if (!response.ok) {
      console.log(`    ScrapingBee error: ${response.status}`)
      return null
    }

    const html = await response.text()
    return html
  } catch (err) {
    console.log(`    ScrapingBee fetch error: ${err.message}`)
    return null
  }
}

// Use Grok to analyze the listing and extract photo URLs
async function grokAnalyzePhotos(listingName, listingUrl, htmlContent) {
  try {
    const prompt = `You are analyzing a TripAdvisor listing page for "${listingName}".
    
The HTML content is below. Extract ALL photo URLs that match these patterns:
1. https://dynamic-media-cdn.tripadvisor.com/media/photo...
2. https://media.tacdn.com/media/photo...

Return ONLY a JSON array of valid HTTPS URLs, nothing else. Example:
["https://dynamic-media-cdn.tripadvisor.com/media/photo-s/...", "https://media.tacdn.com/media/photo-..."]

Exclude:
- Placeholder images
- Logo images
- Non-image URLs

HTML Content (first 50000 chars):
${htmlContent.substring(0, 50000)}

Return only the JSON array of photo URLs, no other text.`

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${X_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-2-latest',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 4096
      }),
      timeout: 30000
    })

    if (!response.ok) {
      const error = await response.text()
      console.log(`    Grok error: ${response.status} - ${error.substring(0, 100)}`)
      return []
    }

    const data = await response.json()
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.log('    Unexpected Grok response structure')
      return []
    }

    const content = data.choices[0].message.content.trim()
    
    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.log('    No JSON array found in Grok response')
      return []
    }

    try {
      const urls = JSON.parse(jsonMatch[0])
      if (Array.isArray(urls)) {
        return urls
          .filter(url => typeof url === 'string' && url.startsWith('https://'))
          .filter(url => !url.includes('placeholder') && !url.includes('logo'))
          .slice(0, MAX_PHOTOS)
      }
    } catch (parseErr) {
      console.log(`    JSON parse error: ${parseErr.message}`)
      return []
    }

    return []
  } catch (err) {
    console.log(`    Grok request error: ${err.message}`)
    return []
  }
}

// Process a single listing
async function processListing(listing) {
  if (!listing.web_url) {
    return { id: listing.id, status: 'no-url' }
  }

  // Skip if already has photos (unless --force flag)
  if (SKIP_EXISTING && listing.photo_urls && Array.isArray(listing.photo_urls) && listing.photo_urls.length > 0) {
    console.log(`  ✓ Already has ${listing.photo_urls.length} photos (use --force to override)`)
    return { id: listing.id, status: 'skip' }
  }

  console.log(`\n[ID: ${listing.id}] ${listing.name} (${listing.city})`)
  console.log(`  URL: ${listing.web_url.substring(0, 80)}...`)

  // Step 1: Fetch HTML from TripAdvisor
  console.log('  Fetching TripAdvisor page...')
  const html = await fetchTripAdvisorPage(listing.web_url)
  
  if (!html) {
    console.log('  ✗ Failed to fetch page')
    return { id: listing.id, status: 'fetch-error' }
  }

  console.log('  ✓ Page fetched, analyzing photos...')

  // Step 2: Try Grok first for analysis
  let photos = await grokAnalyzePhotos(listing.name, listing.web_url, html)
  
  console.log(`  Grok found: ${photos.length} photos`)

  // Step 3: Fallback to regex extraction if Grok didn't find enough
  if (photos.length === 0) {
    console.log('  Falling back to regex extraction...')
    photos = extractPhotoUrlsFromHTML(html)
    console.log(`  Regex found: ${photos.length} photos`)
  }

  if (photos.length === 0) {
    console.log('  ✗ No photos found')
    return { id: listing.id, status: 'no-photos' }
  }

  // Step 4: Update database
  try {
    const { error } = await supabase
      .from('nearby_listings')
      .update({
        photo_urls: photos,
        photo_count: photos.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', listing.id)

    if (error) throw error

    console.log(`  ✓ Updated with ${photos.length} photos`)
    console.log(`    First URL: ${photos[0].substring(0, 80)}...`)
    
    return { id: listing.id, status: 'updated', count: photos.length }
  } catch (err) {
    console.log(`  ✗ Database error: ${err.message}`)
    return { id: listing.id, status: 'db-error' }
  }
}

async function main() {
  console.log('=== TripAdvisor Photo URLs Extractor (Grok + ScrapingBee) ===\n')
  console.log(`Config:`)
  console.log(`  Batch size: ${BATCH}`)
  console.log(`  Start offset: ${START}`)
  console.log(`  Limit: ${LIMIT}`)
  console.log(`  Skip existing: ${SKIP_EXISTING}`)
  console.log(`  ScrapingBee keys available: ${SCRAPINGBEE_KEYS.length}`)
  console.log(`  Max photos per listing: ${MAX_PHOTOS}\n`)

  let offset = START
  let totalProcessed = 0
  let stats = { processed: 0, updated: 0, skipped: 0, failed: 0, fetchError: 0 }

  while (totalProcessed < LIMIT) {
    const batchEnd = offset + BATCH
    
    console.log(`\n--- Fetching batch: offset=${offset}, limit=${BATCH} ---`)
    
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('id, name, city, web_url, photo_urls, photo_count')
      .not('web_url', 'is', null)
      .order('id', { ascending: true })
      .range(offset, batchEnd - 1)

    if (error) {
      console.error('Database error:', error)
      break
    }

    if (!listings || listings.length === 0) {
      console.log('✓ No more listings to process')
      break
    }

    console.log(`Found ${listings.length} listings in batch`)

    for (const listing of listings) {
      if (totalProcessed >= LIMIT) break

      const result = await processListing(listing)
      stats.processed++
      totalProcessed++

      if (result.status === 'updated') {
        stats.updated++
      } else if (result.status === 'skip') {
        stats.skipped++
      } else if (result.status === 'fetch-error') {
        stats.fetchError++
      } else if (result.status === 'no-photos') {
        stats.failed++
      }

      // Rate limiting: 3 seconds between requests to be respectful
      await sleep(3000)
    }

    offset = batchEnd

    if (listings.length < BATCH) {
      console.log('\n✓ Reached end of listings')
      break
    }

    console.log(`\nWaiting before next batch...`)
    await sleep(5000)
  }

  console.log(`\n\n=== FINAL RESULTS ===`)
  console.log(`Total processed: ${stats.processed}`)
  console.log(`Updated with photos: ${stats.updated}`)
  console.log(`Already had photos: ${stats.skipped}`)
  console.log(`No photos found: ${stats.failed}`)
  console.log(`Fetch errors: ${stats.fetchError}`)
  console.log(`Success rate: ${stats.processed > 0 ? ((stats.updated / stats.processed) * 100).toFixed(1) : 0}%`)

  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
