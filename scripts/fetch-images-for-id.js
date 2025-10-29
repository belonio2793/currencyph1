#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const GOOGLE_API_KEYS = (process.env.GOOGLE_API_KEYS || process.env.GOOGLE_CUSTOM_SEARCH_API || process.env.GOOGLE_API_KEY || '').split(',').map(s=>s.trim()).filter(Boolean)
const CSE_CX = process.env.CSE_CX

if (!PROJECT_URL || !SERVICE_ROLE_KEY) { console.error('Missing Supabase env'); process.exit(1) }
if (!CSE_CX) { console.error('Missing CSE_CX env'); process.exit(1) }

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)
let keyIndex = 0
function getNextKey(){ if (!GOOGLE_API_KEYS.length) return null; const k = GOOGLE_API_KEYS[keyIndex % GOOGLE_API_KEYS.length]; keyIndex++; return k }

async function googleImageSearch(query, num=8){
  const key = getNextKey()
  if (!key) return { error: 'No Google API key configured' }
  const params = new URLSearchParams({ key, cx: CSE_CX, searchType: 'image', q: query, num: String(num) })
  const url = `https://www.googleapis.com/customsearch/v1?${params}`
  try {
    const res = await fetch(url, { timeout: 20000 })
    if (!res.ok) {
      const txt = await res.text()
      return { error: `HTTP ${res.status} ${txt.substring(0,200)}` }
    }
    const json = await res.json()
    return { items: json.items || [] }
  } catch (err) { return { error: err.message } }
}

function cleanUrls(urls){ return Array.from(new Set(urls.map(u=>u.split('?')[0].split('#')[0]))).slice(0,20) }

async function main(){
  const id = Number(process.argv[2])
  if (!id) { console.error('Usage: node scripts/fetch-images-for-id.js <id>'); process.exit(1) }

  const { data: listing, error } = await supabase.from('nearby_listings').select('id,name,web_url,photo_urls').eq('id', id).maybeSingle()
  if (error) { console.error('DB error', error); process.exit(1) }
  if (!listing) { console.error('No listing for id', id); process.exit(1) }

  console.log('Listing:', listing.name, listing.web_url)

  // Build queries: if web_url is placeholder, search by name preferred site:tripadvisor.com.ph
  const queries = []
  if (listing.web_url && !listing.web_url.startsWith('https://www.tripadvisor.com/')) queries.push(listing.web_url)
  queries.push(`${listing.name} site:tripadvisor.com.ph`)
  queries.push(`${listing.name} site:tripadvisor.com`)
  queries.push(listing.name)

  let found = []
  for (const q of queries) {
    console.log('Searching:', q)
    const res = await googleImageSearch(q, 8)
    if (res.error) { console.log('Google error:', res.error); continue }
    const urls = (res.items||[]).map(it=>it.link).filter(Boolean)
    if (urls.length === 0) { console.log('No images returned'); continue }
    // prefer tripadvisor domain hosts
    const preferred = urls.filter(u => u.includes('tripadvisor')||u.includes('tacdn')||u.includes('dynamic-media-cdn'))
    found = preferred.length?preferred:urls
    console.log('Found', found.length)
    break
  }

  if (found.length === 0) {
    console.log('No images found via CSE. Trying Grok fallback...')
    // Attempt Grok by searching web URL via curl + Grok - but if web_url placeholder, try search results page HTML? Skip for now.
    console.log('Grok fallback not implemented here.')
    process.exit(0)
  }

  const cleaned = cleanUrls(found)
  console.log('Cleaned:', cleaned.slice(0,5))

  // Update DB
  const { error: upErr } = await supabase.from('nearby_listings').update({ photo_urls: cleaned, photo_count: cleaned.length, updated_at: new Date().toISOString() }).eq('id', id)
  if (upErr) { console.error('DB update error', upErr); process.exit(1) }
  console.log('Saved to DB')

  const { data: after } = await supabase.from('nearby_listings').select('id,name,photo_count,photo_urls').eq('id', id).maybeSingle()
  console.log('After:', JSON.stringify(after, null, 2))
}

main()
