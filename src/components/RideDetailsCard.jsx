import React, { useState, useEffect } from 'react'
import { getRoute, calculateFare, formatDistance, formatDuration } from '../lib/routingService'

export default function RideDetailsCard({ 
  startCoord, 
  endCoord, 
  rideType = 'ride-share',
  onDetailsUpdate,
  loading = false
}) {
  const [routeDetails, setRouteDetails] = useState(null)
  const [fareDetails, setFareDetails] = useState(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!startCoord || !endCoord) {
      setRouteDetails(null)
      setFareDetails(null)
      return
    }

    const fetchRoute = async () => {
      setRouteLoading(true)
      setError(null)
      try {
        const route = await getRoute(
          startCoord.latitude,
          startCoord.longitude,
          endCoord.latitude,
          endCoord.longitude
        )

        setRouteDetails(route)

        // Calculate fare with 1.0x demand multiplier (can be adjusted based on actual demand)
        const fare = calculateFare(route.distance, route.duration, rideType, 1.0)
        setFareDetails(fare)

        // Notify parent component with updated details
        if (onDetailsUpdate) {
          onDetailsUpdate({
            distance: route.distance,
            duration: route.duration,
            fare,
            geometry: route.geometry
          })
        }
      } catch (err) {
        setError(err.message || 'Failed to calculate route')
        console.error('Route calculation error:', err)
      } finally {
        setRouteLoading(false)
      }
    }

    fetchRoute()
  }, [startCoord, endCoord, rideType, onDetailsUpdate])

  if (!startCoord || !endCoord) {
    return null
  }

  if (routeLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-slate-600 font-medium">Calculating route...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-lg shadow-md border border-red-200 p-6 mb-6">
        <p className="text-red-700 font-medium">Error calculating route: {error}</p>
      </div>
    )
  }

  if (!routeDetails || !fareDetails) {
    return null
  }

  const demandColor = fareDetails.demandMultiplier > 1.5 ? 'text-red-600' : 
                      fareDetails.demandMultiplier > 1.2 ? 'text-orange-600' : 
                      'text-green-600'

  return (
    <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6 mb-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Ride Details
        </h3>
        {fareDetails.demandMultiplier > 1.0 && (
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${demandColor} ${
            fareDetails.demandMultiplier > 1.5 ? 'bg-red-100' :
            fareDetails.demandMultiplier > 1.2 ? 'bg-orange-100' :
            'bg-green-100'
          }`}>
            {(fareDetails.demandMultiplier * 100).toFixed(0)}% Surge
          </span>
        )}
      </div>

      {/* Route Info */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-xs text-slate-600 font-medium mb-1">Distance</p>
          <p className="text-2xl font-bold text-blue-600">{formatDistance(routeDetails.distance)}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <p className="text-xs text-slate-600 font-medium mb-1">Duration</p>
          <p className="text-2xl font-bold text-purple-600">{formatDuration(routeDetails.duration)}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <p className="text-xs text-slate-600 font-medium mb-1">ETA</p>
          <p className="text-2xl font-bold text-green-600">
            {new Date(Date.now() + routeDetails.duration * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {/* Fare Breakdown */}
      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-2">
        <p className="text-sm font-semibold text-slate-900 mb-3">Fare Breakdown</p>
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-600">Base Fare</span>
          <span className="font-mono font-medium text-slate-900">₱{fareDetails.baseFare}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-600">Distance ({routeDetails.distance.toFixed(1)} km × ₱{(fareDetails.distanceFare / routeDetails.distance).toFixed(0)}/km)</span>
          <span className="font-mono font-medium text-slate-900">₱{fareDetails.distanceFare}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-600">Time ({routeDetails.duration} min)</span>
          <span className="font-mono font-medium text-slate-900">₱{fareDetails.timeFare}</span>
        </div>
        {fareDetails.demandMultiplier > 1.0 && (
          <div className="flex justify-between items-center text-sm text-orange-700 bg-orange-50 px-2 py-1 rounded">
            <span>Surge Pricing ({(fareDetails.demandMultiplier * 100).toFixed(0)}%)</span>
            <span className="font-mono font-medium">×{fareDetails.demandMultiplier.toFixed(1)}</span>
          </div>
        )}
        <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between items-center text-sm">
          <span className="text-slate-600">Subtotal</span>
          <span className="font-mono font-medium text-slate-900">₱{fareDetails.subtotal}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-600">VAT (12%)</span>
          <span className="font-mono font-medium text-slate-900">₱{fareDetails.vat}</span>
        </div>
        <div className="border-t border-slate-300 pt-2 mt-2 flex justify-between items-center">
          <span className="font-semibold text-slate-900">Estimated Total</span>
          <span className="text-2xl font-bold text-blue-600">₱{fareDetails.total}</span>
        </div>
      </div>

      {/* Route Steps */}
      {routeDetails.steps && routeDetails.steps.length > 0 && (
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <p className="text-sm font-semibold text-slate-900 mb-3">Route Steps</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {routeDetails.steps.slice(0, 5).map((step, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <span className="font-mono text-slate-500 min-w-fit">{idx + 1}.</span>
                <p className="text-slate-700">
                  {step.name ? `${step.name}` : 'Continue'}
                  {step.distance && ` (${(step.distance / 1000).toFixed(1)} km)`}
                </p>
              </div>
            ))}
            {routeDetails.steps.length > 5 && (
              <p className="text-xs text-slate-500 italic">+{routeDetails.steps.length - 5} more steps...</p>
            )}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 flex gap-2">
        <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-blue-800">
          Final amount may vary based on actual route, traffic conditions, and driver availability. Prices are estimates.
        </p>
      </div>
    </div>
  )
}
