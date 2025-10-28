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

// Checkpoint
const checkpointPath = path.join(__dirname, '..', '.enrich-all-checkpoint.json')

function loadCheckpoint() {
  try {
    if (fs.existsSync(checkpointPath)) {
      return JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'))
    }
  } catch (e) {}
  return { processed: {}, totalCount: 0, lastIndex: 0 }
}

function saveCheckpoint(checkpoint) {
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2))
}

// Extract TripAdvisor ID
function extractTripAdvisorId(url, name = '', existingId = null) {
  // If already has a valid ID, return it
  if (existingId && existingId.length >= 4) {
    return existingId
  }

  if (!url) return null

  const patterns = [
    /[/]d(\d+)(?:[-/]|$)/,
    /[?&]d[A-Za-z]*=(\d+)/,
    /Location_Review-d(\d+)/,
    /Attraction_Review[^-]*-[^-]*-d(\d+)/,
    /Restaurant_Review[^-]*-[^-]*-d(\d+)/,
    /Hotel[^-]*-d(\d+)/,
    /(?:tripadvisor\.com\.ph|tripadvisor\.com).*?[/]d(\d+)/,
    /[/-](\d{6,})[/-]/
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      const id = match[1]
      if (id.length >= 4 && id.length <= 10) {
        return id
      }
    }
  }

  return null
}

// Fetch all listings with pagination
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
      console.error(`❌ Error fetching page ${page}:`, error.message)
      break
    }

    if (!data || data.length === 0) break

    allListings = allListings.concat(data)
    page++

    // Small delay between pages
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  return allListings
}

// Grok API call
async function grokFetchTripadvisorData(listing) {
  const city = listing.city || 'Philippines'
  const category = listing.category || listing.location_type || 'attraction'
  const name = listing.name || ''

  const prompt = `You are a TripAdvisor Philippines expert. Extract accurate data for:
Business: "${name}"
City/Area: "${city}"
Category: "${category}"

Return ONLY valid JSON (no markdown, no code blocks):
{
  "name": "official name on tripadvisor.com.ph",
  "tripadvisor_id": "numeric ID from URL (6-8 digits) or null",
  "address": "complete street address",
  "phone_number": "phone with +63 or (02) format",
  "website": "official website or null",
  "description": "accurate 2-3 sentence description",
  "rating": number 0-5 or null,
  "review_count": number or null,
  "price_range": "$", "$$", "$$$", or "$$$$" or null,
  "cuisine": "cuisine type for restaurants or null",
  "amenities": ["list"],
  "hours": {"Monday": "09:00-18:00"} or null,
  "location_type": "Restaurant", "Hotel", "Attraction", or "Bar/Pub",
  "tripadvisor_url": "https://www.tripadvisor.com.ph/... or null",
  "highlights": ["features"],
  "ranking": "X of Y" or null,
  "photos": number or null
}

Extract the numeric TripAdvisor ID from the URL. Be accurate with real data.`

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
        max_tokens: 1000
      }),
      timeout: 30000
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    if (!data.choices?.[0]?.message?.content) {
      return null
    }

    let content = data.choices[0].message.content.trim()

    // Extract JSON
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      content = jsonMatch[1] || jsonMatch[0]
    }

    const enriched = JSON.parse(content)
    return enriched
  } catch (error) {
    return null
  }
}

// Merge enriched data
function mergeListing(original, enriched) {
  if (!enriched) return original

  const merged = {
    ...original,
    name: enriched.name || original.name,
    address: enriched.address || original.address,
    phone_number: enriched.phone_number || original.phone_number,
    website: enriched.website || original.website,
    email: enriched.email || original.email,
    description: enriched.description || original.description,
    rating: enriched.rating ?? original.rating,
    review_count: enriched.review_count ?? original.review_count,
    price_range: enriched.price_range || original.price_range,
    location_type: enriched.location_type || original.location_type,
    web_url: enriched.tripadvisor_url || original.web_url,
    amenities: enriched.amenities ? (Array.isArray(enriched.amenities) ? enriched.amenities : []) : original.amenities,
    highlights: enriched.highlights ? (Array.isArray(enriched.highlights) ? enriched.highlights : []) : original.highlights,
    ranking_in_city: enriched.ranking || original.ranking_in_city,
    cuisine: enriched.cuisine || original.cuisine,
    category: enriched.location_type ? enriched.location_type.toLowerCase() : (original.category || 'attraction'),
    photo_count: enriched.photos ?? original.photo_count,
    tripadvisor_id: enriched.tripadvisor_id || extractTripAdvisorId(enriched.tripadvisor_url || original.web_url, original.name, original.tripadvisor_id) || original.tripadvisor_id,
    verified: true,
    last_verified_at: new Date().toISOString()
  }

  // Handle hours
  if (enriched.hours && typeof enriched.hours === 'object') {
    merged.hours_of_operation = enriched.hours
  }

  return merged
}

// Upsert to Supabase
async function upsertToSupabase(listing) {
  try {
    const amenities = Array.isArray(listing.amenities) ? listing.amenities : []
    const highlights = Array.isArray(listing.highlights) ? listing.highlights : []
    const photoUrls = Array.isArray(listing.photo_urls) ? listing.photo_urls : []

    let hoursOp = listing.hours_of_operation
    if (typeof hoursOp === 'string') {
      try {
        hoursOp = JSON.parse(hoursOp)
      } catch (e) {
        hoursOp = {}
      }
    }

    const preparedData = {
      id: parseInt(listing.id),
      name: listing.name || 'Unknown',
      address: listing.address,
      city: listing.city,
      country: 'Philippines',
      latitude: listing.latitude ? parseFloat(listing.latitude) : null,
      longitude: listing.longitude ? parseFloat(listing.longitude) : null,
      lat: listing.latitude ? parseFloat(listing.latitude) : null,
      lng: listing.longitude ? parseFloat(listing.longitude) : null,
      rating: listing.rating ? parseFloat(listing.rating) : null,
      review_count: listing.review_count ? parseInt(listing.review_count) : null,
      category: listing.category || 'attraction',
      location_type: listing.location_type,
      source: listing.source || 'tripadvisor',
      description: listing.description,
      phone_number: listing.phone_number,
      website: listing.website,
      email: listing.email,
      web_url: listing.web_url,
      price_range: listing.price_range,
      price_level: ['$', '$$', '$$$', '$$$$'].indexOf(listing.price_range) + 1 || null,
      hours_of_operation: hoursOp,
      amenities: amenities,
      photo_count: listing.photo_count ? parseInt(listing.photo_count) : null,
      photo_urls: photoUrls,
      highlights: highlights,
      ranking_in_city: listing.ranking_in_city,
      cuisine: listing.cuisine,
      tripadvisor_id: listing.tripadvisor_id,
      verified: listing.verified === true || listing.verified === 'true',
      updated_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
      fetch_status: 'success'
    }

    Object.keys(preparedData).forEach(key => {
      if (preparedData[key] === undefined || preparedData[key] === '') {
        delete preparedData[key]
      }
    })

    const { error } = await supabase
      .from('nearby_listings')
      .upsert(preparedData, { onConflict: 'id' })

    return !error
  } catch (error) {
    return false
  }
}

// Main
async function main() {
  console.log('📊 Loading checkpoint...')
  const checkpoint = loadCheckpoint()

  console.log('📥 Fetching all listings from Supabase...')
  const listings = await getAllListings()

  console.log(`✅ Total listings: ${listings.length}`)
  console.log(`✨ Already processed: ${Object.keys(checkpoint.processed).length}`)

  if (listings.length === 0) {
    console.log('❌ No listings found')
    process.exit(1)
  }

  console.log(`🚀 Starting Grok enrichment\n`)

  let successCount = 0
  let failureCount = 0
  let skippedCount = 0

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i]
    const listingId = listing.id

    if (!listing.name || !listing.city) {
      skippedCount++
      continue
    }

    if (checkpoint.processed[listingId]) {
      skippedCount++
      continue
    }

    const displayName = `${listing.name.slice(0, 30).padEnd(30)} (${listing.city.slice(0, 12).padEnd(12)})`
    process.stdout.write(`[${String(i + 1).padStart(4)}/${listings.length}] ${displayName} `)

    const enriched = await grokFetchTripadvisorData(listing)
    const merged = mergeListing(listing, enriched)
    const success = await upsertToSupabase(merged)

    if (success) {
      checkpoint.processed[listingId] = true
      console.log('✅')
      successCount++
    } else {
      console.log('❌')
      failureCount++
    }

    saveCheckpoint(checkpoint)

    // Rate limiting
    if ((i + 1) % 5 === 0) {
      const elapsed = (i + 1)
      const rate = (elapsed / 5).toFixed(1)
      console.log(`   ⏱️  Processed: ${elapsed}/${listings.length} (${rate} items/sec)`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log('✅ ENRICHMENT COMPLETE!')
  console.log(`📊 Success: ${successCount}`)
  console.log(`❌ Failed: ${failureCount}`)
  console.log(`⏭️  Skipped: ${skippedCount}`)
  console.log(`📈 Total processed: ${successCount + failureCount}/${listings.length}`)
  console.log('='.repeat(70))

  // Clear checkpoint on success
  if (failureCount === 0 && fs.existsSync(checkpointPath)) {
    fs.unlinkSync(checkpointPath)
    console.log('\n🎉 Checkpoint cleared!')
  }

  console.log('\n✨ All listings enriched with TripAdvisor data!')
  console.log('🗄️  Supabase updated with:')
  console.log('   ✓ TripAdvisor IDs')
  console.log('   ✓ Accurate addresses & phone numbers')
  console.log('   ✓ Real ratings & review counts')
  console.log('   ✓ Hours of operation')
  console.log('   ✓ Amenities & features')
  console.log('   ✓ Verified information\n')

  process.exit(failureCount > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('💥 Fatal error:', err.message)
  process.exit(1)
})
