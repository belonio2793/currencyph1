#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const TRIPADVISOR_KEY = process.env.VITE_TRIPADVISOR_API_KEY || process.env.TRIPADVISOR_API_KEY || process.env.VITE_TRIPADVISOR || process.env.TRIPADVISOR

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

const argv = require('minimist')(process.argv.slice(2))
const BATCH = Number(argv.batch || argv.b || 200)
const FETCH_FACTOR = 3 // fetch factor to oversample before filtering

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function searchTripAdvisor(name, city) {
  if (!TRIPADVISOR_KEY) return null
  try {
    const q = `${name} ${city || ''}`.trim()
    const url = `https://api.content.tripadvisor.com/v2/location/search?query=${encodeURIComponent(q)}&key=${TRIPADVISOR_KEY}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const json = await res.json()
    const items = json.data || json.results || []
    if (items && items.length > 0) {
      return String(items[0].location_id)
    }
    return null
  } catch (err) {
    return null
  }
}

async function extractFromRaw(raw) {
  if (!raw) return null
  if (raw.location_id) return String(raw.location_id)
  const web = raw.web_url || raw.url || raw.website || raw.webUrl || raw.website_url
  if (web) {
    // try to capture -d123456- or /location/12345
    const m = web.match(/-d(\d+)-/) || web.match(/locations\/(\d+)/) || web.match(/location\/(\d+)/)
    if (m) return String(m[1])
  }
  return null
}

async function processBatch(batchSize = BATCH) {
  console.log(`Fetching candidate listings (batch size: ${batchSize})...`)
  const fetchLimit = batchSize * FETCH_FACTOR
  const { data, error } = await supabase
    .from('nearby_listings')
    .select('id, tripadvisor_id, name, city, raw')
    .order('updated_at', { ascending: true })
    .limit(fetchLimit)

  if (error) {
    console.error('DB fetch error:', error)
    return 0
  }

  const candidates = (data || []).filter(l => {
    const id = l.tripadvisor_id
    if (!id) return true
    return !/^\d+$/.test(String(id))
  }).slice(0, batchSize)

  console.log(`Found ${candidates.length} candidates to process`)
  if (candidates.length === 0) return 0

  let processed = 0
  let updated = 0

  for (const c of candidates) {
    processed++
    const name = c.name || ''
    const city = c.city || ''

    let foundId = await extractFromRaw(c.raw)
    if (!foundId) {
      foundId = await searchTripAdvisor(name, city)
    }

    if (!foundId) {
      console.log(`✗ ${name} — not found`) 
      await sleep(300)
      continue
    }

    try {
      const { error: upErr } = await supabase
        .from('nearby_listings')
        .update({ tripadvisor_id: foundId, updated_at: new Date().toISOString() })
        .eq('id', c.id)

      if (upErr) {
        console.log(`✗ ${name} — DB update failed:`, upErr.message)
      } else {
        updated++
        console.log(`✓ ${name} → ${foundId}`)
      }
    } catch (err) {
      console.log(`✗ ${name} — error:`, err.message || err)
    }

    // friendly rate limit
    await sleep(350)
  }

  console.log(`Batch complete: processed=${processed}, updated=${updated}`)
  return processed
}

async function main() {
  try {
    const n = await processBatch()
    if (n === 0) {
      console.log('No candidates found — nothing to do')
    } else {
      console.log('Done')
    }
    process.exit(0)
  } catch (err) {
    console.error('Fatal error:', err)
    process.exit(1)
  }
}

main()
