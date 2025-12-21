// Currency rates from Supabase edge function (avoids CORS issues)
import { supabase } from './supabaseClient'

// List of all global currencies to track
const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: 'EUR', name: 'Euro' },
  { code: 'GBP', symbol: 'GBP', name: 'British Pound' },
  { code: 'JPY', symbol: 'JPY', name: 'Japanese Yen' },
  { code: 'CNY', symbol: 'CNY', name: 'Chinese Yuan' },
  { code: 'INR', symbol: 'INR', name: 'Indian Rupee' },
  { code: 'CAD', symbol: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'AUD', name: 'Australian Dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'SEK', symbol: 'SEK', name: 'Swedish Krona' },
  { code: 'NZD', symbol: 'NZD', name: 'New Zealand Dollar' },
  { code: 'SGD', symbol: 'SGD', name: 'Singapore Dollar' },
  { code: 'HKD', symbol: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'PHP', symbol: 'PHP', name: 'Philippine Peso' },
  { code: 'IDR', symbol: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'MYR', symbol: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'THB', symbol: 'THB', name: 'Thai Baht' },
  { code: 'VND', symbol: 'VND', name: 'Vietnamese Dong' },
  { code: 'KRW', symbol: 'KRW', name: 'South Korean Won' },
  { code: 'ZAR', symbol: 'ZAR', name: 'South African Rand' },
  { code: 'BRL', symbol: 'BRL', name: 'Brazilian Real' },
  { code: 'MXN', symbol: 'MXN', name: 'Mexican Peso' },
  { code: 'NOK', symbol: 'NOK', name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'DKK', name: 'Danish Krone' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
]

export const currencyAPI = {
  // Get all currency rates relative to USD via edge function
  async getGlobalRates() {
    try {
      // 1) Prefer Open Exchange Rates (hourly) when API key is configured
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

      // 2) Try edge function (cached rates) with timeout
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)
        const { data, error } = await Promise.race([
          supabase.functions.invoke('fetch-rates', { method: 'GET' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Edge function timeout')), 7000))
        ])
        clearTimeout(timeout)
        if (!error && data && data.exchangeRates) {
          const now = new Date()
          const rates = {}
          CURRENCIES.forEach(currency => {
            if (currency.code === 'USD') {
              rates[currency.code] = { ...currency, rate: 1, lastUpdated: now }
              return
            }
            const rateVal = data.exchangeRates[currency.code]
            rates[currency.code] = { ...currency, rate: typeof rateVal === 'number' ? rateVal : 0, lastUpdated: now }
          })
          return rates
        }
        if (error) console.warn('Edge function error:', error)
      } catch (e) {
        console.warn('Edge function invocation failed:', e && e.message)
      }

      // 2b) Fallback to database cached rates
      try {
        const { data: cachedData, error: cacheError } = await supabase
          .from('cached_rates')
          .select('exchange_rates, fetched_at')
          .order('fetched_at', { ascending: false })
          .limit(1)
          .single()

        if (!cacheError && cachedData?.exchange_rates) {
          console.log('Using cached exchange rates from database')
          const lastUpdated = new Date(cachedData.fetched_at)
          const rates = {}
          CURRENCIES.forEach(currency => {
            if (currency.code === 'USD') {
              rates[currency.code] = { ...currency, rate: 1, lastUpdated }
              return
            }
            const rateVal = cachedData.exchange_rates[currency.code]
            rates[currency.code] = { ...currency, rate: typeof rateVal === 'number' ? rateVal : 0, lastUpdated }
          })
          return rates
        }
      } catch (e) {
        console.warn('Database fallback for exchange rates failed:', e && e.message)
      }

      // 3) Fallback to public exchangerate.host
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

  // Get Bitcoin and Ethereum prices in USD and other currencies
  async getCryptoPrices() {
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

      // Fallback: Try to fetch from cached_rates table in database
      console.warn('Edge function failed, trying database fallback:', error?.message)
      try {
        const { data: cachedData, error: cacheError } = await supabase
          .from('cached_rates')
          .select('crypto_prices, fetched_at')
          .order('fetched_at', { ascending: false })
          .limit(1)
          .single()

        if (!cacheError && cachedData?.crypto_prices) {
          console.log('Using cached crypto prices from database')
          return {
            BTC: {
              name: 'Bitcoin',
              symbol: 'BTC',
              prices: cachedData.crypto_prices.bitcoin || {},
              lastUpdated: new Date(cachedData.fetched_at)
            },
            ETH: {
              name: 'Ethereum',
              symbol: 'ETH',
              prices: cachedData.crypto_prices.ethereum || {},
              lastUpdated: new Date(cachedData.fetched_at)
            },
            DOGE: {
              name: 'Dogecoin',
              symbol: 'DOGE',
              prices: cachedData.crypto_prices.dogecoin || {},
              lastUpdated: new Date(cachedData.fetched_at)
            }
          }
        }
      } catch (cacheErr) {
        console.warn('Database fallback also failed:', cacheErr?.message)
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
      USD: 1,
      EUR: 0.93,
      GBP: 0.80,
      JPY: 152.5,
      CNY: 7.09,
      INR: 83.8,
      CAD: 1.36,
      AUD: 1.52,
      CHF: 0.88,
      SEK: 10.65,
      NZD: 1.62,
      SGD: 1.34,
      HKD: 7.78,
      PHP: 56.75,
      IDR: 16250,
      MYR: 4.38,
      THB: 35.0,
      VND: 24750,
      KRW: 1305,
      ZAR: 17.85,
      BRL: 5.02,
      MXN: 17.25,
      NOK: 10.60,
      DKK: 6.88,
      AED: 3.67
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
