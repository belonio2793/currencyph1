import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { portRateCalculator } from '../lib/portRateCalculatorService'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
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

// Create colored marker icon for ports and products
function createColoredMarker(color = 'red') {
  const colorMap = {
    red: '#EF4444',
    blue: '#3B82F6',
    green: '#10B981',
    yellow: '#FBBF24',
    water: '#3B82F6',
    coconut: '#A16207',
    mango: '#CA8A04'
  }

  const markerColor = colorMap[color] || colorMap.red

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
    longitude: null
  })
  const [mapLayer, setMapLayer] = useState('street')
  const [showMapControls, setShowMapControls] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [selectedPortId, setSelectedPortId] = useState('')
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

  const messagesEndRef = useRef(null)
  const mapRef = useRef(null)

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

  // Load shipping ports (public, available to all users)
  useEffect(() => {
    loadShippingPorts()
    loadProducts()
    subscribeToProducts()
  }, [])

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

  // Initialize editing name when planning user loads
  useEffect(() => {
    if (planningUser?.name) {
      setEditingName(planningUser.name)
    }
  }, [planningUser])

  const checkAuth = async () => {
    try {
      const { data } = await supabase.auth.getSession()
      if (data?.session?.user) {
        setUserId(data.session.user.id)
        setUserEmail(data.session.user.email || '')
        setIsAuthenticated(true)
        await loadPlanningUser(data.session.user.id)
      } else {
        setIsAuthenticated(false)
        setPlanningUser(null)
        setUserEmail('')
      }
    } catch (error) {
      console.error('Auth check error:', error)
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
      console.error('Error loading planning user:', error)
      setPlanningUser(null)
    }
  }

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('planning_messages')
        .select('*, planning_users(name, email)')
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
        .select('*')
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
        .select('*, planning_users(id, name, email)')
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
      longitude: coords.longitude
    })
    setShowLocationForm(true)
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
      const payload = {
        planning_user_id: planningUser.id,
        user_id: userId,
        name: locationForm.name.trim(),
        description: locationForm.description.trim(),
        latitude: parseFloat(locationForm.latitude),
        longitude: parseFloat(locationForm.longitude)
      }

      console.debug('Saving marker with payload:', payload)

      const { data, error } = await supabase
        .from('planning_markers')
        .insert(payload)
        .select()

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
      setLocationForm({
        name: '',
        description: '',
        latitude: null,
        longitude: null
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
        console.error('Error deleting location:', error)
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
        .update({ name: editingName.trim(), updated_at: new Date().toISOString() })
        .eq('id', planningUser.id)

      if (error) {
        console.error('Profile update error:', error)
        setAuthError('Failed to update profile: ' + error.message)
        return
      }

      const newUser = { ...planningUser, name: editingName.trim() }
      setPlanningUser(newUser)
      setShowProfileSettings(false)
      setAuthError('')
    } catch (error) {
      console.error('Error updating profile:', error)
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

  const loadOrCreateConversation = async (otherUserId, otherUserData = null) => {
    try {
      // Try to find existing conversation
      const { data: existingConversations, error: fetchError } = await supabase
        .from('planning_conversations')
        .select('*')
        .or(`and(user1_id.eq.${userId},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${userId})`)

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
          console.error('Error creating conversation:', createError)
          setAuthError('Failed to open conversation')
          return
        }
        conversationId = newConversation.id
        existingConversation = newConversation
      } else {
        conversationId = existingConversation.id
      }

      setSelectedPrivateUserId(otherUserId)
      setSelectedPrivateUser(otherUserData)
      setSelectedConversationId(conversationId)
      setChatTab('private')
      await loadPrivateMessages(conversationId)
    } catch (error) {
      console.error('Error loading conversation:', error)
      setAuthError('Failed to open conversation')
    }
  }

  const loadPrivateMessages = async (conversationId) => {
    try {
      const { data, error } = await supabase
        .from('planning_private_messages')
        .select('*, planning_users(name, email)')
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
        console.error('Error sending private message:', error)
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
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Planning Group</h1>
            <p className="text-sm text-slate-400">Strategic partner coordination for manufacturing & distribution</p>
          </div>
          {isAuthenticated && (
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowProfileSettings(true)}
                className="text-slate-300 hover:text-white text-sm transition-colors"
                title="Edit profile"
              >
                {planningUser?.name || userEmail}
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>

        {/* Public Locations & Ports Dropdown */}
        <div className="flex items-center gap-3 flex-wrap">
          {locations.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="public-locations-select" className="text-slate-300 text-sm font-medium">Locations:</label>
              <select
                id="public-locations-select"
                value={selectedLocationId}
                onChange={handleLocationSelect}
                className="px-3 py-1 rounded text-sm bg-slate-700 text-white border border-slate-600 hover:border-slate-500 transition-colors cursor-pointer focus:outline-none focus:border-blue-400"
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
            <div className="flex items-center gap-2">
              <label htmlFor="shipping-ports-select" className="text-slate-300 text-sm font-medium">Ports:</label>
              <select
                id="shipping-ports-select"
                value={selectedPortId}
                onChange={handlePortSelect}
                className="px-3 py-1 rounded text-sm bg-slate-700 text-white border border-slate-600 hover:border-slate-500 transition-colors cursor-pointer focus:outline-none focus:border-blue-400"
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
        </div>
      </div>

      <div className="flex-1 flex gap-6 p-6 overflow-hidden">
        {/* Map Section */}
        <div className="flex-1 rounded-lg overflow-hidden border border-slate-700 bg-slate-800 flex flex-col">
          {/* Map Controls */}
          {isAuthenticated && (
            <div className="bg-slate-700 px-4 py-3 border-b border-slate-600 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-medium">{locations.length} locations</span>
                {locations.length > 0 && (
                  <select
                    value={selectedLocationId}
                    onChange={handleLocationSelect}
                    className="px-2 py-1 rounded text-xs font-medium bg-slate-600 text-white border border-slate-500 hover:bg-slate-500 transition-colors cursor-pointer focus:outline-none focus:border-blue-400"
                  >
                    <option value="">Jump to location...</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCenterPhilippines}
                  className="px-2 py-1 rounded text-xs font-medium bg-slate-600 hover:bg-slate-500 text-white transition-colors"
                  title="Center map on Philippines"
                >
                  🇵🇭
                </button>
                <button
                  onClick={handleZoomOut}
                  className="px-2 py-1 rounded text-xs font-medium bg-slate-600 hover:bg-slate-500 text-white transition-colors"
                  title="Zoom out"
                >
                  −
                </button>
                <button
                  onClick={handleZoomIn}
                  className="px-2 py-1 rounded text-xs font-medium bg-slate-600 hover:bg-slate-500 text-white transition-colors"
                  title="Zoom in"
                >
                  +
                </button>
                <button
                  onClick={() => setShowMapControls(!showMapControls)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    showMapControls
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-slate-600 hover:bg-slate-500 text-white'
                  }`}
                  title="Show/hide map layers"
                >
                  Layers
                </button>
                <button
                  onClick={() => {
                    setIsCreatingLocation(!isCreatingLocation)
                    if (!isCreatingLocation) setShowLocationForm(false)
                  }}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    isCreatingLocation
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-slate-600 hover:bg-slate-500 text-white'
                  }`}
                >
                  {isCreatingLocation ? '✓ Click map to add' : '+ Add Location'}
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
          <div className="flex-1 overflow-hidden">
            <MapContainer center={PHILIPPINES_CENTER} zoom={PHILIPPINES_ZOOM} className="w-full h-full" attributionControl={false}>
              <TileLayer
                url={getTileLayerUrl()}
                attribution=""
              />
              <MapRefHandler onMapReady={(map) => { mapRef.current = map }} />
              {isCreatingLocation && <MapClickHandler isCreating={isCreatingLocation} onLocationClick={handleMapLocationClick} />}
              {locations.map(loc => {
                const creatorName = loc.planning_users?.name || 'Unknown User'
                return (
                  <Marker key={`loc-${loc.id}`} position={[loc.latitude, loc.longitude]}>
                    <Popup>
                      <div className="p-2 min-w-48">
                        <h3 className="font-semibold text-sm">{loc.name}</h3>
                        {loc.description && <p className="text-xs text-slate-600 mt-1">{loc.description}</p>}
                        <p className="text-xs text-slate-500 mt-2">📍 {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}</p>
                        <p className="text-xs text-slate-500 mt-1">👤 Added by: <span className="text-blue-600 font-medium">{creatorName}</span></p>
                        {isAuthenticated && userId && loc.planning_users && (
                          <button
                            onClick={() => loadOrCreateConversation(loc.planning_users.id, loc.planning_users)}
                            className="mt-2 w-full px-2 py-1 rounded text-xs bg-blue-600 hover:bg-blue-700 text-white transition-colors mb-1"
                            title="Send private message"
                          >
                            Message
                          </button>
                        )}
                        {isAuthenticated && userId === loc.user_id && (
                          <button
                            onClick={() => handleDeleteLocation(loc.id)}
                            className="w-full px-2 py-1 rounded text-xs bg-red-600 hover:bg-red-700 text-white transition-colors"
                          >
                            Delete
                          </button>
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

                        <p className="text-xs text-slate-500 border-t pt-2">👤 {creatorName}</p>
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
        <div className="w-96 rounded-lg border border-slate-700 bg-slate-800 flex flex-col overflow-hidden">
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
                          <span className="text-slate-300 truncate">{user.name}</span>
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
            {messages.length === 0 ? (
              <div className="text-slate-500 text-center py-8 text-sm">
                No messages yet. Start the discussion!
              </div>
            ) : (
              messages.map(msg => {
                const userName = msg.planning_users?.name || (msg.planning_users && typeof msg.planning_users === 'object' && msg.planning_users[0]?.name) || 'Unknown'
                return (
                  <div key={msg.id} className="text-sm">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold text-blue-400">
                        {userName}
                      </span>
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
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="border-t border-slate-600 p-4 bg-slate-750">
            <div className="flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={sendMessage}
                disabled={!messageInput.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal Overlay */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-slate-800 rounded-lg p-8 border border-slate-700">
            <h1 className="text-3xl font-bold text-white mb-2 text-center">Planning Group</h1>
            <p className="text-slate-400 text-center mb-6 text-sm">Strategic partner coordination for manufacturing, facilities, and distribution</p>

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
    </div>
  )
}
