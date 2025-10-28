#!/usr/bin/env node
/*
quick-populate-costs.js

Fast script to populate avg_cost for the first batch of listings without costs
*/

import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

const CATEGORY_COSTS = {
  'restaurant': 800, 'cafe': 300, 'bar': 900, 'pub': 500, 'bistro': 700,
  'hotel': 5000, 'resort': 7500, 'inn': 2500, 'guest house': 1400,
  'museum': 400, 'gallery': 300, 'temple': 150, 'church': 50,
  'nature': 600, 'park': 300, 'beach': 200, 'waterfall': 350, 'island': 1200,
  'tour': 1800, 'activity': 1500, 'nightlife': 1200, 'shopping': 3000,
  'spa': 1200, 'massage': 900, 'sports': 1500, 'adventure': 3000,
  'scenic': 500, 'viewpoint': 250, 'monument': 250, 'historical': 400,
  'heritage': 400, 'ancient': 400, 'fort': 400, 'landmark': 400,
}

function getCost(listing) {
  const cat = (listing.category || '').toLowerCase()
  const loc = (listing.location_type || '').toLowerCase()
  const name = (listing.name || '').toLowerCase()
  const combined = `${cat} ${loc} ${name}`

  for (const [key, cost] of Object.entries(CATEGORY_COSTS)) {
    if (combined.includes(key)) return cost + Math.floor(Math.random() * 300 - 150)
  }
  return 1000
}

async function main() {
  const { data, error } = await supabase
    .from('nearby_listings')
    .select('id,name,category,location_type,avg_cost')
    .is('avg_cost', null)
    .limit(50)

  if (error) { console.error('Fetch error:', error); process.exit(1) }
  if (!data || data.length === 0) { console.log('✅ All listings have costs'); process.exit(0) }

  console.log(`Updating ${data.length} listings...`)
  let updated = 0

  for (const listing of data) {
    const cost = getCost(listing)
    const { error: err } = await supabase
      .from('nearby_listings')
      .update({ avg_cost: cost, updated_at: new Date().toISOString() })
      .eq('id', listing.id)

    if (!err) updated++
  }

  console.log(`✅ Updated ${updated}/${data.length} listings`)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
