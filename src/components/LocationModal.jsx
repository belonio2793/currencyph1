import React, { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import philippineCities from '../data/philippineCities.json'

const createCustomIcon = (color) => {
  return L.divIcon({
    html: `<div style="background-color: ${color}; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4);">📍</div>`,
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

export default function LocationModal({
  isOpen,
  onClose,
  onSelectLocation,
  locationType = 'pickup',
  currentLocation,
  userLocation,
  savedLocations = []
}) {
  const [activeTab, setActiveTab] = useState('city') // 'city', 'map', 'address', 'coordinates', 'saved'
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [address, setAddress] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [citySearch, setCitySearch] = useState('')
  const [filteredCities, setFilteredCities] = useState([])
  const mapRef = useRef(null)

  useEffect(() => {
    if (currentLocation) {
      setSelectedLocation(currentLocation)
      setLatitude(currentLocation.latitude.toString())
      setLongitude(currentLocation.longitude.toString())
    }
  }, [currentLocation, isOpen])

  // City search filter
  useEffect(() => {
    if (citySearch.trim()) {
      const filtered = philippineCities.cities.filter(city =>
        city.name.toLowerCase().includes(citySearch.toLowerCase())
      ).slice(0, 10) // Limit to 10 results
      setFilteredCities(filtered)
    } else {
      setFilteredCities([])
    }
  }, [citySearch])

  const handleMapSelect = (location) => {
    setSelectedLocation(location)
    setLatitude(location.latitude.toString())
    setLongitude(location.longitude.toString())
  }

  const handleUseCurrentLocation = () => {
    if (userLocation) {
      handleMapSelect(userLocation)
      setActiveTab('map')
    }
  }

  const handleAddressSearch = async (e) => {
    e.preventDefault()
    if (!address.trim()) return

    setLoading(true)
    try {
      // Use Nominatim with bounded search restricted to Philippines
      // Philippines bounding box: roughly 5°N to 19°N, 120°E to 129°E
      const boundingBox = '5,120,19,129' // south, west, north, east

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=20&bounded=1&viewbox=120,19,129,5&countrycodes=ph`
      )
      const results = await response.json()

      // Filter results by radius from user location (if available)
      let filteredResults = results.map(r => ({
        latitude: parseFloat(r.lat),
        longitude: parseFloat(r.lon),
        address: r.display_name
      }))

      // If user location is available, filter by radius (50km default)
      if (userLocation) {
        const radiusKm = 50
        filteredResults = filteredResults.filter(result => {
          const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            result.latitude,
            result.longitude
          )
          return distance <= radiusKm
        })
      }

      setSearchResults(filteredResults.slice(0, 10))
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    } finally {
      setLoading(false)
    }
  }

  // Calculate distance between two coordinates in km
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180)
    const dLon = (lon2 - lon1) * (Math.PI / 180)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  const handleCoordinateSubmit = () => {
    const lat = parseFloat(latitude)
    const lng = parseFloat(longitude)

    if (isNaN(lat) || isNaN(lng)) {
      alert('Please enter valid coordinates')
      return
    }

    const location = { latitude: lat, longitude: lng }
    setSelectedLocation(location)
  }

  const handleSelectSavedLocation = (location) => {
    setSelectedLocation(location)
    setLatitude(location.latitude.toString())
    setLongitude(location.longitude.toString())
  }

  const handleConfirm = () => {
    if (!selectedLocation) {
      alert('Please select a location')
      return
    }
    onSelectLocation(selectedLocation)
    onClose()
  }

  if (!isOpen) return null

  const markerColor = locationType === 'pickup' ? '#22C55E' : '#EF4444'
  const headerText = locationType === 'pickup' ? 'Select Pickup Location' : 'Select Destination'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col relative z-[10000]">
        {/* Header */}
        <div className={`${locationType === 'pickup' ? 'bg-green-600' : 'bg-red-600'} text-white p-6 flex items-center justify-between`}>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {headerText}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto">
          <button
            onClick={() => setActiveTab('city')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors min-w-fit ${
              activeTab === 'city'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            City
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors min-w-fit ${
              activeTab === 'map'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.553-.894L9 7m0 13l6.447 3.268A1 1 0 0021 17.382V6.618a1 1 0 00-1.553-.894L15 8m0 13V8m0 0L9 5m6 8v8m0-13L9 5" />
            </svg>
            Map
          </button>
          <button
            onClick={() => setActiveTab('address')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'address'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
            </svg>
            Address
          </button>
          <button
            onClick={() => setActiveTab('coordinates')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'coordinates'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 12m0 0l-4 4m4-4l4 4" />
            </svg>
            Coordinates
          </button>
          {savedLocations.length > 0 && (
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'saved'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h6a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V5z" />
              </svg>
              Saved
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* City Search Tab */}
          {activeTab === 'city' && (
            <div className="space-y-4">
              <form onSubmit={(e) => e.preventDefault()} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Search Philippine Cities
                  </label>
                  <input
                    type="text"
                    value={citySearch}
                    onChange={(e) => setCitySearch(e.target.value)}
                    placeholder="Type city name (e.g., Manila, Cebu, Davao)..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
              </form>

              {filteredCities.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-700">Available Cities:</p>
                  <div className="space-y-2 max-h-96 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50">
                    {filteredCities.map((city) => (
                      <button
                        key={city.name}
                        onClick={() => {
                          setSelectedLocation({ latitude: city.latitude, longitude: city.longitude })
                          setLatitude(city.latitude.toString())
                          setLongitude(city.longitude.toString())
                          setCitySearch('')
                          setFilteredCities([])
                          setActiveTab('map')
                        }}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                          selectedLocation?.latitude === city.latitude && selectedLocation?.longitude === city.longitude
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-blue-400 hover:bg-white'
                        }`}
                      >
                        <p className="font-medium text-slate-900 text-sm">{city.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {city.latitude.toFixed(4)}, {city.longitude.toFixed(4)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {citySearch && filteredCities.length === 0 && (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10a4 4 0 018 0" />
                  </svg>
                  <p className="text-slate-500 text-sm">No cities found matching "{citySearch}"</p>
                </div>
              )}

              {!citySearch && (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-slate-600 text-sm">Start typing to search for a city</p>
                </div>
              )}

              {selectedLocation && (
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <p className="text-sm font-semibold text-green-900 mb-2">✓ Location Selected</p>
                  <p className="text-xs text-slate-700 font-mono">
                    Lat: {selectedLocation.latitude.toFixed(6)} | Lng: {selectedLocation.longitude.toFixed(6)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Map Tab */}
          {activeTab === 'map' && (
            <div className="space-y-4">
              <button
                onClick={handleUseCurrentLocation}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                Use My Current Location
              </button>

              <div className="text-sm text-slate-600 mb-3">
                <p className="font-medium mb-1">Click on the map to select a location</p>
              </div>

              <div style={{ height: '300px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '2px solid #e2e8f0' }}>
                <MapContainer
                  center={[
                    selectedLocation?.latitude || userLocation?.latitude || 14.5995,
                    selectedLocation?.longitude || userLocation?.longitude || 120.9842
                  ]}
                  zoom={14}
                  style={{ height: '100%', width: '100%' }}
                  ref={mapRef}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapClickHandler onLocationSelect={handleMapSelect} />
                  {selectedLocation && (
                    <Marker
                      position={[selectedLocation.latitude, selectedLocation.longitude]}
                      icon={createCustomIcon(markerColor)}
                    />
                  )}
                </MapContainer>
              </div>

              {selectedLocation && (
                <div className="bg-white rounded-lg p-4 space-y-2 border border-slate-200">
                  <p className="text-sm font-semibold text-slate-900">Selected Location:</p>
                  <div className="font-mono text-sm space-y-1">
                    <p className="text-slate-700">Lat: <span className="text-blue-600">{selectedLocation.latitude.toFixed(6)}</span></p>
                    <p className="text-slate-700">Lng: <span className="text-blue-600">{selectedLocation.longitude.toFixed(6)}</span></p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Address Tab */}
          {activeTab === 'address' && (
            <div className="space-y-4">
              {userLocation && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 flex gap-2">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-blue-800">
                    Showing locations within <strong>50 km</strong> radius of your location
                  </p>
                </div>
              )}
              <form onSubmit={handleAddressSearch} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Search Address in Philippines
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Enter address or place name (Philippines only)..."
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-400 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {loading ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                </div>
              </form>

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-700">Results:</p>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {searchResults.map((result, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          handleMapSelect(result)
                          setActiveTab('map')
                        }}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                          selectedLocation?.latitude === result.latitude && selectedLocation?.longitude === result.longitude
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                        }`}
                      >
                        <p className="font-medium text-slate-900 text-sm">{result.address}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.length === 0 && address && !loading && (
                <div className="text-center py-8">
                  <p className="text-slate-500">No results found</p>
                </div>
              )}
            </div>
          )}

          {/* Coordinates Tab */}
          {activeTab === 'coordinates' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g. 14.5995"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="e.g. 120.9842"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>
              </div>

              <button
                onClick={handleCoordinateSubmit}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Apply Coordinates
              </button>

              {selectedLocation && (
                <div className="bg-white rounded-lg p-4 border-2 border-green-600">
                  <p className="text-sm font-semibold text-green-700 mb-2">✓ Location Selected</p>
                  <p className="text-xs text-slate-700 font-mono">
                    Lat: {selectedLocation.latitude.toFixed(6)} | Lng: {selectedLocation.longitude.toFixed(6)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Saved Locations Tab */}
          {activeTab === 'saved' && savedLocations.length > 0 && (
            <div className="space-y-2">
              {savedLocations.map((location, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectSavedLocation(location)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                    selectedLocation?.latitude === location.latitude && selectedLocation?.longitude === location.longitude
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                  }`}
                >
                  <p className="font-medium text-slate-900">{location.name || 'Saved Location'}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 p-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedLocation}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  )
}
