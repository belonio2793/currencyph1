import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Handle unhandled promise rejections from network errors
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message === 'Failed to fetch') {
    console.warn('[App] Network connectivity issue detected, continuing with fallback')
    event.preventDefault()
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
