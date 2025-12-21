/**
 * Cryptocurrency rates service using CoinGecko API
 * CoinGecko is free, reliable, and doesn't require authentication
 */

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
 * Cache for exchange rates with expiry
 * Format: { rate, timestamp }
 */
const rateCache = new Map()
const CACHE_DURATION = 60000 // 1 minute

/**
 * Get the CoinGecko ID for a cryptocurrency
 */
function getCoingeckoId(cryptoCode) {
  return coingeckoIds[cryptoCode] || cryptoCode.toLowerCase()
}

/**
 * Check if cache is still valid
 */
function isCacheValid(key) {
  const cached = rateCache.get(key)
  if (!cached) return false
  return Date.now() - cached.timestamp < CACHE_DURATION
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
