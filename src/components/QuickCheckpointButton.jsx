import { useState, useEffect } from 'react'
import { addCheckpointToJsonbArray } from '../lib/shippingLabelService'
import './QuickCheckpointButton.css'

export default function QuickCheckpointButton({ trackingCode, onCheckpointAdded, buttonText = 'Mark Checkpoint' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [location, setLocation] = useState(null)
  const [checkpointName, setCheckpointName] = useState('')
  const [status, setStatus] = useState('scanned')
  const [notes, setNotes] = useState('')
  const [useGeolocation, setUseGeolocation] = useState(true)

  useEffect(() => {
    if (useGeolocation && isOpen && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            address: `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`
          })
        },
        (err) => {
          console.log('Geolocation error:', err.message)
          setLocation(null)
        }
      )
    }
  }, [isOpen, useGeolocation])

  const handleAddCheckpoint = async (e) => {
    e.preventDefault()

    if (!trackingCode) {
      setError('No tracking code available')
      return
    }

    if (!location && useGeolocation) {
      setError('Waiting for location... Please try again.')
      return
    }

    if (!checkpointName.trim()) {
      setError('Checkpoint name is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      const checkpointData = {
        checkpointName: checkpointName.trim(),
        checkpointType: status,
        latitude: location?.latitude || 0,
        longitude: location?.longitude || 0,
        addressText: location?.address || checkpointName,
        userId: null,
        notes: notes.trim(),
        status: status,
        metadata: {
          userAgent: navigator.userAgent,
          accuracy: location?.accuracy,
          source: 'quick_checkpoint'
        }
      }

      const result = await addCheckpointToJsonbArray(trackingCode, checkpointData)

      setCheckpointName('')
      setNotes('')
      setStatus('scanned')
      setError('')
      setIsOpen(false)

      if (onCheckpointAdded) {
        onCheckpointAdded(result.checkpoint)
      }
    } catch (err) {
      setError(err.message || 'Failed to add checkpoint')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setCheckpointName('')
    setNotes('')
    setStatus('scanned')
    setError('')
    setIsOpen(false)
  }

  if (!trackingCode) {
    return null
  }

  return (
    <div className="quick-checkpoint-button">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="btn btn-checkpoint"
        title="Quick checkpoint marking"
      >
        {buttonText}
      </button>

      {isOpen && (
        <div className="checkpoint-modal-overlay" onClick={handleReset}>
          <div className="checkpoint-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Quick Checkpoint</h3>
              <button
                type="button"
                onClick={handleReset}
                className="close-btn"
              >
                ×
              </button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleAddCheckpoint} className="checkpoint-form">
              <div className="form-group">
                <label>Tracking Code</label>
                <input
                  type="text"
                  value={trackingCode}
                  readOnly
                  className="form-input-readonly"
                />
              </div>

              <div className="form-group">
                <label>Checkpoint Name *</label>
                <input
                  type="text"
                  value={checkpointName}
                  onChange={(e) => setCheckpointName(e.target.value)}
                  placeholder="e.g., Warehouse, In Transit, Delivery..."
                  autoFocus
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="scanned">Scanned</option>
                    <option value="in_transit">In Transit</option>
                    <option value="out_for_delivery">Out for Delivery</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={useGeolocation}
                      onChange={(e) => setUseGeolocation(e.target.checked)}
                    />
                    Use Geolocation
                  </label>
                </div>
              </div>

              {location && (
                <div className="location-display">
                  Location: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                </div>
              )}

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes"
                  rows="2"
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={handleReset}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? 'Saving...' : 'Save Checkpoint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
