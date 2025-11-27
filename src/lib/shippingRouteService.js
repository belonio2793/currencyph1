import { supabase } from './supabaseClient'
import { logErrorSafely, getSafeErrorMessage } from './safeErrorHandler'

export const shippingRouteService = {
  async fetchAllRoutes(userId) {
    try {
      const { data, error } = await supabase
        .from('addresses_shipment_routes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (err) {
      logErrorSafely('shippingRouteService.fetchAllRoutes', err)
      throw err
    }
  },

  async fetchRouteDetails(routeId) {
    try {
      const { data: route, error: routeError } = await supabase
        .from('addresses_shipment_routes')
        .select('*')
        .eq('id', routeId)
        .single()

      if (routeError) throw routeError

      const { data: waypoints, error: waypointsError } = await supabase
        .from('addresses_shipment_route_waypoints')
        .select('*')
        .eq('route_id', routeId)
        .order('waypoint_number', { ascending: true })

      if (waypointsError) throw waypointsError

      const { data: assignments, error: assignmentsError } = await supabase
        .from('addresses_shipment_route_assignments')
        .select('*')
        .eq('route_id', routeId)

      if (assignmentsError) throw assignmentsError

      return { route, waypoints, assignments }
    } catch (err) {
      logErrorSafely('shippingRouteService.fetchRouteDetails', err)
      throw err
    }
  },

  async createRoute(userId, routeData) {
    try {
      const coordinates = await this.geocodeAddress(routeData.origin_address)
      const destCoordinates = await this.geocodeAddress(routeData.destination_address)

      const { data, error } = await supabase
        .from('addresses_shipment_routes')
        .insert([{
          user_id: userId,
          ...routeData,
          origin_latitude: coordinates?.latitude,
          origin_longitude: coordinates?.longitude,
          destination_latitude: destCoordinates?.latitude,
          destination_longitude: destCoordinates?.longitude
        }])
        .select()

      if (error) throw error
      return data?.[0]
    } catch (err) {
      logErrorSafely('shippingRouteService.createRoute', err)
      throw err
    }
  },

  async updateRoute(routeId, routeData) {
    try {
      const { data, error } = await supabase
        .from('addresses_shipment_routes')
        .update(routeData)
        .eq('id', routeId)
        .select()

      if (error) throw error
      return data?.[0]
    } catch (err) {
      logErrorSafely('shippingRouteService.updateRoute', err)
      throw err
    }
  },

  async deleteRoute(routeId) {
    try {
      const { error } = await supabase
        .from('addresses_shipment_routes')
        .delete()
        .eq('id', routeId)

      if (error) throw error
      return true
    } catch (err) {
      logErrorSafely('shippingRouteService.deleteRoute', err)
      throw err
    }
  },

  async addWaypoint(routeId, waypointData) {
    try {
      const { data, error } = await supabase
        .from('addresses_shipment_route_waypoints')
        .insert([{
          route_id: routeId,
          ...waypointData
        }])
        .select()

      if (error) throw error
      return data?.[0]
    } catch (err) {
      logErrorSafely('shippingRouteService.addWaypoint', err)
      throw err
    }
  },

  async updateWaypoint(waypointId, waypointData) {
    try {
      const { data, error } = await supabase
        .from('addresses_shipment_route_waypoints')
        .update(waypointData)
        .eq('id', waypointId)
        .select()

      if (error) throw error
      return data?.[0]
    } catch (err) {
      logErrorSafely('shippingRouteService.updateWaypoint', err)
      throw err
    }
  },

  async deleteWaypoint(waypointId) {
    try {
      const { error } = await supabase
        .from('addresses_shipment_route_waypoints')
        .delete()
        .eq('id', waypointId)

      if (error) throw error
      return true
    } catch (err) {
      logErrorSafely('shippingRouteService.deleteWaypoint', err)
      throw err
    }
  },

  async assignShipmentToRoute(routeId, shipmentId, userId, costData) {
    try {
      const { data, error } = await supabase
        .from('addresses_shipment_route_assignments')
        .insert([{
          route_id: routeId,
          shipment_id: shipmentId,
          user_id: userId,
          ...costData
        }])
        .select()

      if (error) throw error
      return data?.[0]
    } catch (err) {
      logErrorSafely('shippingRouteService.assignShipmentToRoute', err)
      throw err
    }
  },

  async fetchNetworkOrders(userId, limit = 100) {
    try {
      const { data, error } = await supabase
        .from('addresses_shipment_network_orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (err) {
      logErrorSafely('shippingRouteService.fetchNetworkOrders', err)
      throw err
    }
  },

  async createNetworkOrder(userId, orderData) {
    try {
      const { data, error } = await supabase
        .from('addresses_shipment_network_orders')
        .insert([{
          user_id: userId,
          ...orderData
        }])
        .select()

      if (error) throw error
      return data?.[0]
    } catch (err) {
      logErrorSafely('shippingRouteService.createNetworkOrder', err)
      throw err
    }
  },

  async updateNetworkOrder(orderId, orderData) {
    try {
      const { data, error } = await supabase
        .from('addresses_shipment_network_orders')
        .update(orderData)
        .eq('id', orderId)
        .select()

      if (error) throw error
      return data?.[0]
    } catch (err) {
      logErrorSafely('shippingRouteService.updateNetworkOrder', err)
      throw err
    }
  },

  async fetchCostAggregates(routeId, userId) {
    try {
      const { data, error } = await supabase
        .from('addresses_route_cost_aggregates')
        .select('*')
        .eq('route_id', routeId)
        .eq('user_id', userId)
        .order('period_start_date', { ascending: false })

      if (error) throw error
      return data || []
    } catch (err) {
      logErrorSafely('shippingRouteService.fetchCostAggregates', err)
      throw err
    }
  },

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  },

  calculateRouteCost(distance, weight, costPerKg, baseCost) {
    const distanceCost = distance * 2
    const weightCost = weight * costPerKg
    return baseCost + distanceCost + weightCost
  },

  calculateOptimalRoute(waypoints) {
    if (waypoints.length <= 2) return waypoints

    const points = [...waypoints]
    const optimized = [points.shift()]
    
    while (points.length > 0) {
      const current = optimized[optimized.length - 1]
      let nearest = 0
      let minDistance = Infinity

      points.forEach((point, index) => {
        const distance = this.calculateDistance(
          current.latitude,
          current.longitude,
          point.latitude,
          point.longitude
        )
        if (distance < minDistance) {
          minDistance = distance
          nearest = index
        }
      })

      optimized.push(points.splice(nearest, 1)[0])
    }

    return optimized
  },

  async calculateRouteCostAggregate(routeId, userId, startDate, endDate) {
    try {
      const { data: assignments, error } = await supabase
        .from('addresses_shipment_route_assignments')
        .select('cost_applied, shipment_id')
        .eq('route_id', routeId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)

      if (error) throw error

      const totalCost = assignments.reduce((sum, a) => sum + (a.cost_applied || 0), 0)
      const avgCost = assignments.length > 0 ? totalCost / assignments.length : 0

      const aggregate = {
        route_id: routeId,
        user_id: userId,
        period_start_date: startDate.split('T')[0],
        period_end_date: endDate.split('T')[0],
        total_orders: assignments.length,
        total_revenue: totalCost,
        average_revenue_per_order: avgCost
      }

      return aggregate
    } catch (err) {
      logErrorSafely('shippingRouteService.calculateRouteCostAggregate', err)
      throw err
    }
  },

  async saveCostAggregate(aggregateData) {
    try {
      const { data, error } = await supabase
        .from('addresses_route_cost_aggregates')
        .insert([aggregateData])
        .select()

      if (error) throw error
      return data?.[0]
    } catch (err) {
      logErrorSafely('shippingRouteService.saveCostAggregate', err)
      throw err
    }
  },

  async geocodeAddress(address) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
      )
      const results = await response.json()
      
      if (results.length > 0) {
        return {
          latitude: parseFloat(results[0].lat),
          longitude: parseFloat(results[0].lon)
        }
      }
      return null
    } catch (err) {
      logErrorSafely('shippingRouteService.geocodeAddress', err)
      return null
    }
  },

  async suggestOptimalRoute(orders) {
    try {
      if (orders.length === 0) return []

      const sortedOrders = orders.sort((a, b) => {
        return new Date(a.created_at) - new Date(b.created_at)
      })

      const clusteredOrders = this.clusterOrdersByLocation(sortedOrders)
      return clusteredOrders
    } catch (err) {
      logErrorSafely('shippingRouteService.suggestOptimalRoute', err)
      throw err
    }
  },

  clusterOrdersByLocation(orders) {
    const clusters = []
    const visited = new Set()

    orders.forEach((order, index) => {
      if (visited.has(index)) return

      const cluster = [order]
      visited.add(index)

      orders.forEach((other, otherIndex) => {
        if (visited.has(otherIndex)) return

        const distance = this.calculateDistance(
          order.origin_latitude,
          order.origin_longitude,
          other.origin_latitude,
          other.origin_longitude
        )

        if (distance < 50) {
          cluster.push(other)
          visited.add(otherIndex)
        }
      })

      clusters.push(cluster)
    })

    return clusters
  }
}
