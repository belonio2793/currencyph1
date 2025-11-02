import React, { useEffect, useState } from 'react'

const GOOGLE_MAPS_API_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_API_KEY) || (typeof process !== 'undefined' && process.env?.VITE_GOOGLE_API_KEY) || (typeof process !== 'undefined' && process.env?.GOOGLE_API_KEY) || ''

export default function CityStreetView({ city, mode = 'map' }) {
  const [mapElement, setMapElement] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (mode === 'map' && city) {
      loadGoogleMapsLibrary()
    }
  }, [city, mode])

  const loadGoogleMapsLibrary = async () => {
    if (window.google && window.google.maps) {
      initializeMap()
      return
    }

    if (!GOOGLE_MAPS_API_KEY) {
      console.error('Google Maps API key not configured (VITE_GOOGLE_API_KEY)')
      setIsLoading(false)
      return
    }
    const script = document.createElement('script')
    const libraries = 'places,geometry'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=${libraries}`
    script.async = true
    script.defer = true

    script.onload = () => {
      initializeMap()
    }

    script.onerror = () => {
      setIsLoading(false)
      console.error('Failed to load Google Maps API')
    }

    document.head.appendChild(script)
  }

  const initializeMap = () => {
    const cityCoords = {
      Manila: { lat: 14.5994, lng: 120.9842 },
      Quezon: { lat: 14.6349, lng: 121.0388 },
      Cebu: { lat: 10.3157, lng: 123.8854 },
      Davao: { lat: 7.1315, lng: 125.6521 },
      Cagayan: { lat: 8.4865, lng: 124.6467 },
      Makati: { lat: 14.5547, lng: 121.0244 },
      Iloilo: { lat: 10.6918, lng: 122.5637 },
      Baguio: { lat: 16.4023, lng: 120.5960 },
      Bacolod: { lat: 10.3906, lng: 122.9806 },
      Cavite: { lat: 14.3568, lng: 120.8853 }
    }

    const coords = Object.values(cityCoords)[0]
    const cityNameKey = Object.keys(cityCoords).find(
      k => k.toLowerCase() === city.name.toLowerCase().split(' ')[0]
    )

    if (cityNameKey) {
      const cityCoord = cityCoords[cityNameKey]
      coords.lat = cityCoord.lat
      coords.lng = cityCoord.lng
    }

    if (!mapElement) return

    const map = new window.google.maps.Map(mapElement, {
      zoom: 12,
      center: coords,
      mapTypeId: 'roadmap',
      styles: [
        {
          elementType: 'geometry',
          stylers: [{ color: '#1a202c' }]
        },
        {
          elementType: 'labels.text.stroke',
          stylers: [{ color: '#1a202c' }]
        },
        {
          elementType: 'labels.text.fill',
          stylers: [{ color: '#cbd5e1' }]
        }
      ]
    })

    // Add marker for city
    new window.google.maps.Marker({
      position: coords,
      map: map,
      title: city.name,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#3b82f6',
        fillOpacity: 0.8,
        strokeColor: '#1e40af',
        strokeWeight: 2
      }
    })

    // Add info window
    const infoWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="color: #000; padding: 10px;">
          <strong>${city.name}</strong><br/>
          Population: ${city.population.toLocaleString()}<br/>
          Happiness: ${Math.floor(city.happiness)}%
        </div>
      `
    })

    infoWindow.open(map)

    setIsLoading(false)
  }

  if (mode === 'map') {
    return (
      <div className="w-full h-full bg-slate-900 rounded overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-800 flex items-center justify-center z-10">
            <div className="text-slate-400">Loading map...</div>
          </div>
        )}
        <div
          ref={setMapElement}
          className="w-full h-full"
          style={{ minHeight: '400px' }}
        />
      </div>
    )
  }

  if (mode === 'streetview') {
    return (
      <div className="w-full h-full bg-slate-900 rounded overflow-hidden flex items-center justify-center">
        <div className="text-center text-slate-400">
          <p className="text-lg mb-4">🗺️ Street View</p>
          <p className="text-sm">Real-world imagery for {city.name}</p>
          <p className="text-xs mt-2 text-slate-500">Coming soon - Street-level view integration</p>
        </div>
      </div>
    )
  }

  return null
}
