import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom red marker for new address being created
const newAddressIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'new-address-marker'
})

// Map click handler component
function MapClickHandler({ onMapClick, isCreating }) {
  useMapEvents({
    click: (e) => {
      if (isCreating) {
        onMapClick({
          latitude: e.latlng.lat,
          longitude: e.latlng.lng
        })
      }
    }
  })
  return null
}

// Modal map click handler - allows clicking anywhere on the modal map
function ModalMapClickHandler({ onMapClick }) {
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

// Modal map ref handler - captures map instance for programmatic control
function ModalMapRefHandler({ onMapReady }) {
  const map = useMap()

  useEffect(() => {
    if (map) {
      onMapReady(map)
    }
  }, [map, onMapReady])

  return null
}

export default function MyAddressesTab({ userId }) {
  // Define cities list before state declarations
  const allCities = [
    "Abuyog", "Alaminos", "Alcala", "Angeles", "Antipolo", "Aroroy", "Bacolod", "Bacoor", "Bago",
    "Bais", "Balanga", "Baliuag", "Bangued", "Bansalan", "Bantayan", "Bataan", "Batac", "Batangas City",
    "Bayambang", "Bayawan", "Baybay", "Bayugan", "Biñan", "Bislig", "Bocaue", "Bogo", "Boracay",
    "Borongan", "Butuan", "Cabadbaran", "Cabanatuan", "Cabuyao", "Cadiz", "Cagayan de Oro", "Calamba",
    "Calapan", "Calbayog", "Caloocan", "Camiling", "Canlaon", "Caoayan", "Capiz", "Caraga", "Carmona",
    "Catbalogan", "Cauayan", "Cavite City", "Cebu City", "Cotabato City", "Dagupan", "Danao", "Dapitan",
    "Daraga", "Dasmariñas", "Davao City", "Davao del Norte", "Davao del Sur", "Davao Oriental", "Dipolog",
    "Dumaguete", "General Santos", "General Trias", "Gingoog", "Guihulngan", "Himamaylan", "Ilagan", "Iligan",
    "Iloilo City", "Imus", "Isabela", "Isulan", "Kabankalan", "Kidapawan", "Koronadal", "La Carlota", "Laoag",
    "Lapu-Lapu", "Las Piñas", "Laoang", "Legazpi", "Ligao", "Limay", "Lucena", "Maasin", "Mabalacat",
    "Malabon", "Malaybalay", "Malolos", "Mandaluyong", "Mandaue", "Manila", "Marawi", "Marilao", "Masbate City",
    "Mati", "Meycauayan", "Muntinlupa", "Naga (Camarines Sur)", "Navotas", "Olongapo", "Ormoc", "Oroquieta",
    "Ozamiz", "Pagadian", "Palo", "Parañaque", "Pasay", "Pasig", "Passi", "Puerto Princesa", "Quezon City",
    "Roxas", "Sagay", "Samal", "San Carlos (Negros Occidental)", "San Carlos (Pangasinan)", "San Fernando (La Union)",
    "San Fernando (Pampanga)", "San Jose (Antique)", "San Jose del Monte", "San Juan", "San Pablo", "San Pedro",
    "Santiago", "Silay", "Sipalay", "Sorsogon City", "Surigao City", "Tabaco", "Tabuk", "Tacurong", "Tagaytay",
    "Tagbilaran", "Taguig", "Tacloban", "Talisay (Cebu)", "Talisay (Negros Occidental)", "Tanjay", "Tarlac City",
    "Tayabas", "Toledo", "Trece Martires", "Tuguegarao", "Urdaneta", "Valencia", "Valenzuela", "Victorias", "Vigan",
    "Virac", "Zamboanga City", "Baguio", "Bohol", "Coron", "El Nido", "Makati", "Palawan", "Siargao"
  ].sort()

  const mapRef = useRef(null)
  const [showForm, setShowForm] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [addresses, setAddresses] = useState([])
  const [addressHistory, setAddressHistory] = useState([])
  const [selectedAddressId, setSelectedAddressId] = useState(null)
  const [selectedAddressForHistory, setSelectedAddressForHistory] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCity, setFilterCity] = useState('all')
  const [filterRegion, setFilterRegion] = useState('all')
  const [cities, setCities] = useState([])
  const [regions, setRegions] = useState([])
  const [editingNickname, setEditingNickname] = useState(null)
  const [nicknameInput, setNicknameInput] = useState('')
  const [showNicknameForm, setShowNicknameForm] = useState(false)
  const [isCreatingFromMap, setIsCreatingFromMap] = useState(false)
  const [mapCenter, setMapCenter] = useState([12.8797, 121.7740])
  const [zoomLevel, setZoomLevel] = useState(6)
  const [mapHeight, setMapHeight] = useState(400)
  const [mapLayer, setMapLayer] = useState('street')
  const [showLegend, setShowLegend] = useState(false)
  const [showModalMapControls, setShowModalMapControls] = useState(false)
  const [currentLocation, setCurrentLocation] = useState(null)
  const [mapSearchQuery, setMapSearchQuery] = useState('')
  const [mapSearchResults, setMapSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [magneticSnap, setMagneticSnap] = useState(true)
  const [showStreetView, setShowStreetView] = useState(false)
  const [selectedMapillaryLocation, setSelectedMapillaryLocation] = useState(null)
  const [citiesSearchOpen, setCitiesSearchOpen] = useState(false)
  const [citiesSearchQuery, setCitiesSearchQuery] = useState('')
  const citiesDropdownRef = useRef(null)
  const [fetchingLocation, setFetchingLocation] = useState(false)
  const [modalMapRef, setModalMapRef] = useState(null)
  const [modalMapHeight, setModalMapHeight] = useState(300)
  const [modalMapLayer, setModalMapLayer] = useState('street')
  const [citySearchOpen, setCitySearchOpen] = useState(false)
  const [filteredCities, setFilteredCities] = useState(allCities)

  const [formData, setFormData] = useState({
    addresses_address: '',
    addresses_street_number: '',
    addresses_street_name: '',
    addresses_city: '',
    addresses_province: '',
    addresses_region: '',
    addresses_postal_code: '',
    barangay: '',
    addresses_latitude: '',
    addresses_longitude: '',
    address_nickname: '',
    lot_number: '',
    lot_area: '',
    lot_area_unit: 'sqm',
    property_type: 'Residential',
    zoning_classification: 'residential',
    land_use: '',
    owner_name: '',
    land_title_number: '',
    elevation: '',
    property_status: 'active',
    notes: ''
  })

  const propertyTypes = [
    'Residential',
    'Commercial',
    'Industrial',
    'Agricultural',
    'Mixed-Use',
    'Government'
  ]

  const zoningOptions = [
    'residential',
    'commercial',
    'industrial',
    'agricultural',
    'mixed-use',
    'govt'
  ]

  const regionsList = [
    'National Capital Region',
    'Cordillera Administrative Region',
    'Ilocos Region',
    'Cagayan Valley',
    'Central Luzon',
    'Calabarzon',
    'Mimaropa',
    'Bicol Region',
    'Western Visayas',
    'Central Visayas',
    'Eastern Visayas',
    'Zamboanga Peninsula',
    'Northern Mindanao',
    'Davao Region',
    'Soccsksargen',
    'Caraga',
    'Bangsamoro Autonomous Region in Muslim Mindanao'
  ]

  const popularCities = [
    { name: 'Manila', region: 'National Capital Region', highlight: 'primary' },
    { name: 'Quezon City', region: 'National Capital Region', highlight: 'primary' },
    { name: 'Makati', region: 'National Capital Region', highlight: 'primary' },
    { name: 'Taguig', region: 'National Capital Region', highlight: 'primary' },
    { name: 'Cebu City', region: 'Central Visayas', highlight: 'secondary' },
    { name: 'Davao City', region: 'Davao Region', highlight: 'secondary' },
    { name: 'Cagayan de Oro', region: 'Northern Mindanao', highlight: 'secondary' },
    { name: 'Iloilo City', region: 'Western Visayas', highlight: 'secondary' },
    { name: 'Bacolod City', region: 'Western Visayas', highlight: 'secondary' },
    { name: 'Baguio City', region: 'Cordillera Administrative Region', highlight: 'secondary' }
  ]

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (citiesDropdownRef.current && !citiesDropdownRef.current.contains(e.target)) {
        setCitiesSearchOpen(false)
      }
    }

    if (citiesSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [citiesSearchOpen])

  useEffect(() => {
    loadAddresses()
  }, [userId])

  useEffect(() => {
    if (addresses.length > 0) {
      const uniqueCities = [...new Set(addresses.map(a => a.addresses_city))].filter(Boolean).sort()
      const uniqueRegions = [...new Set(addresses.map(a => a.addresses_region))].filter(Boolean).sort()
      setCities(uniqueCities)
      setRegions(uniqueRegions)
    }
  }, [addresses])

  const loadAddresses = async () => {
    if (!userId) return
    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setAddresses(data || [])
      if (data && data.length > 0 && !selectedAddressId) {
        setSelectedAddressId(data[0].id)
        if (data[0].addresses_latitude && data[0].addresses_longitude) {
          setMapCenter([parseFloat(data[0].addresses_latitude), parseFloat(data[0].addresses_longitude)])
          setZoomLevel(10)
        }
      }
    } catch (err) {
      console.error('Error loading addresses:', err?.message || err)
      setError(err?.message || 'Failed to load addresses')
    } finally {
      setLoading(false)
    }
  }

  const loadAddressHistory = async (addressId) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('address_history')
        .select('*')
        .eq('address_id', addressId)
        .order('changed_at', { ascending: false })

      if (fetchError) throw fetchError
      setAddressHistory(data || [])
    } catch (err) {
      console.error('Error loading address history:', err?.message || err)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleMapClick = (coords) => {
    let latitude = coords.latitude
    let longitude = coords.longitude

    if (magneticSnap) {
      const snapDistance = 0.001
      for (const address of addresses) {
        if (address.addresses_latitude && address.addresses_longitude) {
          const addrLat = parseFloat(address.addresses_latitude)
          const addrLng = parseFloat(address.addresses_longitude)
          if (
            Math.abs(latitude - addrLat) < snapDistance &&
            Math.abs(longitude - addrLng) < snapDistance
          ) {
            latitude = addrLat
            longitude = addrLng
            break
          }
        }
      }
    }

    setFormData(prev => ({
      ...prev,
      addresses_latitude: latitude.toFixed(8),
      addresses_longitude: longitude.toFixed(8)
    }))
    setShowForm(true)
    setIsCreatingFromMap(false)
  }

  const handleGeolocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setCurrentLocation({ latitude, longitude })
          setMapCenter([latitude, longitude])
          setZoomLevel(13)
        },
        (error) => {
          console.error('Geolocation error:', error)
          setError('Unable to get your location. Please check permissions.')
        }
      )
    } else {
      setError('Geolocation is not supported by your browser')
    }
  }

  const handleMapSearch = async (query) => {
    if (!query.trim()) {
      setMapSearchResults([])
      setShowSearchResults(false)
      return
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ph&limit=5`
      )
      const results = await response.json()
      setMapSearchResults(results || [])
      setShowSearchResults(results && results.length > 0)
    } catch (err) {
      console.error('Search error:', err)
      setMapSearchResults([])
    }
  }

  const handleSearchResultClick = (result) => {
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)
    setMapCenter([lat, lng])
    setZoomLevel(14)
    setMapSearchQuery('')
    setShowSearchResults(false)
  }

  const handleModalMapClick = (coords) => {
    const latitude = parseFloat(coords.latitude).toFixed(6)
    const longitude = parseFloat(coords.longitude).toFixed(6)

    setFormData(prev => ({
      ...prev,
      addresses_latitude: latitude,
      addresses_longitude: longitude
    }))
  }

  const handleFetchUserLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }

    setFetchingLocation(true)
    setError('')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const lat = parseFloat(latitude).toFixed(6)
        const lng = parseFloat(longitude).toFixed(6)

        setFormData(prev => ({
          ...prev,
          addresses_latitude: lat,
          addresses_longitude: lng
        }))

        if (modalMapRef) {
          try {
            modalMapRef.setView([latitude, longitude], 19, { animate: true, duration: 1 })
          } catch (err) {
            console.error('Error centering map:', err)
          }
        }

        setFetchingLocation(false)
        handleFetchLocationDetails(lat, lng)
      },
      (error) => {
        setFetchingLocation(false)
        let errorMessage = 'Unable to get your location'

        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = 'Location permission denied. Please enable location access in your browser settings.'
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage = 'Location information is unavailable.'
        } else if (error.code === error.TIMEOUT) {
          errorMessage = 'Location request timed out. Please try again.'
        }

        setError(errorMessage)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  }

  const handleFetchLocationDetails = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { headers: { 'Accept': 'application/json' } }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data && data.address) {
        const address = data.address
        setFormData(prev => ({
          ...prev,
          addresses_street_name: address.road || address.pedestrian || address.cycleway || prev.addresses_street_name || '',
          addresses_street_number: address.house_number || prev.addresses_street_number || '',
          addresses_city: address.city || address.town || address.village || prev.addresses_city || '',
          addresses_province: address.state || prev.addresses_province || '',
          barangay: address.suburb || prev.barangay || ''
        }))
      }
    } catch (err) {
      console.error('Error fetching location details:', err)
    }
  }

  const handleFetchLocation = async () => {
    if (!formData.addresses_latitude || !formData.addresses_longitude) {
      setError('Please select a location on the map first')
      return
    }

    try {
      setLoading(true)
      await handleFetchLocationDetails(formData.addresses_latitude, formData.addresses_longitude)
    } catch (err) {
      console.error('Error fetching location:', err)
      setError('Unable to fetch location details. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.addresses_street_name || !formData.addresses_city || !formData.addresses_latitude || !formData.addresses_longitude) {
      setError('Please fill in street name, city, latitude, and longitude')
      return
    }

    try {
      setLoading(true)
      const propertyData = {
        user_id: userId,
        ...formData,
        addresses_latitude: parseFloat(formData.addresses_latitude),
        addresses_longitude: parseFloat(formData.addresses_longitude),
        lot_area: formData.lot_area ? parseFloat(formData.lot_area) : null,
        elevation: formData.elevation ? parseFloat(formData.elevation) : null
      }

      const { data, error: insertError } = await supabase
        .from('addresses')
        .insert([propertyData])
        .select()

      if (insertError) {
        console.error('Insert error details:', insertError)
        throw new Error(insertError.message || 'Failed to insert address')
      }

      setFormData({
        addresses_address: '',
        addresses_street_number: '',
        addresses_street_name: '',
        addresses_city: '',
        addresses_province: '',
        addresses_region: '',
        addresses_postal_code: '',
        barangay: '',
        addresses_latitude: '',
        addresses_longitude: '',
        address_nickname: '',
        lot_number: '',
        lot_area: '',
        lot_area_unit: 'sqm',
        property_type: 'Residential',
        zoning_classification: 'residential',
        land_use: '',
        owner_name: '',
        land_title_number: '',
        elevation: '',
        property_status: 'active',
        notes: ''
      })
      setShowForm(false)
      setIsCreatingFromMap(false)
      setError('')
      await loadAddresses()
    } catch (err) {
      console.error('Error saving address:', err?.message || err)
      setError(err?.message || 'Failed to save address. Please check the address fields.')
    } finally {
      setLoading(false)
    }
  }

  const handleSetDefault = async (addressId) => {
    try {
      await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', addressId)
        .eq('user_id', userId)

      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', userId)
        .neq('id', addressId)

      await loadAddresses()
    } catch (err) {
      console.error('Error setting default address:', err?.message || err)
      setError('Failed to set default address')
    }
  }

  const handleUpdateNickname = async (addressId) => {
    try {
      const oldAddress = addresses.find(a => a.id === addressId)
      const oldValue = oldAddress?.address_nickname || ''

      const { error: updateError } = await supabase
        .from('addresses')
        .update({ address_nickname: nicknameInput })
        .eq('id', addressId)
        .eq('user_id', userId)

      if (updateError) throw updateError

      const { error: historyError } = await supabase
        .from('address_history')
        .insert([{
          address_id: addressId,
          user_id: userId,
          field_name: 'address_nickname',
          old_value: oldValue,
          new_value: nicknameInput
        }])

      if (historyError && historyError.code !== 'UNIQUE_VIOLATION') {
        console.warn('Could not record history:', historyError)
      }

      setEditingNickname(null)
      setNicknameInput('')
      await loadAddresses()
    } catch (err) {
      console.error('Error updating nickname:', err?.message || err)
      setError('Failed to update nickname')
    }
  }

  const filteredAddresses = addresses.filter(address => {
    const matchesQuery = 
      address.addresses_street_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      address.addresses_city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      address.address_nickname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      address.barangay?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCity = filterCity === 'all' || address.addresses_city === filterCity
    const matchesRegion = filterRegion === 'all' || address.addresses_region === filterRegion

    return matchesQuery && matchesCity && matchesRegion
  })

  const getAddressDisplayName = (address) => {
    if (address.address_nickname) {
      return `${address.address_nickname} - ${address.addresses_street_name}`
    }
    return address.addresses_street_name || address.addresses_city
  }

  const handleCitySelect = (cityName) => {
    setFilterCity(cityName)
    setSearchQuery('')
  }

  return (
    <div className="my-addresses-tab">
      {/* Page Title */}
      <div className="page-title">
        <h2>My Addresses</h2>
      </div>

      <div className="my-addresses-layout">
        {/* Map Section */}
        <div className="map-section" style={{ flex: `0 0 ${mapHeight}px` }}>
          {/* Map Search Bar */}
          <div className="map-search-section">
            <div className="map-search-input-group">
              <input
                type="text"
                placeholder="Search location..."
                value={mapSearchQuery}
                onChange={(e) => {
                  setMapSearchQuery(e.target.value)
                  handleMapSearch(e.target.value)
                }}
                className="map-search-input"
              />
            </div>
            {showSearchResults && mapSearchResults.length > 0 && (
              <div className="map-search-results">
                {mapSearchResults.map((result, idx) => (
                  <div
                    key={idx}
                    className="search-result-item"
                    onClick={() => handleSearchResultClick(result)}
                  >
                    <span className="result-name">{result.name}</span>
                    <span className="result-type">{result.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="map-container">
            <div className="map-overlay-controls">
              <div className="map-resize-controls">
                <button
                  onClick={() => setMapHeight(prev => Math.max(prev - 50, 200))}
                  className="btn-map-resize"
                  title="Decrease map size"
                >
                  −
                </button>
                <button
                  onClick={() => setMapHeight(prev => Math.min(prev + 50, 600))}
                  className="btn-map-resize"
                  title="Increase map size"
                >
                  +
                </button>
              </div>
              <button
                onClick={() => setShowLegend(!showLegend)}
                className="btn-legend-toggle"
                title={showLegend ? 'Hide map controls' : 'Show map controls'}
              >
                {showLegend ? 'Hide Map Controls' : 'Show Map Controls'}
              </button>
            </div>
            <MapContainer
              center={mapCenter}
              zoom={zoomLevel}
              style={{ height: '100%', width: '100%' }}
              ref={mapRef}
              attributionControl={false}
            >
              {mapLayer === 'street' && (
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              )}
              {mapLayer === 'satellite' && (
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              )}
              {mapLayer === 'terrain' && (
                <TileLayer
                  url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                />
              )}
              <MapClickHandler onMapClick={handleMapClick} isCreating={isCreatingFromMap} />
              {currentLocation && (
                <Marker
                  position={[currentLocation.latitude, currentLocation.longitude]}
                  icon={
                    new L.Icon({
                      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
                      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                      iconSize: [25, 41],
                      iconAnchor: [12, 41],
                      popupAnchor: [1, -34],
                      shadowSize: [41, 41],
                      className: 'current-location-marker'
                    })
                  }
                >
                  <Popup>
                    <div className="marker-popup">
                      <p><strong>📍 Your Location</strong></p>
                      <p>Lat: {currentLocation.latitude.toFixed(4)}</p>
                      <p>Lon: {currentLocation.longitude.toFixed(4)}</p>
                    </div>
                  </Popup>
                </Marker>
              )}
              {addresses.map((address) => (
                address.addresses_latitude && address.addresses_longitude && (
                  <Marker
                    key={address.id}
                    position={[
                      parseFloat(address.addresses_latitude),
                      parseFloat(address.addresses_longitude)
                    ]}
                    onClick={() => setSelectedAddressId(address.id)}
                  >
                    <Popup>
                      <div className="marker-popup">
                        <h4>{getAddressDisplayName(address)}</h4>
                        <p>{address.addresses_street_name}</p>
                        <p>{address.addresses_city}, {address.addresses_region}</p>
                      </div>
                    </Popup>
                  </Marker>
                )
              ))}
              {formData.addresses_latitude && formData.addresses_longitude && isCreatingFromMap && (
                <Marker
                  position={[
                    parseFloat(formData.addresses_latitude),
                    parseFloat(formData.addresses_longitude)
                  ]}
                  icon={newAddressIcon}
                >
                  <Popup>
                    <div className="marker-popup">
                      <p>New Address</p>
                      <p>Lat: {formData.addresses_latitude}</p>
                      <p>Lon: {formData.addresses_longitude}</p>
                    </div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          </div>

          {/* Map Legend */}
          {showLegend && (
            <div className="map-legend">
              <div className="legend-header">
                <h4>Map Controls</h4>
                <button
                  onClick={() => setShowLegend(false)}
                  className="legend-close"
                >
                  ✕
                </button>
              </div>

              <div className="legend-content">
                {/* Default Location */}
                <div className="legend-section">
                  <button
                    onClick={() => {
                      const center = [12.8797, 121.7740]
                      const zoom = 6
                      setMapCenter(center)
                      setZoomLevel(zoom)
                      if (mapRef.current) {
                        try {
                          mapRef.current.flyTo(center, zoom, { duration: 1 })
                        } catch (error) {
                          console.error('Error flying to Philippines:', error)
                        }
                      }
                    }}
                    className="btn-default-location"
                    title="Focus on Philippines"
                  >
                    Philippines
                  </button>
                </div>

                {/* Layer Selection */}
                <div className="legend-section">
                  <label className="legend-label">Map Layer</label>
                  <div className="layer-buttons">
                    <button
                      onClick={() => setMapLayer('street')}
                      className={`layer-btn ${mapLayer === 'street' ? 'active' : ''}`}
                      title="Street view"
                    >
                      Street
                    </button>
                    <button
                      onClick={() => setMapLayer('satellite')}
                      className={`layer-btn ${mapLayer === 'satellite' ? 'active' : ''}`}
                      title="Satellite view"
                    >
                      Satellite
                    </button>
                    <button
                      onClick={() => setMapLayer('terrain')}
                      className={`layer-btn ${mapLayer === 'terrain' ? 'active' : ''}`}
                      title="Terrain view"
                    >
                      Terrain
                    </button>
                  </div>
                </div>

                {/* Geolocation */}
                <div className="legend-section">
                  <button
                    onClick={handleGeolocation}
                    className="btn-geolocation"
                    title="Get your current location"
                  >
                    My Location
                  </button>
                </div>

                {/* Magnetic Snapping */}
                <div className="legend-section">
                  <label className="legend-label">Smart Features</label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={magneticSnap}
                      onChange={(e) => setMagneticSnap(e.target.checked)}
                    />
                    <span>Magnetic Snap</span>
                    <span className="checkbox-hint">Snap markers to nearby addresses</span>
                  </label>
                </div>

                {/* Legend Items */}
                <div className="legend-section">
                  <label className="legend-label">Legend</label>
                  <div className="legend-items">
                    <div className="legend-item">
                      <span className="legend-marker-default">📍</span>
                      <span>Saved Address</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-marker-new">��</span>
                      <span>New Address</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-marker-current">📍</span>
                      <span>Your Location</span>
                    </div>
                  </div>
                </div>

                {/* Current Coordinates */}
                {formData.addresses_latitude && formData.addresses_longitude && (
                  <div className="legend-section">
                    <label className="legend-label">Selected Location</label>
                    <div className="coordinate-display">
                      <div className="coord-item">
                        <span className="coord-label">Lat:</span>
                        <span className="coord-value">{formData.addresses_latitude}</span>
                      </div>
                      <div className="coord-item">
                        <span className="coord-label">Lon:</span>
                        <span className="coord-value">{formData.addresses_longitude}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowForm(true)}
                      className="btn-edit-coords"
                    >
                      Edit Location
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lat/Lon Input Fields (Compact) */}
        </div>

        {/* Address List Section */}
        <div className="addresses-list-full-width">
          <div className="sidebar-header">
            <h3>My Addresses</h3>
            <button
              onClick={() => {
                setIsCreatingFromMap(false)
                setFormData({
                  addresses_address: '',
                  addresses_street_number: '',
                  addresses_street_name: '',
                  addresses_city: '',
                  addresses_province: '',
                  addresses_region: '',
                  addresses_postal_code: '',
                  barangay: '',
                  addresses_latitude: '',
                  addresses_longitude: '',
                  address_nickname: '',
                  lot_number: '',
                  lot_area: '',
                  lot_area_unit: 'sqm',
                  property_type: 'Residential',
                  zoning_classification: 'residential',
                  land_use: '',
                  owner_name: '',
                  land_title_number: '',
                  elevation: '',
                  property_status: 'active',
                  notes: ''
                })
                setShowForm(true)
              }}
              className="btn-add-address"
              title="Add new address"
            >
              Add Address
            </button>
          </div>

          <div className="addresses-search-section">
            <input
              type="text"
              placeholder="Search addresses, nicknames..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="addresses-search-input"
            />
          </div>

          <div className="addresses-filters-section">
            <div className="filter-group">
              <label className="filter-label">Filter by Region</label>
              <select
                value={filterRegion}
                onChange={(e) => {
                  setFilterRegion(e.target.value)
                  setFilterCity('all')
                }}
                className="filter-select"
              >
                <option value="all">All Regions</option>
                {regions.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Filter by City</label>
              <div className="city-search-dropdown" ref={citiesDropdownRef}>
                <input
                  type="text"
                  placeholder="Search cities..."
                  value={citiesSearchQuery}
                  onChange={(e) => setCitiesSearchQuery(e.target.value)}
                  onFocus={() => setCitiesSearchOpen(true)}
                  className="city-search-input"
                />
                {citiesSearchOpen && (
                  <div className="city-dropdown-list">
                    <div
                      className="city-option"
                      onClick={() => {
                        setFilterCity('all')
                        setCitiesSearchQuery('')
                        setCitiesSearchOpen(false)
                      }}
                    >
                      All Cities
                    </div>
                    {allCities
                      .filter(city =>
                        city.toLowerCase().includes(citiesSearchQuery.toLowerCase())
                      )
                      .map(city => (
                        <div
                          key={city}
                          className={`city-option ${filterCity === city ? 'active' : ''}`}
                          onClick={() => {
                            setFilterCity(city)
                            setCitiesSearchQuery(city)
                            setCitiesSearchOpen(false)
                          }}
                        >
                          {city}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="popular-cities-section">
            <label className="filter-label">Popular Cities</label>
            <div className="popular-cities-grid">
              {popularCities.map(city => (
                <button
                  key={city.name}
                  onClick={() => handleCitySelect(city.name)}
                  className={`popular-city-btn ${filterCity === city.name ? 'active' : ''} ${city.highlight}`}
                  title={city.region}
                >
                  {city.name}
                </button>
              ))}
            </div>
          </div>

          <div className="addresses-list-section">
            {loading && !addresses.length ? (
              <div className="list-loading">Loading addresses...</div>
            ) : filteredAddresses.length === 0 ? (
              <div className="list-empty">
                <p className="empty-title">No addresses found</p>
                <p className="empty-subtitle">Create your first address to get started</p>
              </div>
            ) : (
              <div className="addresses-list">
                {filteredAddresses.map(address => (
                  <div
                    key={address.id}
                    className={`address-item ${selectedAddressId === address.id ? 'active' : ''}`}
                    onClick={() => setSelectedAddressId(address.id)}
                  >
                    <div className="address-item-header">
                      <div className="address-item-title">
                        <h4 className="address-name">{getAddressDisplayName(address)}</h4>
                        {address.is_default && <span className="default-badge">Default</span>}
                      </div>
                      <div className="address-item-actions">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedAddressForHistory(address.id)
                            loadAddressHistory(address.id)
                            setShowHistory(true)
                          }}
                          className="btn-history"
                          title="View history"
                        >
                          ℹ
                        </button>
                      </div>
                    </div>
                    <p className="address-city">{address.addresses_city}, {address.addresses_region}</p>
                    {address.address_nickname && (
                      <p className="address-nickname-display">Nickname: {address.address_nickname}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Add Address Form Modal */}
        {showForm && (
          <div className="property-form-overlay" onClick={() => setShowForm(false)}>
            <div className="property-form-modal" onClick={e => e.stopPropagation()}>
              <div className="form-modal-header">
                <h2>Add New Address</h2>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setIsCreatingFromMap(false)
                  }}
                  className="form-modal-close"
                >
                  ×
                </button>
              </div>

              {error && (
                <div className="form-error-message">
                  {error}
                  <button onClick={() => setError('')} className="error-close">×</button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="property-form">
                <div className="form-section">
                  <h3 className="form-section-title">Address Nickname</h3>
                  <div className="form-row">
                    <div className="form-group full-width">
                      <label>Address Nickname (e.g., "Home", "Office", "Weekend House")</label>
                      <input
                        type="text"
                        name="address_nickname"
                        value={formData.address_nickname}
                        onChange={handleInputChange}
                        placeholder="Give this address a memorable name"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3 className="form-section-title">Address Information</h3>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Street Number</label>
                      <input
                        type="text"
                        name="addresses_street_number"
                        value={formData.addresses_street_number}
                        onChange={handleInputChange}
                        placeholder="e.g., 123"
                      />
                    </div>
                    <div className="form-group">
                      <label>Street Name *</label>
                      <input
                        type="text"
                        name="addresses_street_name"
                        value={formData.addresses_street_name}
                        onChange={handleInputChange}
                        placeholder="e.g., Makati Avenue"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>City *</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          name="addresses_city"
                          value={formData.addresses_city}
                          onChange={(e) => {
                            handleInputChange(e)
                            const query = e.target.value.toLowerCase()
                            if (query) {
                              setFilteredCities(allCities.filter(city =>
                                city.toLowerCase().includes(query)
                              ))
                              setCitySearchOpen(true)
                            } else {
                              setFilteredCities(allCities)
                              setCitySearchOpen(false)
                            }
                          }}
                          onFocus={() => {
                            setCitySearchOpen(true)
                            setFilteredCities(allCities)
                          }}
                          onBlur={() => setTimeout(() => setCitySearchOpen(false), 200)}
                          placeholder="e.g., Manila"
                          required
                          autoComplete="off"
                        />
                        {citySearchOpen && filteredCities.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            backgroundColor: 'white',
                            border: '1px solid #ccc',
                            borderTop: 'none',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            zIndex: 1000,
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                          }}>
                            {filteredCities.slice(0, 10).map(city => (
                              <div
                                key={city}
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, addresses_city: city }))
                                  setCitySearchOpen(false)
                                }}
                                style={{
                                  padding: '10px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f0f0f0',
                                  backgroundColor: city === formData.addresses_city ? '#f5f5f5' : 'white',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = city === formData.addresses_city ? '#f5f5f5' : 'white'}
                              >
                                {city}
                              </div>
                            ))}
                            {filteredCities.length > 10 && (
                              <div style={{
                                padding: '10px',
                                textAlign: 'center',
                                color: '#999',
                                fontSize: '12px'
                              }}>
                                Showing 10 of {filteredCities.length} cities
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Province</label>
                      <input
                        type="text"
                        name="addresses_province"
                        value={formData.addresses_province}
                        onChange={handleInputChange}
                        placeholder="e.g., Metro Manila"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Region</label>
                      <select
                        name="addresses_region"
                        value={formData.addresses_region}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Region</option>
                        {regionsList.map(region => (
                          <option key={region} value={region}>{region}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Postal Code</label>
                      <input
                        type="text"
                        name="addresses_postal_code"
                        value={formData.addresses_postal_code}
                        onChange={handleInputChange}
                        placeholder="e.g., 1200"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Barangay</label>
                      <input
                        type="text"
                        name="barangay"
                        value={formData.barangay}
                        onChange={handleInputChange}
                        placeholder="Barangay name"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3 className="form-section-title">Geolocation *</h3>

                  <div className="modal-map-section">
                    <div className="modal-map-container" style={{ height: `${modalMapHeight}px`, marginBottom: '16px', position: 'relative' }}>
                      <div className="map-overlay-controls" style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 400 }}>
                        <div className="map-resize-controls">
                          <button
                            onClick={() => setModalMapHeight(prev => Math.max(prev - 50, 200))}
                            className="btn-map-resize"
                            title="Decrease map size"
                          >
                            −
                          </button>
                          <button
                            onClick={() => setModalMapHeight(prev => Math.min(prev + 50, 600))}
                            className="btn-map-resize"
                            title="Increase map size"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => setShowModalMapControls(!showModalMapControls)}
                          className="btn-legend-toggle"
                          title={showModalMapControls ? 'Hide map controls' : 'Show map controls'}
                        >
                          {showModalMapControls ? 'Hide Map Controls' : 'Show Map Controls'}
                        </button>
                      </div>
                      <MapContainer
                        center={[
                          parseFloat(formData.addresses_latitude) || 12.8797,
                          parseFloat(formData.addresses_longitude) || 121.7740
                        ]}
                        zoom={formData.addresses_latitude ? 15 : 6}
                        style={{ height: '100%', width: '100%' }}
                        attributionControl={false}
                      >
                        {modalMapLayer === 'street' && (
                          <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                        )}
                        {modalMapLayer === 'satellite' && (
                          <TileLayer
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                          />
                        )}
                        {modalMapLayer === 'terrain' && (
                          <TileLayer
                            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                          />
                        )}
                        <ModalMapRefHandler onMapReady={setModalMapRef} />
                        <ModalMapClickHandler
                          onMapClick={handleModalMapClick}
                          latitude={formData.addresses_latitude}
                          longitude={formData.addresses_longitude}
                        />
                        {formData.addresses_latitude && formData.addresses_longitude && (
                          <Marker
                            position={[
                              parseFloat(formData.addresses_latitude),
                              parseFloat(formData.addresses_longitude)
                            ]}
                            draggable={true}
                            eventHandlers={{
                              dragend: (e) => {
                                const newLat = e.target.getLatLng().lat
                                const newLng = e.target.getLatLng().lng
                                handleModalMapClick({ latitude: newLat, longitude: newLng })
                              }
                            }}
                          >
                            <Popup>
                              <div className="marker-popup">
                                <p>Lat: {parseFloat(formData.addresses_latitude).toFixed(6)}</p>
                                <p>Lon: {parseFloat(formData.addresses_longitude).toFixed(6)}</p>
                              </div>
                            </Popup>
                          </Marker>
                        )}
                      </MapContainer>

                      {showModalMapControls && (
                        <div className="map-legend" style={{ position: 'absolute', bottom: '10px', right: '10px', maxHeight: 'calc(100% - 20px)', overflowY: 'auto', zIndex: 400 }}>
                          <div className="legend-header">
                            <h4>Map Controls</h4>
                            <button
                              onClick={() => setShowModalMapControls(false)}
                              className="legend-close"
                            >
                              ✕
                            </button>
                          </div>

                          <div className="legend-content">
                            <div className="legend-section">
                              <button
                                onClick={() => {
                                  const center = [12.8797, 121.7740]
                                  const zoom = 6
                                  if (modalMapRef) {
                                    try {
                                      modalMapRef.flyTo(center, zoom, { duration: 1 })
                                    } catch (error) {
                                      console.error('Error flying to Philippines:', error)
                                    }
                                  }
                                }}
                                className="btn-default-location"
                                title="Focus on Philippines"
                              >
                                Philippines
                              </button>
                            </div>

                            <div className="legend-section">
                              <label className="legend-label">Map Layer</label>
                              <div className="layer-buttons">
                                <button
                                  onClick={() => setModalMapLayer('street')}
                                  className={`layer-btn ${modalMapLayer === 'street' ? 'active' : ''}`}
                                  title="Street view"
                                >
                                  Street
                                </button>
                                <button
                                  onClick={() => setModalMapLayer('satellite')}
                                  className={`layer-btn ${modalMapLayer === 'satellite' ? 'active' : ''}`}
                                  title="Satellite view"
                                >
                                  Satellite
                                </button>
                                <button
                                  onClick={() => setModalMapLayer('terrain')}
                                  className={`layer-btn ${modalMapLayer === 'terrain' ? 'active' : ''}`}
                                  title="Terrain view"
                                >
                                  Terrain
                                </button>
                              </div>
                            </div>

                            <div className="legend-section">
                              <label className="legend-label">Legend</label>
                              <div className="legend-items">
                                <div className="legend-item">
                                  <span className="legend-marker-default">📍</span>
                                  <span>Selected Location</span>
                                </div>
                              </div>
                            </div>

                            {formData.addresses_latitude && formData.addresses_longitude && (
                              <div className="legend-section">
                                <label className="legend-label">Selected Location</label>
                                <div className="coordinate-display">
                                  <div className="coord-item">
                                    <span className="coord-label">Lat:</span>
                                    <span className="coord-value">{formData.addresses_latitude}</span>
                                  </div>
                                  <div className="coord-item">
                                    <span className="coord-label">Lon:</span>
                                    <span className="coord-value">{formData.addresses_longitude}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="modal-map-buttons">
                      <button
                        type="button"
                        onClick={handleFetchUserLocation}
                        className="btn-fetch-location btn-fetch-primary"
                        disabled={fetchingLocation}
                      >
                        {fetchingLocation ? 'Getting Location...' : 'Fetch My Location'}
                      </button>
                      <button
                        type="button"
                        onClick={handleFetchLocation}
                        className="btn-fetch-location"
                        disabled={!formData.addresses_latitude || !formData.addresses_longitude}
                      >
                        Search Address from Map
                      </button>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Latitude *</label>
                      <input
                        type="number"
                        name="addresses_latitude"
                        value={formData.addresses_latitude}
                        readOnly
                        placeholder="Click map to set"
                        className="coordinate-input-readonly"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Longitude *</label>
                      <input
                        type="number"
                        name="addresses_longitude"
                        value={formData.addresses_longitude}
                        readOnly
                        placeholder="Click map to set"
                        className="coordinate-input-readonly"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Elevation (meters)</label>
                      <input
                        type="number"
                        name="elevation"
                        value={formData.elevation}
                        onChange={handleInputChange}
                        placeholder="e.g., 45.5"
                        step="0.1"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3 className="form-section-title">Property Information</h3>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Property Type</label>
                      <select
                        name="property_type"
                        value={formData.property_type}
                        onChange={handleInputChange}
                      >
                        {propertyTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Zoning Classification</label>
                      <select
                        name="zoning_classification"
                        value={formData.zoning_classification}
                        onChange={handleInputChange}
                      >
                        {zoningOptions.map(zoning => (
                          <option key={zoning} value={zoning}>{zoning}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Lot Number</label>
                      <input
                        type="text"
                        name="lot_number"
                        value={formData.lot_number}
                        onChange={handleInputChange}
                        placeholder="e.g., LOT-001-MM-2024"
                      />
                    </div>
                    <div className="form-group">
                      <label>Lot Area</label>
                      <div className="input-with-unit">
                        <input
                          type="number"
                          name="lot_area"
                          value={formData.lot_area}
                          onChange={handleInputChange}
                          placeholder="e.g., 1500"
                          step="0.01"
                        />
                        <select
                          name="lot_area_unit"
                          value={formData.lot_area_unit}
                          onChange={handleInputChange}
                        >
                          <option value="sqm">sqm</option>
                          <option value="sqft">sqft</option>
                          <option value="hectares">hectares</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Land Use</label>
                      <input
                        type="text"
                        name="land_use"
                        value={formData.land_use}
                        onChange={handleInputChange}
                        placeholder="e.g., Office Space"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3 className="form-section-title">Ownership & Legal</h3>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Owner Name</label>
                      <input
                        type="text"
                        name="owner_name"
                        value={formData.owner_name}
                        onChange={handleInputChange}
                        placeholder="Property owner name"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Land Title Number</label>
                      <input
                        type="text"
                        name="land_title_number"
                        value={formData.land_title_number}
                        onChange={handleInputChange}
                        placeholder="e.g., TCT-123456"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3 className="form-section-title">Additional Notes</h3>

                  <div className="form-group full-width">
                    <label>Notes</label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      placeholder="Add any additional information about this address..."
                      rows="4"
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setIsCreatingFromMap(false)
                    }}
                    className="btn-form-cancel"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-form-save"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save Address'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Address History Modal */}
        {showHistory && selectedAddressForHistory && (
          <div className="history-overlay" onClick={() => setShowHistory(false)}>
            <div className="history-modal" onClick={e => e.stopPropagation()}>
              <div className="history-modal-header">
                <h2>Address Change History</h2>
                <button
                  onClick={() => setShowHistory(false)}
                  className="history-modal-close"
                >
                  ×
                </button>
              </div>

              <div className="history-modal-content">
                {addressHistory.length === 0 ? (
                  <div className="history-empty">
                    <p className="empty-title">No changes recorded</p>
                    <p className="empty-subtitle">Changes to this address will appear here</p>
                  </div>
                ) : (
                  <div className="history-list">
                    {addressHistory.map((entry) => (
                      <div key={entry.id} className="history-item">
                        <div className="history-item-header">
                          <span className="history-field">{entry.field_name}</span>
                          <span className="history-date">
                            {new Date(entry.changed_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div className="history-item-content">
                          <div className="history-change">
                            <span className="label">Previous:</span>
                            <span className="old-value">{entry.old_value || '(empty)'}</span>
                          </div>
                          <div className="history-change">
                            <span className="label">Current:</span>
                            <span className="new-value">{entry.new_value || '(empty)'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
