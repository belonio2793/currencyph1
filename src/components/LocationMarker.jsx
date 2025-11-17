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

    // Create initial marker at provided position
    markerRef.current = L.marker(initialPosition, { icon: markerIcon })
      .addTo(map)
      .bindPopup('Job Location')

    // Handle map click to place/move marker
    const handleMapClick = (e) => {
      const { lat, lng } = e.latlng
      
      // Remove old marker
      if (markerRef.current) {
        map.removeLayer(markerRef.current)
      }

      // Add new marker at clicked location
      markerRef.current = L.marker([lat, lng], { icon: markerIcon })
        .addTo(map)
        .bindPopup('Job Location')

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
