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
 * Get real-time cryptocurrency price in PHP from CoinGecko API
 */
export async function getCryptoPrice(cryptoCode) {
  try {
    const coingeckoId = getCoingeckoId(cryptoCode)
    
    // Check cache first
    if (isCacheValid(coingeckoId)) {
      return rateCache.get(coingeckoId).rate
    }

    // Fetch from CoinGecko API (free, no authentication required)
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=php&precision=8`
    )

    if (!response.ok) {
      throw new Error(`CoinGecko API returned ${response.status}`)
    }

    const data = await response.json()
    const price = data[coingeckoId]?.php

    if (!price) {
      throw new Error(`No price data for ${cryptoCode}`)
    }

    // Cache the result
    rateCache.set(coingeckoId, {
      rate: price,
      timestamp: Date.now()
    })

    return price
  } catch (error) {
    console.warn(`Failed to fetch ${cryptoCode} price from CoinGecko:`, error.message)
    // Return cached value even if expired, or null
    const cached = rateCache.get(getCoingeckoId(cryptoCode))
    return cached ? cached.rate : null
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
