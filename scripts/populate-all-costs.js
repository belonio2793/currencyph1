#!/usr/bin/env node
/*
populate-all-costs.js

Quickly populates avg_cost for all listings with fallback estimates
Much faster than grok-avg-costs.js since it primarily uses fallback costs
*/

import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase PROJECT_URL or SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

// Fallback cost estimates by category (in PHP)
const FALLBACK_COSTS = {
  'restaurant': { min: 400, max: 1200, avg: 800 },
  'cafe': { min: 150, max: 500, avg: 300 },
  'bar': { min: 300, max: 1500, avg: 900 },
  'pub': { min: 200, max: 800, avg: 500 },
  'bistro': { min: 400, max: 1000, avg: 700 },
  'hotel': { min: 2000, max: 8000, avg: 5000 },
  'resort': { min: 3000, max: 12000, avg: 7500 },
  'inn': { min: 1500, max: 4000, avg: 2500 },
  'guest house': { min: 800, max: 2000, avg: 1400 },
  'museum': { min: 200, max: 800, avg: 400 },
  'gallery': { min: 100, max: 500, avg: 300 },
  'temple': { min: 50, max: 300, avg: 150 },
  'church': { min: 0, max: 200, avg: 50 },
  'mosque': { min: 0, max: 100, avg: 25 },
  'nature': { min: 200, max: 1000, avg: 600 },
  'park': { min: 100, max: 500, avg: 300 },
  'beach': { min: 0, max: 500, avg: 200 },
  'waterfall': { min: 100, max: 600, avg: 350 },
  'island': { min: 500, max: 2000, avg: 1200 },
  'garden': { min: 150, max: 600, avg: 350 },
  'tour': { min: 800, max: 3000, avg: 1800 },
  'activity': { min: 500, max: 2500, avg: 1500 },
  'nightlife': { min: 300, max: 2000, avg: 1200 },
  'shopping': { min: 500, max: 10000, avg: 3000 },
  'mall': { min: 500, max: 10000, avg: 3000 },
  'market': { min: 200, max: 2000, avg: 800 },
  'spa': { min: 500, max: 2000, avg: 1200 },
  'massage': { min: 300, max: 1500, avg: 900 },
  'salon': { min: 200, max: 1000, avg: 600 },
  'sports': { min: 500, max: 3000, avg: 1500 },
  'adventure': { min: 1000, max: 5000, avg: 3000 },
  'scenic': { min: 200, max: 1000, avg: 500 },
  'viewpoint': { min: 100, max: 500, avg: 250 },
  'monument': { min: 100, max: 500, avg: 250 },
  'historical': { min: 200, max: 800, avg: 400 },
  'heritage': { min: 200, max: 800, avg: 400 },
  'ancient': { min: 200, max: 800, avg: 400 },
  'archaeological': { min: 200, max: 800, avg: 400 },
  'fort': { min: 200, max: 800, avg: 400 },
}

function getFallbackCost(listing) {
  const category = (listing.category || '').toLowerCase()
  const locationType = (listing.location_type || '').toLowerCase()
  const name = (listing.name || '').toLowerCase()
  const combined = `${category} ${locationType} ${name}`

  // Try to find matching category
  for (const [key, values] of Object.entries(FALLBACK_COSTS)) {
    if (combined.includes(key)) {
      const variation = Math.floor(Math.random() * (values.max - values.min)) + values.min
      return variation
    }
  }

  // Default estimate for unclassified
  return 1000
}

async function populateAllCosts() {
  console.log('📊 Starting cost population for all listings...\n')

  let offset = 0
  const batchSize = 500
  let totalProcessed = 0
  let totalUpdated = 0

  // Get total count
  const { count: totalCount } = await supabase
    .from('nearby_listings')
    .select('id', { count: 'exact', head: true })

  console.log(`Total listings in database: ${totalCount}\n`)

  while (offset < totalCount) {
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('id,name,category,location_type,avg_cost')
      .range(offset, offset + batchSize - 1)

    if (error) {
      console.error('❌ Error fetching listings:', error)
      break
    }

    if (!listings || listings.length === 0) break

    console.log(`Processing listings ${offset} - ${offset + listings.length}...`)

    let batchUpdated = 0

    for (const listing of listings) {
      if (listing.avg_cost) {
        // Already has cost, skip
        continue
      }

      const cost = getFallbackCost(listing)

      const { error: updateError } = await supabase
        .from('nearby_listings')
        .update({
          avg_cost: cost,
          updated_at: new Date().toISOString(),
        })
        .eq('id', listing.id)

      if (updateError) {
        console.error(`  ❌ Failed to update ${listing.id}:`, updateError.message)
      } else {
        batchUpdated++
        totalUpdated++
      }
    }

    totalProcessed += listings.length
    console.log(`  ✓ Updated ${batchUpdated}/${listings.length} listings in this batch\n`)

    offset += batchSize
  }

  console.log('\n✅ Population complete!')
  console.log(`   Processed: ${totalProcessed} listings`)
  console.log(`   Updated: ${totalUpdated} listings`)
  console.log(`   Remaining: ${totalCount - totalUpdated} listings (already had costs)`)
}

populateAllCosts().catch((err) => {
  console.error('💥 Fatal error:', err)
  process.exit(1)
})
