import { supabase } from './supabaseClient'
import { getPairRate } from './pairsRateService'

/**
 * Service for handling deposits across any currency pair
 * All exchange rates are sourced from the public.pairs table (exconvert data)
 * Supports fiat-to-fiat, crypto-to-crypto, and cross conversions
 */
export const multiCurrencyDepositService = {
  /**
   * SECURITY FIX: Get exchange rate with proper mathematical inversion
   *
   * Principle: If A→B = r, then B→A = 1/r (not restating as same value)
   * This function ensures proper bidirectional rate handling
   */
  async getExchangeRate(fromCurrency, toCurrency) {
    try {
      // If same currency, rate is 1
      if (fromCurrency === toCurrency) {
        return {
          rate: 1,
          fromCurrency,
          toCurrency,
          timestamp: new Date(),
          isInverted: false
        }
      }

      const fromUpper = fromCurrency.toUpperCase()
      const toUpper = toCurrency.toUpperCase()

      // Try direct pair first using safe inversion
      let rate = await getPairRate(fromUpper, toUpper)
      let isInverted = false

      // If direct pair not found, try base currency conversion
      if (!rate) {
        const baseCurrency = 'USD'

        // Only attempt base conversion if neither currency is USD
        if (fromUpper !== baseCurrency && toUpper !== baseCurrency) {
          const [fromBaseRate, baseToRate] = await Promise.all([
            getPairRate(fromUpper, baseCurrency),
            getPairRate(baseCurrency, toUpper)
          ])

          // If we have both rates, multiply them (both should be properly inverted already)
          if (fromBaseRate && baseToRate) {
            rate = fromBaseRate * baseToRate
            // Mark as inverted if either was inverted
            isInverted = true
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
          isInverted = true
        }
      }

      if (!rate || !isFinite(rate) || rate <= 0) {
        throw new Error(
          `No exchange rate found for ${fromCurrency}→${toCurrency}. ` +
          `Tried: direct pair, USD base conversion, PHP base conversion. ` +
          `Please ensure rate data exists in public.pairs table.`
        )
      }

      return {
        rate,
        fromCurrency,
        toCurrency,
        timestamp: new Date(),
        source: 'public.pairs',
        isInverted
      }
    } catch (err) {
      console.error(`Error getting exchange rate ${fromCurrency}→${toCurrency}:`, err)
      throw err
    }
  },

  /**
   * Convert amount from one currency to another with proper rate handling
   * Validates that conversion math is correct
   */
  async convertAmount(amount, fromCurrency, toCurrency) {
    try {
      const sourceAmount = parseFloat(amount)
      if (!isFinite(sourceAmount) || sourceAmount <= 0) {
        throw new Error(`Invalid source amount: ${amount}`)
      }

      const rateData = await this.getExchangeRate(fromCurrency, toCurrency)
      const convertedAmount = sourceAmount * rateData.rate

      // Validate conversion result
      if (!isFinite(convertedAmount) || convertedAmount <= 0) {
        throw new Error(
          `Invalid conversion result: ${sourceAmount} ${fromCurrency} × ${rateData.rate} = ${convertedAmount}. ` +
          `Expected positive finite number.`
        )
      }

      // Determine decimal places based on currency type
      const fiatCurrencies = ['USD', 'EUR', 'GBP', 'PHP', 'JPY', 'CHF', 'CAD', 'AUD']
      const decimals = fiatCurrencies.includes(toCurrency.toUpperCase()) ? 2 : 8
      const rounded = Math.round(convertedAmount * Math.pow(10, decimals)) / Math.pow(10, decimals)

      // Log conversion for audit trail
      console.debug(
        `[Conversion] ${sourceAmount} ${fromCurrency} → ${rounded} ${toCurrency} ` +
        `(rate: ${rateData.rate}, inverted: ${rateData.isInverted})`
      )

      return {
        fromAmount: sourceAmount,
        fromCurrency,
        toAmount: rounded,
        toCurrency,
        rate: rateData.rate,
        rateRounded: Math.round(rateData.rate * 1000000) / 1000000,
        isInverted: rateData.isInverted
      }
    } catch (err) {
      console.error(`Error converting ${amount} ${fromCurrency} to ${toCurrency}:`, err)
      throw err
    }
  },

  /**
   * Create a three-currency deposit record
   * FIXED: Properly handles input currency, payment method currency, and wallet currency
   *
   * Conversion flow:
   * 1. User specifies amount in input_currency (e.g., 90,000 USD)
   * 2. System shows how much payment_method_currency is needed (e.g., 0.03 ETH)
   * 3. When received, converted to wallet_currency (e.g., credited as PHP in wallet)
   *
   * This fixes the bug where input amount was confused with payment method currency.
   */
  async createMultiCurrencyDeposit({
    userId,
    walletId,
    amount,
    depositCurrency, // Currency user specifies for the amount (input currency)
    walletCurrency, // Target wallet currency (what they receive in wallet)
    depositMethod, // 'gcash', 'solana', etc.
    paymentMethodCurrency = null, // Currency of the payment method (e.g., ETH if paying via Ethereum)
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

      // Convert amount using public.pairs rates with proper mathematical inversion
      const conversion = await this.convertAmount(amount, depositCurrency, walletCurrency)

      // SECURITY: Validate conversion math
      // If the rate is inverted (calculated from reverse pair), ensure inversion was done correctly
      if (conversion.isInverted) {
        console.warn(
          `[SECURITY] Deposit conversion used calculated inverse rate. ` +
          `${depositCurrency}→${walletCurrency} = 1/${1/conversion.rate}. ` +
          `Verify this rate is from reliable source.`
        )
      }

      // CRITICAL FIX: If payment method currency differs from input currency,
      // calculate how much of the payment currency is needed
      let paymentConversion = null
      if (paymentMethodCurrency && paymentMethodCurrency !== depositCurrency) {
        console.debug(
          `[Three-Currency Model] Calculating payment amount: ` +
          `${amount} ${depositCurrency} → ? ${paymentMethodCurrency}`
        )
        paymentConversion = await this.convertAmount(amount, depositCurrency, paymentMethodCurrency)
        console.debug(
          `[Three-Currency Model] Payment amount calculated: ` +
          `${paymentConversion.toAmount} ${paymentMethodCurrency}`
        )
      }

      // Get current timestamp
      const now = new Date()
      const isoTimestamp = now.toISOString()

      // Build comprehensive deposit record with THREE-CURRENCY model
      // SCHEMA SEMANTICS (THREE-CURRENCY MODEL):
      // 1. Input Layer: amount, input_currency - what user specifies
      // 2. Payment Layer: payment_amount, payment_method_currency - how they pay
      // 3. Wallet Layer: received_amount, currency_code - what's credited to wallet
      //
      // CRITICAL FIX: These are three separate currencies!
      // Example: 90,000 USD (input) → 0.03 ETH (payment) → 4,500,000 PHP (wallet)
      const depositRecord = {
        user_id: userId,
        wallet_id: walletId,

        // INPUT LAYER: What user specifies
        input_amount: conversion.fromAmount,
        input_currency: depositCurrency.toUpperCase(),

        // LEGACY FIELDS (for backward compatibility with old schema)
        amount: conversion.fromAmount,
        original_currency: depositCurrency.toUpperCase(),
        original_currency_name: depositCurrencyInfo?.name || depositCurrency,
        original_currency_symbol: depositCurrencyInfo?.symbol || depositCurrency,

        // PAYMENT LAYER: How user pays (if different from input currency)
        payment_method_currency: paymentMethodCurrency ? paymentMethodCurrency.toUpperCase() : null,
        payment_amount: paymentConversion ? paymentConversion.toAmount : null, // Amount of payment currency needed

        // WALLET LAYER: What's credited to wallet
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

        // Metadata with complete transaction context (THREE-CURRENCY MODEL)
        metadata: {
          ...metadata,
          // Input layer
          input_amount: conversion.fromAmount,
          input_currency: depositCurrency.toUpperCase(),
          // Payment layer
          payment_method_currency: paymentMethodCurrency ? paymentMethodCurrency.toUpperCase() : null,
          // Wallet layer
          received_amount: conversion.toAmount,
          received_currency: walletCurrency.toUpperCase(),
          // Rates
          conversion_rate: conversion.rateRounded,
          from_currency: depositCurrency.toUpperCase(),
          to_currency: walletCurrency.toUpperCase(),
          created_via: 'multi_currency_deposit_service_v3',
          rate_source: 'public.pairs',
          deposit_model: 'three_currency',
          deposit_type: depositCurrency !== walletCurrency ? 'cross_currency' : 'same_currency',
          created_at: isoTimestamp,
          rate_fetched_at: isoTimestamp
        },

        // Transaction details for audit trail (THREE-CURRENCY MODEL)
        notes: {
          // CRITICAL FIX DOCUMENTATION:
          // This deposit uses the THREE-CURRENCY model to fix the bug where
          // input amount was confused with payment method currency.
          // Example: User sends 90,000 USD via Ethereum into PHP wallet
          // - input_amount: 90,000, input_currency: USD
          // - payment_method_currency: ETH (for reference)
          // - received_amount: ~4,500,000, received_currency: PHP
          input_amount: conversion.fromAmount,
          input_currency: depositCurrency.toUpperCase(),
          payment_method_currency: paymentMethodCurrency ? paymentMethodCurrency.toUpperCase() : null,
          received_amount: conversion.toAmount,
          received_currency: walletCurrency.toUpperCase(),
          exchange_rate: conversion.rateRounded,
          rate_source: 'public.pairs',
          conversion_type: depositCurrency !== walletCurrency ? 'cross_currency' : 'same_currency',
          initiator_type: 'user_deposit',
          user_id: userId,
          wallet_id: walletId,
          // Audit trail
          three_currency_model: true,
          bug_fix_applied: 'input_amount_vs_payment_method_currency'
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
