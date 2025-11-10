import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Handle unhandled promise rejections from network errors and other noisy external failures
window.addEventListener('unhandledrejection', (event) => {
  try {
    const reason = event && event.reason
    const msg = reason && (reason.message || reason.toString && reason.toString())
    if (typeof msg === 'string' && (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('IFrame evaluation timeout'))) {
      console.debug('[App] Suppressed noisy network/iframe error:', msg)
      // Prevent the error from surfacing as an uncaught promise rejection
      event.preventDefault()
    }
  } catch (e) {
    // ignore
  }
})

// Monkey-patch localStorage.setItem to avoid uncaught QuotaExceededError
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const _origSetItem = window.localStorage.setItem.bind(window.localStorage)
    window.localStorage.setItem = (key, value) => {
      try {
        _origSetItem(key, value)
      } catch (e) {
        try {
          // fallback to sessionStorage
          if (window.sessionStorage) {
            window.sessionStorage.setItem(key, value)
            console.warn('[safeStorage] localStorage.setItem failed, wrote to sessionStorage for key', key)
            return
          }
        } catch (e2) {}
        console.warn('[safeStorage] Failed to persist key to localStorage or sessionStorage', key, e && e.message)
      }
    }
  }
} catch (e) {
  // ignore
}

// Global safe fetch wrapper to catch 'Failed to fetch' network errors from third-party scripts
try {
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    const _origFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      try {
        return await _origFetch(input, init)
      } catch (err) {
        // Suppress noisy network errors for known external analytics/iframe hosts in development
        try {
          const url = (typeof input === 'string') ? input : (input && input.url) || ''
          const host = url && url.toString().toLowerCase()
          const suppressedHosts = ['fullstory.com', 'edge.fullstory.com', 'sentry.io', 'segment.io', 'rollbar.com']
          const shouldSuppress = suppressedHosts.some(h => host.includes(h))
          if (shouldSuppress) {
            console.debug('[safeFetch] Suppressed network error for', url, err && err.message)
            const body = JSON.stringify({ error: 'network_error', message: err && err.message })
            return new Response(body, { status: 503, headers: { 'Content-Type': 'application/json' } })
          }
        } catch (e) {}

        // For other errors, rethrow so callers can handle them
        throw err
      }
    }
  }
} catch (e) {
  // ignore
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
