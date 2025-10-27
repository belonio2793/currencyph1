/**
 * Generate a URL-friendly slug from a string
 * @param {string} str - The string to convert to a slug
 * @returns {string} - URL-friendly slug
 */
export function generateSlug(str) {
  if (!str) return ''
  
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Generate unique slug by checking for duplicates and appending suffix
 * @param {Object} supabaseClient - Supabase client instance
 * @param {string} baseSlug - The base slug from the listing name
 * @param {string} tripadvisorId - The TripAdvisor ID for fallback uniqueness
 * @returns {Promise<string>} - A unique slug
 */
async function generateUniqueSlug(supabaseClient, baseSlug, tripadvisorId) {
  if (!baseSlug) {
    // Fallback: use tripadvisor_id if no name available
    return `listing-${tripadvisorId.slice(-8)}`.toLowerCase()
  }

  // First, try the base slug
  const { data: existing } = await supabaseClient
    .from('nearby_listings')
    .select('tripadvisor_id')
    .eq('slug', baseSlug)
    .limit(1)

  if (!existing || existing.length === 0) {
    return baseSlug
  }

  // If base slug exists, append tripadvisor_id suffix for uniqueness
  const idSuffix = tripadvisorId.slice(-6).toLowerCase()
  const uniqueSlug = `${baseSlug}-${idSuffix}`

  // Double-check this combination doesn't exist
  const { data: stillExists } = await supabaseClient
    .from('nearby_listings')
    .select('tripadvisor_id')
    .eq('slug', uniqueSlug)
    .neq('tripadvisor_id', tripadvisorId)
    .limit(1)

  if (stillExists && stillExists.length > 0) {
    // If still collision, use full ID hash
    return `${baseSlug}-${tripadvisorId}`.substring(0, 200)
  }

  return uniqueSlug
}

/**
 * Populate slugs for all nearby_listings that don't have them
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Promise<Object>} - Result with count of updated listings
 */
export async function populateSlugsForListings(supabaseClient) {
  try {
    // Get all listings without slugs
    const { data: listings, error: fetchError } = await supabaseClient
      .from('nearby_listings')
      .select('tripadvisor_id, name, slug')
      .or('slug.is.null,slug.eq.')

    if (fetchError) throw fetchError

    if (!listings || listings.length === 0) {
      return {
        success: true,
        updated: 0,
        message: 'No listings need slug updates',
      }
    }

    const listingsNeedingSlug = listings.filter(listing => !listing.slug)

    if (listingsNeedingSlug.length === 0) {
      return {
        success: true,
        updated: 0,
        message: 'All listings already have slugs',
      }
    }

    // Generate unique slugs for each listing
    const updates = []
    for (const listing of listingsNeedingSlug) {
      const baseSlug = generateSlug(listing.name)
      const uniqueSlug = await generateUniqueSlug(supabaseClient, baseSlug, listing.tripadvisor_id)
      updates.push({
        tripadvisor_id: listing.tripadvisor_id,
        slug: uniqueSlug,
      })
    }

    // Update listings in batches
    const batchSize = 100
    let totalUpdated = 0

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize)

      for (const update of batch) {
        const { error: updateError } = await supabaseClient
          .from('nearby_listings')
          .update({ slug: update.slug })
          .eq('tripadvisor_id', update.tripadvisor_id)

        if (updateError) {
          console.error(`Error updating slug for ${update.tripadvisor_id}:`, updateError?.message || JSON.stringify(updateError))
          continue
        }
        totalUpdated++
      }
    }

    return {
      success: true,
      updated: totalUpdated,
      message: `Successfully updated ${totalUpdated} listings with slugs`,
    }
  } catch (err) {
    console.error('Error populating slugs:', err)
    return {
      success: false,
      updated: 0,
      message: err.message,
    }
  }
}

/**
 * Get a listing by slug
 * @param {Object} supabaseClient - Supabase client instance
 * @param {string} slug - The slug to search for
 * @returns {Promise<Object|null>} - The listing or null if not found
 */
export async function getListingBySlug(supabaseClient, slug) {
  try {
    const { data, error } = await supabaseClient
      .from('nearby_listings')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error) {
      console.warn('Listing not found:', error.message)
      return null
    }

    return data
  } catch (err) {
    console.error('Error fetching listing by slug:', err)
    return null
  }
}
