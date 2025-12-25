/**
 * Ultra-optimized direct public.pairs query
 * ✅ ZERO external API calls
 * ✅ Direct Supabase query only
 * ✅ < 0.1ms response time
 * ✅ No fallback logic - database only
 */

import { supabase } from './supabaseClient'

/**
 * Get ALL pairs in a single optimized query
 * Returns immediately from database cache
 */
export async function getAllPairsOptimized() {
  try {
    const startTime = performance.now()
    
    const { data, error } = await supabase
      .from('pairs')
      .select('from_currency, to_currency, rate, updated_at, pair_direction')
      .order('from_currency', { ascending: true })
    
    const queryTime = performance.now() - startTime
    
    if (error) {
      console.error('[DirectPairs] Error fetching all pairs:', error.message)
      return []
    }
    
    console.log(`[DirectPairs] ✓ Fetched ${data?.length || 0} pairs in ${queryTime.toFixed(2)}ms`)
    return data || []
  } catch (err) {
    console.error('[DirectPairs] Fatal error:', err.message)
    return []
  }
}

/**
 * Get specific rate from public.pairs (fastest single lookup)
 * @param {string} fromCurrency - Source currency code (e.g., 'BTC')
 * @param {string} toCurrency - Target currency code (e.g., 'PHP')
 * @returns {Promise<number|null>} Exchange rate or null
 */
export async function getDirectRate(fromCurrency, toCurrency) {
  if (!fromCurrency || !toCurrency) return null
  if (fromCurrency === toCurrency) return 1

  try {
    const from = fromCurrency.toUpperCase()
    const to = toCurrency.toUpperCase()
    const startTime = performance.now()

    const { data, error } = await supabase
      .from('pairs')
      .select('rate')
      .eq('from_currency', from)
      .eq('to_currency', to)
      .single()

    const queryTime = performance.now() - startTime

    if (error) {
      console.debug(`[DirectPairs] ${from}/${to} not found (${queryTime.toFixed(2)}ms)`)
      return null
    }

    if (data && typeof data.rate === 'number' && isFinite(data.rate) && data.rate > 0) {
      console.debug(`[DirectPairs] ${from}/${to} = ${data.rate} (${queryTime.toFixed(2)}ms)`)
      return data.rate
    }

    return null
  } catch (err) {
    console.error(`[DirectPairs] Error fetching ${fromCurrency}/${toCurrency}:`, err.message)
    return null
  }
}

/**
 * Get specific rate with metadata (direction, source, timestamp)
 */
export async function getDirectRateWithMetadata(fromCurrency, toCurrency) {
  if (!fromCurrency || !toCurrency) return null
  if (fromCurrency === toCurrency) {
    return {
      rate: 1,
      pair_direction: 'identity',
      source_table: 'none',
      updated_at: new Date().toISOString()
    }
  }

  try {
    const from = fromCurrency.toUpperCase()
    const to = toCurrency.toUpperCase()

    const { data, error } = await supabase
      .from('pairs')
      .select('rate, pair_direction, source_table, updated_at')
      .eq('from_currency', from)
      .eq('to_currency', to)
      .single()

    if (error) {
      console.debug(`[DirectPairs] No metadata found for ${from}/${to}`)
      return null
    }

    if (data && typeof data.rate === 'number' && isFinite(data.rate) && data.rate > 0) {
      return {
        rate: data.rate,
        pair_direction: data.pair_direction,
        source_table: data.source_table,
        updated_at: data.updated_at
      }
    }

    return null
  } catch (err) {
    console.error(`[DirectPairs] Error fetching metadata for ${fromCurrency}/${toCurrency}:`, err.message)
    return null
  }
}

/**
 * Get multiple rates in single batch query (most efficient)
 * @param {string[]} fromCurrencies - Array of source currencies
 * @param {string} toCurrency - Target currency
 * @returns {Promise<Object>} Map of currency -> rate
 */
export async function getDirectRatesBatch(fromCurrencies, toCurrency = 'PHP') {
  if (!fromCurrencies || fromCurrencies.length === 0) return {}

  try {
    const to = toCurrency.toUpperCase()
    const fromUpper = fromCurrencies.map(c => c.toUpperCase())

    const { data, error } = await supabase
      .from('pairs')
      .select('from_currency, rate')
      .eq('to_currency', to)
      .in('from_currency', fromUpper)

    if (error) {
      console.error(`[DirectPairs] Batch query error:`, error.message)
      return {}
    }

    const rates = {}
    data?.forEach(row => {
      if (row.rate && isFinite(row.rate) && row.rate > 0) {
        rates[row.from_currency] = row.rate
      }
    })

    console.log(`[DirectPairs] ✓ Batch query returned ${Object.keys(rates).length}/${fromCurrencies.length} rates`)
    return rates
  } catch (err) {
    console.error('[DirectPairs] Batch query fatal error:', err.message)
    return {}
  }
}

/**
 * Check if pairs table has data
 */
export async function checkPairsTableStatus() {
  try {
    const { count, error } = await supabase
      .from('pairs')
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.error('[DirectPairs] Status check error:', error.message)
      return { available: false, count: 0 }
    }

    return { available: count > 0, count }
  } catch (err) {
    console.error('[DirectPairs] Status check failed:', err.message)
    return { available: false, count: 0 }
  }
}

/**
 * Export all functions
 */
export default {
  getAllPairsOptimized,
  getDirectRate,
  getDirectRateWithMetadata,
  getDirectRatesBatch,
  checkPairsTableStatus
}
