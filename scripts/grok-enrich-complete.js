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
const checkpointPath = path.join(__dirname, '..', '.enrich-complete-checkpoint.json')

function loadCheckpoint() {
  try {
    if (fs.existsSync(checkpointPath)) {
      return JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'))
    }
  } catch (e) {}
  return { processed: {}, startTime: Date.now() }
}

function saveCheckpoint(checkpoint) {
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2))
}

function extractTripAdvisorId(url, name = '', existingId = null) {
  if (existingId && typeof existingId === 'string' && existingId.length >= 4) {
    return existingId
  }
  if (existingId && typeof existingId === 'number' && existingId > 0) {
    return String(existingId)
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

    await new Promise(resolve => setTimeout(resolve, 300))
  }

  return allListings
}

async function grokFetchTripadvisorData(listing, retries = 3) {
  const city = listing.city || 'Philippines'
  const category = listing.category || listing.location_type || 'attraction'
  const name = listing.name || ''

  const prompt = `You are a TripAdvisor Philippines expert. Extract accurate data for this business:

Business: "${name}"
City/Area: "${city}"
Category: "${category}"

Search tripadvisor.com.ph and return ONLY valid JSON (no markdown, no code blocks):
{
  "tripadvisor_id": "numeric ID from URL (6-8 digits) or null - MUST be accurate",
  "address": "complete street address if available",
  "phone_number": "phone with +63 or (02) format or null",
  "website": "official website URL or null",
  "description": "accurate 2-3 sentence description or null",
  "rating": 4.5 (number 0-5) or null,
  "review_count": 123 (number) or null,
  "price_range": "$" or "$$" or "$$$" or "$$$$" or null,
  "location_type": "Restaurant", "Hotel", "Attraction", "Bar", or original category
}

CRITICAL: The tripadvisor_id must be a valid numeric ID from the actual TripAdvisor URL (e.g., 1234567 or 12345). Return null if not found. Be accurate.`

  for (let attempt = 0; attempt < retries; attempt++) {
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
          max_tokens: 800
        }),
        timeout: 45000
      })

      if (!response.ok) {
        if (response.status === 429 && attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 2000
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
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
      return enriched
    } catch (error) {
      if (attempt === retries - 1) {
        return null
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
    }
  }

  return null
}

function mergeListing(original, enriched) {
  if (!enriched) return original

  const merged = {
    ...original,
    phone_number: enriched.phone_number || original.phone_number,
    website: enriched.website || original.website,
    description: enriched.description || original.description,
    rating: enriched.rating !== undefined ? enriched.rating : original.rating,
    review_count: enriched.review_count !== undefined ? enriched.review_count : original.review_count,
    price_range: enriched.price_range || original.price_range,
    location_type: enriched.location_type || original.location_type,
    address: enriched.address || original.address,
    tripadvisor_id: enriched.tripadvisor_id || extractTripAdvisorId(original.web_url, original.name, original.tripadvisor_id) || original.tripadvisor_id,
    verified: true,
    last_verified_at: new Date().toISOString()
  }

  return merged
}

async function upsertToSupabase(listing) {
  try {
    const preparedData = {
      id: parseInt(listing.id),
      tripadvisor_id: listing.tripadvisor_id,
      phone_number: listing.phone_number,
      website: listing.website,
      description: listing.description,
      rating: listing.rating ? parseFloat(listing.rating) : null,
      review_count: listing.review_count ? parseInt(listing.review_count) : null,
      price_range: listing.price_range,
      location_type: listing.location_type,
      address: listing.address,
      verified: listing.verified === true || listing.verified === 'true',
      updated_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
      fetch_status: 'success'
    }

    Object.keys(preparedData).forEach(key => {
      if (preparedData[key] === undefined || preparedData[key] === '' || preparedData[key] === null) {
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
  const checkpoint = loadCheckpoint()
  const startTime = checkpoint.startTime || Date.now()

  console.log('\n🚀 GROK ENRICHMENT - COMPLETE ALL LISTINGS\n')
  console.log('📥 Fetching all listings from Supabase...')
  const listings = await getAllListings()

  console.log(`✅ Total listings: ${listings.length}`)

  const needsEnrichment = listings.filter(l => !l.tripadvisor_id || l.tripadvisor_id === null || l.tripadvisor_id === '')
  console.log(`⚠️  Need enrichment: ${needsEnrichment.length}`)
  console.log(`✨ Already enriched: ${listings.length - needsEnrichment.length}\n`)

  let successCount = 0
  let failureCount = 0
  let rateLimitWaits = 0

  for (let i = 0; i < needsEnrichment.length; i++) {
    const listing = needsEnrichment[i]
    const listingId = listing.id

    if (checkpoint.processed[listingId]) {
      continue
    }

    if (!listing.name || !listing.city) {
      checkpoint.processed[listingId] = 'skipped'
      continue
    }

    const displayName = `${listing.name.slice(0, 35).padEnd(35)} (${listing.city.slice(0, 10).padEnd(10)})`
    process.stdout.write(`[${String(i + 1).padStart(4)}/${needsEnrichment.length}] ${displayName} `)

    const enriched = await grokFetchTripadvisorData(listing)
    const merged = mergeListing(listing, enriched)
    const success = await upsertToSupabase(merged)

    if (success) {
      checkpoint.processed[listingId] = true
      console.log(`✅ ${merged.tripadvisor_id || 'N/A'}`)
      successCount++
    } else {
      console.log('❌')
      failureCount++
    }

    saveCheckpoint(checkpoint)

    if ((i + 1) % 3 === 0) {
      const elapsedMs = Date.now() - startTime
      const elapsedSec = (elapsedMs / 1000).toFixed(1)
      const remaining = needsEnrichment.length - (i + 1)
      const avgTime = elapsedMs / (i + 1)
      const estimatedRemainingMs = remaining * avgTime
      const estimatedRemainingSec = (estimatedRemainingMs / 1000).toFixed(0)

      console.log(`   ⏱️  Processed: ${i + 1}/${needsEnrichment.length} | Time: ${elapsedSec}s | ETA: ${estimatedRemainingSec}s`)
      await new Promise(resolve => setTimeout(resolve, 1500))
    }
  }

  const totalElapsedMs = Date.now() - startTime
  const totalElapsedMin = (totalElapsedMs / 1000 / 60).toFixed(1)

  console.log('\n' + '='.repeat(80))
  console.log('✅ ENRICHMENT COMPLETE!')
  console.log(`📊 Success: ${successCount}`)
  console.log(`❌ Failed: ${failureCount}`)
  console.log(`⏱️  Total time: ${totalElapsedMin} minutes`)
  console.log('='.repeat(80) + '\n')
}

main().catch(console.error)
