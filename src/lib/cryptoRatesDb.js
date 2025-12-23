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
 * Convert fiat currency to cryptocurrency using public.pairs rates
 */
export async function convertFiatToCryptoDb(fiatAmount, fiatCurrency, cryptoCode) {
  try {
    // First convert fiat to USD
    let usdAmount = fiatAmount
    if (fiatCurrency !== 'USD') {
      const fiatRate = await getCryptoRateFromDb(fiatCurrency, 'USD')
      if (!fiatRate) {
        console.warn(`Could not get ${fiatCurrency}/USD rate`)
        return null
      }
      usdAmount = fiatAmount * fiatRate
    }

    // Then get crypto/USD rate and convert
    const cryptoPrice = await getCryptoRateFromDb(cryptoCode, 'USD')
    if (!cryptoPrice) {
      console.warn(`Could not get ${cryptoCode}/USD price`)
      return null
    }

    return usdAmount / cryptoPrice
  } catch (error) {
    console.warn(`Error converting ${fiatCurrency} to ${cryptoCode}:`, error.message)
    return null
  }
}

/**
 * Fetch fiat currency exchange rate from public.pairs
 */
export async function getFiatRateFromDb(fromCurrency, toCurrency = 'USD') {
  try {
    return await getCryptoRateFromDb(fromCurrency, toCurrency)
  } catch (error) {
    console.warn(`Error fetching fiat rate for ${fromCurrency}/${toCurrency}:`, error.message)
    return null
  }
}

/**
 * Get all currency pairs from public.pairs
 */
export async function getAllCryptoRates() {
  try {
    const { data, error } = await supabase
      .from('pairs')
      .select('from_currency, to_currency, rate, updated_at')

    if (error || !data) {
      console.warn('No rates available from public.pairs')
      return {}
    }

    // Build a lookup structure: { "BTC_USD": 45000, ... }
    const rates = {}
    data.forEach(pair => {
      const key = `${pair.from_currency}_${pair.to_currency}`
      rates[key] = parseFloat(pair.rate)
    })

    return rates
  } catch (error) {
    console.warn('Error fetching all rates:', error.message)
    return {}
  }
}

/**
 * Get specific crypto rate with timestamp
 */
export async function getCryptoRateWithTimestamp(fromCurrency, toCurrency = 'USD') {
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
      console.warn(`Could not get ${fromCurrency}/${toCurrency} rate`)
      return null
    }

    return {
      rate: parseFloat(data.rate),
      updated_at: data.updated_at
    }
  } catch (error) {
    console.warn(`Error fetching crypto rate for ${fromCurrency}/${toCurrency}:`, error.message)
    return null
  }
}

/**
 * Check if rates are fresh (less than 1 hour old)
 */
export async function areCachedRatesFresh() {
  try {
    const { data, error } = await supabase
      .from('pairs')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data?.updated_at) return false

    const updatedTime = new Date(data.updated_at).getTime()
    const now = Date.now()
    const ageMs = now - updatedTime
    const oneHourMs = 60 * 60 * 1000

    return ageMs < oneHourMs
  } catch (error) {
    console.warn('Error checking rate freshness:', error.message)
    return false
  }
}

/**
 * Get the last update time of rates
 */
export async function getCacheLastUpdateTime() {
  try {
    const { data, error } = await supabase
      .from('pairs')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    return data?.updated_at || null
  } catch (error) {
    console.warn('Error getting last update time:', error.message)
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
  getCacheLastUpdateTime
}
