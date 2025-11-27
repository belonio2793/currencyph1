import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabaseClient'
import { logErrorSafely, getSafeErrorMessage } from '../lib/safeErrorHandler'
import './ShippingTrackingTab.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

export default function TrackPackageTab({ userId }) {
  const mapRef = useRef(null)
  const [shipments, setShipments] = useState([])
  const [selectedShipment, setSelectedShipment] = useState(null)
  const [trackingCheckpoints, setTrackingCheckpoints] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [mapCenter, setMapCenter] = useState([12.8797, 121.7740])
  const [zoomLevel, setZoomLevel] = useState(6)

  useEffect(() => {
    if (userId) {
      loadShipments()
    }
  }, [userId])

  const loadShipments = async () => {
    if (!userId) return
    try {
      setLoading(true)
      setError('')
      
      const { data, error: fetchError } = await supabase
        .from('addresses_shipment_labels')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setShipments(data || [])
    } catch (err) {
      logErrorSafely('TrackPackageTab.loadShipments', err)
      const safeErrorMessage = getSafeErrorMessage(err)
      setError(safeErrorMessage || 'Failed to load shipments')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectShipment = async (shipment) => {
    try {
      setSelectedShipment(shipment)
      setError('')

      const { data: checkpoints, error: checkpointError } = await supabase
        .from('addresses_shipment_tracking')
        .select('*')
        .eq('shipment_id', shipment.id)
        .order('created_at', { ascending: true })

      if (checkpointError) throw checkpointError
      setTrackingCheckpoints(checkpoints || [])

      if (checkpoints && checkpoints.length > 0) {
        const validCheckpoints = checkpoints.filter(cp => cp.latitude && cp.longitude)
        if (validCheckpoints.length > 0) {
          const latLngs = validCheckpoints.map(cp => [cp.latitude, cp.longitude])
          const bounds = L.latLngBounds(latLngs)
          
          if (mapRef.current) {
            setTimeout(() => {
              mapRef.current?.fitBounds(bounds, { padding: [50, 50] })
            }, 100)
          }
        }
      }
    } catch (err) {
      logErrorSafely('TrackPackageTab.handleSelectShipment', err)
      const safeErrorMessage = getSafeErrorMessage(err)
      setError(safeErrorMessage || 'Failed to load tracking data')
    }
  }

  const getFilteredShipments = () => {
    let filtered = shipments

    if (filterStatus !== 'all') {
      filtered = filtered.filter(s => s.status === filterStatus)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(s =>
        (s.serial_id && s.serial_id.toLowerCase().includes(query)) ||
        (s.package_name && s.package_name.toLowerCase().includes(query))
      )
    }

    return filtered
  }

  const getStatusColor = (status) => {
    const colors = {
      'created': '#3b82f6',
      'scanned': '#f59e0b',
      'in-transit': '#f59e0b',
      'delivered': '#10b981',
      'failed': '#ef4444',
      'archived': '#6b7280'
    }
    return colors[status] || '#6b7280'
  }

  const getStatusLabel = (status) => {
    const labels = {
      'created': 'Created',
      'scanned': 'Scanned',
      'in-transit': 'In Transit',
      'delivered': 'Delivered',
      'failed': 'Failed',
      'archived': 'Archived'
    }
    return labels[status] || status
  }

  const filteredShipments = getFilteredShipments()

  const getRoutePolyline = () => {
    if (!trackingCheckpoints || trackingCheckpoints.length === 0) return null

    const validCheckpoints = trackingCheckpoints
      .filter(cp => cp.latitude && cp.longitude)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

    if (validCheckpoints.length < 2) return null
    return validCheckpoints.map(cp => [cp.latitude, cp.longitude])
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#f8fafc', flex: 1 }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', background: 'white', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Package Tracking</h3>
      </div>

      {/* Search and Filter Bar */}
      <div style={{ padding: '20px 24px', background: 'white', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by serial ID, package name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            minWidth: '250px',
            padding: '10px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px',
            fontFamily: 'inherit'
          }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: '10px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '13px',
            background: 'white',
            cursor: 'pointer'
          }}
        >
          <option value="all">All Statuses</option>
          <option value="created">Created</option>
          <option value="scanned">Scanned</option>
          <option value="in-transit">In Transit</option>
          <option value="delivered">Delivered</option>
        </select>
        <button
          onClick={loadShipments}
          disabled={loading}
          style={{
            padding: '10px 16px',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '500',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{ padding: '12px 24px', background: '#fee2e2', color: '#991b1b', borderLeft: '4px solid #dc2626', margin: '15px 20px 0 20px', borderRadius: '4px' }}>
          {error}
          <button
            onClick={() => setError('')}
            style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', marginLeft: '10px', fontSize: '16px', fontWeight: 'bold' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '350px 1fr', gap: '1px', background: '#e5e7eb', overflow: 'hidden', minHeight: '600px' }}>
        {/* Left Sidebar - Shipments List */}
        <div style={{ background: 'white', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Sidebar Header */}
          <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#1f2937', fontWeight: '600' }}>
              Shipments ({filteredShipments.length})
            </h3>
          </div>

          {/* Shipments List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
                Loading shipments...
              </div>
            ) : filteredShipments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
                <p style={{ margin: 0, fontSize: '14px' }}>No shipments found</p>
              </div>
            ) : (
              filteredShipments.map(shipment => (
                <div
                  key={shipment.id}
                  onClick={() => handleSelectShipment(shipment)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    background: selectedShipment?.id === shipment.id ? '#eff6ff' : 'white',
                    borderLeft: selectedShipment?.id === shipment.id ? '4px solid #3b82f6' : '4px solid transparent',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedShipment?.id !== shipment.id) {
                      e.currentTarget.style.background = '#f9fafb'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedShipment?.id !== shipment.id) {
                      e.currentTarget.style.background = 'white'
                    }
                  }}
                >
                  <div style={{ fontWeight: '600', fontSize: '13px', color: '#1f2937', marginBottom: '4px', fontFamily: 'monospace' }}>
                    {shipment.serial_id || 'Unknown'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                    {shipment.package_name || 'Untitled Package'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      background: getStatusColor(shipment.status),
                      color: 'white',
                      borderRadius: '3px',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>
                      {getStatusLabel(shipment.status)}
                    </span>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                      {shipment.package_weight ? `${shipment.package_weight}kg` : '—'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side - Map and Details */}
        <div style={{ background: 'white', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedShipment ? (
            <>
              {/* Details Panel */}
              <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Package Information
                </h4>
                <div style={{ fontSize: '13px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Serial ID</div>
                    <div style={{ color: '#1f2937', fontWeight: '500', fontFamily: 'monospace' }}>{selectedShipment.serial_id || '—'}</div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Package Name</div>
                    <div style={{ color: '#1f2937', fontWeight: '500' }}>{selectedShipment.package_name || '—'}</div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Status</div>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      background: getStatusColor(selectedShipment.status),
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>
                      {getStatusLabel(selectedShipment.status)}
                    </span>
                  </div>
                  {selectedShipment.package_weight && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Weight</div>
                      <div style={{ color: '#1f2937' }}>{selectedShipment.package_weight} kg</div>
                    </div>
                  )}
                  {selectedShipment.package_dimensions && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Dimensions</div>
                      <div style={{ color: '#1f2937' }}>{selectedShipment.package_dimensions}</div>
                    </div>
                  )}
                  {selectedShipment.package_description && (
                    <div>
                      <div style={{ fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Description</div>
                      <div style={{ color: '#1f2937', fontSize: '12px' }}>{selectedShipment.package_description}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Map Container */}
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#f9fafb', display: 'flex', flexDirection: 'column' }}>
                {trackingCheckpoints.length > 0 ? (
                  <>
                    <MapContainer
                      ref={mapRef}
                      center={mapCenter}
                      zoom={zoomLevel}
                      style={{ flex: 1, width: '100%' }}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      />

                      {/* Draw polyline route */}
                      {getRoutePolyline() && (
                        <Polyline
                          positions={getRoutePolyline()}
                          color="#3b82f6"
                          weight={3}
                          opacity={0.7}
                        />
                      )}

                      {/* Draw checkpoint markers */}
                      {trackingCheckpoints.map((checkpoint, index) => {
                        if (!checkpoint.latitude || !checkpoint.longitude) return null
                        
                        const isFirst = index === 0
                        const isLast = index === trackingCheckpoints.filter(cp => cp.latitude && cp.longitude).length - 1
                        
                        let markerColor = '#f59e0b'
                        if (isFirst) markerColor = '#3b82f6'
                        if (isLast && checkpoint.status === 'delivered') markerColor = '#10b981'

                        return (
                          <Marker
                            key={checkpoint.id}
                            position={[checkpoint.latitude, checkpoint.longitude]}
                            icon={L.icon({
                              iconUrl: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="${markerColor}"/></svg>`)}`,
                              iconSize: [24, 24],
                              iconAnchor: [12, 12]
                            })}
                          >
                            <Popup>
                              <div style={{ fontSize: '12px', minWidth: '200px' }}>
                                <strong>{checkpoint.checkpoint_name || 'Checkpoint'}</strong>
                                <p style={{ margin: '4px 0', fontSize: '11px', color: '#6b7280' }}>
                                  {new Date(checkpoint.created_at).toLocaleString()}
                                </p>
                                <p style={{ margin: '4px 0', fontSize: '11px' }}>
                                  {checkpoint.location_address || `${checkpoint.latitude.toFixed(4)}, ${checkpoint.longitude.toFixed(4)}`}
                                </p>
                                {checkpoint.notes && (
                                  <p style={{ margin: '4px 0', fontSize: '11px', fontStyle: 'italic', color: '#6b7280' }}>
                                    {checkpoint.notes}
                                  </p>
                                )}
                              </div>
                            </Popup>
                          </Marker>
                        )
                      })}
                    </MapContainer>
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                    <p style={{ margin: 0, textAlign: 'center', padding: '20px' }}>No tracking checkpoints yet</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
              <p style={{ margin: 0, textAlign: 'center', padding: '20px' }}>Select a shipment to view tracking details and map</p>
            </div>
          )}
        </div>
      </div>

      {/* Checkpoints Timeline */}
      {selectedShipment && trackingCheckpoints.length > 0 && (
        <div style={{ background: 'white', borderTop: '1px solid #e5e7eb', maxHeight: '300px', overflowY: 'auto', padding: '20px 24px' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Tracking History
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {trackingCheckpoints.map((checkpoint, index) => (
              <div
                key={checkpoint.id}
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '12px',
                  background: '#f9fafb',
                  borderRadius: '6px',
                  borderLeft: '3px solid #3b82f6'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  background: '#3b82f6',
                  color: 'white',
                  borderRadius: '50%',
                  fontSize: '12px',
                  fontWeight: '600',
                  flexShrink: 0
                }}>
                  {index + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '600', color: '#1f2937' }}>
                    {checkpoint.checkpoint_name || 'Checkpoint'}
                  </div>
                  <div style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#9ca3af' }}>
                    {new Date(checkpoint.created_at).toLocaleString()}
                  </div>
                  {checkpoint.location_address && (
                    <div style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#3b82f6' }}>
                      {checkpoint.location_address}
                    </div>
                  )}
                  {checkpoint.latitude && checkpoint.longitude && (
                    <div style={{ margin: '2px 0', fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
                      {checkpoint.latitude.toFixed(6)}, {checkpoint.longitude.toFixed(6)}
                    </div>
                  )}
                  {checkpoint.notes && (
                    <div style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                      {checkpoint.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
