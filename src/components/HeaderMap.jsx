import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { useGeolocation } from '../lib/useGeolocation'
import { supabase } from '../lib/supabaseClient'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import SendLocationModal from './SendLocationModal'
import { preferencesManager } from '../lib/preferencesManager'
import { updatePresenceLocation } from '../lib/presence'

// Fix Leaflet icon issues
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function MapUpdater({ location }) {
  const map = useMap()

  useEffect(() => {
    // When a new location arrives, move the map
    if (location) {
      try {
        map.setView([location.latitude, location.longitude], 13)
      } catch (e) {
        console.debug('Map setView failed:', e)
      }
    }

    // Sometimes Leaflet needs invalidateSize when container becomes visible
    const tid = setTimeout(() => {
      try { map.invalidateSize() } catch (e) { /* ignore */ }
    }, 100)

    return () => clearTimeout(tid)
  }, [location, map])

  return null
}

function CenterButton({ location, fallback }) {
  const map = useMap()

  const handleCenter = () => {
    const loc = location || fallback
    if (!loc) return
    try {
      map.setView([loc.latitude, loc.longitude], 13)
      setTimeout(() => { try { map.invalidateSize() } catch (e) {} }, 50)
    } catch (e) {
      console.debug('CenterButton failed to set view', e)
    }
  }

  return (
    <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000 }}>
      <button
        onClick={handleCenter}
        title="Center map to your location"
        className="bg-white p-2 rounded shadow hover:bg-slate-50 border border-slate-200"
      >
        <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l2 2" />
        </svg>
      </button>
    </div>
  )
}

export default function HeaderMap({ userId: headerUserId }) {
  const { location, error, loading, city } = useGeolocation()
  const [isExpanded, setIsExpanded] = useState(false)
  const [shareEnabled, setShareEnabled] = useState(true)

  // Default to Philippines center
  const defaultLocation = { latitude: 12.5, longitude: 121.5 }
  const displayLocation = location || defaultLocation

  useEffect(() => {
    // Load preference from localStorage (preferencesManager)
    try {
      const prefs = preferencesManager.getAllPreferences(headerUserId)
      if (typeof prefs.locationSharing !== 'undefined') setShareEnabled(Boolean(prefs.locationSharing))
      else setShareEnabled(true)
    } catch (e) {
      setShareEnabled(true)
    }
  }, [headerUserId])

  // Update presence location when user location changes
  useEffect(() => {
    if (location && shareEnabled && headerUserId) {
      try {
        updatePresenceLocation({
          latitude: location.latitude,
          longitude: location.longitude,
          city: city
        })
      } catch (e) {
        console.warn('Failed to update presence location:', e)
      }
    }
  }, [location, shareEnabled, headerUserId, city])

  const toggleShare = () => {
    const next = !shareEnabled
    setShareEnabled(next)
    try {
      const prefs = preferencesManager.getAllPreferences(headerUserId) || {}
      prefs.locationSharing = next
      preferencesManager.setPreferences(headerUserId, prefs)
    } catch (e) {
      console.warn('Failed to save location sharing preference', e)
    }
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
      {/* Compact Status */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2">
          {loading ? (
            <>
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              <span className="text-xs text-slate-600">Locating...</span>
            </>
          ) : error ? (
            <>
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <span className="text-xs text-slate-600">Location unavailable</span>
            </>
          ) : (
            <>
              <div className={`w-2 h-2 rounded-full ${shareEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-xs text-slate-600 font-medium">
                {shareEnabled ? (city || `${displayLocation.latitude.toFixed(2)}, ${displayLocation.longitude.toFixed(2)}`) : 'Location sharing disabled'}
              </span>
            </>
          )}
        </div>

        {/* Expand Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="ml-2 p-1 hover:bg-slate-200 rounded transition-colors"
          title="Toggle map"
        >
          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isExpanded ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6v4m12-4h4v4M6 18h4v4m6-4h4v4" />
            )}
          </svg>
        </button>
      </div>

      {/* Expanded Map Modal */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Your Location
                {city && <span className="text-sm font-normal text-slate-600 ml-2">({city})</span>}
              </h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="h-96 bg-slate-100 relative">
              <MapContainer
                attributionControl={false}
                center={[displayLocation.latitude, displayLocation.longitude]}
                zoom={13}
                keyboard={false}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                />

                {/* Always show a draggable marker at the current markerPos (falls back to displayLocation) */}
                <DraggableMarker initialPos={displayLocation} onChange={(lat, lng) => {
                  // update local state below via setMarkerPos - handled in component
                }} />

                {/* Center button control - uses map instance via useMap */}
                <CenterButton location={location && shareEnabled ? location : null} fallback={displayLocation} />

                <MapUpdater location={location && shareEnabled ? location : null} />
              </MapContainer>

              {/* Overlay messages for loading / error */}
              {(loading || error || !shareEnabled) && (
                <div className="absolute inset-0 flex items-center justify-center flex-col gap-2 bg-white/60">
                  {!shareEnabled && (
                    <>
                      <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v2m0-10a9 9 0 110-18 9 9 0 010 18z" />
                      </svg>
                      <p className="text-slate-600 text-sm">Location sharing is disabled.</p>
                      <p className="text-slate-500 text-xs">Enable location sharing to see live updates and send location.</p>
                    </>
                  )}
                  {loading && shareEnabled && (
                    <>
                      <div className="animate-spin">
                        <svg
                          className="w-8 h-8 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                          />
                        </svg>
                      </div>
                      <p className="text-slate-600 text-sm">Determining your location...</p>
                      <p className="text-slate-500 text-xs">Please allow location access when prompted</p>
                    </>
                  )}
                  {error && shareEnabled && (
                    <>
                      <svg
                        className="w-8 h-8 text-red-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4v2m0 4v2m0-10a9 9 0 110-18 9 9 0 010 18z"
                        />
                      </svg>
                      <p className="text-slate-600 text-sm">{error}</p>
                      <p className="text-slate-500 text-xs">Enable location services in your browser settings</p>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${shareEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <div>{shareEnabled ? 'Real-time tracking enabled. Updates automatically as you move.' : 'Real-time tracking paused.'}</div>
                </div>
                <div>
                  <button
                    onClick={toggleShare}
                    className="px-3 py-1 bg-white border rounded text-sm"
                    aria-pressed={!shareEnabled}
                  >
                    {shareEnabled ? 'Disable Location Sharing' : 'Enable Location Sharing'}
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs text-slate-600">Share your location with a user</div>
              <div>
                <SendLocationButton location={displayLocation} city={city} userId={headerUserId} shareEnabled={shareEnabled} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


function SendLocationButton({ location, city, userId: userIdProp, shareEnabled = true }) {
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState(userIdProp || null)
  const [loading, setLoading] = useState(!userIdProp)

  useEffect(() => {
    if (userIdProp) return
    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) setUserId(user.id)
      } catch (e) {
        console.warn('Failed to fetch user ID:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [userIdProp])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={loading || !userId || !shareEnabled}
        className="px-3 py-2 bg-white border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Loading...' : !userId ? 'Login to share' : !shareEnabled ? 'Location sharing disabled' : 'Send Location'}
      </button>
      {open && userId && shareEnabled && <SendLocationModal open={open} onClose={() => setOpen(false)} location={location} city={city} senderId={userId} />}
    </>
  )
}
