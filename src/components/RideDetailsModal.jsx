import React, { useState, useEffect } from 'react'

export default function RideDetailsModal({ ride, driver, onClose, onCancelRide, onUpdateStatus, loading }) {
  const [elapsedTime, setElapsedTime] = useState(0)

  useEffect(() => {
    if (ride.status !== 'completed' && ride.status !== 'cancelled') {
      const timer = setInterval(() => {
        setElapsedTime(prev => prev + 1)
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [ride.status])

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'requested': return 'bg-yellow-100 border-yellow-300 text-yellow-900'
      case 'accepted': return 'bg-green-100 border-green-300 text-green-900'
      case 'picked-up': return 'bg-blue-100 border-blue-300 text-blue-900'
      case 'in-progress': return 'bg-blue-100 border-blue-300 text-blue-900'
      case 'completed': return 'bg-slate-100 border-slate-300 text-slate-900'
      case 'cancelled': return 'bg-red-100 border-red-300 text-red-900'
      default: return 'bg-slate-100 border-slate-300 text-slate-900'
    }
  }

  const getStatusLabel = (status) => {
    switch(status) {
      case 'requested': return 'Searching for driver...'
      case 'accepted': return 'Driver accepted - arriving soon'
      case 'picked-up': return 'You have been picked up'
      case 'in-progress': return 'Ride in progress'
      case 'completed': return 'Ride completed'
      case 'cancelled': return 'Ride cancelled'
      default: return status
    }
  }

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return (R * c).toFixed(2)
  }

  const distance = calculateDistance(
    ride.start_latitude, ride.start_longitude,
    ride.end_latitude, ride.end_longitude
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`text-white p-6 ${getStatusColor(ride.status).replace('text-', 'bg-').replace('border', 'border')}`}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold">Ride Details</h2>
              <p className={`text-sm mt-1 px-2 py-1 rounded-full inline-block border ${getStatusColor(ride.status)}`}>
                {getStatusLabel(ride.status)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Driver Info (if assigned) */}
          {driver && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Driver Information
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Name:</span>
                  <span className="font-medium text-slate-900">{driver.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Phone:</span>
                  <span className="font-medium text-slate-900">{driver.phone_number || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">Rating:</span>
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className={`w-4 h-4 ${i < Math.floor(driver.average_rating || 5) ? 'text-yellow-400' : 'text-slate-300'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                    <span className="ml-2 font-semibold text-slate-900">{(driver.average_rating || 5).toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Ride Statistics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-purple-50 to-white rounded-lg p-3 border border-purple-200 text-center">
              <p className="text-xs text-slate-600 font-medium">Distance</p>
              <p className="text-lg font-bold text-purple-600">{distance} km</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg p-3 border border-blue-200 text-center">
              <p className="text-xs text-slate-600 font-medium">Elapsed Time</p>
              <p className="text-lg font-bold text-blue-600">{formatTime(elapsedTime)}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-white rounded-lg p-3 border border-green-200 text-center">
              <p className="text-xs text-slate-600 font-medium">Estimated Fare</p>
              <p className="text-lg font-bold text-green-600">₱{(ride.estimated_total_price || 0).toFixed(2)}</p>
            </div>
          </div>

          {/* Route Information */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-3">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.553-.894L9 7m0 13l6.447 3.268A1 1 0 0021 17.382V6.618a1 1 0 00-1.553-.894L15 8m0 13V8m0 0L9 5m6 8v8m0-13L9 5" />
              </svg>
              Route
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-600 font-medium mb-1">From</p>
                <p className="text-sm text-slate-900 font-medium">{ride.start_address || 'Location not named'}</p>
                <p className="text-xs text-slate-600 font-mono">Lat: {ride.start_latitude.toFixed(6)}, Lng: {ride.start_longitude.toFixed(6)}</p>
              </div>
              <div className="flex justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-slate-600 font-medium mb-1">To</p>
                <p className="text-sm text-slate-900 font-medium">{ride.end_address || 'Location not named'}</p>
                <p className="text-xs text-slate-600 font-mono">Lat: {ride.end_latitude.toFixed(6)}, Lng: {ride.end_longitude.toFixed(6)}</p>
              </div>
            </div>
          </div>

          {/* Ride Type */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <p className="text-xs text-slate-600 font-medium mb-1">Ride Type</p>
            <p className="text-sm font-semibold text-slate-900 capitalize">{ride.ride_type || 'Standard Ride'}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex gap-3">
          {ride.status !== 'completed' && ride.status !== 'cancelled' && (
            <>
              <button
                onClick={() => onCancelRide(ride.id)}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 font-medium transition-colors disabled:bg-slate-200 disabled:text-slate-400"
              >
                Cancel Ride
              </button>
              {ride.status === 'in-progress' && (
                <button
                  onClick={() => onUpdateStatus(ride.id, 'completed')}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:bg-slate-400"
                >
                  Complete Ride
                </button>
              )}
            </>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
