/**
 * Rates Polling Service
 * Automatically refreshes exchange rates every hour and uses realtime subscriptions
 * to update immediately when rates change in the database
 */

import { supabase } from './supabaseClient'

let pollingIntervals = new Map() // Track intervals per component
let realtimeChannels = new Map() // Track realtime subscriptions per component

/**
 * Start automatic polling for exchange rates
 * @param {string} componentId - Unique identifier for the component (e.g., 'deposits', 'payments')
 * @param {function} onRatesUpdate - Callback function when rates are fetched
 * @param {number} intervalMs - Polling interval in milliseconds (default: 60 minutes)
 */
export function startRatesPolling(componentId, onRatesUpdate, intervalMs = 60 * 60 * 1000) {
  // Clear any existing interval for this component
  if (pollingIntervals.has(componentId)) {
    clearInterval(pollingIntervals.get(componentId))
  }

  // Initial fetch
  console.log(`[RatesPolling] Starting polling for ${componentId} (every ${intervalMs / 1000 / 60} minutes)`)
  onRatesUpdate()

  // Set up polling interval
  const intervalId = setInterval(() => {
    console.log(`[RatesPolling] Auto-fetching rates for ${componentId}`)
    onRatesUpdate()
  }, intervalMs)

  pollingIntervals.set(componentId, intervalId)
  return intervalId
}

/**
 * Start realtime subscription to pairs table
 * Automatically updates when rates change in the database
 * @param {string} componentId - Unique identifier for the component
 * @param {function} onRatesUpdate - Callback function when rates change
 */
export function startRealtimeRatesSubscription(componentId, onRatesUpdate) {
  // Clear any existing subscription for this component
  if (realtimeChannels.has(componentId)) {
    try {
      realtimeChannels.get(componentId).unsubscribe()
    } catch (e) {
      console.warn(`[RatesPolling] Error unsubscribing from ${componentId}:`, e)
    }
  }

  console.log(`[RatesPolling] Starting realtime subscription for ${componentId}`)

  const channel = supabase
    .channel(`pairs-updates-${componentId}`)
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'pairs'
      },
      (payload) => {
        console.log(`[RatesPolling] Rate updated via realtime (${payload.eventType}):`, payload.new?.from_currency, '->', payload.new?.to_currency)
        // Trigger fetch on next tick to batch multiple updates
        setTimeout(() => {
          onRatesUpdate()
        }, 100)
      }
    )
    .subscribe()

  realtimeChannels.set(componentId, channel)
  return channel
}

/**
 * Stop polling for a specific component
 * @param {string} componentId - Unique identifier for the component
 */
export function stopRatesPolling(componentId) {
  if (pollingIntervals.has(componentId)) {
    clearInterval(pollingIntervals.get(componentId))
    pollingIntervals.delete(componentId)
    console.log(`[RatesPolling] Stopped polling for ${componentId}`)
  }
}

/**
 * Stop realtime subscription for a specific component
 * @param {string} componentId - Unique identifier for the component
 */
export function stopRealtimeRatesSubscription(componentId) {
  if (realtimeChannels.has(componentId)) {
    try {
      realtimeChannels.get(componentId).unsubscribe()
      realtimeChannels.delete(componentId)
      console.log(`[RatesPolling] Stopped realtime subscription for ${componentId}`)
    } catch (e) {
      console.warn(`[RatesPolling] Error stopping subscription for ${componentId}:`, e)
    }
  }
}

/**
 * Stop all polling and subscriptions (cleanup on unmount)
 * @param {string} componentId - Unique identifier for the component
 */
export function stopAllRatesUpdates(componentId) {
  stopRatesPolling(componentId)
  stopRealtimeRatesSubscription(componentId)
}

/**
 * Get current polling status
 */
export function getRatesPollingStatus() {
  return {
    activePollings: Array.from(pollingIntervals.keys()),
    activeSubscriptions: Array.from(realtimeChannels.keys())
  }
}
