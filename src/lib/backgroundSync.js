import tripadvisorSync from './tripadvisorSync'

/**
 * Background sync service
 * Periodically syncs listings with TripAdvisor
 */

let syncInterval = null

export const backgroundSync = {
  /**
   * Start background sync
   * Syncs every 24 hours by default
   */
  start(intervalHours = 24) {
    if (syncInterval) {
      console.warn('Background sync already running')
      return
    }

    const intervalMs = intervalHours * 60 * 60 * 1000

    console.log(`Starting background sync (every ${intervalHours} hours)`)

    // Run sync immediately
    tripadvisorSync.syncWithTripAdvisor().catch(err => {
      console.error('Initial sync failed:', err)
    })

    // Schedule periodic syncs
    syncInterval = setInterval(() => {
      console.log('Running periodic TripAdvisor sync...')
      tripadvisorSync.syncWithTripAdvisor().catch(err => {
        console.error('Periodic sync failed:', err)
      })
    }, intervalMs)
  },

  /**
   * Stop background sync
   */
  stop() {
    if (syncInterval) {
      clearInterval(syncInterval)
      syncInterval = null
      console.log('Background sync stopped')
    }
  },

  /**
   * Force immediate sync
   */
  async syncNow() {
    console.log('Forcing immediate sync...')
    return tripadvisorSync.syncWithTripAdvisor()
  },

  /**
   * Check if sync is running
   */
  isRunning() {
    return syncInterval !== null
  }
}

export default backgroundSync
