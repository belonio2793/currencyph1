import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabaseClient'
import { fetchShippingPorts } from '../lib/shippingPortsService'
import MapControls from './MapControls'
import './PropertyMapper.css'

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

export default function PropertyMapper({ userId, onPropertyAdded, allowDelete = false, highlightCity = null }) {
  const mapRef = useRef(null)
  const [properties, setProperties] = useState([])
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mapCenter, setMapCenter] = useState([12.8797, 121.7740])
  const [zoomLevel, setZoomLevel] = useState(6)
  const [filteredProperties, setFilteredProperties] = useState([])
  const [propertyCount, setPropertyCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [mapInstance, setMapInstance] = useState(null)
  const [mapLayer, setMapLayer] = useState('street')
  const [showLegend, setShowLegend] = useState(false)
  const [mapWidth, setMapWidth] = useState(70)

  // Load properties from database
  useEffect(() => {
    if (userId) {
      loadProperties()
    }
  }, [userId])

  // Reload properties when a new one is added
  useEffect(() => {
    if (onPropertyAdded) {
      loadProperties()
    }
  }, [onPropertyAdded])

  // Filter properties based on search query
  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const filtered = properties.filter(prop => 
        (prop.addresses_address && prop.addresses_address.toLowerCase().includes(query)) ||
        (prop.addresses_city && prop.addresses_city.toLowerCase().includes(query)) ||
        (prop.addresses_street_name && prop.addresses_street_name.toLowerCase().includes(query)) ||
        (prop.addresses_region && prop.addresses_region.toLowerCase().includes(query))
      )
      setFilteredProperties(filtered)
    } else {
      setFilteredProperties(properties)
    }
  }, [searchQuery, properties])

  const loadProperties = async (retryCount = 0) => {
    try {
      setLoading(true)
      const { data, error: fetchError, count } = await supabase
        .from('addresses')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .not('addresses_latitude', 'is', null)
        .not('addresses_longitude', 'is', null)

      if (fetchError) {
        const errorMsg = fetchError?.message || JSON.stringify(fetchError)
        console.error('Supabase error:', errorMsg)
        throw fetchError
      }
      setProperties(data || [])
      setPropertyCount(count || data?.length || 0)
      setError('')
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('Error loading properties (attempt ' + (retryCount + 1) + '):', errorMsg, err)

      // Check if it's a network error (Failed to fetch)
      const isNetworkError = err?.message?.includes('fetch') || err?.message?.includes('body stream') || err instanceof TypeError

      if (isNetworkError && retryCount < 2) {
        // Retry after delay for network errors
        setTimeout(() => {
          console.log('Retrying property load...')
          loadProperties(retryCount + 1)
        }, 2000 * (retryCount + 1))
      } else {
        // Set user-friendly error message
        if (isNetworkError) {
          setError('Unable to connect to the server. Please check your connection and refresh the page.')
        } else {
          setError('Failed to load properties')
        }
      }
    } finally {
      if (retryCount === 0) {
        setLoading(false)
      }
    }
  }

  const handlePropertyClick = (property) => {
    setSelectedProperty(property)
    if (mapRef.current && property.addresses_latitude && property.addresses_longitude) {
      mapRef.current.flyTo(
        [parseFloat(property.addresses_latitude), parseFloat(property.addresses_longitude)],
        14,
        { duration: 1 }
      )
    }
  }

  const handleMarkerClick = (property) => {
    setSelectedProperty(property)
  }

  const handleCenterLocation = (preset) => {
    if (preset && preset.center && preset.zoom) {
      setMapCenter(preset.center)
      setZoomLevel(preset.zoom)
      if (mapRef.current) {
        try {
          mapRef.current.flyTo(preset.center, preset.zoom, { duration: 1 })
        } catch (error) {
          console.error('Error flying to location:', error)
        }
      }
    }
  }

  const handleDeleteProperty = async () => {
    if (!selectedProperty || !window.confirm('Delete this property?')) return

    try {
      const { error: deleteError } = await supabase
        .from('addresses')
        .delete()
        .eq('id', selectedProperty.id)

      if (deleteError) throw deleteError
      setSelectedProperty(null)
      await loadProperties()
    } catch (err) {
      console.error('Error deleting property:', err)
      setError('Failed to delete property')
    }
  }

  const getZoningColor = (zoning) => {
    const colorMap = {
      'residential': '#4ade80',
      'commercial': '#3b82f6',
      'industrial': '#ef4444',
      'agricultural': '#84cc16',
      'mixed-use': '#f59e0b',
      'govt': '#8b5cf6',
    }
    return colorMap[zoning?.toLowerCase()] || '#94a3b8'
  }

  const getMarkerColor = (property) => {
    if (highlightCity && property.addresses_city === highlightCity) {
      return '#667eea'
    }
    return getZoningColor(property.zoning_classification)
  }

  return (
    <div className="property-mapper-container">
      {/* Map Section */}
      <div className="map-section" style={{ flex: `1 1 ${mapWidth}%` }}>
        {/* Map Header */}
        <div className="map-header">
          <div className="map-header-content">
            <h4>Properties Map</h4>
            <p className="map-subtitle">View all your properties across the Philippines</p>
          </div>
        </div>

        {/* Map Search Bar */}
        <div className="map-search-section">
          <div className="map-search-input-group">
            <input
              type="text"
              placeholder="Search location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="map-search-input"
            />
          </div>
        </div>

        <div className="map-container">
          <div className="map-overlay-controls">
            <div className="map-resize-controls">
              <button
                onClick={() => setMapWidth(prev => Math.max(prev - 10, 30))}
                className="btn-map-resize"
                title="Collapse map"
              >
                ‹
              </button>
              <button
                onClick={() => setMapWidth(prev => Math.min(prev + 10, 80))}
                className="btn-map-resize"
                title="Expand map"
              >
                ›
              </button>
            </div>
            <button
              onClick={() => setShowLegend(!showLegend)}
              className="btn-legend-toggle"
              title={showLegend ? 'Hide map controls' : 'Show map controls'}
            >
              {showLegend ? 'Hide Map Controls' : 'Show Map Controls'}
            </button>
          </div>
          {loading ? (
            <div className="mapper-loading">Loading properties...</div>
          ) : (
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
              />
              
              {/* Render property markers */}
              {filteredProperties.map(property => {
                const isHighlighted = highlightCity && property.addresses_city === highlightCity
                const markerColor = getMarkerColor(property)
                const markerSize = isHighlighted ? 35 : 25

                return (
                  <Marker
                    key={property.id}
                    position={[
                      parseFloat(property.addresses_latitude),
                      parseFloat(property.addresses_longitude)
                    ]}
                    icon={L.icon({
                      iconUrl: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${markerColor}" opacity="${isHighlighted ? 1 : 0.7}"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>`)}`,
                      iconSize: [markerSize, markerSize],
                      iconAnchor: [markerSize / 2, markerSize],
                      popupAnchor: [0, -markerSize],
                      className: isHighlighted ? 'highlighted-marker' : ''
                    })}
                    eventHandlers={{
                      click: () => handleMarkerClick(property)
                    }}
                  >
                    <Popup>
                      <div className="marker-popup">
                        <h4>{property.addresses_street_name}</h4>
                        <p>{property.addresses_city}</p>
                        {property.address_nickname && (
                          <p className="marker-nickname"><strong>Nickname:</strong> {property.address_nickname}</p>
                        )}
                        <button onClick={() => handlePropertyClick(property)}>View Details</button>
                      </div>
                    </Popup>
                  </Marker>
                )
              })}
            </MapContainer>
          )}
        </div>

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

      {/* Sidebar */}
      <div className="mapper-sidebar" style={{ flex: `1 1 ${100 - mapWidth}%` }}>
          {!userId ? (
            <div className="sidebar-empty">
              <div className="empty-state-content">
                <p className="empty-title">Login to view properties</p>
                <p className="empty-subtitle">Sign in to see and manage your properties</p>
                <a href="/login" className="btn-primary" style={{ marginTop: '16px', display: 'inline-block', padding: '10px 20px', backgroundColor: '#3b82f6', color: 'white', borderRadius: '4px', textDecoration: 'none' }}>
                  Sign In Now
                </a>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="sidebar-error">
                  {error}
                  <button onClick={() => setError('')} className="error-close">×</button>
                </div>
              )}

              {selectedProperty ? (
            <div className="property-details-panel">
              <div className="panel-header">
                <h3>Property Details</h3>
                <button onClick={() => setSelectedProperty(null)} className="panel-close">×</button>
              </div>

              <div className="property-details-content">
                {/* Address Section */}
                <div className="details-section">
                  <h4 className="section-title">Address</h4>
                  <div className="detail-item">
                    <span className="label">Street:</span>
                    <span className="value">{selectedProperty.addresses_street_name}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Number:</span>
                    <span className="value">{selectedProperty.addresses_street_number || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">City:</span>
                    <span className="value">{selectedProperty.addresses_city}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Province:</span>
                    <span className="value">{selectedProperty.addresses_province}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Region:</span>
                    <span className="value">{selectedProperty.addresses_region}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Barangay:</span>
                    <span className="value">{selectedProperty.barangay || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Postal Code:</span>
                    <span className="value">{selectedProperty.addresses_postal_code || 'N/A'}</span>
                  </div>
                </div>

                {/* Geolocation Section */}
                <div className="details-section">
                  <h4 className="section-title">Geolocation</h4>
                  <div className="detail-item">
                    <span className="label">Latitude:</span>
                    <span className="value">{selectedProperty.addresses_latitude}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Longitude:</span>
                    <span className="value">{selectedProperty.addresses_longitude}</span>
                  </div>
                  {selectedProperty.elevation && (
                    <div className="detail-item">
                      <span className="label">Elevation:</span>
                      <span className="value">{selectedProperty.elevation}m</span>
                    </div>
                  )}
                </div>

                {/* Property Information */}
                {(selectedProperty.property_type || selectedProperty.lot_area) && (
                  <div className="details-section">
                    <h4 className="section-title">Property Info</h4>
                    {selectedProperty.property_type && (
                      <div className="detail-item">
                        <span className="label">Type:</span>
                        <span className="value">{selectedProperty.property_type}</span>
                      </div>
                    )}
                    {selectedProperty.lot_area && (
                      <div className="detail-item">
                        <span className="label">Lot Area:</span>
                        <span className="value">{selectedProperty.lot_area} {selectedProperty.lot_area_unit}</span>
                      </div>
                    )}
                    {selectedProperty.lot_number && (
                      <div className="detail-item">
                        <span className="label">Lot Number:</span>
                        <span className="value">{selectedProperty.lot_number}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Zoning & Legal */}
                {(selectedProperty.zoning_classification || selectedProperty.land_use) && (
                  <div className="details-section">
                    <h4 className="section-title">Zoning & Legal</h4>
                    {selectedProperty.zoning_classification && (
                      <div className="detail-item">
                        <span className="label">Zoning:</span>
                        <span className="value">
                          <span 
                            className="zoning-badge"
                            style={{ backgroundColor: getZoningColor(selectedProperty.zoning_classification) }}
                          >
                            {selectedProperty.zoning_classification}
                          </span>
                        </span>
                      </div>
                    )}
                    {selectedProperty.land_use && (
                      <div className="detail-item">
                        <span className="label">Land Use:</span>
                        <span className="value">{selectedProperty.land_use}</span>
                      </div>
                    )}
                    {selectedProperty.land_title_number && (
                      <div className="detail-item">
                        <span className="label">Land Title:</span>
                        <span className="value">{selectedProperty.land_title_number}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Ownership */}
                {selectedProperty.owner_name && (
                  <div className="details-section">
                    <h4 className="section-title">Ownership</h4>
                    <div className="detail-item">
                      <span className="label">Owner:</span>
                      <span className="value">{selectedProperty.owner_name}</span>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedProperty.notes && (
                  <div className="details-section">
                    <h4 className="section-title">Notes</h4>
                    <p className="notes-text">{selectedProperty.notes}</p>
                  </div>
                )}
              </div>

              {/* Panel Actions */}
              <div className="panel-actions">
                <button
                  onClick={handleDeleteProperty}
                  className="btn-delete"
                >
                  Delete Property
                </button>
              </div>
            </div>
              ) : (
                <div className="sidebar-empty">
              <div className="empty-state-content">
                <p className="empty-title">No Property Selected</p>
                <p className="empty-subtitle">Click on a marker on the map to view property details</p>

                {properties.length === 0 ? (
                  <div className="empty-state-info">
                    <p className="empty-message">No properties with location data yet</p>
                    <p className="empty-hint">Use the + button to add your first property</p>
                    <a href="#add-property" className="btn-primary" style={{ marginTop: '12px', display: 'inline-block', padding: '8px 16px', backgroundColor: '#10b981', color: 'white', borderRadius: '4px', textDecoration: 'none', fontSize: '14px' }}>
                      + Add Your First Property
                    </a>
                  </div>
                ) : (
                  <div className="properties-list">
                    <div className="properties-list-header">
                      <h4>Properties ({filteredProperties.length})</h4>
                      {searchQuery && (
                        <span className="search-badge">Search Results</span>
                      )}
                    </div>
                    <ul>
                      {filteredProperties.slice(0, 15).map(prop => (
                        <li
                          key={prop.id}
                          onClick={() => handlePropertyClick(prop)}
                          className="property-list-item"
                        >
                          <div className="property-list-item-main">
                            <span className="property-street">{prop.addresses_street_name}</span>
                            <span className="property-city">{prop.addresses_city}</span>
                          </div>
                          {prop.zoning_classification && (
                            <span
                              className="property-zoning-mini"
                              style={{ backgroundColor: getZoningColor(prop.zoning_classification) }}
                            >
                              {prop.zoning_classification.substring(0, 3)}
                            </span>
                          )}
                        </li>
                      ))}
                      {filteredProperties.length > 15 && (
                        <li className="property-list-more">
                          +{filteredProperties.length - 15} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
              )}
            </>
          )}
      </div>
    </div>
  )
}
