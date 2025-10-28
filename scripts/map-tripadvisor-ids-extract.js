import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase PROJECT_URL or SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)
const BATCH = Number(process.env.BATCH_SIZE || 200)
const START = Number(process.env.START_INDEX || 0)

function extractIdFromUrl(url) {
  if (!url) return null
  try {
    const u = String(url)
    // common TripAdvisor patterns
    // -d123456- pattern
    const m1 = u.match(/-d(\d+)-/)
    if (m1) return m1[1]
    // /location/123456/
    const m2 = u.match(/location\/(\d+)/i)
    if (m2) return m2[1]
    // photo url may include id as /photo-o/xx/... no
    // sometimes long numeric ids present elsewhere: match 6-12 digit numbers
    const m3 = u.match(/\b(\d{5,12})\b/)
    if (m3) return m3[1]
  } catch (e) {}
  return null
}

function findNumericIdInObject(obj) {
  if (!obj) return null
  if (typeof obj === 'string') {
    const m = obj.match(/\b(\d{5,12})\b/)
    if (m) return m[1]
    const urlMatch = obj.match(/https?:\/\/[^\s"']*tripadvisor\.[^\s"']*/i)
    if (urlMatch) {
      const idFromUrl = extractIdFromUrl(urlMatch[0])
      if (idFromUrl) return idFromUrl
    }
    return null
  }
  if (typeof obj === 'number') {
    if (obj >= 10000) return String(obj)
    return null
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findNumericIdInObject(item)
      if (found) return found
    }
    return null
  }
  if (typeof obj === 'object') {
    // check common keys
    const keysToCheck = ['tripadvisor_id','tripadvisorId','location_id','place_id','id','ta_id']
    for (const k of keysToCheck) {
      if (obj[k]) {
        const f = findNumericIdInObject(obj[k])
        if (f) return f
      }
    }
    for (const k of Object.keys(obj)) {
      try {
        const found = findNumericIdInObject(obj[k])
        if (found) return found
      } catch (e) {}
    }
  }
  return null
}

async function fetchBatch(start, batchSize) {
  const { data, error } = await supabase
    .from('nearby_listings')
    .select('id,tripadvisor_id,name,city,web_url,raw,image_url')
    .is('tripadvisor_id', null)
    .order('id', { ascending: true })
    .range(start, start + batchSize - 1)

  if (error) throw error
  return data || []
}

async function updateTripadvisorId(listingId, tripId) {
  const { error } = await supabase.from('nearby_listings').update({ tripadvisor_id: String(tripId), updated_at: new Date().toISOString() }).eq('id', listingId)
  if (error) throw error
  return true
}

function tryExtractFromRow(row) {
  // 1. web_url
  if (row.web_url) {
    const id = extractIdFromUrl(row.web_url)
    if (id) return { source: 'web_url', id }
  }
  // 2. image_url (tripadvisor photo links sometimes include -d<id>- but usually not)
  if (row.image_url) {
    const id = extractIdFromUrl(row.image_url)
    if (id) return { source: 'image_url', id }
  }
  // 3. raw field
  if (row.raw) {
    try {
      const parsed = typeof row.raw === 'string' ? JSON.parse(row.raw) : row.raw
      const id = findNumericIdInObject(parsed)
      if (id) return { source: 'raw', id }
    } catch (e) {
      // if raw is not JSON, still try regex
      const id = findNumericIdInObject(row.raw)
      if (id) return { source: 'raw_text', id }
    }
  }
  // 4. name + city heuristics not used here
  return null
}

async function main() {
  console.log('Starting extraction of TripAdvisor IDs from existing fields')
  let start = START
  let total = 0
  let updated = 0
  while (true) {
    const batch = await fetchBatch(start, BATCH)
    if (!batch || batch.length === 0) break
    console.log(`Fetched batch start=${start} len=${batch.length}`)
    for (const row of batch) {
      total++
      try {
        const res = tryExtractFromRow(row)
        if (res && res.id) {
          await updateTripadvisorId(row.id, res.id)
          console.log(`#${total} id=${row.id} name="${row.name}" -> ${res.id} (from ${res.source})`)
          updated++
        } else {
          console.log(`#${total} id=${row.id} name="${row.name}" -> no-id`)
        }
      } catch (err) {
        console.warn('Error processing row', row.id, err && err.message ? err.message : err)
      }
    }
    start += BATCH
  }
  console.log('Done. Processed', total, 'updated', updated)
  process.exit(0)
}

main().catch(err => { console.error('Fatal error', err); process.exit(1) })
