#!/usr/bin/env node
/*
grok-avg-costs.js

Uses Grok/X to estimate average cost per person in PHP for listings and updates nearby_listings.avg_cost

Env vars required:
  VITE_PROJECT_URL or PROJECT_URL
  VITE_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY
  X_API_KEY (Grok/X) - required
  GROK_API_URL - optional (default: https://api.grok.ai/v1/search)

Usage:
  X_API_KEY=... node scripts/grok-avg-costs.js --batch=100 --start=0
*/

import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const X_API_KEY = process.env.X_API_KEY || process.env.XAI_API_KEY || process.env.GROK_API_KEY
const GROK_API_URL = process.env.GROK_API_URL || 'https://api.x.ai/v1/chat/completions'

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase PROJECT_URL or SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!X_API_KEY) {
  console.error('Missing X_API_KEY (Grok)')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

// args
const argv = process.argv.slice(2)
let BATCH = 100
let START = 0
for (let i=0;i<argv.length;i++){
  if (argv[i] === '--batch' && argv[i+1]) { BATCH = Number(argv[i+1]); i++ }
  if (argv[i] === '--start' && argv[i+1]) { START = Number(argv[i+1]); i++ }
}

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)) }

async function askGrok(prompt){
  try{
    const res = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${X_API_KEY}`
      },
      body: JSON.stringify({ query: prompt }),
      // no timeout control here; caller can handle
    })
    if (!res.ok) {
      const txt = await res.text().catch(()=>'')
      console.warn('Grok API returned', res.status, txt.slice(0,200))
      return null
    }
    const data = await res.json()
    // Try to extract a number in PHP
    const jsonStr = JSON.stringify(data)
    const m = jsonStr.match(/([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(?:\.?[0-9]*)/) // basic number match
    if (!m) return null
    // parse removing commas
    const num = Number(m[1].replace(/,/g,''))
    if (!Number.isFinite(num)) return null
    return Math.round(num)
  }catch(err){
    console.warn('Grok request error', err.message)
    return null
  }
}

async function processBatch(batchSize=BATCH, start=START){
  console.log('Fetching listings from', start, 'batch', batchSize)
  const { data, error } = await supabase.from('nearby_listings').select('id,tripadvisor_id,name,city,avg_cost').range(start, start+batchSize-1)
  if (error) { console.error('DB fetch error', error); return }
  const listings = data || []
  console.log('Got', listings.length, 'listings')

  let processed = 0
  let updated = 0

  for (const l of listings){
    processed++
    if (l.avg_cost) {
      console.log(`[${processed}] ${l.id} ${l.name} — already has avg_cost ${l.avg_cost}, skipping`)
      continue
    }
    const q = `${l.name} ${l.city || ''}`.trim()
    const prompt = `Estimate the average cost in Philippine pesos (PHP) per person to go to "${q}". Consider a typical visit: admission or cover, one average meal, and local transport if applicable. Provide a single numeric value only (no currency symbol), rounded to the nearest peso.`
    console.log(`[${processed}] Asking Grok for: ${q}`)
    const val = await askGrok(prompt)
    if (val === null) {
      console.log('  Grok returned no value for', q)
      // backoff small
      await sleep(400)
      continue
    }
    // update DB
    const { error: up } = await supabase.from('nearby_listings').update({ avg_cost: val, updated_at: new Date().toISOString() }).eq('id', l.id)
    if (up) {
      console.error('  DB update error', up)
    } else {
      console.log(`  Updated ${l.id} avg_cost=${val}`)
      updated++
    }
    await sleep(600)
  }
  console.log('Batch processed', processed, 'updated', updated)
}

async function main(){
  let offset = START
  // determine total count
  const { count } = await supabase.from('nearby_listings').select('id', { count: 'exact', head: false })
  const total = count || 0
  console.log('Total listings:', total)
  while (offset < total) {
    await processBatch(BATCH, offset)
    offset += BATCH
  }
  console.log('Done')
}

main().catch(e=>{ console.error('Fatal', e); process.exit(1) })
