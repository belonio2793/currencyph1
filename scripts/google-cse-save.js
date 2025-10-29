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
let LIMIT = 10
let BATCH = 10
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--limit' && argv[i+1]) { LIMIT = Number(argv[i+1]); i++ }
  if (argv[i] === '--batch' && argv[i+1]) { BATCH = Number(argv[i+1]); i++ }
}

async function googleImageSearch(query, num=8) {
  const params = new URLSearchParams({
    key: GOOGLE_API_KEY,
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
      return { error: `HTTP ${res.status} ${txt.substring(0,200)}` }
    }
    const json = await res.json()
    const items = json.items || []
    return { items }
  } catch (err) {
    return { error: err.message }
  }
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
    .select('id, name, city, web_url, photo_urls')
    .not('web_url', 'is', null)
    .neq('web_url', 'https://www.tripadvisor.com/')
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) throw error
  if (!listings || listings.length === 0) return []

  const results = []
  for (const listing of listings) {
    console.log(`\n[ID ${listing.id}] ${listing.name}`)

    // perform same query order
    const queries = [listing.web_url, `${listing.name} site:tripadvisor.com`, listing.name]
    let found = []
    for (const q of queries) {
      const res = await googleImageSearch(q, 8)
      if (res.error) {
        console.log(`  Google error: ${res.error}`)
        continue
      }
      const urls = (res.items || []).map(it => it.link).filter(Boolean)
      if (urls.length === 0) continue
      const preferred = preferTripadvisorUrls(urls)
      found = preferred
      break
    }

    if (found.length === 0) {
      console.log('  ✗ No images found')
      results.push({ id: listing.id, status: 'no-images' })
      continue
    }

    const cleaned = cleanUrls(found)
    console.log(`  ✓ Found ${cleaned.length} images. Saving...`)

    // update DB
    try {
      const { error: upErr } = await supabase
        .from('nearby_listings')
        .update({ photo_urls: cleaned, photo_count: cleaned.length, updated_at: new Date().toISOString() })
        .eq('id', listing.id)

      if (upErr) {
        console.log(`  ✗ DB error: ${upErr.message}`)
        results.push({ id: listing.id, status: 'db-error', error: upErr.message })
      } else {
        console.log('  ✓ Saved')
        results.push({ id: listing.id, status: 'saved', count: cleaned.length })
      }
    } catch (err) {
      console.log(`  ✗ Exception: ${err.message}`)
      results.push({ id: listing.id, status: 'error', error: String(err) })
    }

    await new Promise(r => setTimeout(r, 500))
  }

  return results
}

async function main() {
  console.log('\n=== Google CSE Save: updating photo_urls ===\n')
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
  console.log('\n=== Done ===\n')
  process.exit(0)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
