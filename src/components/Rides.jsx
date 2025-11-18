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
import LocationModal from './LocationModal'
import RideTypeModal from './RideTypeModal'
import RideDetailsCard from './RideDetailsCard'
import RoutePolyline from './RoutePolyline'
import UnifiedLocationSearch from './UnifiedLocationSearch'

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

function MapComponent({ userLocation, drivers, riders, startCoord, endCoord, onMapClick, selectedMarker, onSelectMarker, userRole, onStartCoordDrag, onEndCoordDrag, selectingCoord, routeGeometry, routeDistance, routeDuration }) {
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

        {/* Route Polyline */}
        {routeGeometry && (
          <RoutePolyline
            geometry={routeGeometry}
            distance={routeDistance}
            duration={routeDuration}
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

  // Modal states
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [locationModalType, setLocationModalType] = useState('pickup') // 'pickup' or 'destination'
  const [showRideTypeModal, setShowRideTypeModal] = useState(false)
  const [selectedRideType, setSelectedRideType] = useState(null)

  // Route details
  const [routeDetails, setRouteDetails] = useState(null)

  // Driver status
  const [driverStatus, setDriverStatus] = useState('offline') // 'offline', 'available', 'on-job'
  const [driverVehicleType, setDriverVehicleType] = useState('car') // 'car', 'tricycle'
  const [driverCity, setDriverCity] = useState('')

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
        {/* Find Ride Tab */}
        {activeTab === 'find-ride' && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Find a Ride</h2>
              <p className="text-slate-600">Select your pickup and destination locations on the map or enter coordinates directly</p>
            </div>

            {/* Map */}
            <div className="mb-6">
              <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.553-.894L9 7m0 13l6.447 3.268A1 1 0 0021 17.382V6.618a1 1 0 00-1.553-.894L15 8m0 13V8m0 0L9 5m6 8v8m0-13L9 5" />
                    </svg>
                    Interactive Map
                  </h3>
                  {selectingCoord && (
                    <span className="text-sm font-medium px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                      Selecting {selectingCoord === 'start' ? 'pickup' : 'destination'}
                    </span>
                  )}
                </div>
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
                  routeGeometry={routeDetails?.geometry}
                  routeDistance={routeDetails?.distance}
                  routeDuration={routeDetails?.duration}
                />
              </div>
            </div>

            {/* Ride Request Form */}
            <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-6 space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Request a Ride
                </h3>

                {/* Unified Location Search */}
                <UnifiedLocationSearch
                  userLocation={userLocation}
                  onDestinationSelect={setEndCoord}
                  selectedDestination={endCoord}
                  mapHeight="300px"
                />

                {/* Auto-set pickup to user location */}
                {userLocation && !startCoord && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setStartCoord(userLocation)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium py-2"
                    >
                      Confirm Your Location as Pickup Point
                    </button>
                  </div>
                )}

                {startCoord && endCoord && (
                  <div className="mt-4 bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <p className="text-sm text-blue-900 font-semibold flex items-center gap-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Route is ready for your ride request
                    </p>
                  </div>
                )}
              </div>

              {/* Ride Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-3">Ride Type</label>
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
                    Select Ride Type
                  </button>
                )}
              </div>

              {/* Ride Details Card */}
              {startCoord && endCoord && (
                <RideDetailsCard
                  startCoord={startCoord}
                  endCoord={endCoord}
                  rideType={selectedRideType || 'ride-share'}
                  onDetailsUpdate={setRouteDetails}
                  loading={loading}
                />
              )}

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
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2m6-11a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Ride History
              </h2>
              <p className="text-slate-600">View your past rides and details</p>
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg shadow-lg border border-slate-200 p-12 text-center">
              <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2m6-11a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-slate-600 text-lg font-medium">Ride history will appear here</p>
            </div>
          </div>
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
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                        <span className="text-slate-600 font-medium">Vehicle:</span>
                        <span className="text-slate-900 font-medium capitalize">{driverVehicleType}</span>
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

      {/* Location Selection Modal */}
      <LocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onSelectLocation={(location) => {
          if (locationModalType === 'pickup') {
            setStartCoord(location)
          } else {
            setEndCoord(location)
          }
        }}
        locationType={locationModalType}
        currentLocation={locationModalType === 'pickup' ? startCoord : endCoord}
        userLocation={userLocation}
        savedLocations={[]}
      />

      {/* Ride Type Selection Modal */}
      <RideTypeModal
        isOpen={showRideTypeModal}
        onClose={() => setShowRideTypeModal(false)}
        onSelectRideType={setSelectedRideType}
        selectedRideType={selectedRideType}
      />
    </div>
  )
}
