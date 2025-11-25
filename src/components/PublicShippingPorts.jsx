import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { fetchShippingPorts, searchShippingPorts, getShippingPortCities, getShippingPortRegions, getShippingPortStats } from '../lib/shippingPortsService'
import './PublicShippingPorts.css'

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

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
  const [cities, setCities] = useState([])
  const [regions, setRegions] = useState([])
  const [stats, setStats] = useState(null)
  const [mapCenter, setMapCenter] = useState([12.8797, 121.7740])
  const [mapWidth, setMapWidth] = useState(70)
  const [showStats, setShowStats] = useState(true)

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [searchQuery, selectedCity, selectedRegion])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const [portsData, citiesData, regionsData, statsData] = await Promise.all([
        fetchShippingPorts(),
        getShippingPortCities(),
        getShippingPortRegions(),
        getShippingPortStats()
      ])
      
      setAllPorts(portsData)
      setFilteredPorts(portsData)
      setCities(citiesData)
      setRegions(regionsData)
      setStats(statsData)
      setError('')
    } catch (err) {
      console.error('Error loading shipping ports data:', err)
      setError('Failed to load shipping ports')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = async () => {
    try {
      let filtered = allPorts

      // Search filter
      if (searchQuery.trim()) {
        filtered = await searchShippingPorts(searchQuery)
      } else {
        filtered = [...allPorts]
      }

      // City filter
      if (selectedCity) {
        filtered = filtered.filter(port => port.city === selectedCity)
      }

      // Region filter
      if (selectedRegion && !selectedCity) {
        filtered = filtered.filter(port => port.region === selectedRegion)
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
    setSelectedPort(null)
    setMapCenter([12.8797, 121.7740])
  }

  if (loading) {
    return (
      <div className="public-shipping-ports">
        <div className="loading-state">Loading shipping ports...</div>
      </div>
    )
  }

  return (
    <div className="public-shipping-ports">
      {/* Header */}
      <div className="ports-page-header">
        <div className="header-content">
          <h2>Philippine Shipping Ports</h2>
          <p>Explore all public shipping ports across the Philippines</p>
        </div>
      </div>

      {/* Main Content with Map and Sidebar */}
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

                {/* Render port markers */}
                {filteredPorts.map(port => (
                  <Marker
                    key={port.id}
                    position={[parseFloat(port.latitude), parseFloat(port.longitude)]}
                    icon={L.icon({
                      iconUrl: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ef4444"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/><path d="M9 15h6M9 11h6"/></svg>`)}`,
                      iconSize: [28, 28],
                      iconAnchor: [14, 28],
                      popupAnchor: [0, -28],
                    })}
                    eventHandlers={{
                      click: () => handlePortClick(port)
                    }}
                  >
                    <Popup closeButton={true} autoClose={false} closeOnClick={false}>
                      <div className="marker-popup" onClick={(e) => e.stopPropagation()}>
                        <h4>{port.name}</h4>
                        <p><strong>City:</strong> {port.city}</p>
                        <p><strong>Type:</strong> {port.port_type || 'N/A'}</p>
                        <button
                          className="view-details-btn"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handlePortClick(port)
                          }}
                        >
                          View Details
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
                <h4>Port Statistics</h4>
                <button onClick={() => setShowStats(false)} className="stats-close">−</button>
              </div>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-value">{stats.totalPorts}</span>
                  <span className="stat-label">Total Ports</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{stats.activePortsCount}</span>
                  <span className="stat-label">Active</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{stats.internationalPorts}</span>
                  <span className="stat-label">International</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{stats.domesticPorts}</span>
                  <span className="stat-label">Domestic</span>
                </div>
              </div>
            </div>
          )}

          {/* Filters Section */}
          <div className="filters-section">
            <div className="filter-group">
              <label>Search Ports</label>
              <input
                type="text"
                placeholder="Search by name or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="filter-input"
              />
            </div>

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

            {(searchQuery || selectedCity || selectedRegion) && (
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
                    <p className="port-item-city">{port.city}</p>
                    {selectedPort?.id === port.id && (
                      <div className="port-item-details">
                        {port.description && (
                          <p className="description">{port.description}</p>
                        )}
                        {port.berth_count && (
                          <p><strong>Berths:</strong> {port.berth_count}</p>
                        )}
                        {port.max_depth_meters && (
                          <p><strong>Max Depth:</strong> {port.max_depth_meters}m</p>
                        )}
                        {port.contact_phone && (
                          <p><strong>Phone:</strong> <a href={`tel:${port.contact_phone}`}>{port.contact_phone}</a></p>
                        )}
                        {port.website && (
                          <p><a href={port.website} target="_blank" rel="noopener noreferrer">Visit Website →</a></p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
