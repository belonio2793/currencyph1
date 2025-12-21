/**
 * Rate Confirmation Service
 * 
 * Retrieves the latest exchange rates with timestamps
 * for user confirmation in the deposit flow
 * 
 * Provides:
 * - Last updated timestamp (human-readable + ISO)
 * - Rate source (coingecko, openexchangerates, fallback)
 * - Formatted rate display for UI
 */

import { supabase } from './supabaseClient'

/**
 * Get latest rate with timestamp for user confirmation
 * Returns rate data that can be displayed with time/date info
 */
export async function getLatestRateWithConfirmation(fromCurrency, toCurrency = 'PHP') {
  try {
    const { data, error } = await supabase
      .from('crypto_rates_valid')
      .select('rate, source, updated_at')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      console.warn(`No rate found for ${fromCurrency}/${toCurrency}`)
      return null
    }

    const rate = parseFloat(data.rate)
    const updatedAt = new Date(data.updated_at)

    return {
      from_currency: fromCurrency,
      to_currency: toCurrency,
      rate: rate,
      source: data.source,
      updated_at: data.updated_at,
      timestamp: {
        iso: data.updated_at,
        readable: formatRateTimestamp(updatedAt),
        date: updatedAt.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        time: updatedAt.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'UTC'
        }),
        utc_offset: 'UTC',
        is_current: isRateCurrent(updatedAt),
        minutes_ago: getMinutesAgo(updatedAt)
      },
      display: {
        rate_formatted: formatCurrencyDisplay(rate, toCurrency),
        rate_rounded: parseFloat(rate.toFixed(2)),
        confirmation_message: `${fromCurrency} rate updated ${formatRateTimestamp(updatedAt)}`
      }
    }
  } catch (error) {
    console.error(`Error fetching rate confirmation for ${fromCurrency}/${toCurrency}:`, error)
    return null
  }
}

/**
 * Get multiple rates with confirmations (batch operation)
 */
export async function getMultipleRatesWithConfirmations(currencies, toCurrency = 'PHP') {
  try {
    const confirmations = []

    for (const currency of currencies) {
      const confirmation = await getLatestRateWithConfirmation(currency, toCurrency)
      if (confirmation) {
        confirmations.push(confirmation)
      }
    }

    return confirmations
  } catch (error) {
    console.error('Error fetching multiple rate confirmations:', error)
    return []
  }
}

/**
 * Get rate confirmation with fallback to alternative currencies
 */
export async function getRateWithFallback(fromCurrency, preferredCurrency = 'PHP') {
  try {
    // Try primary currency first
    let confirmation = await getLatestRateWithConfirmation(fromCurrency, preferredCurrency)

    // If not found, try USD as fallback
    if (!confirmation && preferredCurrency !== 'USD') {
      console.warn(`${fromCurrency}/${preferredCurrency} not found, trying USD...`)
      confirmation = await getLatestRateWithConfirmation(fromCurrency, 'USD')

      if (confirmation) {
        // Try to convert USD to preferred currency
        const phpRate = await getLatestRateWithConfirmation('USD', preferredCurrency)
        if (phpRate) {
          confirmation.rate = confirmation.rate * phpRate.rate
          confirmation.to_currency = preferredCurrency
          confirmation.display.confirmation_message += ` (converted from USD)`
        }
      }
    }

    return confirmation
  } catch (error) {
    console.error(`Error fetching rate with fallback for ${fromCurrency}:`, error)
    return null
  }
}

/**
 * Check if rate is fresh (within 1 hour)
 */
function isRateCurrent(timestamp) {
  const hourInMs = 60 * 60 * 1000
  return Date.now() - new Date(timestamp).getTime() < hourInMs
}

/**
 * Get friendly "X minutes ago" format
 */
function getMinutesAgo(timestamp) {
  const now = new Date()
  const date = new Date(timestamp)
  const diffInMs = now.getTime() - date.getTime()
  const diffInMinutes = Math.floor(diffInMs / 60000)

  if (diffInMinutes < 1) {
    return 'just now'
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`
  } else {
    const diffInHours = Math.floor(diffInMinutes / 60)
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`
  }
}

/**
 * Format timestamp in readable format
 */
function formatRateTimestamp(timestamp) {
  const now = new Date()
  const date = new Date(timestamp)
  
  // Same day
  if (date.toDateString() === now.toDateString()) {
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
    return `today at ${timeStr} UTC`
  }

  // Yesterday
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
    return `yesterday at ${timeStr} UTC`
  }

  // Older
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Format currency display (e.g., 56500.50 PHP)
 */
function formatCurrencyDisplay(rate, currency) {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 8
  })

  return `${formatter.format(rate)} ${currency}`
}

/**
 * Get rate confirmation message for display in UI
 * Use this to show the user what rate they'll get and when it was updated
 */
export function buildRateConfirmationMessage(confirmation) {
  if (!confirmation) {
    return 'Rate information unavailable'
  }

  const {
    from_currency,
    to_currency,
    display,
    timestamp,
    source
  } = confirmation

  return {
    title: `${from_currency} → ${to_currency}`,
    rate: display.rate_formatted,
    timestamp_text: `Last updated: ${timestamp.readable}`,
    detail: `${display.confirmation_message}`,
    minutes_ago: timestamp.minutes_ago,
    is_fresh: timestamp.is_current,
    source: source,
    full_message: `You'll receive ${display.rate_formatted} for your deposit. Rate confirmed ${timestamp.readable} (${source} source).`
  }
}

/**
 * Stream rate updates in real-time for a specific pair
 */
export function subscribeToRateUpdates(fromCurrency, toCurrency = 'PHP', callback) {
  try {
    const subscription = supabase
      .from('crypto_rates_valid')
      .on(
        'UPDATE',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'crypto_rates_valid',
          filter: `from_currency=eq.${fromCurrency},to_currency=eq.${toCurrency}`
        },
        async (payload) => {
          const confirmation = await getLatestRateWithConfirmation(fromCurrency, toCurrency)
          if (confirmation && callback) {
            callback(confirmation)
          }
        }
      )
      .subscribe()

    return subscription
  } catch (error) {
    console.error('Error subscribing to rate updates:', error)
    return null
  }
}

export default {
  getLatestRateWithConfirmation,
  getMultipleRatesWithConfirmations,
  getRateWithFallback,
  buildRateConfirmationMessage,
  subscribeToRateUpdates
}
