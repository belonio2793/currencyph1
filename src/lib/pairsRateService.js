import { supabase } from './supabaseClient'

/**
 * SECURITY FIX: Proper rate inversion using mathematical principle: 1/rate
 *
 * If you have: 1 BTC = 0.000004173217677177161 ADA
 * Then: 1 ADA = 1 / 0.000004173217677177161 = 239,634.19 BTC (NOT 0.000004...)
 *
 * PRINCIPLE: A→B = r, then B→A = 1/r (this is the ONLY correct mathematical inversion)
 */

/**
 * Fetch exchange rate directly from public.pairs table
 * Uses safe inversion: if direct pair not found, calculates 1/rate from opposite direction
 * All pairs are normalized in database (canonical direction), inverses are calculated at runtime
 */
export async function getPairRate(fromCurrency, toCurrency) {
  if (!fromCurrency || !toCurrency) return null
  if (fromCurrency === toCurrency) return 1

  const from = fromCurrency.toUpperCase()
  const to = toCurrency.toUpperCase()

  try {
    // Strategy 1: Try direct pair in any direction
    const { data: directData, error: directError } = await supabase
      .from('pairs')
      .select('rate, updated_at, pair_direction, from_currency, to_currency')
      .eq('from_currency', from)
      .eq('to_currency', to)
      .maybeSingle()

    if (!directError && directData && typeof directData.rate === 'number' && isFinite(directData.rate) && directData.rate > 0) {
      console.debug(`[PairsRate] Found direct pair: ${from}→${to} = ${directData.rate}`)
      return directData.rate
    }

    // Strategy 2: Try reverse pair and invert using proper mathematical formula: 1/rate
    const { data: reverseData, error: reverseError } = await supabase
      .from('pairs')
      .select('rate, updated_at, pair_direction, from_currency, to_currency')
      .eq('from_currency', to)
      .eq('to_currency', from)
      .maybeSingle()

    if (!reverseError && reverseData && typeof reverseData.rate === 'number' && isFinite(reverseData.rate) && reverseData.rate > 0) {
      // CRITICAL: Use mathematical inversion formula: 1/rate
      const invertedRate = 1 / reverseData.rate
      if (isFinite(invertedRate) && invertedRate > 0) {
        console.debug(`[PairsRate] Found reverse pair (${to}→${from} = ${reverseData.rate}). Calculating inverse: 1/${reverseData.rate} = ${invertedRate}`)
        return invertedRate
      }
    }

    // Strategy 3: Use RPC function for safe fallback (database-level inversion)
    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_exchange_rate_safe', {
          p_from_currency: from,
          p_to_currency: to
        })

      if (!rpcError && rpcData && rpcData.length > 0) {
        const rate = parseFloat(rpcData[0].rate)
        const isInverted = rpcData[0].is_inverted
        if (isFinite(rate) && rate > 0) {
          console.debug(`[PairsRate] Using RPC safe function: ${from}→${to} = ${rate} (inverted: ${isInverted})`)
          return rate
        }
      }
    } catch (rpcErr) {
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
 * Uses proper mathematical inversion: 1/rate when needed
 * Includes quality scoring and freshness information
 */
export async function getPairRateWithMetadata(fromCurrency, toCurrency) {
  if (!fromCurrency || !toCurrency) return null
  if (fromCurrency === toCurrency) return {
    rate: 1,
    updated_at: new Date().toISOString(),
    source: 'identity',
    pair_direction: 'canonical',
    is_inverted: false,
    quality_score: 1.0
  }

  const from = fromCurrency.toUpperCase()
  const to = toCurrency.toUpperCase()

  try {
    // Strategy 1: Try direct pair (any direction)
    const { data: directData, error: directError } = await supabase
      .from('pairs')
      .select('rate, updated_at, source_table, pair_direction, is_inverted')
      .eq('from_currency', from)
      .eq('to_currency', to)
      .maybeSingle()

    if (!directError && directData && typeof directData.rate === 'number' && isFinite(directData.rate) && directData.rate > 0) {
      return {
        rate: directData.rate,
        updated_at: directData.updated_at,
        source: directData.source_table || 'cryptocurrency_rates',
        pair_direction: directData.pair_direction || 'canonical',
        is_inverted: directData.is_inverted === true,
        quality_score: 1.0
      }
    }

    // Strategy 2: Try reverse pair and calculate inverse using 1/rate
    const { data: reverseData, error: reverseError } = await supabase
      .from('pairs')
      .select('rate, updated_at, source_table, pair_direction, is_inverted')
      .eq('from_currency', to)
      .eq('to_currency', from)
      .maybeSingle()

    if (!reverseError && reverseData && typeof reverseData.rate === 'number' && isFinite(reverseData.rate) && reverseData.rate > 0) {
      // CRITICAL: Mathematical inversion: if from=Y, to=X, rate=r, then from=X, to=Y, rate=1/r
      const invertedRate = 1 / reverseData.rate
      if (isFinite(invertedRate) && invertedRate > 0) {
        return {
          rate: invertedRate,
          updated_at: reverseData.updated_at,
          source: reverseData.source_table || 'cryptocurrency_rates',
          pair_direction: 'calculated_inverse',  // Explicitly mark as calculated
          is_inverted: true,
          quality_score: 0.95  // Slightly lower confidence for calculated inverses
        }
      }
    }

    // Strategy 3: Use RPC function
    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_exchange_rate_safe', {
          p_from_currency: from,
          p_to_currency: to
        })

      if (!rpcError && rpcData && rpcData.length > 0) {
        const rate = parseFloat(rpcData[0].rate)
        const isInverted = rpcData[0].is_inverted
        if (isFinite(rate) && rate > 0) {
          return {
            rate,
            updated_at: rpcData[0].updated_at,
            source: rpcData[0].source_table || 'cryptocurrency_rates',
            pair_direction: isInverted ? 'calculated_inverse' : 'canonical',
            is_inverted: isInverted,
            quality_score: parseFloat(rpcData[0].quality_score || 0.8)
          }
        }
      }
    } catch (rpcErr) {
      console.debug(`[PairsRate] RPC function not available:`, rpcErr?.message)
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
