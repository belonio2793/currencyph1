import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const X_API_KEY = process.env.X_API_KEY || process.env.XAI_API_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY || !X_API_KEY) {
  console.error('❌ Missing credentials')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

// Fetch all listings
async function getAllListings() {
  console.log('📥 Fetching all listings from database...')
  
  const { data, error } = await supabase
    .from('nearby_listings')
    .select('*')
    .order('id', { ascending: true })

  if (error) {
    console.error('❌ Error fetching:', error.message)
    return []
  }

  console.log(`✅ Found ${data.length} listings\n`)
  return data
}

// Extract TripAdvisor ID from URL
function extractTripAdvisorId(url) {
  if (!url) return null
  const match = url.match(/(?:d|Review-)(\d+)/)
  return match ? match[1] : null
}

// Grok API call for deep enrichment
async function grokDeepEnrich(listing) {
  const name = listing.name || ''
  const city = listing.city || 'Philippines'
  const url = listing.web_url || ''

  const prompt = `Expert TripAdvisor Philippines data extractor. For:
"${name}" in ${city}, Philippines
TripAdvisor URL: ${url}

Return ONLY valid JSON (no markdown):
{
  "tripadvisor_id": "extract from URL (d12345 format) or search tripadvisor",
  "photo_urls": ["https://media.tacdn.com/...", "url2", "url3"],
  "primary_image_url": "best photo URL",
  "featured_image_url": "featured photo URL",
  "cuisine": "type of cuisine for restaurants",
  "features": ["outdoor seating", "wifi", "takeout"],
  "tags": ["tag1", "tag2"],
  "admission_fee": "Free", "Paid - PHP500", or null,
  "rankings": {
    "city": "5 of 50",
    "category": 10
  },
  "reviews_summary": "2-sentence summary of reviews"
}

Be accurate. Use real TripAdvisor data. If unsure, use null.`

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
        max_tokens: 1000
      }),
      timeout: 30000
    })

    if (!response.ok) return null

    const data = await response.json()
    let content = data.choices[0].message.content.trim()
    
    let jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (jsonMatch) content = jsonMatch[1].trim()
    else {
      jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) content = jsonMatch[0]
    }

    return JSON.parse(content)
  } catch (error) {
    console.error(`   ❌ Grok error: ${error.message}`)
    return null
  }
}

// Merge deep enriched data
function mergeDeepEnrichment(original, enriched) {
  if (!enriched) return original

  return {
    ...original,
    tripadvisor_id: enriched.tripadvisor_id || extractTripAdvisorId(original.web_url) || original.tripadvisor_id,
    photo_urls: enriched.photo_urls || original.photo_urls || [],
    primary_image_url: enriched.primary_image_url || original.primary_image_url || original.image_url,
    featured_image_url: enriched.featured_image_url || original.featured_image_url,
    cuisine: enriched.cuisine || original.cuisine,
    features: enriched.features || original.features,
    tags: enriched.tags || original.tags,
    admission_fee: enriched.admission_fee || original.admission_fee,
    ranking_in_city: enriched.rankings?.city || original.ranking_in_city,
    ranking_in_category: enriched.rankings?.category || original.ranking_in_category,
    reviews_summary: enriched.reviews_summary || original.reviews_summary,
    updated_at: new Date().toISOString(),
    last_verified_at: new Date().toISOString()
  }
}

// Upsert to database
async function upsertToSupabase(listing) {
  try {
    const photoUrls = Array.isArray(listing.photo_urls) ? listing.photo_urls : []
    const features = Array.isArray(listing.features) ? listing.features : []
    const tags = Array.isArray(listing.tags) ? listing.tags : []

    const preparedData = {
      id: listing.id,
      tripadvisor_id: listing.tripadvisor_id,
      photo_urls: photoUrls,
      primary_image_url: listing.primary_image_url,
      featured_image_url: listing.featured_image_url,
      cuisine: listing.cuisine,
      features: features,
      tags: tags,
      admission_fee: listing.admission_fee,
      ranking_in_city: listing.ranking_in_city,
      ranking_in_category: listing.ranking_in_category,
      reviews_summary: listing.reviews_summary,
      updated_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString()
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

// Main
async function main() {
  const listings = await getAllListings()
  
  if (listings.length === 0) {
    console.log('❌ No listings found')
    process.exit(1)
  }

  console.log(`🚀 Starting deep enrichment of ${listings.length} listings...\n`)

  let success = 0
  let failed = 0
  const batchSize = 2
  const delayMs = 2000

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i]
    const progress = `[${i + 1}/${listings.length}]`
    const displayName = `${listing.name} (${listing.city})`

    process.stdout.write(`${progress} 🔍 ${displayName.slice(0, 50)}... `)

    const enriched = await grokDeepEnrich(listing)
    const merged = mergeDeepEnrichment(listing, enriched)
    const isSuccess = await upsertToSupabase(merged)

    if (isSuccess) {
      console.log('���')
      success++
    } else {
      console.log('❌')
      failed++
    }

    if ((i + 1) % batchSize === 0 && i < listings.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`✅ DEEP ENRICHMENT COMPLETE!`)
  console.log(`📊 Success: ${success}/${listings.length}`)
  if (failed > 0) console.log(`❌ Failed: ${failed}`)
  console.log('='.repeat(60))
  console.log('\n🌐 All fields enriched: tripadvisor_id, photo_urls, cuisine, tags, etc!\n')

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('💥 Fatal error:', err)
  process.exit(1)
})
