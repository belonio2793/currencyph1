#!/usr/bin/env node
/*
google-cse-dryrun.js

Dry-run: use Google Custom Search Image API to find image URLs for listings.
Does NOT write to DB. Prints top image URLs per listing.

Usage:
  GOOGLE_API_KEY=... CSE_CX=... node scripts/google-cse-dryrun.js --limit=10

Requires environment:
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
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--limit' && argv[i+1]) { LIMIT = Number(argv[i+1]); i++ }
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

async function main() {
  console.log('\n=== Google CSE Dry-run: Fetch image URLs for listings ===\n')
  // Fetch listings with web_url
  const { data: listings, error } = await supabase
    .from('nearby_listings')
    .select('id, name, city, web_url')
    .not('web_url', 'is', null)
    .neq('web_url', 'https://www.tripadvisor.com/')
    .order('id', { ascending: true })
    .limit(LIMIT)

  if (error) {
    console.error('Supabase error:', error.message)
    process.exit(1)
  }
  if (!listings || listings.length === 0) {
    console.log('No listings found')
    process.exit(0)
  }

  for (const listing of listings) {
    console.log(`\n[ID ${listing.id}] ${listing.name} -- ${listing.web_url}`)

    // Prefer searching by exact web_url first, then fallback to name + site:tripadvisor.com
    let queries = [listing.web_url, `${listing.name} site:tripadvisor.com`, listing.name]
    let found = []
    for (const q of queries) {
      console.log(`  Searching Google Images for: ${q.substring(0,120)}`)
      const res = await googleImageSearch(q, 8)
      if (res.error) {
        console.log(`    Error: ${res.error}`)
        continue
      }
      const urls = (res.items || []).map(it => it.link).filter(Boolean)
      if (urls.length === 0) {
        console.log('    No images returned')
      } else {
        const preferred = preferTripadvisorUrls(urls)
        found = preferred
        console.log(`    Found ${urls.length} images, using ${preferred.length}`)
        break
      }
      // small pause to avoid quota spikes
      await new Promise(r => setTimeout(r, 300))
    }

    if (found.length === 0) {
      console.log('  ✗ No images found for listing')
    } else {
      found.forEach((u,i) => console.log(`    ${i+1}. ${u}`))
    }

    // short delay
    await new Promise(r => setTimeout(r, 500))
  }

  console.log('\n=== Done ===\n')
  process.exit(0)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
