// Service for calculating routes, distances, and fare estimates using MapTiler Directions API

const MAPTILER_KEY = import.meta?.env?.VITE_MAPTILER_API_KEY || ''

export async function getRoute(startLat, startLng, endLat, endLng) {
  try {
    const url = `https://api.maptiler.com/routing/v1/directions/driving/${startLng},${startLat};${endLng},${endLat}?key=${MAPTILER_KEY}&steps=true&alternatives=false&overview=full&geometries=geojson`
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Routing API error: ${response.status}`)
    }

    const data = await response.json()
    if (!data.routes || data.routes.length === 0) {
      throw new Error('No route found')
    }

    const route = data.routes[0]
    return {
      distance: route.distance / 1000, // Convert to km
      duration: Math.ceil(route.duration / 60), // Convert to minutes
      geometry: route.geometry.coordinates,
      steps: route.steps || []
    }
  } catch (error) {
    console.error('Routing error:', error)
    // Fallback to direct distance calculation
    const distance = calculateHaversineDistance(startLat, startLng, endLat, endLng)
    const duration = Math.ceil((distance / 40) * 60) // Assume 40 km/h average
    return {
      distance,
      duration,
      geometry: [[startLng, startLat], [endLng, endLat]],
      steps: []
    }
  }
}

// Haversine formula for direct distance calculation (fallback)
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Calculate fare based on distance, ride type, and demand
export function calculateFare(distance, duration, rideType = 'ride-share', demandMultiplier = 1.0) {
  // Base pricing per ride type
  const pricing = {
    'ride-share': { base: 50, perKm: 12 },
    'package': { base: 40, perKm: 10 },
    'food': { base: 35, perKm: 8 },
    'laundry': { base: 60, perKm: 8 },
    'medical': { base: 80, perKm: 15 },
    'documents': { base: 75, perKm: 12 }
  }

  const rates = pricing[rideType] || pricing['ride-share']
  const baseFare = rates.base
  const distanceFare = Math.max(distance * rates.perKm, 0)
  
  // Add small time-based fee (₱2 per minute for waiting/traffic)
  const timeFare = Math.ceil(duration * 0.5)
  
  // Apply demand multiplier
  const subtotal = (baseFare + distanceFare + timeFare) * demandMultiplier
  
  // Add 12% VAT
  const vat = Math.ceil(subtotal * 0.12)
  const total = Math.ceil(subtotal + vat)

  return {
    baseFare: Math.ceil(baseFare),
    distanceFare: Math.ceil(distanceFare),
    timeFare: Math.ceil(timeFare),
    subtotal: Math.ceil(subtotal),
    vat: vat,
    total: total,
    demandMultiplier: demandMultiplier
  }
}

// Format distance for display
export function formatDistance(km) {
  if (km < 1) {
    return Math.round(km * 1000) + ' m'
  }
  return km.toFixed(1) + ' km'
}

// Format duration for display
export function formatDuration(minutes) {
  if (minutes < 60) {
    return minutes + ' min'
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

// Convert GeoJSON coordinates to Leaflet format
export function createRoutePolyline(coordinates) {
  if (!coordinates || !Array.isArray(coordinates)) {
    return []
  }
  // Convert [lon, lat] to [lat, lon]
  return coordinates.map(coord => [coord[1], coord[0]])
}

// Parse direction steps from route response
export function parseDirectionSteps(steps) {
  if (!steps || !Array.isArray(steps)) {
    return []
  }
  return steps.map(step => ({
    instruction: step.name || 'Continue',
    distance: step.distance ? (step.distance / 1000).toFixed(1) : '0',
    duration: step.duration ? Math.ceil(step.duration / 60) : 0
  }))
}

// Get distance between two points (legacy function for compatibility)
export function getDistance(lat1, lon1, lat2, lon2) {
  return calculateHaversineDistance(lat1, lon1, lat2, lon2)
}
