import { supabase } from './supabaseClient'

/**
 * Fetch all crypto wallets for a user
 */
export async function getCryptoWallets(userId) {
  try {
    const { data, error } = await supabase
      .from('wallets')
      .select('id, user_id, currency_code, balance, wallet_type, created_at, updated_at')
      .eq('user_id', userId)
      .eq('wallet_type', 'crypto')
      .order('currency_code', { ascending: true })

    if (error) {
      console.warn('Error fetching crypto wallets:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error in getCryptoWallets:', error)
    return []
  }
}

/**
 * Fetch current crypto prices from cached_rates table
 */
export async function getCryptoPrices() {
  try {
    const { data, error } = await supabase
      .from('cached_rates')
      .select('crypto_prices')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.warn('Error fetching crypto prices:', error)
      return {}
    }

    return data?.crypto_prices || {}
  } catch (error) {
    console.error('Error in getCryptoPrices:', error)
    return {}
  }
}

/**
 * Calculate total crypto balance in PHP
 */
export function calculateTotalCryptoInPHP(cryptoWallets, cryptoPrices) {
  try {
    let totalPHP = 0

    for (const wallet of cryptoWallets) {
      const cryptoCode = wallet.currency_code?.toUpperCase()
      if (!cryptoCode) continue

      const balance = parseFloat(wallet.balance) || 0
      if (balance === 0) continue

      // Get price in PHP
      const priceData = cryptoPrices[cryptoCode.toLowerCase()]
      if (priceData && priceData.php) {
        totalPHP += balance * priceData.php
      }
    }

    return totalPHP
  } catch (error) {
    console.error('Error calculating crypto total:', error)
    return 0
  }
}

/**
 * Convert specific crypto amount to PHP
 */
export function convertCryptoToPHP(amount, cryptoCode, cryptoPrices) {
  try {
    const code = cryptoCode?.toUpperCase()
    if (!code) return 0

    const priceData = cryptoPrices[code.toLowerCase()]
    if (!priceData || !priceData.php) return 0

    return parseFloat(amount) * priceData.php
  } catch (error) {
    console.error('Error converting crypto to PHP:', error)
    return 0
  }
}

/**
 * Convert PHP amount to specific crypto
 */
export function convertPHPToCrypto(phpAmount, cryptoCode, cryptoPrices) {
  try {
    const code = cryptoCode?.toUpperCase()
    if (!code) return 0

    const priceData = cryptoPrices[code.toLowerCase()]
    if (!priceData || !priceData.php) return 0

    return parseFloat(phpAmount) / priceData.php
  } catch (error) {
    console.error('Error converting PHP to crypto:', error)
    return 0
  }
}

/**
 * Get detailed crypto holdings with PHP values
 */
export function getDetailedCryptoHoldings(cryptoWallets, cryptoPrices) {
  try {
    const holdings = cryptoWallets
      .filter(w => (parseFloat(w.balance) || 0) > 0)
      .map(wallet => {
        const cryptoCode = wallet.currency_code?.toUpperCase()
        const balance = parseFloat(wallet.balance) || 0
        const priceData = cryptoPrices[cryptoCode?.toLowerCase()] || {}
        const priceInPHP = priceData.php || 0

        return {
          id: wallet.id,
          currency: cryptoCode,
          balance: balance,
          priceInPHP: priceInPHP,
          totalValueInPHP: balance * priceInPHP,
          createdAt: wallet.created_at
        }
      })
      .sort((a, b) => b.totalValueInPHP - a.totalValueInPHP)

    return holdings
  } catch (error) {
    console.error('Error getting detailed crypto holdings:', error)
    return []
  }
}

/**
 * Get total crypto balance in different display currencies
 */
export async function getTotalCryptoBalance(userId, displayCurrency = 'PHP') {
  try {
    const [cryptoWallets, cryptoPrices] = await Promise.all([
      getCryptoWallets(userId),
      getCryptoPrices()
    ])

    // Calculate total in PHP first
    const totalInPHP = calculateTotalCryptoInPHP(cryptoWallets, cryptoPrices)

    // If display currency is not PHP, convert
    let totalInDisplayCurrency = totalInPHP
    if (displayCurrency !== 'PHP') {
      try {
        const { currencyAPI } = await import('./payments')
        const rate = await currencyAPI.getExchangeRate('PHP', displayCurrency)
        if (rate) {
          totalInDisplayCurrency = totalInPHP * rate
        }
      } catch (err) {
        console.warn(`Could not convert PHP to ${displayCurrency}:`, err)
      }
    }

    return {
      cryptoWallets,
      cryptoPrices,
      totalInPHP,
      totalInDisplayCurrency,
      displayCurrency,
      hasHoldings: cryptoWallets.length > 0
    }
  } catch (error) {
    console.error('Error getting total crypto balance:', error)
    return {
      cryptoWallets: [],
      cryptoPrices: {},
      totalInPHP: 0,
      totalInDisplayCurrency: 0,
      displayCurrency,
      hasHoldings: false
    }
  }
}

/**
 * Get crypto balance summary with all details
 */
export async function getCryptoBalanceSummary(userId) {
  try {
    const [cryptoWallets, cryptoPrices] = await Promise.all([
      getCryptoWallets(userId),
      getCryptoPrices()
    ])

    const totalInPHP = calculateTotalCryptoInPHP(cryptoWallets, cryptoPrices)
    const holdings = getDetailedCryptoHoldings(cryptoWallets, cryptoPrices)

    return {
      wallets: cryptoWallets,
      prices: cryptoPrices,
      holdings: holdings,
      totalInPHP: totalInPHP,
      holdingCount: cryptoWallets.length,
      topHolding: holdings.length > 0 ? holdings[0] : null
    }
  } catch (error) {
    console.error('Error getting crypto balance summary:', error)
    return {
      wallets: [],
      prices: {},
      holdings: [],
      totalInPHP: 0,
      holdingCount: 0,
      topHolding: null
    }
  }
}

export default {
  getCryptoWallets,
  getCryptoPrices,
  calculateTotalCryptoInPHP,
  convertCryptoToPHP,
  convertPHPToCrypto,
  getDetailedCryptoHoldings,
  getTotalCryptoBalance,
  getCryptoBalanceSummary
}
