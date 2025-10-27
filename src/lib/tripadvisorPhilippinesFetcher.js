import { supabase } from './supabaseClient'

const TRIPADVISOR_KEY = import.meta.env.VITE_TRIPADVISOR || process.env.VITE_TRIPADVISOR

/**
 * TripAdvisor Philippines Fetcher
 * Fetches missing listings from TripAdvisor API and website
 */

export const tripadvisorPhilippinesFetcher = {
  /**
   * Get listings that are missing images or complete data
   */
  async getMissingListings(limit = 100) {
    try {
      const { data } = await supabase
        .from('nearby_listings')
        .select('*')
        .or('image.is.null,review_count.is.null,category.is.null')
        .limit(limit)

      return data || []
    } catch (err) {
      console.error('Error getting missing listings:', err)
      return []
    }
  },

  /**
   * Fetch listings for a city from TripAdvisor
   */
  async fetchListingsForCity(city, limit = 20) {
    if (!TRIPADVISOR_KEY) {
      console.warn('TripAdvisor API key not available')
      return []
    }

    try {
      const params = new URLSearchParams()
      params.append('query', `${city} Philippines`)
      params.append('limit', String(Math.min(limit, 30)))

      const response = await fetch(
        `https://api.tripadvisor.com/api/partner/2.0/locations/search?${params.toString()}`,
        {
          headers: {
            'X-TripAdvisor-API-Key': TRIPADVISOR_KEY,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      )

      if (!response.ok) {
        console.warn(`TripAdvisor API error: ${response.status}`)
        return []
      }

      const data = await response.json()
      const items = data.data || []

      return items
        .filter(item => item.name && item.location_id)
        .map(item => ({
          tripadvisor_id: String(item.location_id),
          name: item.name,
          address: item.address || item.address_string || null,
          latitude: item.latitude || item.address_obj?.latitude || null,
          longitude: item.longitude || item.address_obj?.longitude || null,
          rating: item.rating ? Number(item.rating) : null,
          review_count: item.review_count || 0,
          category: item.subcategory || item.category?.name || null,
          image: item.photo?.images?.original?.url || null,
          raw: item
        }))
    } catch (err) {
      console.error(`Error fetching listings for ${city}:`, err.message)
      return []
    }
  },

  /**
   * Fetch and save listings for multiple cities
   */
  async fetchAndSaveListings(cities, onProgress = null) {
    const allListings = []
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < cities.length; i++) {
      const city = cities[i]

      try {
        const listings = await this.fetchListingsForCity(city, 20)

        if (listings.length > 0) {
          allListings.push(...listings)
          successCount++

          if (onProgress) {
            onProgress({
              current: i + 1,
              total: cities.length,
              city,
              found: listings.length,
              totalCollected: allListings.length
            })
          }
        }

        // Rate limiting
        await new Promise(r => setTimeout(r, 300))
      } catch (err) {
        console.error(`Error with ${city}:`, err.message)
        errorCount++

        if (onProgress) {
          onProgress({
            current: i + 1,
            total: cities.length,
            city,
            error: true
          })
        }
      }
    }

    // Deduplicate by ID
    const deduped = {}
    for (const listing of allListings) {
      deduped[listing.tripadvisor_id] = listing
    }

    const unique = Object.values(deduped)

    // Save to database
    if (unique.length > 0) {
      await this.saveBatch(unique)
    }

    return {
      total: unique.length,
      successCount,
      errorCount
    }
  },

  /**
   * Save a batch of listings to database
   */
  async saveBatch(listings) {
    const chunkSize = 50

    for (let i = 0; i < listings.length; i += chunkSize) {
      const chunk = listings.slice(i, i + chunkSize)

      const { error } = await supabase
        .from('nearby_listings')
        .upsert(chunk, { onConflict: 'tripadvisor_id' })

      if (error) {
        console.error('Upsert error:', error)
      }

      await new Promise(r => setTimeout(r, 200))
    }
  },

  /**
   * Fetch detailed information for a specific listing
   */
  async fetchListingDetails(locationId) {
    if (!TRIPADVISOR_KEY) return null

    try {
      const response = await fetch(
        `https://api.tripadvisor.com/api/partner/2.0/location/${locationId}/details?language=en`,
        {
          headers: {
            'X-TripAdvisor-API-Key': TRIPADVISOR_KEY,
            'Accept': 'application/json'
          }
        }
      )

      if (!response.ok) return null

      const data = await response.json()
      return data
    } catch (err) {
      console.error(`Error fetching details for ${locationId}:`, err.message)
      return null
    }
  },

  /**
   * Get popular Philippine cities for fetching
   */
  getPhilippineCities() {
    return [
      // Metro Manila
      'Manila', 'Quezon City', 'Makati', 'Pasig', 'Taguig', 'Caloocan', 'Las Piñas', 'Parañaque',
      'Marikina', 'Mandaluyong', 'San Juan', 'Malabon', 'Navotas', 'Valenzuela',
      // Nearby NCR
      'Antipolo', 'Cainta', 'Tanay', 'Paete', 'Angono',
      // Luzon - Tagalog Region
      'Baguio', 'Tagaytay', 'Cabanatuan', 'Lucena', 'Tayabas', 'Baler',
      'Legazpi', 'Naga', 'Olongapo', 'Vigan',
      // Visayas
      'Cebu', 'Iloilo', 'Bacolod', 'Boracay', 'Aklan', 'Kalibo', 'Dumaguete', 'Siquijor',
      'Tagbilaran', 'Bohol', 'Moalboal', 'Oslob', 'Lapu-Lapu', 'Mandaue',
      'Siargao', 'Surigao', 'Butuan',
      // Mindanao
      'Davao', 'Cagayan de Oro', 'Zamboanga', 'Iligan', 'General Santos',
      // Palawan
      'Puerto Princesa', 'El Nido', 'Coron',
      // Tourist destinations
      'General Luna', 'Port Barton', 'Caticlan', 'San Juan La Union', 'Pagudpud'
    ]
  },

  /**
   * Check how many listings we have per city
   */
  async getListingCountByCity() {
    try {
      const { data } = await supabase
        .from('nearby_listings')
        .select('address')

      const cityCounts = {}

      for (const item of data || []) {
        if (item.address) {
          const cityMatch = item.address.split(',').pop()?.trim()
          if (cityMatch) {
            cityCounts[cityMatch] = (cityCounts[cityMatch] || 0) + 1
          }
        }
      }

      return cityCounts
    } catch (err) {
      console.error('Error getting city counts:', err)
      return {}
    }
  }
}

export default tripadvisorPhilippinesFetcher
