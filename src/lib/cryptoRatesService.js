/**
 * Cryptocurrency rates service with multiple fallback strategies
 * - Primary: CoinGecko API
 * - Fallback 1: Database cached rates
 * - Fallback 2: Alternative API (when available)
 * - Fallback 3: Return cached/stale data or null
 */

import { supabase } from './supabaseClient'

/**
 * Map cryptocurrency codes to CoinGecko IDs
 * Includes all 30 cryptocurrencies from /deposits
 */
const coingeckoIds = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'USDT': 'tether',
  'BNB': 'binancecoin',
  'XRP': 'ripple',
  'USDC': 'usd-coin',
  'SOL': 'solana',
  'TRX': 'tron',
  'DOGE': 'dogecoin',
  'ADA': 'cardano',
  'BCH': 'bitcoin-cash',
  'LINK': 'chainlink',
  'XLM': 'stellar',
  'HYPE': 'hyperliquid',
  'LTC': 'litecoin',
  'SUI': 'sui',
  'AVAX': 'avalanche-2',
  'HBAR': 'hedera-hashgraph',
  'SHIB': 'shiba-inu',
  'PYUSD': 'paypal-usd',
  'WLD': 'world-coin',
  'TON': 'the-open-network',
  'UNI': 'uniswap',
  'DOT': 'polkadot',
  'AAVE': 'aave',
  'XAUT': 'tether-gold',
  'PEPE': 'pepe',
  'ASTER': 'asterzk',
  'ENA': 'ethena',
  'SKY': 'sky'
}

/**
 * In-memory cache for exchange rates with expiry
 * Format: { rate, timestamp, source }
 */
const rateCache = new Map()
const CACHE_DURATION = 60000 // 1 minute
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 500 // Initial delay, increases exponentially

/**
 * Get the CoinGecko ID for a cryptocurrency
 */
function getCoingeckoId(cryptoCode) {
  return coingeckoIds[cryptoCode] || cryptoCode.toLowerCase()
}

/**
 * Check if in-memory cache is still valid
 */
function isCacheValid(key) {
  const cached = rateCache.get(key)
  if (!cached) return false
  return Date.now() - cached.timestamp < CACHE_DURATION
}

/**
 * Retry logic with exponential backoff
 */
async function fetchWithRetry(url, options = {}, maxRetries = MAX_RETRIES) {
  let lastError

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Fetch timeout')), 10000)
        )
      ])

      if (response.ok) {
        return response
      }

      // Don't retry on 4xx client errors
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error: ${response.status}`)
      }

      lastError = new Error(`HTTP ${response.status}`)
    } catch (err) {
      lastError = err

      if (attempt < maxRetries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

/**
 * Get cached rate from database
 * Strategy: pairs_canonical → pairs (canonical preference) → crypto_rates_valid
 */
async function getCachedRateFromDatabase(cryptoCode, toCurrency = 'PHP') {
  try {
    const cryptoUpper = cryptoCode.toUpperCase()
    const toUpper = toCurrency.toUpperCase()

    // Strategy 1: Try pairs_canonical view first (canonical direction preferred)
    try {
      const { data: canonicalData, error: canonicalError } = await supabase
        .from('pairs_canonical')
        .select('rate, source_table, updated_at')
        .eq('from_currency', cryptoUpper)
        .eq('to_currency', toUpper)
        .maybeSingle()

      if (!canonicalError && canonicalData && typeof canonicalData.rate === 'number' && isFinite(canonicalData.rate) && canonicalData.rate > 0) {
        console.debug(`[CryptoRates] Found canonical rate from pairs_canonical: ${cryptoCode}/${toCurrency}`)
        return { rate: parseFloat(canonicalData.rate), source: 'pairs_canonical', cachedAt: canonicalData.updated_at }
      }
    } catch (err) {
      console.debug(`[CryptoRates] pairs_canonical not available:`, err.message)
    }

    // Strategy 2: Try full pairs table with direction metadata
    const { data: pairData, error: pairError } = await supabase
      .from('pairs')
      .select('rate, updated_at, pair_direction')
      .eq('from_currency', cryptoUpper)
      .eq('to_currency', toUpper)
      .maybeSingle()

    if (!pairError && pairData && typeof pairData.rate === 'number' && isFinite(pairData.rate) && pairData.rate > 0) {
      console.debug(`[CryptoRates] Found ${pairData.pair_direction || 'unknown'} rate from pairs: ${cryptoCode}/${toCurrency}`)
      return { rate: parseFloat(pairData.rate), source: 'pairs', cachedAt: pairData.updated_at, direction: pairData.pair_direction }
    }

    // Strategy 3: Fallback to crypto_rates_valid view (non-expired rates with metadata)
    const { data: cryptoData, error: cryptoError } = await supabase
      .from('crypto_rates_valid')
      .select('rate, source, updated_at')
      .eq('from_currency', cryptoUpper)
      .eq('to_currency', toUpper)
      .maybeSingle()

    if (!cryptoError && cryptoData) {
      console.debug(`[CryptoRates] Found cached rate from crypto_rates_valid: ${cryptoCode}/${toCurrency}`)
      return { rate: parseFloat(cryptoData.rate), source: 'crypto_rates_valid', cachedAt: cryptoData.updated_at }
    }

    console.debug(`[CryptoRates] No cached rate found in any database source for ${cryptoCode}/${toCurrency}`)
    return null
  } catch (err) {
    console.warn(`[CryptoRates] Failed to fetch cached rate from database:`, err.message)
    return null
  }
}

/**
 * Store rate in database for future use
 * NOTE: This requires service role - currently disabled to avoid RLS issues
 * Rates are stored in-memory cache instead (60 second TTL)
 */
async function storeRateInDatabase(cryptoCode, toCurrency, rate, source) {
  // DISABLED: Database writes for rates disabled due to RLS policies
  // Rates are cached in-memory instead (60 second TTL)
  // If you need persistent caching, use edge functions with service role
  try {
    // Log for monitoring but don't actually write
    console.debug(`[Rates Cache] ${cryptoCode}/${toCurrency}: ${rate} (source: ${source})`)
  } catch (err) {
    console.warn(`Rate storage skipped:`, err.message)
  }
}

/**
 * Get cryptocurrency price in PHP
 * OPTIMIZED: Database ONLY - no external API calls
 * Strategy:
 * 1. Check in-memory cache (60 seconds)
 * 2. Query public.pairs table (direct DB - fastest)
 * 3. Query crypto_rates_valid view (fallback cached)
 * 4. Return null if not found
 */
export async function getCryptoPrice(cryptoCode, toCurrency = 'PHP') {
  try {
    const cacheKey = `${cryptoCode}_${toCurrency}`
    const cryptoCodeUpper = cryptoCode.toUpperCase()
    const toCurrencyUpper = toCurrency.toUpperCase()

    // 1. Check in-memory cache first (60 second TTL)
    if (isCacheValid(cacheKey)) {
      const cached = rateCache.get(cacheKey)
      console.log(`[CryptoRates] ✓ Cache hit for ${cryptoCode}/${toCurrency}: ${cached.rate}`)
      return cached.rate
    }

    // 2. Query public.pairs table directly (PRIMARY SOURCE)
    let price = await getPriceFromPairs(cryptoCodeUpper, toCurrencyUpper)
    if (price) {
      console.log(`[CryptoRates] ✓ Found ${cryptoCode}/${toCurrency} in public.pairs: ${price}`)
      // Cache the result
      rateCache.set(cacheKey, {
        rate: price,
        timestamp: Date.now(),
        source: 'pairs'
      })
      return price
    }

    // 3. Try crypto_rates_valid view as fallback
    const dbCached = await getCachedRateFromDatabase(cryptoCodeUpper, toCurrencyUpper)
    if (dbCached) {
      price = dbCached.rate
      console.log(`[CryptoRates] ✓ Found ${cryptoCode}/${toCurrency} in database cache: ${price}`)
      // Cache the result
      rateCache.set(cacheKey, {
        rate: price,
        timestamp: Date.now(),
        source: 'database'
      })
      return price
    }

    // 4. Not found anywhere - log and return null
    console.warn(`[CryptoRates] ✗ NO RATE FOUND for ${cryptoCode}/${toCurrency} in any database source`)
    console.warn(`[CryptoRates] Please ensure public.pairs table has ${cryptoCodeUpper}→${toCurrencyUpper} pair`)
    return null
  } catch (error) {
    console.error(`[CryptoRates] Error fetching ${cryptoCode}/${toCurrency}:`, error.message)
    return null
  }
}

/**
 * Fetch crypto rate directly from public.pairs table
 */
async function getPriceFromPairs(cryptoCode, toCurrency) {
  try {
    const { data, error } = await supabase
      .from('pairs')
      .select('rate, updated_at')
      .eq('from_currency', cryptoCode)
      .eq('to_currency', toCurrency)
      .single()

    if (error) {
      console.debug(`No pair found in public.pairs for ${cryptoCode}/${toCurrency}`)
      return null
    }

    if (data && typeof data.rate === 'number' && isFinite(data.rate) && data.rate > 0) {
      return data.rate
    }

    console.warn(`Invalid rate from public.pairs for ${cryptoCode}/${toCurrency}:`, data?.rate)
    return null
  } catch (err) {
    console.debug(`Error fetching from public.pairs for ${cryptoCode}/${toCurrency}:`, err.message)
    return null
  }
}

/**
 * Fetch from CoinGecko API with retry logic
 */
async function getCoinGeckoPrice(cryptoCode, toCurrency = 'PHP') {
  try {
    const coingeckoId = getCoingeckoId(cryptoCode)
    const toCurrencyLower = toCurrency.toLowerCase()

    const response = await fetchWithRetry(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=${toCurrencyLower}&precision=8`,
      { headers: { 'Accept': 'application/json' } }
    )

    const data = await response.json()
    const price = data[coingeckoId]?.[toCurrencyLower]

    if (!price) {
      throw new Error(`No price data for ${cryptoCode}/${toCurrency}`)
    }

    console.log(`✓ CoinGecko: ${cryptoCode} = ${price} ${toCurrency}`)
    return price
  } catch (error) {
    console.warn(`CoinGecko API error for ${cryptoCode}:`, error.message)
    return null
  }
}

/**
 * Alternative API fallback - try different source if CoinGecko fails
 * Currently tries CoinMarketCap or other free endpoints
 */
async function getAlternativeCryptoPrice(cryptoCode, toCurrency = 'PHP') {
  try {
    // Alternative 1: Try CoinGecko with different endpoint structure
    // Sometimes the simple/price endpoint fails but others work
    const coingeckoId = getCoingeckoId(cryptoCode)

    const response = await fetchWithRetry(
      `https://api.coingecko.com/api/v3/coins/${coingeckoId}?localization=false&market_data=true`,
      { headers: { 'Accept': 'application/json' } }
    )

    if (response.ok) {
      const data = await response.json()
      const php = data?.market_data?.current_price?.php

      if (php) {
        console.log(`✓ Alternative API (CoinGecko /coins): ${cryptoCode} = ${php} ${toCurrency}`)
        return php
      }
    }

    // Alternative 2: If PHP rate not available, fetch USD and convert
    // This is a fallback when PHP data is unavailable
    if (toCurrency === 'PHP') {
      const usdRate = data?.market_data?.current_price?.usd
      if (usdRate) {
        // Try to get PHP/USD rate
        try {
          const phorate = await convertUSDtoPhp(usdRate)
          if (phorate) {
            console.log(`✓ Alternative API (USD conversion): ${cryptoCode} = ${phorate} ${toCurrency}`)
            return phorate
          }
        } catch (e) {
          console.warn('USD to PHP conversion failed:', e.message)
        }
      }
    }

    return null
  } catch (error) {
    console.warn(`Alternative API error for ${cryptoCode}:`, error.message)
    return null
  }
}

/**
 * Convert USD amount to PHP using exchange rate API
 */
async function convertUSDtoPhp(usdAmount) {
  try {
    const apiKey = import.meta.env.VITE_OPEN_EXCHANGE_RATES_API
    if (!apiKey) return null

    const response = await fetchWithRetry(
      `https://openexchangerates.org/api/latest.json?app_id=${apiKey}&base=USD&symbols=PHP`,
      { headers: { 'Accept': 'application/json' } }
    )

    const data = await response.json()
    const phpRate = data.rates?.PHP

    if (phpRate) {
      return usdAmount * phpRate
    }

    return null
  } catch (error) {
    console.warn('USD to PHP conversion error:', error.message)
    return null
  }
}

/**
 * Get multiple cryptocurrency prices in one request (more efficient)
 */
// Fetch rates from EXCONVERT API directly
async function fetchFromExconvert(cryptoCodes, toCurrency) {
  try {
    const EXCONVERT_KEY = import.meta.env.VITE_EXCONVERT || import.meta.env.EXCONVERT
    if (!EXCONVERT_KEY) {
      console.warn('[cryptoRatesService] EXCONVERT API key not configured')
      return null
    }

    const prices = {}
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(new Error('Request timeout after 8 seconds')), 8000) // 8 second total timeout

    try {
      // Fetch each crypto price from EXCONVERT
      for (const cryptoCode of cryptoCodes) {
        try {
          const url = `https://api.exconvert.com/convert?access_key=${EXCONVERT_KEY}&from=${cryptoCode}&to=${toCurrency}&amount=1`

          const response = await fetch(url, {
            headers: { Accept: 'application/json' },
            signal: controller.signal
          })

          if (!response.ok) {
            console.warn(`[EXCONVERT] Failed for ${cryptoCode}→${toCurrency}: ${response.status}`)
            continue
          }

          const json = await response.json()

          // EXCONVERT returns: { base, amount, result: { [currency]: rate }, ms }
          if (json.result && typeof json.result === 'object') {
            const rateValue = json.result[toCurrency] || Object.values(json.result)[0]
            if (typeof rateValue === 'number' && rateValue > 0) {
              prices[cryptoCode] = rateValue
              console.log(`[EXCONVERT] Got rate for ${cryptoCode}→${toCurrency}: ${rateValue}`)
            }
          }
        } catch (e) {
          // Handle AbortError separately
          if (e.name === 'AbortError') {
            console.warn(`[EXCONVERT] Request aborted for ${cryptoCode}:`, e.message)
          } else {
            console.warn(`[EXCONVERT] Individual request failed for ${cryptoCode}:`, e.message)
          }
          continue
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    } finally {
      clearTimeout(timeoutId)
    }

    return Object.keys(prices).length > 0 ? prices : null
  } catch (error) {
    // Handle AbortError specifically
    if (error.name === 'AbortError') {
      console.warn('[cryptoRatesService] EXCONVERT request aborted:', error.message)
    } else {
      console.error('[cryptoRatesService] EXCONVERT fetch error:', error.message)
    }
    return null
  }
}

// Note: No hardcoded crypto rates - all rates must come from the database

function convertUsdToPhp(usdAmount, exchangeRate) {
  if (!exchangeRate || exchangeRate <= 0) return null
  return usdAmount / exchangeRate
}

/**
 * Get multiple cryptocurrency prices at once
 * OPTIMIZED: Database ONLY - no external API calls
 * Fetches from public.pairs in a single batch query
 */
export async function getMultipleCryptoPrices(cryptoCodes, toCurrency = 'PHP') {
  try {
    const prices = {}
    const toCurrencyUpper = toCurrency.toUpperCase()
    const codesUpper = cryptoCodes.map(c => c.toUpperCase())

    console.log(`[CryptoRates] Fetching ${cryptoCodes.length} crypto prices from public.pairs...`)

    // 1) PRIMARY: Fetch all from public.pairs in one batch query
    try {
      const { data: pairsData, error: pairsError } = await supabase
        .from('pairs')
        .select('from_currency, rate')
        .eq('to_currency', toCurrencyUpper)
        .in('from_currency', codesUpper)

      if (!pairsError && pairsData && pairsData.length > 0) {
        console.log(`[CryptoRates] ✓ Batch query: Got ${pairsData.length}/${cryptoCodes.length} rates from public.pairs`)
        pairsData.forEach(row => {
          if (row.rate && isFinite(row.rate) && row.rate > 0) {
            prices[row.from_currency] = parseFloat(row.rate)
            // Cache the result
            const cacheKey = `${row.from_currency}_${toCurrency}`
            rateCache.set(cacheKey, {
              rate: prices[row.from_currency],
              timestamp: Date.now(),
              source: 'pairs'
            })
          }
        })
      } else if (pairsError) {
        console.warn('[CryptoRates] Pairs table query error:', pairsError.message)
      }
    } catch (pairsErr) {
      console.warn('[CryptoRates] Failed to fetch from pairs table:', pairsErr.message)
    }

    // 2) FALLBACK: Try in-memory cache for any remaining rates
    const missingCodes = cryptoCodes.filter(code => !prices[code])
    if (missingCodes.length > 0) {
      console.log(`[CryptoRates] ${missingCodes.length} rates missing from pairs, checking cache...`)
      missingCodes.forEach(code => {
        const cacheKey = `${code}_${toCurrency}`
        const cached = rateCache.get(cacheKey)
        if (cached && isCacheValid(cacheKey)) {
          prices[code] = cached.rate
          console.debug(`[CryptoRates] Cache hit: ${code}/${toCurrency} = ${cached.rate}`)
        }
      })
    }

    // 3) Report results
    const finalMissing = cryptoCodes.filter(code => !prices[code])
    if (finalMissing.length > 0) {
      console.warn(`[CryptoRates] ⚠️  MISSING RATES: ${finalMissing.join(', ')} not found in public.pairs`)
      console.warn(`[CryptoRates] Please ensure these pairs exist in database: ${finalMissing.map(c => `${c}→${toCurrencyUpper}`).join(', ')}`)
    }

    console.log(`[CryptoRates] Returning ${Object.keys(prices).length}/${cryptoCodes.length} rates`)
    return prices
  } catch (error) {
    console.error('[CryptoRates] Fatal error in getMultipleCryptoPrices:', error.message)
    return {}
  }
}

/**
 * Convert fiat balance to cryptocurrency
 */
export async function convertFiatToCrypto(fiatAmount, fiatCurrency, cryptoCode) {
  try {
    // First get crypto price in PHP
    const cryptoPriceInPHP = await getCryptoPrice(cryptoCode, 'PHP')
    if (!cryptoPriceInPHP) return null

    // Get exchange rate from provided fiat currency to PHP
    const phpAmount = await convertCurrencyToPhp(fiatAmount, fiatCurrency)

    // Convert to crypto
    return phpAmount / cryptoPriceInPHP
  } catch (error) {
    console.warn(`Failed to convert ${fiatCurrency} to ${cryptoCode}:`, error.message)
    return null
  }
}

/**
 * Convert any fiat currency to PHP using Open Exchange Rates (with caching)
 */
async function convertCurrencyToPhp(amount, fromCurrency) {
  if (fromCurrency === 'PHP') return amount

  try {
    const cacheKey = `fiat_${fromCurrency}_PHP`

    // Check in-memory cache
    if (isCacheValid(cacheKey)) {
      const cached = rateCache.get(cacheKey)
      console.log(`Using cached fiat rate: 1 ${fromCurrency} = ${cached.rate} PHP`)
      return amount * cached.rate
    }

    const apiKey = import.meta.env.VITE_OPEN_EXCHANGE_RATES_API
    if (!apiKey) {
      console.warn('Open Exchange Rates API key not configured')
      // Try to get from stale cache
      const stale = rateCache.get(cacheKey)
      return stale ? amount * stale.rate : amount
    }

    const response = await fetchWithRetry(
      `https://openexchangerates.org/api/latest.json?app_id=${apiKey}&base=${fromCurrency}&symbols=PHP`
    )

    const data = await response.json()
    const rate = data.rates?.PHP || 1

    // Cache the result
    rateCache.set(cacheKey, {
      rate: rate,
      timestamp: Date.now(),
      source: 'openexchangerates'
    })

    return amount * rate
  } catch (error) {
    console.warn(`Failed to convert ${fromCurrency} to PHP:`, error.message)
    // Return amount as-is (better than erroring out)
    return amount
  }
}

/**
 * Get cryptocurrency price in any fiat currency
 */
export async function getCryptoPriceInCurrency(cryptoCode, fiatCurrency = 'PHP') {
  try {
    if (fiatCurrency === 'PHP') {
      return await getCryptoPrice(cryptoCode, 'PHP')
    }

    const priceInPHP = await getCryptoPrice(cryptoCode, 'PHP')
    if (!priceInPHP) return null

    // Convert PHP to target currency
    const apiKey = import.meta.env.VITE_OPEN_EXCHANGE_RATES_API
    if (!apiKey) {
      console.warn('Cannot convert to', fiatCurrency, '- API key not configured')
      return priceInPHP // Return PHP price as fallback
    }

    const response = await fetchWithRetry(
      `https://openexchangerates.org/api/latest.json?app_id=${apiKey}&base=PHP&symbols=${fiatCurrency}`
    )

    const data = await response.json()
    const rate = data.rates?.[fiatCurrency] || 1
    return priceInPHP * rate
  } catch (error) {
    console.warn(`Failed to get ${cryptoCode} price in ${fiatCurrency}:`, error.message)
    // Try to get price in PHP as fallback
    return await getCryptoPrice(cryptoCode, 'PHP')
  }
}

/**
 * Clear the rate cache (useful for manual refreshes)
 */
export function clearRateCache() {
  rateCache.clear()
}

export default {
  getCryptoPrice,
  getMultipleCryptoPrices,
  getCryptoPriceInCurrency,
  convertFiatToCrypto,
  clearRateCache
}
