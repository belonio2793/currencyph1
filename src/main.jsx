import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Handle unhandled promise rejections from network errors and other noisy external failures
window.addEventListener('unhandledrejection', (event) => {
  try {
    const reason = event && event.reason
    const msg = reason && (reason.message || reason.toString && reason.toString())

    // Suppress noisy network and abort-related errors which are expected when cancelling requests
    if (reason && (reason.name === 'AbortError')) {
      console.debug('[App] Suppressed AbortError unhandled rejection:', msg)
      event.preventDefault()
      return
    }

    // Suppress all "Failed to fetch" errors - they're usually non-critical and logged by handlers
    // This includes presence sync, read receipts, and other optional features from Supabase
    if (typeof msg === 'string' && (
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('IFrame evaluation timeout') ||
      msg.toLowerCase().includes('abort') ||
      msg.toLowerCase().includes('signal is aborted')
    )) {
      console.debug('[App] Suppressed noisy network/abort error:', msg)
      event.preventDefault()
      return
    }

    // Suppress Supabase-specific non-critical errors
    if (typeof msg === 'string' && (
      msg.includes('user_presence') ||
      msg.includes('message_read_receipts') ||
      msg.includes('presence')
    )) {
      console.debug('[App] Suppressed non-critical Supabase error:', msg)
      event.preventDefault()
      return
    }
  } catch (e) {
    // ignore
  }
})

// Intercept global errors early to prevent Vite overlay serialization failures
window.addEventListener('error', (event) => {
  try {
    const err = event && event.error
    const msg = (err && (err.message || err.toString && err.toString())) || (event && event.message) || ''
    // Known Vite overlay internal stack traces that fail when serializing DOM nodes
    if (msg && (msg.includes('domNodeToElement') || msg.includes('getDefaultStylesForTag') || msg.toLowerCase().includes('frame'))) {
      console.debug('[App] Suppressed dev-overlay serialization error:', msg)
      event.preventDefault()
      return true
    }
  } catch (e) { /* ignore */ }
}, true)

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

// Note: Global fetch wrapper disabled to avoid response body stream consumption issues
// Response bodies can only be read once, and synthetic Responses can cause issues with
// libraries like Supabase that expect real response objects

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
