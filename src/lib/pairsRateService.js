import { supabase } from './supabaseClient'

/**
 * Fetch exchange rate directly from public.pairs table
 * All rates (fiat and crypto) are stored in this unified table
 */
export async function getPairRate(fromCurrency, toCurrency) {
  if (!fromCurrency || !toCurrency) return null
  if (fromCurrency === toCurrency) return 1

  try {
    const { data, error } = await supabase
      .from('pairs')
      .select('rate, updated_at')
      .eq('from_currency', fromCurrency.toUpperCase())
      .eq('to_currency', toCurrency.toUpperCase())
      .single()

    if (error) {
      console.warn(`Rate not found for ${fromCurrency}/${toCurrency}:`, error.message)
      return null
    }

    if (data && typeof data.rate === 'number' && isFinite(data.rate) && data.rate > 0) {
      return data.rate
    }

    console.warn(`Invalid rate value for ${fromCurrency}/${toCurrency}:`, data?.rate)
    return null
  } catch (err) {
    console.warn(`Error fetching rate for ${fromCurrency}/${toCurrency}:`, err.message)
    return null
  }
}

/**
 * Fetch exchange rate with metadata (includes updated_at)
 */
export async function getPairRateWithMetadata(fromCurrency, toCurrency) {
  if (!fromCurrency || !toCurrency) return null
  if (fromCurrency === toCurrency) return { rate: 1, updated_at: new Date().toISOString() }

  try {
    const { data, error } = await supabase
      .from('pairs')
      .select('rate, updated_at, source_table')
      .eq('from_currency', fromCurrency.toUpperCase())
      .eq('to_currency', toCurrency.toUpperCase())
      .single()

    if (error) {
      console.warn(`Rate metadata not found for ${fromCurrency}/${toCurrency}:`, error.message)
      return null
    }

    if (data && typeof data.rate === 'number' && isFinite(data.rate) && data.rate > 0) {
      return {
        rate: data.rate,
        updated_at: data.updated_at,
        source: data.source_table
      }
    }

    console.warn(`Invalid rate value for ${fromCurrency}/${toCurrency}:`, data?.rate)
    return null
  } catch (err) {
    console.warn(`Error fetching rate metadata for ${fromCurrency}/${toCurrency}:`, err.message)
    return null
  }
}

/**
 * Get all currency pairs for a specific currency
 * Useful for listing all available conversion targets
 */
export async function getPairsByCurrency(currency) {
  if (!currency) return []

  try {
    const currencyCode = currency.toUpperCase()
    const { data, error } = await supabase
      .from('pairs')
      .select('from_currency, to_currency, rate, updated_at')
      .eq('from_currency', currencyCode)
      .order('to_currency')

    if (error) {
      console.warn(`Error fetching pairs for ${currency}:`, error.message)
      return []
    }

    return data || []
  } catch (err) {
    console.warn(`Error fetching pairs for ${currency}:`, err.message)
    return []
  }
}

/**
 * Check if a currency pair exists in the pairs table
 */
export async function hasPair(fromCurrency, toCurrency) {
  if (!fromCurrency || !toCurrency) return false
  if (fromCurrency === toCurrency) return true

  try {
    const { data, error } = await supabase
      .from('pairs')
      .select('id')
      .eq('from_currency', fromCurrency.toUpperCase())
      .eq('to_currency', toCurrency.toUpperCase())
      .maybeSingle()

    if (error) return false
    return !!data
  } catch (err) {
    console.warn(`Error checking pair ${fromCurrency}/${toCurrency}:`, err.message)
    return false
  }
}

export default {
  getPairRate,
  getPairRateWithMetadata,
  getPairsByCurrency,
  hasPair
}
