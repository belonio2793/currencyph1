export const currencySymbols = {
  PHP: '₱',
  USD: '$',
  EUR: '€',
  GBP: '£'
}

export function getCurrencySymbol(code) {
  return currencySymbols[code] || ''
}

export function formatNumber(amount) {
  if (amount == null || isNaN(amount)) return '0.00'
  return Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatCurrency(amount, code) {
  const symbol = getCurrencySymbol(code)
  return `${symbol}${formatNumber(amount)}`
}
