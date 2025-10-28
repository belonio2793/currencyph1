#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const TRIPADVISOR_KEY = process.env.VITE_TRIPADVISOR_API_KEY || process.env.TRIPADVISOR_API_KEY

if (!TRIPADVISOR_KEY) {
  console.error('❌ Missing TRIPADVISOR_API_KEY')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)
const BATCH_SIZE = 20
const CONCURRENT_REQUESTS = 2

/**
 * Search TripAdvisor API for a listing
 */
async function searchTripAdvisor(name, city) {
  try {
    const searchQuery = `${name} ${city}`
    const response = await fetch(
      `https://api.content.tripadvisor.com/v2/location/search?query=${encodeURIComponent(searchQuery)}&key=${TRIPADVISOR_KEY}`,
      { signal: AbortSignal.timeout(8000) }
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      const result = data.data[0]
      return {
        location_id: result.location_id,
        name: result.name,
        address: result.address_obj?.address_string || null,
      }
    }
    return null
  } catch (err) {
    return null
  }
}

/**
 * Process a single listing
 */
async function processListing(listing) {
  if (!listing.name || !listing.city) {
    return { success: false, reason: 'missing_data' }
  }

  const found = await searchTripAdvisor(listing.name, listing.city)

  if (!found) {
    return { success: false, reason: 'not_found' }
  }

  try {
    const newTripadvisorId = String(found.location_id)
    
    // Only update if it's different from current (and current is synthetic)
    if (listing.tripadvisor_id?.startsWith('php_')) {
      const { error } = await supabase
        .from('nearby_listings')
        .update({
          tripadvisor_id: newTripadvisorId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', listing.id)

      if (error) {
        console.log(`✗ ${listing.name} (DB error)`)
        return { success: false, reason: 'db_error' }
      }

      console.log(`✓ ${listing.name} → ${newTripadvisorId}`)
      return { success: true, reason: 'updated', old_id: listing.tripadvisor_id, new_id: newTripadvisorId }
    } else {
      console.log(`⊘ ${listing.name} (already has real ID)`)
      return { success: false, reason: 'already_real' }
    }
  } catch (err) {
    console.log(`✗ ${listing.name}`)
    return { success: false, reason: 'error' }
  }
}

/**
 * Process listings concurrently
 */
async function processBatch(listings) {
  const results = []
  for (let i = 0; i < listings.length; i += CONCURRENT_REQUESTS) {
    const chunk = listings.slice(i, i + CONCURRENT_REQUESTS)
    const chunkResults = await Promise.all(chunk.map(processListing))
    results.push(...chunkResults)
    await new Promise(r => setTimeout(r, 300))
  }
  return results
}

/**
 * Main
 */
async function main() {
  console.log('🔍 Mapping real TripAdvisor location IDs to listings...\n')

  try {
    // Get listings and filter non-numeric tripadvisor_id (synthetic or missing)
    console.log('📋 Fetching listings...')
    const { data, error } = await supabase
      .from('nearby_listings')
      .select('id, tripadvisor_id, name, city')
      .order('rating', { ascending: false, nullsLast: true })

    if (error) {
      console.error('❌ Error:', error)
      process.exit(1)
    }

    const listings = (data || []).filter(l => l.tripadvisor_id && !/^\d+$/.test(String(l.tripadvisor_id)))

    console.log(`✓ Found ${listings.length} listings with non-numeric (synthetic) tripadvisor_id\n`)

    if (listings.length === 0) {
      console.log('✓ All listings already have real numeric TripAdvisor IDs!')
      process.exit(0)
    }

    let processed = 0
    let updated = 0

    for (let i = 0; i < listings.length; i += BATCH_SIZE) {
      const batch = listings.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(listings.length / BATCH_SIZE)
      
      console.log(`📦 Batch ${batchNum}/${totalBatches}`)
      console.log(`Processing ${batch.length} listings...\n`)

      const results = await processBatch(batch)
      const successes = results.filter(r => r.success).length
      updated += successes
      processed += batch.length

      const percentage = Math.round((processed / listings.length) * 100)
      console.log(`Progress: ${processed}/${listings.length} (${percentage}%)\n`)

      if (i + BATCH_SIZE < listings.length) {
        console.log('⏳ Rate limiting (1s)...\n')
        await new Promise(r => setTimeout(r, 1000))
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('🎉 Complete!')
    console.log(`   Total processed: ${processed}`)
    console.log(`   Updated with real IDs: ${updated}`)
    console.log(`   Success rate: ${Math.round((updated / processed) * 100)}%`)
    console.log('='.repeat(60))

    process.exit(0)
  } catch (err) {
    console.error('❌ Error:', err)
    process.exit(1)
  }
}

main()
