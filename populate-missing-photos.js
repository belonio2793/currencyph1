import { createClient } from '@supabase/supabase-js'
import process from 'process'

const supabase = createClient(
  process.env.VITE_PROJECT_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

// Map categories to Unsplash image URLs for fallback
const categoryFallbacks = {
  'hotel': [
    'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80',
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
    'https://images.unsplash.com/photo-1551632786-de41ec297e58?w=800&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80'
  ],
  'restaurant': [
    'https://images.unsplash.com/photo-1517521918814-e6936ad7df91?w=800&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
    'https://images.unsplash.com/photo-1551632786-de41ec297e58?w=800&q=80'
  ],
  'attraction': [
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80',
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80',
    'https://images.unsplash.com/photo-1500522144775-86bbab846faf?w=800&q=80',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    'https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?w=800&q=80'
  ],
  'museum': [
    'https://images.unsplash.com/photo-1561034481-8f1bc6a64db5?w=800&q=80',
    'https://images.unsplash.com/photo-1552820728-8ac41f1ce891?w=800&q=80',
    'https://images.unsplash.com/photo-1563098261-ffa40c12ad7f?w=800&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80'
  ],
  'default': [
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    'https://images.unsplash.com/photo-1519167758481-83f19106048c?w=800&q=80',
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80',
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80',
    'https://images.unsplash.com/photo-1500522144775-86bbab846faf?w=800&q=80'
  ]
}

// Get fallback images for a category
function getFallbackImages(category) {
  if (!category) return categoryFallbacks.default

  const catLower = category.toLowerCase()
  
  if (catLower.includes('hotel') || catLower.includes('resort')) {
    return categoryFallbacks.hotel
  }
  if (catLower.includes('restaurant') || catLower.includes('cafe') || catLower.includes('bar')) {
    return categoryFallbacks.restaurant
  }
  if (catLower.includes('museum')) {
    return categoryFallbacks.museum
  }
  if (catLower.includes('attraction') || catLower.includes('park') || catLower.includes('garden') || catLower.includes('temple') || catLower.includes('monument')) {
    return categoryFallbacks.attraction
  }

  return categoryFallbacks.default
}

async function processListing(listing) {
  console.log(`\n[ID: ${listing.id}] ${listing.name}`)

  // Skip if already has photos
  if (listing.photo_urls && Array.isArray(listing.photo_urls) && listing.photo_urls.length > 0) {
    console.log(`  Skip: Already has ${listing.photo_urls.length} photos`)
    return { id: listing.id, status: 'skip' }
  }

  // Get fallback images for this category
  const fallbacks = getFallbackImages(listing.category)
  
  // Mix in some variety - use different images for different listings
  const photos = fallbacks.slice(listing.id % fallbacks.length, (listing.id % fallbacks.length) + 3)
  
  if (photos.length === 0) {
    console.log(`  No fallback images`)
    return { id: listing.id, status: 'no-images' }
  }

  // Update database
  try {
    const { error } = await supabase
      .from('nearby_listings')
      .update({
        photo_urls: photos,
        photo_count: photos.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', listing.id)

    if (error) throw error

    console.log(`  ✓ Updated with ${photos.length} fallback images`)
    return { id: listing.id, status: 'updated', count: photos.length }
  } catch (err) {
    console.log(`  ✗ DB Error: ${err.message}`)
    return { id: listing.id, status: 'db-error' }
  }
}

async function main() {
  console.log('=== Populating Missing Photos with Fallback Images ===\n')

  // Get all listings
  const { data: allListings, error: countErr } = await supabase
    .from('nearby_listings')
    .select('id, name, category')
    .order('id', { ascending: true })

  if (countErr) {
    console.error('Error fetching listings:', countErr)
    process.exit(1)
  }

  console.log(`Total listings: ${allListings.length}`)

  // Check which have photos
  const { data: withPhotos } = await supabase
    .from('nearby_listings')
    .select('id')
    .not('photo_urls', 'is', null)

  console.log(`Listings with photos: ${withPhotos?.length || 0}`)
  console.log(`Listings needing photos: ${allListings.length - (withPhotos?.length || 0)}`)

  // Get listings without photos
  const { data: withoutPhotos, error } = await supabase
    .from('nearby_listings')
    .select('id, name, category')
    .is('photo_urls', null)
    .order('id', { ascending: true })

  if (error) {
    console.error('Error fetching listings without photos:', error)
    process.exit(1)
  }

  console.log(`\nProcessing ${withoutPhotos.length} listings...\n`)

  let stats = { processed: 0, updated: 0, skipped: 0, failed: 0 }

  for (const listing of withoutPhotos) {
    const result = await processListing(listing)
    stats.processed++

    if (result.status === 'updated') stats.updated++
    else if (result.status === 'skip') stats.skipped++
    else if (result.status === 'no-images') stats.failed++

    // Small delay between updates
    await new Promise(r => setTimeout(r, 100))
  }

  console.log(`\n\n=== FINAL RESULTS ===`)
  console.log(`Total processed: ${stats.processed}`)
  console.log(`✓ Updated with fallback images: ${stats.updated}`)
  console.log(`⊘ Already had photos: ${stats.skipped}`)
  console.log(`✗ Failed: ${stats.failed}`)
  console.log(`Success rate: ${((stats.updated / stats.processed) * 100).toFixed(1)}%`)

  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
