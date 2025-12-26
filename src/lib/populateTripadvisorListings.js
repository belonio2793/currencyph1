import { supabase } from './supabaseClient'

// Comprehensive list of Philippine cities and municipalities
const PHILIPPINES_CITIES = [
  // Metro Manila
  'Manila', 'Quezon City', 'Makati', 'Pasig', 'Taguig', 'Caloocan', 'Las Piñas', 'Parañaque', 'Marikina', 'Mandaluyong', 'San Juan', 'Malabon', 'Navotas', 'Valenzuela',
  // NCR nearby
  'Antipolo', 'Cainta', 'Tanay', 'Paete', 'Angono', 'Rizal', 'Montalban', 'Norzagaray', 'Bulakan', 'Malolos', 'San Fernando', 'Plaridel', 'Meycauayan', 'Obando', 'Hagonoy', 'Calumpit', 'Apalit', 'San Luis', 'Guagua', 'Porac', 'Floridablanca', 'Dinalupihan', 'Masinloc', 'Palauig', 'Iba', 'Subic', 'Olongapo', 'Limay', 'Hermosa', 'Abucay', 'Samal', 'Orion', 'Balanga', 'Orani', 'Pilar', 'Nataasan',
  // Tagalog Region
  'Baguio', 'Tagaytay', 'Cabanatuan', 'Muñoz', 'Gapan', 'Talugtug', 'Pantabangan', 'Santo Domingo', 'Lipa', 'Nasugbu', 'Calatagan', 'Mataas na Kahoy', 'Tanauan', 'Sariaya', 'Lucena', 'Tayabas', 'Quezon', 'Candelaria', 'Silian', 'Mulanay', 'Macalelon', 'Real', 'Infanta', 'Baler', 'Casiguran', 'Dingalan',
  // Visayas
  'Cebu', 'Iloilo', 'Bacolod', 'Boracay', 'Aklan', 'Kalibo', 'Capiz', 'Roxas', 'Antique', 'San Jose de Buenavista', 'Guimaras', 'Jordan', 'Negros Oriental', 'Dumaguete', 'Siquijor', 'Tagbilaran', 'Bohol',
  // Mindanao
  'Davao', 'Cagayan de Oro', 'Zamboanga', 'Butuan', 'Cotabato', 'General Santos', 'Iligan', 'Marawi', 'Kota Kinabalu', 'Surigao', 'Tandag', 'Bislig', 'Butuan', 'Agusan', 'Dinatuan', 'Lianga', 'Carrascal',
  // Palawan
  'Puerto Princesa', 'El Nido', 'Coron', 'Busuanga', 'Linapacan', 'Araceli', 'Dumaran', 'Culion', 'Balabac', 'Calamian'
]

// TripAdvisor API categories to search
const SEARCH_CATEGORIES = [
  'attractions',
  'things to do',
  'museums',
  'historical sites',
  'parks',
  'beaches',
  'hotels',
  'restaurants',
  'churches'
]

// Note: No hardcoded mock data - all data must come from TripAdvisor API only

/**
 * Fetch listings from TripAdvisor API or use mock data
 */
async function fetchTripAdvisorListings(query, limit = 20) {
  try {
    const apiKey = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_TRIPADVISOR) || (typeof process !== 'undefined' && process.env && process.env.VITE_TRIPADVISOR)

    if (!apiKey) {
      console.warn('TripAdvisor API key not available, using enhanced mock data')
      return []
    }

    const params = new URLSearchParams()
    params.append('query', query)
    params.append('limit', String(limit))

    const response = await fetch(
      `https://api.tripadvisor.com/api/partner/2.0/search?${params.toString()}`,
      {
        headers: {
          'X-TripAdvisor-API-Key': apiKey,
          'Accept': 'application/json'
        },
        timeout: 10000
      }
    )

    if (!response.ok) {
      return []
    }

    const data = await response.json()
    const items = data.data || []

    return items.map(item => ({
      tripadvisor_id: item.location_id ? String(item.location_id) : `php_${Math.random().toString(36).slice(2,10)}`,
      name: item.name,
      address: item.address || '',
      latitude: item.latitude || item.address_obj?.latitude || null,
      longitude: item.longitude || item.address_obj?.longitude || null,
      rating: item.rating ? Number(item.rating) : 4.0,
      category: item.subcategory || item.category?.name || 'Attraction',
      reviewCount: item.review_count || 0,
      raw: item
    }))
  } catch (err) {
    console.error('TripAdvisor API error:', err.message)
    return []
  }
}


/**
 * Main population function
 */
export async function populateTripadvisorListings(onProgress = null) {
  try {
    const allListings = new Map() // Use Map to avoid duplicates
    let processedCount = 0
    const totalCities = PHILIPPINES_CITIES.length
    const totalCategories = SEARCH_CATEGORIES.length
    const totalOperations = totalCities * totalCategories

    console.log(`Starting population of ${totalOperations} city-category combinations`)

    for (let cityIdx = 0; cityIdx < totalCities; cityIdx++) {
      const city = PHILIPPINES_CITIES[cityIdx]

      for (let catIdx = 0; catIdx < totalCategories; catIdx++) {
        const category = SEARCH_CATEGORIES[catIdx]
        processedCount++

        // Progress callback
        if (onProgress) {
          onProgress({
            current: processedCount,
            total: totalOperations,
            message: `Fetching ${category} in ${city}...`
          })
        }

        try {
          // Fetch from TripAdvisor API only
          const searchQuery = `${category} in ${city} Philippines`
          const listings = await fetchTripAdvisorListings(searchQuery, 10)

          // Skip if API returns no results (no mock data fallback)

          // Add to map (key is tripadvisor_id to avoid duplicates)
          for (const listing of listings) {
            allListings.set(listing.tripadvisor_id, {
              ...listing,
              updated_at: new Date().toISOString()
            })
          }

          // Rate limiting - be nice to the API
          await new Promise(resolve => setTimeout(resolve, 300))
        } catch (err) {
          console.error(`Error processing ${category} in ${city}:`, err.message)
          // Continue with next category
        }
      }
    }

    const listingsToInsert = Array.from(allListings.values())
    console.log(`Total unique listings to insert: ${listingsToInsert.length}`)

    if (listingsToInsert.length === 0) {
      return {
        success: false,
        message: 'No listings were collected',
        totalFetched: 0,
        uniqueSaved: 0,
        inserted: 0
      }
    }

    // Insert in batches
    const batchSize = 50
    let totalInserted = 0

    for (let i = 0; i < listingsToInsert.length; i += batchSize) {
      const batch = listingsToInsert.slice(i, i + batchSize)

      if (onProgress) {
        onProgress({
          current: totalOperations + (i / batchSize),
          total: totalOperations + (listingsToInsert.length / batchSize),
          message: `Saving batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(listingsToInsert.length / batchSize)}...`
        })
      }

      const { data, error } = await supabase
        .from('nearby_listings')
        .upsert(batch, { onConflict: 'tripadvisor_id' })
        .select('id')

      if (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error)
        return {
          success: false,
          message: `Error saving batch: ${error.message}`,
          totalFetched: listingsToInsert.length,
          inserted: totalInserted
        }
      }

      totalInserted += data?.length || 0

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    return {
      success: true,
      message: `Successfully populated ${totalInserted} unique listings from ${totalCities} Philippine cities across ${totalCategories} categories`,
      totalFetched: listingsToInsert.length,
      uniqueSaved: totalInserted,
      inserted: totalInserted
    }
  } catch (err) {
    console.error('Failed to populate TripAdvisor listings:', err)
    return {
      success: false,
      message: err.message,
      totalFetched: 0,
      inserted: 0
    }
  }
}
