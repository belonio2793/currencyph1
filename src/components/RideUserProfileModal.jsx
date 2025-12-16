import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function RideUserProfileModal({ userId, userRole = 'driver', onClose }) {
  const [profile, setProfile] = useState(null)
  const [ratings, setRatings] = useState([])
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview') // 'overview', 'ratings', 'trips'

  useEffect(() => {
    loadProfile()
  }, [userId])

  const loadProfile = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load user profile
      const { data: profileDataArr, error: profileError } = await supabase
        .from('ride_profiles')
        .select('*')
        .eq('user_id', userId)
        .limit(1)

      if (profileError) throw profileError

      const profileData = profileDataArr && profileDataArr.length > 0 ? profileDataArr[0] : null
      setProfile(profileData || {})

      // Load ratings for this user
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('ride_ratings')
        .select(`
          *,
          rater:users!ride_ratings_rater_id(id, full_name, display_name, profile_image)
        `)
        .eq('ratee_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (ratingsError) throw ratingsError
      setRatings(ratingsData || [])

      // Load completed trips
      const { data: tripsData, error: tripsError } = await supabase
        .from('ride_matches')
        .select(`
          *,
          rider:users!ride_matches_rider_id(id, full_name, display_name),
          driver:users!ride_matches_driver_id(id, full_name, display_name)
        `)
        .or(`rider_id.eq.${userId},driver_id.eq.${userId}`)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(10)

      if (tripsError) throw tripsError
      setTrips(tripsData || [])
    } catch (err) {
      setError(err.message)
      console.error('Error loading profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const getRatingBreakdown = () => {
    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    ratings.forEach(r => {
      breakdown[r.rating]++
    })
    return breakdown
  }

  const ratingBreakdown = getRatingBreakdown()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-cyan-600 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">User Profile</h2>
            <p className="text-blue-100 text-sm capitalize">{userRole}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-12 text-center">
            <p className="text-slate-600">Loading profile...</p>
          </div>
        ) : error ? (
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Profile Header */}
            <div className="flex items-start gap-6 pb-6 border-b border-slate-200">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-4xl font-bold flex-shrink-0">
                {profile?.first_name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-2xl font-bold text-slate-900 mb-1">
                  {profile?.first_name} {profile?.last_name}
                </h3>
                <p className="text-slate-600 mb-3">{profile?.email}</p>

                {/* Rating Summary */}
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-3xl font-bold text-slate-900">
                        {profile?.average_rating?.toFixed(1) || '5.0'}
                      </div>
                      <div className="text-yellow-400">
                        {'★'.repeat(Math.floor(profile?.average_rating || 5))}
                        {'☆'.repeat(5 - Math.floor(profile?.average_rating || 5))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">{ratings.length} ratings</p>
                  </div>

                  <div className="h-12 w-px bg-slate-200"></div>

                  <div className="space-y-1">
                    {userRole === 'driver' && (
                      <>
                        <p className="text-sm text-slate-600">
                          <span className="font-semibold text-slate-900">{profile?.total_rides_as_driver || 0}</span> trips as driver
                        </p>
                        <p className="text-sm text-slate-600">
                          Earned <span className="font-semibold text-slate-900">₱{(profile?.total_earnings || 0).toFixed(2)}</span>
                        </p>
                      </>
                    )}
                    {userRole === 'rider' && (
                      <>
                        <p className="text-sm text-slate-600">
                          <span className="font-semibold text-slate-900">{profile?.total_rides_as_rider || 0}</span> trips as rider
                        </p>
                        <p className="text-sm text-slate-600">
                          Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'overview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('ratings')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'ratings'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Ratings
              </button>
              <button
                onClick={() => setActiveTab('trips')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'trips'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Trip History
              </button>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Rating Distribution */}
                {ratings.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-900">Rating Distribution</h4>
                    {[5, 4, 3, 2, 1].map(star => {
                      const count = ratingBreakdown[star]
                      const percentage = ratings.length > 0 ? (count / ratings.length) * 100 : 0
                      return (
                        <div key={star} className="flex items-center gap-3">
                          <div className="w-12 text-sm font-medium text-slate-600">
                            {star} ★
                          </div>
                          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-yellow-400 transition-all"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <div className="w-12 text-right text-sm text-slate-600">
                            {count}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                    <p className="text-xs text-blue-600 uppercase font-semibold mb-2">Total Ratings</p>
                    <p className="text-3xl font-bold text-blue-900">{ratings.length}</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                    <p className="text-xs text-green-600 uppercase font-semibold mb-2">
                      {userRole === 'driver' ? 'Total Trips (Driver)' : 'Total Trips (Rider)'}
                    </p>
                    <p className="text-3xl font-bold text-green-900">
                      {userRole === 'driver' ? profile?.total_rides_as_driver || 0 : profile?.total_rides_as_rider || 0}
                    </p>
                  </div>
                  {userRole === 'driver' && (
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4">
                      <p className="text-xs text-emerald-600 uppercase font-semibold mb-2">Total Earnings</p>
                      <p className="text-3xl font-bold text-emerald-900">₱{(profile?.total_earnings || 0).toFixed(0)}</p>
                    </div>
                  )}
                  {userRole === 'driver' && (
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
                      <p className="text-xs text-orange-600 uppercase font-semibold mb-2">Avg Rating</p>
                      <p className="text-3xl font-bold text-orange-900">{(profile?.driver_rating || 5).toFixed(1)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ratings Tab */}
            {activeTab === 'ratings' && (
              <div className="space-y-4">
                {ratings.length === 0 ? (
                  <p className="text-center text-slate-600 py-8">No ratings yet</p>
                ) : (
                  ratings.map(rating => (
                    <div key={rating.id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-white text-sm font-bold">
                            {rating.rater?.display_name?.charAt(0) || 'U'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900">{rating.rater?.display_name || 'Anonymous'}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(rating.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-yellow-400 font-semibold">
                          {rating.rating} ★
                        </div>
                      </div>
                      {rating.comment && (
                        <p className="text-sm text-slate-700 mt-2">{rating.comment}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Trips Tab */}
            {activeTab === 'trips' && (
              <div className="space-y-4">
                {trips.length === 0 ? (
                  <p className="text-center text-slate-600 py-8">No completed trips yet</p>
                ) : (
                  trips.map(trip => {
                    const otherUser = userRole === 'driver' ? trip.rider : trip.driver
                    return (
                      <div key={trip.id} className="border border-slate-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {trip.pickup_latitude ? 'Completed Trip' : 'Trip'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {trip.completed_at ? new Date(trip.completed_at).toLocaleDateString() : 'N/A'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">₱{(trip.actual_fare || trip.estimated_fare || 0).toFixed(2)}</p>
                            <p className="text-xs text-slate-500">{trip.actual_duration || trip.estimated_duration || 0} min</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                          <span>{trip.actual_distance || trip.estimated_distance || 0} km</span>
                        </div>

                        {otherUser && (
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <p className="text-xs text-slate-500 mb-1">
                              {userRole === 'driver' ? 'Rider' : 'Driver'}
                            </p>
                            <p className="text-sm font-medium text-slate-900">
                              {otherUser.display_name || otherUser.full_name}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
