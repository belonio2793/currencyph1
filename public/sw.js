const CACHE_VERSION = 'v1'
const STATIC_CACHE = `static-${CACHE_VERSION}`
const API_CACHE = `api-${CACHE_VERSION}`
const IMAGE_CACHE = `images-${CACHE_VERSION}`

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css'
]

// API endpoints to cache with network-first strategy
const API_ENDPOINTS = [
  '/api/',
  '/functions/v1/'
]

// Cache stale-while-revalidate for 5 minutes
const CACHE_DURATION = 5 * 60 * 1000

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...')
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets')
      return Promise.allSettled(
        STATIC_ASSETS.map(url => 
          cache.add(url).catch(err => {
            console.debug(`[SW] Could not cache ${url}:`, err)
          })
        )
      )
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && 
              cacheName !== API_CACHE && 
              cacheName !== IMAGE_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // Skip chrome extensions and external tracking
  if (url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') {
    return
  }

  // Skip supabase real-time websockets
  if (url.pathname.includes('/realtime/')) {
    return
  }

  // Cache strategy: network-first for API calls, with fallback to cache
  if (isApiRequest(url)) {
    event.respondWith(networkFirstStrategy(request, API_CACHE))
  }
  // Cache strategy: cache-first for images
  else if (isImageRequest(url)) {
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE))
  }
  // Cache strategy: stale-while-revalidate for HTML/static
  else {
    event.respondWith(staleWhileRevalidateStrategy(request, STATIC_CACHE))
  }
})

/**
 * Network-first strategy: try network first, fall back to cache
 * Good for API calls where fresh data is important
 */
function networkFirstStrategy(request, cacheName) {
  return fetch(request)
    .then((response) => {
      // Clone response before caching
      const cloned = response.clone()
      if (response.ok) {
        caches.open(cacheName).then((cache) => {
          cache.put(request, cloned)
        })
      }
      return response
    })
    .catch(() => {
      // Network failed, try cache
      return caches.match(request).then((cached) => {
        if (cached) {
          console.log('[SW] Serving from cache (network failed):', request.url)
          return cached
        }
        // Return offline page or error
        return new Response('Offline - resource not available', {
          status: 503,
          statusText: 'Service Unavailable'
        })
      })
    })
}

/**
 * Cache-first strategy: try cache first, fall back to network
 * Good for images and other static content
 */
function cacheFirstStrategy(request, cacheName) {
  return caches.match(request).then((cached) => {
    if (cached) {
      console.log('[SW] Serving from cache:', request.url)
      return cached
    }

    return fetch(request)
      .then((response) => {
        if (response.ok) {
          const cloned = response.clone()
          caches.open(cacheName).then((cache) => {
            cache.put(request, cloned)
          })
        }
        return response
      })
      .catch(() => {
        return new Response('Offline - resource not available', {
          status: 503,
          statusText: 'Service Unavailable'
        })
      })
  })
}

/**
 * Stale-while-revalidate strategy: serve cached version while updating in background
 * Good for HTML pages and documents
 */
function staleWhileRevalidateStrategy(request, cacheName) {
  return caches.match(request).then((cached) => {
    const fetchPromise = fetch(request)
      .then((response) => {
        if (response.ok) {
          const cloned = response.clone()
          caches.open(cacheName).then((cache) => {
            cache.put(request, cloned)
          })
        }
        return response
      })
      .catch(() => {
        // Network failed, return cached if available
        return cached || new Response('Offline', { status: 503 })
      })

    // Return cached version immediately if available, otherwise wait for network
    return cached || fetchPromise
  })
}

/**
 * Check if request is for an API endpoint
 */
function isApiRequest(url) {
  return API_ENDPOINTS.some(endpoint => url.pathname.includes(endpoint))
}

/**
 * Check if request is for an image
 */
function isImageRequest(url) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
  return imageExtensions.some(ext => url.pathname.toLowerCase().endsWith(ext))
}

/**
 * Handle messages from clients
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(cacheNames => {
      Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      )
    })
  }
})
