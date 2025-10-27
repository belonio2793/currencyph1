import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

const supabase = createClient(PROJECT_URL, ANON_KEY)

async function checkImages() {
  try {
    console.log('📊 Checking image URLs in database...\n')

    // Get sample listings with images
    const { data: listings } = await supabase
      .from('nearby_listings')
      .select('id, name, city, image_url, stored_image_path')
      .not('image_url', 'is', null)
      .limit(10)

    if (!listings || listings.length === 0) {
      console.log('No listings found with images')
      return
    }

    console.log(`Found ${listings.length} listings:\n`)

    listings.forEach((listing, i) => {
      console.log(`${i + 1}. ${listing.name} (${listing.city})`)
      console.log(`   image_url: ${listing.image_url?.substring(0, 100)}...`)
      console.log(`   stored_image_path: ${listing.stored_image_path}`)
      console.log()
    })

    // Check image URL types
    const { data: allListings } = await supabase
      .from('nearby_listings')
      .select('image_url')
      .not('image_url', 'is', null)

    if (allListings) {
      const tripadvisor = allListings.filter(l => l.image_url?.includes('tripadvisor')).length
      const placeholder = allListings.filter(l => l.image_url?.includes('placeholder')).length
      const other = allListings.length - tripadvisor - placeholder

      console.log(`\n📈 Image URL breakdown (${allListings.length} total):`)
      console.log(`   TripAdvisor URLs: ${tripadvisor}`)
      console.log(`   Placeholder URLs: ${placeholder}`)
      console.log(`   Other sources: ${other}`)
    }

  } catch (err) {
    console.error('Error:', err)
  }
}

checkImages()
