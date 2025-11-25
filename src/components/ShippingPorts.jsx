import { useState, useEffect } from 'react'
import { fetchShippingPorts, searchShippingPorts, getShippingPortCities } from '../lib/shippingPortsService'
import './ShippingPorts.css'

export default function ShippingPorts() {
  const [ports, setPorts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [cities, setCities] = useState([])
  const [selectedPort, setSelectedPort] = useState(null)

  useEffect(() => {
    loadPorts()
    loadCities()
  }, [])

  useEffect(() => {
    filterPorts()
  }, [searchQuery, selectedCity])

  const loadPorts = async () => {
    try {
      setLoading(true)
      const data = await fetchShippingPorts()
      setPorts(data)
      setError('')
    } catch (err) {
      console.error('Error loading ports:', err)
      setError('Failed to load shipping ports')
      setPorts([])
    } finally {
      setLoading(false)
    }
  }

  const loadCities = async () => {
    try {
      const cityList = await getShippingPortCities()
      setCities(cityList)
    } catch (err) {
      console.error('Error loading cities:', err)
    }
  }

  const filterPorts = async () => {
    try {
      let filtered = ports

      if (searchQuery.trim()) {
        filtered = await searchShippingPorts(searchQuery)
      }

      if (selectedCity) {
        filtered = filtered.filter(port => port.city === selectedCity)
      }

      setPorts(filtered)
    } catch (err) {
      console.error('Error filtering ports:', err)
    }
  }

  if (loading) {
    return (
      <div className="shipping-ports-container">
        <div className="loading-state">Loading shipping ports...</div>
      </div>
    )
  }

  return (
    <div className="shipping-ports-container">
      {/* Header */}
      <div className="ports-header">
        <h3>Shipping Ports Map View</h3>
        <p className="ports-subtitle">View and explore all public shipping ports</p>
      </div>

      {/* Search & Filter Section */}
      <div className="ports-controls">
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

        <button
          onClick={() => {
            setSearchQuery('')
            setSelectedCity('')
            loadPorts()
          }}
          className="btn-reset"
        >
          Reset
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')} className="error-close">×</button>
        </div>
      )}

      {/* Ports List */}
      <div className="ports-list">
        {ports.length === 0 ? (
          <div className="empty-state">
            <p>No ports found. Try adjusting your search filters.</p>
          </div>
        ) : (
          ports.map(port => (
            <div
              key={port.id}
              className={`port-card ${selectedPort?.id === port.id ? 'selected' : ''}`}
              onClick={() => setSelectedPort(selectedPort?.id === port.id ? null : port)}
            >
              <div className="port-card-header">
                <h4>{port.name}</h4>
                <span className={`status-badge ${port.status}`}>
                  {port.status.toUpperCase()}
                </span>
              </div>

              <div className="port-card-body">
                {port.description && (
                  <p className="port-description">{port.description}</p>
                )}

                <div className="port-info-grid">
                  <div className="port-info-item">
                    <span className="label">Type:</span>
                    <span className="value">{port.port_type || 'N/A'}</span>
                  </div>
                  <div className="port-info-item">
                    <span className="label">City:</span>
                    <span className="value">{port.city}</span>
                  </div>
                  {port.region && (
                    <div className="port-info-item">
                      <span className="label">Region:</span>
                      <span className="value">{port.region}</span>
                    </div>
                  )}
                </div>

                {selectedPort?.id === port.id && (
                  <div className="port-card-details">
                    {port.berth_count && (
                      <div className="detail-row">
                        <span className="label">Berths:</span>
                        <span className="value">{port.berth_count}</span>
                      </div>
                    )}
                    {port.max_depth_meters && (
                      <div className="detail-row">
                        <span className="label">Max Depth:</span>
                        <span className="value">{port.max_depth_meters}m</span>
                      </div>
                    )}
                    {port.max_vessel_length_meters && (
                      <div className="detail-row">
                        <span className="label">Max Vessel Length:</span>
                        <span className="value">{port.max_vessel_length_meters}m</span>
                      </div>
                    )}
                    {port.annual_capacity_teu && (
                      <div className="detail-row">
                        <span className="label">Annual Capacity:</span>
                        <span className="value">{port.annual_capacity_teu.toLocaleString()} TEU</span>
                      </div>
                    )}

                    {/* Services */}
                    {(port.container_terminal || port.ro_ro_services || port.breakbulk_services || port.bulk_cargo) && (
                      <div className="services-section">
                        <span className="section-label">Available Services:</span>
                        <ul className="services-list">
                          {port.container_terminal && <li>✓ Container Terminal</li>}
                          {port.ro_ro_services && <li>✓ RoRo Services</li>}
                          {port.breakbulk_services && <li>✓ Breakbulk Services</li>}
                          {port.bulk_cargo && <li>✓ Bulk Cargo</li>}
                          {port.refrigerated_containers && <li>✓ Refrigerated Containers</li>}
                          {port.dangerous_cargo && <li>✓ Dangerous Cargo Handling</li>}
                        </ul>
                      </div>
                    )}

                    {/* Contact Info */}
                    {(port.contact_phone || port.contact_email || port.website) && (
                      <div className="contact-section">
                        <span className="section-label">Contact:</span>
                        {port.contact_phone && (
                          <p><a href={`tel:${port.contact_phone}`}>{port.contact_phone}</a></p>
                        )}
                        {port.contact_email && (
                          <p><a href={`mailto:${port.contact_email}`}>{port.contact_email}</a></p>
                        )}
                        {port.website && (
                          <p><a href={port.website} target="_blank" rel="noopener noreferrer">Visit Website</a></p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Port Count */}
      <div className="ports-footer">
        <p>{ports.length} shipping port{ports.length !== 1 ? 's' : ''} found</p>
      </div>
    </div>
  )
}
