#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import { exec } from 'child_process'
import { promisify } from 'util'
const execAsync = promisify(exec)

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const GOOGLE_API_KEYS = (process.env.GOOGLE_API_KEYS || process.env.GOOGLE_CUSTOM_SEARCH_API || process.env.GOOGLE_API_KEY || '').split(',').map(s=>s.trim()).filter(Boolean)
const CSE_CX = process.env.CSE_CX
const GROK_KEY = process.env.X_API_KEY || process.env.GROK_API_KEY || process.env.XAI_API_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) { console.error('Missing Supabase env'); process.exit(1) }
if (!CSE_CX) { console.error('Missing CSE_CX env'); /* continue, Grok may still work */ }

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
    if (!res.ok) { const txt = await res.text(); return { error: `HTTP ${res.status} ${txt.substring(0,200)}` } }
    const json = await res.json()
    return { items: json.items || [] }
  } catch (err) { return { error: err.message } }
}

async function fetchPageWithCurl(url){
  try{
    const safeUrl = url.replace(/"/g, '\\"')
    const cmd = `curl -s -L -A "Mozilla/5.0" --max-time 30 "${safeUrl}" | head -c 3000000`
    const { stdout } = await execAsync(cmd, { maxBuffer: 5 * 1024 * 1024 })
    return stdout
  } catch(err){ return null }
}

async function grokExtractFromPage(url){
  if (!GROK_KEY) return []
  try{
    const html = await fetchPageWithCurl(url)
    if (!html || html.length < 200) return []
    const prompt = `Extract ALL photo URLs from this TripAdvisor listing HTML.\n\nLook for URLs that contain:\n- dynamic-media-cdn.tripadvisor.com/media/photo\n- media.tacdn.com/media/photo\nReturn ONLY a JSON array of complete HTTPS URLs. Exclude placeholders and logo images. HTML:\n${html.substring(0,100000)}`
    const res = await fetch('https://api.x.ai/v1/chat/completions', { method: 'POST', headers: { 'Content-Type':'application/json','Authorization':`Bearer ${GROK_KEY}` }, body: JSON.stringify({ model:'grok-2-latest', messages:[{role:'user', content:prompt}], temperature:0.1, max_tokens:4096 }), timeout:30000 })
    if (!res.ok) return []
    const json = await res.json()
    const content = json.choices?.[0]?.message?.content || ''
    const match = content.match(/\[[\s\S]*\]/)
    if (!match) return []
    const urls = JSON.parse(match[0])
    if (!Array.isArray(urls)) return []
    const cleaned = urls.filter(u=>typeof u==='string' && u.startsWith('https://')).map(u=>u.split('?')[0].split('#')[0]).filter(u=>u.includes('tripadvisor')||u.includes('tacdn')).filter(u=>!u.includes('placeholder')&&!u.includes('logo'))
    return Array.from(new Set(cleaned)).slice(0,20)
  } catch(err){ return [] }
}

function cleanUrls(urls){ return Array.from(new Set(urls.map(u=>u.split('?')[0].split('#')[0]))).slice(0,20) }

async function processId(id){
  const { data: listing, error } = await supabase.from('nearby_listings').select('id,name,web_url,photo_urls,photo_count').eq('id', id).maybeSingle()
  if (error) { console.error('DB fetch error', id, error); return }
  if (!listing) { console.log('No listing id', id); return }
  if (Array.isArray(listing.photo_urls) && listing.photo_urls.length >=5) { console.log(`Skip ${id} already has ${listing.photo_urls.length}`); return }

  console.log(`\n[ID ${id}] ${listing.name}`)
  // build queries
  let queries
  if (listing.web_url && listing.web_url.startsWith('https://www.tripadvisor.com/')) {
    queries = [`${listing.name} site:tripadvisor.com.ph`, `${listing.name} site:tripadvisor.com`, listing.name]
  } else if (listing.web_url) {
    queries = [listing.web_url, `${listing.name} site:tripadvisor.com.ph`, `${listing.name} site:tripadvisor.com`, listing.name]
  } else {
    queries = [`${listing.name} site:tripadvisor.com.ph`, `${listing.name} site:tripadvisor.com`, listing.name]
  }

  let found = []
  for (const q of queries){
    const res = await googleImageSearch(q, 8)
    if (res.error){ console.log('  Google error:', res.error); continue }
    const urls = (res.items||[]).map(it=>it.link).filter(Boolean)
    if (urls.length===0) continue
    const preferred = urls.filter(u=>u.includes('tripadvisor')||u.includes('tacdn')||u.includes('dynamic-media-cdn'))
    found = preferred.length?preferred:urls
    break
  }

  if (found.length===0){
    console.log('  CSE failed, trying Grok...')
    const g = await grokExtractFromPage(listing.web_url || `https://www.google.com/search?q=${encodeURIComponent(listing.name)}`)
    if (g && g.length>0){ found = g }
  }

  if (found.length===0){ console.log('  No images found for', id); return }
  const cleaned = cleanUrls(found)
  try{
    const { error: upErr } = await supabase.from('nearby_listings').update({ photo_urls: cleaned, photo_count: cleaned.length, updated_at: new Date().toISOString() }).eq('id', id)
    if (upErr) { console.log('  DB update error', upErr); return }
    console.log('  Saved', cleaned.length, 'photos')
  } catch(err){ console.log('  Exception updating DB', err) }
}

async function main(){
  const start = 1
  const end = 2889
  for (let id=start; id<=end; id++){
    try{
      await processId(id)
      // short delay to be polite
      await new Promise(r=>setTimeout(r, 600))
    } catch(err){ console.error('Error processing id', id, err) }
  }
  console.log('All done')
}

main()
