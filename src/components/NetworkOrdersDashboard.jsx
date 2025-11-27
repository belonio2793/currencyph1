import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import { shippingRouteService } from '../lib/shippingRouteService'
import { supabase } from '../lib/supabaseClient'
import { logErrorSafely } from '../lib/safeErrorHandler'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

export default function NetworkOrdersDashboard({ userId }) {
  const mapRef = useRef(null)
  const [orders, setOrders] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    dateRange: 'today'
  })
  const [loading, setLoading] = useState(false)
  const [mapCenter, setMapCenter] = useState([12.8797, 121.7740])
  const [zoomLevel, setZoomLevel] = useState(6)
  const [refreshInterval, setRefreshInterval] = useState(30000)
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    inTransitOrders: 0,
    deliveredOrders: 0,
    totalRevenue: 0,
    totalCost: 0,
    averageCost: 0
  })

  useEffect(() => {
    loadNetworkOrders()
    const interval = setInterval(loadNetworkOrders, refreshInterval)
    return () => clearInterval(interval)
  }, [userId, refreshInterval])

  useEffect(() => {
    calculateStats()
  }, [orders])

  const loadNetworkOrders = async () => {
    if (!userId) return
    try {
      setLoading(true)
      const data = await shippingRouteService.fetchNetworkOrders(userId, 200)
      setOrders(data)
    } catch (err) {
      logErrorSafely('NetworkOrdersDashboard.loadNetworkOrders', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = () => {
    const newStats = {
      totalOrders: orders.length,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      inTransitOrders: orders.filter(o => o.status === 'in-transit').length,
      deliveredOrders: orders.filter(o => o.status === 'delivered').length,
      totalRevenue: orders.reduce((sum, o) => sum + (parseFloat(o.estimated_cost) || 0), 0),
      totalCost: orders.reduce((sum, o) => sum + (parseFloat(o.actual_cost) || 0), 0),
      averageCost: 0
    }
    newStats.averageCost = newStats.totalOrders > 0 ? newStats.totalCost / newStats.totalOrders : 0
    setStats(newStats)
  }

  const getFilteredOrders = () => {
    let filtered = [...orders]

    if (filters.status !== 'all') {
      filtered = filtered.filter(o => o.status === filters.status)
    }

    if (filters.priority !== 'all') {
      filtered = filtered.filter(o => o.priority === filters.priority)
    }

    if (filters.dateRange === 'today') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      filtered = filtered.filter(o => new Date(o.created_at) >= today)
    } else if (filters.dateRange === 'week') {
      const week = new Date()
      week.setDate(week.getDate() - 7)
      filtered = filtered.filter(o => new Date(o.created_at) >= week)
    } else if (filters.dateRange === 'month') {
      const month = new Date()
      month.setMonth(month.getMonth() - 1)
      filtered = filtered.filter(o => new Date(o.created_at) >= month)
    }

    return filtered
  }

  const getStatusColor = (status) => {
    const colors = {
      pending: '#f59e0b',
      'in-transit': '#3b82f6',
      delivered: '#10b981',
      failed: '#ef4444'
    }
    return colors[status] || '#6b7280'
  }

  const getStatusIcon = (status) => {
    const icons = {
      pending: '⏳',
      'in-transit': '🚚',
      delivered: '✓',
      failed: '✗'
    }
    return icons[status] || '•'
  }

  const getPriorityColor = (priority) => {
    const colors = {
      low: '#6b7280',
      normal: '#3b82f6',
      high: '#f59e0b',
      urgent: '#ef4444'
    }
    return colors[priority] || '#3b82f6'
  }

  const filteredOrders = getFilteredOrders()

  return (
    <div style={{ padding: '20px', background: '#f9fafb', borderRadius: '8px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '15px' }}>
          Network Orders Dashboard
        </h3>

        {/* Statistics Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          <div style={{ background: 'white', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '5px' }}>
              Total Orders
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#1f2937' }}>
              {stats.totalOrders}
            </div>
          </div>

          <div style={{ background: 'white', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '5px' }}>
              Pending
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#f59e0b' }}>
              {stats.pendingOrders}
            </div>
          </div>

          <div style={{ background: 'white', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '5px' }}>
              In Transit
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#3b82f6' }}>
              {stats.inTransitOrders}
            </div>
          </div>

          <div style={{ background: 'white', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '5px' }}>
              Delivered
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#10b981' }}>
              {stats.deliveredOrders}
            </div>
          </div>

          <div style={{ background: 'white', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '5px' }}>
              Total Revenue
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#8b5cf6' }}>
              ₱{stats.totalRevenue.toFixed(2)}
            </div>
          </div>

          <div style={{ background: 'white', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #ec4899' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '5px' }}>
              Avg Cost
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#ec4899' }}>
              ₱{stats.averageCost.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ background: 'white', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '5px' }}>
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in-transit">In Transit</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '5px' }}>
              Priority
            </label>
            <select
              value={filters.priority}
              onChange={(e) => setFilters({...filters, priority: e.target.value})}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '5px' }}>
              Date Range
            </label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '5px' }}>
              Refresh Interval
            </label>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
            >
              <option value="10000">10 seconds</option>
              <option value="30000">30 seconds</option>
              <option value="60000">1 minute</option>
              <option value="300000">5 minutes</option>
            </select>
          </div>
        </div>
      </div>

      {/* Map View */}
      <div style={{ background: 'white', borderRadius: '8px', padding: '15px', marginBottom: '20px' }}>
        <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px', marginTop: 0 }}>
          Orders Map
        </h4>
        <div style={{ height: '400px', borderRadius: '6px', overflow: 'hidden' }}>
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
            
            {filteredOrders.map(order => {
              if (!order.origin_latitude || !order.origin_longitude) return null
              return (
                <div key={order.id}>
                  <Marker
                    position={[order.origin_latitude, order.origin_longitude]}
                    onClick={() => setSelectedOrder(order)}
                  >
                    <Popup>
                      <div style={{ fontSize: '12px' }}>
                        <strong>{order.order_number}</strong>
                        <p style={{ margin: '5px 0' }}>From: {order.origin_address}</p>
                        <p style={{ margin: '5px 0' }}>To: {order.destination_address}</p>
                        <p style={{ margin: '5px 0' }}>
                          <span style={{
                            background: getStatusColor(order.status),
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '10px'
                          }}>
                            {order.status}
                          </span>
                        </p>
                      </div>
                    </Popup>
                  </Marker>

                  {order.destination_latitude && order.destination_longitude && (
                    <Marker
                      position={[order.destination_latitude, order.destination_longitude]}
                    >
                      <Popup>
                        <div style={{ fontSize: '12px' }}>
                          <strong>Destination</strong>
                          <p style={{ margin: '5px 0' }}>{order.destination_address}</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}

                  {order.destination_latitude && order.destination_longitude && (
                    <Circle
                      center={[order.destination_latitude, order.destination_longitude]}
                      radius={1000}
                      color={getStatusColor(order.status)}
                      fillColor={getStatusColor(order.status)}
                      fillOpacity={0.2}
                    />
                  )}
                </div>
              )
            })}
          </MapContainer>
        </div>
      </div>

      {/* Orders Table */}
      <div style={{ background: 'white', borderRadius: '8px', padding: '15px', overflowX: 'auto' }}>
        <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px', marginTop: 0 }}>
          Orders List ({filteredOrders.length})
        </h4>
        
        {loading && <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>Loading orders...</div>}

        {!loading && filteredOrders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
            No orders found matching your filters
          </div>
        )}

        {!loading && filteredOrders.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#374151' }}>Order #</th>
                <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#374151' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#374151' }}>From</th>
                <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#374151' }}>To</th>
                <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#374151' }}>Priority</th>
                <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#374151' }}>Weight (kg)</th>
                <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#374151' }}>Cost</th>
                <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#374151' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => (
                <tr
                  key={order.id}
                  style={{
                    borderBottom: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    background: selectedOrder?.id === order.id ? '#dbeafe' : 'transparent'
                  }}
                  onClick={() => setSelectedOrder(order)}
                >
                  <td style={{ padding: '12px', fontWeight: '500', color: '#1f2937' }}>{order.order_number}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      background: getStatusColor(order.status),
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '500'
                    }}>
                      {getStatusIcon(order.status)} {order.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: '#6b7280' }}>
                    {order.origin_address.substring(0, 30)}...
                  </td>
                  <td style={{ padding: '12px', color: '#6b7280' }}>
                    {order.destination_address.substring(0, 30)}...
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      background: getPriorityColor(order.priority),
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '10px',
                      fontWeight: '500'
                    }}>
                      {order.priority}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: '#1f2937' }}>
                    {order.package_weight_kg || '—'}
                  </td>
                  <td style={{ padding: '12px', fontWeight: '500', color: '#1f2937' }}>
                    ₱{parseFloat(order.estimated_cost || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: '12px', color: '#6b7280', fontSize: '12px' }}>
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Selected Order Details */}
      {selectedOrder && (
        <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '20px', marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Order Details</h4>
            <button
              onClick={() => setSelectedOrder(null)}
              style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#6b7280' }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>Order Number</div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>{selectedOrder.order_number}</div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>Status</div>
              <div style={{
                display: 'inline-block',
                background: getStatusColor(selectedOrder.status),
                color: 'white',
                padding: '6px 12px',
                borderRadius: '4px',
                fontWeight: '500'
              }}>
                {selectedOrder.status}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>Priority</div>
              <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{selectedOrder.priority}</div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>Package Weight</div>
              <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>
                {selectedOrder.package_weight_kg || '—'} kg
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>Estimated Cost</div>
              <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>
                ₱{parseFloat(selectedOrder.estimated_cost || 0).toFixed(2)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>Actual Cost</div>
              <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>
                ₱{parseFloat(selectedOrder.actual_cost || 0).toFixed(2)}
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>From</div>
              <div style={{ fontSize: '14px', color: '#1f2937' }}>{selectedOrder.origin_address}</div>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>To</div>
              <div style={{ fontSize: '14px', color: '#1f2937' }}>{selectedOrder.destination_address}</div>
            </div>

            {selectedOrder.notes && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>Notes</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>{selectedOrder.notes}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
