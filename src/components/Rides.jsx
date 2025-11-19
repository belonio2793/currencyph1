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
import DriverProfileModal from './DriverProfileModal'
import RideDetailsModal from './RideDetailsModal'
import ChatModal from './ChatModal'
import PaymentModal from './PaymentModal'
import RatingModal from './RatingModal'
import TransactionHistoryModal from './TransactionHistoryModal'
import MarkerPopup from './MarkerPopup'
import RideTypeModal from './RideTypeModal'
import ServicesModal from './ServicesModal'
import RideDetailsCard from './RideDetailsCard'
import RoutePolyline from './RoutePolyline'
import UnifiedLocationSearch from './UnifiedLocationSearch'
import RidesHistoryView from './RidesHistoryView'
import DriverInterface from './DriverInterface'

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
  const [isOpen, setIsOpen] = useState(false)
  const [editLat, setEditLat] = useState(position ? position[0].toString() : '')
  const [editLng, setEditLng] = useState(position ? position[1].toString() : '')

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current
      if (marker != null) {
        const newLat = marker.getLatLng().lat
        const newLng = marker.getLatLng().lng
        onDrag({ latitude: newLat, longitude: newLng })
        setEditLat(newLat.toString())
        setEditLng(newLng.toString())
      }
    },
  }

  const handleCoordinateUpdate = () => {
    const newLat = parseFloat(editLat)
    const newLng = parseFloat(editLng)

    if (!isNaN(newLat) && !isNaN(newLng)) {
      onDrag({ latitude: newLat, longitude: newLng })
      setIsOpen(false)
    }
  }

  useEffect(() => {
    if (position) {
      setEditLat(position[0].toString())
      setEditLng(position[1].toString())
    }
  }, [position])

  if (!position) return null

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={createCustomIcon(color, label, false)}
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
            {label === 'P' ? 'Pickup Location' : 'Destination'}
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

function ZoomControls() {
  const map = useMap()

  return (
    <div className="absolute bottom-4 right-4 z-40 flex flex-col gap-2 bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
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

function MapComponent({ userLocation, drivers, riders, startCoord, endCoord, onMapClick, selectedMarker, onSelectMarker, userRole, onStartCoordDrag, onEndCoordDrag, selectingCoord, routeGeometry, routeDistance, routeDuration, routeDetails }) {
  const mapRef = useRef(null)

  return (
    <div style={{ height: '100%', width: '100%', borderRadius: '0px', overflow: 'hidden', position: 'relative', zIndex: 0, display: 'flex', flexDirection: 'column' }}>
      <MapContainer
        center={[userLocation?.latitude || 14.5995, userLocation?.longitude || 120.9842]}
        zoom={14}
        style={{ height: '100%', width: '100%', zIndex: 0, minHeight: '600px' }}
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
          attribution=""
        />
        <ZoomControls />
        <MapUpdater location={userLocation} />

        {/* Route Polyline */}
        {routeGeometry && (
          <RoutePolyline
            geometry={routeGeometry}
            distance={routeDistance}
            duration={routeDuration}
            fare={routeDetails?.fare}
          />
        )}

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
      {selectingCoord && (
        <div className="bg-blue-500 text-white p-3 text-center text-sm font-medium">
          Click on the map or drag a marker to select {selectingCoord === 'start' ? 'pickup location' : 'destination'}
        </div>
      )}
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
  const [rideCity, setRideCity] = useState('')

  // Modal states
  const [showRideTypeModal, setShowRideTypeModal] = useState(false)
  const [selectedRideType, setSelectedRideType] = useState('car')
  const [showServicesModal, setShowServicesModal] = useState(false)
  const [selectedService, setSelectedService] = useState('ride-share')

  // Route details
  const [routeDetails, setRouteDetails] = useState(null)

  // Driver status
  const [driverStatus, setDriverStatus] = useState('offline') // 'offline', 'available', 'on-job'
  const [driverVehicleType, setDriverVehicleType] = useState('car') // 'car', 'tricycle'
  const [driverMakeModel, setDriverMakeModel] = useState('')
  const [driverYear, setDriverYear] = useState('')
  const [driverMileage, setDriverMileage] = useState('')
  const [driverFuelType, setDriverFuelType] = useState('gasoline') // 'gasoline', 'diesel', 'electric', 'hybrid'
  const [driverCity, setDriverCity] = useState('')
  const [showVehicleModal, setShowVehicleModal] = useState(false)

  // UI state
  const [selectedMarker, setSelectedMarker] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Modal states - ride process
  const [showDriverProfileModal, setShowDriverProfileModal] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [showRideDetailsModal, setShowRideDetailsModal] = useState(false)
  const [selectedRide, setSelectedRide] = useState(null)
  const [showChatModal, setShowChatModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [showTransactionHistoryModal, setShowTransactionHistoryModal] = useState(false)

  // Get user location
  const { location, error: locationError } = useGeolocation()

  useEffect(() => {
    if (location) {
      setUserLocation(location)
      // Auto-set pickup location to user's current location
      if (!startCoord) {
        setStartCoord(location)
      }
      updatePresenceLocation(location)
    }
  }, [location, startCoord])

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

      if (error) {
        if (error.code === 'PGRST116') {
          // Record not found, which is okay for new users
          console.debug('Profile not found for user (new user)')
        } else {
          console.debug('Could not load profile:', error?.code || error?.message)
        }
      } else if (data) {
        setUserRole('rider')
        setDriverStatus(data.status || 'offline')
        setDriverVehicleType(data.vehicle_type || 'car')
        setDriverMakeModel(data.vehicle_make_model || '')
        setDriverYear(data.vehicle_year || '')
        setDriverMileage(data.vehicle_mileage || '')
        setDriverFuelType(data.vehicle_fuel_type || 'gasoline')
        setDriverCity(data.city || '')
      }
    } catch (err) {
      console.debug('Profile load error:', err?.message)
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
      } else if (error) {
        console.debug('Load active rides error:', error?.code || error?.message)
      }
    } catch (err) {
      // Silently handle network errors as they're expected in some environments
      console.debug('Could not load active rides:', err?.message)
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
      } else if (error) {
        console.debug('Load drivers error:', error?.code || error?.message)
      }
    } catch (err) {
      console.debug('Could not load drivers:', err?.message)
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
          role: userRole,
          status: newStatus,
          vehicle_type: driverVehicleType,
          city: driverCity,
          latitude: userLocation?.latitude,
          longitude: userLocation?.longitude,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (!error) {
        setDriverStatus(newStatus)
      } else {
        console.error('Driver status update error:', error)
        setError('Failed to update driver status')
      }
    } catch (err) {
      console.error('Driver status update exception:', err)
      setError('Failed to update driver status')
    }
  }

  const saveVehicleInfo = async () => {
    if (!userId) return

    try {
      const { error } = await supabase
        .from('ride_profiles')
        .upsert({
          user_id: userId,
          role: 'driver',
          vehicle_type: driverVehicleType,
          vehicle_make_model: driverMakeModel,
          vehicle_year: driverYear ? parseInt(driverYear) : null,
          vehicle_fuel_type: driverFuelType,
          vehicle_mileage: driverMileage ? parseInt(driverMileage) : null,
          city: driverCity,
          latitude: userLocation?.latitude,
          longitude: userLocation?.longitude,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (!error) {
        setShowVehicleModal(false)
      } else {
        console.error('Vehicle info save error:', error)
        setError('Failed to save vehicle information')
      }
    } catch (err) {
      console.error('Vehicle info save exception:', err)
      setError('Failed to save vehicle information')
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
          ride_type: selectedRideType || 'ride-share',
          estimated_distance: routeDetails?.distance || null,
          estimated_duration: routeDetails?.duration || null,
          estimated_fare: routeDetails?.fare?.total || null,
          route_geometry: routeDetails?.geometry ? JSON.stringify(routeDetails.geometry) : null,
          status: 'requested',
          created_at: new Date().toISOString()
        })
        .select()

      if (!error) {
        setStartCoord(null)
        setEndCoord(null)
        setSelectingCoord(null)
        setRouteDetails(null)
        setSelectedRideType(null)
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

  // Modal handlers
  const handleSelectDriver = (driver) => {
    setSelectedDriver(driver)
    setShowDriverProfileModal(true)
  }

  const handleRequestRideFromDriver = async (driverId, customOffer) => {
    if (!userId || !startCoord || !endCoord) {
      setError('Please select both locations')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('rides')
        .insert({
          rider_id: userId,
          driver_id: driverId,
          start_latitude: startCoord.latitude,
          start_longitude: startCoord.longitude,
          end_latitude: endCoord.latitude,
          end_longitude: endCoord.longitude,
          ride_type: selectedRideType || 'ride-share',
          estimated_distance: routeDetails?.distance || null,
          estimated_duration: routeDetails?.duration || null,
          estimated_fare: routeDetails?.fare?.total || null,
          route_geometry: routeDetails?.geometry ? JSON.stringify(routeDetails.geometry) : null,
          rider_offered_amount: customOffer ? parseFloat(customOffer) : null,
          status: 'requested',
          created_at: new Date().toISOString()
        })
        .select()

      if (!error) {
        setShowDriverProfileModal(false)
        setStartCoord(null)
        setEndCoord(null)
        setRouteDetails(null)
        setSelectedRideType(null)
        setActiveTab('my-rides')
        loadActiveRides()
      } else {
        setError('Failed to request ride')
      }
    } catch (err) {
      setError('Error requesting ride')
    } finally {
      setLoading(false)
    }
  }

  const handleViewRideDetails = (ride) => {
    setSelectedRide(ride)
    setShowRideDetailsModal(true)
  }

  const handleOpenChat = (ride) => {
    setSelectedRide(ride)
    setShowChatModal(true)
  }

  const handleSendMessage = async (rideId, message) => {
    try {
      const { error } = await supabase
        .from('ride_chat_messages')
        .insert({
          ride_id: rideId,
          sender_id: userId,
          sender_type: userRole,
          message: message,
          message_type: 'text',
          created_at: new Date().toISOString()
        })

      if (error) {
        setError('Failed to send message')
      }
    } catch (err) {
      setError('Error sending message')
    }
  }

  const handleCompletePayment = async (paymentData) => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('ride_transactions')
        .insert({
          ride_id: paymentData.ride_id,
          transaction_type: 'fare_payment',
          amount: paymentData.amount,
          currency: 'PHP',
          from_user_id: userId,
          to_user_id: selectedRide?.driver_id,
          payment_method: paymentData.payment_method,
          status: 'completed',
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })

      if (!error && paymentData.tip > 0) {
        await supabase
          .from('ride_transactions')
          .insert({
            ride_id: paymentData.ride_id,
            transaction_type: 'tip',
            amount: paymentData.tip,
            currency: 'PHP',
            from_user_id: userId,
            to_user_id: selectedRide?.driver_id,
            payment_method: paymentData.payment_method,
            status: 'completed',
            created_at: new Date().toISOString(),
            completed_at: new Date().toISOString()
          })
      }

      if (!error) {
        setShowPaymentModal(false)
        setShowRatingModal(true)
      } else {
        setError('Failed to process payment')
      }
    } catch (err) {
      setError('Error processing payment')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitRating = async (ratingData) => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('ride_ratings')
        .insert({
          ride_id: ratingData.ride_id,
          rater_id: userId,
          ratee_id: selectedRide?.driver_id,
          rating_type: 'driver-for-rider',
          rating_score: ratingData.rating_score,
          review_text: ratingData.review_text,
          cleanliness_rating: ratingData.cleanliness_rating,
          safety_rating: ratingData.safety_rating,
          friendliness_rating: ratingData.friendliness_rating,
          tags: ratingData.tags,
          created_at: new Date().toISOString()
        })

      if (!error) {
        setShowRatingModal(false)
        loadActiveRides()
      } else {
        setError('Failed to submit rating')
      }
    } catch (err) {
      setError('Error submitting rating')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelRide = async (rideId) => {
    if (!confirm('Are you sure you want to cancel this ride?')) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('rides')
        .update({
          status: 'cancelled',
          cancelled_by: userRole,
          cancellation_reason: 'User requested cancellation',
          updated_at: new Date().toISOString()
        })
        .eq('id', rideId)

      if (!error) {
        setShowRideDetailsModal(false)
        loadActiveRides()
      } else {
        setError('Failed to cancel ride')
      }
    } catch (err) {
      setError('Error cancelling ride')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateRideStatus = async (rideId, newStatus) => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('rides')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
          ...(newStatus === 'completed' && { dropoff_time: new Date().toISOString() }),
          ...(newStatus === 'picked-up' && { pickup_time: new Date().toISOString() })
        })
        .eq('id', rideId)

      if (!error) {
        if (newStatus === 'completed') {
          setShowRideDetailsModal(false)
          setShowPaymentModal(true)
        }
        loadActiveRides()
      } else {
        setError('Failed to update ride status')
      }
    } catch (err) {
      setError('Error updating ride status')
    } finally {
      setLoading(false)
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
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  userRole === 'rider'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-yellow-400 text-slate-900 hover:bg-yellow-500 border border-yellow-500'
                }`}
              >
                {userRole === 'rider' ? 'Switch To Driver' : 'Switch To Rider'}
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('find-ride')}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors flex items-center gap-2 ${
                activeTab === 'find-ride'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 003 16.382V5.618a1 1 0 011.553-.894L9 7m0 13l6.447 3.268A1 1 0 0021 17.382V6.618a1 1 0 00-1.553-.894L15 8m0 13V8m0 0L9 5m6 8v8m0-13L9 5" />
              </svg>
              Find Ride
            </button>
            <button
              onClick={() => setActiveTab('scan-nearby')}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors flex items-center gap-2 ${
                activeTab === 'scan-nearby'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Scan Nearby
            </button>
            <button
              onClick={() => setActiveTab('my-rides')}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors flex items-center gap-2 ${
                activeTab === 'my-rides'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              My Rides ({activeRides.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2m6-11a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              History
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors flex items-center gap-2 ${
                activeTab === 'profile'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
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
        {/* Driver Mode */}
        {userRole === 'driver' ? (
          <DriverInterface userId={userId} userLocation={userLocation} />
        ) : (
          <>
        {/* Find Ride Tab */}
        {activeTab === 'find-ride' && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Find a Ride</h2>
              <p className="text-slate-600">Select your pickup and destination locations on the map or enter coordinates directly</p>
            </div>

            {/* Ride Type and Services Selection - Two Rows */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Ride Type Selection */}
              <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-6">
                <label className="block text-sm font-medium text-slate-700 mb-3">Vehicle Type</label>
                {selectedRideType ? (
                  <div className="flex items-center justify-between p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {selectedRideType.charAt(0).toUpperCase() + selectedRideType.slice(1).replace('-', ' ')}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">Selected ride type</p>
                    </div>
                    <button
                      onClick={() => setShowRideTypeModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowRideTypeModal(true)}
                    className="w-full py-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-700 hover:border-blue-500 hover:bg-blue-50 font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Select Vehicle Type
                  </button>
                )}
              </div>

              {/* Available Services Selection */}
              <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-6">
                <label className="block text-sm font-medium text-slate-700 mb-3">Available Services</label>
                {selectedService ? (
                  <div className="flex items-center justify-between p-4 bg-purple-50 border-2 border-purple-300 rounded-lg">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {selectedService.charAt(0).toUpperCase() + selectedService.slice(1).replace('-', ' ')}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">Selected service</p>
                    </div>
                    <button
                      onClick={() => setShowServicesModal(true)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowServicesModal(true)}
                    className="w-full py-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-700 hover:border-purple-500 hover:bg-purple-50 font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Select Service
                  </button>
                )}
              </div>
            </div>

            {/* Merged Request a Ride & Route Map Section */}
            <div className="space-y-6">
              {/* Main Request Card */}
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-5">
                  <h3 className="text-2xl font-bold text-white">Plan Your Ride</h3>
                  <p className="text-blue-100 text-sm mt-1">Select locations and ride type to get started</p>
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                  {/* Left Panel: Location & Type Selection */}
                  <div className="lg:col-span-2 p-6 space-y-6 lg:border-r border-slate-200">
                    {/* Pickup Display */}
                    <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white bg-white bg-opacity-30">
                          <svg className="w-6 h-6" fill="none" stroke="white" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-white">Pickup Location (Your Current Location)</p>
                          <p className="text-white text-opacity-90 text-xs mt-1">{userLocation ? `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}` : 'Getting location...'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setStartCoord(userLocation)}
                        className="px-4 py-2 bg-white text-green-600 rounded-lg text-xs font-bold hover:bg-green-50 transition-colors whitespace-nowrap ml-4"
                      >
                        Confirm
                      </button>
                    </div>

                    {/* Destination Selection */}
                    <div className="border-t border-slate-200 pt-6">
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white ${endCoord ? 'bg-green-500' : 'bg-slate-300'}`}>
                          {endCoord ? '✓' : '2'}
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase font-semibold">Destination</p>
                          <p className="text-sm font-medium text-slate-900">{endCoord ? 'Selected' : 'Select destination'}</p>
                        </div>
                      </div>
                      <UnifiedLocationSearch
                        userLocation={userLocation}
                        onDestinationSelect={setEndCoord}
                        selectedDestination={endCoord}
                        onPickOnMap={() => setSelectingCoord('end')}
                      />
                    </div>

                    {/* Map/Search Buttons */}
                    {startCoord && !endCoord && (
                      <div className="grid grid-cols-2 gap-3 pt-4">
                        <button
                          onClick={() => setSelectingCoord('end')}
                          className="py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.553-.894L9 7m0 13l6.447 3.268A1 1 0 0021 17.382V6.618a1 1 0 00-1.553-.894L15 8m0 13V8m0 0L9 5m6 8v8m0-13L9 5" />
                          </svg>
                          Map
                        </button>
                        <button
                          onClick={() => setSelectingCoord(null)}
                          className="py-3 bg-gradient-to-r from-slate-200 to-slate-300 text-slate-900 rounded-lg font-medium hover:from-slate-300 hover:to-slate-400 transition-all"
                        >
                          Search
                        </button>
                      </div>
                    )}

                    {/* Vehicle Type Section */}
                    {startCoord && endCoord && (
                      <div className="border-t border-slate-200 pt-6">
                        <h4 className="text-sm font-semibold text-slate-900 mb-4">Choose Ride Type</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => setSelectedRideType('ride-share')}
                            className={`p-4 rounded-lg border-2 transition-all text-left ${selectedRideType === 'ride-share' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                          >
                            <p className="font-bold text-slate-900">Economy</p>
                            <p className="text-xs text-slate-600">Affordable & comfortable</p>
                          </button>
                          <button
                            onClick={() => setSelectedRideType('premium')}
                            className={`p-4 rounded-lg border-2 transition-all text-left ${selectedRideType === 'premium' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                          >
                            <p className="font-bold text-slate-900">Premium</p>
                            <p className="text-xs text-slate-600">Luxury ride</p>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Panel: Summary & Map */}
                  <div className="p-6 bg-gradient-to-b from-slate-50 to-slate-100">
                    {/* Trip Summary */}
                    <h4 className="text-lg font-bold text-slate-900 mb-4">Summary</h4>

                    {/* Pickup Summary */}
                    <div className={`bg-white rounded-lg p-3 mb-3 border border-slate-200 ${startCoord ? 'border-green-300 bg-green-50' : ''}`}>
                      <p className="text-xs text-slate-600 uppercase font-bold mb-1">From</p>
                      <p className="text-xs font-medium text-slate-900">Your Location</p>
                    </div>

                    {/* Arrow */}
                    <div className="text-center text-slate-400 text-sm mb-3">↓</div>

                    {/* Destination Summary */}
                    <div className={`bg-white rounded-lg p-3 mb-4 border border-slate-200 ${endCoord ? 'border-green-300 bg-green-50' : ''}`}>
                      <p className="text-xs text-slate-600 uppercase font-bold mb-1">To</p>
                      <p className="text-xs font-medium text-slate-900">{endCoord ? endCoord.address || 'Selected' : 'Not selected'}</p>
                    </div>

                    {/* Service Summary */}
                    {selectedRideType && (
                      <div className="bg-white rounded-lg p-3 mb-4 border border-slate-200">
                        <p className="text-xs text-slate-600 uppercase font-bold mb-1">Service</p>
                        <p className="text-xs font-medium text-slate-900 capitalize">{selectedRideType.replace('-', ' ')}</p>
                      </div>
                    )}

                    {/* Request Button */}
                    <button
                      onClick={requestRide}
                      disabled={!startCoord || !endCoord || loading}
                      className="w-full mt-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-bold hover:from-green-600 hover:to-emerald-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl disabled:shadow-none"
                    >
                      {loading ? 'Requesting...' : 'Request Ride'}
                    </button>
                    <p className="text-xs text-slate-600 text-center mt-3">
                      {startCoord && endCoord ? '✓ Ready' : '◦ Select locations'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Location Selection Status */}
              {selectingCoord && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                  <div className="animate-pulse w-3 h-3 bg-blue-600 rounded-full mt-1 flex-shrink-0"></div>
                  <div>
                    <p className="font-semibold text-blue-900 text-sm">Selecting Location on Map</p>
                    <p className="text-blue-700 text-xs mt-1">Click on the map to select {selectingCoord === 'start' ? 'pickup' : 'destination'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Map Section */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="relative bg-slate-100 overflow-hidden" style={{ minHeight: '500px' }}>
                <div style={{ position: 'relative', zIndex: 0, height: '100%' }}>
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
                      } else if (!startCoord) {
                        setStartCoord(coord)
                        setSelectingCoord('end')
                      }
                    }}
                    selectedMarker={selectedMarker}
                    onSelectMarker={setSelectedMarker}
                    userRole={userRole}
                    selectingCoord={selectingCoord}
                    onStartCoordDrag={setStartCoord}
                    onEndCoordDrag={setEndCoord}
                    routeGeometry={routeDetails?.geometry}
                    routeDistance={routeDetails?.distance}
                    routeDuration={routeDetails?.duration}
                    routeDetails={routeDetails}
                  />
                </div>
              </div>
            </div>

            {/* Available Drivers Listing */}
            {startCoord && endCoord && (
              <div className="mt-8">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Available Drivers Nearby
                </h3>
                <RideListings
                  drivers={drivers}
                  riders={riders}
                  startCoord={startCoord}
                  endCoord={endCoord}
                  userRole={userRole}
                  userId={userId}
                  loading={loading}
                  onSelectDriver={(driver) => {
                    handleSelectDriver(driver)
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
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Active Rides
              </h2>
              <p className="text-slate-600">Track your current rides and their status</p>
            </div>
            {activeRides.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg shadow-lg border border-slate-200 p-12 text-center">
                <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <p className="text-slate-600 text-lg mb-6 font-medium">No active rides</p>
                <button
                  onClick={() => setActiveTab('find-ride')}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors shadow-md hover:shadow-lg"
                >
                  Request a Ride
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {activeRides.map(ride => {
                  const getStatusIcon = (status) => {
                    switch(status) {
                      case 'requested': return <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v2m0-10a9 9 0 110-18 9 9 0 010 18z" /></svg>
                      case 'accepted': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      case 'in-progress': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      default: return null
                    }
                  }

                  const getStatusColor = (status) => {
                    switch(status) {
                      case 'requested': return 'border-yellow-300 bg-yellow-50'
                      case 'accepted': return 'border-green-300 bg-green-50'
                      case 'in-progress': return 'border-blue-300 bg-blue-50'
                      default: return 'border-slate-300'
                    }
                  }

                  const getStatusLabel = (status) => {
                    switch(status) {
                      case 'requested': return 'Searching for driver...'
                      case 'accepted': return 'Driver accepted - arriving soon'
                      case 'in-progress': return 'Ride in progress'
                      default: return status
                    }
                  }

                  return (
                    <div key={ride.id} className={`bg-white rounded-lg shadow-sm p-6 border-l-4 transition-all hover:shadow-md ${getStatusColor(ride.status)}`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="text-blue-600">
                            {getStatusIcon(ride.status)}
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">
                              {getStatusLabel(ride.status)}
                            </h3>
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-white text-slate-700 rounded-full text-xs font-semibold uppercase border border-current">
                          {ride.status}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 space-y-2 mt-4">
                        <div className="flex items-start gap-3">
                          <span className="font-medium text-slate-700 min-w-fit">From:</span>
                          <div className="flex-1">
                            <p className="text-slate-800 font-medium">Latitude: {ride.start_latitude.toFixed(6)}</p>
                            <p className="text-slate-800 font-medium">Longitude: {ride.start_longitude.toFixed(6)}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="font-medium text-slate-700 min-w-fit">To:</span>
                          <div className="flex-1">
                            <p className="text-slate-800 font-medium">Latitude: {ride.end_latitude.toFixed(6)}</p>
                            <p className="text-slate-800 font-medium">Longitude: {ride.end_longitude.toFixed(6)}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200">
                        <button
                          onClick={() => handleViewRideDetails(ride)}
                          className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          View Details
                        </button>
                        {ride.status !== 'requested' && (
                          <button
                            onClick={() => handleOpenChat(ride)}
                            className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                          >
                            Chat
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Scan Nearby Tab */}
        {activeTab === 'scan-nearby' && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Scan Nearby
              </h2>
              <p className="text-slate-600">Discover riders and drivers in your area</p>
            </div>
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
          <RidesHistoryView userId={userId} userRole={userRole} />
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Profile
              </h2>
              <p className="text-slate-600">Manage your account and preferences</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Profile Card */}
              <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg shadow-lg border border-blue-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Your Information
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-600 font-medium">Email:</span>
                    <span className="text-slate-900 font-mono text-sm">{userEmail}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-600 font-medium">Account Type:</span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">{userRole === 'rider' ? 'Rider' : 'Driver'}</span>
                  </div>
                  {userRole === 'driver' && (
                    <>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-slate-900">Vehicle Information</h4>
                          <button
                            onClick={() => setShowVehicleModal(true)}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col p-3 bg-white rounded-lg border border-amber-100">
                            <span className="text-slate-600 font-medium text-sm mb-2">Vehicle Type:</span>
                            <span className="text-slate-900 font-medium capitalize text-sm">{driverVehicleType || 'Not set'}</span>
                          </div>
                          <div className="flex flex-col p-3 bg-white rounded-lg border border-amber-100">
                            <span className="text-slate-600 font-medium text-sm mb-2">Make/Model:</span>
                            <span className="text-slate-900 font-medium text-sm">{driverMakeModel || 'Not set'}</span>
                          </div>
                          <div className="flex flex-col p-3 bg-white rounded-lg border border-amber-100">
                            <span className="text-slate-600 font-medium text-sm mb-2">Year:</span>
                            <span className="text-slate-900 font-medium text-sm">{driverYear || 'Not set'}</span>
                          </div>
                          <div className="flex flex-col p-3 bg-white rounded-lg border border-amber-100">
                            <span className="text-slate-600 font-medium text-sm mb-2">Fuel Type:</span>
                            <span className="text-slate-900 font-medium text-sm capitalize">{driverFuelType || 'Not set'}</span>
                          </div>
                          <div className="col-span-2 flex flex-col p-3 bg-white rounded-lg border border-amber-100">
                            <span className="text-slate-600 font-medium text-sm mb-2">Mileage:</span>
                            <span className="text-slate-900 font-medium text-sm">{driverMileage ? `${driverMileage.toLocaleString()} km` : 'Not set'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                        <span className="text-slate-600 font-medium">City:</span>
                        <span className="text-slate-900 font-medium">{driverCity || 'Not specified'}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Stats Card */}
              <div className="bg-gradient-to-br from-green-50 to-white rounded-lg shadow-lg border border-green-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Your Statistics
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-600 font-medium">Total Rides:</span>
                    <span className="text-2xl font-bold text-green-600">0</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-600 font-medium">Rating:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-2xl font-bold text-amber-500">5.0</span>
                      <svg className="w-5 h-5 text-amber-400 fill-current" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-600 font-medium">Member Since:</span>
                    <span className="text-slate-900 font-medium">{new Date().toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Transaction History Button */}
            <button
              onClick={() => setShowTransactionHistoryModal(true)}
              className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg font-semibold hover:shadow-lg transition-shadow flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              View Transaction History
            </button>
          </div>
        )}
          </>
        )}
      </div>

      {/* Modals */}
      {showDriverProfileModal && selectedDriver && (
        <DriverProfileModal
          driver={selectedDriver}
          onClose={() => setShowDriverProfileModal(false)}
          onRequestRide={handleRequestRideFromDriver}
          loading={loading}
        />
      )}

      {showRideDetailsModal && selectedRide && (
        <RideDetailsModal
          ride={selectedRide}
          driver={drivers.find(d => d.id === selectedRide.driver_id)}
          onClose={() => setShowRideDetailsModal(false)}
          onCancelRide={handleCancelRide}
          onUpdateStatus={handleUpdateRideStatus}
          loading={loading}
        />
      )}

      {showChatModal && selectedRide && (
        <ChatModal
          ride={selectedRide}
          currentUserId={userId}
          otherUserName={selectedRide.driver_id ? drivers.find(d => d.id === selectedRide.driver_id)?.driver_name || 'Driver' : 'Rider'}
          onClose={() => setShowChatModal(false)}
          onSendMessage={handleSendMessage}
          loading={loading}
        />
      )}

      {showPaymentModal && selectedRide && (
        <PaymentModal
          ride={selectedRide}
          onClose={() => setShowPaymentModal(false)}
          onCompletePayment={handleCompletePayment}
          loading={loading}
        />
      )}

      {showRatingModal && selectedRide && (
        <RatingModal
          ride={selectedRide}
          otherUserName={selectedRide.driver_id ? drivers.find(d => d.id === selectedRide.driver_id)?.driver_name || 'Driver' : 'Rider'}
          onClose={() => setShowRatingModal(false)}
          onSubmitRating={handleSubmitRating}
          loading={loading}
        />
      )}

      {showTransactionHistoryModal && (
        <TransactionHistoryModal
          userId={userId}
          onClose={() => setShowTransactionHistoryModal(false)}
          loading={loading}
        />
      )}

      {/* Ride Type Selection Modal */}
      <RideTypeModal
        isOpen={showRideTypeModal}
        onClose={() => setShowRideTypeModal(false)}
        onSelectRideType={setSelectedRideType}
        selectedRideType={selectedRideType}
      />

      {/* Services Selection Modal */}
      <ServicesModal
        isOpen={showServicesModal}
        onClose={() => setShowServicesModal(false)}
        onSelectService={setSelectedService}
        selectedService={selectedService}
      />

      {/* Vehicle Configuration Modal */}
      {showVehicleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Vehicle Configuration</h2>

            <div className="space-y-4">
              {/* Vehicle Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Vehicle Type</label>
                <select
                  value={driverVehicleType}
                  onChange={(e) => setDriverVehicleType(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="car">Car</option>
                  <option value="suv">SUV</option>
                  <option value="van">Van</option>
                  <option value="tricycle">Tricycle</option>
                  <option value="truck">Truck</option>
                  <option value="motorcycle">Motorcycle</option>
                </select>
              </div>

              {/* Make/Model */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Make & Model</label>
                <input
                  type="text"
                  placeholder="e.g., Toyota Corolla"
                  value={driverMakeModel}
                  onChange={(e) => setDriverMakeModel(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Year */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Year</label>
                <input
                  type="number"
                  placeholder="e.g., 2020"
                  value={driverYear}
                  onChange={(e) => setDriverYear(e.target.value)}
                  min="1900"
                  max={new Date().getFullYear() + 1}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Fuel Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Fuel Type</label>
                <select
                  value={driverFuelType}
                  onChange={(e) => setDriverFuelType(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="gasoline">Gasoline</option>
                  <option value="diesel">Diesel</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="electric">Electric</option>
                  <option value="lpg">LPG</option>
                </select>
              </div>

              {/* Mileage */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Mileage (km)</label>
                <input
                  type="number"
                  placeholder="e.g., 45000"
                  value={driverMileage}
                  onChange={(e) => setDriverMileage(e.target.value ? parseInt(e.target.value) : '')}
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowVehicleModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveVehicleInfo}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Save Vehicle Info
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
