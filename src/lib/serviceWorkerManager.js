/**
 * Service Worker Manager
 * Handles registration, updates, and communication with the service worker
 */

let registrationPromise = null

/**
 * Register the service worker
 * Should be called once during app initialization
 */
export async function registerServiceWorker() {
  // Skip if already registering
  if (registrationPromise) {
    return registrationPromise
  }

  // Skip if service workers are not supported
  if (!('serviceWorker' in navigator)) {
    console.log('[SWM] Service Workers not supported in this browser')
    return null
  }

  // Skip if offline
  if (!navigator.onLine) {
    console.log('[SWM] Browser is offline, skipping service worker registration')
    return null
  }

  registrationPromise = navigator.serviceWorker.register('/sw.js', {
    scope: '/',
    updateViaCache: 'none'
  })
    .then((registration) => {
      console.log('[SWM] Service Worker registered successfully:', registration.scope)

      // Check for updates periodically (every hour)
      setInterval(() => {
        registration.update().catch(err => {
          console.debug('[SWM] Error checking for SW updates:', err)
        })
      }, 60 * 60 * 1000)

      // Handle updates available
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        console.log('[SWM] Service Worker update found')

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SWM] New service worker available')
            notifyUpdateAvailable(registration)
          }
        })
      })

      return registration
    })
    .catch((error) => {
      console.error('[SWM] Service Worker registration failed:', error)
      return null
    })

  return registrationPromise
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    for (const registration of registrations) {
      await registration.unregister()
      console.log('[SWM] Service Worker unregistered')
    }
  } catch (error) {
    console.error('[SWM] Error unregistering Service Worker:', error)
  }
}

/**
 * Clear all caches managed by the service worker
 */
export async function clearAllCaches() {
  if ('caches' in window) {
    const cacheNames = await caches.keys()
    return Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    )
  }
}

/**
 * Clear specific cache by name pattern
 */
export async function clearCacheByPattern(pattern) {
  if ('caches' in window) {
    const cacheNames = await caches.keys()
    const regex = new RegExp(pattern)
    return Promise.all(
      cacheNames
        .filter(name => regex.test(name))
        .map(cacheName => caches.delete(cacheName))
    )
  }
}

/**
 * Skip the waiting period and activate new service worker
 */
export async function skipWaitingServiceWorker() {
  if (!navigator.serviceWorker.controller) {
    return
  }

  if (navigator.serviceWorker.controller.state === 'activated') {
    const reg = await navigator.serviceWorker.ready
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' })
    }
  }
}

/**
 * Notify the service worker to clear all caches
 */
export async function notifyServiceWorkerClearCache() {
  if (!navigator.serviceWorker.controller) {
    return
  }

  navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' })
}

/**
 * Notify user that an update is available
 * This is called when a new service worker version is found
 */
function notifyUpdateAvailable(registration) {
  // Dispatch a custom event that the app can listen to
  window.dispatchEvent(new CustomEvent('sw-update-available', {
    detail: { registration }
  }))

  // Optional: Show a toast/notification to the user
  console.log('[SWM] Update notification dispatched to app')
}

/**
 * Get service worker status
 */
export async function getServiceWorkerStatus() {
  if (!('serviceWorker' in navigator)) {
    return { supported: false, registered: false }
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    return {
      supported: true,
      registered: registrations.length > 0,
      registrations: registrations.map(reg => ({
        scope: reg.scope,
        active: !!reg.active,
        waiting: !!reg.waiting,
        installing: !!reg.installing
      }))
    }
  } catch (error) {
    return { supported: true, registered: false, error: error.message }
  }
}

/**
 * Listen for service worker updates
 */
export function onServiceWorkerUpdate(callback) {
  window.addEventListener('sw-update-available', (event) => {
    callback(event.detail)
  })

  // Also return unsubscribe function
  return () => {
    window.removeEventListener('sw-update-available', callback)
  }
}

/**
 * Check if browser is online
 */
export function isOnline() {
  return navigator.onLine
}

/**
 * Listen for online/offline changes
 */
export function onOnlineStatusChange(callback) {
  window.addEventListener('online', () => callback(true))
  window.addEventListener('offline', () => callback(false))

  return () => {
    window.removeEventListener('online', () => callback(true))
    window.removeEventListener('offline', () => callback(false))
  }
}

/**
 * Pre-cache critical assets/API endpoints
 * Useful for caching important data before user needs it
 */
export async function preCacheAssets(urls) {
  if (!('caches' in window)) {
    return
  }

  try {
    const cache = await caches.open('precache-v1')
    return Promise.allSettled(
      urls.map(url => {
        return fetch(url)
          .then(response => {
            if (response.ok) {
              return cache.put(url, response)
            }
          })
          .catch(err => {
            console.debug(`[SWM] Could not pre-cache ${url}:`, err)
          })
      })
    )
  } catch (error) {
    console.error('[SWM] Error pre-caching assets:', error)
  }
}
