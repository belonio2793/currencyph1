import { useState } from 'react'
import './MapControls.css'

const PHILIPPINES_PRESET = {
  name: 'Philippines',
  center: [12.8797, 121.7740],
  zoom: 6
}

export default function MapControls({ 
  mapInstance, 
  onMapLayerChange, 
  onCenterLocation,
  currentMapLayer = 'street',
  compact = false
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleCenterPhilippines = (e) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    if (mapInstance && mapInstance.flyTo) {
      try {
        mapInstance.flyTo(PHILIPPINES_PRESET.center, PHILIPPINES_PRESET.zoom, { duration: 1 })
      } catch (error) {
        console.error('Error flying to Philippines:', error)
      }
    }
    if (onCenterLocation) {
      onCenterLocation(PHILIPPINES_PRESET)
    }
  }

  const handleGetLocation = (e) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          if (mapInstance) {
            mapInstance.flyTo([latitude, longitude], 13, { duration: 1 })
          }
        },
        (error) => {
          console.error('Geolocation error:', error)
        }
      )
    }
  }

  const handleLayerChange = (layer, e) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    if (onMapLayerChange) {
      onMapLayerChange(layer)
    }
  }

  // Compact inline version for search bar
  if (compact) {
    return (
      <div className="map-controls-compact">
        <button
          onClick={handleCenterPhilippines}
          className="btn-map-control-primary"
          title="Center map on Philippines"
        >
          Philippines
        </button>

        <details className="map-controls-dropdown">
          <summary className="controls-dropdown-summary">Map Layers</summary>
          <div className="controls-dropdown-content">
            <button
              onClick={() => handleLayerChange('street')}
              className={`layer-control-btn ${currentMapLayer === 'street' ? 'active' : ''}`}
              title="Street view"
            >
              Street
            </button>
            <button
              onClick={() => handleLayerChange('satellite')}
              className={`layer-control-btn ${currentMapLayer === 'satellite' ? 'active' : ''}`}
              title="Satellite view"
            >
              Satellite
            </button>
            <button
              onClick={() => handleLayerChange('terrain')}
              className={`layer-control-btn ${currentMapLayer === 'terrain' ? 'active' : ''}`}
              title="Terrain view"
            >
              Terrain
            </button>
            <button
              onClick={handleGetLocation}
              className="location-control-btn"
              title="Get your current location"
            >
              My Location
            </button>
          </div>
        </details>
      </div>
    )
  }

  // Full featured version for sidebar
  return (
    <div className="map-controls-full">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="btn-controls-toggle"
        title={isExpanded ? 'Hide controls' : 'Show controls'}
      >
        ⊞ {isExpanded ? 'Hide' : 'Show'}
      </button>

      {isExpanded && (
        <div className="map-controls-panel">
          <div className="controls-panel-header">
            <h4>Map Controls</h4>
            <button
              onClick={() => setIsExpanded(false)}
              className="controls-panel-close"
            >
              ✕
            </button>
          </div>

          <div className="controls-panel-content">
            {/* Philippines Button */}
            <div className="control-section">
              <button
                onClick={handleCenterPhilippines}
                className="btn-map-control-primary"
                title="Center map on Philippines"
              >
                Philippines
              </button>
            </div>

            {/* Layer Selection */}
            <div className="control-section">
              <label className="control-label">Map Layer</label>
              <div className="layer-buttons-group">
                <button
                  onClick={() => handleLayerChange('street')}
                  className={`layer-control-btn ${currentMapLayer === 'street' ? 'active' : ''}`}
                  title="Street view"
                >
                  Street
                </button>
                <button
                  onClick={() => handleLayerChange('satellite')}
                  className={`layer-control-btn ${currentMapLayer === 'satellite' ? 'active' : ''}`}
                  title="Satellite view"
                >
                  Satellite
                </button>
                <button
                  onClick={() => handleLayerChange('terrain')}
                  className={`layer-control-btn ${currentMapLayer === 'terrain' ? 'active' : ''}`}
                  title="Terrain view"
                >
                  Terrain
                </button>
              </div>
            </div>

            {/* Geolocation */}
            <div className="control-section">
              <button
                onClick={handleGetLocation}
                className="location-control-btn"
                title="Get your current location"
              >
                My Location
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
