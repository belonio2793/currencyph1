import { useState, useRef, useEffect } from 'react'
import { addCheckpoint, searchShippingLabelBySerialId } from '../lib/shippingLabelService'
import './BarcodeScanner.css'

export default function BarcodeScanner({ userId, onCheckpointAdded }) {
  const [mode, setMode] = useState('input') // 'input', 'camera', 'result'
  const [serialId, setSerialId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [scannedLabel, setScannedLabel] = useState(null)
  const [useGeolocation, setUseGeolocation] = useState(true)
  const [location, setLocation] = useState(null)
  const [checkpointName, setCheckpointName] = useState('')
  const [checkpointNotes, setCheckpointNotes] = useState('')
  const [checkpointType, setCheckpointType] = useState('scanned')
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
            address: `Lat: ${position.coords.latitude.toFixed(6)}, Lng: ${position.coords.longitude.toFixed(6)}`
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
        
        // Start scanning after a short delay
        setTimeout(() => {
          scanFrame()
        }, 500)
      }
    } catch (err) {
      setError('Camera access denied. Please enable camera permission and try again.')
      console.error('Camera error:', err)
    }
  }

  // Scan video frame for barcode patterns
  const scanFrame = () => {
    if (!videoRef.current || !streamRef.current) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    const video = videoRef.current
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      
      // Simple barcode detection - look for PKG- patterns in image analysis
      // For now, this is a placeholder. In production, use a library like jsQR or html5-qrcode
      detectBarcode(canvas)
    }
    
    // Continue scanning
    requestAnimationFrame(scanFrame)
  }

  // Simple barcode detection (placeholder)
  const detectBarcode = (canvas) => {
    // This is a simplified detection. In production, use a proper barcode/QR library
    // For now, we'll just let users input manually or use the form
  }

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  // Search for label by serial ID
  const handleSearch = async (e) => {
    e.preventDefault()
    if (!serialId.trim()) {
      setError('Please enter a serial ID')
      return
    }
    
    setLoading(true)
    setError('')
    
    try {
      const label = await searchShippingLabelBySerialId(userId, serialId.toUpperCase())
      
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
        checkpointType,
        latitude: location?.latitude,
        longitude: location?.longitude,
        locationAddress: location?.address || checkpointName,
        scannedByUserId: userId,
        notes: checkpointNotes.trim(),
        metadata: {
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          accuracy: location?.accuracy
        }
      }
      
      const checkpoint = await addCheckpoint(scannedLabel.id, checkpointData)
      
      setScannedLabel({
        ...scannedLabel,
        checkpoints: [...(scannedLabel.checkpoints || []), checkpoint]
      })
      
      setCheckpointName('')
      setCheckpointNotes('')
      setCheckpointType('scanned')
      
      if (onCheckpointAdded) {
        onCheckpointAdded(checkpoint)
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
    setSerialId('')
    setScannedLabel(null)
    setCheckpointName('')
    setCheckpointNotes('')
    setError('')
  }

  return (
    <div className="barcode-scanner">
      {error && <div className="alert alert-error">{error}</div>}

      {mode === 'input' && (
        <div className="scanner-input-mode">
          <h3>Scan Package Checkpoint</h3>
          
          <form onSubmit={handleSearch} className="search-form">
            <div className="form-group">
              <label>Serial ID / Barcode Number</label>
              <input
                type="text"
                value={serialId}
                onChange={(e) => setSerialId(e.target.value)}
                placeholder="PKG-XXXXXXXXXX"
                autoComplete="off"
                autoFocus
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
                📷 Open Camera
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
                ✓ Location available ({location.latitude.toFixed(4)}, {location.longitude.toFixed(4)})
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
              <span className="info-label">Serial ID:</span>
              <span className="info-value">{scannedLabel.serial_id}</span>
            </div>
            
            {scannedLabel.package_name && (
              <div className="info-row">
                <span className="info-label">Package:</span>
                <span className="info-value">{scannedLabel.package_name}</span>
              </div>
            )}
            
            {scannedLabel.package_weight && (
              <div className="info-row">
                <span className="info-label">Weight:</span>
                <span className="info-value">{scannedLabel.package_weight} kg</span>
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

          <div className="checkpoint-form">
            <h4>Add Checkpoint</h4>
            
            <form onSubmit={handleAddCheckpoint}>
              <div className="form-group">
                <label>Checkpoint Name *</label>
                <input
                  type="text"
                  value={checkpointName}
                  onChange={(e) => setCheckpointName(e.target.value)}
                  placeholder="e.g., Warehouse A, In Transit, Delivery..."
                  required
                />
              </div>

              <div className="form-group">
                <label>Checkpoint Type</label>
                <select
                  value={checkpointType}
                  onChange={(e) => setCheckpointType(e.target.value)}
                >
                  <option value="scanned">Scanned</option>
                  <option value="arrived">Arrived</option>
                  <option value="departed">Departed</option>
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
              <h4>Checkpoint History</h4>
              <div className="timeline">
                {scannedLabel.checkpoints.map((checkpoint, index) => (
                  <div key={checkpoint.id} className="timeline-item">
                    <div className="timeline-marker" />
                    <div className="timeline-content">
                      <h5>{checkpoint.checkpoint_name}</h5>
                      <p className="timestamp">
                        {new Date(checkpoint.scanned_at).toLocaleString()}
                      </p>
                      {checkpoint.location_address && (
                        <p className="location">📍 {checkpoint.location_address}</p>
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
