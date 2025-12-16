import { coinsPhApi } from './coinsPhApi'

/**
 * Map cryptocurrency codes to coins.ph trading symbols
 * coins.ph uses symbols like BTCPHP, ETHPHP, etc.
 */
const cryptoSymbols = {
  'BTC': 'BTCPHP',
  'ETH': 'ETHPHP',
  'USDT': 'USDTPHP',
  'BNB': 'BNBPHP',
  'SOL': 'SOLPHP',
  'XRP': 'XRPPHP',
  'ADA': 'ADAPHP',
  'DOGE': 'DOGEPHP',
  'DOT': 'DOTPHP',
  'BCH': 'BCPHP',
  'LTC': 'LTCPHP',
  'USDC': 'USDCPHP',
  'LINK': 'LINKPHP',
  'MATIC': 'MATICPHP',
  'UNI': 'UNIPHP'
}

/**
 * Cache for exchange rates with expiry
 * Format: { rate, timestamp }
 */
const rateCache = new Map()
const CACHE_DURATION = 60000 // 1 minute

/**
 * Get the trading symbol for a cryptocurrency
 */
function getSymbol(cryptoCode) {
  return cryptoSymbols[cryptoCode] || `${cryptoCode}PHP`
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
 * Get real-time cryptocurrency price in PHP from coins.ph API
 */
export async function getCryptoPrice(cryptoCode) {
  try {
    const symbol = getSymbol(cryptoCode)
    
    // Check cache first
    if (isCacheValid(symbol)) {
      return rateCache.get(symbol).rate
    }

    // Fetch from API
    const response = await coinsPhApi.getPrice(symbol)
    const price = parseFloat(response.price)

    // Cache the result
    rateCache.set(symbol, {
      rate: price,
      timestamp: Date.now()
    })

    return price
  } catch (error) {
    console.warn(`Failed to fetch ${cryptoCode} price:`, error.message)
    // Return cached value even if expired, or null
    const cached = rateCache.get(getSymbol(cryptoCode))
    return cached ? cached.rate : null
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
  getCryptoPriceInCurrency,
  convertFiatToCrypto,
  clearRateCache
}
