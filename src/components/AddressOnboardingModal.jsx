import React, { useState, useMemo, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { PHILIPPINES_CITIES, PHILIPPINES_PROVINCES } from '../data/philippineCitiesProvinces'

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
})

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick({
        latitude: e.latlng.lat,
        longitude: e.latlng.lng
      })
    }
  })
  return null
}

export default function AddressOnboardingModal({ userId, isOpen, onClose, onAddressCreated }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [fetchingLocation, setFetchingLocation] = useState(false)
  const [mapPosition, setMapPosition] = useState(null)
  const [citySearchInput, setCitySearchInput] = useState('')
  const [provinceSearchInput, setProvinceSearchInput] = useState('')
  const [showCityDropdown, setShowCityDropdown] = useState(false)
  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false)
  const [searchCharCount, setSearchCharCount] = useState({ city: 0, province: 0 })

  const [formData, setFormData] = useState({
    address_name: 'My Home',
    street_address: '',
    barangay: '',
    city: 'Manila',
    province: 'Metro Manila',
    postal_code: '',
    country: 'Philippines',
    latitude: 14.5995,
    longitude: 120.9842
  })

  // Filter cities based on search input
  const filteredCities = useMemo(() => {
    const searchTerm = citySearchInput.toLowerCase().trim()
    if (!searchTerm) return PHILIPPINES_CITIES
    return PHILIPPINES_CITIES.filter(city =>
      city.toLowerCase().startsWith(searchTerm)
    )
  }, [citySearchInput])

  // Filter provinces based on search input
  const filteredProvinces = useMemo(() => {
    const searchTerm = provinceSearchInput.toLowerCase().trim()
    if (!searchTerm) return PHILIPPINES_PROVINCES
    return PHILIPPINES_PROVINCES.filter(province =>
      province.toLowerCase().startsWith(searchTerm)
    )
  }, [provinceSearchInput])

  // Track character propagation for city
  const handleCitySearchChange = (e) => {
    const value = e.target.value
    setCitySearchInput(value)
    setSearchCharCount(prev => ({ ...prev, city: value.length }))
    setShowCityDropdown(true)
  }

  // Track character propagation for province
  const handleProvinceSearchChange = (e) => {
    const value = e.target.value
    setProvinceSearchInput(value)
    setSearchCharCount(prev => ({ ...prev, province: value.length }))
    setShowProvinceDropdown(true)
  }

  // Handle city selection from dropdown
  const selectCity = (city) => {
    setFormData(prev => ({ ...prev, city }))
    setCitySearchInput(city)
    setShowCityDropdown(false)
  }

  // Handle province selection from dropdown
  const selectProvince = (province) => {
    setFormData(prev => ({ ...prev, province }))
    setProvinceSearchInput(province)
    setShowProvinceDropdown(false)
  }

  // Initialize search inputs when step changes to 2
  useEffect(() => {
    if (step === 2) {
      setCitySearchInput(formData.city)
      setProvinceSearchInput(formData.province)
    }
  }, [step])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (e.target.closest('.city-dropdown-container') === null) {
        setShowCityDropdown(false)
      }
      if (e.target.closest('.province-dropdown-container') === null) {
        setShowProvinceDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleFetchLocation = async () => {
    setFetchingLocation(true)
    try {
      if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser')
        setFetchingLocation(false)
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setMapPosition({ latitude, longitude })
          setFormData(prev => ({
            ...prev,
            latitude: latitude,
            longitude: longitude
          }))
          setFetchingLocation(false)
        },
        (error) => {
          console.error('Geolocation error:', error?.message || `Code ${error?.code}: ${error?.toString() || 'Unknown error'}`)
          let errorMessage = 'Unable to get your location'
          if (error.code === error.PERMISSION_DENIED) {
            errorMessage = 'Location permission denied. Please enable location access in your browser settings.'
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errorMessage = 'Location information is unavailable.'
          } else if (error.code === error.TIMEOUT) {
            errorMessage = 'Location request timed out.'
          }
          alert(errorMessage)
          setFetchingLocation(false)
        },
        { timeout: 10000 }
      )
    } catch (err) {
      console.error('Error fetching location:', err)
      alert('Error fetching your location')
      setFetchingLocation(false)
    }
  }

  const handleMapClick = (coords) => {
    setMapPosition(coords)
    setFormData(prev => ({
      ...prev,
      latitude: coords.latitude,
      longitude: coords.longitude
    }))
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSaveAddress = async () => {
    if (!formData.address_name) {
      alert('Please enter a nickname for this address')
      return
    }

    // Check if user is a guest-local account
    if (userId && userId.includes('guest-local')) {
      alert('Please sign up to create addresses')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_addresses')
        .insert([{
          user_id: userId,
          address_name: formData.address_name,
          street_address: formData.street_address,
          barangay: formData.barangay,
          city: formData.city,
          province: formData.province,
          postal_code: formData.postal_code,
          country: formData.country,
          latitude: formData.latitude,
          longitude: formData.longitude,
          is_default: true,
          created_at: new Date().toISOString()
        }])

      if (error) throw error

      onAddressCreated?.(data?.[0])
      onClose()
    } catch (err) {
      const errorMsg = err?.message || err?.error_description || String(err)
      console.error('Error creating address:', errorMsg)
      alert(`Failed to create address: ${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] sm:max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex items-start justify-between z-10 gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Add Your First Address</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">Help us locate you for better service</p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50 flex-shrink-0"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {step === 1 ? (
            <>
              {/* Step 1: Map Selection */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 sm:mb-3">
                  <label className="block text-xs sm:text-sm font-medium text-slate-900">
                    📍 Select Location on Map (Click to place marker)
                  </label>
                  <button
                    onClick={handleFetchLocation}
                    disabled={fetchingLocation}
                    className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors disabled:opacity-50 font-medium whitespace-nowrap"
                    title="Use your current GPS location"
                  >
                    {fetchingLocation ? '📍 Fetching...' : '📍 Use Current Location'}
                  </button>
                </div>
                <div className="h-60 sm:h-80 rounded-lg overflow-hidden border border-slate-200 relative">
                  <MapContainer
                    center={[formData.latitude, formData.longitude]}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                    attributionControl={false}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapClickHandler onMapClick={handleMapClick} />
                    {mapPosition && (
                      <Marker position={[mapPosition.latitude, mapPosition.longitude]} />
                    )}
                  </MapContainer>
                </div>
                <p className="text-xs text-slate-500 mt-2 break-all">
                  Latitude: {formData.latitude.toFixed(4)}, Longitude: {formData.longitude.toFixed(4)}
                </p>
              </div>

              <button
                onClick={() => setStep(2)}
                className="w-full px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors text-sm sm:text-base"
              >
                Next: Add Details →
              </button>
            </>
          ) : (
            <>
              {/* Step 2: Address Details */}
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-900 mb-1">
                    Address Name (Nickname) *
                  </label>
                  <input
                    type="text"
                    name="address_name"
                    value={formData.address_name}
                    onChange={handleInputChange}
                    placeholder="e.g., My Home"
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-900 mb-1">
                    Street Address
                  </label>
                  <input
                    type="text"
                    name="street_address"
                    value={formData.street_address}
                    onChange={handleInputChange}
                    placeholder="123 Main St"
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-900 mb-1">
                      Barangay
                    </label>
                    <input
                      type="text"
                      name="barangay"
                      value={formData.barangay}
                      onChange={handleInputChange}
                      placeholder="e.g., Taguig"
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div className="relative city-dropdown-container">
                    <label className="block text-xs sm:text-sm font-medium text-slate-900 mb-1">
                      City {searchCharCount.city > 0 && <span className="text-xs text-slate-500">({searchCharCount.city} chars)</span>}
                    </label>
                    <input
                      type="text"
                      value={citySearchInput}
                      onChange={handleCitySearchChange}
                      onFocus={() => setShowCityDropdown(true)}
                      placeholder="Search cities..."
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                      autoComplete="off"
                    />
                    {showCityDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-50 max-h-48 sm:max-h-64 overflow-y-auto">
                        {filteredCities.length > 0 ? (
                          filteredCities.slice(0, 10).map((city, idx) => (
                            <div
                              key={idx}
                              onClick={() => selectCity(city)}
                              className="px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-blue-50 cursor-pointer text-xs sm:text-sm text-slate-700 border-b border-slate-100 last:border-b-0"
                            >
                              {city}
                            </div>
                          ))
                        ) : (
                          <div className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-500">No cities found</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                  <div className="relative province-dropdown-container">
                    <label className="block text-xs sm:text-sm font-medium text-slate-900 mb-1">
                      Province {searchCharCount.province > 0 && <span className="text-xs text-slate-500">({searchCharCount.province} chars)</span>}
                    </label>
                    <input
                      type="text"
                      value={provinceSearchInput}
                      onChange={handleProvinceSearchChange}
                      onFocus={() => setShowProvinceDropdown(true)}
                      placeholder="Search provinces..."
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                      autoComplete="off"
                    />
                    {showProvinceDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-50 max-h-48 sm:max-h-64 overflow-y-auto">
                        {filteredProvinces.length > 0 ? (
                          filteredProvinces.slice(0, 10).map((province, idx) => (
                            <div
                              key={idx}
                              onClick={() => selectProvince(province)}
                              className="px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-blue-50 cursor-pointer text-xs sm:text-sm text-slate-700 border-b border-slate-100 last:border-b-0"
                            >
                              {province}
                            </div>
                          ))
                        ) : (
                          <div className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-500">No provinces found</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-900 mb-1">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      name="postal_code"
                      value={formData.postal_code}
                      onChange={handleInputChange}
                      placeholder="1234"
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
                <button
                  onClick={() => setStep(1)}
                  disabled={loading}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors disabled:opacity-50 text-sm sm:text-base"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSaveAddress}
                  disabled={loading}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50 text-sm sm:text-base"
                >
                  {loading ? 'Creating...' : '✓ Create Address'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
