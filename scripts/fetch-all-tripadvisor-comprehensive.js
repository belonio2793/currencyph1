#!/usr/bin/env node

import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
const X_API_KEY = process.env.X_API_KEY || process.env.GROK_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

if (!X_API_KEY) {
  console.error('❌ Missing X_API_KEY for Grok')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Philippine cities
const PHILIPPINE_CITIES = [
  'Manila', 'Cebu City', 'Davao City', 'Quezon City', 'Caloocan', 'Las Piñas', 'Makati', 'Pasig',
  'Taguig', 'Parañaque', 'Muntinlupa', 'Bacoor', 'Cavite City', 'Dasmariñas', 'Imus',
  'Boracay', 'Baguio', 'Bohol', 'Coron', 'El Nido', 'Palawan', 'Siargao', 'Valencia',
  'Iloilo City', 'Bacolod', 'Cagayan de Oro', 'Dumaguete', 'Lapu-Lapu', 'Mandaue',
  'Butuan', 'Calbayog', 'Catbalogan', 'Tacloban', 'Vigan', 'Dagupan', 'San Fernando',
  'Angeles City', 'Olongapo', 'Baliuag', 'Cabanatuan', 'Nueva Ecija',
  'Lucena', 'Tagaytay', 'Antipolo', 'Tanay', 'Rizal',
  'General Santos', 'Cotabato City', 'Koronadal', 'Zamboanga City', 'Dipolog',
  'Legazpi', 'Naga', 'Sorsogon', 'Masbate City'
]

const CATEGORIES = ['Hotels', 'Restaurants', 'Attractions']

let stats = {
  total: 0,
  created: 0,
  updated: 0,
  photosUpdated: 0,
  errors: 0,
  skipped: 0
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function grokFetchTripadvisor(city, category) {
  try {
    const prompt = `Find and list the top 20 ${category} in ${city}, Philippines from TripAdvisor (tripadvisor.com.ph). 
For each, provide:
1. Name
2. Full address
3. Rating (0-5)
4. Number of reviews
5. TripAdvisor URL (tripadvisor.com.ph link)
6. Brief description (1 sentence)

Format as JSON array with objects containing: name, address, rating, review_count, url, description, category`

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${X_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-2',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.warn(`⚠️  No JSON found in Grok response for ${city} - ${category}`)
      return []
    }

    return JSON.parse(jsonMatch[0])
  } catch (err) {
    console.error(`❌ Grok error for ${city} - ${category}:`, err.message)
    return []
  }
}

async function fetchTripadvisorPhotos(url) {
  try {
    if (!url) return []

    // Use a simple fetch with timeout
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    })

    if (!response.ok) return []

    const html = await response.text()

    // Extract photo URLs from TripAdvisor
    const photoUrls = []
    const patterns = [
      /https:\/\/media-cdn\.tripadvisor\.com\/media\/photo-[a-zA-Z]\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[^"\s<>]+\.jpg/gi,
      /https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo-[a-zA-Z]\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[^"\s<>]+\.jpg/gi
    ]

    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(html)) !== null) {
        const url = match[0]
        if (!photoUrls.includes(url) && photoUrls.length < 10) {
          photoUrls.push(url)
        }
      }
    }

    return photoUrls
  } catch (err) {
    console.warn(`⚠️  Error fetching photos from ${url}:`, err.message)
    return []
  }
}

async function processListing(listing, city) {
  try {
    // Check if listing already exists
    const { data: existing } = await supabase
      .from('nearby_listings')
      .select('id')
      .ilike('name', `%${listing.name}%`)
      .eq('city', city)
      .single()

    let photoUrls = []
    if (listing.url) {
      photoUrls = await fetchTripadvisorPhotos(listing.url)
      await sleep(500) // Rate limiting
    }

    const listingData = {
      name: listing.name,
      address: listing.address,
      city: city,
      country: 'Philippines',
      category: listing.category || 'Attraction',
      rating: listing.rating || 0,
      review_count: listing.review_count || 0,
      description: listing.description || '',
      tripadvisor_url: listing.url || null,
      photo_urls: photoUrls,
      photos: photoUrls,
      photo_count: photoUrls.length,
      is_featured: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    if (existing) {
      // Update existing listing
      const { error: updateError } = await supabase
        .from('nearby_listings')
        .update({
          ...listingData,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)

      if (updateError) {
        console.error(`❌ Error updating ${listing.name}:`, updateError)
        stats.errors++
        return
      }

      stats.updated++
      if (photoUrls.length > 0) {
        stats.photosUpdated++
      }
    } else {
      // Create new listing
      const { error: insertError } = await supabase
        .from('nearby_listings')
        .insert([listingData])

      if (insertError) {
        console.error(`❌ Error creating ${listing.name}:`, insertError)
        stats.errors++
        return
      }

      stats.created++
      if (photoUrls.length > 0) {
        stats.photosUpdated++
      }
    }
  } catch (err) {
    console.error(`❌ Error processing listing ${listing.name}:`, err.message)
    stats.errors++
  }
}

async function fetchCityListings(city) {
  console.log(`\n🏙️  Processing ${city}...`)

  for (const category of CATEGORIES) {
    console.log(`  📍 Fetching ${category}...`)

    const listings = await grokFetchTripadvisor(city, category)
    console.log(`  ✅ Found ${listings.length} ${category}`)

    for (const listing of listings) {
      stats.total++
      await processListing(listing, city)

      // Rate limiting
      await sleep(200)
    }

    // Delay between categories
    await sleep(2000)
  }
}

async function main() {
  try {
    console.log('🚀 Starting comprehensive TripAdvisor population...')
    console.log(`📊 Cities to process: ${PHILIPPINE_CITIES.length}`)
    console.log(`📁 Categories: ${CATEGORIES.join(', ')}\n`)

    const startTime = Date.now()

    // Process cities
    for (let i = 0; i < PHILIPPINE_CITIES.length; i++) {
      const city = PHILIPPINE_CITIES[i]
      console.log(`[${i + 1}/${PHILIPPINE_CITIES.length}]`)

      try {
        await fetchCityListings(city)
      } catch (err) {
        console.error(`❌ Fatal error processing ${city}:`, err)
      }

      // Save checkpoint every 5 cities
      if ((i + 1) % 5 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
        console.log(`⏱️  Checkpoint at ${i + 1}/${PHILIPPINE_CITIES.length} cities (${elapsed}m elapsed)`)
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1)

    console.log('\n📋 FINAL REPORT')
    console.log('═══════════════════════════════════')
    console.log(`Total listings processed: ${stats.total}`)
    console.log(`New listings created: ${stats.created}`)
    console.log(`Existing listings updated: ${stats.updated}`)
    console.log(`Listings with photos updated: ${stats.photosUpdated}`)
    console.log(`Errors: ${stats.errors}`)
    console.log(`Total time: ${totalTime} minutes`)

  } catch (err) {
    console.error('❌ Fatal error:', err)
    process.exit(1)
  }
}

main().then(() => {
  console.log('\n✅ All cities processed!')
  process.exit(0)
})
