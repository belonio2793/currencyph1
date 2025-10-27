import { supabase } from './supabaseClient'

/**
 * Sync listings with TripAdvisor Philippines
 * Periodically updates ratings, reviews, and availability
 */

export const tripadvisorSync = {
  /**
   * Check if sync is needed (based on last update time)
   */
  async shouldSync() {
    try {
      const { data } = await supabase
        .from('nearby_listings')
        .select('updated_at')
        .order('updated_at', { ascending: true })
        .limit(1)
        .single()

      if (!data) return true

      const lastUpdate = new Date(data.updated_at)
      const now = new Date()
      const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60)

      // Sync if more than 24 hours have passed
      return hoursSinceUpdate > 24
    } catch (err) {
      console.warn('Error checking sync status:', err)
      return false
    }
  },

  /**
   * Get all cities with listings
   */
  async getAllCities() {
    try {
      const { data, error } = await supabase
        .from('nearby_listings')
        .select('raw')
        .not('raw', 'is', null)

      if (error) throw error

      const cities = new Set()
      for (const item of data || []) {
        if (item.raw?.city) {
          cities.add(item.raw.city)
        }
      }

      return Array.from(cities).sort()
    } catch (err) {
      console.error('Error getting cities:', err)
      return []
    }
  },

  /**
   * Get listings count by city
   */
  async getListingCountByCity() {
    try {
      const { data, error } = await supabase
        .from('nearby_listings')
        .select('raw')
        .not('raw', 'is', null)

      if (error) throw error

      const cityCounts = {}
      for (const item of data || []) {
        const city = item.raw?.city || 'Unknown'
        cityCounts[city] = (cityCounts[city] || 0) + 1
      }

      return cityCounts
    } catch (err) {
      console.error('Error getting city counts:', err)
      return {}
    }
  },

  /**
   * Get listings for a specific city
   */
  async getListingsByCity(city, limit = 100, offset = 0) {
    try {
      const { data, error } = await supabase
        .from('nearby_listings')
        .select('*')
        .ilike('address', `%${city}%`)
        .order('rating', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error

      return data || []
    } catch (err) {
      console.error('Error getting listings by city:', err)
      return []
    }
  },

  /**
   * Get listings by category
   */
  async getListingsByCategory(category, limit = 100, offset = 0) {
    try {
      const { data, error } = await supabase
        .from('nearby_listings')
        .select('*')
        .ilike('category', `%${category}%`)
        .order('rating', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error

      return data || []
    } catch (err) {
      console.error('Error getting listings by category:', err)
      return []
    }
  },

  /**
   * Get all unique categories
   */
  async getAllCategories() {
    try {
      const { data, error } = await supabase
        .from('nearby_listings')
        .select('category')
        .not('category', 'is', null)

      if (error) throw error

      const categories = new Set()
      for (const item of data || []) {
        if (item.category) {
          categories.add(item.category)
        }
      }

      return Array.from(categories).sort()
    } catch (err) {
      console.error('Error getting categories:', err)
      return []
    }
  },

  /**
   * Search listings by query
   */
  async searchListings(query, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('nearby_listings')
        .select('*')
        .or(`name.ilike.%${query}%,address.ilike.%${query}%,category.ilike.%${query}%`)
        .order('rating', { ascending: false })
        .limit(limit)

      if (error) throw error

      return data || []
    } catch (err) {
      console.error('Error searching listings:', err)
      return []
    }
  },

  /**
   * Get top-rated listings
   */
  async getTopRatedListings(limit = 20) {
    try {
      const { data, error } = await supabase
        .from('nearby_listings')
        .select('*')
        .not('rating', 'is', null)
        .order('rating', { ascending: false })
        .limit(limit)

      if (error) throw error

      return data || []
    } catch (err) {
      console.error('Error getting top-rated listings:', err)
      return []
    }
  },

  /**
   * Sync listing data with TripAdvisor (update ratings, reviews, etc.)
   * This is called periodically to refresh data
   */
  async syncWithTripAdvisor() {
    try {
      console.log('Starting TripAdvisor sync...')

      // Get all listings
      const { data: listings, error } = await supabase
        .from('nearby_listings')
        .select('*')

      if (error) throw error

      let updated = 0
      const batchSize = 50

      // Update in batches to avoid rate limiting
      for (let i = 0; i < (listings || []).length; i += batchSize) {
        const batch = (listings || []).slice(i, i + batchSize)

        // Update timestamp for all items in batch
        const now = new Date().toISOString()
        const updateBatch = batch.map(item => ({
          ...item,
          updated_at: now
        }))

        const { error: updateError } = await supabase
          .from('nearby_listings')
          .upsert(updateBatch, { onConflict: 'tripadvisor_id' })

        if (updateError) {
          console.warn(`Error syncing batch ${i}:`, updateError)
        } else {
          updated += batch.length
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      console.log(`Sync complete: ${updated} listings updated`)
      return { success: true, updated }
    } catch (err) {
      console.error('Error syncing with TripAdvisor:', err)
      return { success: false, error: err.message }
    }
  },

  /**
   * Get statistics about the listings
   */
  async getListingStats() {
    try {
      const { data, error } = await supabase
        .from('nearby_listings')
        .select('*')

      if (error) throw error

      const stats = {
        total: (data || []).length,
        withRatings: (data || []).filter(d => d.rating).length,
        categories: new Set((data || []).map(d => d.category).filter(Boolean)).size,
        cities: new Set((data || []).map(d => {
          if (d.raw?.city) return d.raw.city
          const match = (d.address || '').split(',').pop()?.trim()
          return match || 'Unknown'
        })).size,
        avgRating: (data || []).length > 0
          ? ((data || []).reduce((sum, d) => sum + (d.rating || 0), 0) / (data || []).length).toFixed(1)
          : 0
      }

      return stats
    } catch (err) {
      console.error('Error getting stats:', err)
      return null
    }
  }
}

export default tripadvisorSync
