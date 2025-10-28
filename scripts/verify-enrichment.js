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
  const { count: enrichedCount, error: enrichError } = await supabase
    .from('nearby_listings')
    .select('*', { count: 'exact', head: true })
    .not('tripadvisor_id', 'is', null)

  console.log(`✅ Listings with tripadvisor_id: ${enrichedCount || 0}`)

  // Get ratings filled
  const { count: ratedCount } = await supabase
    .from('nearby_listings')
    .select('*', { count: 'exact', head: true })
    .not('rating', 'is', null)

  console.log(`⭐ Listings with ratings: ${ratedCount || 0}`)

  // Get descriptions filled
  const { count: describedCount } = await supabase
    .from('nearby_listings')
    .select('*', { count: 'exact', head: true })
    .not('description', 'is', null)

  console.log(`📝 Listings with descriptions: ${describedCount || 0}`)

  // Get phone numbers
  const { count: phonedCount } = await supabase
    .from('nearby_listings')
    .select('*', { count: 'exact', head: true })
    .not('phone_number', 'is', null)

  console.log(`📞 Listings with phone numbers: ${phonedCount || 0}`)

  // Get websites
  const { count: webCount } = await supabase
    .from('nearby_listings')
    .select('*', { count: 'exact', head: true })
    .not('website', 'is', null)

  console.log(`🌐 Listings with websites: ${webCount || 0}`)

  // Get reviews
  const { count: reviewedCount } = await supabase
    .from('nearby_listings')
    .select('*', { count: 'exact', head: true })
    .not('review_count', 'is', null)

  console.log(`💬 Listings with review counts: ${reviewedCount || 0}`)

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
