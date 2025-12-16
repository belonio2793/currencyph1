/**
 * Centralized API Response Cache Layer
 * Provides memoization for expensive API calls with TTL and invalidation
 */

class APICache {
  constructor() {
    this.cache = new Map()
    this.timers = new Map()
    this.defaults = {
      exchangeRate: 5 * 60 * 1000, // 5 minutes
      walletData: 2 * 60 * 1000, // 2 minutes
      userProfile: 10 * 60 * 1000, // 10 minutes
      rates: 15 * 60 * 1000, // 15 minutes
    }
  }

  /**
   * Generate cache key from parameters
   */
  generateKey(namespace, ...params) {
    return `${namespace}:${params.join(':')}`
  }

  /**
   * Get value from cache
   */
  get(key) {
    return this.cache.get(key)
  }

  /**
   * Set value in cache with TTL
   */
  set(key, value, ttl = this.defaults.walletData) {
    this.cache.set(key, value)

    // Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key))
    }

    // Set new timer to invalidate after TTL
    const timer = setTimeout(() => {
      this.cache.delete(key)
      this.timers.delete(key)
    }, ttl)

    this.timers.set(key, timer)
  }

  /**
   * Check if key exists in cache
   */
  has(key) {
    return this.cache.has(key)
  }

  /**
   * Invalidate specific cache key
   */
  invalidate(key) {
    this.cache.delete(key)
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key))
      this.timers.delete(key)
    }
  }

  /**
   * Invalidate multiple keys by pattern
   */
  invalidatePattern(pattern) {
    const regex = new RegExp(pattern)
    for (const [key] of this.cache.entries()) {
      if (regex.test(key)) {
        this.invalidate(key)
      }
    }
  }

  /**
   * Clear all cache
   */
  clear() {
    for (const [, timer] of this.timers.entries()) {
      clearTimeout(timer)
    }
    this.cache.clear()
    this.timers.clear()
  }

  /**
   * Memoized exchange rate fetch
   */
  async getExchangeRate(currencyAPI, fromCurrency, toCurrency, ttl = this.defaults.exchangeRate) {
    const key = this.generateKey('exchangeRate', fromCurrency, toCurrency)

    if (this.has(key)) {
      return this.get(key)
    }

    try {
      const rate = await currencyAPI.getExchangeRate(fromCurrency, toCurrency)
      this.set(key, rate, ttl)
      return rate
    } catch (error) {
      console.error(`Failed to fetch exchange rate ${fromCurrency}->${toCurrency}`, error)
      throw error
    }
  }

  /**
   * Batch fetch exchange rates with caching
   */
  async getExchangeRates(currencyAPI, fromCurrency, toCurrencies, ttl = this.defaults.exchangeRate) {
    const rates = {}
    const uncachedCurrencies = []

    // Check cache first
    for (const toCurrency of toCurrencies) {
      const key = this.generateKey('exchangeRate', fromCurrency, toCurrency)
      if (this.has(key)) {
        rates[toCurrency] = this.get(key)
      } else {
        uncachedCurrencies.push(toCurrency)
      }
    }

    // Fetch uncached rates in parallel
    if (uncachedCurrencies.length > 0) {
      const results = await Promise.all(
        uncachedCurrencies.map(toCurrency =>
          currencyAPI.getExchangeRate(fromCurrency, toCurrency)
            .then(rate => {
              const key = this.generateKey('exchangeRate', fromCurrency, toCurrency)
              this.set(key, rate, ttl)
              rates[toCurrency] = rate
            })
            .catch(error => {
              console.error(`Failed to fetch rate for ${toCurrency}`, error)
              rates[toCurrency] = null
            })
        )
      )
    }

    return rates
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }
}

export const apiCache = new APICache()
