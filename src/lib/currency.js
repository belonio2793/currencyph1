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

export function formatNumber(amount) {
  if (amount == null || isNaN(amount)) return '0.00'
  return Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Format conversion rates with intelligent decimal precision
export function formatExchangeRate(rate) {
  if (rate == null || isNaN(rate)) return '0'

  const numRate = Number(rate)

  // For very large numbers (e.g., BTC to PHP: 5,179,990), show 2 decimals
  if (numRate >= 1000) {
    return numRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // For numbers >= 1 (e.g., EUR to PHP: 62.50), show 2-4 decimals
  if (numRate >= 1) {
    return numRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  }

  // For very small numbers (e.g., PHP to BTC: 0.00000019), show up to 10 significant digits
  // This preserves precision for crypto-to-fiat conversions
  const strRate = numRate.toExponential(10)
  const decimalRate = parseFloat(strRate)

  // Find how many leading zeros after decimal point
  if (numRate < 0.001) {
    return decimalRate.toLocaleString(undefined, { useGrouping: false, maximumFractionDigits: 10 })
  }

  return decimalRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

export function formatCurrency(amount, code) {
  const symbol = getCurrencySymbol(code)
  return `${symbol}${formatNumber(amount)}`
}

export function formatPhp(amount) {
  return formatCurrency(amount, 'PHP')
}

export function formatUsd(amount) {
  return formatCurrency(amount, 'USD')
}
