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
 * Create enhanced custom markers with map pin style
 */
export const createEnhancedMarker = (color, label, status = 'active', size = 40) => {
  const animationClass = status === 'active' ? 'marker-pulse' : ''
  const pinSize = size * 1.5
  const dotSize = size * 0.45

  // SVG map pin icon
  const html = `
    <div class="custom-marker ${animationClass}" style="
      position: relative;
      width: ${pinSize}px;
      height: ${pinSize}px;
      cursor: pointer;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    " title="${label}">
      <svg viewBox="0 0 30 40" width="${pinSize}" height="${pinSize}" style="position: absolute; top: 0; left: -${pinSize/2}px;">
        <defs>
          <style>
            @keyframes markerPulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.7; }
            }
            .marker-svg {
              animation: ${status === 'active' ? 'markerPulse 2s infinite' : 'none'};
            }
          </style>
        </defs>
        <!-- Map pin shape -->
        <path d="M 15 0 C 8 0 2 6 2 13 C 2 22 15 40 15 40 C 15 40 28 22 28 13 C 28 6 22 0 15 0 Z" fill="${color}" class="marker-svg" stroke="white" stroke-width="1.5"/>
        <!-- Center dot -->
        <circle cx="15" cy="13" r="5" fill="white" class="marker-svg"/>
      </svg>
    </div>
  `

  return L.divIcon({
    html: html,
    iconSize: [pinSize, pinSize * 1.3],
    iconAnchor: [pinSize / 2, pinSize * 1.3],
    popupAnchor: [0, -pinSize],
    className: 'enhanced-marker'
  })
}

/**
 * Create pickup location marker (Green)
 */
export const createPickupMarker = (status = 'active') => {
  return createEnhancedMarker('#10B981', 'P', status, 40)
}

/**
 * Create destination marker (Red)
 */
export const createDestinationMarker = (status = 'active') => {
  return createEnhancedMarker('#EF4444', 'D', status, 40)
}

/**
 * Create user location marker (Blue)
 */
export const createUserMarker = () => {
  return createEnhancedMarker('#3B82F6', 'U', 'active', 38)
}

/**
 * Create driver marker (Purple)
 */
export const createDriverMarker = () => {
  return createEnhancedMarker('#8B5CF6', 'DR', 'active', 38)
}

/**
 * Create rider marker (Orange)
 */
export const createRiderMarker = () => {
  return createEnhancedMarker('#F59E0B', 'R', 'active', 38)
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
function RouteSourceIndicator({ source, position = 'top-right' }) {
  if (!source) return null

  const sourceInfo = getRouteSourceInfo(source)
  const positionClass = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  }[position] || 'top-right'

  return (
    <div className={`absolute ${positionClass} z-40 bg-white rounded-lg shadow-lg border border-slate-200 px-3 py-2`}>
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
 * Main MapComponent
 */
export default function MapComponent({
  userLocation,
  pickupLocation,
  destinationLocation,
  drivers = [],
  riders = [],
  routeGeometry = null,
  routeSource = null,
  showZoomControls = true,
  showRouteSource = true,
  onMapClick = null,
  onPickupDrag = null,
  onDestinationDrag = null,
  centerOnUser = true,
  mapHeight = '100%',
  mapWidth = '100%',
  minZoom = 10,
  defaultZoom = 14
}) {
  const mapRef = useRef(null)
  const [mapBounds, setMapBounds] = useState(null)

  // Auto-fit bounds when route changes
  useEffect(() => {
    if (!mapRef.current || !routeGeometry) return

    try {
      const bounds = L.latLngBounds(
        routeGeometry.map(coord => [coord[1], coord[0]])
      )

      // Add padding
      mapRef.current.fitBounds(bounds, { padding: [50, 50] })
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
        center={defaultCenter}
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
        {showRouteSource && routeSource && <RouteSourceIndicator source={routeSource} />}

        {/* Route Polyline */}
        {routeGeometry && routeGeometry.length > 0 && (
          <RoutePolyline
            geometry={routeGeometry}
            distance={0}
            duration={0}
          />
        )}

        {/* User's current location marker */}
        {userLocation && (
          <Marker
            position={[userLocation.latitude, userLocation.longitude]}
            icon={createUserMarker()}
            title="Your Location"
          >
            <Popup className="location-popup">
              <div className="p-2 space-y-1">
                <p className="font-semibold text-sm text-slate-900">Your Location</p>
                <div className="text-xs text-slate-600 space-y-0.5">
                  <p>Lat: {userLocation.latitude.toFixed(6)}</p>
                  <p>Lng: {userLocation.longitude.toFixed(6)}</p>
                </div>
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
            label="Pickup Location"
          />
        )}

        {/* Destination location marker - Red, draggable */}
        {destinationLocation && (
          <DraggableLocationMarker
            position={[destinationLocation.latitude, destinationLocation.longitude]}
            type="destination"
            onDrag={onDestinationDrag}
            icon={createDestinationMarker()}
            label="Destination"
          />
        )}

        {/* Active drivers */}
        {drivers && drivers.map((driver) => (
          <Marker
            key={`driver-${driver.id}`}
            position={[driver.latitude, driver.longitude]}
            icon={createDriverMarker()}
            title={driver.driver_name || 'Driver'}
          >
            <Popup className="driver-popup">
              <div className="p-2 space-y-1">
                <p className="font-semibold text-sm text-slate-900">{driver.vehicle_type || 'Car'}</p>
                <p className="text-xs text-slate-600">{driver.driver_name}</p>
                <p className="text-xs text-yellow-600">★ {(driver.rating || 5).toFixed(1)}</p>
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
            title={rider.passenger_name || 'Rider'}
          >
            <Popup className="rider-popup">
              <div className="p-2 space-y-1">
                <p className="font-semibold text-sm text-slate-900">{rider.passenger_name}</p>
                <p className="text-xs text-slate-600">Looking for ride</p>
                <p className="text-xs text-yellow-600">★ {(rider.rating || 5).toFixed(1)}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

/**
 * Draggable location marker component
 */
function DraggableLocationMarker({ position, type, onDrag, icon, label }) {
  const markerRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [editLat, setEditLat] = useState(position[0].toString())
  const [editLng, setEditLng] = useState(position[1].toString())

  useEffect(() => {
    setEditLat(position[0].toString())
    setEditLng(position[1].toString())
  }, [position])

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current
      if (marker != null) {
        const newLat = marker.getLatLng().lat
        const newLng = marker.getLatLng().lng
        setEditLat(newLat.toString())
        setEditLng(newLng.toString())
        if (onDrag) {
          onDrag({ latitude: newLat, longitude: newLng })
        }
      }
    }
  }

  const handleCoordinateUpdate = () => {
    const newLat = parseFloat(editLat)
    const newLng = parseFloat(editLng)

    if (!isNaN(newLat) && !isNaN(newLng)) {
      if (onDrag) {
        onDrag({ latitude: newLat, longitude: newLng })
      }
      setIsOpen(false)
    }
  }

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
        maxWidth={280}
        minWidth={250}
        closeButton={true}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
      >
        <div className="p-3 space-y-3">
          <div className="font-semibold text-slate-900 text-sm border-b border-slate-200 pb-2">
            {label}
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Latitude
              </label>
              <input
                type="number"
                step="0.000001"
                value={editLat}
                onChange={(e) => setEditLat(e.target.value)}
                className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Longitude
              </label>
              <input
                type="number"
                step="0.000001"
                value={editLng}
                onChange={(e) => setEditLng(e.target.value)}
                className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCoordinateUpdate}
              className="flex-1 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
            >
              Update
            </button>
            <button
              onClick={() => {
                setEditLat(position[0].toString())
                setEditLng(position[1].toString())
              }}
              className="flex-1 px-3 py-1 bg-slate-200 text-slate-700 text-xs font-medium rounded hover:bg-slate-300 transition-colors"
            >
              Reset
            </button>
          </div>

          <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200">
            <p className="font-medium mb-1">Current:</p>
            <p className="font-mono">Lat: {position[0].toFixed(6)}</p>
            <p className="font-mono">Lng: {position[1].toFixed(6)}</p>
          </div>
        </div>
      </Popup>
    </Marker>
  )
}
