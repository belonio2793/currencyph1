// Service for calculating routes, distances, and fare estimates using multiple APIs with fallbacks
// Supports: Google Maps API, MapTiler, and Leaflet (Haversine) fallback

const MAPTILER_KEY = import.meta?.env?.VITE_MAPTILER_API_KEY || ''
const GOOGLE_API_KEY = import.meta?.env?.VITE_GOOGLE_API_KEY || ''

// Route source tracking
const ROUTE_SOURCES = {
  GOOGLE: 'Google Maps Directions API',
  MAPTILER: 'MapTiler Directions API',
  LEAFLET: 'Leaflet (Haversine fallback)',
  DIRECT: 'Direct calculation'
}

/**
 * Get route with multi-source support and real-time estimation
 * Tries Google Maps first, then MapTiler, then Leaflet fallback
 */
export async function getRoute(startLat, startLng, endLat, endLng, options = {}) {
  const { preferredSource = null, timeout = 10000 } = options

  try {
    let result = null

    // Try preferred source first
    if (preferredSource === 'google' && GOOGLE_API_KEY) {
      result = await tryGoogleMapsRoute(startLat, startLng, endLat, endLng, timeout)
      if (result) return result
    }

    // Try MapTiler
    if (MAPTILER_KEY) {
      result = await tryMapTilerRoute(startLat, startLng, endLat, endLng, timeout)
      if (result) return result
    }

    // Try Google Maps as secondary option
    if (!preferredSource && GOOGLE_API_KEY) {
      result = await tryGoogleMapsRoute(startLat, startLng, endLat, endLng, timeout)
      if (result) return result
    }

    // Fallback to Leaflet (Haversine calculation)
    return calculateDirectRoute(startLat, startLng, endLat, endLng)
  } catch (error) {
    console.debug('Routing error:', error?.message)
    return calculateDirectRoute(startLat, startLng, endLat, endLng)
  }
}

/**
 * Try Google Maps Directions API
 */
async function tryGoogleMapsRoute(startLat, startLng, endLat, endLng, timeout) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const url = new URL('https://maps.googleapis.com/maps/api/directions/json')
    url.searchParams.set('origin', `${startLat},${startLng}`)
    url.searchParams.set('destination', `${endLat},${endLng}`)
    url.searchParams.set('key', GOOGLE_API_KEY)
    url.searchParams.set('mode', 'driving')
    url.searchParams.set('alternatives', 'false')

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      console.debug(`Google Maps API error: ${response.status}`)
      return null
    }

    const data = await response.json()
    if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
      console.debug(`Google Maps returned status: ${data.status}`)
      return null
    }

    const route = data.routes[0]
    const leg = route.legs[0]

    // Decode polyline
    const coordinates = decodePolyline(route.overview_polyline.points)

    // Parse steps
    const steps = leg.steps.map(step => ({
      instruction: step.html_instructions?.replace(/<[^>]*>/g, '') || 'Continue',
      distance: (step.distance.value / 1000).toFixed(1),
      duration: Math.ceil(step.duration.value / 60),
      location: [step.end_location.lat, step.end_location.lng]
    }))

    return {
      success: true,
      distance: leg.distance.value / 1000,
      duration: Math.ceil(leg.duration.value / 60),
      geometry: coordinates.map(c => [c[1], c[0]]), // Convert to [lng, lat]
      coordinates: coordinates.map(c => [c[1], c[0]]),
      steps: steps,
      source: ROUTE_SOURCES.GOOGLE,
      rawData: { route, leg }
    }
  } catch (error) {
    console.debug('Google Maps route error:', error?.message)
    return null
  }
}

/**
 * Try MapTiler Directions API
 */
async function tryMapTilerRoute(startLat, startLng, endLat, endLng, timeout) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const url = `https://api.maptiler.com/routing/v1/directions/driving/${startLng},${startLat};${endLng},${endLat}?key=${MAPTILER_KEY}&steps=true&alternatives=false&overview=full&geometries=geojson&language=en`

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 404 || response.status === 401) {
        console.debug('MapTiler API not available')
        return null
      }
      throw new Error(`MapTiler API error: ${response.status}`)
    }

    const data = await response.json()
    if (!data.routes || data.routes.length === 0) {
      console.debug('MapTiler returned no routes')
      return null
    }

    const route = data.routes[0]
    return {
      success: true,
      distance: route.distance / 1000,
      duration: Math.ceil(route.duration / 60),
      geometry: route.geometry.coordinates,
      coordinates: route.geometry.coordinates,
      steps: (route.steps || []).map(step => ({
        instruction: step.name || 'Continue',
        distance: (step.distance / 1000).toFixed(1),
        duration: Math.ceil(step.duration / 60),
        location: step.geometry ? step.geometry.coordinates : null
      })),
      source: ROUTE_SOURCES.MAPTILER,
      rawData: { route }
    }
  } catch (error) {
    console.debug('MapTiler route error:', error?.message)
    return null
  }
}

/**
 * Get real-time route updates and ETA monitoring
 */
export async function monitorRouteRealtime(startLat, startLng, endLat, endLng, callback, interval = 30000) {
  const updateRoute = async () => {
    try {
      const route = await getRoute(startLat, startLng, endLat, endLng)
      if (route.success) {
        callback({
          success: true,
          distance: route.distance,
          duration: route.duration,
          geometry: route.geometry,
          source: route.source || ROUTE_SOURCES.LEAFLET,
          updatedAt: new Date().toISOString()
        })
      }
    } catch (err) {
      callback({
        success: false,
        error: err?.message,
        updatedAt: new Date().toISOString()
      })
    }
  }

  // Initial update
  await updateRoute()

  // Set up interval for updates
  const intervalId = setInterval(updateRoute, interval)

  // Return unsubscribe function
  return () => clearInterval(intervalId)
}

function calculateDirectRoute(startLat, startLng, endLat, endLng) {
  const distance = calculateHaversineDistance(startLat, startLng, endLat, endLng)
  const duration = Math.ceil((distance / 40) * 60) // Assume 40 km/h average
  return {
    success: true,
    distance,
    duration,
    geometry: [[startLng, startLat], [endLng, endLat]],
    coordinates: [[startLng, startLat], [endLng, endLat]], // For compatibility
    steps: []
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
