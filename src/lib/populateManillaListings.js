import { supabase } from './supabaseClient'
import { MANILA_LISTINGS } from '../data/manila-listings'
import { generateSlug } from './slugUtils'

export async function populateManilaListings() {
  try {
    const listingsToInsert = MANILA_LISTINGS.map((listing) => {
      // Use listing images or fall back to main image
      const images = listing.images && listing.images.length > 0
        ? listing.images
        : [listing.image]

      return {
        tripadvisor_id: listing.id,
        name: listing.name,
        address: listing.address,
        latitude: listing.latitude,
        longitude: listing.longitude,
        rating: listing.rating,
        category: listing.category,
        slug: listing.slug || generateSlug(listing.name),
        raw: {
          slug: listing.slug,
          description: listing.description,
          image: listing.image,
          images: images,
          highlights: listing.highlights,
          bestFor: listing.bestFor,
          hours: listing.hours,
          admission: listing.admission,
          website: listing.website,
          phone: listing.phone,
          reviews: listing.reviews,
          reviewCount: listing.reviewCount,
        },
        updated_at: new Date().toISOString(),
      }
    })

    // Use upsert to avoid duplicates
    const { data, error } = await supabase
      .from('nearby_listings')
      .upsert(listingsToInsert, { onConflict: 'tripadvisor_id' })
      .select()

    if (error) {
      console.error('Error populating Manila listings:', error)
      return {
        success: false,
        message: error.message,
        inserted: 0,
      }
    }

    console.log('Manila listings populated successfully:', data)
    return {
      success: true,
      message: `Successfully populated ${data?.length || 0} Manila listings`,
      inserted: data?.length || 0,
    }
  } catch (err) {
    console.error('Failed to populate Manila listings:', err)
    return {
      success: false,
      message: err.message,
      inserted: 0,
    }
  }
}

export async function checkAndPopulateManilaListings() {
  try {
    // Check if any Manila listings already exist
    const { data, error: checkError } = await supabase
      .from('nearby_listings')
      .select('tripadvisor_id')
      .ilike('address', '%Manila%')
      .limit(1)

    if (checkError) {
      console.warn('Error checking for existing Manila listings:', checkError.message)
      return { alreadyPopulated: false, message: 'Could not check existing listings' }
    }

    if (data && data.length > 0) {
      console.log('Manila listings already populated')
      return { alreadyPopulated: true, message: 'Manila listings already exist in database' }
    }

    // If no Manila listings found, populate them
    const result = await populateManilaListings()
    return { alreadyPopulated: false, ...result }
  } catch (err) {
    console.error('Error in checkAndPopulateManilaListings:', err)
    return {
      alreadyPopulated: false,
      success: false,
      message: err.message,
    }
  }
}
