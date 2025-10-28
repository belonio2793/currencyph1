import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import { fileURLToPath } from 'url'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const X_API_KEY = process.env.X_API_KEY || process.env.XAI_API_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

if (!X_API_KEY) {
  console.error('❌ Missing X_API_KEY for Grok API')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

// Fetch all listings from database
async function getAllListings() {
  console.log('📥 Fetching all listings from database...')
  
  const { data, error } = await supabase
    .from('nearby_listings')
    .select('*')
    .order('id', { ascending: true })

  if (error) {
    console.error('❌ Error fetching listings:', error.message)
    return []
  }

  console.log(`✅ Found ${data.length} listings in database`)
  return data
}

// Grok API call to fetch accurate TripAdvisor data
async function grokFetchTripadvisorData(listing) {
  const city = listing.city || 'Philippines'
  const category = listing.location_type || listing.category || 'attraction'
  const name = listing.name || ''

  const prompt = `You are a TripAdvisor Philippines expert. Extract real, accurate data for:
Name: "${name}"
Location: "${city}, Philippines"
Type: ${category}

Return ONLY valid JSON (no markdown):
{
  "name": "official business name from tripadvisor.com.ph",
  "address": "full street address",
  "phone_number": "contact phone (+63 format or (02) XXXX-XXXX)",
  "website": "official website or null",
  "email": "email or null",
  "description": "2-3 sentence description",
  "rating": rating as number 0-5,
  "review_count": review count as number,
  "price_range": "$", "$$", "$$$", or "$$$$",
  "amenities": ["list", "of", "amenities"],
  "hours": "09:00-18:00" or object format,
  "tripadvisor_url": "https://www.tripadvisor.com.ph/... or null",
  "highlights": ["key", "highlights"],
  "photos": number estimate,
  "ranking": "X of Y in city" or null
}

Be accurate. Use real TripAdvisor data. If unsure, use null. NO fabricated data.`

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
        temperature: 0.2,
        max_tokens: 800
      }),
      timeout: 30000
    })

    if (!response.ok) {
      console.error(`❌ Grok error (${response.status})`)
      return null
    }

    const data = await response.json()
    let content = data.choices[0].message.content.trim()
    
    // Extract JSON
    let jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (jsonMatch) content = jsonMatch[1].trim()
    else {
      jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) content = jsonMatch[0]
    }

    const enriched = JSON.parse(content)
    return enriched
  } catch (error) {
    console.error(`   ❌ Grok error: ${error.message}`)
    return null
  }
}

// Merge enriched data
function mergeListing(original, enriched) {
  if (!enriched) return original

  return {
    ...original,
    name: enriched.name || original.name,
    address: enriched.address || original.address,
    phone_number: enriched.phone_number || original.phone_number,
    website: enriched.website || original.website,
    email: enriched.email,
    description: enriched.description || original.description,
    rating: enriched.rating !== null && enriched.rating !== undefined ? enriched.rating : original.rating,
    review_count: enriched.review_count !== null ? enriched.review_count : original.review_count,
    price_range: enriched.price_range || original.price_range,
    location_type: enriched.location_type || original.location_type,
    web_url: enriched.tripadvisor_url || original.web_url,
    hours_of_operation: enriched.hours || original.hours_of_operation,
    amenities: enriched.amenities || original.amenities,
    photo_count: enriched.photos || original.photo_count,
    highlights: enriched.highlights || original.highlights,
    ranking_in_city: enriched.ranking || original.ranking_in_city,
    verified: true,
    last_verified_at: new Date().toISOString()
  }
}

// Upsert to database
async function upsertToSupabase(listing) {
  try {
    const amenities = Array.isArray(listing.amenities) ? listing.amenities : []
    const highlights = Array.isArray(listing.highlights) ? listing.highlights : []
    const photoUrls = Array.isArray(listing.photo_urls) ? listing.photo_urls : []
    
    let hoursOp = listing.hours_of_operation
    if (typeof hoursOp === 'string') {
      try { hoursOp = JSON.parse(hoursOp) } catch (e) { hoursOp = {} }
    } else if (typeof hoursOp !== 'object') {
      hoursOp = {}
    }

    let accessInfo = listing.accessibility_info
    if (typeof accessInfo === 'string') {
      try { accessInfo = JSON.parse(accessInfo) } catch (e) { accessInfo = {} }
    } else if (typeof accessInfo !== 'object') {
      accessInfo = {}
    }

    const preparedData = {
      id: listing.id,
      name: listing.name || 'Unknown',
      address: listing.address,
      city: listing.city,
      country: listing.country || 'Philippines',
      latitude: listing.latitude ? parseFloat(listing.latitude) : null,
      longitude: listing.longitude ? parseFloat(listing.longitude) : null,
      lat: listing.lat || listing.latitude ? parseFloat(listing.latitude) : null,
      lng: listing.lng || listing.longitude ? parseFloat(listing.longitude) : null,
      rating: listing.rating ? parseFloat(listing.rating) : null,
      review_count: listing.review_count ? parseInt(listing.review_count) : null,
      category: listing.category,
      location_type: listing.location_type,
      source: listing.source || 'tripadvisor',
      description: listing.description,
      phone_number: listing.phone_number,
      website: listing.website,
      email: listing.email,
      hours_of_operation: hoursOp,
      web_url: listing.web_url,
      price_range: listing.price_range,
      price_level: getPriceLevel(listing.price_range),
      amenities: amenities,
      accessibility_info: accessInfo,
      photo_count: listing.photo_count ? parseInt(listing.photo_count) : null,
      photo_urls: photoUrls,
      highlights: highlights,
      ranking_in_city: listing.ranking_in_city,
      visibility_score: listing.visibility_score ? parseFloat(listing.visibility_score) : null,
      verified: true,
      last_verified_at: new Date().toISOString(),
      fetch_status: 'success',
      updated_at: new Date().toISOString(),
      timezone: 'Asia/Manila',
      currency: 'PHP'
    }

    Object.keys(preparedData).forEach(key => {
      if (preparedData[key] === undefined || preparedData[key] === '') {
        delete preparedData[key]
      }
    })

    const { error } = await supabase
      .from('nearby_listings')
      .upsert(preparedData, { onConflict: 'id' })

    if (error) {
      console.error(`   ❌ DB error: ${error.message}`)
      return false
    }

    return true
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`)
    return false
  }
}

// Helper
function getPriceLevel(priceRange) {
  const map = { '$': 1, '$$': 2, '$$$': 3, '$$$$': 4 }
  return map[priceRange] || null
}

// Main
async function main() {
  const listings = await getAllListings()
  
  if (listings.length === 0) {
    console.log('❌ No listings found')
    process.exit(1)
  }

  console.log(`\n🚀 Starting enrichment of ${listings.length} listings...\n`)

  let success = 0
  let failed = 0
  const batchSize = 3
  const delayMs = 3000

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i]
    const progress = `[${i + 1}/${listings.length}]`
    const displayName = `${listing.name} (${listing.city})`

    console.log(`${progress} 🔍 ${displayName}`)

    const enriched = await grokFetchTripadvisorData(listing)
    
    if (enriched && enriched.name) {
      if (enriched.rating) console.log(`   ⭐ ${enriched.rating} | ${enriched.review_count || '?'} reviews`)
      if (enriched.phone_number) console.log(`   ☎️  ${enriched.phone_number}`)
      if (enriched.website) console.log(`   🌐 ${enriched.website}`)
    }

    const merged = mergeListing(listing, enriched)
    const isSuccess = await upsertToSupabase(merged)

    if (isSuccess) {
      console.log(`   ✅ Updated\n`)
      success++
    } else {
      console.log(`   ❌ Failed\n`)
      failed++
    }

    if ((i + 1) % batchSize === 0 && i < listings.length - 1) {
      console.log(`⏳ Rate limiting (${delayMs}ms)...\n`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  console.log('='.repeat(60))
  console.log(`✅ ENRICHMENT COMPLETE!`)
  console.log(`📊 Success: ${success}/${listings.length}`)
  if (failed > 0) console.log(`❌ Failed: ${failed}`)
  console.log('='.repeat(60))
  console.log('\n🌐 All nearby_listings enriched with TripAdvisor data!\n')

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('💥 Fatal error:', err)
  process.exit(1)
})
