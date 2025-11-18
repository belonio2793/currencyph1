/**
 * Ride Calculations Utility
 * Provides functions for distance, time, and fare calculations
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Starting latitude
 * @param {number} lon1 - Starting longitude
 * @param {number} lat2 - Ending latitude
 * @param {number} lon2 - Ending longitude
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Calculate estimated time based on distance
 * Assumes average speed of 40 km/h in urban areas
 * @param {number} distance - Distance in kilometers
 * @param {string} areaType - 'urban' or 'highway' (default: 'urban')
 * @returns {number} Estimated time in minutes
 */
export const calculateEstimatedTime = (distance, areaType = 'urban') => {
  const speed = areaType === 'highway' ? 80 : 40 // km/h
  return Math.ceil((distance / speed) * 60)
}

/**
 * Calculate fare based on distance and vehicle type
 * Pricing formula:
 * - Base fare: ₱50
 * - Per km: ₱20
 * - Vehicle multiplier: 1.0 (car), 0.7 (tricycle)
 * @param {number} distance - Distance in kilometers
 * @param {string} vehicleType - 'car' or 'tricycle'
 * @returns {number} Estimated fare in PHP
 */
export const calculateBaseFare = (distance, vehicleType = 'car') => {
  const baseFare = 50
  const perKm = 20
  const vehicleMultiplier = vehicleType === 'tricycle' ? 0.7 : 1.0
  return Math.ceil((baseFare + distance * perKm) * vehicleMultiplier)
}

/**
 * Calculate surge pricing multiplier based on demand
 * @param {number} activeDemand - Number of active ride requests
 * @param {number} activeSupply - Number of available drivers
 * @returns {number} Surge multiplier (1.0 = no surge, 2.0 = 2x price)
 */
export const calculateSurgeMultiplier = (activeDemand, activeSupply) => {
  if (activeSupply === 0) return 3.0 // No drivers available
  const demandRatio = activeDemand / activeSupply
  if (demandRatio < 0.5) return 1.0
  if (demandRatio < 1) return 1.25
  if (demandRatio < 2) return 1.5
  if (demandRatio < 3) return 1.75
  return 2.0
}

/**
 * Calculate total fare with all adjustments
 * @param {number} distance - Distance in kilometers
 * @param {number} time - Estimated time in minutes
 * @param {string} vehicleType - 'car' or 'tricycle'
 * @param {number} surgeMultiplier - Surge pricing multiplier
 * @param {number} timeOfDayMultiplier - Multiplier for time of day
 * @returns {object} Fare breakdown
 */
export const calculateTotalFare = (
  distance,
  time,
  vehicleType = 'car',
  surgeMultiplier = 1.0,
  timeOfDayMultiplier = 1.0
) => {
  const baseFare = calculateBaseFare(distance, vehicleType)
  const distanceFare = Math.ceil(distance * 20)
  const timeFare = Math.ceil(time * 5)
  
  const subtotal = baseFare + distanceFare + timeFare
  const surgePrice = Math.ceil(subtotal * (surgeMultiplier - 1))
  const timeAdjustment = Math.ceil(subtotal * (timeOfDayMultiplier - 1))
  
  const total = Math.ceil(subtotal * surgeMultiplier * timeOfDayMultiplier)

  return {
    baseFare,
    distanceFare,
    timeFare,
    subtotal,
    surgePrice,
    timeAdjustment,
    surgeMultiplier,
    timeOfDayMultiplier,
    total
  }
}

/**
 * Get time of day multiplier for pricing
 * Peak hours: 7-10 AM, 5-8 PM (1.5x)
 * Normal hours: 10 AM-5 PM, 8 PM-7 AM (1.0x)
 * @returns {number} Time of day multiplier
 */
export const getTimeOfDayMultiplier = () => {
  const hour = new Date().getHours()
  // Peak morning (7-10 AM) and evening (5-8 PM)
  if ((hour >= 7 && hour < 10) || (hour >= 17 && hour < 20)) {
    return 1.5
  }
  return 1.0
}

/**
 * Format fare for display
 * @param {number} fare - Fare amount in PHP
 * @returns {string} Formatted fare string
 */
export const formatFare = (fare) => {
  return `₱${Math.round(fare).toLocaleString()}`
}

/**
 * Format distance for display
 * @param {number} distance - Distance in kilometers
 * @returns {string} Formatted distance string
 */
export const formatDistance = (distance) => {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`
  }
  return `${distance.toFixed(1)}km`
}

/**
 * Format time for display
 * @param {number} minutes - Time in minutes
 * @returns {string} Formatted time string
 */
export const formatTime = (minutes) => {
  if (minutes < 60) {
    return `${minutes}min`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

/**
 * Get vehicle type icon
 * @param {string} vehicleType - 'car', 'tricycle', etc.
 * @returns {string} Emoji icon
 */
export const getVehicleIcon = (vehicleType) => {
  switch (vehicleType?.toLowerCase()) {
    case 'tricycle':
      return '🛺'
    case 'motorcycle':
      return '🏍️'
    case 'van':
      return '🚐'
    case 'car':
    default:
      return '🚗'
  }
}

/**
 * Estimate arrival time for a driver at pickup location
 * @param {number} driverDistance - Distance of driver from pickup
 * @returns {number} Estimated arrival time in minutes
 */
export const estimateArrivalTime = (driverDistance) => {
  // Assuming average 40 km/h speed in urban areas
  return Math.ceil((driverDistance / 40) * 60)
}

/**
 * Calculate cancellation fee based on ride status
 * @param {string} rideStatus - 'requested', 'accepted', 'picked-up'
 * @returns {number} Cancellation fee in PHP
 */
export const calculateCancellationFee = (rideStatus) => {
  switch (rideStatus) {
    case 'requested':
      return 0 // No fee
    case 'accepted':
      return 25 // Driver on the way
    case 'picked-up':
      return 50 // Ride already started
    default:
      return 0
  }
}

/**
 * Validate ride coordinates
 * @param {object} startCoord - Start coordinate {latitude, longitude}
 * @param {object} endCoord - End coordinate {latitude, longitude}
 * @returns {object} Validation result {valid: boolean, error: string}
 */
export const validateRideCoordinates = (startCoord, endCoord) => {
  if (!startCoord || !endCoord) {
    return { valid: false, error: 'Please select both pickup and destination' }
  }

  const distance = calculateDistance(
    startCoord.latitude,
    startCoord.longitude,
    endCoord.latitude,
    endCoord.longitude
  )

  if (distance < 0.1) {
    return { valid: false, error: 'Pickup and destination are too close' }
  }

  if (distance > 100) {
    return { valid: false, error: 'Ride distance is too far (maximum 100 km)' }
  }

  return { valid: true }
}

/**
 * Check if coordinates are within Philippines
 * @param {number} latitude
 * @param {number} longitude
 * @returns {boolean} True if within Philippines bounds
 */
export const isWithinPhilippines = (latitude, longitude) => {
  // Philippines rough bounds
  return latitude >= 4.6 && latitude <= 20.0 && longitude >= 119.0 && longitude <= 128.5
}
