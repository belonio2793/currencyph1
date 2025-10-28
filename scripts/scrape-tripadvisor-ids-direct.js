import fetch from 'node-fetch'
import cheerio from 'cheerio'
import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase PROJECT_URL or SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

const argv = process.argv.slice(2)
let BATCH = 200
let START = 0
for (let i=0;i<argv.length;i++){
  if ((argv[i]==='--batch' || argv[i]==='-b') && argv[i+1]) { BATCH = Number(argv[i+1]); i++ }
  if ((argv[i]==='--start' || argv[i]==='-s') && argv[i+1]) { START = Number(argv[i+1]); i++ }
}

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)) }

function absoluteUrl(href){
  if (!href) return null
  if (href.startsWith('http')) return href.split('?')[0]
  return 'https://www.tripadvisor.com' + href.split('?')[0]
}

function extractIdFromUrl(url){
  if (!url) return null
  const m1 = url.match(/-d(\d+)-/)
  if (m1) return m1[1]
  const m2 = url.match(/location\/(\d+)/i)
  if (m2) return m2[1]
  const m3 = url.match(/-g\d+-d(\d+)/)
  if (m3) return m3[1]
  return null
}

async function fetchSearchPage(query){
  const searchUrl = `https://www.tripadvisor.com/Search?q=${encodeURIComponent(query)}`
  try {
    const res = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, redirect: 'follow' })
    if (!res.ok) return null
    const html = await res.text()
    return html
  } catch (err){
    return null
  }
}

async function findDetailUrlFromSearchHtml(html){
  if (!html) return null
  const $ = cheerio.load(html)
  // Try links containing -d<id>-
  const anchors = $('a[href*="-d"]').toArray()
  for (const a of anchors){
    const href = $(a).attr('href')
    if (href && /-d\d+-/.test(href)){
      return absoluteUrl(href)
    }
  }
  // fallback: look for links with /Attraction_Review- or /Hotel_Review-
  const alt = $('a[href*="Attraction_Review"], a[href*="Hotel_Review"], a[href*="Restaurant_Review"], a[href*="ShowUserReviews"]').first().attr('href')
  if (alt) return absoluteUrl(alt)
  return null
}

async function fetchBatch(start, size){
  const { data, error } = await supabase
    .from('nearby_listings')
    .select('id,name,city,web_url,raw')
    .is('tripadvisor_id', null)
    .order('id', { ascending: true })
    .range(start, start + size - 1)
  if (error) throw error
  return data || []
}

async function updateId(id, tripId){
  const { error } = await supabase.from('nearby_listings').update({ tripadvisor_id: String(tripId), updated_at: new Date().toISOString() }).eq('id', id)
  if (error) {
    console.warn('DB update error', error.message)
    return false
  }
  return true
}

async function processListing(row){
  // try web_url first
  if (row.web_url){
    const candidate = extractIdFromUrl(row.web_url)
    if (candidate) return await updateId(row.id, candidate) && `web_url:${candidate}`
  }
  // try raw json
  if (row.raw){
    try{
      const rawObj = typeof row.raw === 'string' ? JSON.parse(row.raw) : row.raw
      const s = JSON.stringify(rawObj)
      const m = s.match(/\b(\d{5,12})\b/g)
      if (m && m.length>0){
        // pick first that looks like trip id and test
        for (const cand of m){
          // quick heuristic: skip years and small numbers
          if (cand.length>=6){
            const ok = await updateId(row.id, cand)
            if (ok) return `raw:${cand}`
          }
        }
      }
    }catch(e){}
  }

  // fallback: search TripAdvisor site directly
  const q = `${row.name} ${row.city || ''}`.trim()
  const html = await fetchSearchPage(q)
  if (!html) return null
  const detail = await findDetailUrlFromSearchHtml(html)
  if (!detail) return null
  const tid = extractIdFromUrl(detail)
  if (!tid) return null
  const ok = await updateId(row.id, tid)
  if (ok) return `search:${tid}`
  return null
}

async function main(){
  console.log('Starting direct TripAdvisor scraping for IDs')
  let start = START
  let total=0
  let success=0
  while(true){
    const batch = await fetchBatch(start,BATCH)
    if (!batch || batch.length===0) break
    console.log(`Fetched batch start=${start} len=${batch.length}`)
    for (const r of batch){
      total++
      try{
        const res = await processListing(r)
        if (res){
          success++
          console.log(`#${total} id=${r.id} -> ${res}`)
        } else {
          console.log(`#${total} id=${r.id} -> no-id`)
        }
      }catch(e){
        console.warn('error', e && e.message? e.message : e)
      }
      await sleep(800)
    }
    start += BATCH
    await sleep(2000)
  }
  console.log('done total', total, 'success', success)
  process.exit(0)
}

main().catch(err=>{console.error('Fatal',err);process.exit(1)})
