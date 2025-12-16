import { supabase } from './supabaseClient'

/**
 * Fetch cryptocurrency exchange rate from Supabase database
 * Returns the rate of fromCurrency -> toCurrency
 */
export async function getCryptoRateFromDb(fromCurrency, toCurrency = 'USD') {
  try {
    const { data, error } = await supabase
      .from('cryptocurrency_rates')
      .select('rate')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .single()

    if (error) {
      console.warn(`Failed to fetch ${fromCurrency}/${toCurrency} rate:`, error.message)
      return null
    }

    return data?.rate ? parseFloat(data.rate) : null
  } catch (error) {
    console.warn(`Error fetching crypto rate for ${fromCurrency}/${toCurrency}:`, error.message)
    return null
  }
}

/**
 * Convert fiat currency to cryptocurrency using database rates
 * Assumes rates in DB are: crypto_to_usd
 * So: amount_php / (usd_rate * crypto_to_usd) = crypto_amount
 */
export async function convertFiatToCryptoDb(fiatAmount, fiatCurrency, cryptoCode) {
  try {
    // First convert fiat to USD
    let usdAmount = fiatAmount
    if (fiatCurrency !== 'USD') {
      const fiatRate = await getFiatRateFromDb(fiatCurrency, 'USD')
      if (!fiatRate) {
        console.warn(`Could not get ${fiatCurrency}/USD rate`)
        return null
      }
      usdAmount = fiatAmount * fiatRate
    }

    // Then get crypto/USD rate and convert
    const cryptoRate = await getCryptoRateFromDb(cryptoCode, 'USD')
    if (!cryptoRate) {
      console.warn(`Could not get ${cryptoCode}/USD rate`)
      return null
    }

    return usdAmount / cryptoRate
  } catch (error) {
    console.warn(`Error converting ${fiatCurrency} to ${cryptoCode}:`, error.message)
    return null
  }
}

/**
 * Fetch fiat currency exchange rate from Supabase database
 */
export async function getFiatRateFromDb(fromCurrency, toCurrency = 'USD') {
  try {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('rate')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .single()

    if (error) {
      console.warn(`Failed to fetch ${fromCurrency}/${toCurrency} fiat rate:`, error.message)
      return null
    }

    return data?.rate ? parseFloat(data.rate) : null
  } catch (error) {
    console.warn(`Error fetching fiat rate for ${fromCurrency}/${toCurrency}:`, error.message)
    return null
  }
}

/**
 * Get all cryptocurrency rates from database
 */
export async function getAllCryptoRates() {
  try {
    const { data, error } = await supabase
      .from('cryptocurrency_rates')
      .select('from_currency, to_currency, rate, updated_at')
      .order('updated_at', { ascending: false })

    if (error) {
      console.warn('Failed to fetch crypto rates:', error.message)
      return []
    }

    return data || []
  } catch (error) {
    console.warn('Error fetching all crypto rates:', error.message)
    return []
  }
}

/**
 * Get specific crypto rate with timestamp
 */
export async function getCryptoRateWithTimestamp(fromCurrency, toCurrency = 'USD') {
  try {
    const { data, error } = await supabase
      .from('cryptocurrency_rates')
      .select('rate, updated_at')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .single()

    if (error) {
      console.warn(`Failed to fetch ${fromCurrency}/${toCurrency} rate with timestamp:`, error.message)
      return null
    }

    return data
  } catch (error) {
    console.warn(`Error fetching crypto rate for ${fromCurrency}/${toCurrency}:`, error.message)
    return null
  }
}

export default {
  getCryptoRateFromDb,
  convertFiatToCryptoDb,
  getFiatRateFromDb,
  getAllCryptoRates,
  getCryptoRateWithTimestamp
}
