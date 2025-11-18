// Nominatim API service with timeout handling, caching, and rate limiting
// Respects Nominatim's 1 request/second rate limit

const CACHE = new Map()
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours
const NOMINATIM_RATE_LIMIT_MS = 1100 // 1.1 seconds between requests (1 req/sec with buffer)
let lastRequestTime = 0

const DEFAULT_TIMEOUT = 10000 // 10 seconds - Nominatim can be slow
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 2000 // 2 seconds between retries

function getCacheKey(url) {
  return `nominatim:${url}`
}

function getCachedResult(cacheKey) {
  const cached = CACHE.get(cacheKey)
  if (!cached) return null
  
  const isExpired = Date.now() - cached.timestamp > CACHE_DURATION_MS
  if (isExpired) {
    CACHE.delete(cacheKey)
    return null
  }
  
  return cached.data
}

async function waitForRateLimit() {
  const timeSinceLastRequest = Date.now() - lastRequestTime
  if (timeSinceLastRequest < NOMINATIM_RATE_LIMIT_MS) {
    const waitTime = NOMINATIM_RATE_LIMIT_MS - timeSinceLastRequest
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }
  lastRequestTime = Date.now()
}

async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'currency-ph/1.0',
        ...options.headers
      }
    })
    
    clearTimeout(timeoutId)
    return response
  } catch (err) {
    clearTimeout(timeoutId)
    throw err
  }
}

async function nominatimFetch(url, options = {}) {
  const cacheKey = getCacheKey(url)
  
  // Check cache first
  const cached = getCachedResult(cacheKey)
  if (cached !== null) {
    return cached
  }
  
  // Wait for rate limit
  await waitForRateLimit()
  
  // Retry logic
  let lastError
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, DEFAULT_TIMEOUT)
      
      if (!response.ok) {
        // 429 = rate limited, 503 = service unavailable - worth retrying
        if ((response.status === 429 || response.status === 503) && attempt < MAX_RETRIES) {
          console.debug(`Nominatim returned ${response.status}, retrying...`)
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)))
          continue
        }
        throw new Error(`Nominatim API error ${response.status}`)
      }
      
      const data = await response.json()
      
      // Cache the result
      CACHE.set(cacheKey, {
        data,
        timestamp: Date.now()
      })
      
      return data
    } catch (err) {
      lastError = err
      
      // Retry on timeout or network errors, but not on parsing errors
      if (attempt < MAX_RETRIES && (
        err?.name === 'AbortError' || 
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('NetworkError')
      )) {
        console.debug(`Nominatim request failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying...`)
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)))
        continue
      }
      
      // Don't retry further
      break
    }
  }
  
  throw lastError
}

// Reverse geocoding: lat/lon -> address
export async function reverseGeocode(lat, lng) {
  if (!lat || !lng) return null
  
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1`
    
    const data = await nominatimFetch(url)
    
    if (data?.address) {
      return {
        street: data.address.road || data.address.pedestrian || data.address.cycleway || data.address.residential || data.address.neighbourhood || null,
        city: data.address.city || data.address.town || data.address.village || data.address.county || null,
        display_name: data.display_name || null
      }
    }
  } catch (err) {
    console.debug('Reverse geocode error:', err?.message)
  }
  
  return null
}

// Forward geocoding: address -> lat/lon
export async function forwardGeocode(address, options = {}) {
  if (!address || !address.trim()) return []
  
  try {
    const params = new URLSearchParams({
      format: 'json',
      q: address,
      limit: options.limit || 10,
      ...(options.countrycode && { countrycodes: options.countrycode }),
      ...(options.viewbox && { viewbox: options.viewbox, bounded: '1' })
    })
    
    const url = `https://nominatim.openstreetmap.org/search?${params}`
    
    const results = await nominatimFetch(url)
    
    if (!Array.isArray(results)) return []
    
    return results.map(r => ({
      latitude: parseFloat(r.lat),
      longitude: parseFloat(r.lon),
      address: r.display_name,
      type: 'address'
    }))
  } catch (err) {
    console.debug('Forward geocode error:', err?.message)
    return []
  }
}

// Clear cache (useful for testing or if data changes)
export function clearNominatimCache() {
  CACHE.clear()
  lastRequestTime = 0
}

// Get cache stats for debugging
export function getNominatimCacheStats() {
  return {
    size: CACHE.size,
    entries: Array.from(CACHE.entries()).map(([key, val]) => ({
      key,
      age: Date.now() - val.timestamp
    }))
  }
}
