import { useState, useRef, useEffect } from 'react'
import { addCheckpointToJsonbArray, getLabelWithCheckpoints } from '../lib/shippingLabelService'
import QuickCheckpointButton from './QuickCheckpointButton'
import './BarcodeScanner.css'

export default function BarcodeScanner({ userId, onCheckpointAdded }) {
  const [mode, setMode] = useState('input')
  const [trackingCode, setTrackingCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [scannedLabel, setScannedLabel] = useState(null)
  const [useGeolocation, setUseGeolocation] = useState(true)
  const [location, setLocation] = useState(null)
  const [checkpointName, setCheckpointName] = useState('')
  const [checkpointNotes, setCheckpointNotes] = useState('')
  const [checkpointStatus, setCheckpointStatus] = useState('scanned')
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const canvasRef = useRef(null)

  // Get user's geolocation
  useEffect(() => {
    if (useGeolocation && navigator.geolocation) {
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
  }, [useGeolocation])

  // Start camera
  const startCamera = async () => {
    try {
      setError('')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setMode('camera')
      }
    } catch (err) {
      setError('Camera access denied. Please enable camera permission and try again.')
      console.error('Camera error:', err)
    }
  }

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  // Search for label by tracking code
  const handleSearch = async (e) => {
    e.preventDefault()
    if (!trackingCode.trim()) {
      setError('Please enter a tracking code')
      return
    }

    setLoading(true)
    setError('')

    try {
      const label = await getLabelWithCheckpoints(trackingCode.toUpperCase())

      if (!label) {
        setError('Shipping label not found')
        setScannedLabel(null)
      } else {
        setScannedLabel(label)
        setMode('result')
      }
    } catch (err) {
      setError(err.message || 'Error searching for label')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Add checkpoint
  const handleAddCheckpoint = async (e) => {
    e.preventDefault()
    if (!scannedLabel) {
      setError('No label selected')
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
        checkpointType: checkpointStatus,
        latitude: location?.latitude || 0,
        longitude: location?.longitude || 0,
        addressText: location?.address || checkpointName,
        userId: userId,
        notes: checkpointNotes.trim(),
        status: checkpointStatus,
        metadata: {
          userAgent: navigator.userAgent,
          accuracy: location?.accuracy,
          source: 'barcode_scan'
        }
      }

      const result = await addCheckpointToJsonbArray(scannedLabel.tracking_code, checkpointData)

      // Update scanned label with new checkpoint data
      setScannedLabel({
        ...result.label,
        checkpoints: result.label.checkpoints_jsonb || []
      })

      setCheckpointName('')
      setCheckpointNotes('')
      setCheckpointStatus('scanned')

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

  // Reset
  const handleReset = () => {
    stopCamera()
    setMode('input')
    setTrackingCode('')
    setScannedLabel(null)
    setCheckpointName('')
    setCheckpointNotes('')
    setCheckpointStatus('scanned')
    setError('')
  }

  return (
    <div className="barcode-scanner">
      {error && <div className="alert alert-error">{error}</div>}

      {mode === 'input' && (
        <div className="scanner-input-mode">
          <div className="map-header">
            <div className="map-header-content">
              <h4>Scan Package Checkpoint</h4>
              <p className="map-subtitle">Use barcode scanning to track package checkpoints</p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="search-form">
            <div className="input-row">
              <label className="form-label">Tracking Code</label>
              <input
                type="text"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                placeholder="e.g., PH-2025-A1B2C3D4"
                autoComplete="off"
                autoFocus
                className="tracking-input"
              />
            </div>

            <div className="form-actions">
              <button type="submit" disabled={loading} className="btn btn-primary">
                {loading ? 'Searching...' : 'Search Label'}
              </button>

              <button
                type="button"
                onClick={startCamera}
                className="btn btn-secondary"
              >
                Open Camera
              </button>
            </div>
          </form>

          <div className="geolocation-toggle">
            <label>
              <input
                type="checkbox"
                checked={useGeolocation}
                onChange={(e) => setUseGeolocation(e.target.checked)}
              />
              Use Geolocation
            </label>
            {location && (
              <p className="location-info">
                Location available ({location.latitude.toFixed(4)}, {location.longitude.toFixed(4)})
              </p>
            )}
          </div>
        </div>
      )}

      {mode === 'camera' && (
        <div className="scanner-camera-mode">
          <h3>Point camera at barcode</h3>
          <div className="camera-container">
            <video ref={videoRef} autoPlay playsInline />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div className="scan-reticle">
              <div className="reticle-corner top-left" />
              <div className="reticle-corner top-right" />
              <div className="reticle-corner bottom-left" />
              <div className="reticle-corner bottom-right" />
            </div>
          </div>

          <div className="camera-actions">
            <button
              type="button"
              onClick={stopCamera}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            
            <button
              type="button"
              onClick={() => setMode('input')}
              className="btn btn-secondary"
            >
              Manual Entry
            </button>
          </div>
        </div>
      )}

      {mode === 'result' && scannedLabel && (
        <div className="scanner-result-mode">
          <h3>Package Details</h3>
          
          <div className="label-info">
            <div className="info-row">
              <span className="info-label">Tracking Code:</span>
              <span className="info-value">{scannedLabel.tracking_code}</span>
            </div>
            
            {scannedLabel.package_name && (
              <div className="info-row">
                <span className="info-label">Package:</span>
                <span className="info-value">{scannedLabel.package_name}</span>
              </div>
            )}
            
            {scannedLabel.weight_kg && (
              <div className="info-row">
                <span className="info-label">Weight:</span>
                <span className="info-value">{scannedLabel.weight_kg} kg</span>
              </div>
            )}
            
            {scannedLabel.status && (
              <div className="info-row">
                <span className="info-label">Status:</span>
                <span className={`info-value status-${scannedLabel.status}`}>
                  {scannedLabel.status.toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div className="checkpoint-actions">
            <QuickCheckpointButton
              trackingCode={scannedLabel.tracking_code}
              onCheckpointAdded={(checkpoint) => {
                if (onCheckpointAdded) {
                  onCheckpointAdded(checkpoint)
                }
              }}
              buttonText="Quick Checkpoint"
            />
          </div>

          <div className="checkpoint-form">
            <h4>Add Checkpoint</h4>

            <form onSubmit={handleAddCheckpoint}>
              <div className="form-group">
                <label>Checkpoint Name *</label>
                <input
                  type="text"
                  value={checkpointName}
                  onChange={(e) => setCheckpointName(e.target.value)}
                  placeholder="e.g., Warehouse, In Transit, Delivery..."
                  required
                />
              </div>

              <div className="form-group">
                <label>Checkpoint Status</label>
                <select
                  value={checkpointStatus}
                  onChange={(e) => setCheckpointStatus(e.target.value)}
                >
                  <option value="scanned">Scanned</option>
                  <option value="in_transit">In Transit</option>
                  <option value="out_for_delivery">Out for Delivery</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>

              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  value={location?.address || ''}
                  readOnly
                  placeholder="Getting location..."
                />
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={checkpointNotes}
                  onChange={(e) => setCheckpointNotes(e.target.value)}
                  placeholder="Additional notes"
                  rows="2"
                />
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary">
                {loading ? 'Saving...' : 'Add Checkpoint'}
              </button>
            </form>
          </div>

          {scannedLabel.checkpoints && scannedLabel.checkpoints.length > 0 && (
            <div className="checkpoint-history">
              <h4>Checkpoint History ({scannedLabel.checkpoints.length})</h4>
              <div className="timeline">
                {scannedLabel.checkpoints.map((checkpoint, index) => (
                  <div key={checkpoint.id || index} className="timeline-item">
                    <div className="timeline-marker" />
                    <div className="timeline-content">
                      <h5>{checkpoint.checkpoint_name || 'Checkpoint'}</h5>
                      {checkpoint.checkpoint_type && (
                        <p className="status-type">{checkpoint.checkpoint_type.toUpperCase()}</p>
                      )}
                      {checkpoint.timestamp && (
                        <p className="timestamp">
                          {new Date(checkpoint.timestamp).toLocaleString()}
                        </p>
                      )}
                      {checkpoint.address_text && (
                        <p className="location">{checkpoint.address_text}</p>
                      )}
                      {checkpoint.latitude && checkpoint.longitude && (
                        <p className="coordinates">
                          {checkpoint.latitude.toFixed(4)}, {checkpoint.longitude.toFixed(4)}
                        </p>
                      )}
                      {checkpoint.notes && (
                        <p className="notes">{checkpoint.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={handleReset} className="btn btn-secondary btn-block">
            Scan Another Package
          </button>
        </div>
      )}
    </div>
  )
}
