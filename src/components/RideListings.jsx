import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { calculateDistance, calculateEstimatedTime, calculateBaseFare } from '../lib/rideCalculations'

export default function RideListings({ riders, drivers, startCoord, endCoord, onSelectDriver, onSelectRider, userRole, userId, loading }) {
  const [sortBy, setSortBy] = useState('distance') // 'distance', 'price', 'rating'
  const [filterVehicle, setFilterVehicle] = useState('all') // 'all', 'car', 'tricycle'

  // Calculate distance between two coordinates
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Calculate estimated time (roughly 40 km/h average speed)
  const calculateTime = (distance) => {
    return Math.ceil((distance / 40) * 60)
  }

  // Calculate fare based on vehicle type and distance
  const calculateFare = (distance, vehicleType = 'car') => {
    const baseFare = 50
    const perKm = 20
    const multiplier = vehicleType === 'tricycle' ? 0.7 : 1.0
    return Math.ceil((baseFare + distance * perKm) * multiplier)
  }

  // Filter and sort drivers
  const getFilteredAndSortedDrivers = () => {
    let filtered = drivers.filter(d => {
      if (filterVehicle !== 'all' && d.vehicle_type !== filterVehicle) return false
      return true
    })

    if (!startCoord) return filtered

    return filtered.sort((a, b) => {
      const distA = calculateDistance(
        startCoord.latitude,
        startCoord.longitude,
        a.latitude,
        a.longitude
      )
      const distB = calculateDistance(
        startCoord.latitude,
        startCoord.longitude,
        b.latitude,
        b.longitude
      )

      if (sortBy === 'distance') {
        return distA - distB
      } else if (sortBy === 'rating') {
        return (b.rating || 5) - (a.rating || 5)
      } else if (sortBy === 'price') {
        const fareA = calculateFare(distA, a.vehicle_type)
        const fareB = calculateFare(distB, b.vehicle_type)
        return fareA - fareB
      }
      return 0
    })
  }

  const getRenderDrivers = () => {
    return getFilteredAndSortedDrivers().slice(0, 10)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <p className="text-slate-600 text-center">Loading drivers...</p>
      </div>
    )
  }

  const filteredDrivers = getRenderDrivers()

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="grid grid-cols-3 gap-3">
          {/* Sort By */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="distance">🗺️ Distance</option>
              <option value="price">💰 Price</option>
              <option value="rating">⭐ Rating</option>
            </select>
          </div>

          {/* Filter Vehicle */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Vehicle</label>
            <select
              value={filterVehicle}
              onChange={(e) => setFilterVehicle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Vehicles</option>
              <option value="car">🚗 Car</option>
              <option value="tricycle">🛺 Tricycle</option>
            </select>
          </div>

          {/* Show count */}
          <div className="flex items-end">
            <p className="text-xs font-medium text-slate-600">
              {filteredDrivers.length} drivers available
            </p>
          </div>
        </div>
      </div>

      {/* Driver List */}
      {filteredDrivers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <p className="text-slate-600 mb-4">No drivers available at the moment</p>
          <p className="text-xs text-slate-500">Try again in a few moments</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredDrivers.map((driver) => {
            const distance = calculateDistance(
              startCoord?.latitude || 0,
              startCoord?.longitude || 0,
              driver.latitude,
              driver.longitude
            )
            const time = calculateTime(distance)
            const fare = calculateFare(distance, driver.vehicle_type)

            return (
              <div
                key={driver.id}
                onClick={() => onSelectDriver?.(driver)}
                className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-blue-600"
              >
                <div className="flex items-start justify-between">
                  {/* Driver Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {driver.driver_name?.charAt(0) || 'D'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{driver.driver_name || 'Unknown Driver'}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded font-medium">
                            {driver.vehicle_type === 'tricycle' ? '🛺' : '🚗'} {driver.vehicle_type || 'Car'}
                          </span>
                          <span className="text-yellow-500 text-sm">★ {driver.rating?.toFixed(1) || '5.0'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="text-right">
                    <div className="mb-2">
                      <p className="text-lg font-bold text-slate-900">₱{fare}</p>
                      <p className="text-xs text-slate-600">{time} min</p>
                    </div>
                    <p className="text-xs text-slate-500">{distance.toFixed(1)} km away</p>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  className="w-full mt-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Select Driver
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Rider Listings (for drivers) */}
      {userRole === 'driver' && riders.length > 0 && (
        <div className="mt-8 pt-8 border-t border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">👥 Riders Nearby Looking for Rides</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {riders.slice(0, 5).map((rider) => (
              <div
                key={rider.id}
                onClick={() => onSelectRider?.(rider)}
                className="bg-orange-50 border border-orange-200 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{rider.passenger_name || 'Passenger'}</p>
                    <p className="text-xs text-slate-600 mt-1">Looking for a ride</p>
                  </div>
                  <button
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
