import { supabase } from './supabaseClient'

/**
 * Fetch cryptocurrency exchange rate from public.pairs table
 * Returns the rate of fromCurrency -> toCurrency
 */
export async function getCryptoRateFromDb(fromCurrency, toCurrency = 'USD') {
  try {
    const fromCode = fromCurrency.toUpperCase()
    const toCode = toCurrency.toUpperCase()

    const { data, error } = await supabase
      .from('pairs')
      .select('rate, updated_at')
      .eq('from_currency', fromCode)
      .eq('to_currency', toCode)
      .single()

    if (error || !data || !(typeof data.rate === 'number' && isFinite(data.rate) && data.rate > 0)) {
      console.warn(`No exchange rate found for ${fromCurrency}/${toCurrency}`)
      return null
    }

    return parseFloat(data.rate)
  } catch (error) {
    console.warn(`Error fetching crypto rate for ${fromCurrency}/${toCurrency}:`, error.message)
    return null
  }
}

/**
 * Convert fiat currency to cryptocurrency using cached database rates
 * Assumes rates in DB are: crypto_to_usd
 * So: amount_php / (usd_rate * crypto_to_usd) = crypto_amount
 */
export async function convertFiatToCryptoDb(fiatAmount, fiatCurrency, cryptoCode) {
  try {
    const cached = await getCachedRates()
    if (!cached?.exchange_rates || !cached?.crypto_prices) {
      console.warn('No cached rates available')
      return null
    }

    // First convert fiat to USD
    let usdAmount = fiatAmount
    if (fiatCurrency !== 'USD') {
      const exchangeRates = cached.exchange_rates
      // Open Exchange Rates format: { USD: 1, EUR: 0.85, PHP: 55.1, ... }
      const fiatRate = exchangeRates[fiatCurrency] || exchangeRates[fiatCurrency.toUpperCase()]
      if (!fiatRate) {
        console.warn(`Could not get ${fiatCurrency}/USD rate from cache`)
        return null
      }
      usdAmount = fiatAmount / fiatRate
    }

    // Then get crypto/USD rate and convert
    const cryptoPrice = cached.crypto_prices[cryptoCode.toLowerCase()]?.usd
    if (!cryptoPrice) {
      console.warn(`Could not get ${cryptoCode}/USD price from cache`)
      return null
    }

    return usdAmount / cryptoPrice
  } catch (error) {
    console.warn(`Error converting ${fiatCurrency} to ${cryptoCode}:`, error.message)
    return null
  }
}

/**
 * Fetch fiat currency exchange rate from cached rates
 */
export async function getFiatRateFromDb(fromCurrency, toCurrency = 'USD') {
  try {
    const cached = await getCachedRates()
    if (!cached?.exchange_rates) {
      console.warn('No cached exchange rates available')
      return null
    }

    const exchangeRates = cached.exchange_rates
    // Open Exchange Rates format: rates are relative to USD base
    // If from=PHP and to=USD, return 1/exchangeRates['PHP']
    if (toCurrency === 'USD') {
      const fromRate = exchangeRates[fromCurrency] || exchangeRates[fromCurrency.toUpperCase()]
      if (!fromRate) {
        console.warn(`Could not get ${fromCurrency}/USD rate`)
        return null
      }
      return 1 / fromRate
    }

    // For other pairs, do a cross rate conversion
    const fromRate = exchangeRates[fromCurrency] || exchangeRates[fromCurrency.toUpperCase()]
    const toRate = exchangeRates[toCurrency] || exchangeRates[toCurrency.toUpperCase()]

    if (!fromRate || !toRate) {
      console.warn(`Could not get ${fromCurrency}/${toCurrency} rate`)
      return null
    }

    return fromRate / toRate
  } catch (error) {
    console.warn(`Error fetching fiat rate for ${fromCurrency}/${toCurrency}:`, error.message)
    return null
  }
}

/**
 * Get all cryptocurrency prices from cached database
 */
export async function getAllCryptoRates() {
  try {
    const cached = await getCachedRates()
    if (!cached?.crypto_prices) {
      console.warn('No cached crypto prices available')
      return {}
    }

    return cached.crypto_prices || {}
  } catch (error) {
    console.warn('Error fetching all crypto rates:', error.message)
    return {}
  }
}

/**
 * Get specific crypto rate with timestamp
 */
export async function getCryptoRateWithTimestamp(fromCurrency, toCurrency = 'USD') {
  try {
    const cached = await getCachedRates()
    if (!cached?.crypto_prices) {
      console.warn('No cached crypto prices available')
      return null
    }

    const cryptoPrices = cached.crypto_prices
    const cryptoKey = fromCurrency.toLowerCase()
    const price = cryptoPrices[cryptoKey]?.[toCurrency.toLowerCase()]

    if (!price) {
      console.warn(`Could not get ${fromCurrency}/${toCurrency} price`)
      return null
    }

    return {
      rate: price,
      updated_at: cached.fetched_at
    }
  } catch (error) {
    console.warn(`Error fetching crypto rate for ${fromCurrency}/${toCurrency}:`, error.message)
    return null
  }
}

/**
 * Check if cached rates are fresh (less than 1 hour old)
 */
export async function areCachedRatesFresh() {
  try {
    const cached = await getCachedRates()
    if (!cached?.fetched_at) return false

    const fetchedTime = new Date(cached.fetched_at).getTime()
    const now = Date.now()
    const ageMs = now - fetchedTime
    const oneHourMs = 60 * 60 * 1000

    return ageMs < oneHourMs
  } catch (error) {
    console.warn('Error checking cache freshness:', error.message)
    return false
  }
}

/**
 * Get the last update time of cached rates
 */
export async function getCacheLastUpdateTime() {
  try {
    const cached = await getCachedRates()
    return cached?.fetched_at || null
  } catch (error) {
    console.warn('Error getting cache update time:', error.message)
    return null
  }
}

export default {
  getCryptoRateFromDb,
  convertFiatToCryptoDb,
  getFiatRateFromDb,
  getAllCryptoRates,
  getCryptoRateWithTimestamp,
  areCachedRatesFresh,
  getCacheLastUpdateTime,
  getCachedRates
}
