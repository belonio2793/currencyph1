import fs from 'fs'
import path from 'path'
import cheerio from 'cheerio'

const SCRAPINGBEE_API_KEY = process.env.SCRAPING_BEE || process.env.SCRAPINGBEE_API_KEY || process.env.SCRAPING_BEE
if (!SCRAPINGBEE_API_KEY) { console.error('Missing SCRAPING_BEE key in env (SCRAPING_BEE)'); process.exit(1) }

function sleep(ms){return new Promise(r=>setTimeout(r,ms))}

async function beeFetch(url){
  const params = new URLSearchParams({ url, render_js: 'true', country_code: 'ph', wait: '3000', block_resources: 'false', premium_proxy: 'true' })
  const resp = await fetch(`https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(SCRAPINGBEE_API_KEY)}&${params.toString()}`)
  if (!resp.ok) throw new Error(`Bee ${resp.status}`)
  return await resp.text()
}

function parseSearch(html){
  const $ = cheerio.load(html)
  const links = new Set()
  $('a[href*="-d"]').each((_, a)=>{
    const href = $(a).attr('href')
    if (href && /-d\d+-/.test(href)) links.add((href.startsWith('http')?href:`https://www.tripadvisor.com${href.split('?')[0]}`))
  })
  if (links.size===0){
    const m = html.match(/"location_id":"?(\d+)/g) || []
    m.slice(0,20).forEach(x=>{const id=(x.match(/(\d+)/)||[])[1]; if(id) links.add(`https://www.tripadvisor.com/Attraction_Review-d${id}`)})
  }
  return Array.from(links)
}

async function scrapeDetail(url){
  const html = await beeFetch(url)
  const $ = cheerio.load(html)
  const name = $('h1').first().text().trim()
  const idMatch = url.match(/-d(\d+)-/) || html.match(/"location_id":"?(\d+)/)
  const tripadvisor_id = idMatch? String(idMatch[1] || idMatch[2]) : null
  const image = $('meta[property="og:image"]').attr('content') || $('img').first().attr('src') || null

  // Attempt to extract rating and review count from page
  let rating = null
  let review_count = null
  // JSON-LD
  const ld = $('script[type="application/ld+json"]').map((i, s) => $(s).html()).get().join('\n')
  try{
    const parsed = JSON.parse(ld)
    if (parsed) {
      if (parsed.aggregateRating){ rating = parsed.aggregateRating.ratingValue || parsed.aggregateRating.rating }
      if (parsed.aggregateRating){ review_count = parsed.aggregateRating.ratingCount || parsed.aggregateRating.reviewCount }
    }
  }catch(e){ /* ignore */ }

  // Fallback: meta tags
  const metaRating = $('meta[itemprop="ratingValue"]').attr('content') || $('meta[name="rating"]')?.attr('content')
  const metaReviewCount = $('meta[itemprop="reviewCount"]').attr('content')
  if (!rating && metaRating) rating = metaRating
  if (!review_count && metaReviewCount) review_count = metaReviewCount

  return { tripadvisor_id, name, image, web_url: url, rating, review_count }
}

function parseCSV(content){
  const lines = []
  let cur = ''
  let inQuotes = false
  for (let i=0;i<content.length;i++){
    const ch = content[i]
    const next = content[i+1]
    if (ch === '"'){
      if (inQuotes && next === '"') { cur += '"'; i++; continue } // escaped
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
  const idxLat = header.findIndex(h=>/latitude|lat/i.test(h))
  const idxLng = header.findIndex(h=>/longitude|lng/i.test(h))
  const idxLastSynced = header.findIndex(h=>/last_synced|last_synced_at|last_synced/i.test(h))

  console.log(`Found columns: name=${idxName}, city=${idxCity}, tripadvisor_id=${idxTripId}, web_url=${idxWeb}`)

  let updated = 0
  for (let r=0;r<dataRows.length;r++){
    const row = dataRows[r]
    const name = idxName>=0? row[idxName] : ''
    const city = idxCity>=0? row[idxCity] : ''
    const tripid = idxTripId>=0? row[idxTripId] : ''
    const web = idxWeb>=0? row[idxWeb] : ''

    if ((tripid && tripid.trim()) || (web && web.includes('tripadvisor.com'))) { continue } // already has tripadvisor link/id

    const q = `${name} ${city || ''}`.trim()
    if (!q) continue
    try{
      console.log(`[${r+1}/${dataRows.length}] Searching TripAdvisor for: ${q}`)
      const searchUrl = `https://www.tripadvisor.com/Search?q=${encodeURIComponent(q)}`
      let html = await beeFetch(searchUrl)
      let links = parseSearch(html)
      if (links.length===0){
        // try .com.ph
        html = await beeFetch(`https://www.tripadvisor.com.ph/Search?q=${encodeURIComponent(q)}`)
        links = parseSearch(html)
      }
      if (links.length===0){ console.log('  ✗ No results'); await sleep(400); continue }
      const detailUrl = links[0]
      const detail = await scrapeDetail(detailUrl)
      if (!detail.tripadvisor_id){ console.log('  ✗ Could not extract id'); await sleep(400); continue }

      // update fields
      if (idxTripId>=0) dataRows[r][idxTripId] = detail.tripadvisor_id
      if (idxWeb>=0) dataRows[r][idxWeb] = detail.web_url
      if (idxPrimaryImage>=0) dataRows[r][idxPrimaryImage] = detail.image
      if (idxImageUrls>=0){
        const existing = dataRows[r][idxImageUrls] && dataRows[r][idxImageUrls].trim() ? dataRows[r][idxImageUrls] : '[]'
        try{
          const arr = JSON.parse(existing)
          if (Array.isArray(arr)){
            if (detail.image && !arr.includes(detail.image)) arr.unshift(detail.image)
            dataRows[r][idxImageUrls] = JSON.stringify(arr)
          } else {
            dataRows[r][idxImageUrls] = JSON.stringify(detail.image ? [detail.image] : [])
          }
        }catch(e){
          dataRows[r][idxImageUrls] = JSON.stringify(detail.image ? [detail.image] : [])
        }
      }
      if (idxRating>=0 && detail.rating) dataRows[r][idxRating] = detail.rating
      if (idxReviewCount>=0 && detail.review_count) dataRows[r][idxReviewCount] = detail.review_count
      if (idxLastSynced>=0) dataRows[r][idxLastSynced] = new Date().toISOString()

      updated++
      console.log(`  ✓ Matched → ${detail.tripadvisor_id}`)
      await sleep(600)
    }catch(e){ console.log('  ✗ Error:', e.message); await sleep(800) }
  }

  const out = [header, ...dataRows]
  fs.writeFileSync(outputPath, serializeCSV(out), 'utf8')
  console.log(`Done. Updated ${updated} rows. Wrote ${outputPath}`)
}

main().catch(e=>{ console.error(e); process.exit(1) })
