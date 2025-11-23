import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { MapContainer, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './PartnersHandlersTab.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

export default function PartnersHandlersTab({ userId }) {
  const mapRef = useRef(null)
  const [partners, setPartners] = useState([])
  const [selectedPartner, setSelectedPartner] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mapCenter, setMapCenter] = useState([12.8797, 121.7740])
  const [zoomLevel, setZoomLevel] = useState(6)
  const [mapHeight, setMapHeight] = useState(400)
  const [mapLayer, setMapLayer] = useState('street')
  const [mapInstance, setMapInstance] = useState(null)
  const [showLegend, setShowLegend] = useState(false)

  // Mock partners data
  const mockPartners = [
    {
      id: 1,
      name: 'JNT Express',
      type: 'courier',
      method: 'Ground Delivery',
      coverage: ['Metro Manila', 'Cavite', 'Laguna', 'Bulacan'],
      contact: '+63 2 8876-7777',
      email: 'support@jnt.ph',
      website: 'https://jnt.ph',
      rating: 4.5,
      deliveryTime: '5-7 days',
      tracking: true,
      insurance: true,
      specialServices: ['Same-day delivery', 'Cash on delivery'],
      description: 'Leading ground delivery service across Metro Manila and surrounding provinces.'
    },
    {
      id: 2,
      name: 'LBC Express',
      type: 'courier',
      method: 'Multi-Modal',
      coverage: ['Nationwide', 'International'],
      contact: '+63 2 8888-5555',
      email: 'info@lbcexpress.com',
      website: 'https://lbcexpress.com',
      rating: 4.7,
      deliveryTime: '2-4 days',
      tracking: true,
      insurance: true,
      specialServices: ['Express delivery', 'LBC Bay Station pickup', 'International shipping'],
      description: 'Trusted nationwide courier with extensive coverage and reliable service.'
    },
    {
      id: 3,
      name: 'Lazada Logistics',
      type: 'platform',
      method: 'Integrated Network',
      coverage: 'All Philippines',
      contact: '+63 2 8887-8000',
      email: 'logistics@lazada.com.ph',
      website: 'https://lazada.com.ph',
      rating: 4.8,
      deliveryTime: '1-3 days',
      tracking: true,
      insurance: false,
      specialServices: ['Real-time tracking', 'Flexible delivery options', 'Same-day delivery'],
      description: 'Advanced logistics platform integrated with nationwide delivery partners.'
    },
    {
      id: 4,
      name: 'Shopee Express',
      type: 'platform',
      method: 'Regional Network',
      coverage: 'Major Cities',
      contact: '+63 2 7932-9888',
      email: 'seller@shopee.ph',
      website: 'https://shopee.ph',
      rating: 4.6,
      deliveryTime: '2-5 days',
      tracking: true,
      insurance: false,
      specialServices: ['Scheduled delivery', 'Pickup points', 'Live chat support'],
      description: 'Major e-commerce platform with integrated courier services.'
    },
    {
      id: 5,
      name: 'Grab Delivery',
      type: 'service',
      method: 'On-Demand',
      coverage: 'Metro Manila',
      contact: '+63 2 7632-6000',
      email: 'business@grab.com',
      website: 'https://grab.com/ph',
      rating: 4.4,
      deliveryTime: '30-60 minutes',
      tracking: true,
      insurance: true,
      specialServices: ['Same-day delivery', 'Real-time tracking', 'Contactless delivery'],
      description: 'Fast on-demand delivery service for urgent shipments in metro areas.'
    },
    {
      id: 6,
      name: 'AirSwift',
      type: 'courier',
      method: 'Air + Ground',
      coverage: ['Nationwide', 'International'],
      contact: '+63 2 7911-4999',
      email: 'corporate@airswift.ph',
      website: 'https://airswift.com.ph',
      rating: 4.6,
      deliveryTime: 'Next day (Metro)',
      tracking: true,
      insurance: true,
      specialServices: ['Priority handling', 'International shipping', 'Temperature controlled'],
      description: 'Premium courier offering fast and reliable delivery with air transport.'
    },
    {
      id: 7,
      name: 'DHL Philippines',
      type: 'international',
      method: 'Global Network',
      coverage: 'Worldwide',
      contact: '+63 2 5238-6000',
      email: 'ph.inquiries@dhl.com',
      website: 'https://dhl.com.ph',
      rating: 4.7,
      deliveryTime: '3-7 days (International)',
      tracking: true,
      insurance: true,
      specialServices: ['International shipping', 'Customs clearance', 'Document handling'],
      description: 'Global logistics leader providing worldwide shipping solutions.'
    },
    {
      id: 8,
      name: 'FedEx Philippines',
      type: 'international',
      method: 'Express Network',
      coverage: 'Worldwide',
      contact: '+63 2 8807-8000',
      email: 'contact.ph@fedex.com',
      website: 'https://fedex.com/ph',
      rating: 4.8,
      deliveryTime: '1-5 days (International)',
      tracking: true,
      insurance: true,
      specialServices: ['Express international', 'Heavy shipments', 'Time-definite delivery'],
      description: 'Leading international express delivery service with real-time tracking.'
    }
  ]

  useEffect(() => {
    setPartners(mockPartners)
    setLoading(false)
  }, [])

  const filteredPartners = partners.filter(partner => {
    const matchesQuery = partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      partner.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      partner.specialServices?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesType = filterType === 'all' || partner.type === filterType

    return matchesQuery && matchesType
  })

  const getTypeColor = (type) => {
    const colorMap = {
      'courier': '#3b82f6',
      'platform': '#10b981',
      'service': '#f59e0b',
      'international': '#8b5cf6'
    }
    return colorMap[type] || '#6b7280'
  }

  const getTypeLabel = (type) => {
    const labelMap = {
      'courier': 'Courier',
      'platform': 'E-Commerce Platform',
      'service': 'On-Demand Service',
      'international': 'International'
    }
    return labelMap[type] || type
  }

  return (
    <div className="partners-handlers-tab">
      {/* Page Title */}
      <div className="page-title">
        <h2>Shipping Handlers</h2>
      </div>

      <div className="partners-container">
        {/* Header */}
        <div className="partners-header">
          <div className="header-content">
            <h3>Partner Details</h3>
          </div>
        </div>

        {/* Partners Map */}
        <div className="partners-map-section" style={{ height: `${mapHeight}px` }}>
          <div className="map-header">
            <div className="map-header-content">
              <h4>Coverage Map</h4>
              <p className="map-subtitle">View partner coverage areas across the Philippines</p>
            </div>
          </div>
          <div className="map-container partners-map">
            <div className="map-overlay-controls">
              <div className="map-resize-controls">
                <button
                  onClick={() => setMapHeight(prev => Math.max(prev - 50, 200))}
                  className="btn-map-resize-overlay"
                  title="Decrease map size"
                >
                  −
                </button>
                <button
                  onClick={() => setMapHeight(prev => Math.min(prev + 50, 600))}
                  className="btn-map-resize-overlay"
                  title="Increase map size"
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
              className="leaflet-container-partners"
              style={{ height: '100%', width: '100%' }}
              attributionControl={false}
              whenCreated={setMapInstance}
            >
              <TileLayer
                url={
                  mapLayer === 'satellite'
                    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    : mapLayer === 'terrain'
                    ? 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
                    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                }
                attribution=""
              />
            </MapContainer>
          </div>
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

              {/* Geolocation */}
              <div className="legend-section">
                <button
                  onClick={() => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (position) => {
                          const { latitude, longitude } = position.coords
                          setMapCenter([latitude, longitude])
                          setZoomLevel(13)
                          if (mapRef.current) {
                            mapRef.current.flyTo([latitude, longitude], 13, { duration: 1 })
                          }
                        },
                        (error) => {
                          console.error('Geolocation error:', error)
                        }
                      )
                    }
                  }}
                  className="btn-geolocation"
                  title="Get your current location"
                >
                  My Location
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filter */}
        <div className="partners-controls">
          <input
            type="text"
            placeholder="Search partners, services, or features..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="partners-search"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="partners-filter"
          >
            <option value="all">All Types</option>
            <option value="courier">Couriers</option>
            <option value="platform">Platforms</option>
            <option value="service">Services</option>
            <option value="international">International</option>
          </select>
        </div>

        {error && (
          <div className="partners-error">
            {error}
            <button onClick={() => setError('')} className="error-close">×</button>
          </div>
        )}

        {/* Partners Grid */}
        <div className="partners-grid">
          {loading ? (
            <div className="loading-state">Loading partners...</div>
          ) : filteredPartners.length === 0 ? (
            <div className="empty-state">
              <p className="empty-title">No partners found</p>
              <p className="empty-subtitle">Try adjusting your search or filters</p>
            </div>
          ) : (
            filteredPartners.map(partner => (
              <div
                key={partner.id}
                className="partner-card"
                onClick={() => setSelectedPartner(partner)}
              >
                <div className="partner-card-header">
                  <div className="partner-info">
                    <h4 className="partner-name">{partner.name}</h4>
                    <span
                      className="partner-type-badge"
                      style={{ backgroundColor: getTypeColor(partner.type) }}
                    >
                      {getTypeLabel(partner.type)}
                    </span>
                  </div>
                  <div className="partner-rating">
                    <span className="rating-value">{partner.rating}</span>
                  </div>
                </div>

                <p className="partner-description">{partner.description}</p>

                <div className="partner-quick-info">
                  <div className="info-item">
                    <span className="info-label">Delivery:</span>
                    <span className="info-value">{partner.deliveryTime}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Method:</span>
                    <span className="info-value">{partner.method}</span>
                  </div>
                </div>

                <div className="partner-features">
                  {partner.tracking && <span className="feature-badge">Tracking</span>}
                  {partner.insurance && <span className="feature-badge">Insurance</span>}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Partner Detail Panel */}
        {selectedPartner && (
          <div className="partner-detail-overlay" onClick={() => setSelectedPartner(null)}>
            <div className="partner-detail-panel" onClick={e => e.stopPropagation()}>
              <div className="detail-panel-header">
                <div className="detail-panel-title">
                  <h3>{selectedPartner.name}</h3>
                  <span
                    className="partner-type-badge"
                    style={{ backgroundColor: getTypeColor(selectedPartner.type) }}
                  >
                    {getTypeLabel(selectedPartner.type)}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedPartner(null)}
                  className="detail-panel-close"
                >
                  ×
                </button>
              </div>

              <div className="detail-panel-content">
                <div className="detail-section">
                  <h4 className="section-title">Overview</h4>
                  <p className="detail-description">{selectedPartner.description}</p>
                  <div className="rating-section">
                    <span className="rating-label">Overall Rating:</span>
                    <span className="rating-display">{selectedPartner.rating}</span>
                  </div>
                </div>

                <div className="detail-section">
                  <h4 className="section-title">Service Information</h4>
                  <div className="detail-item">
                    <span className="detail-label">Delivery Method:</span>
                    <span className="detail-value">{selectedPartner.method}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Estimated Delivery:</span>
                    <span className="detail-value">{selectedPartner.deliveryTime}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Coverage Area:</span>
                    <span className="detail-value">
                      {Array.isArray(selectedPartner.coverage)
                        ? selectedPartner.coverage.join(', ')
                        : selectedPartner.coverage}
                    </span>
                  </div>
                </div>

                <div className="detail-section">
                  <h4 className="section-title">Features & Services</h4>
                  <div className="features-list">
                    <div className="feature-row">
                      <span className="feature-name">Real-time Tracking:</span>
                      <span className={`feature-status ${selectedPartner.tracking ? 'available' : 'unavailable'}`}>
                        {selectedPartner.tracking ? '✓ Available' : '✗ Not Available'}
                      </span>
                    </div>
                    <div className="feature-row">
                      <span className="feature-name">Insurance Coverage:</span>
                      <span className={`feature-status ${selectedPartner.insurance ? 'available' : 'unavailable'}`}>
                        {selectedPartner.insurance ? '✓ Available' : '✗ Not Available'}
                      </span>
                    </div>
                  </div>

                  {selectedPartner.specialServices && selectedPartner.specialServices.length > 0 && (
                    <div className="special-services">
                      <h5>Special Services:</h5>
                      <ul className="services-list">
                        {selectedPartner.specialServices.map((service, idx) => (
                          <li key={idx}>✓ {service}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="detail-section">
                  <h4 className="section-title">Contact Information</h4>
                  <div className="contact-info">
                    <div className="contact-item">
                      <span className="contact-label">Phone:</span>
                      <a href={`tel:${selectedPartner.contact}`} className="contact-value">
                        {selectedPartner.contact}
                      </a>
                    </div>
                    <div className="contact-item">
                      <span className="contact-label">Email:</span>
                      <a href={`mailto:${selectedPartner.email}`} className="contact-value">
                        {selectedPartner.email}
                      </a>
                    </div>
                    <div className="contact-item">
                      <span className="contact-label">Website:</span>
                      <a href={selectedPartner.website} target="_blank" rel="noopener noreferrer" className="contact-value">
                        Visit Website
                      </a>
                    </div>
                  </div>
                </div>

                <div className="detail-panel-actions">
                  <button className="btn-primary">
                    Use This Partner
                  </button>
                  <button className="btn-secondary">
                    Save to Favorites
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
