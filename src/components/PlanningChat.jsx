import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { portRateCalculator } from '../lib/portRateCalculatorService'
import { PHILIPPINE_CITIES } from '../data/philippineCitiesCoordinates'
import { useDevice } from '../context/DeviceContext'
import { phpToUsd, displayBothCurrencies, formatCurrency, DEFAULT_EXCHANGE_RATE, fetchExchangeRate } from '../lib/currencyUtils'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, Circle, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import Auth from './Auth'

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

  const [userId, setUserId] = useState(null)
  const [userEmail, setUserEmail] = useState('')
  const [authError, setAuthError] = useState('')
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
  const [selectedJumpLocation, setSelectedJumpLocation] = useState('')
  const [showMarkerTypeModal, setShowMarkerTypeModal] = useState(false)
  const [pendingMarkerType, setPendingMarkerType] = useState(null)
  const [selectedExistingLocationId, setSelectedExistingLocationId] = useState('')
  const [showAuthModalOnDemand, setShowAuthModalOnDemand] = useState(false)
  const [contributionForm, setContributionForm] = useState({
    partnerType: '',
    businessName: '',
    email: '',
    contributions: [],
    monthlyCapacity: '',
    capacityUnit: 'tons',
    location: '',
    pricePerUnit: '',
    currency: 'php',
    notes: ''
  })
  const [contributionSubmitting, setContributionSubmitting] = useState(false)

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
        await loadPlanningUser(data.user.id, data.user)
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

  const loadPlanningUser = async (uid, user = null) => {
    try {
      const { data, error } = await supabase
        .from('planning_users')
        .select('*')
        .eq('user_id', uid)
        .single()

      if (error) {
        // No planning_user record exists yet - create one
        const displayName = user?.user_metadata?.full_name || userEmail.split('@')[0]
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

  const handleAuthSuccess = (user) => {
    setUserId(user.id)
    setUserEmail(user.email || '')
    setIsAuthenticated(true)
    setShowAuthModalOnDemand(false)
    loadPlanningUser(user.id, user)
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

  const handleContributionChange = (e) => {
    const { name, value, type, checked } = e.target

    if (name === 'contributions') {
      // Handle checkbox for contributions
      setContributionForm(prev => ({
        ...prev,
        contributions: checked
          ? [...prev.contributions, value]
          : prev.contributions.filter(c => c !== value)
      }))
    } else {
      setContributionForm(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  const handleContributionSubmit = async (e) => {
    e.preventDefault()

    if (!isAuthenticated || !userId) {
      setShowAuthModalOnDemand(true)
      return
    }

    if (!contributionForm.partnerType || !contributionForm.email || contributionForm.contributions.length === 0) {
      alert('Please fill in all required fields (Partner Type, Email, and at least one contribution type)')
      return
    }

    setContributionSubmitting(true)

    try {
      const { error } = await supabase
        .from('contributions')
        .insert([{
          user_id: userId,
          partner_type: contributionForm.partnerType,
          business_name: contributionForm.businessName,
          email: contributionForm.email,
          contribution_types: contributionForm.contributions,
          monthly_capacity: contributionForm.monthlyCapacity ? parseFloat(contributionForm.monthlyCapacity) : null,
          capacity_unit: contributionForm.capacityUnit,
          location: contributionForm.location,
          price_per_unit: contributionForm.pricePerUnit ? parseFloat(contributionForm.pricePerUnit) : null,
          currency: contributionForm.currency,
          notes: contributionForm.notes,
          status: 'pending'
        }])

      if (error) throw error

      // Success - reset form and show message
      alert('✅ Thank you! Your contribution has been submitted. We\'ll review it and reach out soon.')
      setContributionForm({
        partnerType: '',
        businessName: '',
        email: userEmail,
        contributions: [],
        monthlyCapacity: '',
        capacityUnit: 'tons',
        location: '',
        pricePerUnit: '',
        currency: 'php',
        notes: ''
      })
    } catch (err) {
      console.error('Contribution submission error:', err)
      alert(`Failed to submit contribution: ${err.message}`)
    } finally {
      setContributionSubmitting(false)
    }
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
    setPendingMarkerType(type)
    setShowMarkerTypeModal(true)
  }

  const handleAddToExistingLocation = () => {
    if (!selectedExistingLocationId) {
      setAuthError('Please select a location')
      return
    }
    const existingLocation = locations.find(loc => loc.id === selectedExistingLocationId)
    if (existingLocation) {
      setSelectedMarkerType(pendingMarkerType)
      setLocationForm({
        name: existingLocation.name,
        description: existingLocation.description || '',
        latitude: existingLocation.latitude,
        longitude: existingLocation.longitude,
        marker_type: pendingMarkerType,
        metadata: existingLocation.metadata || {}
      })
      setEditingLocationId(existingLocation.id)
      setShowLocationForm(true)
      setShowMarkerTypeModal(false)
      setSelectedExistingLocationId('')
      setPendingMarkerType(null)
    }
  }

  const handleCreateNewMarker = () => {
    setSelectedMarkerType(pendingMarkerType)
    setIsCreatingLocation(true)
    setShowMarkerTypeModal(false)
    setSelectedExistingLocationId('')
    setPendingMarkerType(null)
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

  const handleJumpToLocation = (e) => {
    const value = e.target.value
    setSelectedJumpLocation(value)

    if (!value || !mapRef.current) return

    const [type, id] = value.split(':')

    if (type === 'location') {
      const location = locations.find(loc => loc.id === id)
      if (location) {
        try {
          mapRef.current.flyTo([location.latitude, location.longitude], 13, { duration: 1 })
        } catch (error) {
          console.error('Error flying to location:', error)
        }
      }
    } else if (type === 'city') {
      const city = PHILIPPINE_CITIES.find(c => c.name === id)
      if (city) {
        try {
          mapRef.current.flyTo([city.lat, city.lng], 11, { duration: 1 })
        } catch (error) {
          console.error('Error flying to city:', error)
        }
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

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className={`bg-slate-800 border-b border-slate-700 ${isMobile ? 'px-4 py-2 mt-4' : 'px-6 py-3 mt-6'}}`}>
        <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between mb-3'}`}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className={`font-bold text-white ${isMobile ? 'text-lg' : 'text-2xl'}`}>🥥 Coconuts.com.ph</h1>
              <span className="inline-block px-2 py-1 bg-amber-700 text-amber-100 text-xs font-semibold rounded">Partnership Network</span>
            </div>
            <p className={`text-slate-400 ${isMobile ? 'text-xs' : 'text-sm'}`}>Transparent supply chain coordination & collaborative commerce with currency.ph integration</p>
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

      <div className={`flex-1 flex ${isMobile ? 'flex-col gap-3' : 'gap-4'} ${isMobile ? 'p-3' : 'p-6'} overflow-hidden`}>
        {/* Preview Mode Notice */}
        {!isAuthenticated && (
          <div className="bg-blue-900/50 border border-blue-600 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-blue-100 font-semibold flex items-center gap-2 mb-1">
                <span>🔍 Preview Mode</span>
              </p>
              <p className="text-blue-100 text-sm">You can view the map, ports, and products. <strong>Sign in to add locations, send messages, and manage your supply chain.</strong></p>
            </div>
            <button
              onClick={() => setShowAuthModalOnDemand(true)}
              className="ml-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
            >
              Sign In Now
            </button>
          </div>
        )}

        {/* Map Section */}
        <div className={`rounded-lg overflow-hidden border border-slate-700 bg-slate-800 flex flex-col ${isMobile ? 'flex-1 min-h-[calc(100vh-400px)]' : 'flex-1'}`} style={showLocationForm ? { pointerEvents: 'none' } : {}}>
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
              /* Ensure modals stay on top of map elements */
              .leaflet-popup {
                z-index: 1000 !important;
              }
              .leaflet-tooltip {
                z-index: 1000 !important;
              }
              .leaflet-shadow-pane {
                z-index: 200 !important;
              }
              .leaflet-pane {
                z-index: 1 !important;
              }
            `}</style>

            {/* Marker Type Selector Panel with Collapse/Expand */}
            {isAuthenticated && (
              <div className="marker-type-selector">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex-1">
                    {(showMarkerTypeSelector || !isMobile) && (
                      <span className="marker-type-label">Select Type</span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowMarkerTypeSelector(!showMarkerTypeSelector)}
                    className="text-slate-300 hover:text-white transition-colors text-lg font-medium flex-shrink-0"
                    title={showMarkerTypeSelector ? 'Collapse' : 'Expand'}
                  >
                    {showMarkerTypeSelector ? '▼' : '▶'}
                  </button>
                </div>
                {showMarkerTypeSelector && (
                  <>
                    <div className="marker-type-grid mb-3">
                      {markerTypes.map(type => (
                        <button
                          key={type}
                          onClick={() => handleSelectMarkerType(type)}
                          className={`marker-type-btn ${selectedMarkerType === type ? 'active' : ''}`}
                          title={`${markerTypeEmojis[type]} ${type}`}
                        >
                          <span style={{ fontSize: '16px', minWidth: '20px' }}>{markerTypeEmojis[type]}</span>
                          <span style={{ flex: 1, textAlign: 'left' }}>{type}</span>
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-slate-700 pt-3">
                      <label htmlFor="jump-location-select" className="marker-type-label mb-2 block text-xs">Jump to Location</label>
                      <select
                        id="jump-location-select"
                        value={selectedJumpLocation}
                        onChange={handleJumpToLocation}
                        className={`w-full rounded bg-slate-600 text-white border border-slate-500 hover:bg-slate-500 transition-colors cursor-pointer focus:outline-none focus:border-blue-400 px-2 py-1.5 text-xs`}
                      >
                        <option value="">Select location or city...</option>
                        {locations.length > 0 && (
                          <>
                            <optgroup label="📍 Locations">
                              {locations.map(loc => (
                                <option key={`loc-${loc.id}`} value={`location:${loc.id}`}>
                                  {markerTypeEmojis[loc.marker_type] || '📍'} {loc.name}
                                </option>
                              ))}
                            </optgroup>
                          </>
                        )}
                        <optgroup label="🏙️ Cities">
                          {PHILIPPINE_CITIES.map((city, idx) => (
                            <option key={`city-${idx}`} value={`city:${city.name}`}>
                              {city.name} ({city.region})
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  </>
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

        {/* Contributions Section - Public Interface */}
        <div className={`rounded-lg border border-slate-700 bg-slate-900 flex flex-col overflow-hidden ${isMobile ? 'w-full' : 'flex-1 min-h-96'}`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-800 to-orange-700 px-6 py-4 border-b border-amber-700">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
              🤝 Join Our Partnership Network
            </h2>
            <p className="text-amber-100 text-sm">Share your capabilities, connect with partners, and strengthen our coconut supply chain</p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Info Box */}
            <div className="mb-6 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
              <p className="text-blue-100 text-sm">
                <strong>All contributions welcome:</strong> Whether you're an individual farmer, small business, corporation, or established retailer, your input helps build a transparent, collaborative coconut ecosystem.
              </p>
            </div>

            {/* Contribution Form */}
            <form className="space-y-4" onSubmit={handleContributionSubmit}>
              {/* Partner Type Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">I am a... *</label>
                <select
                  name="partnerType"
                  value={contributionForm.partnerType}
                  onChange={handleContributionChange}
                  className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50 text-sm"
                >
                  <option value="">-- Select Your Type --</option>
                  <optgroup label="Agricultural">
                    <option value="farmer">🚜 Farmer / Landowner</option>
                    <option value="processor">⚙️ Processor / Manufacturer</option>
                    <option value="trader">🏪 Trader / Wholesaler</option>
                  </optgroup>
                  <optgroup label="Business">
                    <option value="retailer">🏬 Retailer / Shop Owner</option>
                    <option value="exporter">✈️ Exporter / Distributor</option>
                    <option value="logistics">🚚 Logistics / Transport</option>
                  </optgroup>
                  <optgroup label="Corporate">
                    <option value="corporation">🏢 Corporation / Large Enterprise</option>
                    <option value="investor">💰 Investor / Financial Partner</option>
                  </optgroup>
                  <optgroup label="Support Services">
                    <option value="equipment">🔧 Equipment / Machinery Provider</option>
                    <option value="warehouse">🏭 Warehouse / Storage Owner</option>
                    <option value="service">💼 Other Services</option>
                  </optgroup>
                </select>
              </div>

              {/* Business Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">Business / Organization Name</label>
                <input
                  type="text"
                  name="businessName"
                  value={contributionForm.businessName}
                  onChange={handleContributionChange}
                  placeholder="Your business or organization name (optional if individual)"
                  className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50 text-sm"
                />
              </div>

              {/* Contact Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={contributionForm.email}
                  onChange={handleContributionChange}
                  placeholder="your.email@example.com"
                  className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50 text-sm"
                  required
                />
              </div>

              {/* What Can You Contribute */}
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">What Can You Contribute? *</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer text-slate-300 hover:text-white transition-colors">
                    <input type="checkbox" name="contributions" value="coconuts" onChange={handleContributionChange} checked={contributionForm.contributions.includes('coconuts')} className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-amber-600" />
                    <span className="text-sm">🥥 Coconuts / Harvest</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer text-slate-300 hover:text-white transition-colors">
                    <input type="checkbox" name="contributions" value="equipment" onChange={handleContributionChange} checked={contributionForm.contributions.includes('equipment')} className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-amber-600" />
                    <span className="text-sm">⚙️ Equipment / Machinery</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer text-slate-300 hover:text-white transition-colors">
                    <input type="checkbox" name="contributions" value="processing" onChange={handleContributionChange} checked={contributionForm.contributions.includes('processing')} className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-amber-600" />
                    <span className="text-sm">🏭 Processing / Manufacturing Services</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer text-slate-300 hover:text-white transition-colors">
                    <input type="checkbox" name="contributions" value="transportation" onChange={handleContributionChange} checked={contributionForm.contributions.includes('transportation')} className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-amber-600" />
                    <span className="text-sm">🚚 Transportation / Logistics</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer text-slate-300 hover:text-white transition-colors">
                    <input type="checkbox" name="contributions" value="distribution" onChange={handleContributionChange} checked={contributionForm.contributions.includes('distribution')} className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-amber-600" />
                    <span className="text-sm">🏪 Distribution / Retail Channel</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer text-slate-300 hover:text-white transition-colors">
                    <input type="checkbox" name="contributions" value="warehouse" onChange={handleContributionChange} checked={contributionForm.contributions.includes('warehouse')} className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-amber-600" />
                    <span className="text-sm">📍 Warehouse / Storage Space</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer text-slate-300 hover:text-white transition-colors">
                    <input type="checkbox" name="contributions" value="consulting" onChange={handleContributionChange} checked={contributionForm.contributions.includes('consulting')} className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-amber-600" />
                    <span className="text-sm">💼 Expertise / Consulting</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer text-slate-300 hover:text-white transition-colors">
                    <input type="checkbox" name="contributions" value="financial" onChange={handleContributionChange} checked={contributionForm.contributions.includes('financial')} className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-amber-600" />
                    <span className="text-sm">💰 Financial / Investment</span>
                  </label>
                </div>
              </div>

              {/* Capacity / Volume */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-2">Monthly Capacity / Volume</label>
                  <input
                    type="number"
                    name="monthlyCapacity"
                    value={contributionForm.monthlyCapacity}
                    onChange={handleContributionChange}
                    placeholder="Quantity"
                    className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-2">Unit</label>
                  <select name="capacityUnit" value={contributionForm.capacityUnit} onChange={handleContributionChange} className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50 text-sm">
                    <option value="tons">Tons</option>
                    <option value="kg">KG</option>
                    <option value="liters">Liters</option>
                    <option value="pieces">Pieces</option>
                    <option value="units">Units</option>
                    <option value="hours">Hours</option>
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">Location / Service Area</label>
                <input
                  type="text"
                  name="location"
                  value={contributionForm.location}
                  onChange={handleContributionChange}
                  placeholder="City, Province or service area"
                  className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50 text-sm"
                />
              </div>

              {/* Price / Cost (optional) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-2">Price Per Unit (Optional)</label>
                  <input
                    type="number"
                    name="pricePerUnit"
                    value={contributionForm.pricePerUnit}
                    onChange={handleContributionChange}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-2">Currency</label>
                  <select name="currency" value={contributionForm.currency} onChange={handleContributionChange} className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50 text-sm">
                    <option value="php">PHP</option>
                    <option value="usd">USD</option>
                  </select>
                </div>
              </div>

              {/* Additional Notes */}
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">Tell Us More (Optional)</label>
                <textarea
                  name="notes"
                  value={contributionForm.notes}
                  onChange={handleContributionChange}
                  placeholder="Share details about your business, capacity, experience, or partnership interests. This helps us connect you with the right partners."
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50 text-sm resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAuthModalOnDemand(true)}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold rounded-lg transition-all transform hover:scale-105 text-sm"
                >
                  ✓ Sign & Submit
                </button>
                <button
                  type="reset"
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white font-semibold rounded-lg transition-colors text-sm"
                >
                  Clear
                </button>
              </div>

              {/* Info Text */}
              <p className="text-xs text-slate-400 text-center mt-4">
                💡 Sign in or create an account to submit your contribution. All information helps strengthen our supply chain network.
              </p>
            </form>
          </div>
        </div>

        {/* Chat Section */}
        <div className={`rounded-lg border border-slate-700 bg-slate-800 flex flex-col overflow-hidden ${isMobile ? 'w-full max-h-72' : 'w-72'}`}>
          {/* Auth Required Notice */}
          {!isAuthenticated && (
            <div className="bg-amber-700/30 border-b border-amber-700 px-4 py-3">
              <p className="text-amber-100 text-xs font-semibold mb-2">🔐 Community Features Locked</p>
              <p className="text-amber-50 text-xs mb-3">Sign in to access:</p>
              <ul className="text-amber-50 text-xs space-y-1 ml-2">
                <li>✓ Public & private messaging</li>
                <li>✓ View online community members</li>
                <li>✓ Real-time collaboration</li>
              </ul>
              <button
                onClick={() => setShowAuthModalOnDemand(true)}
                className="w-full mt-3 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded transition-colors"
              >
                Unlock Community Features
              </button>
            </div>
          )}

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

      {/* Auth Modal - On-Demand */}
      {showAuthModalOnDemand && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-md">
            <button
              onClick={() => setShowAuthModalOnDemand(false)}
              className="absolute -top-10 -right-10 text-slate-300 hover:text-white text-2xl font-bold transition-colors z-10"
              aria-label="Close modal"
            >
              ✕
            </button>
            <Auth onAuthSuccess={handleAuthSuccess} isModal={true} />
          </div>
        </div>
      )}

      {/* Location Form Modal */}
      {showLocationForm && isAuthenticated && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
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

      {/* Marker Type Modal - Choose between Add to Existing or Create New */}
      {showMarkerTypeModal && pendingMarkerType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Add {pendingMarkerType}</h2>
              <button
                onClick={() => {
                  setShowMarkerTypeModal(false)
                  setPendingMarkerType(null)
                  setSelectedExistingLocationId('')
                }}
                className="text-slate-400 hover:text-white text-2xl transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Choose an option:</label>
              </div>

              <div className="space-y-3">
                {locations.length > 0 && (
                  <div>
                    <label htmlFor="existing-location-select" className="block text-slate-400 text-sm font-medium mb-2">Add to Existing Location</label>
                    <select
                      id="existing-location-select"
                      value={selectedExistingLocationId}
                      onChange={(e) => setSelectedExistingLocationId(e.target.value)}
                      className="w-full rounded bg-slate-700 text-white border border-slate-600 hover:border-slate-500 transition-colors cursor-pointer focus:outline-none focus:border-blue-400 px-3 py-2 text-sm"
                    >
                      <option value="">Select a location...</option>
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>
                          {markerTypeEmojis[loc.marker_type] || '📍'} {loc.name} ({loc.marker_type})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddToExistingLocation}
                      className="w-full mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
                    >
                      Add to Selected Location
                    </button>
                  </div>
                )}

                <div className="border-t border-slate-700 pt-4">
                  <p className="text-slate-400 text-sm font-medium mb-3">{locations.length > 0 ? 'Or c' : 'C'}reate a New Marker</p>
                  <button
                    onClick={handleCreateNewMarker}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
                  >
                    Create New Marker
                  </button>
                </div>
              </div>
            </div>

            {authError && (
              <div className="bg-red-900 border border-red-700 text-red-200 px-3 py-2 rounded text-sm mb-4">
                {authError}
              </div>
            )}
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

      {/* Coconuts.com.ph Promotional Sections */}
      <div className="mt-24 border-t-8 border-amber-600">
        {/* Market Opportunity */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <div className="inline-block mb-4 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
                🥥 COCONUTS.COM.PH
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Global Coconut Enterprise. Massive Market Opportunity.
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-12 mb-12">
              <div className="bg-white rounded-xl p-10 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                  <span className="text-3xl">📊</span>
                  Market Size & Growth
                </h3>
                <div className="space-y-6">
                  <div className="border-b border-gray-200 pb-6">
                    <p className="text-gray-600 font-medium mb-2">Global Coconut Water Market</p>
                    <p className="text-3xl font-bold text-amber-600">$3.2B</p>
                    <p className="text-gray-600 text-sm mt-2">CAGR: 12.3% through 2030</p>
                  </div>
                  <div className="border-b border-gray-200 pb-6">
                    <p className="text-gray-600 font-medium mb-2">Virgin Coconut Oil Market</p>
                    <p className="text-3xl font-bold text-amber-600">$2.8B</p>
                    <p className="text-gray-600 text-sm mt-2">CAGR: 14.1% through 2030</p>
                  </div>
                  <div className="border-b border-gray-200 pb-6">
                    <p className="text-gray-600 font-medium mb-2">Natural Cosmetics Market</p>
                    <p className="text-3xl font-bold text-amber-600">$18.7B</p>
                    <p className="text-gray-600 text-sm mt-2">CAGR: 9.8% (coconut segment growing faster)</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium mb-2">Functional Foods & Superfoods</p>
                    <p className="text-3xl font-bold text-amber-600">$24.3B</p>
                    <p className="text-gray-600 text-sm mt-2">Coconut products = fastest growing category</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-10 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                  <span className="text-3xl">🎯</span>
                  Strategic Advantages
                </h3>
                <div className="space-y-4">
                  {[
                    { title: 'Geographic Advantage', desc: 'Philippines = #1 coconut producer (40% global share)' },
                    { title: 'Cost Efficiency', desc: 'Labor costs 70% lower than competitors; land availability' },
                    { title: 'Quality Control', desc: 'Direct source control eliminates middleman contamination' },
                    { title: 'Market Timing', desc: 'Explosive growth in health/wellness, vegan, clean beauty trends' },
                    { title: 'Sustainability Focus', desc: 'Premium positioning for eco-conscious consumers' },
                    { title: 'Vertical Integration', desc: 'Control entire supply chain = margin protection' }
                  ].map((item, i) => (
                    <div key={i} className="p-4 bg-gradient-to-r from-amber-50 to-white rounded-lg border border-amber-200">
                      <p className="font-semibold text-gray-900">{item.title}</p>
                      <p className="text-gray-600 text-sm mt-1">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl p-12">
              <h3 className="text-3xl font-bold mb-6">Products & Economics</h3>
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white/10 p-6 rounded-lg">
                  <p className="text-amber-100 font-semibold mb-3">💧 Coconut Water</p>
                  <p className="text-amber-50 text-sm mb-3">45-60% retail margins. Global market $3.2B growing 12.3% annually.</p>
                  <p className="font-bold text-amber-100">Cold-pressed, pasteurized</p>
                </div>
                <div className="bg-white/10 p-6 rounded-lg">
                  <p className="text-amber-100 font-semibold mb-3">🫒 Virgin Coconut Oil</p>
                  <p className="text-amber-50 text-sm mb-3">55-70% retail margins. Market $2.8B growing 14.1% annually.</p>
                  <p className="font-bold text-amber-100">Cold-pressed, organic certified</p>
                </div>
                <div className="bg-white/10 p-6 rounded-lg">
                  <p className="text-amber-100 font-semibold mb-3">✨ Coconut Skincare</p>
                  <p className="text-amber-50 text-sm mb-3">65-75% retail margins. Part of $18.7B natural cosmetics market.</p>
                  <p className="font-bold text-amber-100">100% natural, dermatologist tested</p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-8 text-center">
                <div>
                  <p className="text-amber-100 font-semibold mb-2">Year 5 Revenue Projection</p>
                  <p className="text-4xl font-bold">$142.7M</p>
                  <p className="text-amber-50 text-sm mt-2">From 38.5M units annually</p>
                </div>
                <div>
                  <p className="text-amber-100 font-semibold mb-2">Gross Profit Margin</p>
                  <p className="text-4xl font-bold">51.8%</p>
                  <p className="text-amber-50 text-sm mt-2">EBITDA margin by year 5</p>
                </div>
                <div>
                  <p className="text-amber-100 font-semibold mb-2">5-Year Total ROI</p>
                  <p className="text-4xl font-bold">350%</p>
                  <p className="text-amber-50 text-sm mt-2">On $9.08M initial investment</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Currency.ph Integration & Transparent Finance */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-green-50 to-blue-50">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <div className="inline-block mb-4 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                💳 CURRENCY.PH PARTNERSHIP
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Transparent Finance for Transparent Commerce
              </h2>
              <p className="text-xl text-gray-700 max-w-3xl">
                Coconuts.com.ph leverages currency.ph's blockchain-powered infrastructure to enable real-time, transparent transactions across all stakeholders.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-12 mb-12">
              <div className="bg-white rounded-xl p-10 border border-green-200 shadow-lg">
                <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                  <span className="text-3xl">🔗</span>
                  Multi-Currency Wallet Integration
                </h3>
                <div className="space-y-6">
                  <div className="border-b border-gray-200 pb-6">
                    <p className="text-gray-700 font-semibold mb-3">Supported Currencies</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-green-50 rounded"><span className="text-2xl">🇵🇭</span> PHP</div>
                      <div className="p-3 bg-blue-50 rounded"><span className="text-2xl">🇺🇸</span> USD</div>
                      <div className="p-3 bg-yellow-50 rounded"><span className="text-2xl">₿</span> BTC</div>
                      <div className="p-3 bg-purple-50 rounded"><span className="text-2xl">⟠</span> ETH</div>
                      <div className="p-3 bg-gray-50 rounded"><span className="text-2xl">€</span> EUR</div>
                      <div className="p-3 bg-pink-50 rounded"><span className="text-2xl">💴</span> JPY</div>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-700 font-semibold mb-2">Instant Settlement</p>
                    <p className="text-gray-600 text-sm">24-48 hour farmer payments. Secure multi-signature wallets for funds security.</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-10 border border-blue-200 shadow-lg">
                <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                  <span className="text-3xl">📊</span>
                  Real-Time Transparency Dashboard
                </h3>
                <div className="space-y-4">
                  {[
                    { feature: 'Live Supply Chain', desc: 'Track every coconut from farm to retail via blockchain' },
                    { feature: 'Production Metrics', desc: 'Real-time volume, quality, and inventory updates' },
                    { feature: 'Revenue Allocation', desc: 'Auto-calculated profit sharing visible to all stakeholders' },
                    { feature: 'Payment History', desc: 'Complete transaction records for audit and compliance' },
                    { feature: 'Impact Metrics', desc: 'Community jobs, farmer income, sustainability impact tracked' }
                  ].map((item, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-green-600 font-bold mt-1">✓</span>
                      <div>
                        <p className="font-semibold text-gray-900">{item.feature}</p>
                        <p className="text-gray-600 text-sm">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mb-12">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-8">
                <h3 className="text-xl font-bold mb-4">🌐 Global Payments</h3>
                <ul className="space-y-3 text-sm">
                  <li className="flex gap-2"><span>✓</span><span>Instant cross-border transfers</span></li>
                  <li className="flex gap-2"><span>✓</span><span>Competitive FX rates</span></li>
                  <li className="flex gap-2"><span>✓</span><span>No middleman delays</span></li>
                  <li className="flex gap-2"><span>✓</span><span>API integration for B2B</span></li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-8">
                <h3 className="text-xl font-bold mb-4">🔐 Security & Compliance</h3>
                <ul className="space-y-3 text-sm">
                  <li className="flex gap-2"><span>✓</span><span>Bank-grade encryption</span></li>
                  <li className="flex gap-2"><span>✓</span><span>Philippines BIR approved</span></li>
                  <li className="flex gap-2"><span>✓</span><span>Multi-sig wallet protection</span></li>
                  <li className="flex gap-2"><span>✓</span><span>Quarterly audit verification</span></li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-8">
                <h3 className="text-xl font-bold mb-4">📈 For All Stakeholders</h3>
                <ul className="space-y-3 text-sm">
                  <li className="flex gap-2"><span>✓</span><span>Farmers: Instant payments</span></li>
                  <li className="flex gap-2"><span>✓</span><span>Investors: Real-time ROI</span></li>
                  <li className="flex gap-2"><span>✓</span><span>Partners: API access</span></li>
                  <li className="flex gap-2"><span>✓</span><span>Consumers: Trust & traceability</span></li>
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-xl p-10 border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-8">🤝 Governance & Transparent Processes</h3>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <p className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">🗳️</span>
                    Democratic Decision Making
                  </p>
                  <ul className="space-y-3 text-gray-700">
                    <li className="flex gap-3">
                      <span className="text-green-600 font-bold">1</span>
                      <div>
                        <p className="font-semibold">Quarterly Stakeholder Council</p>
                        <p className="text-sm text-gray-600">All equity holders vote proportional to stake</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-green-600 font-bold">2</span>
                      <div>
                        <p className="font-semibold">Public Vote Recording</p>
                        <p className="text-sm text-gray-600">All votes recorded on blockchain, published within 48hrs</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-green-600 font-bold">3</span>
                      <div>
                        <p className="font-semibold">Farmer Veto Rights</p>
                        <p className="text-sm text-gray-600">Farmer collective can veto pricing or supply changes</p>
                      </div>
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">📋</span>
                    Reporting Standards
                  </p>
                  <div className="space-y-3">
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="font-semibold text-gray-900 text-sm">Monthly Operations Report</p>
                      <p className="text-xs text-gray-600 mt-1">Production, costs, inventory, shipments (on currency.ph)</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="font-semibold text-gray-900 text-sm">Quarterly Financial Statement</p>
                      <p className="text-xs text-gray-600 mt-1">Revenue, EBITDA, profit distribution, audited</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="font-semibold text-gray-900 text-sm">Annual Impact Audit</p>
                      <p className="text-xs text-gray-600 mt-1">3rd-party verification of social & environmental metrics</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Partnership Ecosystem */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <div className="inline-block mb-4 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
                PARTNERSHIP NETWORK
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                A Growing Collaborative Community
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl">
                We're building a transparent ecosystem where farmers, manufacturers, distributors, and impact investors all participate in governance and share proportional returns.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  title: '🌾 Coconut Farmers & Landowners',
                  description: 'Supply the foundation of our operation',
                  benefits: [
                    'Guaranteed purchase agreements (12-24 months)',
                    'Fair-market pricing + 5% sustainability premium',
                    'Direct currency.ph payment access',
                    'Profit sharing above baseline (2-5%)',
                    'Weather insurance & crop protection'
                  ],
                  role: '35% of equity'
                },
                {
                  title: '🏭 Equipment & Machinery Providers',
                  description: 'Enable processing at scale',
                  benefits: [
                    'Long-term equipment leasing',
                    'Maintenance contracts with margins',
                    'Equity stake (5-10%)',
                    'Performance-based bonuses',
                    'Joint R&D opportunities'
                  ],
                  role: '10% of equity'
                },
                {
                  title: '📦 Distribution & Logistics Partners',
                  description: 'Connect us to global markets',
                  benefits: [
                    'Exclusive regional distribution rights',
                    'Margin sharing: 12-18% wholesale',
                    'Co-marketing fund (3% sales)',
                    'Real-time tracking tech platform',
                    'Equity participation (5-8%)'
                  ],
                  role: '15% of equity'
                }
              ].map((group, i) => (
                <div key={i} className="bg-gradient-to-br from-amber-50 to-white rounded-xl p-10 border border-gray-200 hover:shadow-lg transition-shadow">
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{group.title}</h3>
                  <p className="text-gray-600 mb-6">{group.description}</p>
                  <div className="space-y-3 mb-6">
                    {group.benefits.map((benefit, j) => (
                      <div key={j} className="flex items-start gap-3">
                        <span className="text-amber-600 font-bold">✓</span>
                        <p className="text-gray-700 text-sm">{benefit}</p>
                      </div>
                    ))}
                  </div>
                  <div className="pt-6 border-t border-gray-200">
                    <p className="font-semibold text-amber-600">{group.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Impact & Beneficiaries */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <div className="inline-block mb-4 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
                IMPACT & CHANGE
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Economic Prosperity for Philippine Communities
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-12 mb-12">
              <div className="bg-gradient-to-br from-green-50 to-white rounded-xl p-12 border border-green-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-8">By Year 5:</h3>
                <div className="space-y-4">
                  {[
                    { icon: '👥', text: 'Create 10,000+ direct jobs' },
                    { icon: '🌾', text: 'Partner with 5,000+ farming families' },
                    { icon: '💰', text: 'Generate $450M+ community income' },
                    { icon: '🎓', text: 'Fund 5,000 educational scholarships' },
                    { icon: '🏥', text: 'Support healthcare in 50+ barangays' },
                    { icon: '♀️', text: '40% leadership roles for women' },
                    { icon: '🌱', text: 'Restore 10,000 hectares of forest' },
                    { icon: '🌍', text: 'Reduce agricultural poverty by 35%' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 bg-white rounded-lg border border-green-200">
                      <span className="text-3xl">{item.icon}</span>
                      <p className="text-gray-700 font-medium leading-relaxed">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white rounded-xl p-10 border border-gray-200">
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">Primary Beneficiaries</h3>
                  <div className="space-y-4">
                    {[
                      {
                        group: 'Coconut Farming Communities',
                        description: 'Income increase of 3-4x through fair contracts and profit sharing',
                        region: 'Quezon, Davao, Pangasinan'
                      },
                      {
                        group: 'Manufacturing Workforce',
                        description: 'Skilled factory jobs with benefits, training, profit sharing',
                        region: 'Central processing locations'
                      },
                      {
                        group: 'Logistics & Distribution',
                        description: 'Business ownership, jobs, equity stakes',
                        region: 'Port cities & hubs'
                      },
                      {
                        group: 'Women Entrepreneurs',
                        description: '40%+ representation, microfinance, leadership development',
                        region: 'Nationwide'
                      }
                    ].map((item, i) => (
                      <div key={i} className="p-4 bg-gradient-to-r from-green-50 to-white rounded-lg border border-green-200">
                        <p className="font-bold text-gray-900">{item.group}</p>
                        <p className="text-gray-700 text-sm mt-2">{item.description}</p>
                        <p className="text-green-700 font-semibold text-sm mt-2">📍 {item.region}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-100 rounded-xl p-10 border-2 border-amber-600">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">SDG Alignment</h3>
                  <p className="text-gray-700 mb-4">Advancing UN Sustainable Development Goals:</p>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p>✓ SDG 1: No Poverty (income generation)</p>
                    <p>✓ SDG 5: Gender Equality (40% women in leadership)</p>
                    <p>✓ SDG 8: Decent Work (fair wages, jobs)</p>
                    <p>✓ SDG 12: Responsible Consumption (100% natural products)</p>
                    <p>✓ SDG 13: Climate Action (forest restoration, carbon neutral 2030)</p>
                    <p>✓ SDG 15: Life on Land (ecosystem restoration)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-amber-600 to-orange-600 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              Join a Movement Transforming Philippine Agriculture
            </h2>
            <p className="text-xl text-amber-50 mb-12 leading-relaxed max-w-2xl mx-auto">
              Whether you're a farmer seeking fair pricing, an investor looking for impact returns, a partner building networks, or a technology provider—Coconuts.com.ph is built for your contribution and success.
            </p>

            {!isAuthenticated && (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => setShowAuthModalOnDemand(true)}
                  className="px-10 py-4 bg-white text-amber-600 rounded-lg hover:bg-gray-100 font-bold text-lg transition-colors"
                >
                  Get Started Now →
                </button>
                <button
                  onClick={() => setShowAuthModalOnDemand(true)}
                  className="px-10 py-4 border-2 border-white text-white rounded-lg hover:bg-white/10 font-bold text-lg transition-colors"
                >
                  Learn More
                </button>
              </div>
            )}

            <div className="mt-16 pt-8 border-t border-white/30">
              <p className="text-amber-50 text-sm">
                Coconuts.com.ph | Transforming Philippine Agriculture through Technology, Transparency & Community
              </p>
              <p className="text-amber-100 text-sm mt-4">
                Contact: partnerships@coconuts.com.ph | +63 (2) 1234-5678
              </p>
            </div>
          </div>
        </section>

        {/* Capital & Equipment Breakdown */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <div className="inline-block mb-4 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
                DETAILED INVESTMENT BREAKDOWN
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Equipment Costs, Facility Development & Operational Setup
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-12 mb-12">
              <div className="bg-gradient-to-br from-amber-50 to-white rounded-xl p-10 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">🏭 Manufacturing Facility</h3>
                <div className="space-y-4">
                  {[
                    { item: 'Cold-press extraction units (3)', cost: '$450K', spec: '5-ton/day capacity each' },
                    { item: 'Pasteurization & bottling line', cost: '$380K', spec: 'Aseptic filling, 10K units/hour' },
                    { item: 'Oil refining & filtration', cost: '$290K', spec: 'Multi-stage purification' },
                    { item: 'Quality control lab', cost: '$180K', spec: 'Full testing equipment' },
                    { item: 'Storage & refrigeration', cost: '$240K', spec: '500-ton cold storage' },
                    { item: 'Building & infrastructure', cost: '$1.2M', spec: '8,000 sqm facility' },
                    { item: 'Power & utilities setup', cost: '$160K', spec: 'Solar + grid hybrid' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-white rounded-lg border border-amber-200">
                      <div>
                        <p className="font-semibold text-gray-900">{item.item}</p>
                        <p className="text-xs text-gray-600 mt-1">{item.spec}</p>
                      </div>
                      <p className="text-lg font-bold text-amber-600 text-right">{item.cost}</p>
                    </div>
                  ))}
                  <div className="pt-4 border-t-2 border-amber-300 flex items-center justify-between font-bold">
                    <p className="text-gray-900">Manufacturing Subtotal</p>
                    <p className="text-2xl text-amber-600">$3.49M</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl p-10 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">📦 Logistics & Distribution</h3>
                <div className="space-y-4">
                  {[
                    { item: 'Port warehouse (1,500 sqm)', cost: '$280K', spec: 'Climate controlled' },
                    { item: 'Logistics management system', cost: '$95K', spec: 'Real-time tracking' },
                    { item: 'Refrigerated transport fleet', cost: '$620K', spec: '15x vehicles, GPS tracked' },
                    { item: 'Container handling equipment', cost: '$210K', spec: 'Forklifts, palletizers' },
                    { item: 'Export packaging lines', cost: '$150K', spec: 'Custom design capability' },
                    { item: 'Shipping container deposits', cost: '$180K', spec: '100x 40ft containers' },
                    { item: 'Distribution partner setup', cost: '$85K', spec: 'Regional hubs (4)' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-white rounded-lg border border-blue-200">
                      <div>
                        <p className="font-semibold text-gray-900">{item.item}</p>
                        <p className="text-xs text-gray-600 mt-1">{item.spec}</p>
                      </div>
                      <p className="text-lg font-bold text-blue-600 text-right">{item.cost}</p>
                    </div>
                  ))}
                  <div className="pt-4 border-t-2 border-blue-300 flex items-center justify-between font-bold">
                    <p className="text-gray-900">Logistics Subtotal</p>
                    <p className="text-2xl text-blue-600">$1.62M</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-white rounded-xl p-10 border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">👥 Year 1 Labor & Operations</h3>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <p className="font-semibold text-gray-900 mb-4">Workforce Composition (200+ staff)</p>
                  <div className="space-y-3">
                    {[
                      { role: 'Processing & QA staff (85)', salary: '$1,800/mo', cost: '$1.83M/year' },
                      { role: 'Logistics & packaging (55)', salary: '$1,600/mo', cost: '$1.06M/year' },
                      { role: 'Management (12)', salary: '$4,500/mo', cost: '$0.65M/year' },
                      { role: 'Sales & partnerships (20)', salary: '$3,000/mo', cost: '$0.72M/year' },
                      { role: 'Technology & systems (15)', salary: '$5,000/mo', cost: '$0.90M/year' },
                      { role: 'Finance & admin (13)', salary: '$2,500/mo', cost: '$0.39M/year' }
                    ].map((item, i) => (
                      <div key={i} className="p-3 bg-white rounded-lg border border-green-200">
                        <p className="font-medium text-gray-900">{item.role}</p>
                        <div className="flex justify-between text-sm text-gray-600 mt-1">
                          <span>{item.salary} base</span>
                          <span className="font-semibold text-green-600">{item.cost}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-4 bg-green-100 rounded-lg border-2 border-green-600">
                    <p className="font-bold text-gray-900">Total Labor Cost (Year 1)</p>
                    <p className="text-2xl font-bold text-green-600">$5.55M</p>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-gray-900 mb-4">Operational Expenses (Year 1)</p>
                  <div className="space-y-3">
                    {[
                      { item: 'Utilities (power, water, gas)', cost: '$180K' },
                      { item: 'Raw material farmer advances', cost: '$800K', note: '12-month supply buffer' },
                      { item: 'Maintenance & repairs', cost: '$120K' },
                      { item: 'Marketing & brand launch', cost: '$250K', note: 'Digital + events' },
                      { item: 'Certifications & compliance', cost: '$95K', note: 'Organic, Fair Trade, etc' },
                      { item: 'Insurance & security', cost: '$140K' },
                      { item: 'Legal & professional services', cost: '$85K' },
                      { item: 'Contingency & reserves (10%)', cost: '$165K' }
                    ].map((item, i) => (
                      <div key={i} className="p-3 bg-white rounded-lg border border-green-200">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{item.item}</p>
                            {item.note && <p className="text-xs text-gray-600 mt-1">{item.note}</p>}
                          </div>
                          <p className="font-semibold text-gray-700 ml-2">{item.cost}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-4 bg-green-100 rounded-lg border-2 border-green-600">
                    <p className="font-bold text-gray-900">Total Operating Costs (Year 1)</p>
                    <p className="text-2xl font-bold text-green-600">$1.83M</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 bg-amber-100 p-8 rounded-xl border-2 border-amber-600">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">💰 Total Initial Investment Summary</h3>
              <div className="grid md:grid-cols-4 gap-6">
                <div className="bg-white p-4 rounded-lg">
                  <p className="text-sm text-gray-600 font-semibold">Manufacturing</p>
                  <p className="text-3xl font-bold text-amber-600">$3.49M</p>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <p className="text-sm text-gray-600 font-semibold">Logistics</p>
                  <p className="text-3xl font-bold text-blue-600">$1.62M</p>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <p className="text-sm text-gray-600 font-semibold">Year 1 Labor</p>
                  <p className="text-3xl font-bold text-green-600">$5.55M</p>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <p className="text-sm text-gray-600 font-semibold">Operations</p>
                  <p className="text-3xl font-bold text-orange-600">$1.83M</p>
                </div>
              </div>
              <div className="mt-6 p-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg">
                <p className="font-bold text-lg mb-2">TOTAL: $12.49M for Full Year 1 Operation</p>
                <p className="text-sm text-amber-100">Structured as: $9.08M equity + $3.41M working capital facility</p>
              </div>
            </div>
          </div>
        </section>

        {/* Detailed Financial Projections */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <div className="inline-block mb-4 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
                COMPREHENSIVE FINANCIAL MODEL
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                5-Year Detailed Projections
              </h2>
            </div>

            <div className="bg-white rounded-xl p-8 border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-4 px-4 font-bold text-gray-900">Financial Metric</th>
                    <th className="text-center py-4 px-4 font-bold text-gray-900">Year 1</th>
                    <th className="text-center py-4 px-4 font-bold text-gray-900">Year 2</th>
                    <th className="text-center py-4 px-4 font-bold text-gray-900">Year 3</th>
                    <th className="text-center py-4 px-4 font-bold text-gray-900">Year 4</th>
                    <th className="text-center py-4 px-4 font-bold text-gray-900">Year 5</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { metric: 'Units Produced (millions)', data: ['2.4M', '6.8M', '14.2M', '24.6M', '38.5M'], category: 'Volume' },
                    { metric: 'Average Price per Unit', data: ['$3.40', '$3.45', '$3.50', '$3.55', '$3.60'], category: 'Volume' },
                    { metric: 'Total Revenue', data: ['$8.16M', '$23.46M', '$49.70M', '$87.43M', '$138.60M'], category: 'Revenue' },
                    { metric: 'Cost of Goods Sold (35%)', data: ['$2.86M', '$8.21M', '$17.40M', '$30.60M', '$48.51M'], category: 'Costs' },
                    { metric: 'Gross Profit', data: ['$5.30M', '$15.25M', '$32.30M', '$56.83M', '$90.09M'], category: 'Costs' },
                    { metric: 'Gross Margin %', data: ['65%', '65%', '65%', '65%', '65%'], category: 'Costs' },
                    { metric: 'Operating Expenses', data: ['$7.38M', '$9.84M', '$14.42M', '$19.60M', '$24.80M'], category: 'Expenses' },
                    { metric: 'EBITDA', data: ['-$2.08M', '$5.41M', '$17.88M', '$37.23M', '$65.29M'], category: 'Expenses' },
                    { metric: 'EBITDA Margin %', data: ['-25%', '23%', '36%', '43%', '47%'], category: 'Expenses' },
                    { metric: 'Depreciation & Amortization', data: ['$840K', '$840K', '$840K', '$560K', '$560K'], category: 'Depreciation' },
                    { metric: 'EBIT (Operating Income)', data: ['-$2.92M', '$4.57M', '$17.04M', '$36.67M', '$64.73M'], category: 'Profit' },
                    { metric: 'Interest Expense', data: ['$180K', '$140K', '$100K', '$50K', '$0K'], category: 'Profit' },
                    { metric: 'Pre-tax Income', data: ['-$3.10M', '$4.43M', '$16.94M', '$36.62M', '$64.73M'], category: 'Profit' },
                    { metric: 'Tax (30% rate)', data: ['$0', '$1.33M', '$5.08M', '$10.99M', '$19.42M'], category: 'Profit' },
                    { metric: 'Net Income', data: ['-$3.10M', '$3.10M', '$11.86M', '$25.63M', '$45.31M'], category: 'Profit' },
                    { metric: 'Net Profit Margin %', data: ['-38%', '13%', '24%', '29%', '33%'], category: 'Profit' }
                  ].map((row, i) => {
                    const isTotal = row.metric.includes('Total') || row.metric.includes('Net Income');
                    const bgClass = isTotal ? 'bg-amber-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                    return (
                      <tr key={i} className={bgClass + ' border-b border-gray-200'}>
                        <td className={'py-4 px-4 font-semibold text-gray-900 ' + (isTotal ? 'font-bold' : '')}>{row.metric}</td>
                        {row.data.map((value, j) => (
                          <td key={j} className="py-4 px-4 text-center text-gray-700 font-medium">{value}</td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-12 grid md:grid-cols-3 gap-8">
              <div className="bg-white rounded-xl p-10 border border-gray-200">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">🎯 Key Metrics</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <p className="text-gray-700">Breakeven (units/month)</p>
                    <p className="font-bold text-gray-900">Month 18</p>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <p className="text-gray-700">Payback Period</p>
                    <p className="font-bold text-gray-900">3.2 years</p>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="text-gray-700">Year 5 IRR</p>
                    <p className="font-bold text-blue-600">32.4%</p>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="text-gray-700">5-Year CAGR Revenue</p>
                    <p className="font-bold text-blue-600">85%</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-10 border border-gray-200">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">💵 Return Scenarios</h3>
                <div className="space-y-3">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-gray-600 font-semibold">Conservative (8x EBITDA multiple)</p>
                    <p className="text-2xl font-bold text-green-600">$522M Exit</p>
                    <p className="text-xs text-gray-600 mt-1">5.7x initial investment</p>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-gray-600 font-semibold">Base Case (10x EBITDA multiple)</p>
                    <p className="text-2xl font-bold text-blue-600">$653M Exit</p>
                    <p className="text-xs text-gray-600 mt-1">7.2x initial investment</p>
                  </div>
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-sm text-gray-600 font-semibold">Optimistic (12x EBITDA multiple)</p>
                    <p className="text-2xl font-bold text-purple-600">$783M Exit</p>
                    <p className="text-xs text-gray-600 mt-1">8.6x initial investment</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-10 border border-gray-200">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">📈 Equity Distribution</h3>
                <div className="space-y-3">
                  {[
                    { group: 'Farmers & Landowners', pct: '35%', amt: '$3.18M' },
                    { group: 'Equipment Partners', pct: '10%', amt: '$908K' },
                    { group: 'Logistics Partners', pct: '15%', amt: '$1.36M' },
                    { group: 'Impact Investors', pct: '25%', amt: '$2.27M' },
                    { group: 'Strategic Investors', pct: '15%', amt: '$1.36M' }
                  ].map((item, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded border border-gray-200">
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-medium text-gray-900">{item.group}</p>
                        <p className="font-bold text-amber-600">{item.pct}</p>
                      </div>
                      <p className="text-sm text-gray-600">{item.amt} initial valuation</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Implementation Roadmap */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <div className="inline-block mb-4 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
                EXECUTION TIMELINE
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                12-Month Implementation Roadmap
              </h2>
            </div>

            <div className="space-y-6">
              {[
                {
                  phase: 'Phase 1: Foundation (Months 1-3)',
                  activities: [
                    'Secure initial capital ($3M seed round)',
                    'Acquire 500 hectares of coconut plantation rights',
                    'Begin facility construction (Laguna)',
                    'Establish farmer partnerships (500+ families)',
                    'Order manufacturing equipment',
                    'Set up currency.ph integration & governance'
                  ],
                  milestone: 'Capital raised, land secured, construction 50% complete'
                },
                {
                  phase: 'Phase 2: Development (Months 4-6)',
                  activities: [
                    'Complete facility construction & equipment installation',
                    'Establish quality control lab with certifications',
                    'First batch of farmer contracts signed',
                    'Logistics partnerships finalized',
                    'Regulatory approvals & food safety certifications',
                    'Launch currency.ph transparency platform'
                  ],
                  milestone: 'Manufacturing facility operational, first production run'
                },
                {
                  phase: 'Phase 3: Launch (Months 7-9)',
                  activities: [
                    'Commence commercial production (2.4M units/year)',
                    'Export first container shipments',
                    'Onboard distribution partners in 5 countries',
                    'Launch marketing campaign (Asia + Americas)',
                    'Expand farmer network to 2,000 families',
                    'Quarterly impact & financial reporting'
                  ],
                  milestone: 'First revenue ($500K+), partnerships signed'
                },
                {
                  phase: 'Phase 4: Scale (Months 10-12)',
                  activities: [
                    'Ramp to full production capacity',
                    'Expand to 8 target export markets',
                    'Recruit additional manufacturing staff (100+ hires)',
                    'Establish 2nd processing facility planning',
                    'Women entrepreneur program launch',
                    'Complete Year 1 audit & transparent reporting'
                  ],
                  milestone: 'Year 1 revenue $8.2M, 200+ staff, profitability path clear'
                }
              ].map((phase, i) => (
                <div key={i} className="bg-gradient-to-r from-amber-50 to-white rounded-xl p-10 border-l-4 border-amber-600">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">{phase.phase}</h3>
                  <div className="grid md:grid-cols-2 gap-8">
                    <div>
                      <p className="text-sm font-semibold text-gray-600 mb-3">Key Activities:</p>
                      <ul className="space-y-2">
                        {phase.activities.map((activity, j) => (
                          <li key={j} className="flex items-start gap-3 text-gray-700">
                            <span className="text-amber-600 font-bold mt-1">▸</span>
                            {activity}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-amber-100 p-6 rounded-lg border border-amber-300">
                      <p className="text-sm font-semibold text-amber-700 mb-2">🎯 PHASE MILESTONE</p>
                      <p className="text-gray-900 font-bold text-lg">{phase.milestone}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Technology & Platform */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <div className="inline-block mb-4 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
                TECHNOLOGY FOUNDATION
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Transparent, Integrated, Real-Time Systems
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-12">
              <div className="bg-white rounded-xl p-10 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <span className="text-3xl">⚙️</span>
                  Supply Chain Management
                </h3>
                <div className="space-y-4">
                  {[
                    {
                      feature: 'Blockchain Verification',
                      desc: 'Immutable record of coconut sourcing, processing, shipping'
                    },
                    {
                      feature: 'Real-time GPS Tracking',
                      desc: 'Every shipment tracked from farm to retail'
                    },
                    {
                      feature: 'Farmer Mobile App',
                      desc: 'Direct market updates, pricing, payment notifications'
                    },
                    {
                      feature: 'QR Code Product Identity',
                      desc: 'Retailers & consumers verify authenticity & origin'
                    },
                    {
                      feature: 'Automated Invoicing',
                      desc: 'Instant payment processing via currency.ph'
                    },
                    {
                      feature: 'Sustainability Dashboard',
                      desc: 'Track carbon footprint, water usage, forest impact'
                    }
                  ].map((item, i) => (
                    <div key={i} className="p-4 bg-gradient-to-r from-blue-50 to-white rounded-lg border border-blue-200">
                      <p className="font-bold text-gray-900">{item.feature}</p>
                      <p className="text-gray-600 text-sm mt-2">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl p-10 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <span className="text-3xl">💰</span>
                  Currency.ph Financial Integration
                </h3>
                <div className="space-y-4">
                  {[
                    {
                      feature: 'Automated Payments',
                      desc: 'Farmers paid within 24 hours of delivery verification'
                    },
                    {
                      feature: 'Currency Conversion & Hedging',
                      desc: 'Lock rates for international payments, minimize volatility'
                    },
                    {
                      feature: 'Equity Ownership Tracking',
                      desc: 'Transparent record of all stakeholder equity positions'
                    },
                    {
                      feature: 'Dividend Distribution',
                      desc: 'Automatic quarterly profit distributions to token holders'
                    },
                    {
                      feature: 'Voting Rights Management',
                      desc: 'Token-based governance voting on major decisions'
                    },
                    {
                      feature: 'Multi-Currency Wallets',
                      desc: 'USD, PHP, EUR, crypto - seamless conversion'
                    }
                  ].map((item, i) => (
                    <div key={i} className="p-4 bg-gradient-to-r from-green-50 to-white rounded-lg border border-green-200">
                      <p className="font-bold text-gray-900">{item.feature}</p>
                      <p className="text-gray-600 text-sm mt-2">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-12 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-xl p-10">
              <h3 className="text-2xl font-bold mb-6">🔐 Security & Compliance</h3>
              <div className="grid md:grid-cols-3 gap-8">
                <div>
                  <p className="font-semibold mb-3">Data Protection</p>
                  <p className="text-sm text-blue-100">Bank-grade encryption (AES-256), SOC 2 Type II compliant, GDPR aligned</p>
                </div>
                <div>
                  <p className="font-semibold mb-3">Financial Compliance</p>
                  <p className="text-sm text-blue-100">Philippines BIR approved, RCBC banking partner, monthly audits</p>
                </div>
                <div>
                  <p className="font-semibold mb-3">Supply Chain Integrity</p>
                  <p className="text-sm text-blue-100">Blockchain immutability, ISO 22000 food safety, FDA compliance</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Governance & Transparency */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <div className="inline-block mb-4 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
                GOVERNANCE STRUCTURE
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Community-Driven Decision Making
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-12 mb-12">
              <div className="bg-gradient-to-br from-amber-50 to-white rounded-xl p-10 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Board of Directors (7 Members)</h3>
                <div className="space-y-4">
                  {[
                    { role: 'Executive Chairman', rep: 'Founder/CEO', tenure: 'Permanent' },
                    { role: 'Farmer Representative', rep: 'Elected from farmer networks', tenure: '2-year term' },
                    { role: 'Investor Director (2)', rep: 'Largest institutional investors', tenure: '2-year term' },
                    { role: 'Equipment Partner Rep', rep: 'Logistics/supply chain sector', tenure: '2-year term' },
                    { role: 'Impact Director', rep: 'NGO/development sector', tenure: '2-year term' },
                    { role: 'Independent Director', rep: 'External governance expert', tenure: '2-year term' }
                  ].map((item, i) => (
                    <div key={i} className="p-4 bg-white border border-amber-200 rounded-lg">
                      <p className="font-bold text-gray-900">{item.role}</p>
                      <p className="text-sm text-gray-600 mt-1">{item.rep}</p>
                      <p className="text-xs text-amber-700 font-semibold mt-2">{item.tenure}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl p-10 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Stakeholder Council (Quarterly)</h3>
                <p className="text-gray-700 mb-6 leading-relaxed">All equity stakeholders participate in quarterly council meetings. Voting power proportional to equity stake (minimum 1% threshold).</p>
                <div className="space-y-3">
                  <div className="p-4 bg-white border border-blue-200 rounded-lg">
                    <p className="font-bold text-gray-900">Quorum Requirements</p>
                    <p className="text-sm text-gray-600 mt-2">Minimum 60% of voting stake present to pass resolutions</p>
                  </div>
                  <div className="p-4 bg-white border border-blue-200 rounded-lg">
                    <p className="font-bold text-gray-900">Voting Thresholds</p>
                    <p className="text-sm text-gray-600 mt-2">Simple majority (50%+) for operational decisions; 66% for strategic changes</p>
                  </div>
                  <div className="p-4 bg-white border border-blue-200 rounded-lg">
                    <p className="font-bold text-gray-900">Veto Rights</p>
                    <p className="text-sm text-gray-600 mt-2">Farmer collective can veto changes affecting pricing or terms</p>
                  </div>
                  <div className="p-4 bg-white border border-blue-200 rounded-lg">
                    <p className="font-bold text-gray-900">Transparency Mandate</p>
                    <p className="text-sm text-gray-600 mt-2">All votes and decisions published on currency.ph within 48 hours</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl p-12">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">📊 Transparency Requirements</h3>
              <div className="grid md:grid-cols-4 gap-6">
                <div className="bg-white/10 p-6 rounded-lg backdrop-blur-sm">
                  <p className="font-semibold mb-3">Monthly Reports</p>
                  <p className="text-sm text-amber-50">Production volume, farmer payments, inventory, shipments</p>
                </div>
                <div className="bg-white/10 p-6 rounded-lg backdrop-blur-sm">
                  <p className="font-semibold mb-3">Quarterly Financials</p>
                  <p className="text-sm text-amber-50">Full P&L, balance sheet, cash flow, audited by independent firm</p>
                </div>
                <div className="bg-white/10 p-6 rounded-lg backdrop-blur-sm">
                  <p className="font-semibold mb-3">Annual Impact Report</p>
                  <p className="text-sm text-amber-50">Jobs created, income generated, carbon impact, SDG metrics</p>
                </div>
                <div className="bg-white/10 p-6 rounded-lg backdrop-blur-sm">
                  <p className="font-semibold mb-3">Live Dashboard</p>
                  <p className="text-sm text-amber-50">Real-time operations visible to all stakeholders 24/7</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Sustainability Commitments */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <div className="inline-block mb-4 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                ENVIRONMENTAL & SOCIAL
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Sustainability at the Core
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-12 mb-12">
              <div className="bg-white rounded-xl p-10 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">🌱 Environmental Commitments</h3>
                <div className="space-y-4">
                  {[
                    { goal: 'Carbon Neutral by 2030', target: 'Scope 1-3 emissions offset', progress: 'Year 3 target: -50% baseline' },
                    { goal: 'Zero Waste Production', target: 'Coconut shells → biochar, husks → fiber', progress: 'By Year 2: 95% utilization' },
                    { goal: 'Forest Restoration', target: '1% annual profit to reforestation', progress: '10,000 hectares by Year 5' },
                    { goal: 'Water Conservation', target: 'Closed-loop processing systems', progress: '60% water reduction by Year 3' },
                    { goal: 'Renewable Energy', target: '100% facility solar powered', progress: '2.5MW solar installation' },
                    { goal: 'Biodiversity Protection', target: 'Shade-grown coconut farming', progress: 'Protects native species in Mindanao' }
                  ].map((item, i) => (
                    <div key={i} className="p-4 bg-gradient-to-r from-green-50 to-white rounded-lg border border-green-200">
                      <p className="font-bold text-gray-900">{item.goal}</p>
                      <p className="text-sm text-gray-600 mt-1">{item.target}</p>
                      <p className="text-xs text-green-700 font-semibold mt-2">📈 {item.progress}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl p-10 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">👥 Social Impact Commitments</h3>
                <div className="space-y-4">
                  {[
                    { goal: 'Women Empowerment', target: '40% management roles filled by women', progress: 'By Year 2: 50% leadership' },
                    { goal: 'Educational Access', target: '5,000 scholarships for farming family children', progress: '$5M/year education fund' },
                    { goal: 'Healthcare Programs', target: 'Free health clinics in 50+ barangays', progress: 'Preventive care + emergency support' },
                    { goal: 'Fair Wages', target: '150% of regional minimum wage + benefits', progress: '$1,800+/month base salary' },
                    { goal: 'Skills Development', target: 'Training programs for 5,000+ farmers', progress: 'Yield optimization, technology' },
                    { goal: 'Poverty Reduction', target: '35% reduction in agricultural poverty', progress: 'In target regions by Year 5' }
                  ].map((item, i) => (
                    <div key={i} className="p-4 bg-gradient-to-r from-purple-50 to-white rounded-lg border border-purple-200">
                      <p className="font-bold text-gray-900">{item.goal}</p>
                      <p className="text-sm text-gray-600 mt-1">{item.target}</p>
                      <p className="text-xs text-purple-700 font-semibold mt-2">📈 {item.progress}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-12 border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-8">🏆 Certifications & Compliance</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { cert: '✓ Organic Certified', org: 'USDA & EU Standards' },
                  { cert: '✓ Fair Trade Certified', org: 'International Fair Trade Association' },
                  { cert: '✓ B-Corp Certification', org: 'Benefit Corporation Status' },
                  { cert: '✓ ISO 22000', org: 'Food Safety Management' },
                  { cert: '✓ HACCP Compliant', org: 'Hazard Analysis System' },
                  { cert: '✓ Carbon Neutral', org: 'Verified Offsetting' },
                  { cert: '✓ Rainforest Alliance', org: 'Sustainable Agriculture' },
                  { cert: '✓ BIR Approved', org: 'Philippines Tax Compliant' }
                ].map((item, i) => (
                  <div key={i} className="p-4 bg-gradient-to-br from-green-50 to-white rounded-lg border border-green-200 text-center">
                    <p className="font-bold text-green-700 text-lg">{item.cert}</p>
                    <p className="text-xs text-gray-600 mt-2">{item.org}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Risk Analysis & Mitigation */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <div className="inline-block mb-4 px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                RISK MANAGEMENT
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Identified Risks & Mitigation Strategies
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {[
                {
                  risk: 'Climate & Weather Risk',
                  impact: 'Typhoons, droughts affect coconut yield',
                  mitigation: [
                    'Diversified sourcing across 3 regions',
                    'Crop insurance programs ($200K/year)',
                    'Drought-resistant hybrid cultivation',
                    'Strategic reserves (3-month buffer inventory)'
                  ],
                  severity: 'Medium'
                },
                {
                  risk: 'Market Competition',
                  impact: 'Existing coconut brands increase competition',
                  mitigation: [
                    'Vertical integration = lower cost advantage',
                    'Premium positioning (100% pure)',
                    'First-mover advantage in transparency market',
                    'Direct retailer relationships (exclude intermediaries)'
                  ],
                  severity: 'Low-Medium'
                },
                {
                  risk: 'Currency Volatility',
                  impact: 'PHP/USD fluctuations affect profitability',
                  mitigation: [
                    'Currency.ph hedging integrated',
                    'Multi-currency revenue streams',
                    'Price adjustments for major shifts',
                    'Natural hedge through global operations'
                  ],
                  severity: 'Low'
                },
                {
                  risk: 'Supply Chain Disruption',
                  impact: 'Port closures, shipping delays',
                  mitigation: [
                    'Multiple port partnerships (Manila, Cebu, Davao)',
                    '3-week inventory buffer maintained',
                    'Backup logistics providers contracted',
                    'Insurance coverage for supply interruption'
                  ],
                  severity: 'Medium'
                },
                {
                  risk: 'Regulatory Changes',
                  impact: 'Export regulations, food safety standards',
                  mitigation: [
                    'Compliance team monitoring developments',
                    'Certifications beyond minimum standards',
                    'Monthly regulatory updates to stakeholders',
                    'Advocacy through industry associations'
                  ],
                  severity: 'Low'
                },
                {
                  risk: 'Key Personnel Risk',
                  impact: 'Loss of critical management staff',
                  mitigation: [
                    'Succession planning documented',
                    'Equity incentives for key staff (2-3 years vesting)',
                    'Cross-training on critical functions',
                    'Key person insurance policies'
                  ],
                  severity: 'Medium'
                },
                {
                  risk: 'Geopolitical Tensions',
                  impact: 'Trade wars, tariff increases',
                  mitigation: [
                    '50+ market diversification',
                    'Tariff hedging through partnerships',
                    'Regional production facilities (future)',
                    'Value-added products less impacted'
                  ],
                  severity: 'Low-Medium'
                },
                {
                  risk: 'Technology System Failure',
                  impact: 'Currency.ph integration or supply chain systems down',
                  mitigation: [
                    'Redundant cloud infrastructure',
                    '99.9% uptime SLAs with providers',
                    'Manual backup systems for critical ops',
                    'Weekly disaster recovery drills'
                  ],
                  severity: 'Low'
                }
              ].map((item, i) => {
                const severityColor = item.severity.includes('High') ? 'bg-red-100 text-red-700' : item.severity.includes('Medium') ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700';
                return (
                  <div key={i} className="bg-white rounded-lg p-8 border border-gray-200 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-xl font-bold text-gray-900">{item.risk}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${severityColor}`}>{item.severity}</span>
                    </div>
                    <p className="text-gray-700 font-medium mb-4">{item.impact}</p>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-600">Mitigation Strategies:</p>
                      {item.mitigation.map((m, j) => (
                        <div key={j} className="flex items-start gap-3 text-gray-700 text-sm">
                          <span className="text-amber-600 font-bold mt-0.5">✓</span>
                          {m}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Competitive Landscape */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <div className="inline-block mb-4 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                COMPETITIVE ANALYSIS
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                How Coconuts.com.ph Stands Apart
              </h2>
            </div>

            <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-4 px-6 font-bold text-gray-900">Feature</th>
                    <th className="text-center py-4 px-6 font-bold text-gray-900">Coconuts.com.ph</th>
                    <th className="text-center py-4 px-6 font-bold text-gray-900">Traditional Brand</th>
                    <th className="text-center py-4 px-6 font-bold text-gray-900">Regional Producer</th>
                    <th className="text-center py-4 px-6 font-bold text-gray-900">E-Commerce Only</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: 'Vertical Integration', ccph: '✓ Full', trad: '✗ Partial', reg: '✗ None', ec: '✗ Sourced' },
                    { feature: 'Sourcing Transparency', ccph: '✓ Blockchain', trad: '✗ Limited', reg: '✗ None', ec: '✗ None' },
                    { feature: 'Direct Farmer Payment', ccph: '✓ 24-48hrs', trad: '✗ 60+ days', reg: '✓ 30 days', ec: '✗ N/A' },
                    { feature: 'Equity Distribution', ccph: '✓ 100%', trad: '✗ None', reg: '✗ None', ec: '✗ None' },
                    { feature: 'Product Purity', ccph: '✓ 100% Pure', trad: '✗ Additives', reg: '✓ Natural', ec: '✓ Varies' },
                    { feature: 'Global Distribution', ccph: '✓ 50+ markets', trad: '✓ 40+ markets', reg: '✗ 5-10', ec: '✓ Digital only' },
                    { feature: 'Retail Price Position', ccph: '$3.40 premium', trad: '$2.80 (discount)', reg: '$4.20 (high)', ec: '$3.60 (online)' },
                    { feature: 'Impact Commitment', ccph: '✓ 3% net profit', trad: '✗ 0.2%', reg: '✗ Minimal', ec: '✗ None' },
                    { feature: 'Technology Integration', ccph: '✓ currency.ph', trad: '✗ Basic', reg: '✗ None', ec: '✓ Marketplace' },
                    { feature: 'Sustainability Certs', ccph: '✓ 8 certifications', trad: '✓ 3-4 certs', reg: '✓ 1-2 certs', ec: '✗ None' }
                  ].map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="py-4 px-6 font-semibold text-gray-900 border-r border-gray-200">{row.feature}</td>
                      <td className="py-4 px-6 text-center text-gray-700 border-r border-gray-200"><span className="font-bold text-amber-600">{row.ccph}</span></td>
                      <td className="py-4 px-6 text-center text-gray-700 border-r border-gray-200">{row.trad}</td>
                      <td className="py-4 px-6 text-center text-gray-700 border-r border-gray-200">{row.reg}</td>
                      <td className="py-4 px-6 text-center text-gray-700">{row.ec}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-12 p-10 bg-gradient-to-r from-amber-100 to-orange-100 rounded-xl border-2 border-amber-600">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">🎯 Unique Value Proposition</h3>
              <div className="grid md:grid-cols-3 gap-8">
                <div>
                  <p className="font-bold text-amber-700 mb-3">Only Enterprise with:</p>
                  <ul className="space-y-2 text-gray-800">
                    <li>✓ Full farm-to-retail integration</li>
                    <li>✓ Blockchain supply chain</li>
                    <li>✓ Equity for all stakeholders</li>
                    <li>✓ Community profit sharing</li>
                    <li>✓ Currency.ph transparency</li>
                  </ul>
                </div>
                <div>
                  <p className="font-bold text-amber-700 mb-3">Market Timing Advantage:</p>
                  <ul className="space-y-2 text-gray-800">
                    <li>✓ Surge in health/wellness</li>
                    <li>✓ Plant-based movement peak</li>
                    <li>✓ Sustainable brands trending</li>
                    <li>✓ Fair trade demand rising</li>
                    <li>✓ Transparency imperative</li>
                  </ul>
                </div>
                <div>
                  <p className="font-bold text-amber-700 mb-3">Barriers to Competition:</p>
                  <ul className="space-y-2 text-gray-800">
                    <li>✓ First-mover in transparency</li>
                    <li>✓ Farmer network lock-in</li>
                    <li>✓ Proprietary tech stack</li>
                    <li>✓ Brand & ecosystem moat</li>
                    <li>✓ Partnership network</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Team & Expertise */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <div className="inline-block mb-4 px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                LEADERSHIP & ADVISORS
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Experienced Team with Track Record
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mb-12">
              {[
                {
                  role: 'CEO & Co-Founder',
                  name: 'Strategic Leader',
                  background: [
                    '15 years in agriculture/food processing',
                    'Built 2 businesses to $50M+ revenue',
                    'Former VP at major beverage company',
                    'Expert in supply chain optimization'
                  ],
                  expertise: 'Operations, Strategy, Fundraising'
                },
                {
                  role: 'COO & Operations Lead',
                  name: 'Manufacturing Expert',
                  background: [
                    '20 years manufacturing leadership',
                    'Managed 500+ person facilities',
                    'Quality & safety certifications (HACCP, ISO)',
                    'Cost optimization specialist (30-40% reductions)'
                  ],
                  expertise: 'Manufacturing, Quality, Logistics'
                },
                {
                  role: 'CFO & Finance Director',
                  name: 'Financial Strategist',
                  background: [
                    '12 years in fintech & food finance',
                    'Currency.ph core team founding member',
                    'Raised $100M+ in structured finance',
                    'Expert in emerging market currencies'
                  ],
                  expertise: 'Finance, Compliance, Treasury'
                },
                {
                  role: 'Chief Sustainability Officer',
                  name: 'Impact Leader',
                  background: [
                    '18 years in development & sustainability',
                    'Led programs in 15 countries',
                    'Expert in B-Corp & Fair Trade',
                    'Community engagement specialist'
                  ],
                  expertise: 'Impact, Sustainability, Community'
                },
                {
                  role: 'Chief Technology Officer',
                  name: 'Tech Innovator',
                  background: [
                    '10 years blockchain & supply chain tech',
                    'Built 3 successful agritech platforms',
                    'Expert in IoT & real-time analytics',
                    'Scaled platforms to 50K+ users'
                  ],
                  expertise: 'Technology, Blockchain, Analytics'
                },
                {
                  role: 'Director of Market Development',
                  name: 'Export Specialist',
                  background: [
                    '14 years in agricultural exports',
                    'Established distribution in 30+ countries',
                    'Expert in retail partnerships',
                    'Negotiated $500M+ in supply contracts'
                  ],
                  expertise: 'Sales, Distribution, Market Entry'
                }
              ].map((member, i) => (
                <div key={i} className="bg-white rounded-xl p-8 border border-gray-200 hover:shadow-lg transition-shadow">
                  <div className="mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white font-bold text-xl">
                      {member.name.charAt(0)}
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">{member.name}</h3>
                  <p className="text-amber-600 font-semibold mb-4">{member.role}</p>
                  <div className="space-y-3 mb-6">
                    {member.background.map((item, j) => (
                      <p key={j} className="text-gray-700 text-sm flex items-start gap-3">
                        <span className="text-gray-400 mt-1">▸</span>
                        {item}
                      </p>
                    ))}
                  </div>
                  <div className="pt-6 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-600">CORE EXPERTISE</p>
                    <p className="text-gray-900 font-medium text-sm mt-2">{member.expertise}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl p-10 border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-8">Advisory Board</h3>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { advisor: 'Former Secretary of Agriculture (Philippines)', expertise: 'Policy, partnerships' },
                  { advisor: 'CEO, Major Multinational Food Company', expertise: 'Global scale, distribution' },
                  { advisor: 'UN Development Program Director (ASEAN)', expertise: 'Impact, sustainability' },
                  { advisor: 'Founder, Leading Fintech Platform', expertise: 'Technology, finance' },
                  { advisor: 'President, Philippine Coconut Association', expertise: 'Industry relations' },
                  { advisor: 'Climate & Agriculture Professor (MIT)', expertise: 'Climate resilience' }
                ].map((item, i) => (
                  <div key={i} className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-gray-200">
                    <p className="font-bold text-gray-900">{item.advisor}</p>
                    <p className="text-gray-600 text-sm mt-2">Expertise: {item.expertise}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Product Roadmap */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <div className="inline-block mb-4 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                FUTURE VISION
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Product & Market Expansion Roadmap
              </h2>
            </div>

            <div className="space-y-8">
              {[
                {
                  year: 'Year 1-2 (2025-2026)',
                  phase: 'Foundation & Core Products',
                  products: [
                    '💧 Coconut Water (aseptic) - 1.8M units/year',
                    '🫒 Virgin Coconut Oil - 0.4M units/year',
                    '✨ Coconut Moisturizer - 0.2M units/year'
                  ],
                  markets: 'Asia, North America, Europe (15 countries)',
                  capex: '$3M additional',
                  projectedRevenue: '$8-24M'
                },
                {
                  year: 'Year 2-3 (2026-2027)',
                  phase: 'Product Line Expansion',
                  products: [
                    'NEW: 🍫 Coconut Chocolate (organic, fair-trade)',
                    'NEW: 🥤 Coconut Protein Drinks (fitness market)',
                    'NEW: 🧴 Coconut Body Care Line (shampoo, lotion)',
                    'EXPAND: Coconut Sugar & Flour (baking market)'
                  ],
                  markets: 'Add Middle East, Australia, additional EU (25 countries)',
                  capex: '$8M (new product facility)',
                  projectedRevenue: '$50M'
                },
                {
                  year: 'Year 3-4 (2027-2028)',
                  phase: 'Regional Production Hubs',
                  products: [
                    'EXPAND: Premium Coconut Supplement Line',
                    'NEW: 🍶 Coconut Wine & Beverages (craft market)',
                    'NEW: 🧴 Professional Cosmetics (B2B)',
                    'LAUNCH: Coconut-based Bio-packaging'
                  ],
                  markets: 'Open 2nd facility (Vietnam/Indonesia). 35+ countries globally',
                  capex: '$25M (facility + equipment)',
                  projectedRevenue: '$90M'
                },
                {
                  year: 'Year 4-5 (2028-2029)',
                  phase: 'Market Leader & Sustainability Focus',
                  products: [
                    'PREMIUM: Luxury Coconut Beauty Line (spa/resort)',
                    'B2B: Food Service Coconut Solutions',
                    'NEW: Pharmaceutical-grade Coconut Extracts',
                    'EXPAND: Regional specialty products'
                  ],
                  markets: '50+ countries, 4 regional distribution hubs',
                  capex: '$30M (optimization + capacity)',
                  projectedRevenue: '$140M+'
                },
                {
                  year: 'Year 5+ (2029 onwards)',
                  phase: 'Global Enterprise & Exit Options',
                  products: [
                    'GLOBAL: 15+ coconut-based product categories',
                    'SERVICES: Coconut farming consulting',
                    'TECH: Sustainability analytics platform',
                    'EDUCATION: Academy for farming communities'
                  ],
                  markets: 'Global presence (100+ countries), regional production centers',
                  capex: 'Self-funded from profits',
                  projectedRevenue: '$250M+ (pre-exit)'
                }
              ].map((roadmap, i) => (
                <div key={i} className="bg-gradient-to-r from-green-50 to-white rounded-xl p-10 border-l-4 border-green-600">
                  <div className="mb-6">
                    <span className="inline-block px-4 py-2 bg-green-600 text-white rounded-full font-bold text-sm mr-3">{roadmap.year}</span>
                    <span className="text-2xl font-bold text-gray-900">{roadmap.phase}</span>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div>
                      <p className="font-bold text-gray-900 mb-3">📦 Products:</p>
                      <ul className="space-y-2">
                        {roadmap.products.map((product, j) => (
                          <li key={j} className="text-gray-700 flex items-start gap-3">
                            <span className="text-green-600 font-bold">•</span>
                            {product}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <p className="font-bold text-gray-900 text-sm mb-1">🌍 Markets</p>
                        <p className="text-gray-700">{roadmap.markets}</p>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm mb-1">💰 CapEx</p>
                        <p className="text-gray-700">{roadmap.capex}</p>
                      </div>
                      <div className="p-4 bg-green-100 border border-green-300 rounded-lg">
                        <p className="font-bold text-gray-900 text-sm mb-1">📈 Projected Revenue</p>
                        <p className="text-2xl font-bold text-green-700">{roadmap.projectedRevenue}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Success Metrics & KPIs */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <div className="inline-block mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold">
                PERFORMANCE TRACKING
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Key Success Metrics & Performance Indicators
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-12 mb-12">
              <div className="bg-white rounded-xl p-10 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">💼 Business Metrics</h3>
                <div className="space-y-4">
                  {[
                    { metric: 'Revenue Growth (Year-over-Year)', target: '85% CAGR', measurement: 'Quarterly financial reports' },
                    { metric: 'Production Capacity Utilization', target: '90%+ by Year 3', measurement: 'Manufacturing dashboards' },
                    { metric: 'Gross Profit Margin', target: '65% (vs. 45% industry avg)', measurement: 'Monthly P&L' },
                    { metric: 'Customer Acquisition Cost (CAC)', target: '$2 per unit (wholesale)', measurement: 'Marketing analytics' },
                    { metric: 'Market Penetration Rate', target: '8% of target markets by Year 5', measurement: 'Sales data' },
                    { metric: 'Export Market Share', target: '$500M+ of $48.8B market', measurement: 'Industry reports' }
                  ].map((item, i) => (
                    <div key={i} className="p-4 bg-gradient-to-r from-indigo-50 to-white rounded-lg border border-indigo-200">
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-bold text-gray-900">{item.metric}</p>
                        <p className="text-indigo-600 font-bold">{item.target}</p>
                      </div>
                      <p className="text-xs text-gray-600">{item.measurement}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl p-10 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">🌍 Impact Metrics</h3>
                <div className="space-y-4">
                  {[
                    { metric: 'Direct Jobs Created', target: '200+ by Year 1, 10,000+ by Year 5', measurement: 'HR systems' },
                    { metric: 'Farmer Family Income Increase', target: '3-4x baseline', measurement: 'Payment records' },
                    { metric: 'Women in Leadership', target: '40%+', measurement: 'Organizational charts' },
                    { metric: 'Educational Scholarships', target: '1,000+ per year by Year 3', measurement: 'Education program tracking' },
                    { metric: 'Carbon Reduction', target: 'Carbon neutral by 2030', measurement: 'Annual carbon audits' },
                    { metric: 'Forest Area Restored', target: '10,000 hectares by Year 5', measurement: 'Land surveys & monitoring' }
                  ].map((item, i) => (
                    <div key={i} className="p-4 bg-gradient-to-r from-green-50 to-white rounded-lg border border-green-200">
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-bold text-gray-900">{item.metric}</p>
                        <p className="text-green-600 font-bold text-sm">{item.target}</p>
                      </div>
                      <p className="text-xs text-gray-600">{item.measurement}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl p-12">
              <h3 className="text-2xl font-bold mb-8">📊 Quarterly Reporting Dashboard</h3>
              <div className="grid md:grid-cols-4 gap-6">
                <div>
                  <p className="text-indigo-100 font-semibold mb-2">Operational Health</p>
                  <ul className="text-sm space-y-1 text-indigo-50">
                    <li>✓ Production volume</li>
                    <li>✓ Capacity utilization</li>
                    <li>✓ Quality metrics</li>
                    <li>✓ Safety incidents</li>
                  </ul>
                </div>
                <div>
                  <p className="text-indigo-100 font-semibold mb-2">Financial Performance</p>
                  <ul className="text-sm space-y-1 text-indigo-50">
                    <li>✓ Revenue & EBITDA</li>
                    <li>✓ Unit economics</li>
                    <li>✓ Cash position</li>
                    <li>✓ Growth rates</li>
                  </ul>
                </div>
                <div>
                  <p className="text-indigo-100 font-semibold mb-2">Community Impact</p>
                  <ul className="text-sm space-y-1 text-indigo-50">
                    <li>✓ Farmer income</li>
                    <li>✓ Jobs created</li>
                    <li>✓ Scholarships awarded</li>
                    <li>✓ Community programs</li>
                  </ul>
                </div>
                <div>
                  <p className="text-indigo-100 font-semibold mb-2">Sustainability</p>
                  <ul className="text-sm space-y-1 text-indigo-50">
                    <li>✓ Carbon footprint</li>
                    <li>✓ Waste reduction</li>
                    <li>✓ Water usage</li>
                    <li>✓ Land restored</li>
                  </ul>
                </div>
              </div>
              <p className="mt-8 text-indigo-100 text-sm">All metrics published publicly on currency.ph quarterly. Third-party audit verification available annually.</p>
            </div>
          </div>
        </section>

        {/* Regional Market Strategy */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <div className="inline-block mb-4 px-4 py-2 bg-cyan-100 text-cyan-700 rounded-full text-sm font-semibold">
                MARKET EXPANSION
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Regional Market Entry Strategy (Year 1-3)
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  region: '🌏 Southeast Asia',
                  focus: 'Domestic & Regional Hub',
                  markets: ['Philippines', 'Vietnam', 'Thailand', 'Indonesia', 'Malaysia'],
                  timeline: 'Q1-Q3 2025',
                  strategy: 'Direct distribution partnerships with major retailers (Lotus, BigC, SM). Domestic positioning as national brand.',
                  target: '$12M Year 1, $35M by Year 3',
                  challenges: 'Local competition, logistics complexity'
                },
                {
                  region: '🌎 North America',
                  focus: 'Health & Wellness Premium Market',
                  markets: ['USA', 'Canada'],
                  timeline: 'Q2-Q4 2025',
                  strategy: 'Distribution through Whole Foods, Natural Grocers, Amazon Fresh. Social media marketing targeting health influencers.',
                  target: '$8M Year 1, $28M by Year 3',
                  challenges: 'FDA regulatory complexity, shipping costs, brand awareness'
                },
                {
                  region: '🌍 Europe',
                  focus: 'Sustainability & Fair Trade',
                  markets: ['Germany', 'UK', 'France', 'Netherlands', 'Scandinavia'],
                  timeline: 'Q3-Q4 2025',
                  strategy: 'Position on sustainability & transparency. Partner with organic retailers, e-commerce platforms (Ocado, Naturalia). Certifications (Fair Trade, Organic EU).',
                  target: '$4M Year 1, $20M by Year 3',
                  challenges: 'EU regulations, premium pricing acceptance, sustainability claims verification'
                },
                {
                  region: '🌐 Middle East & Africa',
                  focus: 'Premium Positioning',
                  markets: ['UAE', 'Saudi Arabia', 'Egypt', 'South Africa'],
                  timeline: 'Q4 2025 - Q2 2026',
                  strategy: 'Luxury retail partnerships. Emphasis on health benefits & exotic positioning. Halal certification.',
                  target: '$2M Year 1, $15M by Year 3',
                  challenges: 'Import logistics, distribution infrastructure, regulatory compliance'
                },
                {
                  region: '🎯 Australia & Oceania',
                  focus: 'Health & Beach Lifestyle',
                  markets: ['Australia', 'New Zealand'],
                  timeline: 'Q1-Q2 2026',
                  strategy: 'Partner with health food retailers & sports nutrition channels. Emphasize natural hydration & performance benefits.',
                  target: '$1.5M Year 1, $10M by Year 3',
                  challenges: 'Shipping costs, local competition, market education'
                },
                {
                  region: '📱 E-Commerce Global',
                  focus: 'Direct-to-Consumer Channel',
                  markets: 'All regions simultaneously',
                  timeline: 'Ongoing (Q1 2025 launch)',
                  strategy: 'Amazon Global, Alibaba, Shopify store. Content marketing on sustainability story. Influencer partnerships (nutrition, sustainability).',
                  target: '$1M Year 1, $12M by Year 3',
                  challenges: 'Logistics costs, product damage during shipping, competitive pricing'
                }
              ].map((item, i) => (
                <div key={i} className="bg-white rounded-xl p-8 border border-gray-200 hover:shadow-lg transition-shadow">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{item.region}</h3>
                  <p className="text-amber-600 font-bold mb-4">{item.focus}</p>

                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="font-semibold text-gray-900">Markets:</p>
                      <p className="text-gray-700">{Array.isArray(item.markets) ? item.markets.join(', ') : item.markets}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Timeline:</p>
                      <p className="text-gray-700">{item.timeline}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Strategy:</p>
                      <p className="text-gray-700">{item.strategy}</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded border border-blue-200">
                      <p className="font-semibold text-gray-900">Target Revenue:</p>
                      <p className="text-blue-700 font-bold">{item.target}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-xs">Key Challenges:</p>
                      <p className="text-gray-700 text-xs">{item.challenges}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Investment Terms & Legal Structure */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <div className="inline-block mb-4 px-4 py-2 bg-gray-700 text-white rounded-full text-sm font-semibold">
                INVESTMENT STRUCTURE
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Investment Terms & Legal Framework
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-12 mb-12">
              <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-10 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">💼 Investment Options</h3>
                <div className="space-y-4">
                  {[
                    {
                      type: 'Impact Investor Equity',
                      minimum: '$50,000',
                      terms: '15-25% equity return expected; Annual dividends from Year 2',
                      structure: 'Preferred shares with board observation rights',
                      liquidation: '7-10 year hold, exit at Year 5-7'
                    },
                    {
                      type: 'Strategic Partner Investment',
                      minimum: '$200,000+',
                      terms: 'Custom structure; Operations synergy expected',
                      structure: 'Common or preferred shares + partnership agreement',
                      liquidation: 'Flexible terms, often buyback post-profitability'
                    },
                    {
                      type: 'Farmer/Supplier Equity',
                      minimum: 'Land/equipment contribution',
                      terms: '2-5% net profit sharing + purchase guarantees',
                      structure: 'Cooperative equity model + contract',
                      liquidation: 'Indefinite until chose to exit'
                    },
                    {
                      type: 'Debt Facility (Optional)',
                      minimum: '$500,000+',
                      terms: '8% fixed rate, 5-year amortization',
                      structure: 'Senior secured debt against assets + cash flow',
                      liquidation: 'Fixed repayment schedule'
                    }
                  ].map((option, i) => (
                    <div key={i} className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
                      <p className="font-bold text-gray-900 mb-3">{option.type}</p>
                      <div className="space-y-2 text-sm text-gray-700">
                        <p><span className="font-semibold">Min. Investment:</span> {option.minimum}</p>
                        <p><span className="font-semibold">Expected Returns:</span> {option.terms}</p>
                        <p><span className="font-semibold">Structure:</span> {option.structure}</p>
                        <p><span className="font-semibold">Exit Path:</span> {option.liquidation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-white rounded-xl p-10 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">⚖️ Legal & Governance</h3>
                <div className="space-y-4">
                  {[
                    { item: 'Corporate Structure', detail: 'Philippine C-Corporation (registered with SEC) with international subsidiary options' },
                    { item: 'Governing Documents', detail: 'Articles of Incorporation, Bylaws, Shareholder Agreement, Board Charter' },
                    { item: 'Compliance', detail: 'Philippines BIR approved, RCBC banking partner, regular external audits' },
                    { item: 'Insurance', detail: 'Directors & Officers liability, Product liability, Key person insurance' },
                    { item: 'Dispute Resolution', detail: 'Internal arbitration, Singapore LCIA if international' },
                    { item: 'Currency.ph Integration', detail: 'All equity & payment flows through currency.ph platform for transparency' }
                  ].map((item, i) => (
                    <div key={i} className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="font-bold text-gray-900">{item.item}</p>
                      <p className="text-gray-700 text-sm mt-2">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-12">
              <h3 className="text-2xl font-bold mb-8">📋 Investor Protections & Rights</h3>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <p className="font-bold mb-4">Minority Investor Rights</p>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-3">
                      <span className="text-blue-100 mt-1">✓</span>
                      <span>Proportional voting on major decisions (strategic changes, dividends, exits)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-100 mt-1">✓</span>
                      <span>Information rights: Monthly operations, quarterly audited financials, annual impact reports</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-100 mt-1">✓</span>
                      <span>Board observation rights (positions ≥2%)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-100 mt-1">✓</span>
                      <span>Anti-dilution protection (weighted average)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-100 mt-1">✓</span>
                      <span>Liquidation preference (1x non-participating preferred)</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <p className="font-bold mb-4">Transparency & Accountability</p>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-3">
                      <span className="text-blue-100 mt-1">✓</span>
                      <span>Real-time dashboard on currency.ph: equity ownership, revenue, profit allocation</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-100 mt-1">✓</span>
                      <span>Blockchain-verified supply chain data: farm-to-retail visibility</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-100 mt-1">✓</span>
                      <span>Annual third-party impact audit (SDG metrics)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-100 mt-1">✓</span>
                      <span>All board votes & decisions published within 48 hours</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-100 mt-1">✓</span>
                      <span>Whistleblower protection & ethics hotline</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="mb-16 text-center">
              <div className="inline-block mb-4 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
                FREQUENTLY ASKED QUESTIONS
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Common Questions About Coconuts.com.ph
              </h2>
            </div>

            <div className="space-y-6">
              {[
                {
                  q: 'What\'s the minimum investment amount?',
                  a: 'We accept investments starting at $50,000 for impact investors. Farmer contributions can start from land/equipment value at much lower entry points. Strategic partnerships have custom structures. Equity tokens can be as small as 0.1% stakes.'
                },
                {
                  q: 'How are dividends distributed?',
                  a: 'Quarterly dividends calculated on net profit after operational expenses. Distributed automatically via currency.ph wallets within 15 days of quarter-end. Farmers receive monthly advance payments from purchases.'
                },
                {
                  q: 'What happens if we don\'t meet production targets?',
                  a: 'Projections are conservative (2.4M units Year 1). Even at 70% capacity, unit economics remain solid. Investor agreements include downside protection clauses. Farmer contracts have minimum price floors regardless of volume.'
                },
                {
                  q: 'Who controls the company?',
                  a: 'Founder retains 5% with veto rights on core governance. Equity distributed per stakeholder investment. Board of 7 with farmer, impact, and investor representatives. All major decisions voted on by stakeholder council (quarterly).'
                },
                {
                  q: 'Can I sell my equity stake?',
                  a: 'Yes. Secondary market available on currency.ph platform. First refusal rights given to existing stakeholders. Annual liquidity windows after Year 2. Strategic exit or buyback options in years 5-7.'
                },
                {
                  q: 'What if political/economic conditions change?',
                  a: 'We have diversified geographic exposure (50+ export markets). Long-term farmer contracts are inflation-adjusted. Currency.ph integration provides hedging on forex volatility. 5-year conservative business model accounts for cycles.'
                },
                {
                  q: 'How do I track my returns transparently?',
                  a: 'Real-time dashboard on currency.ph shows: your equity %, monthly production, revenue, expenses, profit allocation. Monthly investor reports + quarterly audited financials. Live supply chain tracking on blockchain.'
                },
                {
                  q: 'What\'s the exit timeline?',
                  a: 'No forced exit. Strategic acquisition most likely Year 5-7 (typical food/beverage multiples 8-12x EBITDA). IPO possible given scale. Dividend streams sustainable indefinitely. Buyback program from cash flows starting Year 3.'
                }
              ].map((item, i) => (
                <details key={i} className="group border-b border-gray-200 pb-6">
                  <summary className="cursor-pointer flex items-start gap-4 font-bold text-lg text-gray-900 hover:text-amber-600 transition">
                    <span className="text-2xl group-open:rotate-180 transition-transform">+</span>
                    {item.q}
                  </summary>
                  <p className="mt-4 ml-12 text-gray-700 leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Platform & Ecosystem Expansion */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-indigo-50 to-purple-50">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <div className="inline-block mb-4 px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                🌐 COCONUTS.COM.PH ECOSYSTEM
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                From Farm to Global Platform: Coconuts.com.ph as a Digital Marketplace
              </h2>
              <p className="text-xl text-gray-700 max-w-4xl">
                Coconuts.com.ph transcends a single company—it's a comprehensive digital ecosystem connecting farmers, manufacturers, distributors, investors, and consumers globally through transparent supply chain management and decentralized governance.
              </p>
            </div>

            <div className="space-y-8 mb-12">
              {/* Tier 1: Direct B2B Marketplace */}
              <div className="bg-white rounded-xl p-10 border-2 border-indigo-200 shadow-lg">
                <div className="flex items-start gap-4 mb-6">
                  <span className="text-4xl">🏪</span>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Tier 1: Direct B2B Marketplace</h3>
                    <p className="text-gray-600 mt-1">Farm-to-Factory Direct Integration</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="p-4 bg-indigo-50 rounded-lg">
                    <p className="font-bold text-gray-900 mb-2">For Farmers</p>
                    <ul className="text-sm text-gray-700 space-y-2">
                      <li>✓ List harvest capacity & specs</li>
                      <li>✓ Receive bids from manufacturers</li>
                      <li>✓ Smart contract agreements</li>
                      <li>✓ Quality verification & payments</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="font-bold text-gray-900 mb-2">For Manufacturers</p>
                    <ul className="text-sm text-gray-700 space-y-2">
                      <li>✓ Source raw materials at scale</li>
                      <li>✓ Vetted farmer networks</li>
                      <li>✓ Batch scheduling & logistics</li>
                      <li>✓ Quality guarantees & traceability</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-pink-50 rounded-lg">
                    <p className="font-bold text-gray-900 mb-2">Revenue Model</p>
                    <ul className="text-sm text-gray-700 space-y-2">
                      <li>✓ 2-3% commission per transaction</li>
                      <li>✓ Premium verification fees</li>
                      <li>✓ API access tiers</li>
                      <li>✓ Projected Year 5: $5-8M annually</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Tier 2: Logistics & Cold Chain */}
              <div className="bg-white rounded-xl p-10 border-2 border-blue-200 shadow-lg">
                <div className="flex items-start gap-4 mb-6">
                  <span className="text-4xl">🚚</span>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Tier 2: Integrated Logistics Network</h3>
                    <p className="text-gray-600 mt-1">Port & Supply Chain Optimization</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <p className="font-bold text-gray-900 mb-4">Platform Features</p>
                    <ul className="space-y-3">
                      {[
                        'Real-time port availability & pricing',
                        'Cold chain logistics coordination',
                        'Customs & documentation automation',
                        'Shipment tracking (blockchain-verified)',
                        'Insurance & liability management',
                        'Multi-carrier rate comparison'
                      ].map((feature, i) => (
                        <li key={i} className="flex gap-3 text-gray-700">
                          <span className="text-blue-600 font-bold">▸</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-6">
                    <p className="font-bold text-gray-900 mb-4">Projected Growth</p>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-600">Year 1 Volume</p>
                        <p className="text-2xl font-bold text-blue-600">2.4M units</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Year 5 Potential</p>
                        <p className="text-2xl font-bold text-blue-600">100M+ units</p>
                        <p className="text-xs text-gray-600 mt-1">(Through 3rd-party sellers)</p>
                      </div>
                      <div className="border-t pt-4">
                        <p className="text-sm text-gray-600">Revenue Target (Year 5)</p>
                        <p className="text-xl font-bold text-blue-600">$12-18M</p>
                        <p className="text-xs text-gray-600 mt-1">From commission & services</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tier 3: Retail & DTC */}
              <div className="bg-white rounded-xl p-10 border-2 border-green-200 shadow-lg">
                <div className="flex items-start gap-4 mb-6">
                  <span className="text-4xl">🛍️</span>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Tier 3: B2C & Retail Marketplace</h3>
                    <p className="text-gray-600 mt-1">DTC & Retail Partner Channel</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="font-bold text-gray-900 mb-3">🌍 Global Retail Partners</p>
                    <p className="text-sm text-gray-700 mb-4">White-label fulfillment through Coconuts platform for partner brands</p>
                    <p className="text-xs text-green-700 font-semibold">Commission: 8-12% of retail sales</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="font-bold text-gray-900 mb-3">📱 Direct-to-Consumer App</p>
                    <p className="text-sm text-gray-700 mb-4">Coconuts.com.ph app for consumers to buy directly from manufacturers</p>
                    <p className="text-xs text-blue-700 font-semibold">Commission: 3-5% per transaction</p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="font-bold text-gray-900 mb-3">🤝 Affiliate Network</p>
                    <p className="text-sm text-gray-700 mb-4">Influencers and wellness brands promote through affiliate links</p>
                    <p className="text-xs text-amber-700 font-semibold">Commission: 5-15% per referral</p>
                  </div>
                </div>
              </div>

              {/* Tier 4: Technology & Data */}
              <div className="bg-white rounded-xl p-10 border-2 border-orange-200 shadow-lg">
                <div className="flex items-start gap-4 mb-6">
                  <span className="text-4xl">⚙️</span>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Tier 4: Technology Services & Data</h3>
                    <p className="text-gray-600 mt-1">SaaS, APIs, and Market Intelligence</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <p className="font-bold text-gray-900 mb-4 text-lg">Premium Features (SaaS)</p>
                    <div className="space-y-3">
                      {[
                        { name: 'Enterprise Dashboard', price: '$500-2,000/mo' },
                        { name: 'API Access (Premium)', price: '$1,000-5,000/mo' },
                        { name: 'Custom Integration', price: '$5,000-50,000/project' },
                        { name: 'Market Intelligence Reports', price: '$200-1,000/report' },
                        { name: 'Blockchain Certification', price: '$1,000-10,000/batch' },
                        { name: 'White-Label Solutions', price: 'Custom licensing' }
                      ].map((item, i) => (
                        <div key={i} className="p-3 bg-orange-50 rounded border border-orange-200">
                          <div className="flex justify-between items-start">
                            <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
                            <p className="text-xs text-orange-700 font-bold">{item.price}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-6">
                    <p className="font-bold text-gray-900 mb-4">Projected SaaS Revenue (Year 5)</p>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-600">Active Users (SaaS)</p>
                        <p className="text-3xl font-bold text-orange-600">5,000+</p>
                      </div>
                      <div className="border-t border-amber-300 pt-4">
                        <p className="text-sm text-gray-600">Annual Recurring Revenue</p>
                        <p className="text-2xl font-bold text-orange-600">$8-12M</p>
                      </div>
                      <div className="bg-white rounded p-4">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Growth Drivers</p>
                        <ul className="text-xs space-y-1 text-gray-700">
                          <li>• Increasing data complexity</li>
                          <li>• Compliance requirements</li>
                          <li>• Integration demand</li>
                          <li>• International expansion</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tier 5: Financial Services */}
              <div className="bg-white rounded-xl p-10 border-2 border-pink-200 shadow-lg">
                <div className="flex items-start gap-4 mb-6">
                  <span className="text-4xl">💳</span>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Tier 5: Embedded Finance & Risk Management</h3>
                    <p className="text-gray-600 mt-1">Crop Insurance, Trade Finance, Working Capital Solutions</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="p-6 bg-gradient-to-br from-pink-50 to-red-50 rounded-lg border border-pink-200">
                    <p className="font-bold text-gray-900 mb-4">🌦️ Crop Insurance</p>
                    <p className="text-sm text-gray-700 mb-4">Weather-indexed insurance for farmers ($0.5-2M annual premiums)</p>
                    <p className="font-semibold text-pink-700">Revenue: 15% commission</p>
                  </div>
                  <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <p className="font-bold text-gray-900 mb-4">📋 Trade Finance</p>
                    <p className="text-sm text-gray-700 mb-4">Pre-export financing & letters of credit ($5-20M facility)</p>
                    <p className="font-semibold text-blue-700">Revenue: 2-3% per transaction</p>
                  </div>
                  <div className="p-6 bg-gradient-to-br from-green-50 to-teal-50 rounded-lg border border-green-200">
                    <p className="font-bold text-gray-900 mb-4">💰 Working Capital</p>
                    <p className="text-sm text-gray-700 mb-4">Supply chain financing for partners ($10-50M facility)</p>
                    <p className="font-semibold text-green-700">Revenue: 1-2% annual servicing</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl p-12">
              <h3 className="text-3xl font-bold mb-8">🎯 Ecosystem Economics: The Full Picture</h3>
              <div className="grid md:grid-cols-4 gap-6">
                <div>
                  <p className="text-purple-200 font-semibold mb-2">Year 5 Total Platform Revenue</p>
                  <p className="text-4xl font-bold">$45-52M</p>
                  <p className="text-sm text-purple-100 mt-2">(Beyond core coconut products)</p>
                </div>
                <div>
                  <p className="text-purple-200 font-semibold mb-2">Volume Multiplier</p>
                  <p className="text-4xl font-bold">10-50x</p>
                  <p className="text-sm text-purple-100 mt-2">3rd party sellers using platform</p>
                </div>
                <div>
                  <p className="text-purple-200 font-semibold mb-2">Active Users</p>
                  <p className="text-4xl font-bold">50K+</p>
                  <p className="text-sm text-purple-100 mt-2">Farmers, manufacturers, investors</p>
                </div>
                <div>
                  <p className="text-purple-200 font-semibold mb-2">Exit Valuation Potential</p>
                  <p className="text-4xl font-bold">$500M+</p>
                  <p className="text-sm text-purple-100 mt-2">As a platform/marketplace company</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-amber-600 to-orange-600">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Ready to Join the Movement?</h2>
            <p className="text-xl text-amber-50 mb-8 max-w-2xl mx-auto leading-relaxed">
              Transparent commerce with real impact. Invest in coconuts.com.ph and align your capital with sustainable growth, fair farming practices, and community development.
            </p>

            {!isAuthenticated && (
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <button
                  onClick={() => setShowAuthModalOnDemand(true)}
                  className="px-8 py-4 bg-white text-amber-600 font-bold rounded-lg hover:bg-amber-50 transition-all transform hover:scale-105 shadow-lg text-lg"
                >
                  Register & Get Started
                </button>
                <button
                  onClick={() => setShowAuthModalOnDemand(true)}
                  className="px-8 py-4 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg transition-colors border-2 border-white text-lg"
                >
                  Sign In to Dashboard
                </button>
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-6 mt-12">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
                <div className="text-3xl mb-3">🌾</div>
                <h3 className="font-bold text-white mb-2">For Farmers</h3>
                <p className="text-amber-50 text-sm">Get guaranteed pricing, direct payments, and equity stake in the enterprise</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
                <div className="text-3xl mb-3">💰</div>
                <h3 className="font-bold text-white mb-2">For Investors</h3>
                <p className="text-amber-50 text-sm">15-25% equity returns + dividends from Year 2, transparent real-time tracking</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
                <div className="text-3xl mb-3">🤝</div>
                <h3 className="font-bold text-white mb-2">For Partners</h3>
                <p className="text-amber-50 text-sm">Integrated logistics, supply chain visibility, and margin-sharing opportunities</p>
              </div>
            </div>

            <p className="mt-12 text-amber-50 text-sm">
              Powered by <span className="font-bold text-white">currency.ph</span> for transparent multi-currency transactions, real-time reporting, and blockchain-verified supply chain integrity.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
