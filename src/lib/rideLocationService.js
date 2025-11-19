import { supabase } from './supabaseClient'

export const rideLocationService = {
  // Update user's current location during an active ride
  async updateLiveLocation(matchId, userId, latitude, longitude) {
    try {
      const { data, error } = await supabase
        .from('ride_live_locations')
        .upsert([{
          match_id: matchId,
          user_id: userId,
          latitude,
          longitude,
          updated_at: new Date().toISOString()
        }], {
          onConflict: 'match_id,user_id'
        })
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[rideLocationService] updateLiveLocation failed:', err)
      return { data: null, error: err }
    }
  },

  // Get live locations for a match (both rider and driver)
  async getLiveLocations(matchId) {
    try {
      const { data, error } = await supabase
        .from('ride_live_locations')
        .select(`
          *,
          user:users(id, full_name, display_name)
        `)
        .eq('match_id', matchId)

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[rideLocationService] getLiveLocations failed:', err)
      return { data: null, error: err }
    }
  },

  // Update route information for a match
  async updateRouteInfo(matchId, routeData) {
    try {
      const { data, error } = await supabase
        .from('ride_matches')
        .update({
          route_geometry: routeData.geometry,
          estimated_distance: routeData.distance,
          estimated_duration: routeData.duration,
          actual_distance: routeData.actualDistance,
          actual_duration: routeData.actualDuration,
          updated_at: new Date().toISOString()
        })
        .eq('id', matchId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[rideLocationService] updateRouteInfo failed:', err)
      return { data: null, error: err }
    }
  },

  // Subscribe to live location updates for a match
  subscribeToLiveLocations(matchId, callback) {
    try {
      const channel = supabase
        .channel(`live-locations:${matchId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'ride_live_locations',
          filter: `match_id=eq.${matchId}`
        }, (payload) => {
          callback(payload)
        })
        .subscribe()

      return {
        unsubscribe: () => {
          channel.unsubscribe()
        }
      }
    } catch (err) {
      console.error('[rideLocationService] subscribeToLiveLocations failed:', err)
      return { unsubscribe: () => {} }
    }
  },

  // Subscribe to route/match updates
  subscribeToMatchUpdates(matchId, callback) {
    try {
      const channel = supabase
        .channel(`match-updates:${matchId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'ride_matches',
          filter: `id=eq.${matchId}`
        }, (payload) => {
          callback(payload.new)
        })
        .subscribe()

      return {
        unsubscribe: () => {
          channel.unsubscribe()
        }
      }
    } catch (err) {
      console.error('[rideLocationService] subscribeToMatchUpdates failed:', err)
      return { unsubscribe: () => {} }
    }
  },

  // Calculate distance between two points
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371 // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  },

  // Calculate ETA based on current location and route
  calculateETA(currentLat, currentLon, destLat, destLon, averageSpeed = 30) {
    // averageSpeed in km/h (default 30 km/h for urban driving)
    const distance = this.calculateDistance(currentLat, currentLon, destLat, destLon)
    const timeInHours = distance / averageSpeed
    return Math.round(timeInHours * 60) // return in minutes
  }
}
