// Reverse geocoding helper: prefers MapTiler, falls back to Nominatim (OpenStreetMap)
import { reverseGeocode as nominatimReverse } from './nominatimService.js'

const MAPTILER_KEY = typeof import.meta !== 'undefined'
  ? (import.meta.env?.VITE_MAPTILER_KEY || import.meta.env?.MAPTILER_API_KEY || import.meta.env?.MAPTILER_KEY || '')
  : (typeof process !== 'undefined' ? (process.env?.VITE_MAPTILER_KEY || process.env?.MAPTILER_API_KEY || process.env?.MAPTILER_KEY || '') : '')

export async function reverseGeocode(lat, lng) {
  if (!lat || !lng) return null

  // Try MapTiler Geocoding API first
  if (MAPTILER_KEY) {
    try {
      const url = `https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${MAPTILER_KEY}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`MapTiler geocode ${res.status}`)
      const json = await res.json()
      // MapTiler returns features array; pick the most relevant
      const feat = (json && json.features && json.features[0]) || null
      if (feat && feat.properties) {
        return {
          street: feat.properties.road || feat.properties.street || feat.properties.name || null,
          city: feat.properties.city || feat.properties.town || feat.properties.village || feat.properties.county || null,
          display_name: feat.properties.label || feat.properties.name || null
        }
      }
    } catch (err) {
      console.warn('MapTiler reverse geocode failed:', err)
    }
  }

  // Fallback to Nominatim (OpenStreetMap) with improved error handling and retries
  try {
    return await nominatimReverse(lat, lng)
  } catch (err) {
    console.warn('Nominatim reverse geocode failed:', err?.message)
  }

  return null
}
