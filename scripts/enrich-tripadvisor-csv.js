import fs from 'fs'
import cheerio from 'cheerio'

const X_API_KEY = process.env.X_API_KEY || process.env.XAI_API_KEY || process.env.GROK_API_KEY || process.env.XAI
const GROK_API_URL = process.env.GROK_API_URL || process.env.GROK_API_URL || 'https://api.grok.ai/v1/search'

if (!X_API_KEY) { console.error('Missing Grok/X API key in env (X_API_KEY or XAI_API_KEY or GROK_API_KEY)'); process.exit(1) }

function sleep(ms){return new Promise(r=>setTimeout(r,ms))}

async function grokFindListing(query){
  const prompt = `Find the TripAdvisor listing page for the query: "${query}". Respond with valid JSON only, in the exact format:\n{\n  "page_url":"<tripadvisor listing url>",\n  "tripadvisor_id":"<numeric id>",\n  "image_urls":["<url1>","<url2>"],\n  "primary_image_url":"<url>",\n  "rating":"<rating numeric or string>",\n  "review_count":"<number or string>"\n}\nReturn only one JSON object. If you cannot find a TripAdvisor listing, return {}.`

  try{
    const res = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${X_API_KEY}`
      },
      body: JSON.stringify({ query: prompt }),
      timeout: 20000
    })

    if (!res.ok){
      const txt = await res.text()
      console.warn('Grok API responded with', res.status, txt.slice(0,200))
      return null
    }

    // Try JSON response first
    let data = null
    try { data = await res.json() } catch(e){
      const txt = await res.text()
      // try to extract JSON blob from text
      const m = txt.match(/\{[\s\S]*\}/)
      if (m) {
        try{ data = JSON.parse(m[0]) }catch(err){ data = null }
      }
    }

    if (!data) return null

    // Data might be wrapped; try common shapes
    if (data && data.choices && Array.isArray(data.choices) && data.choices.length){
      // openai-like
      const text = data.choices.map(c=>c.text || c.message?.content || '').join('\n')
      const m = text.match(/\{[\s\S]*\}/)
      if (m){ try{ return JSON.parse(m[0]) }catch(e){} }
    }

    // If data already an object with keys we want, return it
    const keys = ['page_url','tripadvisor_id','image_urls','primary_image_url','rating','review_count']
    const hasKey = keys.some(k=>Object.prototype.hasOwnProperty.call(data,k))
    if (hasKey) return data

    // Otherwise search inside for first JSON-looking object
    const maybe = JSON.stringify(data)
    const m = maybe.match(/\{[\s\S]*\}/)
    if (m){ try{ return JSON.parse(m[0]) }catch(e){} }

    return null
  }catch(err){
    console.warn('Grok error:', err.message)
    return null
  }
}

function parseCSV(content){
  const lines = []
  let cur = ''
  let inQuotes = false
  for (let i=0;i<content.length;i++){
    const ch = content[i]
    const next = content[i+1]
    if (ch === '"'){
      if (inQuotes && next === '"') { cur += '"'; i++; continue }
      inQuotes = !inQuotes
      continue
    }
    if (ch === '\n' && !inQuotes){ lines.push(cur); cur=''; continue }
    cur += ch
  }
  if (cur) lines.push(cur)
  const rows = lines.map(l=>{
    const fields = []
    let field = ''
    inQuotes = false
    for (let i=0;i<l.length;i++){
      const ch = l[i]
      const next = l[i+1]
      if (ch === '"'){
        if (inQuotes && next === '"'){ field += '"'; i++; continue }
        inQuotes = !inQuotes
        continue
      }
      if (ch === ',' && !inQuotes){ fields.push(field); field=''; continue }
      field += ch
    }
    fields.push(field)
    return fields
  })
  return rows
}

function serializeCSV(rows){
  return rows.map(r => r.map(f=>{
    if (f == null) f = ''
    const s = String(f)
    if (/[",\n]/.test(s)) return '"'+s.replace(/"/g,'""')+'"'
    return s
  }).join(',')).join('\n')
}

function ensureArrayField(val){
  if (!val) return []
  if (Array.isArray(val)) return val
  try{ const parsed = JSON.parse(val); if (Array.isArray(parsed)) return parsed }catch(e){}
  // try split by | or ;
  if (typeof val === 'string'){
    const m = val.match(/https?:\/\/[\w\-\./?=&%#]+\.(?:jpg|jpeg|png|webp)/gi)
    if (m) return m
    return [val]
  }
  return []
}

async function main(){
  const inputPath = process.argv[2] || 'input.csv'
  const outputPath = process.argv[3] || 'output.csv'
  if (!fs.existsSync(inputPath)){ console.error('Input CSV not found:', inputPath); process.exit(1) }
  console.log(`Reading ${inputPath}`)
  const raw = fs.readFileSync(inputPath,'utf8')
  const rows = parseCSV(raw)
  if (rows.length===0){ console.error('Empty CSV'); process.exit(1) }
  const header = rows[0]
  const dataRows = rows.slice(1)

  const idxName = header.findIndex(h=>/name/i.test(h))
  const idxCity = header.findIndex(h=>/city/i.test(h))
  const idxTripId = header.findIndex(h=>/tripadvisor_id/i.test(h))
  const idxWeb = header.findIndex(h=>/web_url/i.test(h))
  const idxImageUrls = header.findIndex(h=>/image_urls/i.test(h))
  const idxPrimaryImage = header.findIndex(h=>/primary_image_url|primary_image|image_url/i.test(h))
  const idxRating = header.findIndex(h=>/rating/i.test(h))
  const idxReviewCount = header.findIndex(h=>/review_count/i.test(h))
  const idxLastSynced = header.findIndex(h=>/last_synced|last_synced_at|last_synced/i.test(h))

  console.log(`Found columns: name=${idxName}, city=${idxCity}, tripadvisor_id=${idxTripId}, web_url=${idxWeb}`)

  let updated = 0
  for (let r=0;r<dataRows.length;r++){
    const row = dataRows[r]
    const name = idxName>=0? row[idxName] : ''
    const city = idxCity>=0? row[idxCity] : ''
    const tripid = idxTripId>=0? row[idxTripId] : ''
    const web = idxWeb>=0? row[idxWeb] : ''

    if ((tripid && tripid.trim()) || (web && web.includes('tripadvisor.com'))) { continue }

    const q = `${name} ${city || ''}`.trim()
    if (!q) continue
    try{
      console.log(`[${r+1}/${dataRows.length}] Searching TripAdvisor for: ${q}`)
      const detail = await grokFindListing(q)
      if (!detail){ console.log('  ✗ Grok returned no match'); await sleep(400); continue }

      // normalize
      const tripadvisor_id = detail.tripadvisor_id || (detail.page_url && (detail.page_url.match(/-d(\d+)-/)||[])[1]) || ''
      const page_url = detail.page_url || ''
      const primary = detail.primary_image_url || (Array.isArray(detail.image_urls) && detail.image_urls[0]) || ''
      const images = ensureArrayField(detail.image_urls)

      if (!tripadvisor_id){ console.log('  ✗ Could not extract id from Grok result'); await sleep(400); continue }

      if (idxTripId>=0) dataRows[r][idxTripId] = tripadvisor_id
      if (idxWeb>=0) dataRows[r][idxWeb] = page_url
      if (idxPrimaryImage>=0) dataRows[r][idxPrimaryImage] = primary
      if (idxImageUrls>=0){
        const existing = dataRows[r][idxImageUrls] && dataRows[r][idxImageUrls].trim() ? dataRows[r][idxImageUrls] : '[]'
        try{
          const arr = JSON.parse(existing)
          if (Array.isArray(arr)){
            for (const u of images){ if (u && !arr.includes(u)) arr.unshift(u) }
            dataRows[r][idxImageUrls] = JSON.stringify(arr)
          } else {
            dataRows[r][idxImageUrls] = JSON.stringify(images)
          }
        }catch(e){
          dataRows[r][idxImageUrls] = JSON.stringify(images)
        }
      }
      if (idxRating>=0 && detail.rating) dataRows[r][idxRating] = detail.rating
      if (idxReviewCount>=0 && detail.review_count) dataRows[r][idxReviewCount] = detail.review_count
      if (idxLastSynced>=0) dataRows[r][idxLastSynced] = new Date().toISOString()

      updated++
      console.log(`  ✓ Matched → ${tripadvisor_id}`)
      await sleep(600)
    }catch(e){ console.log('  ✗ Error:', e.message); await sleep(800) }
  }

  const out = [header, ...dataRows]
  fs.writeFileSync(outputPath, serializeCSV(out), 'utf8')
  console.log(`Done. Updated ${updated} rows. Wrote ${outputPath}`)
}

main().catch(e=>{ console.error(e); process.exit(1) })
