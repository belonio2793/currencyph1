import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import './ShippingTrackingTab.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

export default function ShippingTrackingTab({ userId }) {
  const mapRef = useRef(null)
  const [shipments, setShipments] = useState([])
  const [selectedShipment, setSelectedShipment] = useState(null)
  const [trackingHistory, setTrackingHistory] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [mapCenter, setMapCenter] = useState([12.8797, 121.7740])
  const [zoomLevel, setZoomLevel] = useState(6)
  const [mapLayer, setMapLayer] = useState('street')
  const [mapInstance, setMapInstance] = useState(null)
  const [showLegend, setShowLegend] = useState(false)

  const [formData, setFormData] = useState({
    tracking_number: '',
    package_weight: '',
    package_dimensions: '',
    origin_address: '',
    destination_address: '',
    carrier: '',
    status: 'pending',
    estimated_delivery: '',
    notes: ''
  })

  useEffect(() => {
    loadShipments()
  }, [userId])

  const loadShipments = async () => {
    if (!userId) return
    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('shipments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setShipments(data || [])
    } catch (err) {
      console.error('Error loading shipments:', err?.message || err)
      setError(err?.message || 'Failed to load shipments')
    } finally {
      setLoading(false)
    }
  }

  const generateTrackingNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `SHP-${timestamp}-${random}`
  }

  const generateBarcode = (text) => {
    return `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="80">
        <rect width="200" height="80" fill="white"/>
        <text x="100" y="50" text-anchor="middle" font-size="14" font-family="monospace" font-weight="bold">${text}</text>
        <text x="100" y="70" text-anchor="middle" font-size="10" fill="#666">${text}</text>
      </svg>
    `)}`
  }

  const generateQRCode = (text) => {
    const encodedText = encodeURIComponent(text)
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedText}`
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const loadShipmentTrackingHistory = async (shipmentId) => {
    try {
      const { data, error: historyError } = await supabase
        .from('shipment_tracking_history')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('timestamp', { ascending: false })

      if (historyError) throw historyError

      return data || []
    } catch (err) {
      console.error('Error loading tracking history:', err?.message || err)
      return []
    }
  }

  const handleGenerateTracking = () => {
    const trackingNumber = generateTrackingNumber()
    setFormData(prev => ({
      ...prev,
      tracking_number: trackingNumber
    }))
  }

  const handleSelectShipment = async (shipment) => {
    setSelectedShipment(shipment)
    const history = await loadShipmentTrackingHistory(shipment.id)
    setTrackingHistory(history)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.tracking_number || !formData.origin_address || !formData.destination_address) {
      setError('Please fill in tracking number, origin, and destination addresses')
      return
    }

    try {
      setLoading(true)
      const { error: insertError } = await supabase
        .from('shipments')
        .insert([{
          user_id: userId,
          ...formData
        }])

      if (insertError) throw insertError

      setFormData({
        tracking_number: '',
        package_weight: '',
        package_dimensions: '',
        origin_address: '',
        destination_address: '',
        carrier: '',
        status: 'pending',
        estimated_delivery: '',
        notes: ''
      })
      setShowForm(false)
      await loadShipments()
    } catch (err) {
      console.error('Error saving shipment:', err)
      setError(err.message || 'Failed to save shipment')
    } finally {
      setLoading(false)
    }
  }

  const filteredShipments = shipments.filter(shipment => {
    const matchesQuery = shipment.tracking_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.origin_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.destination_address?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = filterStatus === 'all' || shipment.status === filterStatus

    return matchesQuery && matchesStatus
  })

  const getStatusColor = (status) => {
    const colorMap = {
      'pending': '#f59e0b',
      'in-transit': '#3b82f6',
      'delivered': '#10b981',
      'failed': '#ef4444'
    }
    return colorMap[status] || '#6b7280'
  }

  const getStatusBadge = (status) => {
    const labelMap = {
      'pending': 'Pending',
      'in-transit': 'In Transit',
      'delivered': 'Delivered',
      'failed': 'Failed'
    }
    return labelMap[status] || status
  }

  return (
    <div className="shipping-tracking-tab">
      {/* Page Title */}
      <div className="page-title">
        <h2>Shipping</h2>
      </div>

      <div className="shipping-container">
        {/* Header with Search and Filter */}
        <div className="shipping-header">
          <h3>Shipments & Tracking</h3>
          <button 
            onClick={() => setShowForm(true)}
            className="btn-create-shipment"
          >
            + Create Shipment
          </button>
        </div>

        {/* Search and Filter Bar with Map Controls */}
        <div className="shipping-controls">
          <input
            type="text"
            placeholder="Search by tracking number, origin, or destination..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="shipping-search"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="shipping-filter"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in-transit">In Transit</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
          </select>

        </div>

        {error && (
          <div className="shipping-error">
            {error}
            <button onClick={() => setError('')} className="error-close">×</button>
          </div>
        )}

        {/* Map View */}
        <div className="shipping-map-section">
          <div className="map-header">
            <h3>Shipment Routes Map</h3>
          </div>
          <div className="map-container shipping-map">
            <div className="map-overlay-controls">
              <div className="map-resize-controls">
                <button
                  onClick={() => setZoomLevel(prev => Math.max(prev - 1, 2))}
                  className="btn-map-resize-overlay"
                  title="Zoom out"
                >
                  −
                </button>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(prev + 1, 18))}
                  className="btn-map-resize-overlay"
                  title="Zoom in"
                >
                  +
                </button>
              </div>
              <button
                onClick={() => setShowLegend(!showLegend)}
                className="btn-legend-toggle-overlay"
                title={showLegend ? 'Hide map controls' : 'Show map controls'}
              >
                {showLegend ? 'Hide Map Controls' : 'Show Map Controls'}
              </button>
            </div>
            <MapContainer
              ref={mapRef}
              center={mapCenter}
              zoom={zoomLevel}
              style={{ height: '100%', width: '100%' }}
              attributionControl={false}
            >
              <TileLayer
                url={
                  mapLayer === 'satellite'
                    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    : mapLayer === 'terrain'
                    ? 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
                    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                }
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
            </MapContainer>

            {/* Map Legend */}
            {showLegend && (
              <div className="map-legend">
                <div className="legend-header">
                  <h4>Map Controls</h4>
                  <button
                    onClick={() => setShowLegend(false)}
                    className="legend-close"
                  >
                    ✕
                  </button>
                </div>

                <div className="legend-content">
                  {/* Default Location */}
                  <div className="legend-section">
                    <button
                      onClick={() => {
                        const center = [12.8797, 121.7740]
                        const zoom = 6
                        setMapCenter(center)
                        setZoomLevel(zoom)
                        if (mapRef.current) {
                          try {
                            mapRef.current.flyTo(center, zoom, { duration: 1 })
                          } catch (error) {
                            console.error('Error flying to Philippines:', error)
                          }
                        }
                      }}
                      className="btn-default-location"
                      title="Focus on Philippines"
                    >
                      Philippines
                    </button>
                  </div>

                  {/* Layer Selection */}
                  <div className="legend-section">
                    <label className="legend-label">Map Layer</label>
                    <div className="layer-buttons">
                      <button
                        onClick={() => setMapLayer('street')}
                        className={`layer-btn ${mapLayer === 'street' ? 'active' : ''}`}
                        title="Street view"
                      >
                        Street
                      </button>
                      <button
                        onClick={() => setMapLayer('satellite')}
                        className={`layer-btn ${mapLayer === 'satellite' ? 'active' : ''}`}
                        title="Satellite view"
                      >
                        Satellite
                      </button>
                      <button
                        onClick={() => setMapLayer('terrain')}
                        className={`layer-btn ${mapLayer === 'terrain' ? 'active' : ''}`}
                        title="Terrain view"
                      >
                        Terrain
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Shipments List */}
        <div className="shipments-list">
          {loading ? (
            <div className="loading-state">Loading shipments...</div>
          ) : filteredShipments.length === 0 ? (
            <div className="empty-state">
              <p className="empty-title">No shipments found</p>
              <p className="empty-subtitle">
                {shipments.length === 0 
                  ? 'Create your first shipment to track packages'
                  : 'Try adjusting your search or filter'}
              </p>
            </div>
          ) : (
            filteredShipments.map(shipment => (
              <div
                key={shipment.id}
                className="shipment-card"
                onClick={() => handleSelectShipment(shipment)}
              >
                <div className="shipment-card-header">
                  <div className="shipment-info">
                    <h4 className="tracking-number">{shipment.tracking_number}</h4>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(shipment.status) }}
                    >
                      {getStatusBadge(shipment.status)}
                    </span>
                  </div>
                  <span className="shipment-date">
                    {new Date(shipment.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="shipment-details-preview">
                  <div className="detail-item">
                    <span className="label">From:</span>
                    <span className="value">{shipment.origin_address}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">To:</span>
                    <span className="value">{shipment.destination_address}</span>
                  </div>
                  {shipment.package_weight && (
                    <div className="detail-item">
                      <span className="label">Weight:</span>
                      <span className="value">{shipment.package_weight}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Selected Shipment Detail View */}
        {selectedShipment && (
          <div className="shipment-detail-panel">
            <div className="detail-panel-header">
              <h3>Shipment Details</h3>
              <button
                onClick={() => {
                  setSelectedShipment(null)
                  setTrackingHistory([])
                }}
                className="detail-panel-close"
              >
                ×
              </button>
            </div>

            <div className="detail-panel-content">
              <div className="detail-section">
                <h4 className="section-title">Tracking Information</h4>
                <div className="detail-item">
                  <span className="label">Tracking Number:</span>
                  <span className="value">{selectedShipment.tracking_number}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Status:</span>
                  <span
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(selectedShipment.status) }}
                  >
                    {getStatusBadge(selectedShipment.status)}
                  </span>
                </div>
              </div>

              <div className="detail-section">
                <h4 className="section-title">Package Information</h4>
                <div className="detail-item">
                  <span className="label">Origin Address:</span>
                  <span className="value">{selectedShipment.origin_address}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Destination Address:</span>
                  <span className="value">{selectedShipment.destination_address}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Carrier:</span>
                  <span className="value">{selectedShipment.carrier || 'N/A'}</span>
                </div>
              </div>

              <div className="detail-section">
                <h4 className="section-title">Package Details</h4>
                {selectedShipment.package_weight && (
                  <div className="detail-item">
                    <span className="label">Weight:</span>
                    <span className="value">{selectedShipment.package_weight}</span>
                  </div>
                )}
                {selectedShipment.package_dimensions && (
                  <div className="detail-item">
                    <span className="label">Dimensions:</span>
                    <span className="value">{selectedShipment.package_dimensions}</span>
                  </div>
                )}
                {selectedShipment.estimated_delivery && (
                  <div className="detail-item">
                    <span className="label">Est. Delivery:</span>
                    <span className="value">
                      {new Date(selectedShipment.estimated_delivery).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="detail-section">
                <h4 className="section-title">Labels</h4>
                <div className="labels-container">
                  <div className="label-box">
                    <p className="label-title">Barcode Label</p>
                    <img
                      src={generateBarcode(selectedShipment.tracking_number)}
                      alt="Barcode"
                      className="barcode-image"
                    />
                    <button className="btn-download-label">Download</button>
                  </div>
                  <div className="label-box">
                    <p className="label-title">QR Code Label</p>
                    <img
                      src={generateQRCode(selectedShipment.tracking_number)}
                      alt="QR Code"
                      className="qr-image"
                    />
                    <button className="btn-download-label">Download</button>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4 className="section-title">Tracking History</h4>
                {trackingHistory.length === 0 ? (
                  <p className="notes-text">No tracking updates yet. Shipment will be updated when in transit.</p>
                ) : (
                  <div className="tracking-history-list">
                    {trackingHistory.map((entry) => (
                      <div key={entry.id} className="tracking-history-item">
                        <div className="history-timestamp">
                          {new Date(entry.timestamp).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                        <div className="history-status">{entry.status}</div>
                        {entry.location && <div className="history-location">📍 {entry.location}</div>}
                        {entry.notes && <div className="history-notes">{entry.notes}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedShipment.notes && (
                <div className="detail-section">
                  <h4 className="section-title">Notes</h4>
                  <p className="notes-text">{selectedShipment.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Create Shipment Form Modal */}
        {showForm && (
          <div className="form-overlay" onClick={() => setShowForm(false)}>
            <div className="form-modal" onClick={e => e.stopPropagation()}>
              <div className="form-modal-header">
                <h2>Create New Shipment</h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="form-modal-close"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="shipping-form">
                <div className="form-section">
                  <h3 className="form-section-title">Tracking Number</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Tracking Number *</label>
                      <div className="tracking-input-group">
                        <input
                          type="text"
                          name="tracking_number"
                          value={formData.tracking_number}
                          onChange={handleInputChange}
                          placeholder="Auto-generated or enter custom"
                          required
                        />
                        <button
                          type="button"
                          onClick={handleGenerateTracking}
                          className="btn-generate-tracking"
                        >
                          Generate
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3 className="form-section-title">Package Information</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Weight</label>
                      <input
                        type="text"
                        name="package_weight"
                        value={formData.package_weight}
                        onChange={handleInputChange}
                        placeholder="e.g., 2.5 kg"
                      />
                    </div>
                    <div className="form-group">
                      <label>Dimensions</label>
                      <input
                        type="text"
                        name="package_dimensions"
                        value={formData.package_dimensions}
                        onChange={handleInputChange}
                        placeholder="e.g., 20x30x40 cm"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3 className="form-section-title">Addresses</h3>
                  <div className="form-row full">
                    <div className="form-group">
                      <label>Origin Address *</label>
                      <input
                        type="text"
                        name="origin_address"
                        value={formData.origin_address}
                        onChange={handleInputChange}
                        placeholder="Sender's address"
                        required
                      />
                    </div>
                  </div>
                  <div className="form-row full">
                    <div className="form-group">
                      <label>Destination Address *</label>
                      <input
                        type="text"
                        name="destination_address"
                        value={formData.destination_address}
                        onChange={handleInputChange}
                        placeholder="Recipient's address"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3 className="form-section-title">Carrier & Delivery</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Carrier</label>
                      <input
                        type="text"
                        name="carrier"
                        value={formData.carrier}
                        onChange={handleInputChange}
                        placeholder="e.g., JNT, LBC, Lazada"
                      />
                    </div>
                    <div className="form-group">
                      <label>Status</label>
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleInputChange}
                      >
                        <option value="pending">Pending</option>
                        <option value="in-transit">In Transit</option>
                        <option value="delivered">Delivered</option>
                        <option value="failed">Failed</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Estimated Delivery</label>
                      <input
                        type="date"
                        name="estimated_delivery"
                        value={formData.estimated_delivery}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3 className="form-section-title">Additional Notes</h3>
                  <div className="form-group full-width">
                    <label>Notes</label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      placeholder="Any additional information..."
                      rows="4"
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="btn-form-cancel"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-form-save"
                    disabled={loading}
                  >
                    {loading ? 'Creating...' : 'Create Shipment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
