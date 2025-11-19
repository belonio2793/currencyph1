import React, { useState, useEffect } from 'react'
import { ridesMatchingService } from '../lib/ridesMatchingService'
import ChatModal from './ChatModal'

export default function RiderInterface({ userId, userLocation, startCoord, endCoord, routeDetails, selectedRideType, selectedService }) {
  const [showCreateRequest, setShowCreateRequest] = useState(!startCoord || !endCoord)
  const [activeRequests, setActiveRequests] = useState([])
  const [availableDrivers, setAvailableDrivers] = useState([])
  const [myMatches, setMyMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('available') // 'available', 'pending', 'active'
  const [error, setError] = useState(null)
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [showChat, setShowChat] = useState(false)
  const [currentRideRequest, setCurrentRideRequest] = useState(null)

  useEffect(() => {
    if (startCoord && endCoord) {
      loadAvailableDrivers()
      loadMyMatches()
      
      const subscription = ridesMatchingService.subscribeToRideRequests('rider', (newRequest) => {
        // Only add driver requests
        if (newRequest.user_type === 'driver') {
          setAvailableDrivers(prev => [newRequest, ...prev])
        }
      })

      return () => subscription.unsubscribe()
    }
  }, [startCoord, endCoord])

  const loadAvailableDrivers = async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await ridesMatchingService.getActiveRequests('rider', 50)
    if (error) {
      setError('Failed to load drivers')
      console.error('Error loading drivers:', error)
    } else {
      setAvailableDrivers(data || [])
    }
    setLoading(false)
  }

  const loadMyMatches = async () => {
    let { data, error } = null

    if (activeTab === 'pending') {
      ({ data, error } = await ridesMatchingService.getPendingMatches(userId))
    } else {
      ({ data, error } = await ridesMatchingService.getUserMatches(userId, activeTab === 'active' ? 'in_progress' : 'confirmed'))
    }

    if (error) {
      console.error('Error loading matches:', error)
    } else {
      setMyMatches(data || [])
    }
  }

  const handlePostRequest = async () => {
    if (!startCoord || !endCoord) {
      setError('Please select both pickup and dropoff locations')
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Create rider request
      const { data, error } = await ridesMatchingService.createRideRequest(
        userId,
        'rider',
        {
          latitude: startCoord.latitude,
          longitude: startCoord.longitude,
          address: startCoord.address
        },
        {
          latitude: endCoord.latitude,
          longitude: endCoord.longitude,
          address: endCoord.address
        },
        {
          distance: routeDetails?.distance || 0,
          duration: routeDetails?.duration || 0,
          fare: routeDetails?.fare || 0,
          vehicleType: selectedRideType || 'ride-share',
          serviceType: selectedService || 'standard',
          passengersCount: 1
        }
      )

      if (error) throw error

      setCurrentRideRequest(data)
      setShowCreateRequest(false)
      setActiveTab('available')
    } catch (err) {
      setError('Failed to post request: ' + err.message)
      console.error('Error posting request:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptDriver = async (driver) => {
    try {
      setLoading(true)
      setError(null)

      // Create a match
      const { data, error } = await ridesMatchingService.createMatch(
        driver.id,
        userId, // rider
        driver.user_id, // driver
        {
          geometry: null,
          distance: driver.estimated_distance,
          duration: driver.estimated_duration,
          fare: driver.estimated_fare,
          pickup: {
            latitude: startCoord.latitude,
            longitude: startCoord.longitude
          },
          dropoff: {
            latitude: endCoord.latitude,
            longitude: endCoord.longitude
          }
        }
      )

      if (error) throw error

      // Accept from rider side
      const acceptResult = await ridesMatchingService.acceptRequest(data.id, 'rider')
      if (acceptResult.error) throw acceptResult.error

      await loadMyMatches()
      setActiveTab('pending')
      setSelectedDriver(null)
    } catch (err) {
      setError('Failed to accept driver: ' + err.message)
      console.error('Error accepting driver:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmMatch = async (matchId) => {
    try {
      setLoading(true)
      const { error } = await ridesMatchingService.acceptRequest(matchId, 'rider')
      if (error) throw error
      await loadMyMatches()
    } catch (err) {
      setError('Failed to confirm match: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Find a Ride</h2>
        <p className="text-slate-600">Browse available drivers or post a request</p>
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
          onClick={() => setActiveTab('available')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'available'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Available Drivers
            {availableDrivers.length > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                {availableDrivers.length}
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
            {myMatches.filter(m => m.status !== 'confirmed' && m.status !== 'in_progress').length > 0 && (
              <span className="bg-amber-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                {myMatches.filter(m => m.status !== 'confirmed' && m.status !== 'in_progress').length}
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
            My Rides
            {myMatches.filter(m => m.status === 'in_progress').length > 0 && (
              <span className="bg-green-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                {myMatches.filter(m => m.status === 'in_progress').length}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Available Drivers Tab */}
      {activeTab === 'available' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-slate-600">Loading drivers...</p>
            </div>
          ) : availableDrivers.length === 0 ? (
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg border border-slate-200 p-12 text-center">
              <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m7 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-slate-600 font-medium">No drivers available</p>
              <p className="text-slate-500 text-sm mt-1">Check back soon for available drivers in your area</p>
            </div>
          ) : (
            availableDrivers.map(driver => (
              <div 
                key={driver.id}
                className="bg-white rounded-lg shadow border border-slate-200 p-4 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedDriver(driver)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{driver.user?.display_name || 'Driver'}</h3>
                    <p className="text-sm text-slate-600">{driver.vehicle_type ? driver.vehicle_type.charAt(0).toUpperCase() + driver.vehicle_type.slice(1) : 'Economy'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">₱{driver.estimated_fare?.toFixed(2) || '0.00'}</p>
                    <p className="text-xs text-slate-500">{driver.estimated_duration} min</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-sm font-bold">
                    {driver.user?.display_name?.charAt(0) || 'D'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{driver.user?.display_name || 'Driver'}</p>
                    <p className="text-xs text-slate-500">★ {driver.user?.average_rating?.toFixed(1) || '5.0'} · {driver.user?.total_rides_as_driver || 0} trips</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAcceptDriver(driver)
                    }}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-slate-400"
                  >
                    Book
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
          {myMatches.length === 0 ? (
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-12 text-center">
              <p className="text-slate-600">No pending matches</p>
            </div>
          ) : (
            myMatches.map(match => (
              <div key={match.id} className="bg-white rounded-lg shadow border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900">
                    {match.status === 'pending' ? 'Waiting for Driver' : match.status === 'accepted_by_rider' ? 'Driver Accepted' : 'Ready to Start'}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    match.status === 'pending' ? 'bg-blue-100 text-blue-800' :
                    match.status === 'accepted_by_rider' ? 'bg-amber-100 text-amber-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {match.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-200">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-lg font-bold">
                    {match.driver?.display_name?.charAt(0) || 'D'}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{match.driver?.display_name || 'Driver'}</p>
                    <p className="text-sm text-slate-500">★ {match.driver?.average_rating?.toFixed(1) || '5.0'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">₱{match.estimated_fare?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  {match.status === 'accepted_by_rider' && (
                    <button
                      onClick={() => handleConfirmMatch(match.id)}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                    >
                      Confirm Ride
                    </button>
                  )}
                  <button
                    onClick={() => setShowChat(true)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                  >
                    Message
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Active Rides Tab */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {myMatches.length === 0 ? (
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-12 text-center">
              <p className="text-slate-600">No active rides</p>
            </div>
          ) : (
            myMatches.map(match => (
              <div key={match.id} className="bg-white rounded-lg shadow border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900">Ride in Progress</h3>
                  <svg className="w-6 h-6 text-green-500 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>

                <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-200">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-lg font-bold">
                    {match.driver?.display_name?.charAt(0) || 'D'}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{match.driver?.display_name || 'Driver'}</p>
                    <p className="text-sm text-slate-500">★ {match.driver?.average_rating?.toFixed(1) || '5.0'}</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 mb-4">
                  <p className="text-xs text-slate-600 mb-2">ETA</p>
                  <p className="text-lg font-bold text-slate-900">{match.estimated_duration} minutes</p>
                </div>

                <button
                  onClick={() => setShowChat(true)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  Message Driver
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
