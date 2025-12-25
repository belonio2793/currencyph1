/**
 * Currency conversion utilities
 * Converts between PHP (Philippine Peso) and USD (US Dollar)
 */

/**
 * Convert PHP amount to USD
 * @param {number} phpAmount - Amount in PHP
 * @param {number} exchangeRate - PHP to USD exchange rate (required)
 * @returns {number} Amount in USD
 */
export function phpToUsd(phpAmount, exchangeRate) {
  if (!phpAmount || isNaN(phpAmount) || !exchangeRate || isNaN(exchangeRate)) return 0;
  return parseFloat((phpAmount / exchangeRate).toFixed(2));
}

/**
 * Convert USD amount to PHP
 * @param {number} usdAmount - Amount in USD
 * @param {number} exchangeRate - PHP to USD exchange rate (required)
 * @returns {number} Amount in PHP
 */
export function usdToPhp(usdAmount, exchangeRate) {
  if (!usdAmount || isNaN(usdAmount) || !exchangeRate || isNaN(exchangeRate)) return 0;
  return parseFloat((usdAmount * exchangeRate).toFixed(2));
}

/**
 * Format amount as currency with symbol
 * @param {number} amount - Amount to format
 * @param {string} currency - 'PHP' or 'USD' (default: 'PHP')
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, currency = 'PHP') {
  if (!amount || isNaN(amount)) {
    return currency === 'PHP' ? '₱0.00' : '$0.00';
  }

  const formatted = parseFloat(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return currency === 'PHP' ? `₱${formatted}` : `$${formatted}`;
}

/**
 * Display both PHP and USD amounts
 * @param {number} phpAmount - Amount in PHP
 * @param {number} exchangeRate - PHP to USD exchange rate (required)
 * @returns {string} Formatted string with both currencies
 */
export function displayBothCurrencies(phpAmount, exchangeRate) {
  if (!phpAmount || isNaN(phpAmount) || !exchangeRate || isNaN(exchangeRate)) {
    return `${formatCurrency(0, 'PHP')} / ${formatCurrency(0, 'USD')}`;
  }

  const usdAmount = phpToUsd(phpAmount, exchangeRate);
  return `${formatCurrency(phpAmount, 'PHP')} / ${formatCurrency(usdAmount, 'USD')}`;
}

/**
 * Get current exchange rate from API
 * @returns {Promise<number|null>} Current PHP to USD exchange rate, or null if unavailable
 */
export async function fetchExchangeRate() {
  try {
    const response = await fetch('/api/exchange-rate', {
      timeout: 10000
    });

    if (!response.ok) {
      console.warn('Exchange rate API returned error');
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.warn('Exchange rate API returned non-JSON response');
      return null;
    }

    const data = await response.json();
    return data.rate || null;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    return null;
  }
}
