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
      // 1) PRIMARY: Try public.pairs table directly with timeout
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000) // 8 second timeout

        const pairsPromise = supabase
          .from('pairs')
          .select('from_currency, to_currency, rate, updated_at')
          .limit(200) // Reduced limit for faster queries

        const { data: pairsData, error: pairsError } = await Promise.race([
          pairsPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Public.pairs query timeout')), 7000))
        ])

        clearTimeout(timeout)

        if (!pairsError && pairsData && pairsData.length > 0) {
          console.log('Using exchange rates from public.pairs table')
          const lastUpdated = new Date(pairsData[0].updated_at || Date.now())
          const rates = {}

          // Build rates from USD conversions in pairs
          CURRENCIES.forEach(currency => {
            if (currency.code === 'USD') {
              rates[currency.code] = { ...currency, rate: 1, lastUpdated }
              return
            }

            // Find rate from USD to this currency
            const pair = pairsData.find(p =>
              p.from_currency === 'USD' && p.to_currency === currency.code
            )

            if (pair && typeof pair.rate === 'number' && pair.rate > 0) {
              rates[currency.code] = { ...currency, rate: pair.rate, lastUpdated }
            } else {
              // If no direct pair, try to mark as missing but don't fail
              rates[currency.code] = { ...currency, rate: 0, lastUpdated }
            }
          })
          return rates
        } else if (pairsError) {
          console.warn('Error fetching from public.pairs:', pairsError.message)
        }
      } catch (e) {
        console.warn('Public.pairs lookup failed or timed out:', e && e.message)
      }

      // 2) SECONDARY: Try Open Exchange Rates (if API key is configured)
      const OPEN_KEY = (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_OPEN_EXCHANGE_RATES_API || import.meta.env.OPEN_EXCHANGE_RATES_API)) || (typeof process !== 'undefined' && (process.env.VITE_OPEN_EXCHANGE_RATES_API || process.env.OPEN_EXCHANGE_RATES_API)) || null
      if (OPEN_KEY) {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 15000)
          const url = `https://openexchangerates.org/api/latest.json?app_id=${OPEN_KEY}`
          const resp = await fetch(url, {
            headers: { Accept: 'application/json' },
            signal: controller.signal
          })
          clearTimeout(timeout)
          if (resp && resp.ok) {
            const json = await resp.json()
            const ratesData = json && json.rates ? json.rates : null
            if (ratesData) {
              const now = new Date()
              const rates = {}
              CURRENCIES.forEach(currency => {
                if (currency.code === 'USD') {
                  rates[currency.code] = { ...currency, rate: 1, lastUpdated: now }
                  return
                }
                const rateVal = ratesData[currency.code]
                rates[currency.code] = { ...currency, rate: typeof rateVal === 'number' ? rateVal : 0, lastUpdated: now }
              })
              return rates
            }
          }
        } catch (e) {
          // Silently skip - error handling continues to fallback
        }
      }

      // 3) Try edge function (cached rates) with timeout
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)
        const { data, error } = await Promise.race([
          supabase.functions.invoke('fetch-rates', { method: 'GET' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Edge function timeout')), 7000))
        ])
        clearTimeout(timeout)

        // Check if service is unavailable
        if (data && data.service_status === 'unavailable') {
          console.warn('Rate service is unavailable')
        } else if (!error && data && data.exchangeRates) {
          const now = new Date()
          const rates = {}
          CURRENCIES.forEach(currency => {
            if (currency.code === 'USD') {
              rates[currency.code] = { ...currency, rate: 1, lastUpdated: now }
              return
            }
            const rateVal = data.exchangeRates[currency.code]
            // Validate rate is > 0 and finite
            const validRate = typeof rateVal === 'number' && isFinite(rateVal) && rateVal > 0 ? rateVal : 0
            rates[currency.code] = { ...currency, rate: validRate, lastUpdated: now }
          })
          return rates
        }
        if (error) console.warn('Edge function error:', error)
      } catch (e) {
        console.warn('Edge function invocation failed:', e && e.message)
      }

      // 4) Fallback to public exchangerate.host
      try {
        const resp = await fetch('https://api.exchangerate.host/latest?base=USD')
        if (resp && resp.ok) {
          const json = await resp.json()
          const ratesData = json && json.rates ? json.rates : null
          if (ratesData) {
            const now = new Date()
            const rates = {}
            CURRENCIES.forEach(currency => {
              if (currency.code === 'USD') {
                rates[currency.code] = { ...currency, rate: 1, lastUpdated: now }
                return
              }
              const rateVal = ratesData[currency.code]
              rates[currency.code] = { ...currency, rate: typeof rateVal === 'number' ? rateVal : 0, lastUpdated: now }
            })
            return rates
          }
        }
      } catch (e) {
        // ignore and fall through
        console.warn('Fallback exchangerate.host failed:', e && e.message)
      }

      // If all else fails, return fallback hard-coded rates
      return this.getFallbackRates()
    } catch (err) {
      console.warn('Failed to fetch rates from primary and fallback sources:', err?.message || err)
      return this.getFallbackRates()
    }
  },

  // Get Bitcoin and Ethereum prices in USD and other currencies from public.pairs (primary)
  async getCryptoPrices() {
    try {
      // 1) PRIMARY: Try public.pairs table first for crypto prices with timeout
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 6000) // 6 second timeout

        const pairsPromise = supabase
          .from('pairs')
          .select('from_currency, to_currency, rate, updated_at')
          .limit(100) // Small limit for crypto-only queries

        const { data: pairsData, error: pairsError } = await Promise.race([
          pairsPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Public.pairs crypto query timeout')), 5000))
        ])

        clearTimeout(timeout)

        if (!pairsError && pairsData && pairsData.length > 0) {
          console.log('Using crypto prices from public.pairs table')
          const lastUpdated = new Date(pairsData[0].updated_at || Date.now())

          // Extract crypto prices from pairs (e.g., BTC-USD, ETH-USD)
          const btcUsd = pairsData.find(p => p.from_currency === 'BTC' && p.to_currency === 'USD')
          const ethUsd = pairsData.find(p => p.from_currency === 'ETH' && p.to_currency === 'USD')
          const dogeUsd = pairsData.find(p => p.from_currency === 'DOGE' && p.to_currency === 'USD')

          return {
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
        } else if (pairsError) {
          console.warn('Error fetching crypto from public.pairs:', pairsError.message)
        }
      } catch (e) {
        console.warn('Public.pairs crypto lookup failed or timed out:', e?.message)
      }

      // 2) SECONDARY: Try edge function (cached rates) with timeout
      try {
        const { data, error } = await Promise.race([
          supabase.functions.invoke('fetch-rates', { method: 'GET' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Crypto prices fetch timeout')), 7000))
        ])

        if (!error && data && data.cryptoPrices) {
          return {
            BTC: {
              name: 'Bitcoin',
              symbol: 'BTC',
              prices: data.cryptoPrices.bitcoin || {},
              lastUpdated: new Date()
            },
            ETH: {
              name: 'Ethereum',
              symbol: 'ETH',
              prices: data.cryptoPrices.ethereum || {},
              lastUpdated: new Date()
            },
            DOGE: {
              name: 'Dogecoin',
              symbol: 'DOGE',
              prices: data.cryptoPrices.dogecoin || {},
              lastUpdated: new Date()
            }
          }
        }
        if (error) console.warn('Edge function error:', error?.message)
      } catch (e) {
        console.warn('Edge function invocation failed:', e?.message)
      }

      return null
    } catch (error) {
      console.warn('Error fetching crypto prices:', error?.message)
      return null
    }
  },

  // Fallback rates (cached, updated manually)
  getFallbackRates() {
    const baseRates = {
      AED: 3.67,
      AFN: 71.5,
      AUD: 1.52,
      BRL: 5.02,
      CAD: 1.36,
      CHF: 0.88,
      CNY: 7.09,
      DKK: 6.88,
      EUR: 0.93,
      GBP: 0.80,
      HKD: 7.78,
      IDR: 16250,
      INR: 83.8,
      JPY: 152.5,
      KRW: 1305,
      MXN: 17.25,
      MYR: 4.38,
      NOK: 10.60,
      NZD: 1.62,
      PHP: 56.75,
      SEK: 10.65,
      SGD: 1.34,
      THB: 35.0,
      USD: 1,
      VND: 24750,
      ZAR: 17.85
    }

    const rates = {}
    CURRENCIES.forEach(currency => {
      rates[currency.code] = {
        ...currency,
        rate: baseRates[currency.code] || 0,
        lastUpdated: new Date(Date.now() - 3600000) // 1 hour ago
      }
    })

    return rates
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
