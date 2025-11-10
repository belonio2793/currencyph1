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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
