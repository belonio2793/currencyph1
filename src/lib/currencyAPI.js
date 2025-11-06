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
      const { data, error } = await supabase.functions.invoke('fetch-rates', {
        method: 'GET'
      })

      if (error) {
        console.warn('Edge function error:', error)
        return this.getFallbackRates()
      }

      if (!data || !data.exchangeRates) {
        console.warn('No exchange rates returned from edge function')
        return this.getFallbackRates()
      }

      const rates = {}
      const now = new Date()

      CURRENCIES.forEach(currency => {
        if (currency.code === 'USD') {
          rates[currency.code] = { ...currency, rate: 1, lastUpdated: now }
          return
        }
        const rateVal = data.exchangeRates[currency.code]
        rates[currency.code] = { ...currency, rate: typeof rateVal === 'number' ? rateVal : 0, lastUpdated: now }
      })

      return rates
    } catch (err) {
      console.warn('Failed to fetch rates from edge function:', err?.message)
      return this.getFallbackRates()
    }
  },

  // Get Bitcoin and Ethereum prices in USD and other currencies
  async getCryptoPrices() {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-rates', {
        method: 'GET'
      })

      if (error || !data || !data.cryptoPrices) {
        console.warn('Error fetching crypto prices:', error?.message)
        return null
      }

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
    } catch (error) {
      console.warn('Error fetching crypto prices:', error?.message)
      return null
    }
  },

  // Fallback rates (cached, updated manually)
  getFallbackRates() {
    const baseRates = {
      USD: 1,
      EUR: 0.92,
      GBP: 0.79,
      JPY: 154.5,
      CNY: 7.08,
      INR: 83.4,
      CAD: 1.35,
      AUD: 1.52,
      CHF: 0.88,
      SEK: 10.8,
      NZD: 1.62,
      SGD: 1.34,
      HKD: 7.78,
      PHP: 56.5,
      IDR: 16400,
      MYR: 4.36,
      THB: 35.2,
      VND: 24500,
      KRW: 1304,
      ZAR: 17.8,
      BRL: 4.97,
      MXN: 17.1,
      NOK: 10.65,
      DKK: 6.87,
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
    const rates = await this.getGlobalRates()
    
    if (!rates[fromCurrency] || !rates[toCurrency]) {
      throw new Error(`Currency not found: ${fromCurrency} or ${toCurrency}`)
    }

    const fromRate = rates[fromCurrency].rate
    const toRate = rates[toCurrency].rate
    
    // Convert via USD
    const usdAmount = amount / fromRate
    const convertedAmount = usdAmount * toRate

    return {
      fromCurrency,
      toCurrency,
      originalAmount: amount,
      convertedAmount: convertedAmount.toFixed(2),
      rate: (toRate / fromRate).toFixed(6),
      timestamp: new Date()
    }
  }
}
