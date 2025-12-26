import { supabase } from './supabaseClient'
import { getPairRate } from './pairsRateService'

/**
 * Service for handling deposits across any currency pair
 * All exchange rates are sourced from the public.pairs table (exconvert data)
 * Supports fiat-to-fiat, crypto-to-crypto, and cross conversions
 */
export const multiCurrencyDepositService = {
  /**
   * Get exchange rate between two currencies from public.pairs table
   * Falls back to base currency conversion if direct pair doesn't exist
   */
  async getExchangeRate(fromCurrency, toCurrency) {
    try {
      // If same currency, rate is 1
      if (fromCurrency === toCurrency) {
        return { rate: 1, fromCurrency, toCurrency, timestamp: new Date() }
      }

      const fromUpper = fromCurrency.toUpperCase()
      const toUpper = toCurrency.toUpperCase()

      // Try direct pair first
      let rate = await getPairRate(fromUpper, toUpper)

      // If direct pair not found, try base currency conversion (USD)
      if (!rate) {
        const baseCurrency = 'USD'

        // Only attempt base conversion if neither currency is USD
        if (fromUpper !== baseCurrency && toUpper !== baseCurrency) {
          const [fromBaseRate, baseToRate] = await Promise.all([
            getPairRate(fromUpper, baseCurrency),
            getPairRate(baseCurrency, toUpper)
          ])

          // If we have both rates, calculate the indirect conversion
          if (fromBaseRate && baseToRate) {
            rate = fromBaseRate * baseToRate
          }
        }
      }

      // If still no rate found, try with alternative base (PHP)
      if (!rate && fromUpper !== 'PHP' && toUpper !== 'PHP') {
        const altBaseCurrency = 'PHP'
        const [fromAltRate, altToRate] = await Promise.all([
          getPairRate(fromUpper, altBaseCurrency),
          getPairRate(altBaseCurrency, toUpper)
        ])

        if (fromAltRate && altToRate) {
          rate = fromAltRate * altToRate
        }
      }

      if (!rate || !isFinite(rate) || rate <= 0) {
        throw new Error(
          `No exchange rate found for ${fromCurrency}→${toCurrency} (tried direct, USD base, and PHP base)`
        )
      }

      return {
        rate,
        fromCurrency,
        toCurrency,
        timestamp: new Date(),
        source: 'public.pairs'
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
   * Populates all metadata fields for complete audit trail
   */
  async createMultiCurrencyDeposit({
    userId,
    walletId,
    amount,
    depositCurrency, // Currency being deposited (source)
    walletCurrency, // Target wallet currency (destination)
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

      // Fetch wallet data to ensure it exists and get wallet currency info
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('id, user_id, currency_code')
        .eq('id', walletId)
        .eq('user_id', userId)
        .single()

      if (walletError || !wallet) {
        throw new Error('Wallet not found or access denied')
      }

      // Fetch currency information for both deposit and wallet currencies
      const { data: currencies, error: currError } = await supabase
        .from('currencies')
        .select('code, name, symbol, type')
        .in('code', [depositCurrency.toUpperCase(), walletCurrency.toUpperCase()])

      if (currError) {
        console.warn('Error fetching currency info:', currError)
      }

      const currencyMap = {}
      currencies?.forEach(curr => {
        currencyMap[curr.code] = curr
      })

      const depositCurrencyInfo = currencyMap[depositCurrency.toUpperCase()]
      const walletCurrencyInfo = currencyMap[walletCurrency.toUpperCase()]

      // Convert amount using public.pairs rates
      const conversion = await this.convertAmount(amount, depositCurrency, walletCurrency)

      // Get current timestamp
      const now = new Date()
      const isoTimestamp = now.toISOString()

      // Build comprehensive deposit record with all metadata
      // SCHEMA SEMANTICS:
      // - amount: source amount (what's being deposited)
      // - currency_code: destination/wallet currency (what's received)
      // - original_currency: source currency (what's being deposited)
      // - received_amount: destination amount (what's received in wallet)
      const depositRecord = {
        user_id: userId,
        wallet_id: walletId,

        // Source amount and currency (what's being deposited FROM)
        amount: conversion.fromAmount,
        original_currency: depositCurrency.toUpperCase(),
        original_currency_name: depositCurrencyInfo?.name || depositCurrency,
        original_currency_symbol: depositCurrencyInfo?.symbol || depositCurrency,

        // Destination/wallet currency (what will be received INTO the wallet)
        currency_code: walletCurrency.toUpperCase(),
        currency_name: walletCurrencyInfo?.name || walletCurrency,
        currency_symbol: walletCurrencyInfo?.symbol || walletCurrency,

        // Received amount and currency
        received_currency: walletCurrency.toUpperCase(),
        received_amount: conversion.toAmount,
        converted_amount: conversion.toAmount, // Also store as converted_amount for UI compatibility

        // Exchange rate and rate tracking
        exchange_rate: conversion.rateRounded,
        exchange_rate_at_time: conversion.rateRounded,
        time_based_rate: conversion.rateRounded,
        rate_source: 'public.pairs',
        rate_fetched_at: isoTimestamp,

        // Deposit method and references
        deposit_method: depositMethod,
        payment_reference: paymentReference,
        payment_address: paymentAddress,
        external_tx_id: externalTxId,

        // Status and timestamps
        status: 'pending',
        created_at: isoTimestamp,
        updated_at: isoTimestamp,

        // Metadata with complete transaction context
        metadata: {
          ...metadata,
          conversion_rate: conversion.rateRounded,
          from_currency: depositCurrency.toUpperCase(),
          to_currency: walletCurrency.toUpperCase(),
          created_via: 'multi_currency_deposit_service',
          rate_source: 'public.pairs',
          deposit_type: 'cross_currency',
          created_at: isoTimestamp,
          rate_fetched_at: isoTimestamp
        },

        // Transaction details for audit trail
        notes: {
          original_amount: conversion.fromAmount,
          original_currency: depositCurrency.toUpperCase(),
          converted_amount: conversion.toAmount,
          received_currency: walletCurrency.toUpperCase(),
          exchange_rate: conversion.rateRounded,
          rate_source: 'public.pairs',
          conversion_type: depositCurrency !== walletCurrency ? 'cross_currency' : 'same_currency',
          initiator_type: 'user_deposit',
          user_id: userId,
          wallet_id: walletId
        }
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
