export const currencySymbols = {
  PHP: '₱',
  USD: '$',
  EUR: '€',
  GBP: '£'
}

// Common fiat currencies
const fiatCurrencies = ['PHP', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'AUD', 'CAD', 'SGD', 'HKD', 'NZD', 'MYR', 'THB', 'IDR', 'VND', 'KRW']

export function getCurrencySymbol(code) {
  return currencySymbols[code] || ''
}

export function isFiatCurrency(code) {
  return fiatCurrencies.includes(code?.toUpperCase())
}

export function isCryptoCurrency(code) {
  return !isFiatCurrency(code) && code?.length > 0
}

export function formatNumber(amount, currency = null) {
  if (amount == null || isNaN(amount)) return '0.00'
  const isCrypto = currency && isCryptoCurrency(currency)
  return Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: isCrypto ? 8 : 2 })
}

// Format conversion rates intelligently based on magnitude
export function formatExchangeRate(rate) {
  if (rate == null || isNaN(rate)) return '0'

  const numRate = Number(rate)

  // For very large numbers (e.g., BTC to PHP: 5,179,990.02), show 2 decimals max
  if (numRate >= 100) {
    return numRate.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  // For numbers >= 1 (e.g., EUR to PHP: 62.50), show 2-4 decimals
  if (numRate >= 1) {
    return numRate.toLocaleString(undefined, { maximumFractionDigits: 4 })
  }

  // For very small numbers (e.g., PHP to BTC: 0.00000019), use full precision
  // Convert to string and ensure we show enough decimals
  const str = numRate.toFixed(10).replace(/0+$/, '')
  return str
}

export function formatCurrency(amount, code) {
  const symbol = getCurrencySymbol(code)
  return `${symbol}${formatNumber(amount, code)}`
}

export function formatPhp(amount) {
  return formatCurrency(amount, 'PHP')
}

export function formatUsd(amount) {
  return formatCurrency(amount, 'USD')
}

/**
 * Convert amount from one currency to another using exchange rates
 * Exchange rates should be normalized to a common base (e.g., all rates in PHP)
 *
 * @param {number} amount - The amount to convert
 * @param {string} fromCurrency - Source currency code (e.g., 'BTC')
 * @param {string} toCurrency - Destination currency code (e.g., 'PHP')
 * @param {object} exchangeRates - Object with rates (e.g., { 'BTC': 2500000, 'PHP': 1, 'USD': 58 })
 * @returns {number|null} - Converted amount or null if rates are unavailable
 */
export function convertCurrency(amount, fromCurrency, toCurrency, exchangeRates) {
  // Handle null/undefined
  if (amount == null || !fromCurrency || !toCurrency || !exchangeRates) {
    return null
  }

  const numAmount = parseFloat(amount)
  if (isNaN(numAmount) || numAmount < 0) return null

  // Same currency, no conversion needed
  if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
    return numAmount
  }

  // Get rates (try both cases)
  const fromUpper = fromCurrency.toUpperCase()
  const toUpper = toCurrency.toUpperCase()
  const fromRate = exchangeRates[fromUpper] || exchangeRates[fromCurrency]
  const toRate = exchangeRates[toUpper] || exchangeRates[toCurrency]

  // Both rates must be available and valid
  if (!fromRate || !toRate || !isFinite(fromRate) || !isFinite(toRate) || fromRate <= 0 || toRate <= 0) {
    return null
  }

  // Convert using the canonical formula: (amount * fromRate) / toRate
  // This works when both rates are normalized to the same base
  const converted = (numAmount * fromRate) / toRate

  // Return with appropriate decimal places
  const isTargetCrypto = isCryptoCurrency(toCurrency)
  const decimals = isTargetCrypto ? 8 : 2
  return Math.round(converted * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

/**
 * Format a converted amount with the target currency
 * @param {number} amount - The converted amount
 * @param {string} currency - Target currency code
 * @param {string} label - Optional label to display before amount
 * @returns {string} - Formatted string
 */
export function formatConvertedAmount(amount, currency, label = '') {
  if (amount == null) return ''

  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: isCryptoCurrency(currency) ? 2 : 2,
    maximumFractionDigits: isCryptoCurrency(currency) ? 8 : 2
  })

  return label ? `${label} ${formatted} ${currency}` : `${formatted} ${currency}`
}
