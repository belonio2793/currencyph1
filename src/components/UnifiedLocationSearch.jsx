import React, { useState, useEffect, useRef } from 'react'
import './UnifiedLocationSearch.css'
import { requestLocationPermission } from '../lib/locationHelpers'
import { forwardGeocode } from '../lib/nominatimService.js'

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.GOOGLE_API_KEY || ''

// Note: Google Places API test is skipped to avoid CORS issues on startup
// API will be tested on first use instead

// Map POI keywords to Google Places API types
const POI_KEYWORD_MAP = {
  'church': ['church', 'place_of_worship'],
  'churches': ['church', 'place_of_worship'],
  'mcdonalds': ['restaurant', 'food'],
  'mcdonald': ['restaurant', 'food'],
  'kfc': ['restaurant', 'food'],
  'jollibee': ['restaurant', 'food'],
  'restaurant': ['restaurant', 'food'],
  'restaurants': ['restaurant', 'food'],
  'diner': ['restaurant', 'food'],
  'dining': ['restaurant', 'food'],
  'food': ['restaurant', 'food'],
  'eatery': ['restaurant', 'food'],
  'bistro': ['restaurant', 'food'],
  'fast food': ['restaurant', 'food'],
  'burger': ['restaurant', 'food'],
  'pizza': ['restaurant', 'food'],
  'sushi': ['restaurant', 'food'],
  'hotel': ['lodging', 'hotel'],
  'hotels': ['lodging', 'hotel'],
  'inn': ['lodging', 'hotel'],
  'resort': ['lodging', 'hotel'],
  'hospital': ['hospital', 'health', 'doctor'],
  'clinics': ['hospital', 'health', 'doctor'],
  'clinic': ['doctor', 'health'],
  'medical': ['hospital', 'health', 'doctor'],
  'pharmacy': ['pharmacy', 'health'],
  'drugstore': ['pharmacy', 'health'],
  'gas station': ['gas_station'],
  'fuel': ['gas_station'],
  'gasoline': ['gas_station'],
  'petrol': ['gas_station'],
  'atm': ['atm', 'bank'],
  'bank': ['bank', 'atm'],
  'finance': ['bank', 'atm'],
  'grocery': ['grocery_or_supermarket', 'supermarket'],
  'supermarket': ['grocery_or_supermarket', 'supermarket'],
  'market': ['grocery_or_supermarket', 'supermarket'],
  'mart': ['grocery_or_supermarket', 'supermarket'],
  'sari-sari': ['grocery_or_supermarket', 'supermarket'],
  'mall': ['shopping_mall'],
  'shopping': ['shopping_mall'],
  'shop': ['shopping_mall'],
  'store': ['shopping_mall'],
  'school': ['school', 'university'],
  'university': ['school', 'university'],
  'college': ['school', 'university'],
  'park': ['park', 'natural_feature'],
  'nature': ['park', 'natural_feature'],
  'coffee': ['cafe', 'restaurant'],
  'coffee shop': ['cafe', 'restaurant'],
  'cafe': ['cafe', 'restaurant'],
  'bar': ['bar', 'restaurant'],
  'pub': ['bar', 'restaurant'],
  'lounge': ['bar', 'restaurant'],
  'gym': ['gym', 'health'],
  'fitness': ['gym', 'health'],
  'gym center': ['gym', 'health'],
  'police': ['police'],
  'police station': ['police'],
  'fire': ['fire_station'],
  'fire station': ['fire_station'],
  'temple': ['place_of_worship', 'temple'],
  'mosque': ['mosque', 'place_of_worship'],
  'barangay': ['administrative_area_level_4', 'administrative_area_level_3'],
  'district': ['administrative_area_level_3'],
  'city hall': ['local_government_office'],
  'library': ['library'],
  'museum': ['museum'],
  'theater': ['movie_theater', 'entertainment'],
  'cinema': ['movie_theater', 'entertainment'],
  'salon': ['beauty_salon', 'hair_care'],
  'barber': ['hair_care', 'beauty_salon'],
  'laundry': ['laundry'],
  'car wash': ['car_wash'],
  'parking': ['parking'],
  'post office': ['post_office']
}

export default function UnifiedLocationSearch({
  userLocation,
  onDestinationSelect,
  selectedDestination,
  mapHeight = '300px',
  onPickOnMap
}) {
  const [destinationSearch, setDestinationSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-focus on search input
  const searchInputRef = React.useRef(null)

  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [])

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
      const location = userLocation
        ? `${userLocation.latitude},${userLocation.longitude}`
        : '14.5995,120.9842' // Manila fallback

      const radius = userLocation ? 50000 : 100000 // 50km or 100km

      // Try nearby search first (type-based)
      const types = POI_KEYWORD_MAP[keyword.toLowerCase()] || []
      if (types.length > 0) {
        const typeString = types.join('|')
        const nearbyUrl = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json')
        nearbyUrl.searchParams.set('location', location)
        nearbyUrl.searchParams.set('radius', radius)
        nearbyUrl.searchParams.set('type', typeString)
        nearbyUrl.searchParams.set('key', GOOGLE_API_KEY)
        nearbyUrl.searchParams.set('language', 'en')

        try {
          const response = await fetch(nearbyUrl.toString())
          if (response.ok) {
            const data = await response.json()
            if (data.results && data.results.length > 0) {
              return data.results.slice(0, 15).map(place => ({
                latitude: place.geometry.location.lat,
                longitude: place.geometry.location.lng,
                address: place.name + (place.vicinity ? ', ' + place.vicinity : ''),
                placeId: place.place_id,
                type: 'poi',
                rating: place.rating,
                openNow: place.opening_hours?.open_now
              }))
            }
          }
        } catch (err) {
          console.debug('Google nearby search failed, trying text search:', err?.message)
        }
      }

      // Fallback to text search for broader results
      const textSearchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
      textSearchUrl.searchParams.set('query', keyword)
      textSearchUrl.searchParams.set('location', location)
      textSearchUrl.searchParams.set('radius', radius)
      textSearchUrl.searchParams.set('key', GOOGLE_API_KEY)
      textSearchUrl.searchParams.set('language', 'en')

      const response = await fetch(textSearchUrl.toString())

      if (!response.ok) {
        console.warn('Google Places text search API error:', response.status)
        return []
      }

      const data = await response.json()

      if (data.status === 'ZERO_RESULTS' || !data.results || data.results.length === 0) {
        console.debug('No Google Places results for:', keyword)
        return []
      }

      return data.results.slice(0, 15).map(place => ({
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        address: place.name + (place.formatted_address ? ', ' + place.formatted_address : ''),
        placeId: place.place_id,
        type: 'poi',
        rating: place.rating,
        openNow: place.opening_hours?.open_now
      }))
    } catch (err) {
      console.warn('Google Places search error:', err?.message || err)
      return []
    }
  }

  // Search using Nominatim for addresses
  const searchNominatim = async (query) => {
    try {
      const results = await forwardGeocode(query, {
        limit: 20,
        countrycode: 'ph',
        viewbox: '120,19,129,5'
      })
      return results
    } catch (err) {
      console.debug('Location search failed:', err?.message)
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
        const suggestions = []
        if (!userLocation) {
          suggestions.push('Enable location sharing for better results')
        }
        suggestions.push('Try searching for a nearby city or barangay name')
        suggestions.push('Or use the map to select your destination')

        const errorMsg = `No locations found for "${destinationSearch}". ${suggestions.join('. ')}.`
        setError(errorMsg)
      }

      setSearchResults(filteredResults.slice(0, 15))
    } catch (err) {
      console.error('Search error:', err)
      const errorMsg = err?.message || 'Failed to search locations'
      setError(`Search error: ${errorMsg}. Try using the map or searching for a city name.`)
      setSearchResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleSelectDestination = (location) => {
    onDestinationSelect(location)
    setDestinationSearch('')
    setSearchResults([])
  }

  const handleClearDestination = () => {
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


      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Search Section */}
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
                <div className="location-search-results space-y-2 max-h-64 overflow-y-auto border border-slate-200 rounded-lg bg-slate-50 p-3">
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
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 text-sm break-words">{result.address}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-slate-500">
                                {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                              </p>
                              {result.rating && (
                                <span className="text-xs text-amber-600 font-semibold">
                                  ★ {result.rating.toFixed(1)}
                                </span>
                              )}
                              {result.openNow === true && (
                                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                  Open
                                </span>
                              )}
                              {result.openNow === false && (
                                <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                                  Closed
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded whitespace-nowrap flex-shrink-0">
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
                <p className="text-slate-500 text-sm mb-2">No locations found matching "{destinationSearch}"</p>
                <p className="text-xs text-slate-400">Try searching for specific addresses or place types like "church", "restaurant", "hospital", "school", etc.</p>
              </div>
            )}

            {selectedDestination && (
              <div className="location-confirmation bg-green-50 rounded-lg p-4 border border-green-200 space-y-2">
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

        {/* Pick on Map Button */}
        {onPickOnMap && (
          <button
            onClick={onPickOnMap}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.553-.894L9 7m0 13l6.447 3.268A1 1 0 0021 17.382V6.618a1 1 0 00-1.553-.894L15 8m0 13V8m0 0L9 5m6 8v8m0-13L9 5" />
            </svg>
            Pick on Map
          </button>
        )}
      </div>
    </div>
  )
}
