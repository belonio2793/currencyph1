import { useState } from 'react'
import './AttendanceCheckInModal.css'

export default function AttendanceCheckInModal({ onClose, onSubmit, isLoading }) {
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [useCurrentLocation, setUseCurrentLocation] = useState(false)
  const [gettingLocation, setGettingLocation] = useState(false)
  const [error, setError] = useState('')

  const handleGetCurrentLocation = () => {
    setGettingLocation(true)
    setError('')

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
          setUseCurrentLocation(true)
          setGettingLocation(false)
        },
        (error) => {
          console.error('Error getting location:', error)
          setError('Unable to get your location. Please enable location services.')
          setGettingLocation(false)
        }
      )
    } else {
      setError('Geolocation is not supported by your browser.')
      setGettingLocation(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!location.trim()) {
      setError('Please provide your location or get your current location')
      return
    }

    onSubmit({
      checkInTime: new Date().toISOString(),
      location: location.trim(),
      notes: notes.trim() || null
    })
  }

  return (
    <div className="attendance-modal-overlay" onClick={onClose}>
      <div className="attendance-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Check In</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="check-in-form">
          <div className="form-group">
            <label htmlFor="location">Location *</label>
            <div className="location-input-group">
              <input
                type="text"
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Your location (address or coordinates)"
                disabled={isLoading}
              />
              <button
                type="button"
                className="btn-get-location"
                onClick={handleGetCurrentLocation}
                disabled={isLoading || gettingLocation}
              >
                {gettingLocation ? 'Getting location...' : '[GPS]'}
              </button>
            </div>
            {useCurrentLocation && (
              <small className="location-note">Current location detected</small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes (Optional)</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about your check-in"
              rows="3"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}

          <div className="current-time">
            <small>Check-in time: {new Date().toLocaleTimeString()}</small>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={isLoading || !location.trim()}
            >
              {isLoading ? 'Processing...' : 'Check In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
