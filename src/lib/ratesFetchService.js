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
 */
export async function getLastFetchInfo() {
  try {
    const { data, error } = await supabase
      .from('cached_rates')
      .select('fetched_at, source, exchange_rates, crypto_prices')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.warn('Error fetching rates info:', error.message)
      return null
    }

    if (data && data.fetched_at) {
      return {
        fetchedAt: new Date(data.fetched_at),
        isoString: data.fetched_at,
        source: data.source || 'unknown',
        pairCount: Object.keys(data.exchange_rates || {}).length,
        cryptoCount: Object.keys(data.crypto_prices || {}).length,
        totalRates: Object.keys(data.exchange_rates || {}).length + Object.keys(data.crypto_prices || {}).length
      }
    }

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
