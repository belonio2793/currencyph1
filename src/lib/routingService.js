/**
 * Routing Service - Uses Open Source Routing Machine (OSRM)
 * Free service, no API key required
 * Provides directions, distance, duration, and ETA
 */

const OSRM_API = 'https://router.project-osrm.org/route/v1/driving'

/**
 * Get route between two locations
 * Returns distance, duration, coordinates, and steps
 */
export async function getRoute(startLat, startLng, endLat, endLng) {
  try {
    if (!isValidCoord(startLat, startLng) || !isValidCoord(endLat, endLng)) {
      throw new Error('Invalid coordinates')
    }

    const url = `${OSRM_API}/${startLng},${startLat};${endLng},${endLat}?steps=true&geometries=geojson&overview=full&annotations=distance,duration,speed`
    
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch route')
    
    const data = await response.json()
    
    if (data.code !== 'Ok') {
      throw new Error(`Routing error: ${data.code}`)
    }

    const route = data.routes[0]
    return {
      success: true,
      distance: route.distance, // meters
      duration: route.duration, // seconds
      coordinates: route.geometry.coordinates,
      steps: route.legs[0].steps,
      summary: {
        distanceKm: (route.distance / 1000).toFixed(2),
        durationMin: Math.round(route.duration / 60),
        durationFormatted: formatDuration(route.duration),
      }
    }
  } catch (err) {
    console.error('Routing error:', err)
    return {
      success: false,
      error: err.message
    }
  }
}

/**
 * Get simple distance matrix between multiple points
 */
export async function getDistance(startLat, startLng, endLat, endLng) {
  try {
    const url = `${OSRM_API}/${startLng},${startLat};${endLng},${endLat}`
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch distance')
    
    const data = await response.json()
    if (data.code !== 'Ok') throw new Error(`Routing error: ${data.code}`)
    
    const route = data.routes[0]
    return {
      distance: route.distance,
      duration: route.duration,
      distanceKm: (route.distance / 1000).toFixed(2),
      durationMin: Math.round(route.duration / 60),
      durationFormatted: formatDuration(route.duration)
    }
  } catch (err) {
    console.error('Distance error:', err)
    return null
  }
}

/**
 * Format duration in seconds to readable string
 */
export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

/**
 * Format distance in meters to readable string
 */
export function formatDistance(meters) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`
  }
  return `${Math.round(meters)} m`
}

/**
 * Validate latitude and longitude
 */
function isValidCoord(lat, lng) {
  return typeof lat === 'number' && typeof lng === 'number' &&
         lat >= -90 && lat <= 90 &&
         lng >= -180 && lng <= 180
}

/**
 * Create a Leaflet polyline from route coordinates
 */
export function createRoutePolyline(coordinates) {
  if (!coordinates || coordinates.length === 0) return null
  
  // Convert OSRM format [lng, lat] to Leaflet format [lat, lng]
  return coordinates.map(([lng, lat]) => [lat, lng])
}

/**
 * Parse route steps into readable directions
 */
export function parseDirectionSteps(steps) {
  if (!steps || !Array.isArray(steps)) return []
  
  return steps.map(step => ({
    instruction: step.maneuver?.instruction || 'Continue',
    distance: step.distance,
    distanceFormatted: formatDistance(step.distance),
    duration: step.duration,
    durationFormatted: formatDuration(step.duration),
    name: step.name || 'Unnamed road',
  }))
}

/**
 * Batch geocode location names to coordinates (would need separate service)
 * For now, we'll use simple reverse geocoding from coordinates
 */
export async function getLocationName(lat, lng) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
    )
    if (!response.ok) throw new Error('Geocoding failed')
    
    const data = await response.json()
    return data.address?.city || data.address?.town || data.address?.county || 'Unknown location'
  } catch (err) {
    console.warn('Geocoding error:', err)
    return 'Unknown location'
  }
}
