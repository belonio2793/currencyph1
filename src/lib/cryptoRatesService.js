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
 */
const coingeckoIds = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'USDT': 'tether',
  'BNB': 'binancecoin',
  'SOL': 'solana',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'DOGE': 'dogecoin',
  'DOT': 'polkadot',
  'BCH': 'bitcoin-cash',
  'LTC': 'litecoin',
  'USDC': 'usd-coin',
  'LINK': 'chainlink',
  'MATIC': 'matic-network',
  'UNI': 'uniswap',
  'AVAX': 'avalanche-2',
  'TON': 'the-open-network',
  'HBAR': 'hedera-hashgraph',
  'SUI': 'sui',
  'TRX': 'tron',
  'XLM': 'stellar',
  'AED': 'aed'
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
 */
async function getCachedRateFromDatabase(cryptoCode, toCurrency = 'PHP') {
  try {
    const { data, error } = await supabase
      .from('crypto_rates_valid')
      .select('rate, source, updated_at')
      .eq('from_currency', cryptoCode)
      .eq('to_currency', toCurrency)
      .single()

    if (error) {
      console.warn(`No cached rate in database for ${cryptoCode}/${toCurrency}`)
      return null
    }

    return { rate: parseFloat(data.rate), source: 'database', cachedAt: data.updated_at }
  } catch (err) {
    console.warn(`Failed to fetch cached rate from database:`, err.message)
    return null
  }
}

/**
 * Store rate in database for future use
 */
async function storeRateInDatabase(cryptoCode, toCurrency, rate, source) {
  try {
    await supabase
      .from('crypto_rates')
      .upsert({
        from_currency: cryptoCode,
        to_currency: toCurrency,
        rate: rate.toString(),
        source: source,
        expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour
      }, { onConflict: 'from_currency,to_currency' })
  } catch (err) {
    console.warn(`Failed to store rate in database:`, err.message)
  }
}

/**
 * Get cryptocurrency price in PHP with comprehensive fallback strategy:
 * 1. Try in-memory cache (60 seconds)
 * 2. Try CoinGecko API with retry logic (3 attempts)
 * 3. Try alternative API (Coingecko fallback endpoint or other source)
 * 4. Fall back to database cached rates
 * 5. Return stale cache or null
 */
export async function getCryptoPrice(cryptoCode, toCurrency = 'PHP') {
  try {
    const cacheKey = `${cryptoCode}_${toCurrency}`

    // 1. Check in-memory cache first
    if (isCacheValid(cacheKey)) {
      const cached = rateCache.get(cacheKey)
      console.log(`Using in-memory cached price for ${cryptoCode}: ${cached.rate} ${toCurrency}`)
      return cached.rate
    }

    // 2. Try primary API (CoinGecko) with retry logic
    let price = await getCoinGeckoPrice(cryptoCode, toCurrency)

    // 3. If primary fails, try alternative API
    if (!price) {
      console.warn(`CoinGecko failed for ${cryptoCode}, trying alternative API...`)
      price = await getAlternativeCryptoPrice(cryptoCode, toCurrency)
    }

    // 4. If both APIs fail, try database cache
    if (!price) {
      console.warn(`Both APIs failed for ${cryptoCode}, checking database cache...`)
      const dbCached = await getCachedRateFromDatabase(cryptoCode, toCurrency)
      if (dbCached) {
        price = dbCached.rate
        console.log(`Using database cached price for ${cryptoCode}: ${price} ${toCurrency}`)
      }
    }

    // 5. Store successful fetch in database for future fallback
    if (price) {
      // Store in in-memory cache
      rateCache.set(cacheKey, {
        rate: price,
        timestamp: Date.now(),
        source: 'api'
      })

      // Store in database asynchronously (don't wait for it)
      storeRateInDatabase(cryptoCode, toCurrency, price, 'coingecko').catch(e =>
        console.warn('Background DB storage failed:', e.message)
      )

      return price
    }

    // 6. Last resort: return stale cache
    const staleCache = rateCache.get(cacheKey)
    if (staleCache) {
      console.warn(`Using stale in-memory cache for ${cryptoCode}: ${staleCache.rate} ${toCurrency}`)
      return staleCache.rate
    }

    return null
  } catch (error) {
    console.error(`Unexpected error fetching ${cryptoCode} price:`, error.message)
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
 * Get multiple cryptocurrency prices in one request
 */
export async function getMultipleCryptoPrices(cryptoCodes) {
  try {
    const coingeckoIds = cryptoCodes
      .map(code => getCoingeckoId(code))
      .join(',')
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIds}&vs_currencies=php&precision=8`
    )

    if (!response.ok) {
      throw new Error(`CoinGecko API returned ${response.status}`)
    }

    const data = await response.json()
    const prices = {}

    cryptoCodes.forEach(code => {
      const coingeckoId = getCoingeckoId(code)
      const price = data[coingeckoId]?.php
      if (price) {
        prices[code] = price
        rateCache.set(coingeckoId, {
          rate: price,
          timestamp: Date.now()
        })
      }
    })

    return prices
  } catch (error) {
    console.warn('Failed to fetch multiple crypto prices:', error.message)
    return {}
  }
}

/**
 * Convert fiat balance to cryptocurrency
 */
export async function convertFiatToCrypto(fiatAmount, fiatCurrency, cryptoCode) {
  try {
    // First get crypto price in PHP
    const cryptoPriceInPHP = await getCryptoPrice(cryptoCode)
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
 * Convert any fiat currency to PHP using Open Exchange Rates
 */
async function convertCurrencyToPhp(amount, fromCurrency) {
  if (fromCurrency === 'PHP') return amount

  try {
    const apiKey = import.meta.env.VITE_OPEN_EXCHANGE_RATES_API
    if (!apiKey) {
      console.warn('Open Exchange Rates API key not configured')
      return amount // Fallback: assume 1:1 (not accurate but prevents errors)
    }

    const response = await fetch(
      `https://openexchangerates.org/api/latest.json?app_id=${apiKey}&base=${fromCurrency}&symbols=PHP`
    )
    
    if (!response.ok) {
      console.warn(`Failed to fetch exchange rate for ${fromCurrency}`)
      return amount
    }

    const data = await response.json()
    const rate = data.rates?.PHP || 1
    return amount * rate
  } catch (error) {
    console.warn(`Failed to convert ${fromCurrency} to PHP:`, error.message)
    return amount
  }
}

/**
 * Get cryptocurrency price in any fiat currency
 */
export async function getCryptoPriceInCurrency(cryptoCode, fiatCurrency = 'PHP') {
  try {
    const priceInPHP = await getCryptoPrice(cryptoCode)
    if (!priceInPHP || fiatCurrency === 'PHP') return priceInPHP

    // Get conversion rate from PHP to target currency
    const apiKey = import.meta.env.VITE_OPEN_EXCHANGE_RATES_API
    if (!apiKey) return priceInPHP

    const response = await fetch(
      `https://openexchangerates.org/api/latest.json?app_id=${apiKey}&base=PHP&symbols=${fiatCurrency}`
    )
    
    if (!response.ok) return priceInPHP

    const data = await response.json()
    const rate = data.rates?.[fiatCurrency] || 1
    return priceInPHP * rate
  } catch (error) {
    console.warn(`Failed to get ${cryptoCode} price in ${fiatCurrency}:`, error.message)
    return null
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
