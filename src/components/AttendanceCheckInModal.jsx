import { useState } from 'react'
import ExpandableModal from './ExpandableModal'
import { useDevice } from '../context/DeviceContext'
import { formatTimeOnly } from '../lib/dateTimeUtils'

export default function AttendanceCheckInModal({ onClose, onSubmit, isLoading }) {
  const { isMobile } = useDevice()
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

  const footer = (
    <div className="flex gap-2 w-full">
      <button
        type="button"
        onClick={onClose}
        disabled={isLoading}
        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="attendance-checkin-form"
        disabled={isLoading || gettingLocation}
        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
      >
        {isLoading ? 'Checking In...' : 'Check In'}
      </button>
    </div>
  )

  return (
    <ExpandableModal
      isOpen={true}
      onClose={onClose}
      title="Check In"
      icon="📍"
      size={isMobile ? 'fullscreen' : 'sm'}
      footer={footer}
      defaultExpanded={!isMobile}
    >
      <form onSubmit={handleSubmit} id="attendance-checkin-form" className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Location Input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Location *
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Your location (address or coordinates)"
              disabled={isLoading}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:opacity-50 text-sm"
            />
            <button
              type="button"
              onClick={handleGetCurrentLocation}
              disabled={isLoading || gettingLocation}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
            >
              {gettingLocation ? '📍...' : '📍 GPS'}
            </button>
          </div>
          {useCurrentLocation && (
            <p className="text-xs text-emerald-600 mt-1">✓ Current location detected</p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Additional Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional notes about your check-in..."
            disabled={isLoading}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:opacity-50 text-sm resize-none"
            rows={3}
          />
        </div>

        {/* Check-in Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-900">
            <strong>Check-in Time:</strong> {formatTimeOnly(new Date())}
          </p>
        </div>
      </form>
    </ExpandableModal>
  )
}
