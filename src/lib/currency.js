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
