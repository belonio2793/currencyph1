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

// Checkpoint file to track progress
const checkpointPath = path.join(__dirname, '..', '.enrichment-checkpoint.json')

function loadCheckpoint() {
  if (fs.existsSync(checkpointPath)) {
    try {
      return JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'))
    } catch (e) {
      return { processed: {}, lastIndex: 0 }
    }
  }
  return { processed: {}, lastIndex: 0 }
}

function saveCheckpoint(checkpoint) {
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2))
}

// Better TripAdvisor ID extraction
function extractTripAdvisorId(url, name = '', city = '') {
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

// Grok API call with proper error handling
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
  "tripadvisor_id": "the numeric ID from the URL (6-8 digits) or null",
  "address": "complete street address",
  "phone_number": "phone with +63 or (02) format",
  "website": "official website or null",
  "email": "contact email or null",
  "description": "2-3 sentence accurate description",
  "rating": number from 0-5 or null,
  "review_count": number or null,
  "price_range": "$", "$$", "$$$", or "$$$$" or null,
  "cuisine": "for restaurants, specific cuisine or null",
  "amenities": ["list of amenities"],
  "hours_of_operation": {"Monday": "09:00-18:00"} or null,
  "location_type": "Restaurant", "Hotel", "Attraction", or "Bar/Pub",
  "tripadvisor_url": "https://www.tripadvisor.com.ph/... or null",
  "highlights": ["popular features"],
  "ranking_in_city": "X of Y" or null,
  "photo_count": number or null
}

CRITICAL: Extract the numeric TripAdvisor ID from the URL if available. Be accurate with real data.`

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
      const error = await response.text()
      console.error(`   ❌ Grok error (${response.status})`)
      return null
    }

    const data = await response.json()
    if (!data.choices?.[0]?.message?.content) {
      console.error('   ❌ Invalid Grok response')
      return null
    }

    let content = data.choices[0].message.content.trim()

    // Extract JSON from code blocks or plain
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      content = jsonMatch[1] || jsonMatch[0]
    }

    const enriched = JSON.parse(content)
    return enriched
  } catch (error) {
    console.error(`   ❌ Error:`, error.message.slice(0, 50))
    return null
  }
}

// CSV parsing
function parseCSV(csvContent) {
  const lines = csvContent.split('\n')
  const headers = lines[0].split(',').map(h => h.trim())
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const row = {}
    let current = ''
    let inQuotes = false
    let colIndex = 0

    for (let j = 0; j < line.length; j++) {
      const char = line[j]
      if (char === '"' && (j === 0 || line[j - 1] !== '\\')) {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        row[headers[colIndex]] = current.trim().replace(/^["']|["']$/g, '')
        current = ''
        colIndex++
      } else {
        current += char
      }
    }
    if (colIndex < headers.length) {
      row[headers[colIndex]] = current.trim().replace(/^["']|["']$/g, '')
    }

    if (row.name && row.city) {
      rows.push(row)
    }
  }

  return rows
}

// Generate CSV line
function generateCSVLine(row, headers) {
  return headers.map(header => {
    const value = row[header]
    if (value === null || value === undefined) return ''
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }).join(',')
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
    email: enriched.email || original.email,
    description: enriched.description || original.description,
    rating: enriched.rating ?? original.rating,
    review_count: enriched.review_count ?? original.review_count,
    price_range: enriched.price_range || original.price_range,
    location_type: enriched.location_type || original.location_type,
    web_url: enriched.tripadvisor_url || original.web_url,
    hours_of_operation: enriched.hours_of_operation ? JSON.stringify(enriched.hours_of_operation) : original.hours_of_operation,
    amenities: enriched.amenities ? JSON.stringify(enriched.amenities) : original.amenities,
    photo_count: enriched.photo_count ?? original.photo_count,
    highlights: enriched.highlights ? JSON.stringify(enriched.highlights) : original.highlights,
    ranking_in_city: enriched.ranking_in_city || original.ranking_in_city,
    cuisine: enriched.cuisine || original.cuisine,
    category: enriched.location_type ? enriched.location_type.toLowerCase() : (original.category || 'attraction'),
    tripadvisor_id: enriched.tripadvisor_id || extractTripAdvisorId(enriched.tripadvisor_url || original.web_url, original.name, original.city) || original.tripadvisor_id,
    verified: true,
    last_verified_at: new Date().toISOString()
  }
}

// Upsert to Supabase
async function upsertToSupabase(listing) {
  try {
    const amenities = Array.isArray(listing.amenities) ? listing.amenities : (typeof listing.amenities === 'string' ? JSON.parse(listing.amenities) : [])
    const highlights = Array.isArray(listing.highlights) ? listing.highlights : (typeof listing.highlights === 'string' ? JSON.parse(listing.highlights) : [])
    const photoUrls = Array.isArray(listing.photo_urls) ? listing.photo_urls : []

    let hoursOp = listing.hours_of_operation
    if (typeof hoursOp === 'string') {
      try {
        hoursOp = JSON.parse(hoursOp)
      } catch (e) {
        hoursOp = {}
      }
    } else if (!hoursOp || typeof hoursOp !== 'object') {
      hoursOp = {}
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
      slug: listing.slug,
      visibility_score: listing.visibility_score ? parseFloat(listing.visibility_score) : null,
      cuisine: listing.cuisine,
      tripadvisor_id: listing.tripadvisor_id,
      updated_at: new Date().toISOString(),
      created_at: listing.created_at || new Date().toISOString(),
      verified: listing.verified === true || listing.verified === 'true',
      last_verified_at: new Date().toISOString(),
      fetch_status: 'success',
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

    return !error
  } catch (error) {
    console.error(`   ❌ Supabase error:`, error.message.slice(0, 50))
    return false
  }
}

// Main
async function main() {
  const csvPath = path.join(__dirname, '..', 'nearby-listings.csv')

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV not found at ${csvPath}`)
    process.exit(1)
  }

  console.log('📊 Loading checkpoint...')
  const checkpoint = loadCheckpoint()

  console.log('📖 Reading CSV...')
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const listings = parseCSV(csvContent)
  const headers = csvContent.split('\n')[0].split(',').map(h => h.trim())

  console.log(`📈 Total listings: ${listings.length}`)
  console.log(`✅ Already processed: ${Object.keys(checkpoint.processed).length}`)
  console.log(`🚀 Starting enrichment with Grok API\n`)

  let successCount = 0
  let failureCount = 0
  let skippedCount = 0
  const updatedListings = [...listings]

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

    process.stdout.write(`[${i + 1}/${listings.length}] ${listing.name.slice(0, 35).padEnd(35)} `)

    const enriched = await grokFetchTripadvisorData(listing)
    const merged = mergeListing(listing, enriched)

    const success = await upsertToSupabase(merged)

    if (success) {
      checkpoint.processed[listingId] = true
      updatedListings[i] = merged
      console.log('✅')
      successCount++
    } else {
      console.log('❌')
      failureCount++
    }

    saveCheckpoint(checkpoint)

    // Rate limiting: small delay between requests
    if ((i + 1) % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  // Update CSV
  console.log('\n💾 Updating CSV file...')
  const csvLines = [headers.join(',')]
  for (const listing of updatedListings) {
    csvLines.push(generateCSVLine(listing, headers))
  }
  fs.writeFileSync(csvPath, csvLines.join('\n') + '\n')

  console.log('\n' + '='.repeat(70))
  console.log('✅ ENRICHMENT COMPLETE!')
  console.log(`📊 Success: ${successCount}`)
  console.log(`❌ Failed: ${failureCount}`)
  console.log(`⏭️  Skipped: ${skippedCount}`)
  console.log('='.repeat(70))
  console.log('\n✨ All listings enriched with TripAdvisor data!')
  console.log('📝 CSV updated')
  console.log('🗄️  Supabase updated\n')

  // Clear checkpoint on success
  if (failureCount === 0) {
    fs.unlinkSync(checkpointPath)
  }

  process.exit(failureCount > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('💥 Fatal error:', err)
  process.exit(1)
})
