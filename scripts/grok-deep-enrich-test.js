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

async function getAllListings(limit) {
  const { data, error } = await supabase
    .from('nearby_listings')
    .select('*')
    .order('id', { ascending: true })
    .limit(limit)

  return data || []
}

function extractTripAdvisorId(url) {
  if (!url) return null
  const match = url.match(/(?:d|Review-)(\d+)/)
  return match ? match[1] : null
}

async function grokDeepEnrich(listing) {
  const name = listing.name || ''
  const city = listing.city || 'Philippines'
  const url = listing.web_url || ''

  const prompt = `Expert TripAdvisor Philippines data. For: "${name}" in ${city}
URL: ${url}

Return ONLY JSON:
{
  "tripadvisor_id": "from URL or search",
  "photo_urls": ["url1", "url2", "url3"],
  "primary_image_url": "best photo",
  "cuisine": "for restaurants",
  "features": ["list"],
  "tags": ["tags"]
}`

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
        max_tokens: 500
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
    return null
  }
}

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

    return !error
  } catch (error) {
    return false
  }
}

async function main() {
  const limit = 50
  const listings = await getAllListings(limit)
  
  console.log(`🚀 Testing deep enrichment on ${listings.length} listings...\n`)

  let success = 0
  const batchSize = 2
  const delayMs = 1500

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i]
    const progress = `[${i + 1}/${listings.length}]`

    process.stdout.write(`${progress} ${listing.name.slice(0, 40)}... `)

    const enriched = await grokDeepEnrich(listing)
    
    if (enriched) {
      const merged = {
        ...listing,
        tripadvisor_id: enriched.tripadvisor_id || extractTripAdvisorId(listing.web_url) || listing.tripadvisor_id,
        photo_urls: enriched.photo_urls || listing.photo_urls || [],
        primary_image_url: enriched.primary_image_url || listing.primary_image_url || listing.image_url,
        featured_image_url: enriched.featured_image_url || listing.featured_image_url,
        cuisine: enriched.cuisine || listing.cuisine,
        features: enriched.features || listing.features,
        tags: enriched.tags || listing.tags,
        admission_fee: enriched.admission_fee || listing.admission_fee
      }

      const isSuccess = await upsertToSupabase(merged)
      console.log(isSuccess ? '✅' : '❌')
      if (isSuccess) success++
    } else {
      console.log('⚠️')
    }

    if ((i + 1) % batchSize === 0 && i < listings.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  console.log(`\n✅ Test complete: ${success}/${listings.length}`)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
