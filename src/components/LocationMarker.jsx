import React, { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet icon issues (same fix as in HeaderMap.jsx)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const LocationMarker = ({ onLocationSelect, initialPosition }) => {
  const map = useMap()
  const markerRef = React.useRef(null)

  useEffect(() => {
    if (!map) return

    // Create custom marker icon using the fixed default
    const markerIcon = L.icon({
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    })

    // Create initial draggable marker at provided position
    const createDraggableMarker = (lat, lng) => {
      const marker = L.marker([lat, lng], {
        icon: markerIcon,
        draggable: true
      })
        .addTo(map)
        .bindPopup('Job Location')

      // Handle drag events to update coordinates
      marker.on('dragend', () => {
        const { lat: newLat, lng: newLng } = marker.getLatLng()
        if (onLocationSelect) {
          onLocationSelect(newLat, newLng)
        }
      })

      // Also update while dragging for visual feedback
      marker.on('drag', () => {
        const { lat: newLat, lng: newLng } = marker.getLatLng()
        if (onLocationSelect) {
          onLocationSelect(newLat, newLng)
        }
      })

      return marker
    }

    // Create initial marker
    markerRef.current = createDraggableMarker(initialPosition[0], initialPosition[1])

    // Handle map click to place/move marker
    const handleMapClick = (e) => {
      const { lat, lng } = e.latlng

      // Remove old marker
      if (markerRef.current) {
        map.removeLayer(markerRef.current)
      }

      // Add new marker at clicked location
      markerRef.current = createDraggableMarker(lat, lng)

      // Call callback with coordinates
      if (onLocationSelect) {
        onLocationSelect(lat, lng)
      }
    }

    map.on('click', handleMapClick)

    // Cleanup
    return () => {
      map.off('click', handleMapClick)
      if (markerRef.current) {
        map.removeLayer(markerRef.current)
      }
    }
  }, [map, onLocationSelect, initialPosition])

  return null
}

export default LocationMarker
