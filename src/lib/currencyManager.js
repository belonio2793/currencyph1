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
