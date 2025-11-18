import React, { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../styles/rides.css'
import { supabase } from '../lib/supabaseClient'
import { useGeolocation } from '../lib/useGeolocation'
import { updatePresenceLocation } from '../lib/presence'
import RideListings from './RideListings'
import FareEstimate from './FareEstimate'
import RideScanNearby from './RideScanNearby'

// Fix Leaflet icon issues
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Custom marker icons with animation
const createCustomIcon = (color, label, animated = true) => {
  const animationClass = animated ? 'marker-pulse-blue' : ''
  const colorClass = color === '#3B82F6' ? 'marker-pulse-blue' :
                    color === '#22C55E' ? 'marker-pulse-green' :
                    color === '#F59E0B' ? 'marker-pulse-orange' :
                    color === '#8B5CF6' ? 'marker-pulse-purple' : ''

  return L.divIcon({
    html: `<div class="${colorClass}" style="background-color: ${color}; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${label}</div>`,
    iconSize: [32, 32],
    className: 'custom-icon'
  })
}

function MapUpdater({ location }) {
  const map = useMap()

  useEffect(() => {
    if (location) {
      try {
        map.setView([location.latitude, location.longitude], 14)
      } catch (e) {
        console.debug('Map setView failed:', e)
      }
    }

    const tid = setTimeout(() => {
      try { map.invalidateSize() } catch (e) { }
    }, 100)

    return () => clearTimeout(tid)
  }, [location, map])

  return null
}

function DraggableMarker({ position, color, label, onDrag }) {
  const markerRef = useRef(null)

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current
      if (marker != null) {
        const newLat = marker.getLatLng().lat
        const newLng = marker.getLatLng().lng
        onDrag({ latitude: newLat, longitude: newLng })
      }
    },
  }

  if (!position) return null

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={createCustomIcon(color, label, false)}
    />
  )
}

function MapComponent({ userLocation, drivers, riders, startCoord, endCoord, onMapClick, selectedMarker, onSelectMarker, userRole, onStartCoordDrag, onEndCoordDrag, selectingCoord }) {
  const mapRef = useRef(null)

  return (
    <div style={{ height: '500px', width: '100%', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
      {selectingCoord && (
        <div className="absolute top-0 left-0 right-0 z-20 bg-blue-500 text-white p-2 text-center text-sm font-medium">
          Click on the map or drag a marker to select {selectingCoord === 'start' ? 'pickup location' : 'destination'}
        </div>
      )}
      <MapContainer
        center={[userLocation?.latitude || 14.5995, userLocation?.longitude || 120.9842]}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
        onClick={(e) => {
          if (onMapClick) {
            onMapClick({
              latitude: e.latlng.lat,
              longitude: e.latlng.lng
            })
          }
        }}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapUpdater location={userLocation} />

        {/* User's current location */}
        {userLocation && (
          <Marker
            position={[userLocation.latitude, userLocation.longitude]}
            icon={createCustomIcon('#3B82F6', 'YOU', true)}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">Your Location</p>
                <p className="text-xs text-slate-600">Lat: {userLocation.latitude.toFixed(4)}</p>
                <p className="text-xs text-slate-600">Lng: {userLocation.longitude.toFixed(4)}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Start coordinate marker - draggable */}
        {startCoord && (
          <DraggableMarker
            position={[startCoord.latitude, startCoord.longitude]}
            color="#22C55E"
            label="P"
            onDrag={onStartCoordDrag}
          />
        )}

        {/* End coordinate marker - draggable */}
        {endCoord && (
          <DraggableMarker
            position={[endCoord.latitude, endCoord.longitude]}
            color="#EF4444"
            label="D"
            onDrag={onEndCoordDrag}
          />
        )}

        {/* Active drivers */}
        {drivers && drivers.map((driver) => (
          <Marker
            key={`driver-${driver.id}`}
            position={[driver.latitude, driver.longitude]}
            icon={createCustomIcon('#8B5CF6', 'D', true)}
            onClick={() => onSelectMarker?.({ type: 'driver', id: driver.id, data: driver })}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{driver.vehicle_type || 'Car'}</p>
                <p className="text-xs text-slate-600">{driver.driver_name}</p>
                <p className="text-xs text-yellow-600">★ {driver.rating || 'N/A'}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Active riders */}
        {riders && riders.map((rider) => (
          <Marker
            key={`rider-${rider.id}`}
            position={[rider.latitude, rider.longitude]}
            icon={createCustomIcon('#F59E0B', 'R', true)}
            onClick={() => onSelectMarker?.({ type: 'rider', id: rider.id, data: rider })}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{rider.passenger_name}</p>
                <p className="text-xs text-slate-600">Looking for ride</p>
                <p className="text-xs text-yellow-600">★ {rider.rating || 'N/A'}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

export default function Rides({ userId, userEmail, onShowAuth }) {
  const [activeTab, setActiveTab] = useState('find-ride')
  const [userRole, setUserRole] = useState('rider') // 'rider' or 'driver'
  const [userLocation, setUserLocation] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [riders, setRiders] = useState([])
  const [activeRides, setActiveRides] = useState([])
  const [rideHistory, setRideHistory] = useState([])

  // Location selection for ride request
  const [startCoord, setStartCoord] = useState(null)
  const [endCoord, setEndCoord] = useState(null)
  const [selectingCoord, setSelectingCoord] = useState(null) // 'start' or 'end'

  // Driver status
  const [driverStatus, setDriverStatus] = useState('offline') // 'offline', 'available', 'on-job'
  const [driverVehicleType, setDriverVehicleType] = useState('car') // 'car', 'tricycle'
  const [driverCity, setDriverCity] = useState('')

  // UI state
  const [selectedMarker, setSelectedMarker] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Get user location
  const { location, error: locationError } = useGeolocation()

  useEffect(() => {
    if (location) {
      setUserLocation(location)
      updatePresenceLocation(location)
    }
  }, [location])

  // Load initial data
  useEffect(() => {
    loadUserProfile()
    loadActiveRides()
    loadAvailableDrivers()
    loadActiveRiders()

    const unsubscribeRides = subscribeToRides()
    const unsubscribeDrivers = subscribeToDrivers()
    const unsubscribeRiders = subscribeToRiders()

    return () => {
      unsubscribeRides?.()
      unsubscribeDrivers?.()
      unsubscribeRiders?.()
    }
  }, [userId])

  const loadUserProfile = async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('ride_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.warn('Could not load profile:', error)
      } else if (data) {
        setUserRole(data.role || 'rider')
        setDriverVehicleType(data.vehicle_type || 'car')
        setDriverCity(data.city || '')
      }
    } catch (err) {
      console.warn('Profile load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadActiveRides = async () => {
    if (!userId) return

    try {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .or(`rider_id.eq.${userId},driver_id.eq.${userId}`)
        .in('status', ['requested', 'accepted', 'in-progress'])
        .order('created_at', { ascending: false })

      if (!error && data) {
        setActiveRides(data)
      }
    } catch (err) {
      console.warn('Could not load active rides:', err)
    }
  }

  const loadAvailableDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('ride_profiles')
        .select('id, user_id, full_name, vehicle_type, status, latitude, longitude, average_rating')
        .eq('role', 'driver')
        .eq('status', 'available')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)

      if (!error && data) {
        const driversData = data.map(d => ({
          id: d.user_id,
          driver_name: d.full_name || 'Driver',
          vehicle_type: d.vehicle_type || 'Car',
          latitude: parseFloat(d.latitude),
          longitude: parseFloat(d.longitude),
          rating: d.average_rating || 5.0
        }))
        setDrivers(driversData)
      }
    } catch (err) {
      console.warn('Could not load drivers:', err)
    }
  }

  const loadActiveRiders = async () => {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('id, rider_id, start_latitude, start_longitude, status')
        .in('status', ['requested', 'accepted'])
        .limit(20)

      if (!error && data) {
        const ridersData = data.map(r => ({
          id: r.rider_id,
          latitude: parseFloat(r.start_latitude),
          longitude: parseFloat(r.start_longitude),
          passenger_name: 'Passenger',
          rating: 5.0
        }))
        setRiders(ridersData)
      }
    } catch (err) {
      console.warn('Could not load riders:', err)
    }
  }

  const subscribeToRides = () => {
    if (!userId) return

    try {
      const subscription = supabase
        .channel(`rides:${userId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'rides',
          filter: `or(rider_id.eq.${userId},driver_id.eq.${userId})`
        }, (payload) => {
          loadActiveRides()
        })
        .subscribe()

      return () => {
        subscription.unsubscribe()
      }
    } catch (err) {
      console.warn('Subscription error:', err)
    }
  }

  const subscribeToDrivers = () => {
    try {
      const subscription = supabase
        .channel('drivers:available')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'ride_profiles',
          filter: 'role=eq.driver'
        }, (payload) => {
          loadAvailableDrivers()
        })
        .subscribe()

      return () => {
        subscription.unsubscribe()
      }
    } catch (err) {
      console.warn('Driver subscription error:', err)
      return () => {}
    }
  }

  const subscribeToRiders = () => {
    try {
      const subscription = supabase
        .channel('riders:searching')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'rides'
        }, (payload) => {
          loadActiveRiders()
        })
        .subscribe()

      return () => {
        subscription.unsubscribe()
      }
    } catch (err) {
      console.warn('Rider subscription error:', err)
      return () => {}
    }
  }

  const updateDriverStatus = async (newStatus) => {
    if (!userId) return

    try {
      const { error } = await supabase
        .from('ride_profiles')
        .upsert({
          user_id: userId,
          role: 'driver',
          status: newStatus,
          vehicle_type: driverVehicleType,
          city: driverCity,
          latitude: userLocation?.latitude,
          longitude: userLocation?.longitude,
          updated_at: new Date().toISOString()
        })

      if (!error) {
        setDriverStatus(newStatus)
      }
    } catch (err) {
      setError('Failed to update driver status')
    }
  }

  const requestRide = async () => {
    if (!userId || !startCoord || !endCoord) {
      setError('Please select both pickup and destination locations')
      return
    }

    try {
      const { data, error } = await supabase
        .from('rides')
        .insert({
          rider_id: userId,
          start_latitude: startCoord.latitude,
          start_longitude: startCoord.longitude,
          end_latitude: endCoord.latitude,
          end_longitude: endCoord.longitude,
          status: 'requested',
          created_at: new Date().toISOString()
        })
        .select()

      if (!error) {
        setStartCoord(null)
        setEndCoord(null)
        setSelectingCoord(null)
        setActiveTab('my-rides')
        loadActiveRides()
        setError('')
      } else {
        setError('Failed to request ride')
      }
    } catch (err) {
      setError('Error requesting ride')
    }
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Rides</h1>
            <p className="text-lg text-slate-600 mb-8">Please log in to access the rides service</p>
            <button
              onClick={() => onShowAuth('login')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Log In
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-20 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-slate-900">Rides</h1>
            <div className="flex items-center gap-4">
              {userRole === 'driver' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Driver Status:</span>
                  <select
                    value={driverStatus}
                    onChange={(e) => updateDriverStatus(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium"
                  >
                    <option value="offline">Offline</option>
                    <option value="available">Available</option>
                    <option value="on-job">On a Job</option>
                  </select>
                </div>
              )}
              <button
                onClick={() => setUserRole(userRole === 'rider' ? 'driver' : 'rider')}
                className="px-4 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 text-sm font-medium"
              >
                Switch to {userRole === 'rider' ? 'Driver' : 'Rider'}
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('find-ride')}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
                activeTab === 'find-ride'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              🗺️ Find Ride
            </button>
            <button
              onClick={() => setActiveTab('scan-nearby')}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
                activeTab === 'scan-nearby'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              📍 Scan Nearby
            </button>
            <button
              onClick={() => setActiveTab('my-rides')}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
                activeTab === 'my-rides'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              🚗 My Rides ({activeRides.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
                activeTab === 'history'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              📋 History
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
                activeTab === 'profile'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              👤 Profile
            </button>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Find Ride Tab */}
        {activeTab === 'find-ride' && (
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Find a Ride</h2>

            {/* Map */}
            <div className="mb-6">
              <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {selectingCoord ? `Click on map or drag marker to select ${selectingCoord === 'start' ? 'pickup' : 'destination'} location` : 'Interactive Map'}
                </h3>
                <MapComponent
                  userLocation={userLocation}
                  drivers={drivers}
                  riders={riders}
                  startCoord={startCoord}
                  endCoord={endCoord}
                  onMapClick={(coord) => {
                    if (selectingCoord === 'start') {
                      setStartCoord(coord)
                      setSelectingCoord('end')
                    } else if (selectingCoord === 'end') {
                      setEndCoord(coord)
                      setSelectingCoord(null)
                    }
                  }}
                  selectedMarker={selectedMarker}
                  onSelectMarker={setSelectedMarker}
                  userRole={userRole}
                  selectingCoord={selectingCoord}
                  onStartCoordDrag={setStartCoord}
                  onEndCoordDrag={setEndCoord}
                />
              </div>
            </div>

            {/* Ride Request Form */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Request a Ride</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Pickup Location */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Pickup Location</label>
                  {startCoord ? (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm font-medium text-green-900">✓ Selected</p>
                      <p className="text-xs text-slate-600 mt-1">
                        Lat: {startCoord.latitude.toFixed(4)}, Lng: {startCoord.longitude.toFixed(4)}
                      </p>
                      <button
                        onClick={() => {
                          setStartCoord(null)
                          setSelectingCoord('start')
                        }}
                        className="text-xs text-green-600 hover:text-green-700 mt-2 font-medium"
                      >
                        Change Location
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectingCoord('start')}
                      className="w-full p-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-blue-500 hover:text-blue-600 font-medium"
                    >
                      Click to select pickup location
                    </button>
                  )}
                </div>

                {/* Destination */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Destination</label>
                  {endCoord ? (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm font-medium text-red-900">✓ Selected</p>
                      <p className="text-xs text-slate-600 mt-1">
                        Lat: {endCoord.latitude.toFixed(4)}, Lng: {endCoord.longitude.toFixed(4)}
                      </p>
                      <button
                        onClick={() => {
                          setEndCoord(null)
                          setSelectingCoord('end')
                        }}
                        className="text-xs text-red-600 hover:text-red-700 mt-2 font-medium"
                      >
                        Change Location
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectingCoord('end')}
                      className="w-full p-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-blue-500 hover:text-blue-600 font-medium"
                    >
                      Click to select destination
                    </button>
                  )}
                </div>
              </div>

              {/* Ride Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-3">Ride Type</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'ride-share', label: '🚗 Ride Share', icon: '🚗' },
                    { id: 'package', label: '📦 Package', icon: '📦' },
                    { id: 'food', label: '🍔 Food Pickup', icon: '🍔' },
                    { id: 'laundry', label: '👕 Laundry', icon: '👕' }
                  ].map(type => (
                    <button
                      key={type.id}
                      className="p-3 border-2 border-slate-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-sm font-medium"
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fare Estimate */}
              {startCoord && endCoord && (
                <div className="mb-6">
                  <FareEstimate
                    startCoord={startCoord}
                    endCoord={endCoord}
                    vehicleType={driverVehicleType}
                    activeDemand={activeRides.length}
                    activeSupply={drivers.length}
                  />
                </div>
              )}

              {/* Request Button */}
              <button
                onClick={requestRide}
                disabled={!startCoord || !endCoord}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                Request Ride
              </button>
            </div>

            {/* Available Drivers Listing */}
            {startCoord && endCoord && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Available Drivers Nearby</h3>
                <RideListings
                  drivers={drivers}
                  riders={riders}
                  startCoord={startCoord}
                  endCoord={endCoord}
                  userRole={userRole}
                  userId={userId}
                  loading={loading}
                  onSelectDriver={(driver) => {
                    setSelectedMarker({ type: 'driver', id: driver.id, data: driver })
                  }}
                  onSelectRider={(rider) => {
                    setSelectedMarker({ type: 'rider', id: rider.id, data: rider })
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* My Rides Tab */}
        {activeTab === 'my-rides' && (
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Active Rides</h2>
            {activeRides.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <p className="text-slate-600 text-lg mb-4">No active rides</p>
                <button
                  onClick={() => setActiveTab('find-ride')}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Request a Ride
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {activeRides.map(ride => (
                  <div key={ride.id} className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-600">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {ride.status === 'requested' && '⏳ Searching for driver...'}
                        {ride.status === 'accepted' && '✓ Driver accepted - arriving soon'}
                        {ride.status === 'in-progress' && '🚗 Ride in progress'}
                      </h3>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold uppercase">
                        {ride.status}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p>From: Lat {ride.start_latitude.toFixed(4)}, Lng {ride.start_longitude.toFixed(4)}</p>
                      <p>To: Lat {ride.end_latitude.toFixed(4)}, Lng {ride.end_longitude.toFixed(4)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Scan Nearby Tab */}
        {activeTab === 'scan-nearby' && (
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Scan Nearby</h2>
            <RideScanNearby
              userId={userId}
              onSelectDriver={(driver) => {
                setSelectedMarker({ type: 'driver', id: driver.id, data: driver })
              }}
              onSelectRider={(rider) => {
                setSelectedMarker({ type: 'rider', id: rider.id, data: rider })
              }}
              onSelectCity={(city) => {
                // City selected
              }}
            />
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Ride History</h2>
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <p className="text-slate-600 text-lg">Ride history will appear here</p>
            </div>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Rider Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Profile Card */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Your Information</h3>
                <div className="space-y-3 text-sm">
                  <p><span className="text-slate-600">Email:</span> <span className="font-medium">{userEmail}</span></p>
                  <p><span className="text-slate-600">Account Type:</span> <span className="font-medium">{userRole === 'rider' ? 'Rider' : 'Driver'}</span></p>
                  {userRole === 'driver' && (
                    <>
                      <p><span className="text-slate-600">Vehicle:</span> <span className="font-medium">{driverVehicleType}</span></p>
                      <p><span className="text-slate-600">City:</span> <span className="font-medium">{driverCity || 'Not specified'}</span></p>
                    </>
                  )}
                </div>
              </div>

              {/* Stats Card */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Statistics</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Rides:</span>
                    <span className="font-medium text-slate-900">0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Rating:</span>
                    <span className="font-medium text-yellow-600">★ 5.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Member Since:</span>
                    <span className="font-medium text-slate-900">{new Date().toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
