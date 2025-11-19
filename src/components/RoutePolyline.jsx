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
        <Popup maxWidth={200} minWidth={180} closeButton={false}>
          <div style={{ padding: '8px', textAlign: 'center' }}>
            <p className="font-bold text-sm text-slate-900 mb-2">Route</p>
            <div className="text-xs text-slate-700 space-y-1">
              <p><span className="font-medium">Distance:</span> {distance ? distance.toFixed(1) : '?'} km</p>
              <p><span className="font-medium">Duration:</span> {duration || '?'} min</p>
            </div>
          </div>
        </Popup>
      </Polyline>
    </>
  )
}
