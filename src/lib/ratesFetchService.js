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

export default {
  getLastRatesFetchTime,
  getLatestPairUpdateTime,
  getLastFetchInfo,
  getMinutesSinceLastFetch,
  areRatesFresh
}
