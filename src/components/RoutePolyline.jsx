import React from 'react'
import { Polyline, Popup } from 'react-leaflet'

export default function RoutePolyline({ geometry, distance, duration, fare = null }) {
  if (!geometry || geometry.length === 0) {
    return null
  }

  // Convert GeoJSON coordinates to Leaflet format [lat, lng]
  const coordinates = geometry.map(coord => [coord[1], coord[0]])

  // Get midpoint for popup
  const midpoint = coordinates[Math.floor(coordinates.length / 2)]

  // Calculate ETA
  const etaTime = new Date(Date.now() + (duration || 0) * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  // Calculate total fare if fare details exist
  const calculateTotalFare = () => {
    if (!fare) return null
    const baseTotal = (fare.baseFare || 0) + (fare.distanceFare || 0) + (fare.timeFare || 0)
    return (baseTotal * (fare.demandMultiplier || 1)).toFixed(0)
  }

  const totalFare = calculateTotalFare()

  return (
    <>
      <Polyline
        positions={coordinates}
        color="#3B82F6"
        weight={5}
        opacity={0.85}
        lineCap="round"
        lineJoin="round"
      >
        <Popup>
          <div className="space-y-2 p-2" style={{ minWidth: '200px' }}>
            <div className="bg-blue-600 text-white rounded-t p-2">
              <p className="font-bold text-sm">Trip Summary</p>
            </div>

            <div className="space-y-2 px-2 py-1">
              {/* Distance */}
              <div className="flex justify-between items-center">
                <span className="text-slate-700 text-xs font-medium">Distance:</span>
                <span className="text-slate-900 font-bold text-sm">{distance ? distance.toFixed(1) : '?'} km</span>
              </div>

              {/* Duration */}
              <div className="flex justify-between items-center">
                <span className="text-slate-700 text-xs font-medium">Duration:</span>
                <span className="text-slate-900 font-bold text-sm">{duration || '?'} min</span>
              </div>

              {/* ETA */}
              <div className="flex justify-between items-center">
                <span className="text-slate-700 text-xs font-medium">ETA:</span>
                <span className="text-slate-900 font-bold text-sm">{etaTime}</span>
              </div>

              {/* Fare if available */}
              {totalFare && (
                <div className="border-t border-slate-200 pt-1 mt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700 text-xs font-medium">Estimated Fare:</span>
                    <span className="text-green-600 font-bold text-sm">₱{totalFare}</span>
                  </div>
                  {fare && fare.demandMultiplier > 1.0 && (
                    <p className="text-orange-600 text-xs mt-1">
                      Surge: {(fare.demandMultiplier * 100).toFixed(0)}%
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </Popup>
      </Polyline>
    </>
  )
}
