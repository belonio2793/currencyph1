import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing credentials')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function verify() {
  console.log('🔍 Verifying actual database content...\n')

  // Get sample listings with all relevant fields
  const { data: samples } = await supabase
    .from('nearby_listings')
    .select('id, name, city, rating, review_count, phone_number, website, description, hours_of_operation, amenities, accessibility_info, photo_urls, primary_image_url, featured_image_url, cuisine, features, tags, admission_fee, tripadvisor_id, web_url, highlights, best_for, price_level')
    .limit(3)

  if (!samples || samples.length === 0) {
    console.log('No data found')
    return
  }

  samples.forEach((listing, idx) => {
    console.log(`\n📍 LISTING #${idx + 1}: ${listing.name} (${listing.city})`)
    console.log('   ─'.repeat(35))
    console.log(`   ID: ${listing.id}`)
    console.log(`   Rating: ${listing.rating} ⭐ | Reviews: ${listing.review_count}`)
    console.log(`   Phone: ${listing.phone_number || 'N/A'}`)
    console.log(`   Website: ${listing.website ? '✓' : 'N/A'}`)
    console.log(`   Description: ${listing.description ? listing.description.slice(0, 50) + '...' : 'N/A'}`)
    console.log(`   Hours: ${listing.hours_of_operation ? '✓' : 'N/A'}`)
    console.log(`   Amenities: ${Array.isArray(listing.amenities) && listing.amenities.length > 0 ? listing.amenities.length + ' items' : 'N/A'}`)
    console.log(`   Accessibility: ${listing.accessibility_info ? '✓' : 'N/A'}`)
    console.log(`   Photos: ${Array.isArray(listing.photo_urls) && listing.photo_urls.length > 0 ? listing.photo_urls.length : 0} URLs`)
    console.log(`   Primary Image: ${listing.primary_image_url ? '✓' : 'N/A'}`)
    console.log(`   Featured Image: ${listing.featured_image_url ? '✓' : 'N/A'}`)
    console.log(`   Cuisine: ${listing.cuisine || 'N/A'}`)
    console.log(`   Features: ${Array.isArray(listing.features) && listing.features.length > 0 ? listing.features.join(', ') : 'N/A'}`)
    console.log(`   Tags: ${Array.isArray(listing.tags) && listing.tags.length > 0 ? listing.tags.join(', ') : 'N/A'}`)
    console.log(`   Admission: ${listing.admission_fee || 'N/A'}`)
    console.log(`   TripAdvisor ID: ${listing.tripadvisor_id || 'N/A'}`)
    console.log(`   Web URL: ${listing.web_url ? '✓' : 'N/A'}`)
    console.log(`   Highlights: ${Array.isArray(listing.highlights) && listing.highlights.length > 0 ? listing.highlights.join(', ') : 'N/A'}`)
    console.log(`   Best For: ${listing.best_for ? '✓' : 'N/A'}`)
    console.log(`   Price Level: ${listing.price_level || 'N/A'}`)
  })

  console.log('\n✅ Sample data verified!\n')
}

verify().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
