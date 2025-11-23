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
  compact = false,
  headerLayout = false
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

  const handleZoomIn = (e) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    if (mapInstance && mapInstance.zoomIn) {
      try {
        mapInstance.zoomIn()
      } catch (error) {
        console.error('Error zooming in:', error)
      }
    }
  }

  const handleZoomOut = (e) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    if (mapInstance && mapInstance.zoomOut) {
      try {
        mapInstance.zoomOut()
      } catch (error) {
        console.error('Error zooming out:', error)
      }
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

  // Header layout version - wider controls aligned in header
  if (headerLayout) {
    return (
      <div
        className="map-controls-header"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
        }}
        onMouseDown={(e) => {
          e.stopPropagation()
          e.preventDefault()
        }}
      >
        <button
          onClick={(e) => handleCenterPhilippines(e)}
          className="btn-map-control-header"
          title="Center map on Philippines"
        >
          Show Map Controls
        </button>
        <div className="map-zoom-controls">
          <button
            onClick={(e) => handleZoomOut(e)}
            className="btn-zoom-control"
            title="Zoom out"
          >
            −
          </button>
          <button
            onClick={(e) => handleZoomIn(e)}
            className="btn-zoom-control"
            title="Zoom in"
          >
            +
          </button>
        </div>
        <div className="map-layer-controls">
          <button
            onClick={(e) => handleLayerChange('street', e)}
            className={`layer-control-btn ${currentMapLayer === 'street' ? 'active' : ''}`}
            title="Street view"
          >
            Street
          </button>
          <button
            onClick={(e) => handleLayerChange('satellite', e)}
            className={`layer-control-btn ${currentMapLayer === 'satellite' ? 'active' : ''}`}
            title="Satellite view"
          >
            Satellite
          </button>
          <button
            onClick={(e) => handleLayerChange('terrain', e)}
            className={`layer-control-btn ${currentMapLayer === 'terrain' ? 'active' : ''}`}
            title="Terrain view"
          >
            Terrain
          </button>
        </div>
      </div>
    )
  }

  // Compact inline version for search bar - only Philippines button
  if (compact) {
    return (
      <div
        className="map-controls-compact"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
        }}
        onMouseDown={(e) => {
          e.stopPropagation()
          e.preventDefault()
        }}
      >
        <div className="map-zoom-controls-compact">
          <button
            onClick={(e) => handleZoomOut(e)}
            className="btn-zoom-control-compact"
            title="Zoom out"
          >
            −
          </button>
          <button
            onClick={(e) => handleZoomIn(e)}
            className="btn-zoom-control-compact"
            title="Zoom in"
          >
            +
          </button>
        </div>
        <button
          onClick={(e) => handleCenterPhilippines(e)}
          className="btn-map-control-primary"
          title="Center map on Philippines"
        >
          Philippines
        </button>
      </div>
    )
  }

  // Full featured version for sidebar
  return (
    <div
      className="map-controls-full"
      onClick={(e) => {
        e.stopPropagation()
      }}
      onMouseDown={(e) => {
        e.stopPropagation()
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          setIsExpanded(!isExpanded)
        }}
        className="btn-controls-toggle"
        title={isExpanded ? 'Hide map controls' : 'Show map controls'}
      >
        ⊞ {isExpanded ? 'Hide Map Controls' : 'Show Map Controls'}
      </button>

      {isExpanded && (
        <div className="map-controls-panel">
          <div className="controls-panel-header">
            <h4>Map Controls</h4>
            <button
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                setIsExpanded(false)
              }}
              className="controls-panel-close"
            >
              ✕
            </button>
          </div>

          <div className="controls-panel-content">
            {/* Philippines Button */}
            <div className="control-section">
              <button
                onClick={(e) => handleCenterPhilippines(e)}
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
                  onClick={(e) => handleLayerChange('street', e)}
                  className={`layer-control-btn ${currentMapLayer === 'street' ? 'active' : ''}`}
                  title="Street view"
                >
                  Street
                </button>
                <button
                  onClick={(e) => handleLayerChange('satellite', e)}
                  className={`layer-control-btn ${currentMapLayer === 'satellite' ? 'active' : ''}`}
                  title="Satellite view"
                >
                  Satellite
                </button>
                <button
                  onClick={(e) => handleLayerChange('terrain', e)}
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
                onClick={(e) => handleGetLocation(e)}
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
