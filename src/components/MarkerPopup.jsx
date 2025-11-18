import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

// Custom marker icons
const createMarkerIcon = (color) => {
  const svgIcon = `
    <svg width="32" height="41" viewBox="0 0 32 41" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.16 0 0 7.16 0 16c0 8 16 25 16 25s16-17 16-25c0-8.84-7.16-16-16-16z" 
            fill="${color}"/>
      <circle cx="16" cy="16" r="5" fill="white"/>
    </svg>
  `

  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svgIcon)}`,
    iconSize: [32, 41],
    iconAnchor: [16, 41],
    popupAnchor: [0, -41],
  })
}

export default function MarkerPopup({
  position,
  color,
  type,
  label,
  latitude,
  longitude,
  onUpdate,
  onSave,
  onRemove
}) {
  const [lat, setLat] = useState(latitude ? latitude.toFixed(6) : '')
  const [lng, setLng] = useState(longitude ? longitude.toFixed(6) : '')
  const [editMode, setEditMode] = useState(false)
  const markerRef = useRef(null)
  const map = useMap()

  useEffect(() => {
    setLat(latitude ? latitude.toFixed(6) : '')
    setLng(longitude ? longitude.toFixed(6) : '')
  }, [latitude, longitude])

  const eventHandlers = useMemo(() => ({
    dragend() {
      if (markerRef.current != null) {
        const newLat = markerRef.current.getLatLng().lat
        const newLng = markerRef.current.getLatLng().lng
        setLat(newLat.toFixed(6))
        setLng(newLng.toFixed(6))
        if (onUpdate) {
          onUpdate({ latitude: newLat, longitude: newLng })
        }
      }
    },
  }), [onUpdate])

  const handleSaveCoordinates = () => {
    const newLat = parseFloat(lat)
    const newLng = parseFloat(lng)

    if (isNaN(newLat) || isNaN(newLng)) {
      alert('Please enter valid latitude and longitude values')
      return
    }

    if (newLat < -90 || newLat > 90) {
      alert('Latitude must be between -90 and 90')
      return
    }

    if (newLng < -180 || newLng > 180) {
      alert('Longitude must be between -180 and 180')
      return
    }

    if (onSave) {
      onSave({ latitude: newLat, longitude: newLng })
    }
    setEditMode(false)
  }

  if (!position || latitude === undefined || longitude === undefined) {
    return null
  }

  return (
    <Marker
      position={position}
      icon={createMarkerIcon(color)}
      draggable={true}
      eventHandlers={eventHandlers}
      ref={markerRef}
    >
      <Popup className="custom-popup" maxWidth={320} closeButton={true}>
        <div className="p-3 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              {type === 'start' ? (
                <>
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Pickup Location
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.553-.894L9 7m0 13l6.447 3.268A1 1 0 0021 17.382V6.618a1 1 0 00-1.553-.894L15 8m0 13V8m0 0L9 5m6 8v8m0-13L9 5" />
                  </svg>
                  Destination
                </>
              )}
            </h3>
            <button
              onClick={onRemove}
              className="p-1 hover:bg-red-50 rounded text-red-600"
              title="Remove location"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Coordinates Display/Edit */}
          {!editMode ? (
            <div className="bg-slate-50 rounded-lg p-3 space-y-2">
              <div className="text-sm">
                <p className="text-slate-600 font-medium">Latitude</p>
                <p className="text-slate-900 font-mono text-lg">{lat}</p>
              </div>
              <div className="text-sm">
                <p className="text-slate-600 font-medium">Longitude</p>
                <p className="text-slate-900 font-mono text-lg">{lng}</p>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 rounded-lg p-3 space-y-2 border border-blue-200">
              <div className="text-sm">
                <label className="text-slate-600 font-medium">Latitude</label>
                <input
                  type="number"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  step="0.000001"
                  min="-90"
                  max="90"
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm mt-1 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="text-sm">
                <label className="text-slate-600 font-medium">Longitude</label>
                <input
                  type="number"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  step="0.000001"
                  min="-180"
                  max="180"
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm mt-1 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {!editMode ? (
              <>
                <button
                  onClick={() => setEditMode(true)}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(`${lat}, ${lng}`)
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-slate-200 text-slate-700 rounded text-sm font-medium hover:bg-slate-300 transition-colors flex items-center justify-center gap-1"
                  title="Copy coordinates"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSaveCoordinates}
                  className="flex-1 px-3 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save
                </button>
                <button
                  onClick={() => {
                    setLat(latitude.toFixed(6))
                    setLng(longitude.toFixed(6))
                    setEditMode(false)
                  }}
                  className="flex-1 px-3 py-2 bg-slate-300 text-slate-700 rounded text-sm font-medium hover:bg-slate-400 transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>

          {/* Info Text */}
          <p className="text-xs text-slate-600 bg-slate-100 p-2 rounded">
            You can drag the marker on the map to update coordinates, or edit manually above.
          </p>
        </div>
      </Popup>
    </Marker>
  )
}
