import { getRoute, getRouteSourceInfo, monitorRouteRealtime } from './routingService'
import { supabase } from './supabaseClient'

/**
 * Real-time route estimation and monitoring service
 * Tracks route updates, ETA, and syncs with database
 */
class RouteEstimationService {
  constructor() {
    this.activeMonitors = new Map()
    this.routeCache = new Map()
    this.syncQueue = []
    this.isSyncing = false
  }

  /**
   * Start monitoring a route in real-time
   * @param {string} routeId - Unique identifier for the route
   * @param {number} startLat - Starting latitude
   * @param {number} startLng - Starting longitude
   * @param {number} endLat - Ending latitude
   * @param {number} endLng - Ending longitude
   * @param {Function} onUpdate - Callback for route updates
   * @param {Object} options - Configuration options
   */
  async startMonitoring(routeId, startLat, startLng, endLat, endLng, onUpdate, options = {}) {
    const {
      updateInterval = 30000, // Update every 30 seconds
      enableSync = true,
      rideId = null,
      userId = null
    } = options

    // Stop existing monitor if any
    if (this.activeMonitors.has(routeId)) {
      this.stopMonitoring(routeId)
    }

    try {
      // Get initial route
      const initialRoute = await getRoute(startLat, startLng, endLat, endLng)

      // Cache the route
      this.routeCache.set(routeId, {
        ...initialRoute,
        cachedAt: Date.now()
      })

      // Send initial update
      onUpdate({
        success: true,
        distance: initialRoute.distance,
        duration: initialRoute.duration,
        geometry: initialRoute.geometry,
        source: initialRoute.source,
        isInitial: true,
        timestamp: Date.now()
      })

      // Start real-time monitoring
      const unsubscribe = await monitorRouteRealtime(
        startLat,
        startLng,
        endLat,
        endLng,
        async (update) => {
          // Update cache
          this.routeCache.set(routeId, {
            ...update,
            cachedAt: Date.now()
          })

          // Send update
          onUpdate({
            ...update,
            timestamp: Date.now()
          })

          // Queue for sync if enabled
          if (enableSync && rideId) {
            this.queueRouteSync(rideId, userId, update)
          }
        },
        updateInterval
      )

      // Store monitor
      this.activeMonitors.set(routeId, {
        unsubscribe,
        rideId,
        userId,
        startedAt: Date.now(),
        startLat,
        startLng,
        endLat,
        endLng
      })

      return {
        success: true,
        routeId,
        monitoringStarted: true
      }
    } catch (error) {
      console.error('Route monitoring error:', error)
      onUpdate({
        success: false,
        error: error?.message,
        timestamp: Date.now()
      })

      return {
        success: false,
        error: error?.message
      }
    }
  }

  /**
   * Stop monitoring a route
   */
  stopMonitoring(routeId) {
    const monitor = this.activeMonitors.get(routeId)
    if (monitor) {
      monitor.unsubscribe()
      this.activeMonitors.delete(routeId)
      this.routeCache.delete(routeId)
    }
  }

  /**
   * Stop all active monitors
   */
  stopAllMonitoring() {
    for (const [routeId, monitor] of this.activeMonitors.entries()) {
      monitor.unsubscribe()
      this.routeCache.delete(routeId)
    }
    this.activeMonitors.clear()
  }

  /**
   * Get current route data from cache
   */
  getRouteData(routeId) {
    return this.routeCache.get(routeId) || null
  }

  /**
   * Queue route update for database sync
   */
  queueRouteSync(rideId, userId, routeData) {
    this.syncQueue.push({
      rideId,
      userId,
      routeData,
      timestamp: Date.now()
    })

    // Process queue if not already syncing
    if (!this.isSyncing) {
      this.processSyncQueue()
    }
  }

  /**
   * Process queued sync operations
   */
  async processSyncQueue() {
    if (this.isSyncing || this.syncQueue.length === 0) {
      return
    }

    this.isSyncing = true

    try {
      while (this.syncQueue.length > 0) {
        const item = this.syncQueue.shift()
        await this.syncRouteToDatabase(item.rideId, item.userId, item.routeData)

        // Small delay between syncs to avoid overloading database
        await new Promise(r => setTimeout(r, 500))
      }
    } catch (error) {
      console.error('Sync queue processing error:', error)
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * Sync route updates to database
   */
  async syncRouteToDatabase(rideId, userId, routeData) {
    try {
      if (!rideId || !userId) {
        console.warn('Missing rideId or userId for sync')
        return
      }

      const updateData = {
        estimated_distance: routeData.distance,
        estimated_duration: routeData.duration,
        route_geometry: routeData.geometry ? JSON.stringify(routeData.geometry) : null,
        route_metadata: JSON.stringify({
          source: routeData.source,
          updatedAt: new Date().toISOString(),
          coordinateCount: routeData.geometry?.length || 0
        }),
        synced_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('rides')
        .update(updateData)
        .eq('id', rideId)
        .eq('rider_id', userId)

      if (error) {
        console.error('Route sync error:', error)
      }
    } catch (error) {
      console.error('Route sync exception:', error)
    }
  }

  /**
   * Get real-time route suggestions based on traffic
   */
  async getRouteAlternatives(startLat, startLng, endLat, endLng) {
    try {
      // Get primary route
      const primaryRoute = await getRoute(startLat, startLng, endLat, endLng)

      return {
        primary: primaryRoute,
        timestamp: Date.now(),
        sourceInfo: getRouteSourceInfo(primaryRoute.source)
      }
    } catch (error) {
      console.error('Route alternatives error:', error)
      return {
        error: error?.message,
        timestamp: Date.now()
      }
    }
  }

  /**
   * Calculate ETA based on current route
   */
  calculateETA(routeData) {
    if (!routeData || !routeData.duration) {
      return null
    }

    const etaTime = new Date(Date.now() + routeData.duration * 60 * 1000)

    return {
      etaTime: etaTime.toISOString(),
      etaTimeFormatted: etaTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }),
      durationMinutes: routeData.duration,
      durationFormatted: this.formatDuration(routeData.duration)
    }
  }

  /**
   * Format duration for display
   */
  formatDuration(minutes) {
    if (minutes < 60) {
      return `${minutes} min`
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus() {
    const statuses = Array.from(this.activeMonitors.entries()).map(([routeId, monitor]) => ({
      routeId,
      rideId: monitor.rideId,
      monitoringDuration: Date.now() - monitor.startedAt,
      location: {
        lat: monitor.startLat,
        lng: monitor.startLng
      },
      destination: {
        lat: monitor.endLat,
        lng: monitor.endLng
      }
    }))

    return {
      activeMonitors: statuses.length,
      monitors: statuses,
      syncQueueLength: this.syncQueue.length,
      isSyncing: this.isSyncing
    }
  }

  /**
   * Clean up service
   */
  destroy() {
    this.stopAllMonitoring()
    this.syncQueue = []
    this.routeCache.clear()
  }
}

// Export singleton instance
export const routeEstimationService = new RouteEstimationService()

// Export class for testing
export default RouteEstimationService
