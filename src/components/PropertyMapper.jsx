import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabaseClient'
import './PropertyMapper.css'

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

export default function PropertyMapper({ userId }) {
  const mapRef = useRef(null)
  const [properties, setProperties] = useState([])
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mapCenter] = useState([12.8797, 121.7740])
  const [zoomLevel, setZoomLevel] = useState(6)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredProperties, setFilteredProperties] = useState([])

  // Load properties from database
  useEffect(() => {
    loadProperties()
  }, [userId])

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

  const loadProperties = async () => {
    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', userId)
        .not('addresses_latitude', 'is', null)
        .not('addresses_longitude', 'is', null)

      if (fetchError) throw fetchError
      setProperties(data || [])
    } catch (err) {
      console.error('Error loading properties:', err)
      setError('Failed to load properties')
    } finally {
      setLoading(false)
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

  return (
    <div className="property-mapper-container">
      {/* Search Bar */}
      <div className="mapper-search-bar">
        <input
          type="text"
          placeholder="Search by address, city, street, or region..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mapper-search-input"
        />
      </div>

      <div className="mapper-main">
        {/* Map Area */}
        <div className="mapper-map-area">
          {loading ? (
            <div className="mapper-loading">Loading properties...</div>
          ) : (
            <MapContainer
              ref={mapRef}
              center={mapCenter}
              zoom={zoomLevel}
              className="mapper-leaflet-container"
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              
              {/* Render property markers */}
              {filteredProperties.map(property => (
                <Marker
                  key={property.id}
                  position={[
                    parseFloat(property.addresses_latitude),
                    parseFloat(property.addresses_longitude)
                  ]}
                  icon={L.icon({
                    iconUrl: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${getZoningColor(property.zoning_classification)}"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>`)}`,
                    iconSize: [25, 25],
                    iconAnchor: [12, 25],
                    popupAnchor: [0, -25]
                  })}
                  eventHandlers={{
                    click: () => handleMarkerClick(property)
                  }}
                >
                  <Popup>
                    <div className="marker-popup">
                      <h4>{property.addresses_street_name}</h4>
                      <p>{property.addresses_city}</p>
                      <button onClick={() => handlePropertyClick(property)}>View Details</button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>

        {/* Sidebar */}
        <div className="mapper-sidebar">
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
              <p>Click on a marker on the map to view property details</p>
              {properties.length === 0 && (
                <p className="empty-message">No properties with location data yet</p>
              )}
              {properties.length > 0 && (
                <div className="properties-list">
                  <h4>Properties:</h4>
                  <ul>
                    {filteredProperties.slice(0, 10).map(prop => (
                      <li
                        key={prop.id}
                        onClick={() => handlePropertyClick(prop)}
                        className="property-list-item"
                      >
                        {prop.addresses_street_name}, {prop.addresses_city}
                      </li>
                    ))}
                    {filteredProperties.length > 10 && (
                      <li className="property-list-more">
                        +{filteredProperties.length - 10} more
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
