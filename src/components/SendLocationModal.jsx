import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { searchUsers, sendLocationMessage } from '../lib/messages'
import { getRoute, getDistance, formatDistance, createRoutePolyline, parseDirectionSteps } from '../lib/routingService'
import { supabase } from '../lib/supabaseClient'

// Fix Leaflet icon issues
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Colored marker for destination
const createColoredMarker = (color) => {
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32" height="32">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
    </svg>
  `
  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svgIcon)}`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  })
}

function MapUpdater({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [bounds, map])
  return null
}

export default function SendLocationModal({ open, onClose, location, city, senderId }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [searching, setSearching] = useState(false)
  const [showDirections, setShowDirections] = useState(false)
  const [route, setRoute] = useState(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [directions, setDirections] = useState([])
  const [recipientLocation, setRecipientLocation] = useState(null)
  const [showSteps, setShowSteps] = useState(false)

  // Search users
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([])
      return
    }
    
    let mounted = true
    setSearching(true)
    
    searchUsers(query)
      .then(r => {
        if (mounted) {
          setResults(r || [])
        }
      })
      .catch(err => {
        if (mounted) {
          console.error('Search error:', err)
          setResults([])
        }
      })
      .finally(() => {
        if (mounted) setSearching(false)
      })
    
    return () => { mounted = false }
  }, [query])

  // Fetch recipient location and calculate route when user is selected
  useEffect(() => {
    if (!selectedUser || !location) {
      setRoute(null)
      setRecipientLocation(null)
      setDirections([])
      return
    }

    const fetchRouteData = async () => {
      setRouteLoading(true)
      setError('')
      
      try {
        // Fetch recipient's presence location if available
        const { data: presenceData, error: presenceError } = await supabase
          .from('presence')
          .select('latitude,longitude,city')
          .eq('user_id', selectedUser.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single()

        if (presenceData && presenceData.latitude && presenceData.longitude) {
          setRecipientLocation({
            latitude: presenceData.latitude,
            longitude: presenceData.longitude,
            city: presenceData.city
          })

          // Calculate route from sender to recipient
          const routeData = await getRoute(
            location.latitude,
            location.longitude,
            presenceData.latitude,
            presenceData.longitude
          )

          if (routeData.success) {
            setRoute(routeData)
            setDirections(parseDirectionSteps(routeData.steps))
            setShowDirections(true)
          } else {
            setError(`Could not calculate route: ${routeData.error}`)
            setShowDirections(false)
          }
        } else {
          // Recipient location not available, just show sender location
          setRecipientLocation(null)
          setRoute(null)
          setDirections([])
          setShowDirections(false)
        }
      } catch (err) {
        console.error('Route fetch error:', err)
        setError('Could not load route information')
        setShowDirections(false)
      } finally {
        setRouteLoading(false)
      }
    }

    fetchRouteData()
  }, [selectedUser, location])

  if (!open) return null

  const handleSend = async () => {
    if (!selectedUser) return setError('Please select a recipient')
    if (!location) return setError('Location not available')
    if (!senderId) return setError('Sender ID not available')
    
    setError('')
    setSending(true)
    
    try {
      const mapLink = `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=13/${location.latitude}/${location.longitude}`
      await sendLocationMessage({ 
        senderId, 
        recipientId: selectedUser.id, 
        location, 
        city, 
        mapLink 
      })
      setQuery('')
      setSelectedUser(null)
      setRoute(null)
      setRecipientLocation(null)
      setDirections([])
      setSending(false)
      onClose()
    } catch (err) {
      console.error('Send error:', err)
      setError(err.message || 'Failed to send location')
      setSending(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 overflow-auto"
      onClick={onClose}
      style={{ pointerEvents: 'auto' }}
    >
      <div 
        className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col my-auto"
        onClick={e => e.stopPropagation()}
        style={{ pointerEvents: 'auto' }}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <h3 className="text-lg font-semibold text-slate-900">Send Location</h3>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-slate-100 rounded transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-sm text-slate-600 mb-4">
            Share your location with a friend. They'll receive a map link and directions.
          </p>

          {/* User Search */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-700 mb-2">Search for a friend</label>
            <div className="relative">
              <input 
                value={query} 
                onChange={e => setQuery(e.target.value)} 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter name or email (min 2 characters)"
                disabled={sending}
              />
              {searching && (
                <div className="absolute right-3 top-2.5">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>

            {/* Search Results */}
            {results.length > 0 && (
              <ul className="mt-2 border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto bg-white">
                {results.map(u => (
                  <li 
                    key={u.id} 
                    className={`px-3 py-2 cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors ${
                      selectedUser && selectedUser.id === u.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                    }`} 
                    onClick={() => setSelectedUser(u)}
                  >
                    <div className="text-sm font-medium text-slate-900">{u.full_name || 'Unknown'}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </li>
                ))}
              </ul>
            )}

            {query.length > 0 && query.length < 2 && (
              <p className="mt-2 text-xs text-slate-500">Type at least 2 characters to search</p>
            )}

            {query.length >= 2 && results.length === 0 && !searching && (
              <p className="mt-2 text-xs text-slate-500">No users found</p>
            )}
          </div>

          {/* Selected User Display */}
          {selectedUser && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
              <p className="text-xs text-slate-600 mb-1">Sending to:</p>
              <p className="text-sm font-medium text-slate-900">{selectedUser.full_name || selectedUser.email}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-100 border-l-4 border-red-500 rounded-lg mb-4">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">Error</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Route Loading */}
          {routeLoading && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4 flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              <p className="text-sm text-blue-700">Calculating route...</p>
            </div>
          )}

          {/* Map with Route */}
          {location && (
            <div className="mb-4 border border-slate-200 rounded-lg overflow-hidden">
              <div className="h-64 bg-slate-100">
                <MapContainer
                  center={[location.latitude, location.longitude]}
                  zoom={14}
                  style={{ height: '100%', width: '100%' }}
                  attributionControl={false}
                  keyboard={false}
                  dragging={false}
                  doubleClickZoom={false}
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap'
                  />
                  
                  {/* Route polyline */}
                  {showDirections && route && (
                    <Polyline
                      positions={createRoutePolyline(route.coordinates)}
                      color="#3b82f6"
                      weight={4}
                      opacity={0.7}
                    />
                  )}
                  
                  {/* Sender marker (green) */}
                  <Marker 
                    position={[location.latitude, location.longitude]}
                    icon={createColoredMarker('#22c55e')}
                  >
                    <Popup>
                      <div className="text-xs">
                        <p className="font-semibold text-green-700">Your Location</p>
                        <p className="text-slate-600">{city || 'Current Location'}</p>
                        <p className="text-xs text-slate-500 mt-1">{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p>
                      </div>
                    </Popup>
                  </Marker>

                  {/* Recipient marker (red) */}
                  {recipientLocation && (
                    <Marker 
                      position={[recipientLocation.latitude, recipientLocation.longitude]}
                      icon={createColoredMarker('#ef4444')}
                    >
                      <Popup>
                        <div className="text-xs">
                          <p className="font-semibold text-red-700">{selectedUser?.full_name || 'Friend'}</p>
                          <p className="text-slate-600">{recipientLocation.city || 'Current Location'}</p>
                          <p className="text-xs text-slate-500 mt-1">{recipientLocation.latitude.toFixed(6)}, {recipientLocation.longitude.toFixed(6)}</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}

                  <MapUpdater bounds={
                    route && recipientLocation ? [
                      [location.latitude, location.longitude],
                      [recipientLocation.latitude, recipientLocation.longitude]
                    ] : null
                  } />
                </MapContainer>
              </div>
            </div>
          )}

          {/* Route Summary */}
          {showDirections && route && route.summary && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg mb-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-slate-600 font-medium">Distance</p>
                  <p className="text-lg font-bold text-slate-900">{route.summary.distanceKm} km</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 font-medium">Duration</p>
                  <p className="text-lg font-bold text-slate-900">{route.summary.durationFormatted}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 font-medium">ETA</p>
                  <p className="text-lg font-bold text-slate-900">{formatETA(route.duration)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Directions Toggle */}
          {showDirections && directions.length > 0 && (
            <button
              onClick={() => setShowSteps(!showSteps)}
              className="w-full px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors mb-4 flex items-center justify-between"
            >
              <span>{showSteps ? 'Hide' : 'Show'} Turn-by-turn Directions ({directions.length} steps)</span>
              <svg className={`w-4 h-4 transition-transform ${showSteps ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          )}

          {/* Turn-by-turn Directions */}
          {showSteps && directions.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 mb-4 max-h-48 overflow-y-auto">
              <ol className="divide-y divide-slate-200">
                {directions.map((step, idx) => (
                  <li key={idx} className="p-3 hover:bg-slate-100 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-medium">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{step.instruction}</p>
                        <p className="text-xs text-slate-600 mt-1">{step.name}</p>
                        <p className="text-xs text-slate-500 mt-1">{step.distanceFormatted} • {step.durationFormatted}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Location Info */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4">
            <p className="text-xs text-slate-600 mb-2">Your Location:</p>
            <div className="text-xs space-y-1">
              <div><span className="text-slate-600">Latitude:</span> <span className="font-mono text-slate-900">{location?.latitude?.toFixed(6)}</span></div>
              <div><span className="text-slate-600">Longitude:</span> <span className="font-mono text-slate-900">{location?.longitude?.toFixed(6)}</span></div>
              {city && <div><span className="text-slate-600">City:</span> <span className="font-mono text-slate-900">{city}</span></div>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2 justify-end flex-shrink-0">
          <button 
            onClick={onClose} 
            disabled={sending}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSend} 
            disabled={sending || !selectedUser || !location}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {sending && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>}
            {sending ? 'Sending...' : 'Send Location'}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatETA(durationSeconds) {
  const now = new Date()
  const eta = new Date(now.getTime() + durationSeconds * 1000)
  return eta.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}
