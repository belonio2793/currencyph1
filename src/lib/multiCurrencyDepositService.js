import { supabase } from './supabaseClient'
import { currencyAPI } from './currencyAPI'
import { getMultipleCryptoPrices, getCryptoPrice } from './cryptoRatesService'

/**
 * Service for handling deposits across any currency pair
 * Supports fiat-to-fiat, crypto-to-crypto, and cross conversions
 */
export const multiCurrencyDepositService = {
  /**
   * Get exchange rate between two currencies
   * Handles both fiat and crypto conversions
   */
  async getExchangeRate(fromCurrency, toCurrency) {
    try {
      // If same currency, rate is 1
      if (fromCurrency === toCurrency) {
        return { rate: 1, fromCurrency, toCurrency, timestamp: new Date() }
      }

      // Get rates from database first (cached rates)
      const { data: cachedRate, error: dbError } = await supabase
        .from('rates')
        .select('rate')
        .eq('currency_code', fromCurrency)
        .eq('base_currency', toCurrency)
        .single()

      if (!dbError && cachedRate) {
        return { rate: cachedRate.rate, fromCurrency, toCurrency, timestamp: new Date(), source: 'cached' }
      }

      // Determine currency types
      const fromIsCrypto = ['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOGE', 'LTC', 'BCH', 'USDT', 'USDC'].includes(fromCurrency)
      const toIsCrypto = ['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOGE', 'LTC', 'BCH', 'USDT', 'USDC'].includes(toCurrency)

      let rate = null

      if (fromIsCrypto && toIsCrypto) {
        // Crypto to crypto: get both in USD, then calculate ratio
        const [fromPrice, toPrice] = await Promise.all([
          getCryptoPrice(fromCurrency, 'USD'),
          getCryptoPrice(toCurrency, 'USD')
        ])
        if (fromPrice && toPrice) {
          rate = fromPrice / toPrice
        }
      } else if (!fromIsCrypto && !toIsCrypto) {
        // Fiat to fiat: use currencyAPI
        const rates = await currencyAPI.getGlobalRates()
        const fromRate = rates?.[fromCurrency]?.rate || rates?.[fromCurrency]
        const toRate = rates?.[toCurrency]?.rate || rates?.[toCurrency]
        if (fromRate && toRate) {
          rate = fromRate / toRate
        }
      } else {
        // Mixed: crypto to fiat or fiat to crypto via USD
        let cryptoPrice = null
        if (fromIsCrypto) {
          // Crypto to fiat
          cryptoPrice = await getCryptoPrice(fromCurrency, 'USD')
          const rates = await currencyAPI.getGlobalRates()
          const toRate = rates?.[toCurrency]?.rate || rates?.[toCurrency]
          if (cryptoPrice && toRate) {
            rate = cryptoPrice / toRate
          }
        } else {
          // Fiat to crypto
          cryptoPrice = await getCryptoPrice(toCurrency, 'USD')
          const rates = await currencyAPI.getGlobalRates()
          const fromRate = rates?.[fromCurrency]?.rate || rates?.[fromCurrency]
          if (cryptoPrice && fromRate) {
            rate = fromRate / cryptoPrice
          }
        }
      }

      if (!rate || !isFinite(rate) || rate <= 0) {
        throw new Error(`Invalid rate calculated: ${rate}`)
      }

      return {
        rate,
        fromCurrency,
        toCurrency,
        timestamp: new Date(),
        source: 'api'
      }
    } catch (err) {
      console.error(`Error getting exchange rate ${fromCurrency}→${toCurrency}:`, err)
      throw err
    }
  },

  /**
   * Convert amount from one currency to another
   */
  async convertAmount(amount, fromCurrency, toCurrency) {
    try {
      const rateData = await this.getExchangeRate(fromCurrency, toCurrency)
      const convertedAmount = parseFloat(amount) * rateData.rate

      // Validate result
      if (!isFinite(convertedAmount) || convertedAmount <= 0) {
        throw new Error('Invalid conversion result')
      }

      // Round to appropriate decimal places
      const decimals = ['USD', 'EUR', 'GBP', 'PHP', 'JPY'].includes(toCurrency) ? 2 : 8
      const rounded = Math.round(convertedAmount * Math.pow(10, decimals)) / Math.pow(10, decimals)

      return {
        fromAmount: parseFloat(amount),
        fromCurrency,
        toAmount: rounded,
        toCurrency,
        rate: rateData.rate,
        rateRounded: Math.round(rateData.rate * 1000000) / 1000000
      }
    } catch (err) {
      console.error(`Error converting ${amount} ${fromCurrency} to ${toCurrency}:`, err)
      throw err
    }
  },

  /**
   * Create a multi-currency deposit record
   * Handles all validation and conversion
   */
  async createMultiCurrencyDeposit({
    userId,
    walletId,
    amount,
    depositCurrency, // Currency being deposited
    walletCurrency, // Target wallet currency
    depositMethod, // 'gcash', 'solana', etc.
    paymentReference = null,
    paymentAddress = null,
    externalTxId = null,
    metadata = {}
  }) {
    try {
      // Validate inputs
      if (!userId || !walletId || !amount || !depositCurrency || !walletCurrency || !depositMethod) {
        throw new Error('Missing required fields for deposit')
      }

      // Fetch wallet data to ensure it exists
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('id, user_id, currency_code')
        .eq('id', walletId)
        .eq('user_id', userId)
        .single()

      if (walletError || !wallet) {
        throw new Error('Wallet not found or access denied')
      }

      // Convert amount
      const conversion = await this.convertAmount(amount, depositCurrency, walletCurrency)

      // Build deposit record
      const depositRecord = {
        user_id: userId,
        wallet_id: walletId,
        amount: conversion.fromAmount,
        currency_code: depositCurrency, // Source currency
        received_currency: walletCurrency, // Destination currency
        exchange_rate: conversion.rateRounded,
        converted_amount: conversion.toAmount,
        deposit_method: depositMethod,
        payment_reference: paymentReference,
        payment_address: paymentAddress,
        external_tx_id: externalTxId,
        status: 'pending',
        metadata: {
          ...metadata,
          conversion_rate: conversion.rateRounded,
          from_currency: depositCurrency,
          to_currency: walletCurrency,
          created_via: 'multi_currency_deposit_service'
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Insert into database
      const { data: deposit, error: insertError } = await supabase
        .from('deposits')
        .insert([depositRecord])
        .select()
        .single()

      if (insertError) {
        throw insertError
      }

      return {
        success: true,
        deposit,
        conversion
      }
    } catch (err) {
      console.error('Error creating multi-currency deposit:', err)
      return {
        success: false,
        error: err.message || 'Failed to create deposit'
      }
    }
  },

  /**
   * Get all available currency pairs for deposits
   * Based on user's wallets and available currencies
   */
  async getAvailablePairs(userId) {
    try {
      // Get user's wallets
      const { data: wallets, error: walletsError } = await supabase
        .from('wallets')
        .select('currency_code, currency_type')
        .eq('user_id', userId)

      if (walletsError) throw walletsError

      // Get all active currencies
      const { data: currencies, error: currenciesError } = await supabase
        .from('currencies')
        .select('code, type, name')
        .eq('active', true)

      if (currenciesError) throw currenciesError

      // Build pairs: from each available currency to each wallet
      const pairs = []
      const walletCodes = new Set(wallets?.map(w => w.currency_code) || [])

      currencies?.forEach(currency => {
        walletCodes.forEach(walletCode => {
          if (currency.code !== walletCode) {
            pairs.push({
              from: {
                code: currency.code,
                type: currency.type,
                name: currency.name
              },
              to: {
                code: walletCode,
                type: wallets.find(w => w.currency_code === walletCode).currency_type,
                name: wallets.find(w => w.currency_code === walletCode).currency_code
              }
            })
          }
        })
      })

      return pairs
    } catch (err) {
      console.error('Error getting available currency pairs:', err)
      return []
    }
  }
}
