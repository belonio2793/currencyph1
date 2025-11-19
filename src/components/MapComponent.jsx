import React, { useRef, useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getRouteSourceInfo } from '../lib/routingService'
import RoutePolyline from './RoutePolyline'

// Fix Leaflet icon issues
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

/**
 * Create enhanced custom markers with animated pinging circles (3-5 second delay)
 */
export const createEnhancedMarker = (color, label, status = 'active', size = 40, pulseColor = null) => {
  const pinSize = size * 1.5
  const dotSize = size * 0.45
  const pulseColorUsed = pulseColor || color

  // Create a unique style ID to avoid conflicts
  const styleId = `marker-style-${Math.random().toString(36).substr(2, 9)}`

  const html = `
    <div class="enhanced-marker-container" style="
      position: relative;
      width: ${pinSize * 2.2}px;
      height: ${pinSize * 2.2}px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <!-- Animated ping circles - outermost ring -->
      <div class="marker-ping marker-ping-outer" data-marker-color="${pulseColorUsed}" style="
        position: absolute;
        width: ${pinSize * 1.8}px;
        height: ${pinSize * 1.8}px;
        border-radius: 50%;
        background-color: ${pulseColorUsed}10;
        border: 2px solid ${pulseColorUsed}30;
        z-index: 1;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      "></div>

      <!-- Animated ping circles - middle ring -->
      <div class="marker-ping marker-ping-inner" data-marker-color="${pulseColorUsed}" style="
        position: absolute;
        width: ${pinSize * 1.3}px;
        height: ${pinSize * 1.3}px;
        border-radius: 50%;
        background-color: ${pulseColorUsed}15;
        border: 2px solid ${pulseColorUsed}50;
        z-index: 2;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      "></div>

      <!-- Main marker icon - centered -->
      <div class="marker-icon" style="
        position: relative;
        z-index: 3;
        cursor: pointer;
        filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4));
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      ">
        <svg viewBox="0 0 30 40" width="${pinSize}" height="${pinSize}" style="display: block;">
          <!-- Map pin shape -->
          <path d="M 15 0 C 8 0 2 6 2 13 C 2 22 15 40 15 40 C 15 40 28 22 28 13 C 28 6 22 0 15 0 Z"
                fill="${color}"
                stroke="white"
                stroke-width="2"
                filter="drop-shadow(0 2px 3px rgba(0,0,0,0.3))"/>
          <!-- Center dot -->
          <circle cx="15" cy="13" r="6" fill="white" stroke="${color}" stroke-width="1.5"/>
        </svg>
      </div>
    </div>
  `

  return L.divIcon({
    html: html,
    iconSize: [pinSize * 2.2, pinSize * 2.2],
    iconAnchor: [pinSize * 1.1, pinSize * 2.2],
    popupAnchor: [0, -pinSize * 1.5],
    className: 'enhanced-marker'
  })
}

/**
 * Create pickup location marker (Green with animated ping)
 */
export const createPickupMarker = (status = 'active') => {
  return createEnhancedMarker('#10B981', '📍', status, 40, '#10B981')
}

/**
 * Create destination marker (Red with animated ping)
 */
export const createDestinationMarker = (status = 'active') => {
  return createEnhancedMarker('#EF4444', '📌', status, 40, '#EF4444')
}

/**
 * Create user location marker (Blue with animated ping)
 */
export const createUserMarker = () => {
  return createEnhancedMarker('#3B82F6', '👤', 'active', 38, '#3B82F6')
}

/**
 * Create driver marker (Purple with animated ping)
 */
export const createDriverMarker = () => {
  return createEnhancedMarker('#8B5CF6', '🚗', 'active', 38, '#8B5CF6')
}

/**
 * Create rider marker (Orange with animated ping)
 */
export const createRiderMarker = () => {
  return createEnhancedMarker('#F59E0B', '👥', 'active', 38, '#F59E0B')
}

/**
 * Enhanced tooltip component for markers
 */
function EnhancedMarkerTooltip({ children, position = 'top' }) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className={`absolute left-1/2 transform -translate-x-1/2 ${position === 'top' ? '-translate-y-full -top-2' : 'top-full mt-2'} bg-slate-900 text-white px-3 py-2 rounded-lg shadow-lg whitespace-nowrap text-xs z-50 pointer-events-none`}>
          <div className="font-semibold">{children?.props?.title}</div>
        </div>
      )}
    </div>
  )
}

/**
 * Map zoom controls
 */
function MapZoomControls() {
  const map = useMap()

  return (
    <div className="absolute bottom-4 right-4 z-40 flex flex-col gap-1 bg-white rounded-lg shadow-lg border border-slate-300 overflow-hidden">
      <button
        onClick={() => map.zoomIn()}
        className="w-10 h-10 flex items-center justify-center text-slate-700 hover:bg-blue-50 transition-colors font-semibold text-lg"
        title="Zoom in"
      >
        +
      </button>
      <div className="h-px bg-slate-200"></div>
      <button
        onClick={() => map.zoomOut()}
        className="w-10 h-10 flex items-center justify-center text-slate-700 hover:bg-blue-50 transition-colors font-semibold text-lg"
        title="Zoom out"
      >
        −
      </button>
    </div>
  )
}

/**
 * Map updater component to handle location changes
 */
function MapLocationUpdater({ location, centerOnLocation = true }) {
  const map = useMap()

  useEffect(() => {
    if (location && centerOnLocation) {
      try {
        map.setView([location.latitude, location.longitude], Math.max(map.getZoom(), 14))
      } catch (e) {
        console.debug('Map setView failed:', e)
      }
    }

    const tid = setTimeout(() => {
      try {
        map.invalidateSize()
      } catch (e) {}
    }, 100)

    return () => clearTimeout(tid)
  }, [location, map, centerOnLocation])

  return null
}

/**
 * Route source indicator badge
 */
function RouteSourceIndicator({ source, position = 'top-left' }) {
  if (!source) return null

  const sourceInfo = getRouteSourceInfo(source)
  const positionClass = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  }[position] || 'top-left'

  return (
    <div className={`absolute ${positionClass} z-40 bg-white rounded-lg shadow-lg border border-slate-200 px-3 py-2 hover:shadow-xl transition-all`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{sourceInfo.icon}</span>
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-900">{sourceInfo.name}</span>
          <span className="text-xs text-slate-500">Route Source</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Directions summary display
 */
function DirectionsSummary({ distance, duration, startAddress, endAddress }) {
  return (
    <div className="absolute bottom-4 left-4 z-40 bg-white rounded-lg shadow-lg border border-slate-200 p-3 max-w-xs">
      <div className="space-y-2 text-sm">
        <div className="font-semibold text-slate-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Trip Details
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-blue-50 p-2 rounded">
            <div className="text-xs text-slate-600 font-medium">Distance</div>
            <div className="text-sm font-bold text-slate-900">{distance ? distance.toFixed(1) : '0'} km</div>
          </div>
          <div className="bg-blue-50 p-2 rounded">
            <div className="text-xs text-slate-600 font-medium">Duration</div>
            <div className="text-sm font-bold text-slate-900">{duration ? Math.ceil(duration) : '0'} min</div>
          </div>
          <div className="bg-green-50 p-2 rounded">
            <div className="text-xs text-slate-600 font-medium">ETA</div>
            <div className="text-sm font-bold text-green-600">{new Date(Date.now() + (duration || 0) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-2 mt-2">
          <div className="text-xs text-slate-600">
            <div className="flex items-start gap-2 mb-1">
              <span className="text-green-600 font-bold">From:</span>
              <span className="text-slate-900">{startAddress || 'Pickup Location'}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-600 font-bold">To:</span>
              <span className="text-slate-900">{endAddress || 'Destination'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Main MapComponent with enhanced markers and routing
 */
export default function MapComponent({
  userLocation,
  pickupLocation,
  destinationLocation,
  drivers = [],
  riders = [],
  routeGeometry = null,
  routeDistance = 0,
  routeDuration = 0,
  routeSource = null,
  showZoomControls = true,
  showRouteSource = true,
  showDirections = true,
  onMapClick = null,
  onPickupDrag = null,
  onDestinationDrag = null,
  centerOnUser = true,
  mapHeight = '100%',
  mapWidth = '100%',
  minZoom = 10,
  defaultZoom = 14,
  isLocating = false,
  locationError = null
}) {
  const mapRef = useRef(null)
  const [mapBounds, setMapBounds] = useState(null)
  const [hoveredMarker, setHoveredMarker] = useState(null)

  // Auto-fit bounds when route changes
  useEffect(() => {
    if (!mapRef.current || !routeGeometry || routeGeometry.length < 2) return

    try {
      const bounds = L.latLngBounds(
        routeGeometry.map(coord => [coord[1], coord[0]])
      )

      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 15 })
      }
    } catch (e) {
      console.debug('Bounds fit error:', e)
    }
  }, [routeGeometry])

  const handleMapClick = (e) => {
    if (onMapClick) {
      onMapClick({
        latitude: e.latlng.lat,
        longitude: e.latlng.lng
      })
    }
  }

  const defaultCenter = userLocation
    ? [userLocation.latitude, userLocation.longitude]
    : [14.5995, 120.9842] // Default to Manila

  // Calculate center between pickup and destination if available
  const calculatedCenter = pickupLocation && destinationLocation
    ? [
        (pickupLocation.latitude + destinationLocation.latitude) / 2,
        (pickupLocation.longitude + destinationLocation.longitude) / 2
      ]
    : defaultCenter

  return (
    <div
      style={{
        height: mapHeight,
        width: mapWidth,
        borderRadius: '0px',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 0,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <MapContainer
        center={calculatedCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%', zIndex: 0, minHeight: '400px' }}
        ref={mapRef}
        onClick={handleMapClick}
        attributionControl={false}
      >
        {/* Tile Layer - OpenStreetMap */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution=""
        />

        {/* Location updater */}
        <MapLocationUpdater location={userLocation} centerOnLocation={centerOnUser} />

        {/* Zoom controls */}
        {showZoomControls && <MapZoomControls />}

        {/* Route Source Indicator */}
        {showRouteSource && routeSource && <RouteSourceIndicator source={routeSource} position="top-left" />}

        {/* Directions Summary */}
        {showDirections && (pickupLocation && destinationLocation) && (
          <DirectionsSummary 
            distance={routeDistance}
            duration={routeDuration}
            startAddress={pickupLocation.address}
            endAddress={destinationLocation.address}
          />
        )}

        {/* Route Polyline - Blue solid line */}
        {routeGeometry && routeGeometry.length > 0 && (
          <Polyline
            positions={routeGeometry.map(coord => [coord[1], coord[0]])}
            color="#3B82F6"
            weight={5}
            opacity={0.85}
            lineCap="round"
            lineJoin="round"
          >
            <Popup>
              <div className="space-y-2 p-2" style={{ minWidth: '200px' }}>
                <div className="bg-blue-600 text-white rounded-t p-2">
                  <p className="font-bold text-sm">🗺️ Trip Summary</p>
                </div>

                <div className="space-y-2 px-2 py-1 text-sm">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <span className="text-slate-700 font-medium">📏 Distance:</span>
                    <span className="text-slate-900 font-bold">{routeDistance ? routeDistance.toFixed(1) : '?'} km</span>
                  </div>

                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <span className="text-slate-700 font-medium">⏱️ Duration:</span>
                    <span className="text-slate-900 font-bold">{Math.ceil(routeDuration) || '?'} min</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-700 font-medium">🕐 ETA:</span>
                    <span className="text-slate-900 font-bold">{new Date(Date.now() + (routeDuration || 0) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            </Popup>
          </Polyline>
        )}

        {/* User's current location marker */}
        {userLocation && (
          <Marker
            position={[userLocation.latitude, userLocation.longitude]}
            icon={createUserMarker()}
            title="Your Location"
            eventHandlers={{
              mouseover: () => setHoveredMarker('user'),
              mouseout: () => setHoveredMarker(null)
            }}
          >
            <Popup className="location-popup" maxWidth={160} minWidth={140} closeButton={false}>
              <div style={{ padding: '6px 8px', textAlign: 'center' }}>
                <p className="font-semibold text-sm text-slate-900">Your Location</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Pickup location marker - Green, draggable */}
        {pickupLocation && (
          <DraggableLocationMarker
            position={[pickupLocation.latitude, pickupLocation.longitude]}
            type="pickup"
            onDrag={onPickupDrag}
            icon={createPickupMarker()}
            label="📍 Pickup Location"
            description="Where you'll be picked up from"
            hovered={hoveredMarker === 'pickup'}
            onHoverChange={(isHovered) => setHoveredMarker(isHovered ? 'pickup' : null)}
          />
        )}

        {/* Destination location marker - Red, draggable */}
        {destinationLocation && (
          <DraggableLocationMarker
            position={[destinationLocation.latitude, destinationLocation.longitude]}
            type="destination"
            onDrag={onDestinationDrag}
            icon={createDestinationMarker()}
            label="📌 Destination"
            description="Where you want to go"
            hovered={hoveredMarker === 'destination'}
            onHoverChange={(isHovered) => setHoveredMarker(isHovered ? 'destination' : null)}
          />
        )}

        {/* Active drivers */}
        {drivers && drivers.map((driver) => (
          <Marker
            key={`driver-${driver.id}`}
            position={[driver.latitude, driver.longitude]}
            icon={createDriverMarker()}
            title={`Driver: ${driver.driver_name}`}
            eventHandlers={{
              mouseover: () => setHoveredMarker(`driver-${driver.id}`),
              mouseout: () => setHoveredMarker(null)
            }}
          >
            <Popup className="driver-popup" maxWidth={160} minWidth={140} closeButton={false}>
              <div style={{ padding: '6px 8px', textAlign: 'center' }}>
                <p className="font-semibold text-sm text-slate-900">Available Driver</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Active riders */}
        {riders && riders.map((rider) => (
          <Marker
            key={`rider-${rider.id}`}
            position={[rider.latitude, rider.longitude]}
            icon={createRiderMarker()}
            title={`Passenger: ${rider.passenger_name}`}
            eventHandlers={{
              mouseover: () => setHoveredMarker(`rider-${rider.id}`),
              mouseout: () => setHoveredMarker(null)
            }}
          >
            <Popup className="rider-popup" maxWidth={160} minWidth={140} closeButton={false}>
              <div style={{ padding: '6px 8px', textAlign: 'center' }}>
                <p className="font-semibold text-sm text-slate-900">Looking for Ride</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

/**
 * Draggable location marker component with simple tooltip
 */
function DraggableLocationMarker({ position, type, onDrag, icon, label, description, hovered, onHoverChange }) {
  const markerRef = useRef(null)

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current
      if (marker != null) {
        const newLat = marker.getLatLng().lat
        const newLng = marker.getLatLng().lng
        if (onDrag) {
          onDrag({ latitude: newLat, longitude: newLng })
        }
      }
    },
    mouseover() {
      if (onHoverChange) onHoverChange(true)
    },
    mouseout() {
      if (onHoverChange) onHoverChange(false)
    }
  }

  const typeColor = type === 'pickup' ? '#10B981' : '#EF4444'

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={icon}
      title={label}
    >
      <Popup
        maxWidth={180}
        minWidth={160}
        closeButton={false}
        className="location-label-popup"
      >
        <div className="text-center" style={{ padding: '6px 8px' }}>
          <p className="font-semibold text-sm text-slate-900">{label}</p>
        </div>
      </Popup>
    </Marker>
  )
}
