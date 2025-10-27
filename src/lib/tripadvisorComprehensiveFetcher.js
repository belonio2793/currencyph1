import { supabase } from './supabaseClient'
import { generateSlug } from './slugUtils'

const TRIPADVISOR_API_KEY = import.meta.env.VITE_TRIPADVISOR || process.env.VITE_TRIPADVISOR

/**
 * Comprehensive TripAdvisor Fetcher
 * Fetches detailed listing information and saves to database with all fields
 */
export const tripadvisorComprehensiveFetcher = {
  /**
   * Fetch comprehensive listing details from TripAdvisor API
   */
  async fetchListingDetails(locationId) {
    if (!TRIPADVISOR_API_KEY) {
      console.warn('TripAdvisor API key not available')
      return null
    }

    try {
      const response = await fetch(
        `https://api.tripadvisor.com/api/partner/2.0/location/${locationId}/details?language=en`,
        {
          headers: {
            'X-TripAdvisor-API-Key': TRIPADVISOR_API_KEY,
            'Accept': 'application/json'
          }
        }
      )

      if (!response.ok) {
        console.warn(`TripAdvisor API error for ${locationId}: ${response.status}`)
        return null
      }

      const data = await response.json()
      return this.formatListingData(data)
    } catch (err) {
      console.error(`Error fetching details for ${locationId}:`, err.message)
      return null
    }
  },

  /**
   * Format raw API response to database schema
   */
  formatListingData(rawData) {
    if (!rawData) return null

    return {
      tripadvisor_id: String(rawData.location_id || rawData.id),
      name: rawData.name || '',
      slug: generateSlug(rawData.name || ''),
      description: rawData.description || rawData.overview || '',
      address: rawData.address || rawData.address_string || '',
      latitude: rawData.latitude || rawData.address_obj?.latitude || null,
      longitude: rawData.longitude || rawData.address_obj?.longitude || null,
      rating: rawData.rating ? Number(rawData.rating) : null,
      review_count: rawData.num_reviews || rawData.review_count || 0,
      category: rawData.subcategory || rawData.category?.name || rawData.type || '',
      location_type: rawData.location_type || rawData.type || '',
      phone_number: rawData.phone || rawData.telephone || null,
      website: rawData.website || rawData.web_url || null,
      web_url: rawData.web_url || null,
      image_url: rawData.photo?.images?.large?.url || rawData.image_url || null,
      featured_image_url: rawData.photo?.images?.original?.url || rawData.featured_image || null,
      photo_count: rawData.num_photos || 0,
      photo_urls: this.extractPhotoUrls(rawData),
      hours_of_operation: this.extractHours(rawData),
      admission_fee: rawData.admission || rawData.price_range || null,
      price_level: rawData.price_level || null,
      amenities: this.extractAmenities(rawData),
      accessibility_info: this.extractAccessibility(rawData),
      awards: this.extractAwards(rawData),
      ranking_in_city: rawData.ranking?.ranking || null,
      ranking_in_category: rawData.ranking?.ranking_category ? parseInt(rawData.ranking.ranking_category) : null,
      highlights: this.extractHighlights(rawData),
      best_for: this.extractBestFor(rawData),
      nearby_attractions: this.extractNearbyAttractions(rawData),
      review_details: this.extractReviewDetails(rawData),
      lat: rawData.latitude ? parseFloat(rawData.latitude) : null,
      lng: rawData.longitude ? parseFloat(rawData.longitude) : null,
      source: 'tripadvisor',
      verified: true,
      last_verified_at: new Date().toISOString(),
      raw: rawData
    }
  },

  /**
   * Extract photo URLs from API response
   */
  extractPhotoUrls(data) {
    const urls = []

    if (data.photos && Array.isArray(data.photos)) {
      for (const photo of data.photos.slice(0, 20)) {
        if (photo.images?.large?.url) {
          urls.push(photo.images.large.url)
        } else if (photo.images?.original?.url) {
          urls.push(photo.images.original.url)
        }
      }
    }

    if (data.photo?.images?.large?.url) {
      urls.unshift(data.photo.images.large.url)
    }

    return urls.filter((url, idx, arr) => arr.indexOf(url) === idx).slice(0, 50)
  },

  /**
   * Extract hours of operation
   */
  extractHours(data) {
    if (!data.hours) return {}

    const hours = {}
    const dayMap = {
      0: 'Monday',
      1: 'Tuesday',
      2: 'Wednesday',
      3: 'Thursday',
      4: 'Friday',
      5: 'Saturday',
      6: 'Sunday'
    }

    if (Array.isArray(data.hours)) {
      for (const entry of data.hours) {
        const day = dayMap[entry.day]
        if (day && entry.open_time && entry.close_time) {
          hours[day] = `${entry.open_time} - ${entry.close_time}`
        }
      }
    }

    return hours
  },

  /**
   * Extract amenities
   */
  extractAmenities(data) {
    const amenities = []

    if (data.amenities && Array.isArray(data.amenities)) {
      return data.amenities.map(a => typeof a === 'string' ? a : a.name).filter(Boolean)
    }

    return amenities
  },

  /**
   * Extract accessibility information
   */
  extractAccessibility(data) {
    const accessibility = {}

    if (data.access_info) {
      accessibility.details = data.access_info
    }

    if (data.is_wheelchair_accessible !== undefined) {
      accessibility.wheelchair_accessible = data.is_wheelchair_accessible
    }

    return accessibility
  },

  /**
   * Extract awards
   */
  extractAwards(data) {
    const awards = []

    if (data.awards && Array.isArray(data.awards)) {
      for (const award of data.awards) {
        if (award.award_type || award.display_name) {
          awards.push(award.award_type || award.display_name)
        }
      }
    }

    return awards
  },

  /**
   * Extract highlights
   */
  extractHighlights(data) {
    const highlights = []

    if (data.highlights && Array.isArray(data.highlights)) {
      return data.highlights.filter(Boolean).slice(0, 15)
    }

    if (data.description) {
      const sentences = data.description.split('.').filter(s => s.trim().length > 10).slice(0, 5)
      return sentences.map(s => s.trim())
    }

    return highlights
  },

  /**
   * Extract best for tags
   */
  extractBestFor(data) {
    const bestFor = []

    if (data.best_for && Array.isArray(data.best_for)) {
      return data.best_for.filter(Boolean).slice(0, 10)
    }

    const typeMap = {
      'Historical Site': ['History enthusiasts', 'Culture lovers', 'Educational visits'],
      'Religious Site': ['Religious visitors', 'Spiritual retreats', 'Architecture enthusiasts'],
      'Park': ['Families', 'Outdoor enthusiasts', 'Nature lovers'],
      'Museum': ['Culture lovers', 'Educational visits', 'Art enthusiasts'],
      'Beach': ['Beach lovers', 'Swimmers', 'Families', 'Water sports'],
      'Restaurant': ['Food enthusiasts', 'Families', 'Date nights'],
      'Bar': ['Nightlife lovers', 'Social gatherings']
    }

    if (data.category && typeMap[data.category]) {
      return typeMap[data.category]
    }

    return bestFor
  },

  /**
   * Extract nearby attractions
   */
  extractNearbyAttractions(data) {
    if (data.nearby_attractions && Array.isArray(data.nearby_attractions)) {
      return data.nearby_attractions
        .map(a => typeof a === 'string' ? a : a.name)
        .filter(Boolean)
        .slice(0, 20)
    }
    return []
  },

  /**
   * Extract sample reviews
   */
  extractReviewDetails(data) {
    const reviews = []

    if (data.reviews && Array.isArray(data.reviews)) {
      for (const review of data.reviews.slice(0, 5)) {
        reviews.push({
          author: review.author || review.user?.username || 'Anonymous',
          rating: review.rating || 0,
          text: review.text || review.review_text || '',
          date: review.published_date || review.date || null,
          helpful_count: review.helpful_count || 0
        })
      }
    }

    return reviews
  },

  /**
   * Search listings in a city with comprehensive data
   */
  async searchCity(city, limit = 30) {
    if (!TRIPADVISOR_API_KEY) {
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
            'X-TripAdvisor-API-Key': TRIPADVISOR_API_KEY,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0'
          }
        }
      )

      if (!response.ok) {
        console.warn(`Search error for ${city}: ${response.status}`)
        return []
      }

      const data = await response.json()
      const items = data.data || []

      const listings = []
      for (const item of items) {
        const detailed = await this.fetchListingDetails(item.location_id)
        if (detailed) {
          listings.push(detailed)
        }
        // Rate limiting
        await new Promise(r => setTimeout(r, 500))
      }

      return listings
    } catch (err) {
      console.error(`Error searching ${city}:`, err.message)
      return []
    }
  },

  /**
   * Save listings to database with full details
   */
  async saveListings(listings) {
    if (!listings || listings.length === 0) {
      return { success: false, message: 'No listings to save' }
    }

    try {
      const chunkSize = 10

      for (let i = 0; i < listings.length; i += chunkSize) {
        const chunk = listings.slice(i, i + chunkSize)

        const { error } = await supabase
          .from('nearby_listings')
          .upsert(chunk, { onConflict: 'tripadvisor_id' })

        if (error) {
          console.error(`Error saving batch ${i}-${i + chunkSize}:`, error)
          continue
        }

        // Rate limiting
        await new Promise(r => setTimeout(r, 300))
      }

      return {
        success: true,
        saved: listings.length,
        message: `Saved ${listings.length} listings`
      }
    } catch (err) {
      console.error('Error saving listings:', err)
      return {
        success: false,
        message: err.message,
        saved: 0
      }
    }
  },

  /**
   * Fetch all Philippines cities
   */
  getPhilippinesCities() {
    return [
      'Manila', 'Cebu', 'Davao', 'Quezon City', 'Makati', 'Baguio', 'Boracay',
      'Puerto Princesa', 'Iloilo', 'Pasig', 'Taguig', 'Parañaque', 'Las Piñas',
      'Muntinlupa', 'Bacoor', 'Cavite City', 'Imus', 'Dasmariñas', 'Tagaytay',
      'Batangas City', 'Lipa', 'Calamba', 'San Pedro', 'Laguna', 'Biñan',
      'Santa Rosa', 'Antipolo', 'Angono', 'Cainta', 'Tanay', 'Baras',
      'Pililla', 'Cardona', 'Infanta', 'Rizal', 'Morong', 'San Mateo',
      'Marikina', 'Mandaluyong', 'San Juan', 'Malabon', 'Navotas', 'Caloocan',
      'Valenzuela', 'Bulacan', 'Meycauayan', 'Obando', 'Plaridel', 'Paombong',
      'Pandi', 'Baliuag', 'Bustos', 'Doña Remedios Trinidad', 'Norzagaray',
      'Angat', 'Guiguinto', 'San Rafael', 'Marilao', 'Bocaue', 'Canumay',
      'Bagumbayan', 'Polo', 'Mongkok', 'Sarao', 'Tanza', 'Kawit',
      'Noveleta', 'Rosario', 'Magallanes', 'General Mariano Alvarez', 'Silang',
      'Indang', 'Maragondon', 'Magdalo', 'Naia', 'Kawanan', 'Puktan',
      'Tagaig', 'Mendez', 'Caaguisan', 'Balayan', 'Bauan', 'Lemery',
      'Tanauan', 'Malvar', 'Cuenca', 'Alitagtag', 'Alaminos', 'Mataasnakahoy',
      'Talisay', 'Agoncillo', 'Laurel', 'Mabini', 'Nasugbu', 'Calatagan',
      'Cavite', 'Kawit', 'Noveleta', 'Sangley', 'Rosario', 'Marilao',
      'Pampanga', 'Angeles City', 'San Fernando', 'Arayat', 'Magalang',
      'Sarang', 'Lubao', 'Guagua', 'Floridablanca', 'Porac', 'Ipoh',
      'Capas', 'Tarlac', 'Cabanatuan', 'Nueva Ecija', 'Dingalan', 'Baler',
      'Quezon', 'Cabanatuan', 'Gabaldon', 'Talugtug', 'Science City of Muñez',
      'Nueva Vizcaya', 'Bayombong', 'Ifugao', 'Cordillera', 'Mountain Province',
      'Benguet', 'Ilocos', 'Dagupan', 'Lingayen', 'Urdaneta', 'Cabanatuan',
      'La Union', 'Vigan', 'Ilocos Sur', 'Candon', 'Abra', 'Bangued',
      'Kalinga', 'Chico', 'Apayao', 'Calauan', 'Isabela', 'Ilagan',
      'Cauayan', 'Cabagan', 'Nueva Vizcaya', 'Quirino', 'Pangasinan',
      'Dagupan', 'San Carlos', 'Cabanatuan', 'Urdaneta', 'Lingayen', 'Midwestern',
      'Pangasinan', 'Ilo-ilo', 'Antique', 'Capiz', 'Aklan', 'Boracay',
      'Roxas', 'New Washington', 'Capiton', 'Cuyo', 'Dumaguete', 'Negros Oriental',
      'Siquijor', 'Visayas', 'Tacloban', 'Leyte', 'Samar', 'Biliran',
      'Pampanga', 'Laguna', 'Batangas', 'Mindoro', 'Marinduque', 'Romblon',
      'Palawan', 'Puerto Princesa', 'Coron', 'El Nido', 'Malay', 'San Vicente',
      'Zamboanga', 'Basilan', 'Sulu', 'Tawi-Tawi', 'Misamis Occidental',
      'Dipolog', 'Oroquieta', 'Misamis Oriental', 'Cagayan de Oro', 'Bukiron',
      'Camiguin', 'Lanao del Norte', 'Iligan', 'Marawi', 'Lanao del Sur',
      'Maguindanao', 'North Cotabato', 'Koronadal', 'South Cotabato',
      'Sultan Kudarat', 'Sarangani', 'General Santos', 'Davao Occidental',
      'Davao Oriental', 'Davao City', 'Davao del Sur', 'Davao del Norte'
    ]
  },

  /**
   * Fetch all Philippines listings
   */
  async fetchAllPhilippines(onProgress = null) {
    const cities = this.getPhilippinesCities()
    const allListings = []
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < cities.length; i++) {
      const city = cities[i]

      try {
        const listings = await this.searchCity(city, 20)

        if (listings.length > 0) {
          allListings.push(...listings)
          successCount++
        }

        if (onProgress) {
          onProgress({
            current: i + 1,
            total: cities.length,
            city,
            found: listings.length,
            totalCollected: allListings.length,
            successCount,
            errorCount
          })
        }
      } catch (err) {
        console.error(`Error with ${city}:`, err.message)
        errorCount++

        if (onProgress) {
          onProgress({
            current: i + 1,
            total: cities.length,
            city,
            error: true,
            successCount,
            errorCount
          })
        }
      }

      // Rate limiting between cities
      await new Promise(r => setTimeout(r, 1000))
    }

    // Deduplicate
    const deduped = {}
    for (const listing of allListings) {
      deduped[listing.tripadvisor_id] = listing
    }

    const unique = Object.values(deduped)

    return {
      total: unique.length,
      successCount,
      errorCount,
      listings: unique
    }
  }
}

export default tripadvisorComprehensiveFetcher
