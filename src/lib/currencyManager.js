// Currency conversion rates (1 USD = X in other currencies)
// These should ideally be fetched from a rates API, but using static for now
const EXCHANGE_RATES = {
  'USD': 1.0,
  'PHP': 56.5,
  'EUR': 0.92,
  'GBP': 0.79,
  'JPY': 149.5,
  'CAD': 1.36,
  'AUD': 1.52,
  'INR': 83.2
}

const CURRENCY_SYMBOLS = {
  'USD': '$',
  'PHP': '₱',
  'EUR': '€',
  'GBP': '£',
  'JPY': '¥',
  'CAD': 'C$',
  'AUD': 'A$',
  'INR': '₹'
}

// Get symbol for currency code
export function getCurrencySymbol(currencyCode) {
  return CURRENCY_SYMBOLS[currencyCode?.toUpperCase()] || '$'
}

// Convert USD price to another currency
export function convertUSDToLocalCurrency(usdPrice, targetCurrency) {
  const rate = EXCHANGE_RATES[targetCurrency?.toUpperCase()] || 1
  return usdPrice * rate
}

// Format price with currency symbol
export function formatPriceWithCurrency(price, currencyCode) {
  const symbol = getCurrencySymbol(currencyCode)
  const formatted = parseFloat(price).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  
  // Different currencies format differently
  if (currencyCode?.toUpperCase() === 'PHP' || currencyCode?.toUpperCase() === 'EUR') {
    return `${symbol}${formatted}`
  }
  return `${symbol}${formatted}`
}

// Get all supported currencies
export function getSupportedCurrencies() {
  return Object.keys(CURRENCY_SYMBOLS).map(code => ({
    code,
    symbol: CURRENCY_SYMBOLS[code],
    name: code
  }))
}

// Get exchange rate
export function getExchangeRate(currencyCode) {
  return EXCHANGE_RATES[currencyCode?.toUpperCase()] || 1
}
