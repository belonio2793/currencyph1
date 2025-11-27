import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, GeoJSON } from 'react-leaflet'
import L from 'leaflet'
import { shippingRouteService } from '../lib/shippingRouteService'
import { logErrorSafely } from '../lib/safeErrorHandler'
import './ShippingRouteStyles.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

export default function ShippingRouteManager({ userId, onRouteCreated }) {
  const mapRef = useRef(null)
  const [routes, setRoutes] = useState([])
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingRoute, setEditingRoute] = useState(null)
  const [mapCenter, setMapCenter] = useState([12.8797, 121.7740])
  const [zoomLevel, setZoomLevel] = useState(6)

  const [formData, setFormData] = useState({
    route_name: '',
    route_description: '',
    route_type: 'standard',
    origin_address: '',
    destination_address: '',
    distance_km: '',
    cost_per_kg: '',
    base_cost: '',
    max_weight_kg: '',
    vehicle_type: '',
    estimated_duration_hours: '',
    priority_level: 'normal',
    notes: ''
  })

  const [waypoints, setWaypoints] = useState([])
  const [newWaypoint, setNewWaypoint] = useState({
    location_name: '',
    latitude: '',
    longitude: '',
    location_address: '',
    stop_duration_minutes: 0
  })

  useEffect(() => {
    loadRoutes()
  }, [userId])

  const loadRoutes = async () => {
    if (!userId) return
    try {
      setLoading(true)
      setError('')
      const data = await shippingRouteService.fetchAllRoutes(userId)
      setRoutes(data)
    } catch (err) {
      logErrorSafely('ShippingRouteManager.loadRoutes', err)
      setError('Failed to load routes')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value === '' ? '' : isNaN(value) ? value : parseFloat(value) || value
    }))
  }

  const handleWaypointChange = (e) => {
    const { name, value } = e.target
    setNewWaypoint(prev => ({
      ...prev,
      [name]: name.includes('latitude') || name.includes('longitude') || name.includes('duration') 
        ? parseFloat(value) || 0 
        : value
    }))
  }

  const addWaypoint = () => {
    if (!newWaypoint.location_name || !newWaypoint.latitude || !newWaypoint.longitude) {
      setError('Please fill in waypoint details')
      return
    }

    setWaypoints([
      ...waypoints,
      {
        ...newWaypoint,
        waypoint_number: waypoints.length + 1
      }
    ])
    setNewWaypoint({
      location_name: '',
      latitude: '',
      longitude: '',
      location_address: '',
      stop_duration_minutes: 0
    })
  }

  const removeWaypoint = (index) => {
    setWaypoints(waypoints.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.route_name || !formData.origin_address || !formData.destination_address) {
      setError('Please fill in route name, origin, and destination addresses')
      return
    }

    try {
      setLoading(true)
      
      let route
      if (editingRoute) {
        route = await shippingRouteService.updateRoute(editingRoute.id, {
          ...formData,
          updated_at: new Date().toISOString()
        })
      } else {
        route = await shippingRouteService.createRoute(userId, formData)
      }

      for (const waypoint of waypoints) {
        if (!waypoint.id) {
          await shippingRouteService.addWaypoint(route.id, waypoint)
        }
      }

      setFormData({
        route_name: '',
        route_description: '',
        route_type: 'standard',
        origin_address: '',
        destination_address: '',
        distance_km: '',
        cost_per_kg: '',
        base_cost: '',
        max_weight_kg: '',
        vehicle_type: '',
        estimated_duration_hours: '',
        priority_level: 'normal',
        notes: ''
      })
      setWaypoints([])
      setShowForm(false)
      setEditingRoute(null)
      await loadRoutes()
      onRouteCreated?.(route)
    } catch (err) {
      logErrorSafely('ShippingRouteManager.handleSubmit', err)
      setError('Failed to save route')
    } finally {
      setLoading(false)
    }
  }

  const handleEditRoute = (route) => {
    setEditingRoute(route)
    setFormData({
      route_name: route.route_name,
      route_description: route.route_description || '',
      route_type: route.route_type || 'standard',
      origin_address: route.origin_address_id || '',
      destination_address: route.destination_address_id || '',
      distance_km: route.distance_km || '',
      cost_per_kg: route.cost_per_kg || '',
      base_cost: route.base_cost || '',
      max_weight_kg: route.max_weight_kg || '',
      vehicle_type: route.vehicle_type || '',
      estimated_duration_hours: route.estimated_duration_hours || '',
      priority_level: route.priority_level || 'normal',
      notes: route.notes || ''
    })
    setShowForm(true)
  }

  const handleDeleteRoute = async (routeId) => {
    if (!confirm('Are you sure you want to delete this route?')) return

    try {
      setLoading(true)
      await shippingRouteService.deleteRoute(routeId)
      await loadRoutes()
    } catch (err) {
      logErrorSafely('ShippingRouteManager.handleDeleteRoute', err)
      setError('Failed to delete route')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectRoute = async (route) => {
    setSelectedRoute(route)
  }

  const getStatusColor = (status) => {
    const colors = {
      active: '#10b981',
      inactive: '#f59e0b',
      archived: '#6b7280'
    }
    return colors[status] || '#3b82f6'
  }

  const calculateRouteLine = (route) => {
    if (!route.origin_latitude || !route.destination_latitude) return null
    return [
      [route.origin_latitude, route.origin_longitude],
      [route.destination_latitude, route.destination_longitude]
    ]
  }

  return (
    <div className="shipping-routes-container">
      <div className="routes-header">
        <h3>Shipping Routes</h3>
        <button
          onClick={() => {
            setShowForm(true)
            setEditingRoute(null)
            setFormData({
              route_name: '',
              route_description: '',
              route_type: 'standard',
              origin_address: '',
              destination_address: '',
              distance_km: '',
              cost_per_kg: '',
              base_cost: '',
              max_weight_kg: '',
              vehicle_type: '',
              estimated_duration_hours: '',
              priority_level: 'normal',
              notes: ''
            })
            setWaypoints([])
          }}
          className="btn-create-route"
        >
          + Create Route
        </button>
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      {/* Routes Map View */}
      <div className="route-map-section">
        <h4 className="route-map-header">Route Visualization</h4>
        <div className="route-map-container">
          <MapContainer
            ref={mapRef}
            center={mapCenter}
            zoom={zoomLevel}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            
            {routes.map(route => {
              const line = calculateRouteLine(route)
              return (
                <div key={route.id}>
                  {route.origin_latitude && route.origin_longitude && (
                    <Marker
                      position={[route.origin_latitude, route.origin_longitude]}
                      icon={L.icon({
                        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-green.png',
                        iconSize: [25, 41]
                      })}
                    >
                      <Popup>
                        <div>
                          <strong>Origin</strong>
                          <p>{route.route_name}</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                  {route.destination_latitude && route.destination_longitude && (
                    <Marker
                      position={[route.destination_latitude, route.destination_longitude]}
                      icon={L.icon({
                        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-red.png',
                        iconSize: [25, 41]
                      })}
                    >
                      <Popup>
                        <div>
                          <strong>Destination</strong>
                          <p>{route.route_name}</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                  {line && (
                    <Polyline
                      positions={line}
                      color={getStatusColor(route.status)}
                      weight={3}
                      opacity={0.7}
                    />
                  )}
                </div>
              )
            })}
          </MapContainer>
        </div>
      </div>

      {/* Routes List */}
      <div className="routes-list">
        {loading ? (
          <div className="loading-state">Loading routes...</div>
        ) : routes.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">No routes created yet</p>
            <p className="empty-subtitle">Create your first route to start managing shipments</p>
          </div>
        ) : (
          routes.map(route => (
            <div key={route.id} className="route-card">
              <div className="route-card-header">
                <h4 className="route-name">{route.route_name}</h4>
                <span 
                  className={`route-status-badge ${route.status}`}
                >
                  {route.status || 'active'}
                </span>
              </div>

              {route.route_description && (
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '8px 0' }}>
                  {route.route_description}
                </p>
              )}

              <div className="route-info">
                {route.distance_km && (
                  <div className="route-info-item">
                    <span>Distance:</span>
                    <strong>{route.distance_km} km</strong>
                  </div>
                )}
                {route.base_cost && (
                  <div className="route-info-item">
                    <span>Base Cost:</span>
                    <strong>₱{parseFloat(route.base_cost).toFixed(2)}</strong>
                  </div>
                )}
                {route.cost_per_kg && (
                  <div className="route-info-item">
                    <span>Cost/kg:</span>
                    <strong>₱{parseFloat(route.cost_per_kg).toFixed(2)}</strong>
                  </div>
                )}
                {route.vehicle_type && (
                  <div className="route-info-item">
                    <span>Vehicle:</span>
                    <strong>{route.vehicle_type}</strong>
                  </div>
                )}
                {route.estimated_duration_hours && (
                  <div className="route-info-item">
                    <span>Est. Duration:</span>
                    <strong>{route.estimated_duration_hours} hours</strong>
                  </div>
                )}
                {route.shipments_count > 0 && (
                  <div className="route-info-item">
                    <span>Shipments:</span>
                    <strong>{route.shipments_count}</strong>
                  </div>
                )}
              </div>

              <div className="route-coordinates">
                <strong>Route Path:</strong>
                <div>From: ({route.origin_latitude}, {route.origin_longitude})</div>
                <div>To: ({route.destination_latitude}, {route.destination_longitude})</div>
              </div>

              <div className="route-actions">
                <button
                  onClick={() => handleSelectRoute(route)}
                  className="btn-route-view"
                >
                  View Details
                </button>
                <button
                  onClick={() => handleEditRoute(route)}
                  className="btn-route-edit"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteRoute(route.id)}
                  className="btn-route-delete"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Route Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => {
          setShowForm(false)
          setEditingRoute(null)
        }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingRoute ? 'Edit Route' : 'Create New Route'}</h2>
              <button
                onClick={() => {
                  setShowForm(false)
                  setEditingRoute(null)
                }}
                className="btn-modal-close"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <form onSubmit={handleSubmit} className="route-form">
                <div className="form-section">
                  <h3 className="form-section-title">Route Information</h3>
                  <div className="form-row full">
                    <div className="form-group">
                      <label>Route Name *</label>
                      <input
                        type="text"
                        name="route_name"
                        value={formData.route_name}
                        onChange={handleInputChange}
                        placeholder="e.g., Manila to Cebu Express"
                        required
                      />
                    </div>
                  </div>
                  <div className="form-row full">
                    <div className="form-group">
                      <label>Description</label>
                      <textarea
                        name="route_description"
                        value={formData.route_description}
                        onChange={handleInputChange}
                        placeholder="Route description..."
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Route Type</label>
                      <select
                        name="route_type"
                        value={formData.route_type}
                        onChange={handleInputChange}
                      >
                        <option value="standard">Standard</option>
                        <option value="express">Express</option>
                        <option value="economy">Economy</option>
                        <option value="priority">Priority</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Priority Level</label>
                      <select
                        name="priority_level"
                        value={formData.priority_level}
                        onChange={handleInputChange}
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3 className="form-section-title">Route Addresses</h3>
                  <div className="form-row full">
                    <div className="form-group">
                      <label>Origin Address *</label>
                      <input
                        type="text"
                        name="origin_address"
                        value={formData.origin_address}
                        onChange={handleInputChange}
                        placeholder="Starting point address"
                        required
                      />
                    </div>
                  </div>
                  <div className="form-row full">
                    <div className="form-group">
                      <label>Destination Address *</label>
                      <input
                        type="text"
                        name="destination_address"
                        value={formData.destination_address}
                        onChange={handleInputChange}
                        placeholder="Ending point address"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3 className="form-section-title">Route Details</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Distance (km)</label>
                      <input
                        type="number"
                        step="0.1"
                        name="distance_km"
                        value={formData.distance_km}
                        onChange={handleInputChange}
                        placeholder="e.g., 245.5"
                      />
                    </div>
                    <div className="form-group">
                      <label>Est. Duration (hours)</label>
                      <input
                        type="number"
                        step="0.5"
                        name="estimated_duration_hours"
                        value={formData.estimated_duration_hours}
                        onChange={handleInputChange}
                        placeholder="e.g., 4.5"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Vehicle Type</label>
                      <input
                        type="text"
                        name="vehicle_type"
                        value={formData.vehicle_type}
                        onChange={handleInputChange}
                        placeholder="e.g., Van, Truck"
                      />
                    </div>
                    <div className="form-group">
                      <label>Max Weight (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        name="max_weight_kg"
                        value={formData.max_weight_kg}
                        onChange={handleInputChange}
                        placeholder="e.g., 500"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3 className="form-section-title">Pricing</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Base Cost (₱)</label>
                      <input
                        type="number"
                        step="0.01"
                        name="base_cost"
                        value={formData.base_cost}
                        onChange={handleInputChange}
                        placeholder="e.g., 500"
                      />
                    </div>
                    <div className="form-group">
                      <label>Cost per kg (₱)</label>
                      <input
                        type="number"
                        step="0.01"
                        name="cost_per_kg"
                        value={formData.cost_per_kg}
                        onChange={handleInputChange}
                        placeholder="e.g., 5.50"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3 className="form-section-title">Waypoints</h3>
                  <div className="form-row full">
                    <div className="form-group">
                      <label>Waypoint Name</label>
                      <input
                        type="text"
                        name="location_name"
                        value={newWaypoint.location_name}
                        onChange={handleWaypointChange}
                        placeholder="e.g., Manila Hub"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Latitude</label>
                      <input
                        type="number"
                        step="0.000001"
                        name="latitude"
                        value={newWaypoint.latitude}
                        onChange={handleWaypointChange}
                        placeholder="14.5995"
                      />
                    </div>
                    <div className="form-group">
                      <label>Longitude</label>
                      <input
                        type="number"
                        step="0.000001"
                        name="longitude"
                        value={newWaypoint.longitude}
                        onChange={handleWaypointChange}
                        placeholder="120.9842"
                      />
                    </div>
                  </div>
                  <div className="form-row full">
                    <div className="form-group">
                      <label>Address</label>
                      <input
                        type="text"
                        name="location_address"
                        value={newWaypoint.location_address}
                        onChange={handleWaypointChange}
                        placeholder="Waypoint address"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addWaypoint}
                    className="btn-add-waypoint"
                  >
                    + Add Waypoint
                  </button>

                  {waypoints.length > 0 && (
                    <div className="waypoints-list">
                      <div className="waypoints-list-title">Added Waypoints ({waypoints.length})</div>
                      {waypoints.map((waypoint, index) => (
                        <div key={index} className="waypoint-item">
                          <div className="waypoint-info">
                            <div className="waypoint-name">{waypoint.location_name}</div>
                            <div className="waypoint-coords">
                              {waypoint.latitude}, {waypoint.longitude}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeWaypoint(index)}
                            className="btn-waypoint-remove"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-section">
                  <h3 className="form-section-title">Additional Notes</h3>
                  <div className="form-row full">
                    <div className="form-group">
                      <label>Notes</label>
                      <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleInputChange}
                        placeholder="Any additional information..."
                      />
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setEditingRoute(null)
                    }}
                    className="btn-form-cancel"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-form-save"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : editingRoute ? 'Update Route' : 'Create Route'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
