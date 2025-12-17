import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { portRateCalculator } from '../lib/portRateCalculatorService'
import { PHILIPPINE_CITIES } from '../data/philippineCitiesCoordinates'
import { useDevice } from '../context/DeviceContext'
import { phpToUsd, displayBothCurrencies, formatCurrency, DEFAULT_EXCHANGE_RATE, fetchExchangeRate } from '../lib/currencyUtils'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, Circle, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icons (needed for proper Leaflet functionality)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const PHILIPPINES_CENTER = [12.8797, 121.7740]
const PHILIPPINES_ZOOM = 6

// Map ref handler component - captures map instance for controls
function MapRefHandler({ onMapReady }) {
  const map = useMap()

  useEffect(() => {
    if (map) {
      onMapReady(map)
    }
  }, [map, onMapReady])

  return null
}

// Marker type color mapping
const markerTypeColorMap = {
  'Landowner': '#3B82F6',
  'Machinery': '#F97316',
  'Equipment': '#10B981',
  'Warehouse': '#A855F7',
  'Seller': '#EF4444',
  'Vendor': '#FBBF24',
  'Manufacturing': '#92400E',
  'Processing': '#06B6D4',
  'Transportation': '#6B7280'
}

const markerTypeEmojis = {
  'Landowner': '🏘️',
  'Machinery': '⚙️',
  'Equipment': '🔧',
  'Warehouse': '🏭',
  'Seller': '🛒',
  'Vendor': '👨‍💼',
  'Manufacturing': '🏗️',
  'Processing': '⚗️',
  'Transportation': '🚚'
}

// Create colored marker icon for ports, products, and custom markers
function createColoredMarker(color = 'red') {
  const colorMap = {
    red: '#EF4444',
    blue: '#3B82F6',
    green: '#10B981',
    yellow: '#FBBF24',
    water: '#3B82F6',
    coconut: '#A16207',
    mango: '#CA8A04',
    landowner: '#3B82F6',
    machinery: '#F97316',
    equipment: '#10B981',
    warehouse: '#A855F7',
    seller: '#EF4444',
    vendor: '#FBBF24',
    manufacturing: '#92400E',
    processing: '#06B6D4',
    transportation: '#6B7280'
  }

  let markerColor = colorMap[color?.toLowerCase()] || colorMap[color] || colorMap.red

  // Handle hex colors directly
  if (color && color.startsWith('#')) {
    markerColor = color
  }

  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${markerColor}" width="32" height="32">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-13c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z"/>
  </svg>`

  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svgString)}`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  })
}

// Map click handler component - captures clicks to create locations
function MapClickHandler({ isCreating, onLocationClick }) {
  useMapEvents({
    click: (e) => {
      if (isCreating) {
        onLocationClick({
          latitude: e.latlng.lat,
          longitude: e.latlng.lng
        })
      }
    }
  })
  return null
}

export default function PlanningChat() {
  const { isMobile, isTablet, isDesktop } = useDevice()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const [userId, setUserId] = useState(null)
  const [userEmail, setUserEmail] = useState('')
  const [planningUser, setPlanningUser] = useState(null)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [messages, setMessages] = useState([])
  const [messageInput, setMessageInput] = useState('')
  const [authChecked, setAuthChecked] = useState(false)
  const [showProfileSettings, setShowProfileSettings] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [locations, setLocations] = useState([])
  const [locationsWithCreators, setLocationsWithCreators] = useState([])
  const [shippingPorts, setShippingPorts] = useState([])
  const [products, setProducts] = useState([])
  const [isCreatingLocation, setIsCreatingLocation] = useState(false)
  const [showLocationForm, setShowLocationForm] = useState(false)
  const [locationForm, setLocationForm] = useState({
    name: '',
    description: '',
    latitude: null,
    longitude: null,
    marker_type: 'Seller'
  })
  const [mapLayer, setMapLayer] = useState('street')
  const [showMapControls, setShowMapControls] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [selectedPortId, setSelectedPortId] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [portCalculatorData, setPortCalculatorData] = useState({
    type: 'teu',
    quantity: 1,
    direction: 'import'
  })
  const [chatTab, setChatTab] = useState('public')  // 'public' or 'private'
  const [privateConversations, setPrivateConversations] = useState([])
  const [selectedPrivateUserId, setSelectedPrivateUserId] = useState(null)
  const [selectedConversationId, setSelectedConversationId] = useState(null)
  const [privateMessages, setPrivateMessages] = useState([])
  const [privateMessageInput, setPrivateMessageInput] = useState('')
  const [selectedPrivateUser, setSelectedPrivateUser] = useState(null)
  const [showUserProfile, setShowUserProfile] = useState(false)
  const [selectedUserForProfile, setSelectedUserForProfile] = useState(null)
  const [selectedMarkerType, setSelectedMarkerType] = useState('Seller')
  const [exchangeRate, setExchangeRate] = useState(DEFAULT_EXCHANGE_RATE)
  const [editingLocationId, setEditingLocationId] = useState(null)
  const [showMarkerTypeSelector, setShowMarkerTypeSelector] = useState(true)
  const [showFilterSelects, setShowFilterSelects] = useState(isMobile ? false : true)

  const messagesEndRef = useRef(null)
  const mapRef = useRef(null)

  const markerTypes = ['Landowner', 'Machinery', 'Equipment', 'Warehouse', 'Seller', 'Vendor', 'Manufacturing', 'Processing', 'Transportation']

  // Check auth on mount
  useEffect(() => {
    checkAuth().finally(() => setAuthChecked(true))
  }, [])

  // Subscribe to messages
  useEffect(() => {
    if (!isAuthenticated) return

    loadMessages()

    try {
      const channel = supabase
        .channel('planning_messages')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'planning_messages'
        }, (payload) => {
          setMessages(prev => [...prev, payload.new])
        })
        .subscribe()

      return () => {
        try { channel.unsubscribe() } catch (e) { /* ignore */ }
      }
    } catch (error) {
      console.debug('Message subscription error (non-critical):', error?.message)
      return () => {}
    }
  }, [isAuthenticated])

  // Subscribe to products updates
  const subscribeToProducts = () => {
    try {
      const channel = supabase
        .channel('planning_products')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'planning_products'
        }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setProducts(prev => [...prev, payload.new])
          } else if (payload.eventType === 'UPDATE') {
            setProducts(prev =>
              prev.map(prod => prod.id === payload.new.id ? payload.new : prod)
            )
          } else if (payload.eventType === 'DELETE') {
            setProducts(prev => prev.filter(prod => prod.id !== payload.old.id))
          }
        })
        .subscribe()

      return () => {
        try { channel.unsubscribe() } catch (e) { /* ignore */ }
      }
    } catch (error) {
      console.debug('Products subscription error (non-critical):', error?.message)
      return () => {}
    }
  }

  // Load shipping ports (public, available to all users)
  useEffect(() => {
    loadShippingPorts()
    loadProducts()
    return subscribeToProducts()
  }, [])

  // Load locations with creator information
  useEffect(() => {
    if (!isAuthenticated) return
    loadLocationsWithCreators()
  }, [isAuthenticated])

  // Subscribe to locations updates
  useEffect(() => {
    if (!isAuthenticated) return

    loadLocations()

    try {
      const channel = supabase
        .channel('planning_markers')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'planning_markers'
        }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setLocations(prev => [...prev, payload.new])
          } else if (payload.eventType === 'UPDATE') {
            setLocations(prev =>
              prev.map(loc => loc.id === payload.new.id ? payload.new : loc)
            )
          } else if (payload.eventType === 'DELETE') {
            setLocations(prev => prev.filter(loc => loc.id !== payload.old.id))
          }
        })
        .subscribe()

      return () => {
        try { channel.unsubscribe() } catch (e) { /* ignore */ }
      }
    } catch (error) {
      console.debug('Location subscription error (non-critical):', error?.message)
      return () => {}
    }
  }, [isAuthenticated])

  // Subscribe to online users
  useEffect(() => {
    if (!isAuthenticated) return

    const loadOnlineUsers = async () => {
      try {
        const { data, error } = await supabase
          .from('planning_users')
          .select('*')
          .eq('status', 'active')
          .order('name', { ascending: true })

        if (error) {
          console.debug('Online users loading error:', error.code)
          return
        }

        setOnlineUsers(data || [])
      } catch (error) {
        console.debug('Error loading online users:', error?.message)
      }
    }

    loadOnlineUsers()
    const interval = setInterval(loadOnlineUsers, 15000)

    return () => clearInterval(interval)
  }, [isAuthenticated])

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Fetch exchange rate on mount
  useEffect(() => {
    const loadExchangeRate = async () => {
      const rate = await fetchExchangeRate()
      setExchangeRate(rate)
    }
    loadExchangeRate()
  }, [])

  // Initialize editing name when planning user loads
  useEffect(() => {
    if (planningUser?.name) {
      setEditingName(planningUser.name)
    }
  }, [planningUser])

  const checkAuth = async () => {
    try {
      const { data } = await supabase.auth.getUser()
      if (data?.user) {
        setUserId(data.user.id)
        setUserEmail(data.user.email || '')
        setIsAuthenticated(true)
        await loadPlanningUser(data.user.id)
      } else {
        setIsAuthenticated(false)
        setPlanningUser(null)
        setUserEmail('')
      }
    } catch (error) {
      if (error?.name === 'AuthSessionMissingError' || error?.message?.includes('Auth session missing')) {
        // User not logged in - this is expected
      } else {
        console.error('Auth check error:', error?.message || error)
      }
      setIsAuthenticated(false)
      setPlanningUser(null)
      setUserEmail('')
    }
  }

  const loadPlanningUser = async (uid) => {
    try {
      const { data, error } = await supabase
        .from('planning_users')
        .select('*')
        .eq('user_id', uid)
        .single()

      if (error) {
        // No planning_user record exists yet - create one
        const displayName = userEmail.split('@')[0]
        const { data: newUser } = await supabase
          .from('planning_users')
          .insert({
            user_id: uid,
            email: userEmail,
            name: displayName,
            status: 'active',
            role: 'member'
          })
          .select()
          .single()

        if (newUser) {
          setPlanningUser(newUser)
          setEditingName(newUser.name)
        }
        return
      }

      if (data) {
        setPlanningUser(data)
        setEditingName(data.name)
      }
    } catch (error) {
      console.error('Error loading planning user:', error?.message || error)
      setPlanningUser(null)
    }
  }

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('planning_messages')
        .select('*, planning_users(id, name, email, user_id)')
        .order('created_at', { ascending: true })
        .limit(100)

      if (error) {
        console.debug('Message loading error (table may not exist yet):', error.code)
        return
      }

      setMessages(data || [])
    } catch (error) {
      console.debug('Error loading messages:', error?.message)
    }
  }

  const loadLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('planning_markers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        if (error.code === 'PGRST116' || error.code === '42P01') {
          // Table doesn't exist, that's fine
          console.debug('planning_markers table not found')
          return
        }
        console.debug('Location loading error:', error.code)
        return
      }

      setLocations(data || [])
    } catch (error) {
      console.debug('Error loading locations:', error?.message)
    }
  }

  const loadShippingPorts = async () => {
    try {
      const { data, error } = await supabase
        .from('planning_shipping_ports')
        .select('*')
        .eq('is_public', true)
        .eq('status', 'active')
        .order('country_code', { ascending: true })
        .order('name', { ascending: true })

      if (error) {
        if (error.code === 'PGRST116' || error.code === '42P01') {
          console.debug('planning_shipping_ports table not found')
          return
        }
        console.debug('Shipping ports loading error:', error.code)
        return
      }

      setShippingPorts(data || [])
    } catch (error) {
      console.debug('Error loading shipping ports:', error?.message)
    }
  }

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('planning_products')
        .select('*, planning_users(id, name, email)')
        .eq('is_active', true)
        .order('product_type', { ascending: true })
        .order('name', { ascending: true })

      if (error) {
        if (error.code === 'PGRST116' || error.code === '42P01') {
          console.debug('planning_products table not found')
          return
        }
        console.debug('Products loading error:', error.code)
        return
      }

      setProducts(data || [])
    } catch (error) {
      console.debug('Error loading products:', error?.message)
    }
  }

  const loadLocationsWithCreators = async () => {
    try {
      const { data, error } = await supabase
        .from('planning_markers')
        .select('*, planning_users!planning_markers_planning_user_id_fkey(id, name, email, user_id)')
        .order('created_at', { ascending: false })

      if (error) {
        if (error.code === 'PGRST116' || error.code === '42P01') {
          console.debug('planning_markers table not found')
          return
        }
        console.debug('Locations loading error:', error.code, error.message)
        return
      }

      setLocations(data || [])
      setLocationsWithCreators(data || [])
    } catch (error) {
      console.debug('Error loading locations:', error?.message)
    }
  }

  const handleSignIn = async (e) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        setAuthError(error.message)
        return
      }

      setUserId(data.user.id)
      setUserEmail(data.user.email || '')
      setIsAuthenticated(true)
      loadPlanningUser(data.user.id)
      setEmail('')
      setPassword('')
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
      })

      if (authError) {
        setAuthError(authError.message)
        return
      }

      const { error: insertError } = await supabase
        .from('planning_users')
        .insert({
          user_id: authData.user.id,
          email,
          name: name || email.split('@')[0],
          status: 'active',
          role: 'member'
        })

      if (insertError) {
        setAuthError(insertError.message)
        return
      }

      setAuthError('Registration successful!')
      setEmail('')
      setPassword('')
      setName('')
      setTimeout(() => {
        setAuthMode('login')
        checkAuth()
      }, 1500)
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setIsAuthenticated(false)
    setUserId(null)
    setUserEmail('')
    setPlanningUser(null)
    setMessages([])
    setOnlineUsers([])
    setLocations([])
  }

  const sendMessage = async () => {
    if (!messageInput.trim() || !planningUser) return

    const messageText = messageInput.trim()
    setMessageInput('')

    try {
      const { data, error } = await supabase
        .from('planning_messages')
        .insert({
          user_id: userId,
          planning_user_id: planningUser.id,
          message: messageText
        })
        .select()

      if (error) {
        console.error('Error sending message:', error.code, error.message)
        setMessageInput(messageText)
        return
      }

      if (data && data.length > 0) {
        setMessages(prev => [...prev, { ...data[0], planning_users: { name: planningUser.name, email: userEmail } }])
      }
    } catch (error) {
      console.error('Error sending message:', error?.message)
      setMessageInput(messageText)
    }
  }

  const handleMapLocationClick = (coords) => {
    setLocationForm({
      name: '',
      description: '',
      latitude: coords.latitude,
      longitude: coords.longitude,
      marker_type: selectedMarkerType
    })
    setShowLocationForm(true)
  }

  // Get default metadata structure based on marker type
  const getDefaultMetadata = (markerType) => {
    const baseMetadata = { createdAt: new Date().toISOString() }

    switch (markerType) {
      case 'Equipment':
        return { ...baseMetadata, equipment: [] }
      case 'Machinery':
        return { ...baseMetadata, model: '', condition: 'operational', quantity: 1, costPerUnit: 0 }
      case 'Warehouse':
        return { ...baseMetadata, capacitySqMeters: 0, storageType: '', utilizationPercent: 0, monthlyCostPhp: 0 }
      case 'Seller':
      case 'Vendor':
        return { ...baseMetadata, productName: '', quantityAvailable: 0, pricePerUnitPhp: 0 }
      case 'Manufacturing':
        return { ...baseMetadata, outputCapacityPerDay: 0, productType: '' }
      case 'Processing':
        return { ...baseMetadata, capacityKgPerHour: 0, processType: '' }
      case 'Landowner':
        return { ...baseMetadata, landSizeSqMeters: 0, zoningType: '', availableSpacePercent: 100 }
      case 'Transportation':
        return { ...baseMetadata, vehicleType: '', capacityTonnage: 0, availableRoutes: '' }
      default:
        return baseMetadata
    }
  }

  const handleSelectMarkerType = (type) => {
    setSelectedMarkerType(type)
    setIsCreatingLocation(true)
  }

  const handleSaveLocation = async (e) => {
    e.preventDefault()
    if (!locationForm.name.trim() || !planningUser) {
      setAuthError('Please enter a location name')
      return
    }

    if (locationForm.latitude === null || locationForm.longitude === null) {
      setAuthError('Please click on the map to select a location')
      return
    }

    try {
      const metadata = locationForm.metadata || getDefaultMetadata(locationForm.marker_type)

      const payload = {
        planning_user_id: planningUser.id,
        user_id: userId,
        name: locationForm.name.trim(),
        description: locationForm.description.trim(),
        marker_type: locationForm.marker_type,
        latitude: parseFloat(locationForm.latitude),
        longitude: parseFloat(locationForm.longitude),
        metadata: metadata,
        exchange_rate: exchangeRate,
        rate_updated_at: new Date().toISOString()
      }

      console.debug('Saving marker with payload:', payload)

      let query = supabase.from('planning_markers')
      let result

      if (editingLocationId) {
        result = await query
          .update(payload)
          .eq('id', editingLocationId)
          .select()
      } else {
        result = await query
          .insert(payload)
          .select()
      }

      const { data, error } = result

      if (error) {
        console.error('Error saving location:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
        setAuthError(`Failed to save location: ${error.message}`)
        return
      }

      if (!data || data.length === 0) {
        console.warn('No data returned from insert')
        setAuthError('Location saved but unable to confirm. Please refresh.')
        return
      }

      console.log('Location saved successfully:', data)

      // Reload locations with creators
      await loadLocationsWithCreators()

      setShowLocationForm(false)
      setIsCreatingLocation(false)
      setEditingLocationId(null)
      setLocationForm({
        name: '',
        description: '',
        latitude: null,
        longitude: null,
        marker_type: 'Seller',
        metadata: {}
      })
      setAuthError('')
    } catch (error) {
      console.error('Error saving location:', error?.message, error)
      setAuthError(`Error saving location: ${error?.message}`)
    }
  }

  const handleDeleteLocation = async (locationId) => {
    try {
      const { error } = await supabase
        .from('planning_markers')
        .delete()
        .eq('id', locationId)

      if (error) {
        console.error('Error deleting location:', error?.message || error)
        return
      }

      setLocations(prev => prev.filter(loc => loc.id !== locationId))
    } catch (error) {
      console.error('Error deleting location:', error?.message)
    }
  }

  const handleSaveProfile = async () => {
    if (!planningUser || !editingName.trim()) return

    try {
      const { error } = await supabase
        .from('planning_users')
        .update({ name: editingName.trim() })
        .eq('id', planningUser.id)

      if (error) {
        console.error('Profile update error:', error?.message || error)
        setAuthError('Failed to update profile: ' + error.message)
        return
      }

      const newUser = { ...planningUser, name: editingName.trim() }
      setPlanningUser(newUser)
      setShowProfileSettings(false)
      setAuthError('')
    } catch (error) {
      console.error('Error updating profile:', error?.message || error)
      setAuthError('Error updating profile: ' + error.message)
    }
  }

  const handleCenterPhilippines = () => {
    if (mapRef.current) {
      try {
        mapRef.current.flyTo(PHILIPPINES_CENTER, PHILIPPINES_ZOOM, { duration: 1 })
      } catch (error) {
        console.error('Error flying to Philippines:', error)
      }
    }
  }

  const handleZoomIn = () => {
    if (mapRef.current) {
      try {
        mapRef.current.zoomIn()
      } catch (error) {
        console.error('Error zooming in:', error)
      }
    }
  }

  const handleZoomOut = () => {
    if (mapRef.current) {
      try {
        mapRef.current.zoomOut()
      } catch (error) {
        console.error('Error zooming out:', error)
      }
    }
  }

  const handleLocationSelect = (e) => {
    const locationId = e.target.value
    setSelectedLocationId(locationId)
    setSelectedPortId('')

    if (!locationId || !mapRef.current) return

    const location = locations.find(loc => loc.id === locationId)
    if (location) {
      try {
        mapRef.current.flyTo([location.latitude, location.longitude], 12, { duration: 1 })
      } catch (error) {
        console.error('Error flying to location:', error)
      }
    }
  }

  const handlePortSelect = (e) => {
    const portId = e.target.value
    setSelectedPortId(portId)
    setSelectedLocationId('')

    if (!portId || !mapRef.current) return

    const port = shippingPorts.find(p => p.id === parseInt(portId))
    if (port) {
      try {
        mapRef.current.flyTo([port.latitude, port.longitude], 10, { duration: 1 })
      } catch (error) {
        console.error('Error flying to port:', error)
      }
    }
  }

  const handlePortCalculatorChange = (field, value) => {
    setPortCalculatorData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const getTileLayerUrl = () => {
    switch (mapLayer) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      case 'terrain':
        return 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
      default:
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    }
  }

  const handleCitySelect = (e) => {
    const cityName = e.target.value
    setSelectedCity(cityName)
    setSelectedLocationId('')
    setSelectedPortId('')

    if (!cityName || !mapRef.current) return

    const city = PHILIPPINE_CITIES.find(c => c.name === cityName)
    if (city) {
      try {
        mapRef.current.flyTo([city.lat, city.lng], 11, { duration: 1 })
      } catch (error) {
        console.error('Error flying to city:', error)
      }
    }
  }

  const handleShowUserProfile = (user) => {
    setSelectedUserForProfile(user)
    setShowUserProfile(true)
  }

  const handleStartConversationFromProfile = async () => {
    if (selectedUserForProfile) {
      setShowUserProfile(false)
      await loadOrCreateConversation(selectedUserForProfile.user_id, selectedUserForProfile)
    }
  }

  const loadOrCreateConversation = async (otherUserId, otherUserData = null) => {
    try {
      // Try to find existing conversation using both possible orderings
      const { data: existingConversations, error: fetchError } = await supabase
        .from('planning_conversations')
        .select('*')
        .or(`and(user1_id.eq.${userId},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${userId})`)

      if (fetchError) {
        console.error('Error fetching conversation:', fetchError.message)
      }

      let conversationId
      let existingConversation = existingConversations && existingConversations.length > 0 ? existingConversations[0] : null

      if (!existingConversation) {
        // Create new conversation
        const { data: newConversation, error: createError } = await supabase
          .from('planning_conversations')
          .insert({
            user1_id: userId,
            user2_id: otherUserId,
            is_active: true
          })
          .select()
          .single()

        if (createError) {
          // Handle unique constraint violation - conversation might already exist in opposite order
          if (createError.code === '23505' || createError.message?.includes('unique')) {
            // Retry the fetch one more time to get the conversation
            const { data: retryData } = await supabase
              .from('planning_conversations')
              .select('*')
              .or(`and(user1_id.eq.${userId},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${userId})`)

            if (retryData && retryData.length > 0) {
              conversationId = retryData[0].id
              existingConversation = retryData[0]
            } else {
              console.error('Error creating conversation:', createError.message || JSON.stringify(createError))
              setAuthError(`Failed to open conversation: ${createError.message || 'Unknown error'}`)
              return
            }
          } else {
            console.error('Error creating conversation:', createError.message || JSON.stringify(createError))
            setAuthError(`Failed to open conversation: ${createError.message || 'Unknown error'}`)
            return
          }
        } else {
          conversationId = newConversation.id
          existingConversation = newConversation
        }
      } else {
        conversationId = existingConversation.id
      }

      setSelectedPrivateUserId(otherUserId)
      setSelectedPrivateUser(otherUserData)
      setSelectedConversationId(conversationId)
      setChatTab('private')
      await loadPrivateMessages(conversationId)
    } catch (error) {
      console.error('Error loading conversation:', error.message || error)
      setAuthError('Failed to open conversation')
    }
  }

  const loadPrivateMessages = async (conversationId) => {
    try {
      const { data, error } = await supabase
        .from('planning_private_messages')
        .select('*, planning_users(id, name, email, user_id)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) {
        console.debug('Private messages loading error:', error.code)
        return
      }

      setPrivateMessages(data || [])
    } catch (error) {
      console.debug('Error loading private messages:', error?.message)
    }
  }

  const sendPrivateMessage = async () => {
    if (!privateMessageInput.trim() || !selectedConversationId) {
      setAuthError('Cannot send message - conversation not loaded')
      return
    }

    const messageText = privateMessageInput.trim()

    try {
      const { error } = await supabase
        .from('planning_private_messages')
        .insert({
          conversation_id: selectedConversationId,
          sender_id: userId,
          message: messageText
        })

      if (error) {
        console.error('Error sending private message:', error?.message || error)
        setAuthError('Failed to send message')
        return
      }

      setPrivateMessageInput('')
      await loadPrivateMessages(selectedConversationId)
      setAuthError('')
    } catch (error) {
      console.error('Error sending private message:', error?.message)
      setAuthError('Error sending message')
    }
  }

  // Show loading while checking auth
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white mb-4">Initializing Planning Group...</div>
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-150"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-300"></div>
          </div>
        </div>
      </div>
    )
  }

  const showAuthModal = !isAuthenticated

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className={`bg-slate-800 border-b border-slate-700 ${isMobile ? 'px-4 py-3' : 'px-6 py-4'}}`}>
        <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between mb-3'}`}>
          <div>
            <h1 className={`font-bold text-white ${isMobile ? 'text-lg' : 'text-2xl'}`}>Planning Group</h1>
            <p className={`text-slate-400 ${isMobile ? 'text-xs' : 'text-sm'}`}>Strategic partner coordination for manufacturing & distribution</p>
          </div>
          {isAuthenticated && (
            <div className={`flex ${isMobile ? 'items-center justify-between w-full' : 'items-center gap-4'}`}>
              <button
                onClick={() => setShowProfileSettings(true)}
                className={`text-slate-300 hover:text-white transition-colors ${isMobile ? 'text-xs truncate max-w-[200px]' : 'text-sm'}`}
                title="Edit profile"
              >
                {planningUser?.name || userEmail}
              </button>
              <button
                onClick={handleSignOut}
                className={`bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition-colors ${isMobile ? 'px-2 py-1 text-xs' : 'px-4 py-2 text-sm'}`}
              >
                {isMobile ? 'Out' : 'Sign Out'}
              </button>
            </div>
          )}
        </div>

        {/* Public Locations & Ports Dropdown with Collapse on Mobile */}
        <div className={`${isMobile ? 'flex flex-col gap-2' : 'flex items-center gap-3 flex-wrap'} bg-slate-700 px-4 py-3 rounded-lg`}>
          {isMobile && (
            <button
              onClick={() => setShowFilterSelects(!showFilterSelects)}
              className="w-full flex items-center justify-between text-slate-300 font-medium text-sm hover:text-white transition-colors"
            >
              <span>🔍 Filters</span>
              <span className="text-xs">{showFilterSelects ? '▼' : '▶'}</span>
            </button>
          )}

          {(showFilterSelects || !isMobile) && (
            <>
              {locations.length > 0 && (
                <div className={`flex ${isMobile ? 'flex-col gap-1 w-full' : 'items-center gap-2'}`}>
                  <label htmlFor="public-locations-select" className={`text-slate-300 font-medium opacity-50 ${isMobile ? 'text-xs' : 'text-sm'}`}>Locations:</label>
                  <select
                    id="public-locations-select"
                    value={selectedLocationId}
                    onChange={handleLocationSelect}
                    className={`rounded bg-slate-700 text-white border border-slate-600 hover:border-slate-500 transition-colors cursor-pointer focus:outline-none focus:border-blue-400 ${isMobile ? 'w-full px-2 py-1.5 text-xs' : 'px-3 py-1 text-sm'}`}
                  >
                    <option value="">View location...</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {shippingPorts.length > 0 && (
                <div className={`flex ${isMobile ? 'flex-col gap-1 w-full' : 'items-center gap-2'}`}>
                  <label htmlFor="shipping-ports-select" className={`text-slate-300 font-medium opacity-50 ${isMobile ? 'text-xs' : 'text-sm'}`}>Ports:</label>
                  <select
                    id="shipping-ports-select"
                    value={selectedPortId}
                    onChange={handlePortSelect}
                    className={`rounded bg-slate-700 text-white border border-slate-600 hover:border-slate-500 transition-colors cursor-pointer focus:outline-none focus:border-blue-400 ${isMobile ? 'w-full px-2 py-1.5 text-xs' : 'px-3 py-1 text-sm'}`}
                  >
                    <option value="">View port...</option>
                    {shippingPorts.map(port => (
                      <option key={port.id} value={port.id}>
                        {port.name} ({port.country_code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={`flex ${isMobile ? 'flex-col gap-1 w-full' : 'items-center gap-2'}`}>
                <label htmlFor="cities-select" className={`text-slate-300 font-medium opacity-50 ${isMobile ? 'text-xs' : 'text-sm'}`}>Cities:</label>
                <select
                  id="cities-select"
                  value={selectedCity}
                  onChange={handleCitySelect}
                  className={`rounded bg-slate-700 text-white border border-slate-600 hover:border-slate-500 transition-colors cursor-pointer focus:outline-none focus:border-blue-400 ${isMobile ? 'w-full px-2 py-1.5 text-xs' : 'px-3 py-1 text-sm'}`}
                >
                  <option value="">Select a city...</option>
                  {PHILIPPINE_CITIES.map((city, idx) => (
                    <option key={`city-${idx}`} value={city.name}>
                      {city.name} ({city.region})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      <div className={`flex-1 flex ${isMobile ? 'flex-col gap-3' : 'gap-6'} ${isMobile ? 'p-3' : 'p-6'} overflow-hidden`}>
        {/* Map Section */}
        <div className={`rounded-lg overflow-hidden border border-slate-700 bg-slate-800 flex flex-col ${isMobile ? 'flex-1 min-h-[calc(100vh-400px)]' : 'flex-1'}`}>
          {/* Map Controls */}
          {isAuthenticated && (
            <div className={`bg-slate-700 border-b border-slate-600 flex ${isMobile ? 'flex-col gap-2 px-2 py-2' : 'items-center justify-between flex-wrap gap-2 px-4 py-3'}`}>
              <div className={`flex ${isMobile ? 'flex-col gap-2 w-full' : 'items-center gap-2 flex-wrap'}`}>
                <span className={`text-white font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>{locations.length} locations</span>
                {locations.length > 0 && (
                  <select
                    value={selectedLocationId}
                    onChange={handleLocationSelect}
                    className={`rounded font-medium bg-slate-600 text-white border border-slate-500 hover:bg-slate-500 transition-colors cursor-pointer focus:outline-none focus:border-blue-400 ${isMobile ? 'w-full px-2 py-1.5 text-xs' : 'px-2 py-1 text-xs'}`}
                  >
                    <option value="">Jump to location...</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={selectedCity}
                  onChange={handleCitySelect}
                  className={`rounded font-medium bg-slate-600 text-white border border-slate-500 hover:bg-slate-500 transition-colors cursor-pointer focus:outline-none focus:border-blue-400 ${isMobile ? 'w-full px-2 py-1.5 text-xs' : 'px-2 py-1 text-xs'}`}
                >
                  <option value="">Jump to city...</option>
                  {PHILIPPINE_CITIES.map((city, idx) => (
                    <option key={`city-ctrl-${idx}`} value={city.name}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={`flex ${isMobile ? 'w-full gap-1' : 'items-center gap-2'}`}>
                <button
                  onClick={handleCenterPhilippines}
                  className={`rounded font-medium bg-slate-600 hover:bg-slate-500 text-white transition-colors ${isMobile ? 'flex-1 py-1.5 text-xs' : 'px-2 py-1 text-xs'}`}
                  title="Center map on Philippines"
                >
                  🇵🇭
                </button>
                <button
                  onClick={handleZoomOut}
                  className={`rounded font-medium bg-slate-600 hover:bg-slate-500 text-white transition-colors ${isMobile ? 'flex-1 py-1.5 text-xs' : 'px-2 py-1 text-xs'}`}
                  title="Zoom out"
                >
                  −
                </button>
                <button
                  onClick={handleZoomIn}
                  className={`rounded font-medium bg-slate-600 hover:bg-slate-500 text-white transition-colors ${isMobile ? 'flex-1 py-1.5 text-xs' : 'px-2 py-1 text-xs'}`}
                  title="Zoom in"
                >
                  +
                </button>
                <button
                  onClick={() => setShowMapControls(!showMapControls)}
                  className={`rounded font-medium transition-colors ${
                    showMapControls
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-slate-600 hover:bg-slate-500 text-white'
                  } ${isMobile ? 'flex-1 py-1.5 text-xs' : 'px-2 py-1 text-xs'}`}
                  title="Show/hide map layers"
                >
                  {isMobile ? '◧' : 'Layers'}
                </button>
                <button
                  onClick={() => {
                    setIsCreatingLocation(!isCreatingLocation)
                    if (!isCreatingLocation) setShowLocationForm(false)
                  }}
                  className={`rounded font-medium transition-colors ${
                    isCreatingLocation
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-slate-600 hover:bg-slate-500 text-white'
                  } ${isMobile ? 'flex-1 py-1.5 text-xs' : 'px-3 py-1 text-xs'}`}
                >
                  {isMobile ? (isCreatingLocation ? '✓' : '+') : (isCreatingLocation ? '✓ Click map to add' : '+ Add Location')}
                </button>
              </div>
            </div>
          )}

          {/* Map Layer Controls */}
          {isAuthenticated && showMapControls && (
            <div className="bg-slate-750 px-4 py-2 border-b border-slate-600 flex items-center gap-2">
              <span className="text-slate-300 text-xs font-medium">Map Layer:</span>
              <button
                onClick={() => setMapLayer('street')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  mapLayer === 'street'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-600 hover:bg-slate-500 text-white'
                }`}
              >
                Street
              </button>
              <button
                onClick={() => setMapLayer('satellite')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  mapLayer === 'satellite'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-600 hover:bg-slate-500 text-white'
                }`}
              >
                Satellite
              </button>
              <button
                onClick={() => setMapLayer('terrain')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  mapLayer === 'terrain'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-600 hover:bg-slate-500 text-white'
                }`}
              >
                Terrain
              </button>
            </div>
          )}

          {/* Map Container */}
          <div className="flex-1 overflow-hidden relative">
            <style>{`
              .planning-map-container .leaflet-tile {
                border: none !important;
                outline: none !important;
              }
              .planning-map-container img.leaflet-tile {
                opacity: 1;
              }
              .planning-map-container[data-marker-type="Landowner"] {
                cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="14" fill="%233B82F6" opacity="0.7"/><text x="16" y="20" font-size="18" text-anchor="middle" dominant-baseline="middle">🏘️</text></svg>') 16 16, auto;
              }
              .planning-map-container[data-marker-type="Machinery"] {
                cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="14" fill="%23F97316" opacity="0.7"/><text x="16" y="20" font-size="18" text-anchor="middle" dominant-baseline="middle">⚙️</text></svg>') 16 16, auto;
              }
              .planning-map-container[data-marker-type="Equipment"] {
                cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="14" fill="%2310B981" opacity="0.7"/><text x="16" y="20" font-size="18" text-anchor="middle" dominant-baseline="middle">🔧</text></svg>') 16 16, auto;
              }
              .planning-map-container[data-marker-type="Warehouse"] {
                cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="14" fill="%23A855F7" opacity="0.7"/><text x="16" y="20" font-size="18" text-anchor="middle" dominant-baseline="middle">🏭</text></svg>') 16 16, auto;
              }
              .planning-map-container[data-marker-type="Seller"] {
                cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="14" fill="%23EF4444" opacity="0.7"/><text x="16" y="20" font-size="18" text-anchor="middle" dominant-baseline="middle">🛒</text></svg>') 16 16, auto;
              }
              .planning-map-container[data-marker-type="Vendor"] {
                cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="14" fill="%23FBBF24" opacity="0.7"/><text x="16" y="20" font-size="18" text-anchor="middle" dominant-baseline="middle">👨‍💼</text></svg>') 16 16, auto;
              }
              .planning-map-container[data-marker-type="Manufacturing"] {
                cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="14" fill="%2392400E" opacity="0.7"/><text x="16" y="20" font-size="18" text-anchor="middle" dominant-baseline="middle">🏗️</text></svg>') 16 16, auto;
              }
              .planning-map-container[data-marker-type="Processing"] {
                cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="14" fill="%2306B6D4" opacity="0.7"/><text x="16" y="20" font-size="18" text-anchor="middle" dominant-baseline="middle">⚗️</text></svg>') 16 16, auto;
              }
              .planning-map-container[data-marker-type="Transportation"] {
                cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="14" fill="%236B7280" opacity="0.7"/><text x="16" y="20" font-size="18" text-anchor="middle" dominant-baseline="middle">🚚</text></svg>') 16 16, auto;
              }
              .marker-type-selector {
                position: absolute;
                ${isMobile ? 'bottom: 16px; right: 8px; max-height: 400px; overflow-y: auto; width: 200px;' : 'top: 16px; right: 16px; width: 180px;'}
                z-index: 1000;
                background: rgba(15, 23, 42, 0.95);
                ${isMobile ? 'padding: 12px;' : 'padding: 14px;'}
                border-radius: 8px;
                backdrop-filter: blur(8px);
                border: 1px solid rgba(100, 116, 139, 0.3);
              }
              .marker-type-label {
                display: inline-block;
                ${isMobile ? 'font-size: 10px;' : 'font-size: 11px;'}
                font-weight: 600;
                color: white;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-right: 8px;
              }
              .marker-type-grid {
                display: grid;
                grid-template-columns: 1fr;
                gap: 8px;
                margin-top: 10px;
              }
              .marker-type-btn {
                padding: 10px 12px;
                border-radius: 6px;
                border: 1.5px solid rgba(100, 116, 139, 0.4);
                background: rgba(51, 65, 85, 0.6);
                color: rgb(226, 232, 240);
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 8px;
                width: 100%;
                justify-content: flex-start;
              }
              .marker-type-btn:hover {
                background: rgba(71, 85, 105, 0.8);
                border-color: rgb(148, 163, 184);
                color: white;
              }
              .marker-type-btn.active {
                background: linear-gradient(135deg, rgb(59, 130, 246), rgb(37, 99, 235));
                border-color: rgb(59, 130, 246);
                color: white;
                box-shadow: 0 0 16px rgba(59, 130, 246, 0.5);
              }
            `}</style>

            {/* Marker Type Selector Panel with Collapse/Expand */}
            {isAuthenticated && (
              <div className="marker-type-selector">
                <div className="flex items-center justify-between">
                  {(showMarkerTypeSelector || !isMobile) && (
                    <span className="marker-type-label">Select Type</span>
                  )}
                  <button
                    onClick={() => setShowMarkerTypeSelector(!showMarkerTypeSelector)}
                    className="text-slate-300 hover:text-white transition-colors text-lg font-medium flex-shrink-0"
                    title={showMarkerTypeSelector ? 'Collapse' : 'Expand'}
                  >
                    {showMarkerTypeSelector ? '▼' : '▶'}
                  </button>
                </div>
                {showMarkerTypeSelector && (
                  <div className="marker-type-grid">
                    {markerTypes.map(type => (
                      <button
                        key={type}
                        onClick={() => handleSelectMarkerType(type)}
                        className={`marker-type-btn ${selectedMarkerType === type ? 'active' : ''}`}
                        title={`${markerTypeEmojis[type]} ${type}`}
                      >
                        <span>{markerTypeEmojis[type]}</span>
                        <span>{type}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <MapContainer center={PHILIPPINES_CENTER} zoom={PHILIPPINES_ZOOM} className="w-full h-full planning-map-container" data-marker-type={selectedMarkerType} attributionControl={false}>
              <TileLayer
                url={getTileLayerUrl()}
                attribution=""
                crossOrigin="anonymous"
                maxNativeZoom={19}
                maxZoom={25}
              />
              <MapRefHandler onMapReady={(map) => { mapRef.current = map }} />
              {isCreatingLocation && <MapClickHandler isCreating={isCreatingLocation} onLocationClick={handleMapLocationClick} />}

              {selectedCity && (
                <Circle
                  center={[PHILIPPINE_CITIES.find(c => c.name === selectedCity)?.lat || 12.8797, PHILIPPINE_CITIES.find(c => c.name === selectedCity)?.lng || 121.7740]}
                  radius={10000}
                  pathOptions={{
                    fillColor: '#3B82F6',
                    fillOpacity: 0.2,
                    color: '#2563EB',
                    weight: 2
                  }}
                />
              )}

              {locations.map(loc => {
                const creatorName = loc.planning_users?.name || 'Unknown User'
                const markerColor = markerTypeColorMap[loc.marker_type] || '#EF4444'
                const markerEmoji = markerTypeEmojis[loc.marker_type] || '📍'
                const markerIcon = createColoredMarker(markerColor)
                return (
                  <Marker key={`loc-${loc.id}`} position={[loc.latitude, loc.longitude]} icon={markerIcon}>
                    <Popup>
                      <div className="p-3 min-w-48 bg-white rounded">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{markerEmoji}</span>
                          <span className="text-xs font-bold px-2 py-1 rounded text-white" style={{backgroundColor: markerColor}}>
                            {loc.marker_type || 'Unknown'}
                          </span>
                        </div>
                        <h3 className="font-semibold text-sm">{loc.name}</h3>
                        {loc.description && <p className="text-xs text-slate-600 mt-1">{loc.description}</p>}
                        <p className="text-xs text-slate-500 mt-2">📍 {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}</p>

                        {/* Display metadata based on marker type */}
                        {loc.metadata && (
                          <div className="border-t pt-2 mt-2">
                            {loc.marker_type === 'Equipment' && loc.metadata.equipment && loc.metadata.equipment.length > 0 && (
                              <div className="text-xs">
                                <p className="font-semibold text-slate-700">Equipment:</p>
                                {loc.metadata.equipment.map((item, idx) => (
                                  <div key={idx} className="text-slate-600">
                                    <p>• {item.name}: {displayBothCurrencies(item.costPhp, loc.exchange_rate)}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            {loc.marker_type === 'Machinery' && (
                              <div className="text-xs text-slate-600">
                                {loc.metadata.model && <p><strong>Model:</strong> {loc.metadata.model}</p>}
                                {loc.metadata.condition && <p><strong>Condition:</strong> {loc.metadata.condition}</p>}
                                {loc.metadata.quantity && <p><strong>Qty:</strong> {loc.metadata.quantity}</p>}
                                {loc.metadata.costPerUnit && <p><strong>Cost/Unit:</strong> {displayBothCurrencies(loc.metadata.costPerUnit, loc.exchange_rate)}</p>}
                              </div>
                            )}
                            {loc.marker_type === 'Warehouse' && (
                              <div className="text-xs text-slate-600">
                                {loc.metadata.capacitySqMeters && <p><strong>Capacity:</strong> {loc.metadata.capacitySqMeters} sqm</p>}
                                {loc.metadata.storageType && <p><strong>Type:</strong> {loc.metadata.storageType}</p>}
                                {loc.metadata.utilizationPercent && <p><strong>Utilization:</strong> {loc.metadata.utilizationPercent}%</p>}
                                {loc.metadata.monthlyCostPhp && <p><strong>Monthly:</strong> {displayBothCurrencies(loc.metadata.monthlyCostPhp, loc.exchange_rate)}</p>}
                              </div>
                            )}
                            {(loc.marker_type === 'Seller' || loc.marker_type === 'Vendor') && (
                              <div className="text-xs text-slate-600">
                                {loc.metadata.productName && <p><strong>Product:</strong> {loc.metadata.productName}</p>}
                                {loc.metadata.quantityAvailable && <p><strong>Available:</strong> {loc.metadata.quantityAvailable} units</p>}
                                {loc.metadata.pricePerUnitPhp && <p><strong>Price/Unit:</strong> {displayBothCurrencies(loc.metadata.pricePerUnitPhp, loc.exchange_rate)}</p>}
                              </div>
                            )}
                            {loc.marker_type === 'Manufacturing' && (
                              <div className="text-xs text-slate-600">
                                {loc.metadata.productType && <p><strong>Product:</strong> {loc.metadata.productType}</p>}
                                {loc.metadata.outputCapacityPerDay && <p><strong>Capacity:</strong> {loc.metadata.outputCapacityPerDay} units/day</p>}
                              </div>
                            )}
                            {loc.marker_type === 'Processing' && (
                              <div className="text-xs text-slate-600">
                                {loc.metadata.processType && <p><strong>Process:</strong> {loc.metadata.processType}</p>}
                                {loc.metadata.capacityKgPerHour && <p><strong>Capacity:</strong> {loc.metadata.capacityKgPerHour} kg/hour</p>}
                              </div>
                            )}
                            {loc.marker_type === 'Landowner' && (
                              <div className="text-xs text-slate-600">
                                {loc.metadata.landSizeSqMeters && <p><strong>Land Size:</strong> {loc.metadata.landSizeSqMeters} sqm</p>}
                                {loc.metadata.zoningType && <p><strong>Zoning:</strong> {loc.metadata.zoningType}</p>}
                                {loc.metadata.availableSpacePercent && <p><strong>Available:</strong> {loc.metadata.availableSpacePercent}%</p>}
                              </div>
                            )}
                            {loc.marker_type === 'Transportation' && (
                              <div className="text-xs text-slate-600">
                                {loc.metadata.vehicleType && <p><strong>Vehicle:</strong> {loc.metadata.vehicleType}</p>}
                                {loc.metadata.capacityTonnage && <p><strong>Capacity:</strong> {loc.metadata.capacityTonnage} tons</p>}
                                {loc.metadata.availableRoutes && <p><strong>Routes:</strong> {loc.metadata.availableRoutes}</p>}
                              </div>
                            )}
                          </div>
                        )}

                        <p className="text-xs text-slate-500 mt-2 border-t pt-2">👤 Added by: <button onClick={() => loc.planning_users && handleShowUserProfile(loc.planning_users)} className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer underline transition-colors">{creatorName}</button></p>
                        {isAuthenticated && userId && loc.planning_users && (
                          <button
                            onClick={() => loadOrCreateConversation(loc.planning_users.user_id, loc.planning_users)}
                            className="mt-2 w-full px-2 py-1 rounded text-xs bg-blue-600 hover:bg-blue-700 text-white transition-colors mb-1"
                            title="Send private message"
                          >
                            Message
                          </button>
                        )}
                        {isAuthenticated && userId === loc.user_id && (
                          <div className="flex gap-1 mt-2">
                            <button
                              onClick={() => {
                                setLocationForm({
                                  name: loc.name,
                                  description: loc.description || '',
                                  latitude: loc.latitude,
                                  longitude: loc.longitude,
                                  marker_type: loc.marker_type,
                                  metadata: loc.metadata || {}
                                })
                                setEditingLocationId(loc.id)
                                setShowLocationForm(true)
                              }}
                              className="flex-1 px-2 py-1 rounded text-xs bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteLocation(loc.id)}
                              className="flex-1 px-2 py-1 rounded text-xs bg-red-600 hover:bg-red-700 text-white transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                )
              })}

              {products.map(product => {
                const productColorMap = {
                  'water': 'water',
                  'coconut': 'coconut',
                  'mango': 'mango'
                }
                const markerColor = productColorMap[product.product_type] || 'red'
                const creatorName = product.planning_users?.name || 'Unknown'

                return (
                  <Marker
                    key={`product-${product.id}`}
                    position={[parseFloat(product.latitude), parseFloat(product.longitude)]}
                    icon={createColoredMarker(markerColor)}
                  >
                    <Popup>
                      <div className="p-3 min-w-64 bg-white rounded">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-bold px-2 py-1 rounded text-white ${
                            product.product_type === 'water' ? 'bg-blue-500' :
                            product.product_type === 'coconut' ? 'bg-amber-700' :
                            'bg-amber-500'
                          }`}>
                            {product.product_type.toUpperCase()}
                          </span>
                        </div>
                        <h3 className="font-bold text-sm mb-1">{product.name}</h3>
                        {product.description && <p className="text-xs text-slate-600 mb-1">{product.description}</p>}

                        <div className="border-t pt-2 mb-2">
                          <p className="text-xs text-slate-600"><strong>Location:</strong> {product.city}, {product.province}</p>
                          <p className="text-xs text-slate-500">{product.latitude.toFixed(4)}, {product.longitude.toFixed(4)}</p>
                        </div>

                        {product.quantity_available && (
                          <div className="border-t pt-2 mb-2">
                            <p className="text-xs text-slate-600"><strong>Available:</strong> {product.quantity_available} {product.quantity_unit || 'units'}</p>
                            {product.harvest_season && <p className="text-xs text-slate-600"><strong>Season:</strong> {product.harvest_season}</p>}
                          </div>
                        )}

                        <p className="text-xs text-slate-500 border-t pt-2">👤 <button onClick={() => product.planning_users && handleShowUserProfile(product.planning_users)} className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer underline transition-colors">{creatorName}</button></p>
                      </div>
                    </Popup>
                  </Marker>
                )
              })}

              {shippingPorts.map(port => {
                const markerColor = port.country_code === 'CN' ? 'blue' : 'red'
                const defaultCargo = portRateCalculator.getDefaultCargo('teu')
                const costBreakdown = portRateCalculator.calculateTotalCost(port, defaultCargo)

                return (
                  <Marker
                    key={`port-${port.id}`}
                    position={[port.latitude, port.longitude]}
                    icon={createColoredMarker(markerColor)}
                  >
                    <Popup>
                      <div className="p-3 min-w-80 max-h-96 overflow-y-auto bg-white rounded">
                        <h3 className="font-bold text-sm mb-1">{port.name}</h3>
                        <p className="text-xs text-slate-600 mb-2">{port.description}</p>

                        <div className="border-t pt-2 mb-2">
                          <p className="text-xs font-semibold text-slate-700">📍 Location</p>
                          <p className="text-xs text-slate-600">{port.city}, {port.province}</p>
                          <p className="text-xs text-slate-500">{port.latitude.toFixed(4)}, {port.longitude.toFixed(4)}</p>
                        </div>

                        <div className="border-t pt-2 mb-2">
                          <p className="text-xs font-semibold text-slate-700">📊 Port Details</p>
                          <p className="text-xs text-slate-600">Type: {port.port_type}</p>
                          <p className="text-xs text-slate-600">Max Depth: {port.max_depth_meters}m</p>
                          <p className="text-xs text-slate-600">Capacity: {port.annual_capacity_teu?.toLocaleString() || 'N/A'} TEU</p>
                        </div>

                        <div className="border-t pt-2 mb-2">
                          <p className="text-xs font-semibold text-slate-700">✈️ Services</p>
                          <div className="text-xs text-slate-600 space-y-1">
                            {port.container_terminal && <p>✓ Container Terminal</p>}
                            {port.ro_ro_services && <p>✓ RoRo Services</p>}
                            {port.breakbulk_services && <p>✓ Breakbulk</p>}
                            {port.bulk_cargo && <p>✓ Bulk Cargo</p>}
                            {port.refrigerated_containers && <p>✓ Refrigerated</p>}
                            {port.dangerous_cargo && <p>✓ Dangerous Cargo</p>}
                          </div>
                        </div>

                        <div className="border-t pt-2">
                          <p className="text-xs font-semibold text-slate-700 mb-2">💰 Rate Calculator</p>

                          <div className="space-y-1 mb-2">
                            <div className="text-xs">
                              <label className="text-slate-600">Cargo Type:</label>
                              <select
                                value={portCalculatorData.type}
                                onChange={(e) => handlePortCalculatorChange('type', e.target.value)}
                                className="w-full px-1 py-1 border border-slate-300 rounded text-xs"
                              >
                                <option value="kg">Weight (kg)</option>
                                <option value="teu">Container (TEU)</option>
                                <option value="cbm">Volume (CBM)</option>
                              </select>
                            </div>

                            <div className="text-xs">
                              <label className="text-slate-600">Quantity:</label>
                              <input
                                type="number"
                                value={portCalculatorData.quantity}
                                onChange={(e) => handlePortCalculatorChange('quantity', parseFloat(e.target.value) || 1)}
                                min="1"
                                step="1"
                                className="w-full px-1 py-1 border border-slate-300 rounded text-xs"
                              />
                            </div>

                            <div className="text-xs">
                              <label className="text-slate-600">Direction:</label>
                              <select
                                value={portCalculatorData.direction}
                                onChange={(e) => handlePortCalculatorChange('direction', e.target.value)}
                                className="w-full px-1 py-1 border border-slate-300 rounded text-xs"
                              >
                                <option value="import">Import</option>
                                <option value="export">Export</option>
                              </select>
                            </div>
                          </div>

                          <div className="bg-slate-100 p-2 rounded text-xs">
                            {(() => {
                              const calc = portRateCalculator.calculateTotalCost(port, portCalculatorData)
                              return (
                                <div className="space-y-1 font-mono text-slate-700">
                                  <p>Handling: ₱{calc.handling_fee.toLocaleString()}</p>
                                  <p>Documentation: ₱{calc.documentation_fee.toLocaleString()}</p>
                                  <p>Port Auth: ₱{calc.port_authority_fee.toLocaleString()}</p>
                                  <p>Security: ₱{calc.security_fee.toLocaleString()}</p>
                                  <p>Customs: ₱{calc.customs_clearance_fee.toLocaleString()}</p>
                                  <p className="border-t pt-1">Surcharge ({calc.surcharge_percentage}%): ₱{calc.surcharge_amount.toLocaleString()}</p>
                                  <p className="font-bold border-t pt-1 text-green-700">TOTAL: ₱{calc.total.toLocaleString()}</p>
                                </div>
                              )
                            })()}
                          </div>

                          {port.contact_phone && (
                            <p className="text-xs text-slate-600 mt-2">📞 {port.contact_phone}</p>
                          )}
                          {port.website && (
                            <p className="text-xs text-blue-600 mt-1">
                              <a href={port.website} target="_blank" rel="noopener noreferrer">
                                {port.website}
                              </a>
                            </p>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )
              })}
            </MapContainer>
          </div>
        </div>

        {/* Chat Section */}
        <div className={`rounded-lg border border-slate-700 bg-slate-800 flex flex-col overflow-hidden ${isMobile ? 'w-full max-h-72' : 'w-96'}`}>
          {/* Chat Tabs */}
          <div className="bg-slate-700 px-4 py-2 border-b border-slate-600 flex gap-2">
            <button
              onClick={() => setChatTab('public')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                chatTab === 'public'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
              }`}
            >
              Public
            </button>
            <button
              onClick={() => setChatTab('private')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                chatTab === 'private'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
              }`}
            >
              Private
            </button>
          </div>

          {/* Public Chat Tab */}
          {chatTab === 'public' && (
            <>
              {/* Online Users Header */}
              <div className="bg-slate-700 px-4 py-3 border-b border-slate-600">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-white text-sm font-medium">{onlineUsers.length} members online</span>
                </div>
              </div>

              {/* Members List */}
              {onlineUsers.length > 0 && (
                <div className="max-h-28 overflow-y-auto border-b border-slate-600 bg-slate-750">
                  <div className="p-3 space-y-2">
                    {onlineUsers.map(user => (
                      <div key={user.id} className="flex items-center gap-2 text-sm justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                          <button
                            onClick={() => handleShowUserProfile(user)}
                            className="text-slate-300 hover:text-blue-400 truncate transition-colors text-left cursor-pointer font-medium"
                            title="View user profile"
                          >
                            {user.name}
                          </button>
                        </div>
                        {isAuthenticated && user.id !== planningUser?.id && (
                          <button
                            onClick={() => loadOrCreateConversation(user.user_id, user)}
                            className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors flex-shrink-0"
                            title="Message this user"
                          >
                            💬
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Private Chat Tab */}
          {chatTab === 'private' && (
            <>
              <div className="bg-slate-700 px-4 py-3 border-b border-slate-600">
                {selectedPrivateUser ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-white text-sm font-medium">Chat with {selectedPrivateUser.name}</span>
                    <button
                      onClick={() => {
                        setSelectedPrivateUserId(null)
                        setSelectedPrivateUser(null)
                        setSelectedConversationId(null)
                        setPrivateMessages([])
                      }}
                      className="ml-auto text-slate-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="text-slate-300 text-sm">Select a user to message</div>
                )}
              </div>
            </>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatTab === 'public' ? (
              messages.length === 0 ? (
                <div className="text-slate-500 text-center py-8 text-sm">
                  No messages yet. Start the discussion!
                </div>
              ) : (
                messages.map(msg => {
                  const userName = msg.planning_users?.name || (msg.planning_users && typeof msg.planning_users === 'object' && msg.planning_users[0]?.name) || 'Unknown'
                  return (
                    <div key={msg.id} className="text-sm">
                      <div className="flex items-baseline gap-2 mb-1">
                        <button onClick={() => msg.planning_users && handleShowUserProfile(msg.planning_users)} className="font-semibold text-blue-400 hover:text-blue-300 cursor-pointer transition-colors">
                          {userName}
                        </button>
                        <span className="text-xs text-slate-500">
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-slate-300 break-words">{msg.message}</p>
                    </div>
                  )
                })
              )
            ) : (
              selectedPrivateUser ? (
                privateMessages.length === 0 ? (
                  <div className="text-slate-500 text-center py-8 text-sm">
                    No messages yet. Start a conversation!
                  </div>
                ) : (
                  privateMessages.map(msg => {
                    const senderName = msg.planning_users?.name || 'Unknown'
                    const isOwnMessage = msg.sender_id === userId
                    return (
                      <div key={msg.id} className="text-sm">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className={`font-semibold ${isOwnMessage ? 'text-green-400' : 'text-blue-400'}`}>
                            {senderName}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className={`break-words ${isOwnMessage ? 'text-slate-200' : 'text-slate-300'}`}>{msg.message}</p>
                      </div>
                    )
                  })
                )
              ) : (
                <div className="text-slate-500 text-center py-8 text-sm">
                  Select a user from the list to start chatting
                </div>
              )
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className={`border-t border-slate-600 bg-slate-750 ${isMobile ? 'p-2' : 'p-4'}`}>
            {chatTab === 'public' ? (
              <div className={`flex ${isMobile ? 'gap-1' : 'gap-2'}`}>
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={isMobile ? 'Message...' : 'Type a message...'}
                  className={`flex-1 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 ${isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
                />
                <button
                  onClick={sendMessage}
                  disabled={!messageInput.trim()}
                  className={`bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded font-medium transition-colors ${isMobile ? 'px-2 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
                >
                  {isMobile ? '→' : 'Send'}
                </button>
              </div>
            ) : selectedPrivateUser ? (
              <div className={`flex ${isMobile ? 'gap-1' : 'gap-2'}`}>
                <input
                  type="text"
                  value={privateMessageInput}
                  onChange={(e) => setPrivateMessageInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendPrivateMessage()}
                  placeholder={isMobile ? 'Message...' : 'Type a message...'}
                  className={`flex-1 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 ${isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
                />
                <button
                  onClick={sendPrivateMessage}
                  disabled={!privateMessageInput.trim()}
                  className={`bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded font-medium transition-colors ${isMobile ? 'px-2 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
                >
                  {isMobile ? '→' : 'Send'}
                </button>
              </div>
            ) : (
              <div className="text-slate-500 text-xs text-center py-2">
                Select a user to message
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Auth Modal Overlay */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className={`w-full bg-slate-800 rounded-lg border border-slate-700 ${isMobile ? 'max-w-sm p-6' : 'max-w-md p-8'}`}>
            <h1 className={`font-bold text-white mb-2 text-center ${isMobile ? 'text-2xl' : 'text-3xl'}`}>Planning Group</h1>
            <p className={`text-slate-400 text-center mb-6 ${isMobile ? 'text-xs' : 'text-sm'}`}>Strategic partner coordination for manufacturing, facilities, and distribution</p>

            <div className="space-y-4">
              {authError && (
                <div className={`p-3 rounded text-sm ${
                  authError.includes('successful')
                    ? 'bg-green-900 text-green-100'
                    : 'bg-red-900 text-red-100'
                }`}>
                  {authError}
                </div>
              )}

              <form onSubmit={authMode === 'login' ? handleSignIn : handleRegister} className="space-y-4">
                {authMode === 'register' && (
                  <input
                    type="text"
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    disabled={authLoading}
                  />
                )}

                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  disabled={authLoading}
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  disabled={authLoading}
                />

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-2 rounded transition-colors"
                >
                  {authLoading ? 'Loading...' : authMode === 'login' ? 'Sign In' : 'Register'}
                </button>
              </form>

              <div className="border-t border-slate-700 pt-4">
                <button
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'register' : 'login')
                    setAuthError('')
                  }}
                  className="w-full text-blue-400 hover:text-blue-300 text-sm"
                >
                  {authMode === 'login' ? 'Need an account? Register' : 'Have an account? Sign In'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location Form Modal */}
      {showLocationForm && isAuthenticated && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-slate-800 rounded-lg p-8 border border-slate-700">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Add Location</h2>

            {authError && (
              <div className="p-3 rounded text-sm bg-red-900 text-red-100 mb-4">
                {authError}
              </div>
            )}

            <form onSubmit={handleSaveLocation} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Marker Type</label>
                <select
                  value={locationForm.marker_type}
                  onChange={(e) => setLocationForm({ ...locationForm, marker_type: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                >
                  <option value="Landowner">{markerTypeEmojis['Landowner']} Landowner</option>
                  <option value="Machinery">{markerTypeEmojis['Machinery']} Machinery</option>
                  <option value="Equipment">{markerTypeEmojis['Equipment']} Equipment</option>
                  <option value="Warehouse">{markerTypeEmojis['Warehouse']} Warehouse</option>
                  <option value="Seller">{markerTypeEmojis['Seller']} Seller</option>
                  <option value="Vendor">{markerTypeEmojis['Vendor']} Vendor</option>
                  <option value="Manufacturing">{markerTypeEmojis['Manufacturing']} Manufacturing</option>
                  <option value="Processing">{markerTypeEmojis['Processing']} Processing</option>
                  <option value="Transportation">{markerTypeEmojis['Transportation']} Transportation</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Location Name</label>
                <input
                  type="text"
                  value={locationForm.name}
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  placeholder="e.g., Manufacturing Facility A"
                  className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Description (Optional)</label>
                <textarea
                  value={locationForm.description}
                  onChange={(e) => setLocationForm({ ...locationForm, description: e.target.value })}
                  placeholder="e.g., Primary production facility"
                  rows="3"
                  className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Dynamic Fields Based on Marker Type */}
              {locationForm.marker_type === 'Equipment' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-slate-300 text-sm font-medium">Equipment List</label>
                    <button
                      type="button"
                      onClick={() => {
                        const equipment = locationForm.metadata?.equipment || []
                        setLocationForm({
                          ...locationForm,
                          metadata: { ...locationForm.metadata, equipment: [...equipment, { name: '', costPhp: 0 }] }
                        })
                      }}
                      className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                    >
                      + Add Equipment
                    </button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto bg-slate-700 bg-opacity-30 rounded p-3">
                    {(locationForm.metadata?.equipment || []).map((item, idx) => (
                      <div key={idx} className="space-y-2 pb-3 border-b border-slate-600 last:border-b-0">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => {
                            const equipment = [...(locationForm.metadata?.equipment || [])]
                            equipment[idx].name = e.target.value
                            setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, equipment } })
                          }}
                          placeholder="Equipment name"
                          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <input
                              type="number"
                              value={item.costPhp}
                              onChange={(e) => {
                                const equipment = [...(locationForm.metadata?.equipment || [])]
                                equipment[idx].costPhp = parseFloat(e.target.value) || 0
                                setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, equipment } })
                              }}
                              placeholder="Cost in PHP"
                              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                              step="0.01"
                            />
                            <div className="text-xs text-slate-400 mt-1">
                              {displayBothCurrencies(item.costPhp, exchangeRate)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const equipment = (locationForm.metadata?.equipment || []).filter((_, i) => i !== idx)
                              setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, equipment } })
                            }}
                            className="text-red-400 hover:text-red-300 text-xs font-medium px-2 py-1"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    {(!locationForm.metadata?.equipment || locationForm.metadata.equipment.length === 0) && (
                      <p className="text-slate-400 text-sm text-center py-2">No equipment added yet</p>
                    )}
                  </div>
                </div>
              )}

              {locationForm.marker_type === 'Machinery' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">Model</label>
                    <input
                      type="text"
                      value={locationForm.metadata?.model || ''}
                      onChange={(e) => setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, model: e.target.value } })}
                      placeholder="e.g., CNC Machine X2000"
                      className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2">Condition</label>
                      <select
                        value={locationForm.metadata?.condition || 'operational'}
                        onChange={(e) => setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, condition: e.target.value } })}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      >
                        <option value="operational">Operational</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="repair">Repair</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2">Quantity</label>
                      <input
                        type="number"
                        value={locationForm.metadata?.quantity || 1}
                        onChange={(e) => setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, quantity: parseInt(e.target.value) || 1 } })}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                        min="1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">Cost Per Unit (PHP)</label>
                    <input
                      type="number"
                      value={locationForm.metadata?.costPerUnit || 0}
                      onChange={(e) => setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, costPerUnit: parseFloat(e.target.value) || 0 } })}
                      placeholder="0.00"
                      className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      step="0.01"
                    />
                    <div className="text-xs text-slate-400 mt-1">
                      {displayBothCurrencies(locationForm.metadata?.costPerUnit || 0, exchangeRate)}
                    </div>
                  </div>
                </div>
              )}

              {locationForm.marker_type === 'Warehouse' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">Capacity (Square Meters)</label>
                    <input
                      type="number"
                      value={locationForm.metadata?.capacitySqMeters || 0}
                      onChange={(e) => setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, capacitySqMeters: parseFloat(e.target.value) || 0 } })}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">Storage Type</label>
                    <input
                      type="text"
                      value={locationForm.metadata?.storageType || ''}
                      onChange={(e) => setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, storageType: e.target.value } })}
                      placeholder="e.g., Climate Controlled, Cold Storage"
                      className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2">Utilization (%)</label>
                      <input
                        type="number"
                        value={locationForm.metadata?.utilizationPercent || 0}
                        onChange={(e) => setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, utilizationPercent: parseInt(e.target.value) || 0 } })}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2">Monthly Cost (PHP)</label>
                      <input
                        type="number"
                        value={locationForm.metadata?.monthlyCostPhp || 0}
                        onChange={(e) => setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, monthlyCostPhp: parseFloat(e.target.value) || 0 } })}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                        step="0.01"
                      />
                      <div className="text-xs text-slate-400 mt-1">
                        {displayBothCurrencies(locationForm.metadata?.monthlyCostPhp || 0, exchangeRate)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(locationForm.marker_type === 'Seller' || locationForm.marker_type === 'Vendor') && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">Product Name</label>
                    <input
                      type="text"
                      value={locationForm.metadata?.productName || ''}
                      onChange={(e) => setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, productName: e.target.value } })}
                      placeholder="e.g., Coconut Oil, Rice"
                      className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2">Quantity Available</label>
                      <input
                        type="number"
                        value={locationForm.metadata?.quantityAvailable || 0}
                        onChange={(e) => setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, quantityAvailable: parseFloat(e.target.value) || 0 } })}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2">Price Per Unit (PHP)</label>
                      <input
                        type="number"
                        value={locationForm.metadata?.pricePerUnitPhp || 0}
                        onChange={(e) => setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, pricePerUnitPhp: parseFloat(e.target.value) || 0 } })}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                        step="0.01"
                      />
                      <div className="text-xs text-slate-400 mt-1">
                        {displayBothCurrencies(locationForm.metadata?.pricePerUnitPhp || 0, exchangeRate)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {locationForm.marker_type === 'Manufacturing' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">Product Type</label>
                    <input
                      type="text"
                      value={locationForm.metadata?.productType || ''}
                      onChange={(e) => setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, productType: e.target.value } })}
                      placeholder="e.g., Textiles, Electronics"
                      className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">Output Capacity (Units/Day)</label>
                    <input
                      type="number"
                      value={locationForm.metadata?.outputCapacityPerDay || 0}
                      onChange={(e) => setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, outputCapacityPerDay: parseFloat(e.target.value) || 0 } })}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      step="0.01"
                    />
                  </div>
                </div>
              )}

              {locationForm.marker_type === 'Processing' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">Process Type</label>
                    <input
                      type="text"
                      value={locationForm.metadata?.processType || ''}
                      onChange={(e) => setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, processType: e.target.value } })}
                      placeholder="e.g., Milling, Packaging, Refining"
                      className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">Capacity (Kg/Hour)</label>
                    <input
                      type="number"
                      value={locationForm.metadata?.capacityKgPerHour || 0}
                      onChange={(e) => setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, capacityKgPerHour: parseFloat(e.target.value) || 0 } })}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      step="0.01"
                    />
                  </div>
                </div>
              )}

              {locationForm.marker_type === 'Landowner' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">Land Size (Square Meters)</label>
                    <input
                      type="number"
                      value={locationForm.metadata?.landSizeSqMeters || 0}
                      onChange={(e) => setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, landSizeSqMeters: parseFloat(e.target.value) || 0 } })}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">Zoning Type</label>
                    <input
                      type="text"
                      value={locationForm.metadata?.zoningType || ''}
                      onChange={(e) => setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, zoningType: e.target.value } })}
                      placeholder="e.g., Commercial, Industrial, Residential"
                      className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">Available Space (%)</label>
                    <input
                      type="number"
                      value={locationForm.metadata?.availableSpacePercent || 100}
                      onChange={(e) => setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, availableSpacePercent: parseInt(e.target.value) || 100 } })}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              )}

              {locationForm.marker_type === 'Transportation' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">Vehicle Type</label>
                    <input
                      type="text"
                      value={locationForm.metadata?.vehicleType || ''}
                      onChange={(e) => setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, vehicleType: e.target.value } })}
                      placeholder="e.g., Truck, Van, Ship"
                      className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2">Capacity (Tonnage)</label>
                      <input
                        type="number"
                        value={locationForm.metadata?.capacityTonnage || 0}
                        onChange={(e) => setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, capacityTonnage: parseFloat(e.target.value) || 0 } })}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2">Available Routes</label>
                      <input
                        type="text"
                        value={locationForm.metadata?.availableRoutes || ''}
                        onChange={(e) => setLocationForm({ ...locationForm, metadata: { ...locationForm.metadata, availableRoutes: e.target.value } })}
                        placeholder="e.g., Manila-Cebu, Inter-island"
                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">Latitude</label>
                  <input
                    type="number"
                    value={locationForm.latitude}
                    disabled
                    className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-slate-400 cursor-not-allowed"
                    step="0.00001"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">Longitude</label>
                  <input
                    type="number"
                    value={locationForm.longitude}
                    disabled
                    className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-slate-400 cursor-not-allowed"
                    step="0.00001"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowLocationForm(false)
                    setIsCreatingLocation(false)
                    setEditingLocationId(null)
                    setLocationForm({
                      name: '',
                      description: '',
                      latitude: null,
                      longitude: null,
                      marker_type: 'Seller',
                      metadata: {}
                    })
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
                >
                  Save Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile Settings Modal */}
      {showProfileSettings && isAuthenticated && planningUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-slate-800 rounded-lg p-8 border border-slate-700">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Profile Settings</h2>

            {authError && (
              <div className="p-3 rounded text-sm bg-red-900 text-red-100 mb-4">
                {authError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Display Name</label>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  placeholder="Your display name"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={userEmail}
                  disabled
                  className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Role</label>
                <input
                  type="text"
                  value={planningUser.role || 'member'}
                  disabled
                  className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-slate-400 cursor-not-allowed capitalize"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowProfileSettings(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={!editingName.trim() || editingName === planningUser.name}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded font-medium transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Preview Modal */}
      {showUserProfile && selectedUserForProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">User Profile</h2>
              <button
                onClick={() => setShowUserProfile(false)}
                className="text-slate-400 hover:text-white text-2xl transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Name</label>
                <p className="text-white text-lg font-semibold">{selectedUserForProfile.name}</p>
              </div>

              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Email</label>
                <p className="text-slate-300 break-all">{selectedUserForProfile.email}</p>
              </div>

              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">User ID</label>
                <div className="bg-slate-700 rounded px-3 py-2 flex items-center justify-between gap-2">
                  <code className="text-slate-300 text-xs font-mono break-all">{selectedUserForProfile.user_id}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedUserForProfile.user_id)
                    }}
                    className="text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors flex-shrink-0"
                    title="Copy to clipboard"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Status</label>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-slate-300 capitalize">{selectedUserForProfile.status || 'active'}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Role</label>
                <p className="text-slate-300 capitalize">{selectedUserForProfile.role || 'member'}</p>
              </div>
            </div>

            <div className="flex gap-3">
              {isAuthenticated && userId && selectedUserForProfile.user_id === userId ? (
                <button
                  onClick={() => setShowUserProfile(false)}
                  className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition-colors"
                >
                  Close
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setShowUserProfile(false)}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleStartConversationFromProfile}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
                  >
                    Message
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
