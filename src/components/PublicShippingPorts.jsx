import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { fetchShippingPorts, searchShippingPorts, getShippingPortCities, getShippingPortRegions, getShippingPortStats } from '../lib/shippingPortsService'
import PortDetailsModal from './PortDetailsModal'
import './PublicShippingPorts.css'

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const getPortIcon = (portType) => {
  const colors = {
    'seaport': '#3b82f6',
    'airport': '#8b5cf6',
    'inland': '#10b981',
    'border': '#f59e0b',
    'default': '#6b7280'
  }
  
  const color = colors[portType?.toLowerCase()] || colors.default
  
  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`)}`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  })
}

export default function PublicShippingPorts() {
  const mapRef = useRef(null)
  const [allPorts, setAllPorts] = useState([])
  const [filteredPorts, setFilteredPorts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [selectedPort, setSelectedPort] = useState(null)
  const [expandedPortId, setExpandedPortId] = useState(null)
  const [cities, setCities] = useState([])
  const [regions, setRegions] = useState([])
  const [stats, setStats] = useState(null)
  const [mapCenter, setMapCenter] = useState([12.8797, 121.7740])
  const [mapWidth, setMapWidth] = useState(70)
  const [showStats, setShowStats] = useState(true)
  const [modalPort, setModalPort] = useState(null)
  const [viewMode, setViewMode] = useState('list')
  const [selectedPortType, setSelectedPortType] = useState('')

  const portTypes = ['seaport', 'airport', 'inland', 'border']

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [searchQuery, selectedCity, selectedRegion, selectedPortType])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      setError('')

      let portsData = []
      let citiesData = []
      let regionsData = []
      let statsData = null
      let hasError = false

      try {
        portsData = await fetchShippingPorts()
      } catch (err) {
        console.error('Error loading ports:', err)
        hasError = true
      }

      try {
        citiesData = await getShippingPortCities()
      } catch (err) {
        console.error('Error loading cities:', err)
      }

      try {
        regionsData = await getShippingPortRegions()
      } catch (err) {
        console.error('Error loading regions:', err)
      }

      try {
        statsData = await getShippingPortStats()
      } catch (err) {
        console.error('Error loading stats:', err)
      }

      setAllPorts(portsData)
      setFilteredPorts(portsData)
      setCities(citiesData)
      setRegions(regionsData)
      setStats(statsData)

      if (hasError && portsData.length === 0) {
        setError('Unable to load shipping ports. Please check your internet connection and try again.')
      }
    } catch (err) {
      console.error('Error in loadInitialData:', err)
      setError('An unexpected error occurred. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = async () => {
    try {
      let filtered = allPorts

      if (searchQuery.trim()) {
        filtered = await searchShippingPorts(searchQuery)
      } else {
        filtered = [...allPorts]
      }

      if (selectedCity) {
        filtered = filtered.filter(port => port.city === selectedCity)
      }

      if (selectedRegion && !selectedCity) {
        filtered = filtered.filter(port => port.region === selectedRegion)
      }

      if (selectedPortType) {
        filtered = filtered.filter(port => port.port_type?.toLowerCase() === selectedPortType)
      }

      setFilteredPorts(filtered)
    } catch (err) {
      console.error('Error applying filters:', err)
    }
  }

  const handlePortClick = (port) => {
    setSelectedPort(port)
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.flyTo([parseFloat(port.latitude), parseFloat(port.longitude)], 12, { duration: 1 })
      }, 0)
    }
  }

  const handleReset = () => {
    setSearchQuery('')
    setSelectedCity('')
    setSelectedRegion('')
    setSelectedPortType('')
    setSelectedPort(null)
    setMapCenter([12.8797, 121.7740])
  }

  const renderPortDetails = (port) => {
    return (
      <div className="port-details-expanded">
        {/* Basic Info */}
        {port.description && (
          <div className="detail-section">
            <p className="description">{port.description}</p>
          </div>
        )}

        {/* Specifications */}
        <div className="detail-section">
          <h5 className="section-title">Port Specifications</h5>
          <div className="details-grid">
            {port.berth_count && (
              <div className="detail-item">
                <span className="label">Berths</span>
                <span className="value">{port.berth_count}</span>
              </div>
            )}
            {port.max_depth_meters && (
              <div className="detail-item">
                <span className="label">Max Depth</span>
                <span className="value">{port.max_depth_meters}m</span>
              </div>
            )}
            {port.max_vessel_length_meters && (
              <div className="detail-item">
                <span className="label">Max Vessel Length</span>
                <span className="value">{port.max_vessel_length_meters}m</span>
              </div>
            )}
            {port.max_vessel_beam_meters && (
              <div className="detail-item">
                <span className="label">Max Vessel Beam</span>
                <span className="value">{port.max_vessel_beam_meters}m</span>
              </div>
            )}
            {port.max_vessel_draft_meters && (
              <div className="detail-item">
                <span className="label">Max Vessel Draft</span>
                <span className="value">{port.max_vessel_draft_meters}m</span>
              </div>
            )}
            {port.annual_capacity_teu && (
              <div className="detail-item">
                <span className="label">Container Capacity</span>
                <span className="value">{port.annual_capacity_teu.toLocaleString()} TEU</span>
              </div>
            )}
            {port.annual_cargo_capacity_tons && (
              <div className="detail-item">
                <span className="label">Cargo Capacity</span>
                <span className="value">{port.annual_cargo_capacity_tons.toLocaleString()} tons</span>
              </div>
            )}
          </div>
        </div>

        {/* Services & Facilities */}
        {(port.container_terminal || port.ro_ro_services || port.breakbulk_services || port.bulk_cargo || port.refrigerated_containers || port.dangerous_cargo) && (
          <div className="detail-section">
            <h5 className="section-title">Services & Facilities</h5>
            <div className="services-grid">
              {port.container_terminal && <div className="service-badge">📦 Container Terminal</div>}
              {port.ro_ro_services && <div className="service-badge">🚗 RoRo Services</div>}
              {port.breakbulk_services && <div className="service-badge">📦 Breakbulk Services</div>}
              {port.bulk_cargo && <div className="service-badge">⬜ Bulk Cargo</div>}
              {port.refrigerated_containers && <div className="service-badge">❄️ Refrigerated Containers</div>}
              {port.dangerous_cargo && <div className="service-badge">⚠️ Dangerous Cargo</div>}
            </div>
          </div>
        )}

        {/* Additional Features */}
        {(port.has_customs || port.has_immigration || port.has_quarantine || port.has_storage) && (
          <div className="detail-section">
            <h5 className="section-title">Facilities</h5>
            <div className="services-grid">
              {port.has_customs && <div className="facility-badge">✓ Customs</div>}
              {port.has_immigration && <div className="facility-badge">✓ Immigration</div>}
              {port.has_quarantine && <div className="facility-badge">✓ Quarantine</div>}
              {port.has_storage && <div className="facility-badge">✓ Storage</div>}
            </div>
          </div>
        )}

        {/* Contact Information */}
        {(port.contact_phone || port.contact_email || port.website || port.port_authority) && (
          <div className="detail-section">
            <h5 className="section-title">Contact Information</h5>
            <div className="contact-info">
              {port.port_authority && <p><strong>Authority:</strong> {port.port_authority}</p>}
              {port.contact_phone && (
                <p><strong>Phone:</strong> <a href={`tel:${port.contact_phone}`}>{port.contact_phone}</a></p>
              )}
              {port.contact_email && (
                <p><strong>Email:</strong> <a href={`mailto:${port.contact_email}`}>{port.contact_email}</a></p>
              )}
              {port.website && (
                <p><a href={port.website} target="_blank" rel="noopener noreferrer" className="website-link">Visit Website →</a></p>
              )}
            </div>
          </div>
        )}

        {/* Geographic Info */}
        {(port.latitude && port.longitude) && (
          <div className="detail-section">
            <h5 className="section-title">Location</h5>
            <div className="contact-info">
              <p><strong>Coordinates:</strong> {parseFloat(port.latitude).toFixed(6)}, {parseFloat(port.longitude).toFixed(6)}</p>
            </div>
          </div>
        )}

        {/* Status */}
        {port.operational_status && (
          <div className="detail-section">
            <h5 className="section-title">Status</h5>
            <div className="status-badge" style={{
              backgroundColor: port.operational_status === 'active' ? '#d1fae5' : '#fef3c7',
              color: port.operational_status === 'active' ? '#065f46' : '#92400e',
              padding: '6px 12px',
              borderRadius: '4px',
              display: 'inline-block',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}>
              {port.operational_status.charAt(0).toUpperCase() + port.operational_status.slice(1)}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="public-shipping-ports">
        <div className="loading-state">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1rem', marginBottom: '8px' }}>Loading shipping ports...</div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>This may take a moment on first load</div>
          </div>
        </div>
      </div>
    )
  }

  if (error && filteredPorts.length === 0) {
    return (
      <div className="public-shipping-ports">
        <div className="ports-page-header">
          <div className="header-content">
            <h2>Philippine Shipping Ports & Airports</h2>
            <p>Logistics, shipping, and tracking infrastructure across the Philippines</p>
          </div>
        </div>
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', padding: '16px', borderRadius: '6px', marginBottom: '16px' }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: '600' }}>[Warning] {error}</p>
            <button
              onClick={loadInitialData}
              style={{ background: '#dc2626', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="public-shipping-ports">
      {/* Header */}
      <div className="ports-page-header">
        <div className="header-content">
          <h2>Philippine Shipping Ports & Airports</h2>
          <p>Logistics, shipping, and tracking infrastructure across the Philippines</p>
          <div className="view-mode-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'map' ? 'active' : ''}`}
              onClick={() => setViewMode('map')}
              title="Map View"
            >
              Map
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'map' ? (
        <div className="ports-page-container">
          {/* Map Section */}
          <div className="ports-map-section" style={{ flex: `1 1 ${mapWidth}%` }}>
            <div className="map-header">
              <h3>Port Locations Map</h3>
              <div className="map-controls">
                <button
                  onClick={() => setMapWidth(prev => Math.max(prev - 10, 30))}
                  className="btn-resize"
                  title="Collapse map"
                >
                  ‹
                </button>
                <button
                  onClick={() => setMapWidth(prev => Math.min(prev + 10, 80))}
                  className="btn-resize"
                  title="Expand map"
                >
                  ›
                </button>
              </div>
            </div>

            {error && (
              <div className="error-message">
                {error}
                <button onClick={() => setError('')} className="error-close">×</button>
              </div>
            )}

            <div className="map-wrapper">
              {!error && (
                <MapContainer
                  ref={mapRef}
                  center={mapCenter}
                  zoom={6}
                  style={{ height: '100%', width: '100%' }}
                  attributionControl={false}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {filteredPorts.map(port => (
                    <Marker
                      key={port.id}
                      position={[parseFloat(port.latitude), parseFloat(port.longitude)]}
                      icon={getPortIcon(port.port_type)}
                      eventHandlers={{
                        click: () => handlePortClick(port)
                      }}
                    >
                      <Popup closeButton={true} autoClose={false} closeOnClick={false}>
                        <div className="marker-popup" onClick={(e) => e.stopPropagation()}>
                          <h4>{port.name}</h4>
                          <p><strong>Type:</strong> <span style={{ textTransform: 'capitalize' }}>{port.port_type}</span></p>
                          <p><strong>Region:</strong> {port.region}</p>
                          <p><strong>City:</strong> {port.city}</p>
                          <button
                            className="view-details-btn"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                            }}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setModalPort(port)
                            }}
                          >
                            View Full Details
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              )}
            </div>
          </div>

          {/* Sidebar Section */}
          <div className="ports-sidebar" style={{ flex: `1 1 ${100 - mapWidth}%` }}>
            {/* Stats Section */}
            {showStats && stats && (
              <div className="stats-section">
                <div className="stats-header">
                  <h4>Infrastructure Statistics</h4>
                  <button onClick={() => setShowStats(false)} className="stats-close">−</button>
                </div>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-value">{stats.totalPorts}</span>
                    <span className="stat-label">Total Facilities</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{stats.activePortsCount || stats.totalPorts}</span>
                    <span className="stat-label">Active</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{stats.internationalPorts || '—'}</span>
                    <span className="stat-label">International</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{stats.domesticPorts || '—'}</span>
                    <span className="stat-label">Domestic</span>
                  </div>
                </div>
              </div>
            )}

            {/* Filters Section */}
            <div className="filters-section">
              <div className="filter-group">
                <label>Search Ports & Airports</label>
                <input
                  type="text"
                  placeholder="Search by name or city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="filter-input"
                />
              </div>

              {portTypes.length > 0 && (
                <div className="filter-group">
                  <label>Type</label>
                  <select
                    value={selectedPortType}
                    onChange={(e) => setSelectedPortType(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">All Types</option>
                    {portTypes.map(type => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {regions.length > 0 && (
                <div className="filter-group">
                  <label>Region</label>
                  <select
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    className="filter-select"
                    disabled={selectedCity !== ''}
                  >
                    <option value="">All Regions</option>
                    {regions.map(region => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                </div>
              )}

              {cities.length > 0 && (
                <div className="filter-group">
                  <label>City</label>
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">All Cities</option>
                    {cities.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
              )}

              {(searchQuery || selectedCity || selectedRegion || selectedPortType) && (
                <button onClick={handleReset} className="btn-reset-filters">
                  Reset Filters
                </button>
              )}
            </div>

            {/* Ports List */}
            <div className="ports-list-section">
              <h4>{filteredPorts.length} Port{filteredPorts.length !== 1 ? 's' : ''} Found</h4>

              {filteredPorts.length === 0 ? (
                <div className="empty-list">
                  <p>No ports match your search criteria.</p>
                </div>
              ) : (
                <div className="ports-list">
                  {filteredPorts.map(port => (
                    <div
                      key={port.id}
                      className={`port-list-item ${selectedPort?.id === port.id ? 'active' : ''}`}
                      onClick={() => handlePortClick(port)}
                    >
                      <div className="port-item-header">
                        <h5>{port.name}</h5>
                        <span className={`type-badge ${port.port_type}`}>
                          {port.port_type}
                        </span>
                      </div>
                      <p className="port-item-info">{port.region}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="ports-list-view-container">
          {/* Search & Filter Section */}
          <div className="ports-list-controls">
            <div className="search-group">
              <input
                type="text"
                placeholder="Search ports by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="filter-group">
              <select
                value={selectedPortType}
                onChange={(e) => setSelectedPortType(e.target.value)}
                className="city-filter"
              >
                <option value="">All Types</option>
                {portTypes.map(type => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {cities.length > 0 && (
              <div className="filter-group">
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="city-filter"
                >
                  <option value="">All Cities</option>
                  {cities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleReset}
              className="btn-reset"
            >
              Reset
            </button>
          </div>

          {/* Ports List */}
          <div className="ports-list">
            {filteredPorts.length === 0 ? (
              <div className="empty-state">
                <p>No ports found. Try adjusting your search filters.</p>
              </div>
            ) : (
              filteredPorts.map(port => (
                <div
                  key={port.id}
                  className={`port-card ${expandedPortId === port.id ? 'expanded' : ''}`}
                >
                  <div className="port-card-header">
                    <div className="port-header-info">
                      <h4>{port.name}</h4>
                      <div className="port-meta">
                        <span className={`type-badge ${port.port_type}`}>
                          {port.port_type}
                        </span>
                        <span className="region-text">{port.region}</span>
                      </div>
                    </div>
                    <button
                      className="expand-btn"
                      onClick={() => setExpandedPortId(expandedPortId === port.id ? null : port.id)}
                      title={expandedPortId === port.id ? 'Collapse' : 'Expand'}
                    >
                      {expandedPortId === port.id ? '−' : '+'}
                    </button>
                  </div>

                  <div className="port-card-body">
                    <div className="port-basic-info">
                      <div className="info-row">
                        <span className="label">City:</span>
                        <span className="value">{port.city}</span>
                      </div>
                      {port.port_authority && (
                        <div className="info-row">
                          <span className="label">Authority:</span>
                          <span className="value">{port.port_authority}</span>
                        </div>
                      )}
                      {port.operational_status && (
                        <div className="info-row">
                          <span className="label">Status:</span>
                          <span className="value" style={{ textTransform: 'capitalize' }}>{port.operational_status}</span>
                        </div>
                      )}
                    </div>

                    {expandedPortId === port.id && renderPortDetails(port)}

                    <button
                      className="view-details-modal-btn"
                      onClick={() => setModalPort(port)}
                    >
                      View Full Details
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Ports Count Footer */}
          <div className="ports-footer">
            <p>{filteredPorts.length} shipping port{filteredPorts.length !== 1 ? 's' : ''} & airport{filteredPorts.length !== 1 ? 's' : ''} found</p>
          </div>
        </div>
      )}

      {/* Port Details Modal */}
      {modalPort && (
        <PortDetailsModal
          port={modalPort}
          onClose={() => setModalPort(null)}
        />
      )}
    </div>
  )
}
