import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, GeoJSON } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabaseClient'
import { 
  getShippingLabelsWithCheckpoints,
  searchShippingLabelBySerialId,
  getCheckpointHistory
} from '../lib/shippingLabelService'
import './PackageTracker.css'

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom marker icons
const createMarkerIcon = (type = 'checkpoint') => {
  const colors = {
    origin: '#3b82f6',
    checkpoint: '#f59e0b',
    destination: '#10b981',
    current: '#ef4444'
  }
  
  const color = colors[type] || colors.checkpoint
  
  return L.divIcon({
    html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
      <span style="color: white; font-size: 16px;">📍</span>
    </div>`,
    iconSize: [30, 30],
    className: 'custom-marker'
  })
}

export default function PackageTracker({ userId }) {
  const mapRef = useRef(null)
  const [allLabels, setAllLabels] = useState([])
  const [selectedLabel, setSelectedLabel] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mapCenter, setMapCenter] = useState([12.8797, 121.7740])
  const [zoomLevel, setZoomLevel] = useState(6)
  const [viewMode, setViewMode] = useState('list') // 'list' or 'map'
  const [filterStatus, setFilterStatus] = useState('all')
  const [mapInstance, setMapInstance] = useState(null)

  // Load all shipping labels
  useEffect(() => {
    if (userId) {
      loadLabels()
    }
  }, [userId])

  // Update map when selected label changes
  useEffect(() => {
    if (selectedLabel && selectedLabel.checkpoints && selectedLabel.checkpoints.length > 0) {
      const checkpoints = selectedLabel.checkpoints.filter(cp => cp.latitude && cp.longitude)
      if (checkpoints.length > 0) {
        const latLngs = checkpoints.map(cp => [cp.latitude, cp.longitude])
        const bounds = L.latLngBounds(latLngs)
        
        if (mapRef.current) {
          setTimeout(() => {
            mapRef.current?.fitBounds(bounds, { padding: [50, 50] })
          }, 100)
        }
      }
    }
  }, [selectedLabel])

  const loadLabels = async () => {
    try {
      setLoading(true)
      setError('')
      
      const labels = await getShippingLabelsWithCheckpoints(userId)
      setAllLabels(labels || [])
    } catch (err) {
      setError(err.message || 'Failed to load packages')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Search for a specific label
  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) {
      setError('Please enter a serial ID')
      return
    }

    setLoading(true)
    setError('')

    try {
      const label = await searchShippingLabelBySerialId(userId, searchQuery.toUpperCase())

      if (!label) {
        setError('Package not found')
        setSelectedLabel(null)
      } else {
        // Fetch checkpoints from shipment tracking
        const { data: checkpoints } = await supabase
          .from('addresses_shipment_tracking')
          .select('*')
          .eq('shipment_id', label.id)
          .order('scanned_at', { ascending: false })

        setSelectedLabel({
          ...label,
          checkpoints: checkpoints || []
        })
        setViewMode('map')
      }
    } catch (err) {
      setError(err.message || 'Error searching for package')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filter labels
  const filteredLabels = allLabels.filter(label => {
    if (filterStatus !== 'all' && label.status !== filterStatus) {
      return false
    }
    if (searchQuery.trim() && !label.serial_id.includes(searchQuery.toUpperCase())) {
      return false
    }
    return true
  })

  // Calculate route distance and ETA
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Get route information
  const getRouteInfo = () => {
    if (!selectedLabel || !selectedLabel.origin_address || !selectedLabel.destination_address) {
      return null
    }

    const origin = selectedLabel.origin_address
    const destination = selectedLabel.destination_address
    
    if (!origin.addresses_latitude || !destination.addresses_latitude) {
      return null
    }

    const distance = calculateDistance(
      origin.addresses_latitude,
      origin.addresses_longitude,
      destination.addresses_latitude,
      destination.addresses_longitude
    )

    // Estimate delivery time (assuming average speed of 40 km/h for courier)
    const estimatedHours = distance / 40
    const estimatedDays = Math.ceil(estimatedHours / 8)

    return {
      distance: distance.toFixed(2),
      estimatedHours: estimatedHours.toFixed(1),
      estimatedDays
    }
  }

  const routeInfo = getRouteInfo()

  return (
    <div className="package-tracker">
      <div className="tracker-header">
        <h2>Package Tracking</h2>
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            📋 List
          </button>
          <button
            className={`toggle-btn ${viewMode === 'map' ? 'active' : ''}`}
            onClick={() => setViewMode('map')}
          >
            🗺️ Map
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSearch} className="search-box">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Serial ID..."
          className="search-input"
        />
        <button type="submit" disabled={loading} className="btn btn-search">
          🔍 Search
        </button>
        <button
          type="button"
          onClick={loadLabels}
          disabled={loading}
          className="btn btn-refresh"
        >
          🔄 Refresh
        </button>
      </form>

      {viewMode === 'list' && (
        <div className="list-view">
          <div className="filter-bar">
            <label>Filter by Status:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="all">All</option>
              <option value="created">Created</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>

          {loading ? (
            <div className="loading">Loading packages...</div>
          ) : filteredLabels.length === 0 ? (
            <div className="empty-state">No packages found</div>
          ) : (
            <div className="labels-list">
              {filteredLabels.map(label => (
                <div
                  key={label.id}
                  className={`label-card ${selectedLabel?.id === label.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedLabel(label)
                    setViewMode('map')
                  }}
                >
                  <div className="card-header">
                    <h4>{label.serial_id}</h4>
                    <span className={`status-badge status-${label.status}`}>
                      {label.status?.toUpperCase()}
                    </span>
                  </div>
                  
                  {label.package_name && (
                    <p className="card-text">{label.package_name}</p>
                  )}
                  
                  <div className="card-meta">
                    {label.checkpoints && label.checkpoints.length > 0 && (
                      <span>📍 {label.checkpoints.length} checkpoints</span>
                    )}
                    <span>📅 {new Date(label.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === 'map' && selectedLabel && (
        <div className="map-view">
          <div className="map-sidebar">
            <div className="sidebar-header">
              <h3>{selectedLabel.serial_id}</h3>
              <button
                onClick={() => setSelectedLabel(null)}
                className="close-btn"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="package-info">
              {selectedLabel.package_name && (
                <div className="info-item">
                  <span className="label">Package:</span>
                  <span className="value">{selectedLabel.package_name}</span>
                </div>
              )}

              <div className="info-item">
                <span className="label">Status:</span>
                <span className={`value status-${selectedLabel.status}`}>
                  {selectedLabel.status?.toUpperCase()}
                </span>
              </div>

              {selectedLabel.package_weight && (
                <div className="info-item">
                  <span className="label">Weight:</span>
                  <span className="value">{selectedLabel.package_weight} kg</span>
                </div>
              )}

              {routeInfo && (
                <div className="route-info">
                  <h4>Route Information</h4>
                  <div className="info-item">
                    <span className="label">Distance:</span>
                    <span className="value">{routeInfo.distance} km</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Est. Time:</span>
                    <span className="value">{routeInfo.estimatedHours} hours</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Est. Days:</span>
                    <span className="value">{routeInfo.estimatedDays} day(s)</span>
                  </div>
                </div>
              )}
            </div>

            {selectedLabel.checkpoints && selectedLabel.checkpoints.length > 0 && (
              <div className="checkpoints-sidebar">
                <h4>Checkpoint History</h4>
                <div className="checkpoints-list">
                  {selectedLabel.checkpoints.map((checkpoint, index) => (
                    <div key={checkpoint.id} className="checkpoint-item">
                      <div className="checkpoint-number">{index + 1}</div>
                      <div className="checkpoint-details">
                        <h5>{checkpoint.checkpoint_name}</h5>
                        <p className="timestamp">
                          {new Date(checkpoint.scanned_at).toLocaleString()}
                        </p>
                        {checkpoint.location_address && (
                          <p className="address">{checkpoint.location_address}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="map-container">
            {selectedLabel.checkpoints && selectedLabel.checkpoints.length > 0 ? (
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

                {selectedLabel.origin_address && selectedLabel.origin_address.addresses_latitude && (
                  <Marker
                    position={[
                      selectedLabel.origin_address.addresses_latitude,
                      selectedLabel.origin_address.addresses_longitude
                    ]}
                    icon={createMarkerIcon('origin')}
                  >
                    <Popup>
                      <strong>Origin</strong><br />
                      {selectedLabel.origin_address.addresses_address}
                    </Popup>
                  </Marker>
                )}

                {selectedLabel.checkpoints.filter(cp => cp.latitude && cp.longitude).map((checkpoint, index) => (
                  <Marker
                    key={checkpoint.id || index}
                    position={[parseFloat(checkpoint.latitude), parseFloat(checkpoint.longitude)]}
                    icon={createMarkerIcon(index === selectedLabel.checkpoints.length - 1 ? 'current' : 'checkpoint')}
                  >
                    <Popup>
                      <strong>{checkpoint.checkpoint_name || 'Checkpoint'}</strong><br />
                      {checkpoint.checkpoint_type && <span>{checkpoint.checkpoint_type}<br /></span>}
                      {checkpoint.scanned_at && <span>{new Date(checkpoint.scanned_at).toLocaleString()}<br /></span>}
                      {checkpoint.location_address && <span>{checkpoint.location_address}</span>}
                    </Popup>
                  </Marker>
                ))}

                {selectedLabel.destination_address && selectedLabel.destination_address.addresses_latitude && (
                  <Marker
                    position={[
                      selectedLabel.destination_address.addresses_latitude,
                      selectedLabel.destination_address.addresses_longitude
                    ]}
                    icon={createMarkerIcon('destination')}
                  >
                    <Popup>
                      <strong>Destination</strong><br />
                      {selectedLabel.destination_address.addresses_address}
                    </Popup>
                  </Marker>
                )}

                {selectedLabel.checkpoints.length > 0 && (
                  <Polyline
                    positions={selectedLabel.checkpoints
                      .filter(cp => cp.latitude && cp.longitude)
                      .map(cp => [parseFloat(cp.latitude), parseFloat(cp.longitude)])}
                    color="#3b82f6"
                    weight={2}
                    opacity={0.7}
                  />
                )}
              </MapContainer>
            ) : (
              <div className="no-map-data">
                <p>No location data available for this package</p>
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'map' && !selectedLabel && (
        <div className="empty-map">
          <p>Select a package from the list to view its tracking map</p>
          <button onClick={() => setViewMode('list')} className="btn btn-primary">
            View Packages
          </button>
        </div>
      )}
    </div>
  )
}
