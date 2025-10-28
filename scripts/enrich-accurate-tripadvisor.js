import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const X_API_KEY = process.env.X_API_KEY || process.env.XAI_API_KEY || process.env.GROK_API_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

if (!X_API_KEY) {
  console.error('❌ Missing X_API_KEY for Grok API')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)
const checkpointPath = path.join(__dirname, '..', '.enrich-accurate-checkpoint.json')

function loadCheckpoint() {
  try {
    if (fs.existsSync(checkpointPath)) {
      return JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'))
    }
  } catch (e) {}
  return { processed: {}, startTime: Date.now(), stats: { success: 0, failed: 0, skipped: 0 } }
}

function saveCheckpoint(checkpoint) {
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2))
}

async function getAllListings() {
  let allListings = []
  let page = 0
  const pageSize = 500

  while (true) {
    const { data, error } = await supabase
      .from('nearby_listings')
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) {
      console.error(`Error fetching page ${page}:`, error.message)
      break
    }

    if (!data || data.length === 0) break

    allListings = allListings.concat(data)
    page++

    await new Promise(resolve => setTimeout(resolve, 300))
  }

  return allListings
}

async function grokFetchTripadvisorData(listing, attempt = 0) {
  const city = listing.city || 'Philippines'
  const category = listing.category || listing.location_type || 'attraction'
  const name = listing.name || ''

  const prompt = `You are searching tripadvisor.com.ph for accurate business information. Find the exact listing for:

Business Name: "${name}"
City/Location: "${city}"
Category: "${category}"

Search tripadvisor.com.ph and return ONLY valid JSON (no markdown, no code blocks):
{
  "found": true or false,
  "tripadvisor_id": "numeric ID from URL (e.g., 1234567) or null if not found",
  "name": "exact name on tripadvisor.com.ph",
  "address": "complete street address",
  "phone_number": "phone number in +63 format or local format",
  "website": "official website URL or null",
  "rating": 4.5 (numeric between 0-5) or null,
  "review_count": 245 (numeric count) or null,
  "price_range": "$" or "$$" or "$$$" or "$$$$" or null,
  "location_type": "Restaurant", "Hotel", "Attraction", "Bar", "Tour" etc",
  "cuisine": "cuisine type for restaurants or null",
  "hours": {"Monday": "09:00-21:00"} format or null,
  "description": "2-3 sentence description based on actual tripadvisor listing",
  "amenities": ["list of actual amenities"],
  "highlights": ["what visitors say"],
  "tripadvisor_url": "full URL to the listing or null"
}

CRITICAL: Only include data if you actually found the business on tripadvisor.com.ph. Set "found" to false if not found. Be precise with IDs and ratings.`

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${X_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-2',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1200
      }),
      timeout: 60000
    })

    if (!response.ok) {
      if (response.status === 429 && attempt < 3) {
        const delay = Math.pow(2, attempt) * 3000
        await new Promise(resolve => setTimeout(resolve, delay))
        return grokFetchTripadvisorData(listing, attempt + 1)
      }
      return null
    }

    const data = await response.json()
    if (!data.choices?.[0]?.message?.content) {
      return null
    }

    let content = data.choices[0].message.content.trim()

    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      content = jsonMatch[1] || jsonMatch[0]
    }

    const enriched = JSON.parse(content)
    return enriched.found ? enriched : null
  } catch (error) {
    if (attempt < 3) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      return grokFetchTripadvisorData(listing, attempt + 1)
    }
    return null
  }
}

function mergeListing(original, enriched) {
  if (!enriched) return null

  return {
    id: parseInt(original.id),
    name: enriched.name || original.name,
    address: enriched.address || original.address,
    city: original.city,
    country: 'Philippines',
    latitude: original.latitude ? parseFloat(original.latitude) : null,
    longitude: original.longitude ? parseFloat(original.longitude) : null,
    lat: original.latitude ? parseFloat(original.latitude) : null,
    lng: original.longitude ? parseFloat(original.longitude) : null,
    rating: enriched.rating ? parseFloat(enriched.rating) : null,
    review_count: enriched.review_count ? parseInt(enriched.review_count) : null,
    category: enriched.location_type ? enriched.location_type.toLowerCase() : (original.category || 'attraction'),
    location_type: enriched.location_type,
    source: 'tripadvisor',
    description: enriched.description,
    phone_number: enriched.phone_number,
    website: enriched.website,
    web_url: enriched.tripadvisor_url,
    price_range: enriched.price_range,
    price_level: enriched.price_range ? (['$', '$$', '$$$', '$$$$'].indexOf(enriched.price_range) + 1) : null,
    hours_of_operation: enriched.hours || {},
    amenities: Array.isArray(enriched.amenities) ? enriched.amenities : [],
    highlights: Array.isArray(enriched.highlights) ? enriched.highlights : [],
    cuisine: enriched.cuisine,
    tripadvisor_id: enriched.tripadvisor_id,
    verified: true,
    updated_at: new Date().toISOString(),
    last_verified_at: new Date().toISOString(),
    fetch_status: 'success'
  }
}

async function upsertToSupabase(listing) {
  try {
    const { error } = await supabase
      .from('nearby_listings')
      .upsert(listing, { onConflict: 'id' })

    return !error
  } catch (error) {
    return false
  }
}

async function main() {
  const checkpoint = loadCheckpoint()
  const startTime = checkpoint.startTime || Date.now()

  console.log('\n🚀 ACCURATE TRIPADVISOR DATA ENRICHMENT\n')
  console.log('📥 Fetching all listings from Supabase...')
  const listings = await getAllListings()

  console.log(`✅ Total listings: ${listings.length}`)

  const needsEnrichment = listings.filter(l => !l.tripadvisor_id)
  console.log(`⚠️  Need enrichment: ${needsEnrichment.length}`)
  console.log(`✨ Already enriched: ${listings.length - needsEnrichment.length}\n`)

  let processed = 0

  for (let i = 0; i < needsEnrichment.length; i++) {
    const listing = needsEnrichment[i]
    const listingId = listing.id

    if (checkpoint.processed[listingId]) {
      continue
    }

    if (!listing.name || !listing.city) {
      checkpoint.processed[listingId] = 'skipped'
      checkpoint.stats.skipped++
      continue
    }

    const displayName = `${listing.name.slice(0, 40).padEnd(40)} (${listing.city.slice(0, 12).padEnd(12)})`
    process.stdout.write(`[${String(i + 1).padStart(4)}/${needsEnrichment.length}] ${displayName} `)

    const enriched = await grokFetchTripadvisorData(listing)
    
    if (enriched) {
      const merged = mergeListing(listing, enriched)
      const success = await upsertToSupabase(merged)

      if (success) {
        checkpoint.processed[listingId] = true
        checkpoint.stats.success++
        console.log(`✅ [${enriched.tripadvisor_id || 'ID'}]`)
      } else {
        console.log('❌ DB Error')
        checkpoint.stats.failed++
      }
    } else {
      console.log('⏭️  Not found')
      checkpoint.stats.skipped++
    }

    saveCheckpoint(checkpoint)
    processed++

    if (processed % 5 === 0) {
      const elapsedMs = Date.now() - startTime
      const elapsedMin = (elapsedMs / 1000 / 60).toFixed(1)
      const remaining = needsEnrichment.length - i - 1
      const avgMs = elapsedMs / processed
      const estRemainMin = (remaining * avgMs / 1000 / 60).toFixed(0)

      console.log(`   ⏱️  [${processed}/${needsEnrichment.length}] | Time: ${elapsedMin}min | ETA: ${estRemainMin}min`)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  const totalElapsedMin = ((Date.now() - startTime) / 1000 / 60).toFixed(1)

  console.log('\n' + '='.repeat(80))
  console.log('✅ ENRICHMENT COMPLETE!')
  console.log(`📊 Success: ${checkpoint.stats.success}`)
  console.log(`❌ Failed: ${checkpoint.stats.failed}`)
  console.log(`⏭️  Not found: ${checkpoint.stats.skipped}`)
  console.log(`⏱️  Total time: ${totalElapsedMin} minutes`)
  console.log('='.repeat(80) + '\n')
}

main().catch(console.error)
