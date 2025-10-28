import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing credentials')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function verifyEnrichment() {
  console.log('🔍 Verifying enrichment status...\n')

  // Get total listings with proper count
  const { count: totalListings, error: countError } = await supabase
    .from('nearby_listings')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.error('❌ Error:', countError)
    process.exit(1)
  }

  console.log(`📊 Total listings in database: ${totalListings}`)

  // Get enriched listings (have tripadvisor_id)
  const { data: enrichedIds } = await supabase
    .from('nearby_listings')
    .select('id, tripadvisor_id')
    .not('tripadvisor_id', 'is', null)

  const enrichedCount = enrichedIds?.length || 0
  console.log(`✅ Listings with tripadvisor_id: ${enrichedCount}`)

  // Get ratings filled
  const { data: ratedListings } = await supabase
    .from('nearby_listings')
    .select('id')
    .not('rating', 'is', null)

  const ratedCount = ratedListings?.length || 0
  console.log(`⭐ Listings with ratings: ${ratedCount}`)

  // Get descriptions filled
  const { data: describedListings } = await supabase
    .from('nearby_listings')
    .select('id')
    .not('description', 'is', null)

  const describedCount = describedListings?.length || 0
  console.log(`📝 Listings with descriptions: ${describedCount}`)

  // Get phone numbers
  const { data: phonedListings } = await supabase
    .from('nearby_listings')
    .select('id')
    .not('phone_number', 'is', null)

  const phonedCount = phonedListings?.length || 0
  console.log(`📞 Listings with phone numbers: ${phonedCount}`)

  // Get websites
  const { data: webListings } = await supabase
    .from('nearby_listings')
    .select('id')
    .not('website', 'is', null)

  const webCount = webListings?.length || 0
  console.log(`🌐 Listings with websites: ${webCount}`)

  // Get reviews
  const { data: reviewedListings } = await supabase
    .from('nearby_listings')
    .select('id')
    .not('review_count', 'is', null)

  const reviewedCount = reviewedListings?.length || 0
  console.log(`💬 Listings with review counts: ${reviewedCount}`)

  // Sample verified listings
  console.log('\n📋 Sample enriched listings:\n')
  const { data: samples } = await supabase
    .from('nearby_listings')
    .select('id, name, city, tripadvisor_id, rating, review_count, phone_number, verified')
    .not('tripadvisor_id', 'is', null)
    .limit(10)

  if (samples && samples.length > 0) {
    samples.forEach((listing, i) => {
      console.log(`${i + 1}. ${listing.name} (${listing.city})`)
      console.log(`   ID: ${listing.tripadvisor_id || 'null'}`)
      console.log(`   Rating: ${listing.rating || 'null'} ⭐`)
      console.log(`   Reviews: ${listing.review_count || 'null'}`)
      console.log(`   Phone: ${listing.phone_number || 'null'}`)
      console.log(`   Verified: ${listing.verified ? '✅' : '❌'}`)
      console.log()
    })
  }

  // Calculate completion percentage
  const completionPercent = totalListings > 0 ? ((enrichedCount / totalListings) * 100).toFixed(1) : 0
  
  console.log('\n' + '='.repeat(70))
  console.log(`📈 Enrichment Progress: ${completionPercent}% (${enrichedCount}/${totalListings})`)
  console.log('='.repeat(70))

  if (completionPercent >= 95) {
    console.log('✨ Enrichment nearly complete!')
  } else if (completionPercent >= 50) {
    console.log(`⚠️  ${totalListings - enrichedCount} listings still need enrichment`)
  } else {
    console.log(`⚠️  ${totalListings - enrichedCount} listings still need enrichment`)
  }

  process.exit(0)
}

verifyEnrichment().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
