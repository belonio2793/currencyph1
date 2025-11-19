import { supabase } from './supabaseClient'

export const ridesMatchingService = {
  // Create a ride request (rider looking for driver or driver offering ride)
  async createRideRequest(userId, userType, pickupLocation, dropoffLocation, rideDetails) {
    try {
      const { data, error } = await supabase
        .from('ride_requests')
        .insert([{
          user_id: userId,
          user_type: userType, // 'rider' or 'driver'
          start_latitude: pickupLocation.latitude,
          start_longitude: pickupLocation.longitude,
          start_address: pickupLocation.address,
          end_latitude: dropoffLocation.latitude,
          end_longitude: dropoffLocation.longitude,
          end_address: dropoffLocation.address,
          estimated_distance: rideDetails.distance,
          estimated_duration: rideDetails.duration,
          estimated_fare: rideDetails.fare,
          vehicle_type: rideDetails.vehicleType,
          service_type: rideDetails.serviceType,
          passengers_count: rideDetails.passengersCount || 1,
          notes: rideDetails.notes
        }])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[ridesMatchingService] createRideRequest failed:', err)
      return { data: null, error: err }
    }
  },

  // Get active ride requests for a user role (drivers see rider requests, riders see driver offers)
  async getActiveRequests(userType, limit = 20) {
    try {
      const oppositeType = userType === 'rider' ? 'driver' : 'rider'
      const { data, error } = await supabase
        .from('ride_requests')
        .select(`
          *,
          user:users(id, email, full_name)
        `)
        .eq('user_type', oppositeType)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[ridesMatchingService] getActiveRequests failed:', err)
      return { data: null, error: err }
    }
  },

  // Create a match between rider and driver
  async createMatch(rideRequestId, riderId, driverId, routeDetails) {
    try {
      const { data, error } = await supabase
        .from('ride_matches')
        .insert([{
          ride_request_id: rideRequestId,
          rider_id: riderId,
          driver_id: driverId,
          status: 'pending',
          route_geometry: routeDetails.geometry,
          estimated_distance: routeDetails.distance,
          estimated_duration: routeDetails.duration,
          estimated_fare: routeDetails.fare,
          pickup_latitude: routeDetails.pickup.latitude,
          pickup_longitude: routeDetails.pickup.longitude,
          dropoff_latitude: routeDetails.dropoff.latitude,
          dropoff_longitude: routeDetails.dropoff.longitude
        }])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[ridesMatchingService] createMatch failed:', err)
      return { data: null, error: err }
    }
  },

  // Accept a ride request (driver accepts rider request or vice versa)
  async acceptRequest(matchId, acceptingUserRole) {
    try {
      const updateField = acceptingUserRole === 'driver' ? 'driver_confirmed' : 'rider_confirmed'
      const updateTimeField = acceptingUserRole === 'driver' ? 'driver_confirmed_at' : 'rider_confirmed_at'

      const { data: existingMatch, error: fetchError } = await supabase
        .from('ride_matches')
        .select('*')
        .eq('id', matchId)
        .single()

      if (fetchError) throw fetchError

      const newStatus = existingMatch.driver_confirmed && existingMatch.rider_confirmed ? 'confirmed' : `accepted_by_${acceptingUserRole}`

      const { data, error } = await supabase
        .from('ride_matches')
        .update({
          [updateField]: true,
          [updateTimeField]: new Date().toISOString(),
          status: newStatus
        })
        .eq('id', matchId)
        .select()
        .single()

      if (error) throw error

      // Update ride_requests status
      if (newStatus === 'confirmed') {
        await supabase
          .from('ride_requests')
          .update({ status: 'accepted' })
          .eq('id', existingMatch.ride_request_id)
      }

      return { data, error: null }
    } catch (err) {
      console.error('[ridesMatchingService] acceptRequest failed:', err)
      return { data: null, error: err }
    }
  },

  // Get matches for a user
  async getUserMatches(userId, status = 'confirmed') {
    try {
      const { data, error } = await supabase
        .from('ride_matches')
        .select(`
          *,
          rider:users!ride_matches_rider_id(id, email, full_name),
          driver:users!ride_matches_driver_id(id, email, full_name)
        `)
        .or(`rider_id.eq.${userId},driver_id.eq.${userId}`)
        .eq('status', status)
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[ridesMatchingService] getUserMatches failed:', err)
      return { data: null, error: err }
    }
  },

  // Get pending matches waiting for current user's confirmation
  async getPendingMatches(userId) {
    try {
      const { data, error } = await supabase
        .from('ride_matches')
        .select(`
          *,
          rider:users!ride_matches_rider_id(id, email, full_name),
          driver:users!ride_matches_driver_id(id, email, full_name)
        `)
        .or(`rider_id.eq.${userId},driver_id.eq.${userId}`)
        .in('status', ['pending', 'accepted_by_driver', 'accepted_by_rider'])
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[ridesMatchingService] getPendingMatches failed:', err)
      return { data: null, error: err }
    }
  },

  // Update match status (start trip, complete trip, cancel)
  async updateMatchStatus(matchId, newStatus, additionalData = {}) {
    try {
      const updatePayload = {
        status: newStatus,
        updated_at: new Date().toISOString(),
        ...additionalData
      }

      if (newStatus === 'in_progress') {
        updatePayload.started_at = new Date().toISOString()
      } else if (newStatus === 'completed') {
        updatePayload.completed_at = new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('ride_matches')
        .update(updatePayload)
        .eq('id', matchId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[ridesMatchingService] updateMatchStatus failed:', err)
      return { data: null, error: err }
    }
  },

  // Submit rating after trip completion
  async submitRating(matchId, raterId, rateeId, raterRole, rating, comment) {
    try {
      const { data, error } = await supabase
        .from('ride_ratings')
        .insert([{
          match_id: matchId,
          rater_id: raterId,
          ratee_id: rateeId,
          rater_role: raterRole,
          rating,
          comment
        }])
        .select()
        .single()

      if (error) throw error

      // Update user's average rating
      await this.updateUserRating(rateeId, raterRole === 'driver' ? 'rider_rating' : 'driver_rating', rating)

      return { data, error: null }
    } catch (err) {
      console.error('[ridesMatchingService] submitRating failed:', err)
      return { data: null, error: err }
    }
  },

  // Update user's rating statistics
  async updateUserRating(userId, ratingType, newRating) {
    try {
      // Get all ratings for this user
      const { data: ratings, error: ratingError } = await supabase
        .from('ride_ratings')
        .select('rating')
        .eq('ratee_id', userId)

      if (ratingError) throw ratingError

      const averageRating = ratings && ratings.length > 0
        ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length)
        : 5.0

      const { error } = await supabase
        .from('ride_profiles')
        .update({
          [ratingType]: newRating,
          average_rating: averageRating
        })
        .eq('user_id', userId)

      if (error) throw error
      return { error: null }
    } catch (err) {
      console.error('[ridesMatchingService] updateUserRating failed:', err)
      return { error: err }
    }
  },

  // Subscribe to match updates in real-time
  subscribeToMatches(matchId, callback) {
    try {
      const channel = supabase
        .channel(`match:${matchId}`)
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
      console.error('[ridesMatchingService] subscribeToMatches failed:', err)
      return { unsubscribe: () => {} }
    }
  },

  // Subscribe to ride requests in real-time
  subscribeToRideRequests(userType, callback) {
    try {
      const oppositeType = userType === 'rider' ? 'driver' : 'rider'
      const channel = supabase
        .channel(`requests:${userType}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'ride_requests',
          filter: `user_type=eq.${oppositeType}`
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
      console.error('[ridesMatchingService] subscribeToRideRequests failed:', err)
      return { unsubscribe: () => {} }
    }
  },

  // Cancel a ride request or match
  async cancelRequest(requestId, matchId = null) {
    try {
      const { error: requestError } = await supabase
        .from('ride_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId)

      if (requestError) throw requestError

      if (matchId) {
        const { error: matchError } = await supabase
          .from('ride_matches')
          .update({ status: 'cancelled' })
          .eq('id', matchId)

        if (matchError) throw matchError
      }

      return { error: null }
    } catch (err) {
      console.error('[ridesMatchingService] cancelRequest failed:', err)
      return { error: err }
    }
  }
}
