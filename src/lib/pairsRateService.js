import { supabase } from './supabaseClient'

/**
 * Fetch exchange rate directly from public.pairs table
 * Prefers canonical pairs (X→PHP) and falls back to calculated inverses
 * Uses the new pairs_canonical view for optimal query performance
 */
export async function getPairRate(fromCurrency, toCurrency) {
  if (!fromCurrency || !toCurrency) return null
  if (fromCurrency === toCurrency) return 1

  const from = fromCurrency.toUpperCase()
  const to = toCurrency.toUpperCase()

  try {
    // Strategy 1: Try direct canonical pair (preferred)
    const { data: directData, error: directError } = await supabase
      .from('pairs')
      .select('rate, updated_at, pair_direction')
      .eq('from_currency', from)
      .eq('to_currency', to)
      .eq('pair_direction', 'canonical')
      .maybeSingle()

    if (!directError && directData && typeof directData.rate === 'number' && isFinite(directData.rate) && directData.rate > 0) {
      console.debug(`[PairsRate] Found canonical pair: ${from}→${to} = ${directData.rate}`)
      return directData.rate
    }

    // Strategy 2: Try inverse pair (PHP→X)
    const { data: inverseData, error: inverseError } = await supabase
      .from('pairs')
      .select('rate, updated_at, pair_direction')
      .eq('from_currency', to)
      .eq('to_currency', from)
      .eq('pair_direction', 'inverse')
      .maybeSingle()

    if (!inverseError && inverseData && typeof inverseData.rate === 'number' && isFinite(inverseData.rate) && inverseData.rate > 0) {
      const calculatedRate = 1 / inverseData.rate
      if (isFinite(calculatedRate) && calculatedRate > 0) {
        console.debug(`[PairsRate] Using inverse pair calculation: ${from}→${to} = ${calculatedRate} (from ${to}→${from} = ${inverseData.rate})`)
        return calculatedRate
      }
    }

    // Strategy 3: Use RPC function for safe fallback (handles both directions automatically)
    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_exchange_rate', {
          p_from_currency: from,
          p_to_currency: to,
          p_use_canonical_only: false
        })

      if (!rpcError && rpcData && rpcData.length > 0) {
        const rate = parseFloat(rpcData[0].rate)
        if (isFinite(rate) && rate > 0) {
          console.debug(`[PairsRate] Using RPC function: ${from}→${to} = ${rate}`)
          return rate
        }
      }
    } catch (rpcErr) {
      // RPC may not be available, continue with other strategies
      console.debug(`[PairsRate] RPC function not available:`, rpcErr?.message)
    }

    console.warn(`[PairsRate] Rate not found for ${from}/${to} using any strategy`)
    return null
  } catch (err) {
    console.warn(`[PairsRate] Error fetching rate for ${from}/${to}:`, err.message)
    return null
  }
}

/**
 * Fetch exchange rate with metadata (includes updated_at, direction, source)
 * Prefers canonical pairs and includes direction metadata
 */
export async function getPairRateWithMetadata(fromCurrency, toCurrency) {
  if (!fromCurrency || !toCurrency) return null
  if (fromCurrency === toCurrency) return {
    rate: 1,
    updated_at: new Date().toISOString(),
    source: 'identity',
    pair_direction: 'canonical',
    is_inverted: false
  }

  const from = fromCurrency.toUpperCase()
  const to = toCurrency.toUpperCase()

  try {
    // Strategy 1: Try direct canonical pair (preferred)
    const { data: directData, error: directError } = await supabase
      .from('pairs')
      .select('rate, updated_at, source_table, pair_direction, is_inverted')
      .eq('from_currency', from)
      .eq('to_currency', to)
      .eq('pair_direction', 'canonical')
      .maybeSingle()

    if (!directError && directData && typeof directData.rate === 'number' && isFinite(directData.rate) && directData.rate > 0) {
      return {
        rate: directData.rate,
        updated_at: directData.updated_at,
        source: directData.source_table || 'currency_rates',
        pair_direction: 'canonical',
        is_inverted: false
      }
    }

    // Strategy 2: Try inverse pair (PHP→X)
    const { data: inverseData, error: inverseError } = await supabase
      .from('pairs')
      .select('rate, updated_at, source_table, pair_direction, is_inverted')
      .eq('from_currency', to)
      .eq('to_currency', from)
      .eq('pair_direction', 'inverse')
      .maybeSingle()

    if (!inverseError && inverseData && typeof inverseData.rate === 'number' && isFinite(inverseData.rate) && inverseData.rate > 0) {
      const calculatedRate = 1 / inverseData.rate
      if (isFinite(calculatedRate) && calculatedRate > 0) {
        return {
          rate: calculatedRate,
          updated_at: inverseData.updated_at,
          source: inverseData.source_table || 'currency_rates',
          pair_direction: 'calculated_inverse',
          is_inverted: true
        }
      }
    }

    console.warn(`[PairsRate] Rate metadata not found for ${from}/${to}`)
    return null
  } catch (err) {
    console.warn(`[PairsRate] Error fetching rate metadata for ${from}/${to}:`, err.message)
    return null
  }
}

/**
 * Get all currency pairs for a specific currency
 * Prefers canonical pairs, but includes bidirectional pairs for flexibility
 */
export async function getPairsByCurrency(currency) {
  if (!currency) return []

  const currencyCode = currency.toUpperCase()

  try {
    // Get pairs where this currency is the FROM currency (canonical direction)
    const { data: canonicalData, error: canonicalError } = await supabase
      .from('pairs_canonical')
      .select('from_currency, to_currency, rate, updated_at, pair_direction')
      .eq('from_currency', currencyCode)
      .order('to_currency')

    if (!canonicalError && canonicalData && canonicalData.length > 0) {
      console.debug(`[PairsRate] Found ${canonicalData.length} canonical pairs for ${currencyCode}`)
      return canonicalData
    }

    // Fallback: Get from bidirectional view (includes both directions)
    const { data: bidirectionalData, error: bidirectionalError } = await supabase
      .from('pairs_bidirectional')
      .select('from_currency, to_currency, rate, updated_at, pair_direction, is_inverted')
      .eq('from_currency', currencyCode)
      .order('to_currency')

    if (!bidirectionalError && bidirectionalData) {
      console.debug(`[PairsRate] Found ${bidirectionalData.length} bidirectional pairs for ${currencyCode}`)
      return bidirectionalData
    }

    console.warn(`[PairsRate] Error fetching pairs for ${currency}:`, bidirectionalError?.message)
    return []
  } catch (err) {
    console.warn(`[PairsRate] Error fetching pairs for ${currency}:`, err.message)
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
