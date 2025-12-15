import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://corcofbmafdxehvlbesx.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function markListingFeatured(listingName, isFeatured = true) {
  try {
    console.log(`Searching for listing: "${listingName}"...`)

    // Find the listing
    const { data: listings, error: findError } = await supabase
      .from('nearby_listings')
      .select('id, name, metadata')
      .ilike('name', `%${listingName}%`)

    if (findError) throw findError

    if (!listings || listings.length === 0) {
      console.error(`❌ Listing "${listingName}" not found`)
      return
    }

    if (listings.length > 1) {
      console.log(`Found ${listings.length} listings matching "${listingName}":`)
      listings.forEach((l, i) => {
        console.log(`  ${i + 1}. ${l.name} (ID: ${l.id})`)
      })
      console.log('Please run again with a more specific name.')
      return
    }

    const listing = listings[0]
    console.log(`Found listing: ${listing.name}`)

    // Update metadata
    const currentMetadata = listing.metadata || {}
    const updatedMetadata = {
      ...currentMetadata,
      featured: isFeatured
    }

    const { error: updateError } = await supabase
      .from('nearby_listings')
      .update({ metadata: updatedMetadata })
      .eq('id', listing.id)

    if (updateError) throw updateError

    console.log(`✓ Successfully marked "${listing.name}" as ${isFeatured ? 'featured' : 'not featured'}`)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

const listingName = process.argv[2] || 'The Ruins'
const isFeatured = process.argv[3] !== 'false'

markListingFeatured(listingName, isFeatured)
