import React, { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './UnifiedLocationSearch.css'
import { requestLocationPermission } from '../lib/locationHelpers'

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.GOOGLE_API_KEY || ''

// Map POI keywords to Google Places API types
const POI_KEYWORD_MAP = {
  'church': ['church'],
  'churches': ['church'],
  'mcdonalds': ['restaurant', 'food'],
  'mcdonald': ['restaurant', 'food'],
  'restaurant': ['restaurant', 'food'],
  'restaurants': ['restaurant', 'food'],
  'fast food': ['restaurant', 'food'],
  'hotel': ['lodging'],
  'hotels': ['lodging'],
  'hospital': ['hospital', 'health'],
  'clinic': ['doctor', 'health'],
  'pharmacy': ['pharmacy', 'health'],
  'gas station': ['gas_station'],
  'fuel': ['gas_station'],
  'atm': ['atm', 'bank'],
  'bank': ['bank', 'atm'],
  'grocery': ['grocery_or_supermarket', 'supermarket'],
  'supermarket': ['grocery_or_supermarket', 'supermarket'],
  'mall': ['shopping_mall'],
  'shopping': ['shopping_mall'],
  'school': ['school', 'university'],
  'university': ['school', 'university'],
  'park': ['park'],
  'coffee': ['cafe', 'restaurant'],
  'cafe': ['cafe', 'restaurant'],
  'bar': ['bar', 'restaurant'],
  'gym': ['gym', 'health'],
  'fitness': ['gym', 'health'],
  'police': ['police'],
  'fire': ['fire_station'],
  'temple': ['place_of_worship'],
  'mosque': ['mosque', 'place_of_worship'],
  'barangay': ['administrative_area_level_4', 'administrative_area_level_3'],
  'district': ['administrative_area_level_3']
}

const createCustomIcon = (color, label) => {
  return L.divIcon({
    html: `<div style="background-color: ${color}; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4);">${label}</div>`,
    iconSize: [40, 40],
    className: 'custom-location-icon'
  })
}

function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect({
        latitude: e.latlng.lat,
        longitude: e.latlng.lng
      })
    }
  })
  return null
}

export default function UnifiedLocationSearch({
  userLocation,
  onDestinationSelect,
  selectedDestination,
  mapHeight = '300px'
}) {
  const [destinationSearch, setDestinationSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('search')
  const [mapLocation, setMapLocation] = useState(selectedDestination || userLocation)

  // Auto-focus on search input
  const searchInputRef = React.useRef(null)

  useEffect(() => {
    if (activeTab === 'search' && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [activeTab])

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371
    const dLat = (lat2 - lat1) * (Math.PI / 180)
    const dLon = (lon2 - lon1) * (Math.PI / 180)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Detect if search is for POI (keyword) vs address
  const detectSearchType = (query) => {
    const lowerQuery = query.toLowerCase().trim()

    // Check if it matches any POI keywords
    for (const keyword of Object.keys(POI_KEYWORD_MAP)) {
      if (lowerQuery.includes(keyword)) {
        return { type: 'poi', keyword: lowerQuery }
      }
    }

    // Check for explicit address patterns
    if (lowerQuery.match(/\d+\s+|street|ave|st\.|rd\.|blvd|drive|lane|road|barangay|village/i)) {
      return { type: 'address', query: lowerQuery }
    }

    // Default to mixed search (try both)
    return { type: 'mixed', query: lowerQuery }
  }

  // Search using Google Places API for POI
  const searchGooglePlaces = async (keyword) => {
    if (!GOOGLE_API_KEY) {
      console.warn('Google API key not configured')
      return []
    }

    try {
      const types = POI_KEYWORD_MAP[keyword.toLowerCase()] || [keyword.toLowerCase()]
      const typeString = types.join('|')

      // Use nearby search centered on user location
      const location = userLocation
        ? `${userLocation.latitude},${userLocation.longitude}`
        : '14.5995,120.9842' // Manila fallback

      const radius = userLocation ? 50000 : 100000 // 50km or 100km

      const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json')
      url.searchParams.set('location', location)
      url.searchParams.set('radius', radius)
      url.searchParams.set('keyword', keyword)
      url.searchParams.set('type', typeString)
      url.searchParams.set('key', GOOGLE_API_KEY)
      url.searchParams.set('language', 'en')

      const response = await fetch(url.toString())

      if (!response.ok) {
        console.warn('Google Places API error:', response.status)
        return []
      }

      const data = await response.json()

      if (!data.results || data.results.length === 0) {
        return []
      }

      return data.results.slice(0, 15).map(place => ({
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        address: place.name + (place.vicinity ? ', ' + place.vicinity : ''),
        placeId: place.place_id,
        type: 'poi',
        rating: place.rating,
        openNow: place.opening_hours?.open_now
      }))
    } catch (err) {
      console.warn('Google Places search failed:', err)
      return []
    }
  }

  // Search using Nominatim for addresses
  const searchNominatim = async (query) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=20&countrycodes=ph&bounded=1&viewbox=120,19,129,5`
      )

      if (!response.ok) throw new Error(`Nominatim ${response.status}`)

      const results = await response.json()

      return results.map(r => ({
        latitude: parseFloat(r.lat),
        longitude: parseFloat(r.lon),
        address: r.display_name,
        type: 'address'
      }))
    } catch (err) {
      console.warn('Nominatim search failed:', err)
      return []
    }
  }

  const handleDestinationSearch = async (e) => {
    e.preventDefault()
    if (!destinationSearch.trim()) {
      setSearchResults([])
      return
    }

    setLoading(true)
    setError('')
    try {
      const searchType = detectSearchType(destinationSearch)
      let results = []

      // For POI searches, use Google Places first
      if (searchType.type === 'poi' || searchType.type === 'mixed') {
        const poiKeyword = searchType.keyword || destinationSearch
        results = await searchGooglePlaces(poiKeyword)
      }

      // If no POI results or it's an address search, try Nominatim
      if (results.length === 0) {
        const nominatimResults = await searchNominatim(searchType.query || destinationSearch)
        results = nominatimResults
      }

      // Filter by radius from user location
      let filteredResults = results
      if (userLocation) {
        const radiusKm = 100 // Increased from 50km to 100km
        filteredResults = results.filter(result => {
          const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            result.latitude,
            result.longitude
          )
          return distance <= radiusKm
        })
      }

      // Sort by distance if we have user location
      if (userLocation && filteredResults.length > 0) {
        filteredResults.sort((a, b) => {
          const distA = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            a.latitude,
            a.longitude
          )
          const distB = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            b.latitude,
            b.longitude
          )
          return distA - distB
        })
      }

      if (filteredResults.length === 0) {
        setError(`No locations found matching "${destinationSearch}". Try a different search or use the map.`)
      }

      setSearchResults(filteredResults.slice(0, 15))
    } catch (err) {
      console.error('Search error:', err)
      setError('Failed to search locations. Please try again.')
      setSearchResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleSelectDestination = (location) => {
    setMapLocation(location)
    onDestinationSelect(location)
    setDestinationSearch('')
    setSearchResults([])
  }

  const handleMapSelect = (location) => {
    setMapLocation(location)
    onDestinationSelect(location)
  }

  const handleClearDestination = () => {
    setMapLocation(null)
    onDestinationSelect(null)
    setDestinationSearch('')
    setSearchResults([])
  }

  if (!userLocation) {
    return (
      <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200 space-y-3">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="font-semibold text-yellow-900">Detecting your location...</h3>
        </div>
        <p className="text-sm text-yellow-800">
          Your location is being detected and will be used as the pickup point.
        </p>
        <button
          onClick={() => requestLocationPermission()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Enable Location Sharing
        </button>
      </div>
    )
  }

  return (
    <div className="unified-location-search-wrapper bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
      {/* Pickup Location - Always shown as confirmed */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Pickup Location (Your Current Location)
          </label>
          <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">Confirmed</span>
        </div>
        <p className="text-sm font-mono opacity-90">
          {userLocation.latitude.toFixed(6)}, {userLocation.longitude.toFixed(6)}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="location-search-tabs flex border-b border-slate-200 bg-slate-50">
        <button
          onClick={() => setActiveTab('search')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'search'
              ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search Address
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'map'
              ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.553-.894L9 7m0 13l6.447 3.268A1 1 0 0021 17.382V6.618a1 1 0 00-1.553-.894L15 8m0 13V8m0 0L9 5m6 8v8m0-13L9 5" />
          </svg>
          Pick on Map
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-3">
                Where do you want to go?
              </label>
              <form onSubmit={handleDestinationSearch} className="location-search-form flex gap-2">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={destinationSearch}
                  onChange={(e) => setDestinationSearch(e.target.value)}
                  placeholder="Search for destination, address, or place..."
                  className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-400 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </form>
            </div>

            {error && (
              <div className="bg-red-50 rounded-lg p-3 border border-red-200 flex gap-2">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">Results ({searchResults.length}):</p>
                <div className="space-y-2 max-h-64 overflow-y-auto border border-slate-200 rounded-lg bg-slate-50 p-3">
                  {searchResults.map((result, idx) => {
                    const distance = calculateDistance(
                      userLocation.latitude,
                      userLocation.longitude,
                      result.latitude,
                      result.longitude
                    )
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectDestination(result)}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                          selectedDestination?.latitude === result.latitude && selectedDestination?.longitude === result.longitude
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-blue-400 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-slate-900 text-sm">{result.address}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                            </p>
                          </div>
                          <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded whitespace-nowrap ml-2">
                            {distance < 1 ? '< 1 km' : `${distance.toFixed(1)} km`}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {destinationSearch && searchResults.length === 0 && !loading && (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10a4 4 0 018 0" />
                </svg>
                <p className="text-slate-500 text-sm">No locations found matching "{destinationSearch}"</p>
              </div>
            )}

            {selectedDestination && (
              <div className="bg-green-50 rounded-lg p-4 border border-green-200 space-y-2">
                <div className="flex items-center gap-2 text-green-700 font-semibold">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Destination Selected
                </div>
                <p className="text-sm text-slate-700">{selectedDestination.address}</p>
                <button
                  onClick={handleClearDestination}
                  className="text-sm text-green-600 hover:text-green-700 font-medium py-2 hover:bg-green-100 rounded-lg w-full transition-colors"
                >
                  Change Destination
                </button>
              </div>
            )}
          </div>
        )}

        {/* Map Tab */}
        {activeTab === 'map' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 font-medium">
              Click on the map to select your destination
            </p>

            <div style={{
              height: mapHeight,
              width: '100%',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '2px solid #e2e8f0',
              position: 'relative',
              zIndex: 1,
              flexShrink: 0
            }}>
              <MapContainer
                center={[
                  mapLocation?.latitude || userLocation.latitude || 14.5995,
                  mapLocation?.longitude || userLocation.longitude || 120.9842
                ]}
                zoom={14}
                style={{
                  height: '100%',
                  width: '100%',
                  position: 'relative',
                  zIndex: 1
                }}
                className="leaflet-map-container"
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution=""
                />
                <MapClickHandler onLocationSelect={handleMapSelect} />
                <Marker
                  position={[userLocation.latitude, userLocation.longitude]}
                  icon={createCustomIcon('#22C55E', '📍')}
                />
                {mapLocation && !(mapLocation.latitude === userLocation.latitude && mapLocation.longitude === userLocation.longitude) && (
                  <Marker
                    position={[mapLocation.latitude, mapLocation.longitude]}
                    icon={createCustomIcon('#EF4444', '📍')}
                  />
                )}
              </MapContainer>
            </div>

            {mapLocation && !(mapLocation.latitude === userLocation.latitude && mapLocation.longitude === userLocation.longitude) && (
              <div className="bg-green-50 rounded-lg p-4 border border-green-200 space-y-2">
                <div className="flex items-center gap-2 text-green-700 font-semibold">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Destination Selected
                </div>
                <p className="text-xs font-mono text-slate-700">
                  Lat: {mapLocation.latitude.toFixed(6)} | Lng: {mapLocation.longitude.toFixed(6)}
                </p>
                <button
                  onClick={handleClearDestination}
                  className="text-sm text-green-600 hover:text-green-700 font-medium py-2 hover:bg-green-100 rounded-lg w-full transition-colors"
                >
                  Clear Destination
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
