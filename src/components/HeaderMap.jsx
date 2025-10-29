import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { useGeolocation } from '../lib/useGeolocation'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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
    if (location) {
      map.setView([location.latitude, location.longitude], 13)
    }
  }, [location, map])

  return null
}

export default function HeaderMap() {
  const { location, error, loading, city } = useGeolocation()
  const [isExpanded, setIsExpanded] = useState(false)

  // Default to Philippines center
  const defaultLocation = { latitude: 12.5, longitude: 121.5 }
  const displayLocation = location || defaultLocation

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
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-xs text-slate-600 font-medium">
                {city || `${displayLocation.latitude.toFixed(2)}, ${displayLocation.longitude.toFixed(2)}`}
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

            <div className="h-96 bg-slate-100">
              {!loading && !error && location ? (
                <MapContainer
                  center={[location.latitude, location.longitude]}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                  />
                  <Marker position={[location.latitude, location.longitude]}>
                    <Popup>
                      <div className="text-sm">
                        <div className="font-semibold">Your Location</div>
                        <div className="text-xs text-slate-600 mt-1">
                          {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                        </div>
                        {city && <div className="text-xs font-medium text-slate-700 mt-1">{city}</div>}
                      </div>
                    </Popup>
                  </Marker>
                  <MapUpdater location={location} />
                </MapContainer>
              ) : (
                <div className="h-full flex items-center justify-center flex-col gap-2">
                  {loading && (
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
                  {error && (
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
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                Real-time tracking enabled. Updates automatically as you move.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
