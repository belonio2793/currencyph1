#!/usr/bin/env node
/*
extract-and-save-photo-urls.js

Extract photo URLs from TripAdvisor listing pages and save directly to nearby_listings.photo_urls column.
Uses Grok AI to intelligently extract URLs from the page HTML.

Usage:
  node scripts/extract-and-save-photo-urls.js --batch=10 --limit=50

Environment variables:
  X_API_KEY (Grok API key)
  VITE_PROJECT_URL (Supabase URL)
  VITE_SUPABASE_SERVICE_ROLE_KEY (Supabase key)
*/

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const X_API_KEY = process.env.X_API_KEY || 'xai-qe0lzba8kfDmccd5EBClqO7ELZXxYG3hyyetV1b5D4dISqjStXLHcFElnYfmRD3ddy0gV4sHxnR3XZT3'

const MAX_PHOTOS = 20

// Parse arguments
const argv = process.argv.slice(2)
let BATCH = 10
let LIMIT = 999999
let START = 0

for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--batch' && argv[i+1]) { BATCH = Number(argv[i+1]); i++ }
  if (argv[i] === '--limit' && argv[i+1]) { LIMIT = Number(argv[i+1]); i++ }
  if (argv[i] === '--start' && argv[i+1]) { START = Number(argv[i+1]); i++ }
}

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function fetchTripAdvisorPage(url) {
  try {
    console.log('    Fetching page...')
    
    const { stdout } = await execAsync(
      `curl -s -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" --max-time 30 "${url}" | head -c 3000000`,
      { maxBuffer: 5 * 1024 * 1024 }
    )

    if (!stdout || stdout.length < 200) {
      console.log('    Page too small or empty')
      return null
    }

    return stdout
  } catch (err) {
    console.log(`    Error fetching: ${err.message}`)
    return null
  }
}

async function grokExtractPhotoUrls(html, listingName) {
  try {
    console.log('    Extracting URLs with Grok...')

    const prompt = `Extract ALL photo URLs from this TripAdvisor listing HTML.

Look for URLs that contain:
- dynamic-media-cdn.tripadvisor.com/media/photo
- media.tacdn.com/media/photo

Extract the FULL URL including the file extension.

Return ONLY a JSON array of complete URLs. Do not include any text before or after the array.

Examples of valid URLs:
- https://dynamic-media-cdn.tripadvisor.com/media/photo-s/1a/2b/3c/d/photo.jpg
- https://dynamic-media-cdn.tripadvisor.com/media/photo-o/1a/2b/3c/d/photo.jpg
- https://media.tacdn.com/media/photo-s/1a/2b/3c/d/photo.jpg

HTML content to analyze:
${html.substring(0, 100000)}`

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${X_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-2-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 4096
      }),
      timeout: 30000
    })

    if (!response.ok) {
      console.log(`    Grok error: ${response.status}`)
      return []
    }

    const data = await response.json()
    
    if (!data.choices?.[0]?.message?.content) {
      console.log('    Invalid Grok response')
      return []
    }

    const content = data.choices[0].message.content.trim()
    
    // Extract JSON array
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.log('    No JSON array in response')
      return []
    }

    const urls = JSON.parse(jsonMatch[0])
    
    if (Array.isArray(urls)) {
      const filtered = urls
        .filter(url => typeof url === 'string' && url.startsWith('https://'))
        .filter(url => url.includes('tripadvisor.com') && url.includes('media/photo'))
        .filter(url => !url.includes('placeholder') && !url.includes('logo'))
        .slice(0, MAX_PHOTOS)
      
      console.log(`    Found ${filtered.length} valid photo URLs`)
      return filtered
    }

    return []
  } catch (err) {
    console.log(`    Grok error: ${err.message}`)
    return []
  }
}

async function processListing(listing) {
  if (!listing.web_url) {
    return { id: listing.id, status: 'no-url' }
  }

  console.log(`\n[ID: ${listing.id}] ${listing.name} (${listing.city})`)

  // Fetch page
  const html = await fetchTripAdvisorPage(listing.web_url)
  if (!html) {
    console.log('  ✗ Failed to fetch page')
    return { id: listing.id, status: 'fetch-error' }
  }

  // Extract URLs
  const photoUrls = await grokExtractPhotoUrls(html, listing.name)
  
  if (photoUrls.length === 0) {
    console.log('  ✗ No photo URLs found')
    return { id: listing.id, status: 'no-photos' }
  }

  console.log(`  ✓ Extracted ${photoUrls.length} photo URLs`)

  // Save to database
  try {
    const { error } = await supabase
      .from('nearby_listings')
      .update({
        photo_urls: photoUrls,
        photo_count: photoUrls.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', listing.id)

    if (error) throw error

    console.log(`  ✅ Saved to database`)
    return { id: listing.id, status: 'success', count: photoUrls.length }
  } catch (err) {
    console.log(`  ✗ Database error: ${err.message}`)
    return { id: listing.id, status: 'db-error' }
  }
}

async function main() {
  console.log('\n╔═══════════════��════════════════════════════════════════╗')
  console.log('║   Extract TripAdvisor Photo URLs (Direct to Database)  ║')
  console.log('╚════════════════════════════════════════════════════════╝\n')
  console.log(`Config: batch=${BATCH}, limit=${LIMIT}, start=${START}\n`)

  let offset = START
  let totalProcessed = 0
  let stats = { processed: 0, success: 0, failed: 0 }

  while (totalProcessed < LIMIT) {
    console.log(`\n--- Batch: offset=${offset} ---`)

    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('id, name, city, web_url')
      .not('web_url', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + BATCH - 1)

    if (error) {
      console.error('Database error:', error)
      break
    }

    if (!listings || listings.length === 0) {
      console.log('✓ No more listings')
      break
    }

    console.log(`Found ${listings.length} listings\n`)

    for (const listing of listings) {
      if (totalProcessed >= LIMIT) break

      const result = await processListing(listing)
      stats.processed++
      totalProcessed++

      if (result.status === 'success') {
        stats.success++
      } else {
        stats.failed++
      }

      await sleep(2000)
    }

    offset += BATCH

    if (listings.length < BATCH) break

    console.log('\nWaiting before next batch...')
    await sleep(3000)
  }

  console.log(`\n\n╔════════════════════════════════════════════════════════╗`)
  console.log(`║                    RESULTS                             ║`)
  console.log(`╚════════════════════════════════════════════════════════╝\n`)
  console.log(`  📊 Processed: ${stats.processed}`)
  console.log(`  ✅ Success: ${stats.success}`)
  console.log(`  ❌ Failed: ${stats.failed}`)
  console.log(`  📈 Rate: ${stats.processed > 0 ? ((stats.success / stats.processed) * 100).toFixed(1) : 0}%\n`)

  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
