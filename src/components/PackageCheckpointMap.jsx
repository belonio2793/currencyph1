import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import { getLabelWithCheckpoints } from '../lib/shippingLabelService'
import { formatNumber } from '../lib/currency'
import './PackageCheckpointMap.css'

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom marker icons by checkpoint type
const createMarkerIcon = (type = 'checkpoint', index = null) => {
  const colors = {
    origin: '#3b82f6',
    checkpoint: '#f59e0b',
    destination: '#10b981',
    current: '#ef4444',
    delivered: '#16a34a'
  }
  
  const color = colors[type] || colors.checkpoint
  
  return L.divIcon({
    html: `<div style="background-color: ${color}; width: 40px; height: 40px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.2); font-size: 14px; font-weight: bold; color: white;">
      ${index !== null ? index : ''}
    </div>`,
    iconSize: [40, 40],
    className: 'custom-marker'
  })
}

export default function PackageCheckpointMap({ trackingCode, onClose }) {
  const mapRef = useRef(null)
  const [label, setLabel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mapCenter, setMapCenter] = useState([12.8797, 121.7740])
  const [zoomLevel, setZoomLevel] = useState(7)

  useEffect(() => {
    loadLabelData()
  }, [trackingCode])

  const loadLabelData = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await getLabelWithCheckpoints(trackingCode)
      if (!data) {
        setError('Package not found')
        return
      }
      setLabel(data)

      // Fit map to checkpoints if they exist
      if (data.checkpoints && data.checkpoints.length > 0) {
        const validCheckpoints = data.checkpoints.filter(cp => cp.latitude && cp.longitude)
        if (validCheckpoints.length > 0) {
          const latLngs = validCheckpoints.map(cp => [cp.latitude, cp.longitude])
          const bounds = L.latLngBounds(latLngs)
          
          setTimeout(() => {
            if (mapRef.current) {
              mapRef.current.fitBounds(bounds, { padding: [50, 50] })
            }
          }, 200)
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load package')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  const getTotalDistance = () => {
    if (!label?.checkpoints || label.checkpoints.length < 2) return 0
    
    let total = 0
    for (let i = 0; i < label.checkpoints.length - 1; i++) {
      const cp1 = label.checkpoints[i]
      const cp2 = label.checkpoints[i + 1]
      if (cp1.latitude && cp1.longitude && cp2.latitude && cp2.longitude) {
        total += calculateDistance(cp1.latitude, cp1.longitude, cp2.latitude, cp2.longitude)
      }
    }
    return total
  }

  if (loading) {
    return (
      <div className="package-checkpoint-map-container loading">
        <div className="loading-spinner">Loading package map...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="package-checkpoint-map-container error">
        <div className="error-message">{error}</div>
        {onClose && <button onClick={onClose} className="btn btn-secondary">Close</button>}
      </div>
    )
  }

  if (!label) {
    return (
      <div className="package-checkpoint-map-container error">
        <div className="error-message">Package not found</div>
        {onClose && <button onClick={onClose} className="btn btn-secondary">Close</button>}
      </div>
    )
  }

  const checkpoints = label.checkpoints || []
  const validCheckpoints = checkpoints.filter(cp => cp.latitude && cp.longitude)
  const totalDistance = getTotalDistance()

  return (
    <div className="package-checkpoint-map-container">
      <div className="map-header">
        <div className="header-content">
          <h2>{label.tracking_code}</h2>
          <p className="package-name">{label.package_name}</p>
          {onClose && (
            <button onClick={onClose} className="close-btn" title="Close">×</button>
          )}
        </div>
        
        <div className="map-stats">
          <div className="stat">
            <span className="stat-label">Status:</span>
            <span className={`stat-value status-${label.status}`}>{label.status.toUpperCase()}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Checkpoints:</span>
            <span className="stat-value">{checkpoints.length}</span>
          </div>
          {totalDistance > 0 && (
            <div className="stat">
              <span className="stat-label">Total Distance:</span>
              <span className="stat-value">{totalDistance.toFixed(2)} km</span>
            </div>
          )}
          <div className="stat">
            <span className="stat-label">Last Update:</span>
            <span className="stat-value">
              {label.last_scanned_at ? new Date(label.last_scanned_at).toLocaleString() : 'No updates'}
            </span>
          </div>
        </div>
      </div>

      <div className="map-content">
        <div className="map-area">
          {validCheckpoints.length > 0 ? (
            <MapContainer
              ref={mapRef}
              center={mapCenter}
              zoom={zoomLevel}
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />

              {/* Origin marker */}
              {label.origin_address && label.origin_address.addresses_latitude && (
                <Marker
                  position={[
                    label.origin_address.addresses_latitude,
                    label.origin_address.addresses_longitude
                  ]}
                  icon={createMarkerIcon('origin')}
                >
                  <Popup>
                    <strong>Origin</strong><br />
                    {label.origin_address.addresses_address}
                  </Popup>
                </Marker>
              )}

              {/* Checkpoint markers */}
              {validCheckpoints.map((checkpoint, index) => (
                <Marker
                  key={checkpoint.id || index}
                  position={[checkpoint.latitude, checkpoint.longitude]}
                  icon={createMarkerIcon(
                    index === 0 ? 'current' : index === validCheckpoints.length - 1 ? 'delivered' : 'checkpoint',
                    index + 1
                  )}
                >
                  <Popup>
                    <div className="checkpoint-popup">
                      <strong>#{index + 1} {checkpoint.checkpoint_name || 'Checkpoint'}</strong><br />
                      <small className="popup-type">{checkpoint.checkpoint_type || 'scanned'}</small><br />
                      {checkpoint.address_text && <span>{checkpoint.address_text}<br /></span>}
                      <small className="popup-time">
                        {new Date(checkpoint.timestamp).toLocaleString()}
                      </small>
                      {checkpoint.notes && <p className="popup-notes">{checkpoint.notes}</p>}
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Destination marker */}
              {label.destination_address && label.destination_address.addresses_latitude && (
                <Marker
                  position={[
                    label.destination_address.addresses_latitude,
                    label.destination_address.addresses_longitude
                  ]}
                  icon={createMarkerIcon('destination')}
                >
                  <Popup>
                    <strong>Destination</strong><br />
                    {label.destination_address.addresses_address}
                  </Popup>
                </Marker>
              )}

              {/* Route polyline */}
              {validCheckpoints.length > 1 && (
                <Polyline
                  positions={validCheckpoints.map(cp => [cp.latitude, cp.longitude])}
                  color="#3b82f6"
                  weight={3}
                  opacity={0.8}
                  dashArray="5, 5"
                />
              )}
            </MapContainer>
          ) : (
            <div className="no-checkpoints">
              <p>No checkpoint locations recorded yet</p>
            </div>
          )}
        </div>

        <div className="checkpoints-sidebar">
          <h3>Checkpoint History ({checkpoints.length})</h3>
          
          {checkpoints.length === 0 ? (
            <p className="empty-state">No checkpoints recorded</p>
          ) : (
            <div className="checkpoints-timeline">
              {checkpoints.map((checkpoint, index) => (
                <div key={checkpoint.id || index} className="timeline-item">
                  <div className="timeline-marker">
                    <span className="marker-number">{index + 1}</span>
                  </div>
                  <div className="timeline-content">
                    <h5>{checkpoint.checkpoint_name || 'Checkpoint'}</h5>
                    {checkpoint.checkpoint_type && (
                      <p className="checkpoint-type">{checkpoint.checkpoint_type.toUpperCase()}</p>
                    )}
                    {checkpoint.timestamp && (
                      <p className="timestamp">
                        {new Date(checkpoint.timestamp).toLocaleString()}
                      </p>
                    )}
                    {checkpoint.address_text && (
                      <p className="address">{checkpoint.address_text}</p>
                    )}
                    {checkpoint.latitude && checkpoint.longitude && (
                      <p className="coordinates">
                        {checkpoint.latitude.toFixed(6)}, {checkpoint.longitude.toFixed(6)}
                      </p>
                    )}
                    {checkpoint.notes && (
                      <p className="notes">{checkpoint.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="sidebar-footer">
            <p className="info-text">
              Total checkpoints: {checkpoints.length} | Valid locations: {validCheckpoints.length}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
