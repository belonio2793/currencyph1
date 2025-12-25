// Currency rates from Supabase edge function (avoids CORS issues)
import { supabase } from './supabaseClient'

// List of all global currencies to track - SORTED ALPHABETICALLY
const CURRENCIES = [
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  { code: 'AFN', symbol: 'AFN', name: 'Afghan Afghani' },
  { code: 'AUD', symbol: 'AUD', name: 'Australian Dollar' },
  { code: 'BRL', symbol: 'BRL', name: 'Brazilian Real' },
  { code: 'CAD', symbol: 'CAD', name: 'Canadian Dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', symbol: 'CNY', name: 'Chinese Yuan' },
  { code: 'DKK', symbol: 'DKK', name: 'Danish Krone' },
  { code: 'EUR', symbol: 'EUR', name: 'Euro' },
  { code: 'GBP', symbol: 'GBP', name: 'British Pound' },
  { code: 'HKD', symbol: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'IDR', symbol: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'INR', symbol: 'INR', name: 'Indian Rupee' },
  { code: 'JPY', symbol: 'JPY', name: 'Japanese Yen' },
  { code: 'KRW', symbol: 'KRW', name: 'South Korean Won' },
  { code: 'MXN', symbol: 'MXN', name: 'Mexican Peso' },
  { code: 'MYR', symbol: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'NOK', symbol: 'NOK', name: 'Norwegian Krone' },
  { code: 'NZD', symbol: 'NZD', name: 'New Zealand Dollar' },
  { code: 'PHP', symbol: 'PHP', name: 'Philippine Peso' },
  { code: 'SEK', symbol: 'SEK', name: 'Swedish Krona' },
  { code: 'SGD', symbol: 'SGD', name: 'Singapore Dollar' },
  { code: 'THB', symbol: 'THB', name: 'Thai Baht' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'VND', symbol: 'VND', name: 'Vietnamese Dong' },
  { code: 'ZAR', symbol: 'ZAR', name: 'South African Rand' },
]

export const currencyAPI = {
  // Get all currency rates relative to USD via public.pairs table (primary source)
  async getGlobalRates() {
    try {
      // 1) PRIMARY: Try pairs_canonical view for canonical rates (faster and cleaner)
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000) // 8 second timeout

        const canonicalPairsPromise = supabase
          .from('pairs_canonical')
          .select('from_currency, to_currency, rate, updated_at')
          .limit(200)

        const { data: canonicalData, error: canonicalError } = await Promise.race([
          canonicalPairsPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Canonical pairs query timeout')), 7000))
        ])

        clearTimeout(timeout)

        if (!canonicalError && canonicalData && canonicalData.length > 0) {
          console.log('✅ Using exchange rates from pairs_canonical view (canonical direction)')
          const lastUpdated = new Date(canonicalData[0].updated_at || Date.now())
          const rates = {}

          // Build rates from USD conversions in pairs (canonical direction)
          CURRENCIES.forEach(currency => {
            if (currency.code === 'USD') {
              rates[currency.code] = { ...currency, rate: 1, lastUpdated }
              return
            }

            // Find canonical rate from USD to this currency
            const pair = canonicalData.find(p =>
              p.from_currency === 'USD' && p.to_currency === currency.code
            )

            if (pair && typeof pair.rate === 'number' && pair.rate > 0) {
              rates[currency.code] = { ...currency, rate: pair.rate, lastUpdated }
            } else {
              // If no direct pair, mark as missing but don't fail
              rates[currency.code] = { ...currency, rate: 0, lastUpdated }
            }
          })

          if (Object.keys(rates).length > 0) {
            return rates
          }
        } else if (canonicalError) {
          console.warn('⚠️ Error fetching from pairs_canonical:', canonicalError.message)
        }
      } catch (e) {
        console.warn('⚠️ Canonical pairs lookup failed or timed out:', e && e.message)
      }

      // 2) FALLBACK: Try public.pairs table directly if canonical view fails
      try {
        const pairsPromise = supabase
          .from('pairs')
          .select('from_currency, to_currency, rate, updated_at, pair_direction')
          .limit(200)

        const { data: pairsData, error: pairsError } = await Promise.race([
          pairsPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Public.pairs query timeout')), 5000))
        ])

        if (!pairsError && pairsData && pairsData.length > 0) {
          console.log('✅ Using exchange rates from public.pairs table (fallback)')
          const lastUpdated = new Date(pairsData[0].updated_at || Date.now())
          const rates = {}

          // Build rates from USD conversions - prefer canonical pairs
          CURRENCIES.forEach(currency => {
            if (currency.code === 'USD') {
              rates[currency.code] = { ...currency, rate: 1, lastUpdated }
              return
            }

            // Find rate from USD to this currency, preferring canonical
            const canonicalPair = pairsData.find(p =>
              p.from_currency === 'USD' && p.to_currency === currency.code && p.pair_direction === 'canonical'
            )

            const anyPair = pairsData.find(p =>
              p.from_currency === 'USD' && p.to_currency === currency.code
            )

            const pair = canonicalPair || anyPair

            if (pair && typeof pair.rate === 'number' && pair.rate > 0) {
              rates[currency.code] = { ...currency, rate: pair.rate, lastUpdated }
            } else {
              rates[currency.code] = { ...currency, rate: 0, lastUpdated }
            }
          })
          return rates
        } else if (pairsError) {
          console.warn('❌ Error fetching from public.pairs:', pairsError.message)
        }
      } catch (e) {
        console.warn('❌ Public.pairs lookup failed:', e && e.message)
      }

      console.log('⚠️ All pair lookups failed, returning empty rates')
      // If primary sources fail, return empty rates
      return {}
    } catch (err) {
      console.warn('❌ Failed to fetch rates from pairs:', err?.message || err)
      return {}
    }
  },

  // Get Bitcoin and Ethereum prices in USD and other currencies from public.pairs (primary)
  async getCryptoPrices() {
    try {
      // 1) PRIMARY: Try pairs_canonical view first for canonical crypto prices
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 6000) // 6 second timeout

        const canonicalPromise = supabase
          .from('pairs_canonical')
          .select('from_currency, to_currency, rate, updated_at')
          .limit(100)

        const { data: canonicalData, error: canonicalError } = await Promise.race([
          canonicalPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Canonical crypto query timeout')), 5000))
        ])

        clearTimeout(timeout)

        if (!canonicalError && canonicalData && canonicalData.length > 0) {
          console.log('✅ Using crypto prices from pairs_canonical view')
          const lastUpdated = new Date(canonicalData[0].updated_at || Date.now())

          // Extract crypto prices from canonical pairs
          const btcUsd = canonicalData.find(p => p.from_currency === 'BTC' && p.to_currency === 'USD')
          const ethUsd = canonicalData.find(p => p.from_currency === 'ETH' && p.to_currency === 'USD')
          const dogeUsd = canonicalData.find(p => p.from_currency === 'DOGE' && p.to_currency === 'USD')

          const cryptoPrices = {
            BTC: {
              name: 'Bitcoin',
              symbol: 'BTC',
              prices: { usd: btcUsd?.rate || 0 },
              lastUpdated
            },
            ETH: {
              name: 'Ethereum',
              symbol: 'ETH',
              prices: { usd: ethUsd?.rate || 0 },
              lastUpdated
            },
            DOGE: {
              name: 'Dogecoin',
              symbol: 'DOGE',
              prices: { usd: dogeUsd?.rate || 0 },
              lastUpdated
            }
          }

          // Only return if we have at least one valid price
          const hasValidPrices = btcUsd?.rate || ethUsd?.rate || dogeUsd?.rate
          if (hasValidPrices) {
            return cryptoPrices
          }
        } else if (pairsError) {
          console.warn('❌ Error fetching crypto from public.pairs:', pairsError.message)
        }
      } catch (e) {
        console.warn('❌ Public.pairs crypto lookup failed or timed out:', e?.message)
      }

      console.log('⚠️ Public.pairs crypto lookup failed, returning null to disable crypto conversion fallback')
      return null
    } catch (error) {
      console.warn('❌ Error fetching crypto prices:', error?.message)
      return null
    }
  },


  // Get all currencies for display
  getCurrencies() {
    return CURRENCIES
  },

  // Convert amount from one currency to another
  async convert(amount, fromCurrency, toCurrency) {
    // support converting between fiat (from getGlobalRates) and crypto (from getCryptoPrices)
    const results = await Promise.allSettled([this.getGlobalRates(), this.getCryptoPrices()])
    const rates = results[0].status === 'fulfilled' ? results[0].value : this.getFallbackRates()
    const crypto = results[1].status === 'fulfilled' ? results[1].value : null

    const isFromCrypto = crypto && (crypto[fromCurrency] || crypto[fromCurrency?.toLowerCase()])
    const isToCrypto = crypto && (crypto[toCurrency] || crypto[toCurrency?.toLowerCase()])

    const now = new Date()

    // Helper to get USD price for crypto symbol
    const getCryptoUsd = (symbol) => {
      if (!crypto) return null
      const s = crypto[symbol] || crypto[symbol?.toLowerCase()]
      if (!s) return null
      // crypto data may be stored as { prices: { usd: X } } or directly { usd: X }
      return (s.prices && s.prices.usd) || (s.usd) || null
    }

    // Both fiat
    if (!isFromCrypto && !isToCrypto) {
      if (!rates[fromCurrency] || !rates[toCurrency]) {
        throw new Error(`Currency not found: ${fromCurrency} or ${toCurrency}`)
      }
      const fromRate = rates[fromCurrency].rate
      const toRate = rates[toCurrency].rate
      const usdAmount = amount / fromRate
      const convertedAmount = usdAmount * toRate
      return {
        fromCurrency,
        toCurrency,
        originalAmount: amount,
        convertedAmount: Number(convertedAmount.toFixed(2)),
        rate: Number((toRate / fromRate).toFixed(6)),
        timestamp: now
      }
    }

    // Both crypto
    if (isFromCrypto && isToCrypto) {
      const fromUsd = getCryptoUsd(fromCurrency)
      const toUsd = getCryptoUsd(toCurrency)
      if (fromUsd == null || toUsd == null) throw new Error(`Crypto price not available for ${fromCurrency} or ${toCurrency}`)
      const rate = toUsd / fromUsd // 1 FROM crypto = rate TO crypto
      const convertedAmount = amount * rate
      return {
        fromCurrency,
        toCurrency,
        originalAmount: amount,
        convertedAmount: Number(convertedAmount.toFixed(8)),
        rate: Number(rate.toFixed(8)),
        timestamp: now
      }
    }

    // From crypto -> fiat
    if (isFromCrypto && !isToCrypto) {
      const fromUsd = getCryptoUsd(fromCurrency)
      if (fromUsd == null) throw new Error(`Crypto price not available for ${fromCurrency}`)
      if (!rates[toCurrency]) throw new Error(`Currency not found: ${toCurrency}`)
      const usdToTarget = rates[toCurrency].rate // USD -> TARGET
      const rate = fromUsd * usdToTarget // 1 FROM crypto = rate TARGET fiat
      const convertedAmount = amount * rate
      return {
        fromCurrency,
        toCurrency,
        originalAmount: amount,
        convertedAmount: Number(convertedAmount.toFixed(2)),
        rate: Number(rate.toFixed(6)),
        timestamp: now
      }
    }

    // From fiat -> crypto
    if (!isFromCrypto && isToCrypto) {
      if (!rates[fromCurrency]) throw new Error(`Currency not found: ${fromCurrency}`)
      const usdToFrom = rates[fromCurrency].rate // USD -> FROM
      const toUsd = getCryptoUsd(toCurrency)
      if (toUsd == null) throw new Error(`Crypto price not available for ${toCurrency}`)
      // 1 FROM fiat = (1 / usdToFrom) USD. Then into crypto: (1 / usdToFrom) / toUsd
      const rate = 1 / (usdToFrom * toUsd) // 1 FROM fiat = rate TO crypto
      const convertedAmount = amount * rate
      return {
        fromCurrency,
        toCurrency,
        originalAmount: amount,
        convertedAmount: Number(convertedAmount.toFixed(8)),
        rate: Number(rate.toFixed(12)),
        timestamp: now
      }
    }

    throw new Error('Unsupported currency conversion')
  }
}
