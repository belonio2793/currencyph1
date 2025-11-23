import { useState, useRef } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './RouteCalculatorTab.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

export default function RouteCalculatorTab({ userId }) {
  const mapRef = useRef(null)
  const [formData, setFormData] = useState({
    packageWeight: '',
    packageLength: '',
    packageWidth: '',
    packageHeight: '',
    packageType: 'general',
    originCity: '',
    destinationCity: '',
    urgencyLevel: 'standard'
  })

  const [routes, setRoutes] = useState([])
  const [showResults, setShowResults] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mapCenter, setMapCenter] = useState([12.8797, 121.7740])
  const [zoomLevel, setZoomLevel] = useState(6)
  const [mapLayer, setMapLayer] = useState('street')
  const [mapInstance, setMapInstance] = useState(null)
  const [showLegend, setShowLegend] = useState(false)

  const packageTypes = [
    { value: 'general', label: 'General Cargo' },
    { value: 'fragile', label: 'Fragile Items' },
    { value: 'perishable', label: 'Perishable Goods' },
    { value: 'hazardous', label: 'Hazardous Materials' },
    { value: 'document', label: 'Documents' },
    { value: 'electronics', label: 'Electronics' }
  ]

  const urgencyLevels = [
    { value: 'standard', label: 'Standard (5-7 days)' },
    { value: 'express', label: 'Express (2-3 days)' },
    { value: 'overnight', label: 'Overnight' }
  ]

  const mockShippingPartners = [
    {
      id: 1,
      name: 'JNT Express',
      method: 'Ground',
      estimatedDays: 5,
      cost: 150,
      coverage: ['Metro Manila', 'Cavite', 'Laguna', 'Bulacan', 'Rizal'],
      reliability: 4.5
    },
    {
      id: 2,
      name: 'LBC Express',
      method: 'Mixed (Ground + Air)',
      estimatedDays: 3,
      cost: 250,
      coverage: ['All Metro Areas', 'Major Cities'],
      reliability: 4.7
    },
    {
      id: 3,
      name: 'Lazada Logistics',
      method: 'Integrated Network',
      estimatedDays: 2,
      cost: 350,
      coverage: 'All Cities',
      reliability: 4.8
    },
    {
      id: 4,
      name: 'Shopee Express',
      method: 'Regional Network',
      estimatedDays: 4,
      cost: 200,
      coverage: 'Major Urban Areas',
      reliability: 4.6
    }
  ]

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const calculateRoutes = async (e) => {
    e.preventDefault()

    if (!formData.packageWeight || !formData.originCity || !formData.destinationCity) {
      alert('Please fill in package weight, origin, and destination cities')
      return
    }

    setLoading(true)

    // Simulate calculation delay
    setTimeout(() => {
      const totalVolume = (formData.packageLength || 0) * (formData.packageWidth || 0) * (formData.packageHeight || 0)
      const weight = parseFloat(formData.packageWeight)

      // Filter partners based on package requirements
      let viablePartners = mockShippingPartners.filter(partner => {
        const canHandle = (formData.packageType !== 'hazardous') || partner.name.includes('Express')
        return canHandle
      })

      // Sort by urgency level
      if (formData.urgencyLevel === 'overnight') {
        viablePartners = viablePartners.filter(p => p.estimatedDays <= 1)
      } else if (formData.urgencyLevel === 'express') {
        viablePartners = viablePartners.filter(p => p.estimatedDays <= 3)
      }

      // Calculate costs based on weight
      const enrichedRoutes = viablePartners.map(partner => ({
        ...partner,
        finalCost: Math.ceil(partner.cost + (weight > 10 ? (weight - 10) * 25 : 0)),
        volumeStatus: totalVolume > 1000000 ? 'Large volume - may require special handling' : 'Standard',
        recommendedFor: getRecommendation(partner, weight, formData.packageType)
      }))

      // Sort by cost
      enrichedRoutes.sort((a, b) => a.finalCost - b.finalCost)

      setRoutes(enrichedRoutes)
      setShowResults(true)
      setLoading(false)
    }, 1000)
  }

  const getRecommendation = (partner, weight, type) => {
    if (type === 'document') return 'Best for documents'
    if (type === 'fragile' && partner.name.includes('Lazada')) return 'Excellent handling for fragile items'
    if (type === 'perishable') return 'Fast delivery keeps items fresh'
    if (weight > 20 && partner.name.includes('LBC')) return 'Good for heavy packages'
    return 'Standard route'
  }

  const calculateVolume = () => {
    const length = parseFloat(formData.packageLength) || 0
    const width = parseFloat(formData.packageWidth) || 0
    const height = parseFloat(formData.packageHeight) || 0
    return (length * width * height).toFixed(2)
  }

  return (
    <div className="route-calculator-tab">
      {/* Page Title */}
      <div className="page-title">
        <h2>Route Calculator</h2>
      </div>

      <div className="route-calculator-container">
        {/* Header */}
        <div className="route-calculator-header">
          <h3>Package Details & Route Calculation</h3>
        </div>

        {/* Route Map */}
        <div className="route-map-section">
          <div className="map-header">
            <div className="map-header-content">
              <h4>Route Map</h4>
              <p className="map-subtitle">Visualize shipping routes across the Philippines</p>
            </div>
          </div>
          <div className="map-container route-map">
            <button
              onClick={() => setShowLegend(!showLegend)}
              className="btn-legend-toggle-overlay"
              title={showLegend ? 'Hide map controls' : 'Show map controls'}
            >
              {showLegend ? 'Hide Map Controls' : 'Show Map Controls'}
            </button>
            <MapContainer
              ref={mapRef}
              center={mapCenter}
              zoom={zoomLevel}
              className="leaflet-container-route"
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

        {/* Calculator Form */}
        <div className="calculator-form-section">

          <form onSubmit={calculateRoutes} className="calculator-form">
            {/* Package Type */}
            <div className="form-group-section">
              <h4 className="group-title">Package Type</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Package Type *</label>
                  <select
                    name="packageType"
                    value={formData.packageType}
                    onChange={handleInputChange}
                    required
                  >
                    {packageTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Package Dimensions */}
            <div className="form-group-section">
              <h4 className="group-title">Package Dimensions & Weight</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Weight (kg) *</label>
                  <input
                    type="number"
                    name="packageWeight"
                    value={formData.packageWeight}
                    onChange={handleInputChange}
                    placeholder="e.g., 5"
                    step="0.1"
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Length (cm)</label>
                  <input
                    type="number"
                    name="packageLength"
                    value={formData.packageLength}
                    onChange={handleInputChange}
                    placeholder="e.g., 30"
                    step="0.1"
                  />
                </div>
                <div className="form-group">
                  <label>Width (cm)</label>
                  <input
                    type="number"
                    name="packageWidth"
                    value={formData.packageWidth}
                    onChange={handleInputChange}
                    placeholder="e.g., 20"
                    step="0.1"
                  />
                </div>
                <div className="form-group">
                  <label>Height (cm)</label>
                  <input
                    type="number"
                    name="packageHeight"
                    value={formData.packageHeight}
                    onChange={handleInputChange}
                    placeholder="e.g., 15"
                    step="0.1"
                  />
                </div>
              </div>

              {formData.packageLength && formData.packageWidth && formData.packageHeight && (
                <div className="volume-info">
                  <span className="volume-label">Calculated Volume:</span>
                  <span className="volume-value">{calculateVolume()} cm³</span>
                </div>
              )}
            </div>

            {/* Locations */}
            <div className="form-group-section">
              <h4 className="group-title">Origin & Destination</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Origin City *</label>
                  <input
                    type="text"
                    name="originCity"
                    value={formData.originCity}
                    onChange={handleInputChange}
                    placeholder="e.g., Manila"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Destination City *</label>
                  <input
                    type="text"
                    name="destinationCity"
                    value={formData.destinationCity}
                    onChange={handleInputChange}
                    placeholder="e.g., Cebu"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Urgency Level */}
            <div className="form-group-section">
              <h4 className="group-title">Delivery Urgency</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Delivery Speed *</label>
                  <select
                    name="urgencyLevel"
                    value={formData.urgencyLevel}
                    onChange={handleInputChange}
                    required
                  >
                    {urgencyLevels.map(level => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button type="submit" className="btn-calculate" disabled={loading}>
              {loading ? 'Calculating Routes...' : 'Calculate Viable Routes'}
            </button>
          </form>
        </div>

        {/* Results Section */}
        {showResults && (
          <div className="calculator-results-section">
            <div className="calculator-results-header">
              <h3>Available Routes & Partners</h3>
            </div>

            {routes.length === 0 ? (
              <div className="no-results">
                <p>No viable routes found for the selected parameters.</p>
                <p className="hint">Try adjusting package type or delivery urgency.</p>
              </div>
            ) : (
              <div className="routes-grid">
                {routes.map((route, index) => (
                  <div key={route.id} className="route-card">
                    <div className="route-card-header">
                      <div>
                        <h4 className="route-partner-name">
                          {index === 0 && <span className="badge-recommended">RECOMMENDED</span>}
                          {route.name}
                        </h4>
                        <p className="route-method">{route.method}</p>
                      </div>
                      <div className="route-rating">
                        <span className="stars">{route.reliability}</span>
                      </div>
                    </div>

                    <div className="route-details">
                      <div className="detail-row">
                        <span className="detail-label">Estimated Delivery:</span>
                        <span className="detail-value">{route.estimatedDays} days</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Base Cost:</span>
                        <span className="detail-value">₱{route.cost}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Final Cost:</span>
                        <span className="detail-value final-cost">₱{route.finalCost}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Coverage:</span>
                        <span className="detail-value">
                          {Array.isArray(route.coverage) ? route.coverage.join(', ') : route.coverage}
                        </span>
                      </div>
                    </div>

                    <div className="route-notes">
                      <div className="note-item">
                        <span className="note-label">Package Status:</span>
                        <span className="note-value">{route.volumeStatus}</span>
                      </div>
                      <div className="note-item">
                        <span className="note-label">Recommendation:</span>
                        <span className="note-value">{route.recommendedFor}</span>
                      </div>
                    </div>

                    <button className="btn-select-route">
                      Select This Route
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
