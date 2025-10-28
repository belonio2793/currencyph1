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
  console.error('❌ Missing Supabase credentials. Set PROJECT_URL and SERVICE_ROLE_KEY')
  process.exit(1)
}

if (!X_API_KEY) {
  console.error('❌ Missing X_API_KEY for Grok API')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

// CSV parsing helper
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
      if (char === '"') {
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
    rows.push(row)
  }
  
  return rows
}

// Grok API call to enrich listing data
async function grokEnrichListing(listing) {
  const prompt = `You are a TripAdvisor data expert. For the listing "${listing.name}" in ${listing.city}, Philippines:
  
  Provide ONLY valid JSON (no markdown, no explanation) with these fields (use null for unknown):
  {
    "name": "exact business name",
    "address": "full street address",
    "phone_number": "contact phone with +63 country code",
    "website": "official website URL or null",
    "description": "2-3 sentence description of the business",
    "rating": rating as number (0-5),
    "review_count": estimated reviews as number,
    "price_range": "$", "$$", "$$$", or "$$$$",
    "hours_of_operation": "9:00 AM - 10:00 PM" or hours object,
    "amenities": ["amenity1", "amenity2"],
    "photos": ["photo_url1", "photo_url2"],
    "tripadvisor_url": "full TripAdvisor listing URL or null"
  }
  
  Be accurate and realistic. Return ONLY the JSON object, nothing else.`

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${X_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-2',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      }),
      timeout: 30000
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`❌ Grok API error (${response.status}):`, error.slice(0, 200))
      return null
    }

    const data = await response.json()
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('❌ Invalid Grok response structure')
      return null
    }

    let content = data.choices[0].message.content.trim()
    
    // Extract JSON if wrapped in markdown
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      content = jsonMatch[1].trim()
    }

    const enriched = JSON.parse(content)
    return enriched
  } catch (error) {
    console.error(`❌ Error enriching listing "${listing.name}":`, error.message)
    return null
  }
}

// Merge enriched data with existing listing
function mergeListing(original, enriched) {
  if (!enriched) return original

  return {
    ...original,
    name: enriched.name || original.name,
    address: enriched.address || original.address,
    phone_number: enriched.phone_number || original.phone_number,
    website: enriched.website || original.website,
    description: enriched.description || original.description,
    rating: enriched.rating !== null && enriched.rating !== undefined ? enriched.rating : original.rating,
    review_count: enriched.review_count !== null && enriched.review_count !== undefined ? enriched.review_count : original.review_count,
    price_range: enriched.price_range || original.price_range,
    hours_of_operation: enriched.hours_of_operation || original.hours_of_operation,
    amenities: enriched.amenities || original.amenities,
    web_url: enriched.tripadvisor_url || original.web_url,
    photo_urls: enriched.photos || original.photo_urls || []
  }
}

// Upsert to Supabase
async function upsertToSupabase(listing) {
  try {
    const preparedData = {
      id: listing.id || undefined,
      name: listing.name,
      address: listing.address,
      latitude: listing.latitude ? parseFloat(listing.latitude) : null,
      longitude: listing.longitude ? parseFloat(listing.longitude) : null,
      rating: listing.rating ? parseFloat(listing.rating) : null,
      category: listing.category,
      source: listing.source || 'tripadvisor',
      description: listing.description,
      phone_number: listing.phone_number,
      website: listing.website,
      hours_of_operation: listing.hours_of_operation,
      review_count: listing.review_count ? parseInt(listing.review_count) : null,
      web_url: listing.web_url,
      location_type: listing.location_type,
      price_range: listing.price_range,
      duration: listing.duration,
      traveler_type: listing.traveler_type,
      visibility_score: listing.visibility_score ? parseFloat(listing.visibility_score) : null,
      slug: listing.slug,
      amenities: listing.amenities,
      city: listing.city,
      country: 'Philippines',
      currency: 'PHP',
      timezone: 'Asia/Manila',
      photo_urls: listing.photo_urls || [],
      updated_at: new Date().toISOString(),
      created_at: listing.created_at || new Date().toISOString(),
      verified: true
    }

    // Remove undefined values
    Object.keys(preparedData).forEach(key => preparedData[key] === undefined && delete preparedData[key])

    const { data, error } = await supabase
      .from('nearby_listings')
      .upsert(preparedData, { onConflict: 'id' })
      .select()

    if (error) {
      console.error(`❌ Supabase error for "${listing.name}":`, error.message)
      return false
    }

    console.log(`✅ Upserted: ${listing.name} (${listing.city})`)
    return true
  } catch (error) {
    console.error(`❌ Error upserting listing:`, error.message)
    return false
  }
}

// Main processing function
async function main() {
  const csvPath = path.join(__dirname, '..', 'nearby-listings.csv')
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found at ${csvPath}`)
    console.log('💡 Please provide a CSV file with nearby_listings data')
    process.exit(1)
  }

  console.log('📖 Reading CSV file...')
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const listings = parseCSV(csvContent)

  console.log(`📊 Parsed ${listings.length} listings from CSV`)
  console.log('🚀 Starting enrichment with Grok API...\n')

  let successCount = 0
  let failureCount = 0
  const batchSize = 3
  const delayMs = 2000

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i]

    // Skip if critical fields missing
    if (!listing.name || !listing.city) {
      console.warn(`⚠️  Skipping: Missing name or city`)
      continue
    }

    console.log(`[${i + 1}/${listings.length}] Processing: ${listing.name} (${listing.city})`)

    // Enrich with Grok
    const enriched = await grokEnrichListing(listing)
    
    // Merge
    const merged = mergeListing(listing, enriched)

    // Upsert
    const success = await upsertToSupabase(merged)
    if (success) {
      successCount++
    } else {
      failureCount++
    }

    // Rate limiting
    if ((i + 1) % batchSize === 0) {
      console.log(`⏳ Rate limiting (${delayMs}ms)...`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log(`✅ Complete! Success: ${successCount}, Failures: ${failureCount}`)
  console.log(`📊 Total processed: ${successCount + failureCount}/${listings.length}`)
  console.log('='.repeat(50))

  process.exit(failureCount > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('💥 Fatal error:', err)
  process.exit(1)
})
