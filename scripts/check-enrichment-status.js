import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function checkStatus() {
  console.log('📊 Checking enrichment status...\n')

  // Total listings
  const { data: allListings, error: countError } = await supabase
    .from('nearby_listings')
    .select('id', { count: 'exact' })

  const total = allListings?.length || 0
  console.log(`📈 Total listings: ${total}`)

  // Listings with verified data
  const { data: verified } = await supabase
    .from('nearby_listings')
    .select('id')
    .eq('verified', true)

  console.log(`✅ Verified: ${verified?.length || 0}/${total}`)

  // Listings with ratings
  const { data: withRating } = await supabase
    .from('nearby_listings')
    .select('id')
    .not('rating', 'is', null)

  console.log(`⭐ With ratings: ${withRating?.length || 0}/${total}`)

  // Listings with phone numbers
  const { data: withPhone } = await supabase
    .from('nearby_listings')
    .select('id')
    .not('phone_number', 'is', null)

  console.log(`☎️  With phone: ${withPhone?.length || 0}/${total}`)

  // Listings with websites
  const { data: withWebsite } = await supabase
    .from('nearby_listings')
    .select('id')
    .not('website', 'is', null)

  console.log(`🌐 With website: ${withWebsite?.length || 0}/${total}`)

  // Listings with descriptions
  const { data: withDesc } = await supabase
    .from('nearby_listings')
    .select('id')
    .not('description', 'is', null)

  console.log(`��� With description: ${withDesc?.length || 0}/${total}`)

  // Listings with amenities
  const { data: withAmenities } = await supabase
    .from('nearby_listings')
    .select('id')
    .not('amenities', 'is', null)

  console.log(`🏨 With amenities: ${withAmenities?.length || 0}/${total}`)

  // Sample listing
  console.log('\n📋 Sample listing:')
  const { data: samples } = await supabase
    .from('nearby_listings')
    .select('id, name, city, rating, review_count, phone_number, website, verified')
    .limit(1)

  if (samples && samples[0]) {
    const s = samples[0]
    console.log(`  ID: ${s.id}`)
    console.log(`  Name: ${s.name}`)
    console.log(`  City: ${s.city}`)
    console.log(`  Rating: ${s.rating || 'N/A'}`)
    console.log(`  Reviews: ${s.review_count || 'N/A'}`)
    console.log(`  Phone: ${s.phone_number || 'N/A'}`)
    console.log(`  Website: ${s.website || 'N/A'}`)
    console.log(`  Verified: ${s.verified}`)
  }

  console.log('\n')
  
  const completeness = Math.round((((verified?.length || 0) + (withRating?.length || 0) + (withPhone?.length || 0) + (withWebsite?.length || 0)) / (total * 4)) * 100)
  console.log(`📊 Completion: ~${completeness}%\n`)
}

checkStatus().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
