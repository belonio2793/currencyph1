import React, { useState } from 'react'

export default function DriverProfileModal({ driver, onClose, onRequestRide, loading }) {
  const [rideOffer, setRideOffer] = useState('')

  const handleRequest = () => {
    onRequestRide(driver.id, rideOffer)
    setRideOffer('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold">{driver.full_name || 'Driver'}</h2>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-4 h-4 ${i < Math.floor(driver.average_rating || 5) ? 'text-yellow-300' : 'text-white/30'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <span className="ml-2 font-semibold">{(driver.average_rating || 5).toFixed(1)}</span>
                </div>
                <span className="text-sm opacity-80">({driver.total_rides || 0} rides)</span>
              </div>
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
          {/* Vehicle Information */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Vehicle Information
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Vehicle Type:</span>
                <span className="font-medium text-slate-900 capitalize">{driver.vehicle_type || 'Car'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Brand:</span>
                <span className="font-medium text-slate-900">{driver.vehicle_brand || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Color:</span>
                <span className="font-medium text-slate-900">{driver.vehicle_color || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Plate:</span>
                <span className="font-mono font-medium text-slate-900">{driver.vehicle_plate || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Driver Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <p className="text-xs text-slate-600 font-medium">Completion Rate</p>
              <p className="text-lg font-bold text-green-600">98%</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-xs text-slate-600 font-medium">Response Time</p>
              <p className="text-lg font-bold text-blue-600">2 min</p>
            </div>
          </div>

          {/* Verification Status */}
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-900 text-sm">Verification</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <svg className={`w-5 h-5 ${driver.is_verified ? 'text-green-600' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className={driver.is_verified ? 'text-slate-900' : 'text-slate-500'}>Identity Verified</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className={`w-5 h-5 ${driver.is_phone_verified ? 'text-green-600' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className={driver.is_phone_verified ? 'text-slate-900' : 'text-slate-500'}>Phone Verified</span>
              </div>
            </div>
          </div>

          {/* Custom Offer Section */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-slate-900 mb-2">Custom Fare Offer (Optional)</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  placeholder="Enter custom amount in PHP"
                  value={rideOffer}
                  onChange={(e) => setRideOffer(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-1">Leave empty to use estimated fare</p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRequest}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:bg-slate-400"
          >
            {loading ? 'Requesting...' : 'Request Ride'}
          </button>
        </div>
      </div>
    </div>
  )
}
