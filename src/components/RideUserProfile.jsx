import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function RideUserProfile({ userId, userRole = 'driver', onClose }) {
  const [profile, setProfile] = useState(null)
  const [ratings, setRatings] = useState([])
  const [rideHistory, setRideHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    loadProfile()
    loadRatings()
    loadRideHistory()
  }, [userId, userRole])

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('ride_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (!error && data) {
        setProfile(data)
      }
    } catch (err) {
      console.warn('Could not load profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadRatings = async () => {
    try {
      const { data, error } = await supabase
        .from('ride_ratings')
        .select('*')
        .eq('ratee_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!error && data) {
        setRatings(data)
      }
    } catch (err) {
      console.warn('Could not load ratings:', err)
    }
  }

  const loadRideHistory = async () => {
    try {
      const query = userRole === 'driver'
        ? supabase.from('rides').select('*').eq('driver_id', userId)
        : supabase.from('rides').select('*').eq('rider_id', userId)

      const { data, error } = await query
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20)

      if (!error && data) {
        setRideHistory(data)
      }
    } catch (err) {
      console.warn('Could not load ride history:', err)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4">
          <p className="text-center text-slate-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4">
          <p className="text-center text-slate-600">Profile not found</p>
        </div>
      </div>
    )
  }

  const averageRating = ratings.length > 0
    ? (ratings.reduce((sum, r) => sum + r.rating_score, 0) / ratings.length).toFixed(1)
    : 5.0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-3xl font-bold text-blue-600">
              {profile.full_name?.charAt(0) || 'U'}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{profile.full_name || 'User'}</h1>
              <p className="text-blue-100 capitalize text-sm">{profile.role === 'driver' ? '🚗 Driver' : '👤 Rider'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-blue-100 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Rating Summary */}
        <div className="bg-blue-50 border-b border-blue-200 p-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold text-blue-600">{averageRating}</p>
              <p className="text-xs text-slate-600 mt-1">★ Average Rating</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900">{profile.total_rides || 0}</p>
              <p className="text-xs text-slate-600 mt-1">Total Rides</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900">{profile.cancellation_rate || 0}%</p>
              <p className="text-xs text-slate-600 mt-1">Cancellation Rate</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 flex">
          {['overview', 'ratings', 'history'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-4 px-6 text-center font-medium text-sm uppercase tracking-wide transition-colors ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === 'overview' && '📋 Overview'}
              {tab === 'ratings' && '⭐ Ratings'}
              {tab === 'history' && '📜 History'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Personal Info */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="font-semibold text-slate-900 mb-3">Personal Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Phone:</span>
                    <span className="font-medium text-slate-900">{profile.phone_number || 'Not provided'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">City:</span>
                    <span className="font-medium text-slate-900">{profile.city || 'Not provided'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Member Since:</span>
                    <span className="font-medium text-slate-900">{new Date(profile.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Verification Status */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="font-semibold text-slate-900 mb-3">Verification Status</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={profile.is_phone_verified ? '✓' : '✗'} className={`w-5 h-5 rounded-full flex items-center justify-center text-white ${profile.is_phone_verified ? 'bg-green-600' : 'bg-slate-400'}`}>
                      {profile.is_phone_verified ? '✓' : '✗'}
                    </span>
                    <span className="text-slate-700">Phone Verified</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white ${profile.is_identity_verified ? 'bg-green-600' : 'bg-slate-400'}`}>
                      {profile.is_identity_verified ? '✓' : '✗'}
                    </span>
                    <span className="text-slate-700">Identity Verified</span>
                  </div>
                </div>
              </div>

              {/* Vehicle Info (for drivers) */}
              {profile.role === 'driver' && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <h3 className="font-semibold text-slate-900 mb-3">Vehicle Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Vehicle Type:</span>
                      <span className="font-medium text-slate-900 capitalize">{profile.vehicle_type || 'Not provided'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">License Plate:</span>
                      <span className="font-medium text-slate-900">{profile.vehicle_plate || 'Not provided'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total Earnings:</span>
                      <span className="font-medium text-slate-900">₱{profile.total_earnings?.toLocaleString() || 0}</span>
                    </div>
                  </div>
                </div>
              )}
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
                      <div>
                        <p className="font-semibold text-slate-900">
                          {'★'.repeat(rating.rating_score)}{'☆'.repeat(5 - rating.rating_score)}
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          {new Date(rating.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-lg font-bold text-yellow-500">{rating.rating_score}/5</span>
                    </div>
                    {rating.review_text && (
                      <p className="text-sm text-slate-700 mt-2">{rating.review_text}</p>
                    )}
                    {rating.tags && rating.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {rating.tags.map(tag => (
                          <span key={tag} className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {rideHistory.length === 0 ? (
                <p className="text-center text-slate-600 py-8">No ride history</p>
              ) : (
                rideHistory.map(ride => (
                  <div key={ride.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {ride.start_address || `Pickup: (${ride.start_latitude.toFixed(3)}, ${ride.start_longitude.toFixed(3)})`}
                        </p>
                        <p className="text-sm text-slate-600 mt-1">
                          {ride.end_address || `Dropoff: (${ride.end_latitude.toFixed(3)}, ${ride.end_longitude.toFixed(3)})`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">₱{ride.final_price?.toLocaleString() || 0}</p>
                        <p className="text-xs text-slate-600">
                          {new Date(ride.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {ride.tip_amount > 0 && (
                      <p className="text-xs text-green-600 mt-2">Tip: ₱{ride.tip_amount}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 p-6 bg-slate-50 flex gap-3">
          <button
            className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors"
          >
            Message
          </button>
          <button
            className="flex-1 py-2 px-4 bg-slate-300 text-slate-900 rounded-lg hover:bg-slate-400 font-medium text-sm transition-colors"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
