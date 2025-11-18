import React from 'react'
import { Polyline, Popup } from 'react-leaflet'

export default function RoutePolyline({ geometry, distance, duration }) {
  if (!geometry || geometry.length === 0) {
    return null
  }

  // Convert GeoJSON coordinates to Leaflet format [lat, lng]
  const coordinates = geometry.map(coord => [coord[1], coord[0]])

  // Get midpoint for popup
  const midpoint = coordinates[Math.floor(coordinates.length / 2)]

  return (
    <>
      <Polyline
        positions={coordinates}
        color="#3B82F6"
        weight={4}
        opacity={0.8}
        dashArray="5, 5"
      >
        <Popup>
          <div className="text-sm space-y-1">
            <p className="font-semibold text-slate-900">Route Info</p>
            <p className="text-slate-700">
              Distance: {distance ? distance.toFixed(1) : '?'} km
            </p>
            <p className="text-slate-700">
              Time: {duration ? duration : '?'} min
            </p>
          </div>
        </Popup>
      </Polyline>
    </>
  )
}
