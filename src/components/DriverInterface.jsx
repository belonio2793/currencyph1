import React, { useState, useEffect } from 'react'
import { ridesMatchingService } from '../lib/ridesMatchingService'
import RideUserProfile from './RideUserProfile'
import ChatModal from './ChatModal'

export default function DriverInterface({ userId, userLocation }) {
  const [activeRequests, setActiveRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [matches, setMatches] = useState([])
  const [activeTab, setActiveTab] = useState('requests') // 'requests', 'pending', 'active'
  const [error, setError] = useState(null)

  // Load active rider requests
  useEffect(() => {
    loadActiveRequests()

    // Subscribe to new requests in real-time
    const subscription = ridesMatchingService.subscribeToRideRequests('driver', (newRequest) => {
      setActiveRequests(prev => [newRequest, ...prev])
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load user's matches
  useEffect(() => {
    loadMatches()
  }, [activeTab])

  const loadActiveRequests = async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await ridesMatchingService.getActiveRequests('driver', 50)
    if (error) {
      setError('Failed to load requests')
      console.error('Error loading requests:', error)
    } else {
      setActiveRequests(data || [])
    }
    setLoading(false)
  }

  const loadMatches = async () => {
    let { data, error } = null

    if (activeTab === 'pending') {
      ({ data, error } = await ridesMatchingService.getPendingMatches(userId))
    } else {
      ({ data, error } = await ridesMatchingService.getUserMatches(userId, activeTab === 'active' ? 'in_progress' : 'confirmed'))
    }

    if (error) {
      console.error('Error loading matches:', error)
    } else {
      setMatches(data || [])
    }
  }

  const handleAcceptRequest = async (request) => {
    try {
      setLoading(true)
      
      // Create a match between rider and driver
      const { data, error } = await ridesMatchingService.createMatch(
        request.id,
        request.user_id, // rider
        userId, // current driver
        {
          geometry: null, // Will be calculated later
          distance: request.estimated_distance,
          duration: request.estimated_duration,
          fare: request.estimated_fare,
          pickup: {
            latitude: request.start_latitude,
            longitude: request.start_longitude
          },
          dropoff: {
            latitude: request.end_latitude,
            longitude: request.end_longitude
          }
        }
      )

      if (error) throw error

      // Accept the request from driver side
      const acceptResult = await ridesMatchingService.acceptRequest(data.id, 'driver')
      if (acceptResult.error) throw acceptResult.error

      // Remove from active requests
      setActiveRequests(prev => prev.filter(r => r.id !== request.id))
      setSelectedRequest(null)
      
      // Reload matches
      loadMatches()
      setActiveTab('pending')
    } catch (err) {
      setError('Failed to accept request: ' + err.message)
      console.error('Error accepting request:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRejectRequest = async (requestId) => {
    setActiveRequests(prev => prev.filter(r => r.id !== requestId))
    setSelectedRequest(null)
  }

  const handleConfirmMatch = async (matchId) => {
    try {
      setLoading(true)
      const { error } = await ridesMatchingService.acceptRequest(matchId, 'driver')
      if (error) throw error
      await loadMatches()
    } catch (err) {
      setError('Failed to confirm match: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleStartTrip = async (matchId) => {
    try {
      const { error } = await ridesMatchingService.updateMatchStatus(matchId, 'in_progress')
      if (error) throw error
      await loadMatches()
      setActiveTab('active')
    } catch (err) {
      setError('Failed to start trip: ' + err.message)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Driver Mode
        </h2>
        <p className="text-slate-600">Accept rider requests and manage your trips</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-900">{error}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'requests'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Available Requests
            {activeRequests.length > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                {activeRequests.length}
              </span>
            )}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'pending'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Pending Confirmation
            {matches.filter(m => m.status !== 'confirmed' && m.status !== 'in_progress').length > 0 && (
              <span className="bg-amber-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                {matches.filter(m => m.status !== 'confirmed' && m.status !== 'in_progress').length}
              </span>
            )}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'active'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Active Trips
            {matches.filter(m => m.status === 'in_progress').length > 0 && (
              <span className="bg-green-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                {matches.filter(m => m.status === 'in_progress').length}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-slate-600">Loading requests...</p>
            </div>
          ) : activeRequests.length === 0 ? (
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg border border-slate-200 p-12 text-center">
              <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m7 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-slate-600 font-medium">No active requests</p>
              <p className="text-slate-500 text-sm mt-1">Check back soon for new rider requests</p>
            </div>
          ) : (
            activeRequests.map(request => (
              <div key={request.id} className="bg-white rounded-lg shadow border border-slate-200 p-4 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedRequest(request)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{request.start_address || 'Pickup'}</h3>
                    <p className="text-sm text-slate-600">→ {request.end_address || 'Dropoff'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">₱{request.estimated_fare?.toFixed(2) || '0.00'}</p>
                    <p className="text-xs text-slate-500">{request.estimated_duration} min</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold">
                    {request.user?.display_name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{request.user?.full_name || 'Rider'}</p>
                    <p className="text-xs text-slate-500">★ 5.0</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedRequest(request)
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pending Matches Tab */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {matches.length === 0 ? (
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-12 text-center">
              <p className="text-slate-600">No pending matches</p>
            </div>
          ) : (
            matches.map(match => (
              <div key={match.id} className="bg-white rounded-lg shadow border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900">
                    {match.status === 'pending' ? 'New Request' : match.status === 'accepted_by_driver' ? 'Awaiting Rider Confirmation' : 'Rider Accepted'}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    match.status === 'pending' ? 'bg-blue-100 text-blue-800' :
                    match.status === 'accepted_by_driver' ? 'bg-amber-100 text-amber-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {match.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Pickup</p>
                    <p className="text-sm font-medium text-slate-900">{match.rider?.display_name || 'Rider'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Fare</p>
                    <p className="text-sm font-bold text-green-600">₱{match.estimated_fare?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  {match.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleConfirmMatch(match.id)}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setMatches(prev => prev.filter(m => m.id !== match.id))}
                        className="flex-1 px-4 py-2 bg-slate-200 text-slate-900 rounded-lg font-medium hover:bg-slate-300"
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {match.status === 'confirmed' && (
                    <button
                      onClick={() => handleStartTrip(match.id)}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                    >
                      Start Trip
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedRequest(null)
                      setShowChat(true)
                    }}
                    className="px-4 py-2 bg-slate-200 text-slate-900 rounded-lg font-medium hover:bg-slate-300"
                  >
                    Message
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Active Trips Tab */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {matches.length === 0 ? (
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-12 text-center">
              <p className="text-slate-600">No active trips</p>
            </div>
          ) : (
            matches.map(match => (
              <div key={match.id} className="bg-white rounded-lg shadow border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900">Trip in Progress</h3>
                  <svg className="w-6 h-6 text-green-500 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold">
                      {match.rider?.full_name?.charAt(0) || 'R'}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{match.rider?.full_name || 'Rider'}</p>
                      <p className="text-xs text-slate-500">★ 5.0</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 mb-4">
                  <p className="text-xs text-slate-600 mb-2">Estimated Completion</p>
                  <p className="text-lg font-bold text-slate-900">{match.estimated_duration} minutes</p>
                </div>

                <button
                  onClick={() => setShowChat(true)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  Message Rider
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Request Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-lg shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Request Details</h2>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Rider Info */}
              <div className="flex items-center gap-4 pb-6 border-b border-slate-200">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                  {selectedRequest.user?.display_name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-slate-900">{selectedRequest.user?.display_name || 'Rider'}</h3>
                  <p className="text-slate-600">{selectedRequest.user?.email}</p>
                  <p className="text-sm text-slate-500">★ {selectedRequest.user?.average_rating?.toFixed(1) || '5.0'} · 42 rides</p>
                </div>
                <button
                  onClick={() => {
                    setShowProfile(true)
                    setShowChat(false)
                  }}
                  className="px-4 py-2 bg-slate-200 text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-300"
                >
                  View Profile
                </button>
              </div>

              {/* Trip Details */}
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Pickup</p>
                  <p className="text-sm font-medium text-slate-900">{selectedRequest.start_address || 'Pickup location'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Dropoff</p>
                  <p className="text-sm font-medium text-slate-900">{selectedRequest.end_address || 'Dropoff location'}</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-600 mb-1">Distance</p>
                    <p className="font-bold text-slate-900">{selectedRequest.estimated_distance?.toFixed(1) || '0'} km</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-600 mb-1">Duration</p>
                    <p className="font-bold text-slate-900">{selectedRequest.estimated_duration || '0'} min</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-green-600 mb-1">Fare</p>
                    <p className="font-bold text-green-600">₱{selectedRequest.estimated_fare?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => handleAcceptRequest(selectedRequest)}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:bg-slate-400 transition-colors"
                >
                  {loading ? 'Processing...' : 'Accept Request'}
                </button>
                <button
                  onClick={() => handleRejectRequest(selectedRequest.id)}
                  className="flex-1 px-6 py-3 bg-slate-200 text-slate-900 rounded-lg font-bold hover:bg-slate-300 transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
