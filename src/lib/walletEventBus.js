/**
 * Wallet Event Bus - Broadcasts wallet-related events across the application
 * This ensures that when a wallet is created, all components listening for
 * wallet events are notified immediately, without relying solely on Supabase real-time
 */

class WalletEventBus {
  constructor() {
    this.listeners = {
      walletCreated: [],
      walletUpdated: [],
      walletDeleted: [],
      walletsRefresh: []
    }
  }

  /**
   * Subscribe to an event
   * @param {string} eventType - Type of event ('walletCreated', 'walletUpdated', 'walletDeleted', 'walletsRefresh')
   * @param {function} callback - Callback function to execute when event fires
   * @returns {function} Unsubscribe function
   */
  on(eventType, callback) {
    if (!this.listeners[eventType]) {
      console.warn(`Unknown event type: ${eventType}`)
      return () => {}
    }

    this.listeners[eventType].push(callback)

    // Return unsubscribe function
    return () => {
      this.listeners[eventType] = this.listeners[eventType].filter(cb => cb !== callback)
    }
  }

  /**
   * Emit an event to all listeners
   * @param {string} eventType - Type of event to emit
   * @param {any} data - Data to pass to listeners
   */
  emit(eventType, data) {
    if (!this.listeners[eventType]) {
      console.warn(`Unknown event type: ${eventType}`)
      return
    }

    console.debug(`[WalletEventBus] Emitting ${eventType}:`, data)

    // Call all listeners for this event type
    this.listeners[eventType].forEach(callback => {
      try {
        callback(data)
      } catch (err) {
        console.error(`[WalletEventBus] Error in ${eventType} listener:`, err)
      }
    })
  }

  /**
   * Broadcast wallet creation event
   * @param {object} walletData - The created wallet data
   */
  broadcastWalletCreated(walletData) {
    this.emit('walletCreated', walletData)
  }

  /**
   * Broadcast wallet update event
   * @param {object} walletData - The updated wallet data
   */
  broadcastWalletUpdated(walletData) {
    this.emit('walletUpdated', walletData)
  }

  /**
   * Broadcast wallet deletion event
   * @param {string} walletId - The deleted wallet ID
   */
  broadcastWalletDeleted(walletId) {
    this.emit('walletDeleted', walletId)
  }

  /**
   * Broadcast request to refresh all wallets for a user
   * @param {string} userId - The user ID to refresh wallets for
   */
  broadcastRefreshWallets(userId) {
    this.emit('walletsRefresh', { userId })
  }

  /**
   * Clear all listeners (useful for testing or cleanup)
   */
  clearAll() {
    Object.keys(this.listeners).forEach(key => {
      this.listeners[key] = []
    })
  }
}

// Export singleton instance
export const walletEventBus = new WalletEventBus()
