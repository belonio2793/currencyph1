import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useGeolocation } from '../lib/useGeolocation'
import { calculateDistance } from '../lib/rideCalculations'
import { PHILIPPINE_CITIES_COMPLETE, findClosestCity } from '../data/philippineCitiesComplete'

export default function RideScanNearby({ userId, onSelectDriver, onSelectRider, onSelectCity }) {
  const { location } = useGeolocation()
  const [detectedCity, setDetectedCity] = useState(null)
  const [selectedCity, setSelectedCity] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [riders, setRiders] = useState([])
  const [loading, setLoading] = useState(false)
  const [scanRadius, setScanRadius] = useState(50) // in km
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredCities, setFilteredCities] = useState(PHILIPPINE_CITIES_COMPLETE)

  // Auto-detect city based on current location
  useEffect(() => {
    if (location) {
      const detected = findClosestCity(location.latitude, location.longitude)
      setDetectedCity(detected)
      if (!selectedCity) {
        setSelectedCity(detected)
        scanCity(detected)
      }
    }
  }, [location])

  // Filter cities based on search query
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = PHILIPPINE_CITIES_COMPLETE.filter((city) =>
        city.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        city.region.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredCities(filtered)
    } else {
      setFilteredCities(PHILIPPINE_CITIES_COMPLETE)
    }
  }, [searchQuery])

  // Auto-scan when city selection changes
  useEffect(() => {
    if (selectedCity) {
      scanCity(selectedCity)
      onSelectCity?.(selectedCity)
    }
  }, [selectedCity, scanRadius])

  const detectCity = (latitude, longitude) => {
    let closestCity = null
    let closestDistance = Infinity

    PHILIPPINE_CITIES.forEach(city => {
      const dist = calculateDistance(latitude, longitude, city.lat, city.lng)
      if (dist < closestDistance) {
        closestDistance = dist
        closestCity = city
      }
    })

    // Only return city if within reasonable distance
    if (closestCity && closestDistance < 100) {
      return closestCity
    }
    return null
  }

  const scanCity = async (city) => {
    if (!city) return

    setLoading(true)
    try {
      // Load available drivers in city
      const { data: driversData, error: driverError } = await supabase
        .from('ride_profiles')
        .select('id, user_id, full_name, vehicle_type, status, latitude, longitude, average_rating')
        .eq('role', 'driver')
        .eq('status', 'available')
        .eq('city', city.name)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .limit(50)

      if (!driverError && driversData) {
        // Filter by radius
        const filtered = driversData.filter(d => {
          const dist = calculateDistance(city.lat, city.lng, parseFloat(d.latitude), parseFloat(d.longitude))
          return dist <= scanRadius
        }).map(d => ({
          id: d.user_id,
          driver_name: d.full_name || 'Driver',
          vehicle_type: d.vehicle_type || 'Car',
          latitude: parseFloat(d.latitude),
          longitude: parseFloat(d.longitude),
          rating: d.average_rating || 5.0,
          distance: calculateDistance(city.lat, city.lng, parseFloat(d.latitude), parseFloat(d.longitude))
        }))

        setDrivers(filtered.sort((a, b) => a.distance - b.distance))
      }

      // Load active riders in city
      const { data: ridesData, error: ridesError } = await supabase
        .from('rides')
        .select('id, rider_id, start_latitude, start_longitude, status')
        .in('status', ['requested', 'accepted'])
        .limit(50)

      if (!ridesError && ridesData) {
        const filtered = ridesData.filter(r => {
          const dist = calculateDistance(city.lat, city.lng, parseFloat(r.start_latitude), parseFloat(r.start_longitude))
          return dist <= scanRadius
        }).map(r => ({
          id: r.rider_id,
          latitude: parseFloat(r.start_latitude),
          longitude: parseFloat(r.start_longitude),
          passenger_name: 'Passenger',
          rating: 5.0,
          distance: calculateDistance(city.lat, city.lng, parseFloat(r.start_latitude), parseFloat(r.start_longitude))
        }))

        setRiders(filtered.sort((a, b) => a.distance - b.distance))
      }
    } catch (err) {
      console.warn('Scan error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Auto-detected Location */}
      {detectedCity && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">📍</span>
            <div>
              <p className="text-sm font-medium text-slate-900">Current Location Detected</p>
              <p className="text-xs text-slate-600">{detectedCity.name}</p>
            </div>
          </div>
          <p className="text-xs text-blue-700">
            Automatically showing nearby drivers and riders in {detectedCity.name}
          </p>
        </div>
      )}

      {/* City Selector */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Select City</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {PHILIPPINE_CITIES.map(city => (
            <button
              key={city.name}
              onClick={() => setSelectedCity(city)}
              className={`p-3 rounded-lg border-2 transition-all ${
                selectedCity?.name === city.name
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-slate-200 hover:border-blue-400'
              }`}
            >
              <p className="text-sm font-medium text-slate-900">{city.name}</p>
              <p className="text-xs text-slate-600 mt-1">
                {drivers.filter(d => {
                  const dist = calculateDistance(city.lat, city.lng, d.latitude, d.longitude)
                  return dist <= scanRadius
                }).length} drivers
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Scan Radius Control */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Scan Radius</h3>
        <div className="space-y-3">
          <input
            type="range"
            min="10"
            max="100"
            step="10"
            value={scanRadius}
            onChange={(e) => setScanRadius(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">10 km</span>
            <span className="font-semibold text-blue-600">{scanRadius} km</span>
            <span className="text-slate-600">100 km</span>
          </div>
          <p className="text-xs text-slate-600">
            Adjust to find drivers and riders within your preferred distance
          </p>
        </div>
      </div>

      {/* Stats */}
      {selectedCity && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-purple-600">{drivers.length}</p>
            <p className="text-sm text-purple-900 mt-1">🚗 Available Drivers</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-orange-600">{riders.length}</p>
            <p className="text-sm text-orange-900 mt-1">👥 Looking for Rides</p>
          </div>
        </div>
      )}

      {/* Drivers List */}
      {selectedCity && drivers.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            🚗 Available Drivers in {selectedCity.name}
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {drivers.map(driver => (
              <div
                key={driver.id}
                onClick={() => onSelectDriver?.(driver)}
                className="p-4 border border-slate-200 rounded-lg hover:shadow-md hover:border-blue-500 cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{driver.driver_name}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      {driver.vehicle_type} • {driver.distance.toFixed(1)} km away
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-yellow-500 font-semibold">★ {driver.rating.toFixed(1)}</p>
                    <p className="text-xs text-slate-600 mt-1">Available now</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Riders List */}
      {selectedCity && riders.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            👥 Riders Looking for Rides
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {riders.map(rider => (
              <div
                key={rider.id}
                onClick={() => onSelectRider?.(rider)}
                className="p-4 bg-orange-50 border border-orange-200 rounded-lg hover:shadow-md cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{rider.passenger_name}</p>
                    <p className="text-xs text-slate-600 mt-1">{rider.distance.toFixed(1)} km away</p>
                  </div>
                  <button className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium">
                    View Request
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedCity && drivers.length === 0 && riders.length === 0 && !loading && (
        <div className="bg-slate-50 rounded-lg p-12 text-center border-2 border-dashed border-slate-300">
          <p className="text-slate-600 text-lg mb-2">📍 No users nearby</p>
          <p className="text-slate-500 text-sm mb-4">Try increasing the scan radius or selecting another city</p>
          <button
            onClick={() => setScanRadius(Math.min(scanRadius + 10, 100))}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Increase Scan Radius
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-blue-50 rounded-lg p-8 text-center">
          <p className="text-blue-600 font-medium">🔍 Scanning nearby...</p>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
        <p className="font-medium mb-2">💡 How to Use Scan Nearby:</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Your city is automatically detected based on your location</li>
          <li>Choose a different city from the grid above</li>
          <li>Adjust the scan radius to find users at different distances</li>
          <li>Click on any driver or rider to view details</li>
          <li>As a driver, you can accept nearby ride requests</li>
          <li>As a rider, you can request a ride from nearby drivers</li>
        </ul>
      </div>
    </div>
  )
}
