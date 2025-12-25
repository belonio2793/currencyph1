/**
 * Exchange Rate Cache Manager
 * - Caches rates in localStorage
 * - Provides fallback to stale rates
 * - Implements retry logic with exponential backoff
 */

const CACHE_KEY = 'exchange_rates_cache'
const CACHE_EXPIRY_MS = 60 * 60 * 1000 // 1 hour
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000 // 10 seconds
}

// Note: No hardcoded fallback rates - all rates must come from the database

export class ExchangeRateCache {
  constructor() {
    this.cache = null
    this.lastFetch = null
    this.isLoading = false
    this.fetchPromise = null
  }

  /**
   * Get cached data from localStorage
   */
  getLocalStorage() {
    try {
      const stored = localStorage.getItem(CACHE_KEY)
      if (!stored) return null
      const data = JSON.parse(stored)
      return data
    } catch (e) {
      console.warn('[ExchangeRateCache] Failed to read from localStorage:', e)
      return null
    }
  }

  /**
   * Save to localStorage
   */
  setLocalStorage(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        ...data,
        cachedAt: new Date().toISOString()
      }))
    } catch (e) {
      console.warn('[ExchangeRateCache] Failed to save to localStorage:', e)
    }
  }

  /**
   * Check if cache is still fresh
   */
  isCacheFresh(timestamp) {
    if (!timestamp) return false
    const age = Date.now() - new Date(timestamp).getTime()
    return age < CACHE_EXPIRY_MS
  }

  /**
   * Fetch rates with retry logic
   */
  async fetchWithRetry(apiCall, retryCount = 0) {
    try {
      return await apiCall()
    } catch (error) {
      if (retryCount < RETRY_CONFIG.maxRetries) {
        const delay = Math.min(
          RETRY_CONFIG.initialDelay * Math.pow(2, retryCount),
          RETRY_CONFIG.maxDelay
        )
        console.warn(`[ExchangeRateCache] Retry ${retryCount + 1}/${RETRY_CONFIG.maxRetries} after ${delay}ms:`, error.message)
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.fetchWithRetry(apiCall, retryCount + 1)
      }
      throw error
    }
  }

  /**
   * Get current rates (with caching and fallback)
   */
  async getRates() {
    // If already loading, return the same promise
    if (this.isLoading && this.fetchPromise) {
      return this.fetchPromise
    }

    this.fetchPromise = this._fetchRates()
    this.isLoading = true
    try {
      const rates = await this.fetchPromise
      this.isLoading = false
      return rates
    } catch (error) {
      this.isLoading = false
      throw error
    }
  }

  /**
   * Internal fetch implementation
   */
  async _fetchRates() {
    // Check fresh local cache first
    const local = this.getLocalStorage()
    if (local && local.cachedAt && this.isCacheFresh(local.cachedAt)) {
      console.log('[ExchangeRateCache] Using fresh cache from localStorage')
      return local
    }

    // Try to fetch fresh rates
    try {
      const rates = await this.fetchWithRetry(async () => {
        const response = await fetch('https://openexchangerates.org/api/latest.json?app_id=' + (import.meta.env.VITE_OPEN_EXCHANGE_RATES_API || import.meta.env.OPEN_EXCHANGE_RATES_API), {
          signal: AbortSignal.timeout(15000)
        })
        if (!response.ok) throw new Error(`API returned ${response.status}`)
        const data = await response.json()
        if (!data.rates) throw new Error('No rates in response')
        return data.rates
      })

      if (rates) {
        this.setLocalStorage({ rates })
        console.log('[ExchangeRateCache] Successfully fetched and cached fresh rates')
        return { rates, source: 'api', timestamp: new Date().toISOString() }
      }
    } catch (error) {
      console.warn('[ExchangeRateCache] Failed to fetch fresh rates:', error.message)
    }

    // Fall back to stale local cache if available
    if (local && local.rates) {
      console.log('[ExchangeRateCache] Using stale cache from localStorage')
      return { ...local, source: 'stale_cache', warning: 'Stale cache - rates may not be current' }
    }

    // No fallback - rates must come from database
    console.error('[ExchangeRateCache] Unable to fetch rates from any source')
    return {
      rates: {},
      source: 'none',
      warning: 'No rates available - database connection may be down'
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    try {
      localStorage.removeItem(CACHE_KEY)
      this.cache = null
      console.log('[ExchangeRateCache] Cache cleared')
    } catch (e) {
      console.warn('[ExchangeRateCache] Failed to clear cache:', e)
    }
  }

  /**
   * Get a single rate
   */
  async getRate(currencyCode) {
    const data = await this.getRates()
    return data.rates?.[currencyCode] || null
  }

  /**
   * Convert amount between currencies
   */
  async convert(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount
    if (!amount || isNaN(amount)) return null

    const data = await this.getRates()
    const fromRate = data.rates?.[fromCurrency]
    const toRate = data.rates?.[toCurrency]

    if (!fromRate || !toRate) {
      console.warn(`[ExchangeRateCache] Missing rates for conversion:`, { fromCurrency, fromRate, toCurrency, toRate })
      return null
    }

    return (amount / fromRate) * toRate
  }
}

// Export singleton instance
export const exchangeRateCache = new ExchangeRateCache()

export default exchangeRateCache
