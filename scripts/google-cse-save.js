#!/usr/bin/env node
/*
google-cse-save.js

Use Google Custom Search Image API to find image URLs for listings and save to nearby_listings.photo_urls.

Usage:
  node scripts/google-cse-save.js --limit=10 --batch=10

Environment:
  VITE_PROJECT_URL or PROJECT_URL
  VITE_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY
  GOOGLE_API_KEY
  CSE_CX
*/

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
const execAsync = promisify(exec)
const LOG_PATH = 'scripts/logs/google-cse-save.log'

function log(msg) {
  const line = `[${(new Date()).toISOString()}] ${msg}\n`
  try { fs.appendFileSync(LOG_PATH, line) } catch(e) { /* ignore */ }
  console.log(msg)
}

const GROK_KEY = process.env.X_API_KEY || process.env.GROK_API_KEY || process.env.XAI_API_KEY
if (!GROK_KEY) {
  console.warn('Warning: GROK API key not set (X_API_KEY) — Grok fallback will fail')
}

async function fetchPageWithCurl(url) {
  try {
    const safeUrl = url.replace(/"/g, '\\"')
    const cmd = `curl -s -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" --max-time 30 "${safeUrl}" | head -c 3000000`
    const { stdout } = await execAsync(cmd, { maxBuffer: 5 * 1024 * 1024 })
    return stdout
  } catch (err) {
    return null
  }
}

async function grokExtractFromPage(url, listingName) {
  try {
    const html = await fetchPageWithCurl(url)
    if (!html || html.length < 200) return []

    const prompt = `Extract ALL photo URLs from this TripAdvisor listing HTML.\n\nLook for URLs that contain:\n- dynamic-media-cdn.tripadvisor.com/media/photo\n- media.tacdn.com/media/photo\n\nReturn ONLY a JSON array of complete HTTPS URLs. Exclude placeholders and logo images. HTML:\n${html.substring(0,100000)}`

    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROK_KEY}` },
      body: JSON.stringify({ model: 'grok-2-latest', messages: [{ role: 'user', content: prompt }], temperature: 0.1, max_tokens: 4096 }),
      timeout: 30000
    })

    if (!res.ok) return []
    const json = await res.json()
    const content = json.choices?.[0]?.message?.content || ''
    const match = content.match(/\[[\s\S]*\]/)
    if (!match) return []
    const urls = JSON.parse(match[0])
    if (!Array.isArray(urls)) return []
    // filter/clean
    const cleaned = urls
      .filter(u => typeof u === 'string' && u.startsWith('https://'))
      .map(u => u.split('?')[0].split('#')[0])
      .filter(u => u.includes('dynamic-media-cdn.tripadvisor.com') || u.includes('media.tacdn.com'))
      .filter(u => !u.includes('placeholder') && !u.includes('logo'))
    return Array.from(new Set(cleaned)).slice(0,20)
  } catch (err) {
    return []
  }
}



const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY
const CSE_CX = process.env.CSE_CX

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase PROJECT_URL or SERVICE_ROLE_KEY env vars')
  process.exit(1)
}
if (!GOOGLE_API_KEY || !CSE_CX) {
  console.error('Missing GOOGLE_API_KEY or CSE_CX env vars')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

// Parse args
const argv = process.argv.slice(2)
let LIMIT = Number.MAX_SAFE_INTEGER
let BATCH = 50
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--limit' && argv[i+1]) { LIMIT = Number(argv[i+1]); i++ }
  if (argv[i] === '--batch' && argv[i+1]) { BATCH = Number(argv[i+1]); i++ }
}

// Support rotating API keys provided as a comma-separated env var GOOGLE_API_KEYS
const KEY_LIST = (process.env.GOOGLE_API_KEYS || process.env.GOOGLE_CUSTOM_SEARCH_API || process.env.GOOGLE_API_KEY || '').split(',').map(s => s.trim()).filter(Boolean)
let keyIndex = 0
function getNextKey() {
  if (!KEY_LIST || KEY_LIST.length === 0) return GOOGLE_API_KEY
  const key = KEY_LIST[keyIndex % KEY_LIST.length]
  keyIndex += 1
  return key
}

async function googleImageSearch(query, num=8, maxRetries=3) {
  let attempt = 0
  let lastErr = null
  while (attempt < maxRetries) {
    const keyToUse = getNextKey()
    const params = new URLSearchParams({
      key: keyToUse,
      cx: CSE_CX,
      searchType: 'image',
      q: query,
      num: String(num)
    })
    const url = `https://www.googleapis.com/customsearch/v1?${params}`
    try {
      const res = await fetch(url, { timeout: 20000 })
      if (!res.ok) {
        const txt = await res.text()
        // If quota exceeded or rate limited, try next key after delay
        if (res.status === 429) {
          lastErr = `HTTP 429 ${txt.substring(0,200)}`
          // small backoff
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
          attempt++
          continue
        }
        return { error: `HTTP ${res.status} ${txt.substring(0,200)}` }
      }
      const json = await res.json()
      const items = json.items || []
      return { items }
    } catch (err) {
      lastErr = err.message
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
      attempt++
      continue
    }
  }
  return { error: lastErr || 'Unknown error' }
}

function preferTripadvisorUrls(urls) {
  const trip = urls.filter(u => u.includes('tripadvisor') || u.includes('tacdn') || u.includes('dynamic-media-cdn'))
  if (trip.length) return trip
  return urls
}

function cleanUrls(urls) {
  return Array.from(new Set(urls.map(u => u.split('?')[0].split('#')[0]))).slice(0, 20)
}

async function processBatch(offset, limit) {
  const { data: listings, error } = await supabase
    .from('nearby_listings')
    .select('id, name, city, web_url, photo_urls, photo_count')
    .not('web_url', 'is', null)
    .or('photo_count.is.null,photo_count.lt.5')
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) throw error
  if (!listings || listings.length === 0) return []

  const results = []
  for (const listing of listings) {
    log(`\n[ID ${listing.id}] ${listing.name}`)

    // If web_url is a placeholder, search by name only (prefer tripadvisor.com.ph)
    let queries
    if (listing.web_url && listing.web_url.startsWith('https://www.tripadvisor.com/')) {
      queries = [`${listing.name} site:tripadvisor.com.ph`, `${listing.name} site:tripadvisor.com`, listing.name]
    } else {
      queries = [listing.web_url, `${listing.name} site:tripadvisor.com.ph`, `${listing.name} site:tripadvisor.com`, listing.name]
    }
    let found = []
    for (const q of queries) {
      const res = await googleImageSearch(q, 8)
      if (res.error) {
        log(`  Google error: ${res.error}`)
        continue
      }
      const urls = (res.items || []).map(it => it.link).filter(Boolean)
      if (urls.length === 0) continue
      const preferred = preferTripadvisorUrls(urls)
      found = preferred
      break
    }

    if (found.length === 0) {
      log('  ✗ No images from CSE — trying Grok fallback')
      // Grok fallback: fetch page HTML via curl and ask Grok to extract tripadvisor CDN URLs
      try {
        const grokUrls = await grokExtractFromPage(listing.web_url, listing.name)
        if (grokUrls && grokUrls.length > 0) {
          found = grokUrls
          log(`  ✓ Grok found ${found.length} images`)
        } else {
          log('  ✗ Grok found no images')
        }
      } catch (err) {
        log('  ✗ Grok error: ' + String(err).substring(0,200))
      }
    }

    if (found.length === 0) {
      log('  ✗ No images found')
      results.push({ id: listing.id, status: 'no-images' })
      continue
    }

    const cleaned = cleanUrls(found)
    log(`  ✓ Found ${cleaned.length} images. Saving...`)

    // update DB
    try {
      const { error: upErr } = await supabase
        .from('nearby_listings')
        .update({ photo_urls: cleaned, photo_count: cleaned.length, updated_at: new Date().toISOString() })
        .eq('id', listing.id)

      if (upErr) {
        log(`  ✗ DB error: ${upErr.message}`)
        results.push({ id: listing.id, status: 'db-error', error: upErr.message })
      } else {
        log('  ✓ Saved')
        results.push({ id: listing.id, status: 'saved', count: cleaned.length })
      }
    } catch (err) {
      log(`  ✗ Exception: ${err.message}`)
      results.push({ id: listing.id, status: 'error', error: String(err) })
    }

    await new Promise(r => setTimeout(r, 500))
  }

  return results
}

async function main() {
  log('\n=== Google CSE Save: updating photo_urls ===\n')
  let offset = 0
  let total = 0
  while (total < LIMIT) {
    const toProcess = Math.min(BATCH, LIMIT - total)
    const res = await processBatch(offset, toProcess)
    if (!res || res.length === 0) break
    total += res.length
    offset += res.length
    // small pause between batches
    await new Promise(r => setTimeout(r, 1000))
  }
  log('\n=== Done ===\n')
  process.exit(0)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
