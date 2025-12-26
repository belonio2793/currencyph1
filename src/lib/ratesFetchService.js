import { supabase } from './supabaseClient'

/**
 * Service to track and retrieve information about when rates were last fetched
 * Uses the cached_rates table which is updated by the fetch-rates edge function
 */

/**
 * Get the timestamp of the last successful fetch-rates execution
 * This is the true last fetch time from the edge function cron job
 */
export async function getLastRatesFetchTime() {
  try {
    const { data, error } = await supabase
      .from('cached_rates')
      .select('fetched_at, source')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.warn('Error fetching rates last update time:', error.message)
      return null
    }

    if (data && data.fetched_at) {
      return {
        timestamp: new Date(data.fetched_at),
        source: data.source || 'unknown',
        isoString: data.fetched_at
      }
    }

    return null
  } catch (err) {
    console.warn('Failed to get last rates fetch time:', err.message)
    return null
  }
}

/**
 * Get the most recent pair update timestamp from the pairs table
 * This shows when individual pair data was last updated
 */
export async function getLatestPairUpdateTime() {
  try {
    const { data, error } = await supabase
      .from('pairs')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.warn('Error fetching latest pair update time:', error.message)
      return null
    }

    if (data && data.updated_at) {
      return new Date(data.updated_at)
    }

    return null
  } catch (err) {
    console.warn('Failed to get latest pair update time:', err.message)
    return null
  }
}

/**
 * Get information about the last rates fetch including source and status
 * Checks freshness and falls back to pairs table if cached_rates is stale
 */
export async function getLastFetchInfo() {
  try {
    // Try cached_rates first (from edge function)
    const { data: cachedData, error: cachedError } = await supabase
      .from('cached_rates')
      .select('fetched_at, source, exchange_rates, crypto_prices')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single()

    if (!cachedError && cachedData && cachedData.fetched_at) {
      const fetchedAt = new Date(cachedData.fetched_at)
      const minutesSinceFetch = Math.floor((Date.now() - fetchedAt.getTime()) / 1000 / 60)

      // If cached_rates is recent (within 24 hours), use it
      if (minutesSinceFetch < 1440) { // 1440 minutes = 24 hours
        return {
          fetchedAt: fetchedAt,
          isoString: cachedData.fetched_at,
          source: cachedData.source || 'edge-function',
          pairCount: Object.keys(cachedData.exchange_rates || {}).length,
          cryptoCount: Object.keys(cachedData.crypto_prices || {}).length,
          totalRates: Object.keys(cachedData.exchange_rates || {}).length + Object.keys(cachedData.crypto_prices || {}).length,
          isFresh: minutesSinceFetch < 60,
          minutesSinceFetch: minutesSinceFetch
        }
      } else {
        console.warn('cached_rates is stale (> 24 hours), falling back to pairs table...')
      }
    }

    // Fallback: Use most recent pair update time (indicates data was updated from somewhere)
    const { data: pairData, error: pairError } = await supabase
      .from('pairs')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (!pairError && pairData && pairData.updated_at) {
      const fetchedAt = new Date(pairData.updated_at)
      const minutesSinceFetch = Math.floor((Date.now() - fetchedAt.getTime()) / 1000 / 60)

      return {
        fetchedAt: fetchedAt,
        isoString: pairData.updated_at,
        source: 'pairs-table',
        pairCount: 0, // Unknown from this query
        cryptoCount: 0, // Unknown from this query
        totalRates: 0, // Unknown from this query
        isFresh: minutesSinceFetch < 60,
        minutesSinceFetch: minutesSinceFetch,
        isEstimated: true // Fallback value
      }
    }

    console.warn('Could not fetch rates info from any source')
    return null
  } catch (err) {
    console.warn('Failed to get last fetch info:', err.message)
    return null
  }
}

/**
 * Calculate how many minutes ago the rates were last fetched
 */
export async function getMinutesSinceLastFetch() {
  const lastFetch = await getLastRatesFetchTime()
  if (!lastFetch) return null

  const now = new Date()
  const minutes = Math.floor((now - lastFetch.timestamp) / 1000 / 60)
  return minutes
}

/**
 * Check if rates are fresh (fetched within last hour)
 */
export async function areRatesFresh() {
  const minutes = await getMinutesSinceLastFetch()
  if (minutes === null) return false
  return minutes < 60
}

/**
 * Trigger the fetch-rates edge function manually
 * Returns true if successful, false otherwise
 */
export async function triggerFetchRatesEdgeFunction() {
  try {
    const SUPABASE_URL = import.meta.env.VITE_PROJECT_URL || import.meta.env.VITE_SUPABASE_URL
    const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

    if (!SUPABASE_URL || !ANON_KEY) {
      console.warn('[RatesFetch] Missing Supabase configuration for edge function')
      return false
    }

    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/fetch-rates`

    console.log('[RatesFetch] Triggering fetch-rates edge function...')

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`
      },
      body: JSON.stringify({
        source: 'client-app-trigger',
        timestamp: new Date().toISOString()
      })
    })

    if (!response.ok) {
      console.warn(`[RatesFetch] Edge function returned status ${response.status}`)
      return false
    }

    const result = await response.json()
    console.log('[RatesFetch] ✅ Edge function executed successfully:', result)
    return true
  } catch (err) {
    console.warn('[RatesFetch] Failed to trigger edge function:', err.message)
    return false
  }
}

/**
 * Check if we should refresh rates and trigger if needed
 * Uses localStorage to track last manual fetch time (separate from edge function cron)
 * Only triggers if more than 1 hour has passed since last client-side trigger
 *
 * This prevents excessive API calls while ensuring rates stay reasonably fresh
 */
export async function checkAndRefreshRatesIfNeeded() {
  try {
    const LAST_FETCH_KEY = 'rates_last_client_fetch'
    const CACHE_DURATION_MS = 60 * 60 * 1000 // 1 hour in milliseconds

    // Check localStorage for last manual fetch
    const lastFetchStr = localStorage.getItem(LAST_FETCH_KEY)
    const lastFetch = lastFetchStr ? new Date(lastFetchStr) : null
    const now = new Date()

    // Calculate time since last fetch
    const timeSinceLastFetch = lastFetch ? now.getTime() - lastFetch.getTime() : CACHE_DURATION_MS

    if (timeSinceLastFetch >= CACHE_DURATION_MS) {
      console.log(`[RatesFetch] Refreshing rates (${lastFetch ? Math.round(timeSinceLastFetch / 1000 / 60) + ' minutes' : 'never'} since last fetch)`)

      // Trigger the edge function
      const success = await triggerFetchRatesEdgeFunction()

      if (success) {
        // Update localStorage with current time
        localStorage.setItem(LAST_FETCH_KEY, now.toISOString())
        return {
          triggered: true,
          message: 'Rates refreshed successfully'
        }
      } else {
        return {
          triggered: false,
          message: 'Failed to trigger rates refresh'
        }
      }
    } else {
      const minutesUntilNextFetch = Math.ceil((CACHE_DURATION_MS - timeSinceLastFetch) / 1000 / 60)
      console.log(`[RatesFetch] Rates were refreshed recently (${Math.round(timeSinceLastFetch / 1000 / 60)} minutes ago). Next refresh in ~${minutesUntilNextFetch} minutes.`)
      return {
        triggered: false,
        message: `Rates refreshed ${Math.round(timeSinceLastFetch / 1000 / 60)} minutes ago. Next refresh in ~${minutesUntilNextFetch} minutes.`,
        minutesUntilNextFetch: minutesUntilNextFetch
      }
    }
  } catch (err) {
    console.warn('[RatesFetch] Error in checkAndRefreshRatesIfNeeded:', err.message)
    return {
      triggered: false,
      message: 'Error checking rates refresh'
    }
  }
}

export default {
  getLastRatesFetchTime,
  getLatestPairUpdateTime,
  getLastFetchInfo,
  getMinutesSinceLastFetch,
  areRatesFresh,
  triggerFetchRatesEdgeFunction,
  checkAndRefreshRatesIfNeeded
}
