// Universal Deposit Service - Handles all payment methods (fiat, crypto, mobile payments)
// Supports: Stripe, GCash, PayMaya, Bank Transfer, CoinsPH, Thirdweb, Crypto Direct, etc.

import { coinsPhApi } from './coinsPhApi'
import { thirdwebClient } from './thirdwebClient'

const PROJECT_URL = import.meta.env.VITE_PROJECT_URL?.replace(/\/$/, '')
const DEPOSIT_FUNCTION_URL = `${PROJECT_URL}/functions/v1/process-deposit`
const WEBHOOK_BASE_URL = import.meta.env.VITE_WEBHOOK_BASE_URL || PROJECT_URL

export const DEPOSIT_METHODS = {
  // Fiat Payment Methods
  STRIPE: 'stripe',
  BANK_TRANSFER: 'bank_transfer',

  // Mobile Payment Methods (Asia-Pacific focused)
  GCASH: 'gcash',
  PAYMAYA: 'paymaya',
  INSTAPAY: 'instapay',
  COINS_PH: 'coins_ph',

  // Cryptocurrency Direct
  CRYPTO_DIRECT: 'crypto_direct',

  // Local Transfer Systems
  WISE: 'wise',
  REMITLY: 'remitly',

  // Modern Fintech (Other Payment Methods)
  DLOCAL: 'dlocal',
  CIRCLE: 'circle',
  FLUTTERWAVE: 'flutterwave',
  CHECKOUT: 'checkout',
  MOONPAY: 'moonpay',
  RAMP: 'ramp',
  BINANCE_PAY: 'binance_pay',
  CRYPTO_COM_PAY: 'crypto_com_pay',

  // Direct Wallet
  WALLET_BALANCE: 'wallet_balance'
}

export const CURRENCY_CODES = {
  USD: 'USD',
  PHP: 'PHP',
  EUR: 'EUR',
  GBP: 'GBP',
  JPY: 'JPY',
  AUD: 'AUD',
  CAD: 'CAD',
  SGD: 'SGD',
  HKD: 'HKD',
  INR: 'INR',
  MXN: 'MXN',
  BRL: 'BRL',
  ZAR: 'ZAR',
  USDC: 'USDC',
  USDT: 'USDT',
  ETH: 'ETH',
  BTC: 'BTC',
  SOL: 'SOL'
}

export const PAYMENT_REGIONS = {
  ASIA_PACIFIC: {
    methods: [DEPOSIT_METHODS.GCASH, DEPOSIT_METHODS.PAYMAYA, DEPOSIT_METHODS.INSTAPAY, DEPOSIT_METHODS.COINS_PH],
    currencies: [CURRENCY_CODES.PHP, CURRENCY_CODES.SGD, CURRENCY_CODES.AUD],
    countries: ['PH', 'SG', 'AU', 'NZ', 'MY', 'TH', 'ID', 'VN']
  },
  NORTH_AMERICA: {
    methods: [DEPOSIT_METHODS.STRIPE, DEPOSIT_METHODS.BANK_TRANSFER, DEPOSIT_METHODS.PAYPAL],
    currencies: [CURRENCY_CODES.USD, CURRENCY_CODES.CAD],
    countries: ['US', 'CA', 'MX']
  },
  EUROPE: {
    methods: [DEPOSIT_METHODS.STRIPE, DEPOSIT_METHODS.WISE, DEPOSIT_METHODS.BANK_TRANSFER],
    currencies: [CURRENCY_CODES.EUR, CURRENCY_CODES.GBP, CURRENCY_CODES.CHF],
    countries: ['DE', 'FR', 'UK', 'IT', 'ES', 'NL', 'BE', 'AT', 'SE', 'DK', 'NO', 'FI', 'PL']
  },
  AFRICA: {
    methods: [DEPOSIT_METHODS.BANK_TRANSFER, DEPOSIT_METHODS.REMITLY],
    currencies: [CURRENCY_CODES.ZAR, CURRENCY_CODES.NGN],
    countries: ['ZA', 'NG', 'KE', 'GH', 'ET']
  },
  LATIN_AMERICA: {
    methods: [DEPOSIT_METHODS.STRIPE, DEPOSIT_METHODS.WISE, DEPOSIT_METHODS.BANK_TRANSFER],
    currencies: [CURRENCY_CODES.MXN, CURRENCY_CODES.BRL, CURRENCY_CODES.ARS],
    countries: ['MX', 'BR', 'AR', 'CL', 'CO', 'PE']
  },
  GLOBAL: {
    methods: [DEPOSIT_METHODS.CRYPTO_DIRECT, DEPOSIT_METHODS.WALLET_BALANCE],
    currencies: Object.values(CURRENCY_CODES),
    countries: []
  }
}

export class DepositService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient
    this.user = null
    this.wallet = null
  }

  /**
   * Initialize deposit service with user and wallet
   */
  async initialize(userId) {
    try {
      // Fetch user and wallet in parallel for better performance
      const [userResult, walletResult] = await Promise.all([
        this.supabase
          .from('users')
          .select('id, email, country_code, created_at')
          .eq('id', userId)
          .single(),
        this.supabase
          .from('wallets')
          .select('id, user_id, balance, currency_code, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
          .limit(1)
      ])

      const { data: user, error: userError } = userResult
      const { data: wallets, error: walletError } = walletResult

      if (userError) throw userError
      if (walletError) throw walletError

      this.user = user
      this.wallet = wallets?.[0]

      if (!this.wallet) {
        throw new Error('User has no wallet. Create a wallet first.')
      }

      return { user, wallet: this.wallet }
    } catch (error) {
      console.error('DepositService initialization failed:', error)
      throw error
    }
  }

  /**
   * Get available deposit methods for user based on region/country
   */
  getAvailableMethods(userCountry = 'US', userCurrency = 'USD') {
    const methods = []
    const otherMethods = []

    // Find matching region
    let region = PAYMENT_REGIONS.GLOBAL
    for (const [regionName, regionData] of Object.entries(PAYMENT_REGIONS)) {
      if (regionName !== 'GLOBAL' && regionData.countries.includes(userCountry)) {
        region = regionData
        break
      }
    }

    // Get methods available for region
    const availableMethods = region.methods
    const supportedCurrencies = region.currencies

    availableMethods.forEach(methodId => {
      methods.push(this.getMethodDetails(methodId, userCurrency))
    })

    // Add "Other Payment Methods" (modern fintech)
    const otherPaymentMethods = [
      DEPOSIT_METHODS.DLOCAL,
      DEPOSIT_METHODS.CIRCLE,
      DEPOSIT_METHODS.FLUTTERWAVE,
      DEPOSIT_METHODS.CHECKOUT,
      DEPOSIT_METHODS.MOONPAY,
      DEPOSIT_METHODS.RAMP,
      DEPOSIT_METHODS.BINANCE_PAY,
      DEPOSIT_METHODS.CRYPTO_COM_PAY
    ]

    otherPaymentMethods.forEach(methodId => {
      const methodDetail = this.getMethodDetails(methodId, userCurrency)
      if (methodDetail) {
        otherMethods.push(methodDetail)
      }
    })

    return {
      methods,
      otherMethods,
      supportedCurrencies,
      region: Object.keys(PAYMENT_REGIONS).find(k => PAYMENT_REGIONS[k] === region)
    }
  }

  /**
   * Get details for a specific payment method
   */
  getMethodDetails(methodId, userCurrency = 'USD') {
    const methodConfig = {
      [DEPOSIT_METHODS.STRIPE]: {
        id: DEPOSIT_METHODS.STRIPE,
        name: 'Stripe (Credit/Debit Card)',
        icon: '💳',
        description: 'Pay with credit or debit card',
        processingTime: '1-3 days',
        fees: '2.9% + $0.30 USD',
        minAmount: 1,
        maxAmount: 99999,
        currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
        requiredFields: ['cardToken', 'amount'],
        webhookSupported: true,
        available: true
      },
      [DEPOSIT_METHODS.GCASH]: {
        id: DEPOSIT_METHODS.GCASH,
        name: 'GCash',
        icon: '📱',
        description: 'Instant mobile payment (PH)',
        processingTime: 'Instant',
        fees: 'No fee',
        minAmount: 100,
        maxAmount: 50000,
        currencies: ['PHP'],
        requiredFields: ['phoneNumber', 'amount'],
        webhookSupported: true,
        qrCodeSupported: true
      },
      [DEPOSIT_METHODS.PAYMAYA]: {
        id: DEPOSIT_METHODS.PAYMAYA,
        name: 'PayMaya',
        icon: '💳',
        description: 'Mobile wallet & card (PH)',
        processingTime: 'Instant',
        fees: 'No fee',
        minAmount: 100,
        maxAmount: 50000,
        currencies: ['PHP'],
        requiredFields: ['phoneNumber', 'amount'],
        webhookSupported: true
      },
      [DEPOSIT_METHODS.INSTAPAY]: {
        id: DEPOSIT_METHODS.INSTAPAY,
        name: 'InstaPay',
        icon: '⚡',
        description: 'Instant bank transfer (PH)',
        processingTime: 'Instant',
        fees: '5-10 PHP',
        minAmount: 100,
        maxAmount: 100000,
        currencies: ['PHP'],
        requiredFields: ['bankCode', 'accountNumber', 'amount'],
        webhookSupported: true
      },
      [DEPOSIT_METHODS.COINS_PH]: {
        id: DEPOSIT_METHODS.COINS_PH,
        name: 'Coins.ph',
        icon: '₿',
        description: 'Crypto to fiat gateway (PH)',
        processingTime: 'Instant to 1 day',
        fees: '0.5-1%',
        minAmount: 500,
        maxAmount: 1000000,
        currencies: ['PHP', 'USD'],
        requiredFields: ['cryptoAmount', 'cryptoSymbol', 'amount'],
        webhookSupported: true
      },
      [DEPOSIT_METHODS.CRYPTO_DIRECT]: {
        id: DEPOSIT_METHODS.CRYPTO_DIRECT,
        name: 'Direct Cryptocurrency Transfer',
        icon: '₿',
        description: 'Send crypto directly from any wallet',
        processingTime: 'Varies by blockchain (typically 10 minutes - 1 hour)',
        fees: 'Network fees only',
        minAmount: 0.001,
        maxAmount: 999999,
        currencies: ['BTC', 'ETH', 'USDC', 'USDT', 'SOL', 'USDC', 'BNB', 'MATIC', 'AVAX', 'ARB'],
        requiredFields: ['cryptoAmount', 'cryptoSymbol', 'chainId'],
        webhookSupported: true,
        blockchainSupported: true,
        available: true
      },
      [DEPOSIT_METHODS.BANK_TRANSFER]: {
        id: DEPOSIT_METHODS.BANK_TRANSFER,
        name: 'Bank Transfer (International)',
        icon: '🏦',
        description: 'Direct bank-to-bank transfer',
        processingTime: '1-5 days',
        fees: 'Varies by bank (5-30 USD)',
        minAmount: 100,
        maxAmount: 999999,
        currencies: ['USD', 'EUR', 'GBP', 'AUD', 'CAD'],
        requiredFields: ['bankName', 'accountNumber', 'amount'],
        webhookSupported: false
      },
      [DEPOSIT_METHODS.WISE]: {
        id: DEPOSIT_METHODS.WISE,
        name: 'Wise (TransferWise)',
        icon: '🌍',
        description: 'Low-cost international transfer',
        processingTime: '1-3 days',
        fees: '0.41% or less',
        minAmount: 100,
        maxAmount: 999999,
        currencies: ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'PHP', 'SGD'],
        requiredFields: ['recipientId', 'amount'],
        webhookSupported: true
      },
      [DEPOSIT_METHODS.REMITLY]: {
        id: DEPOSIT_METHODS.REMITLY,
        name: 'Remitly',
        icon: '💸',
        description: 'Remittance & money transfer',
        processingTime: 'Instant to 1 day',
        fees: '0-2%',
        minAmount: 1,
        maxAmount: 10000,
        currencies: ['USD', 'PHP', 'MXN', 'INR'],
        requiredFields: ['recipientCountry', 'amount'],
        webhookSupported: true
      },
      [DEPOSIT_METHODS.PAYPAL]: {
        id: DEPOSIT_METHODS.PAYPAL,
        name: 'PayPal',
        icon: '🅿️',
        description: 'PayPal account transfer',
        processingTime: 'Instant',
        fees: '0.49 USD or 0.79%',
        minAmount: 1,
        maxAmount: 60000,
        currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
        requiredFields: ['paypalEmail', 'amount'],
        webhookSupported: true
      },
      [DEPOSIT_METHODS.WALLET_BALANCE]: {
        id: DEPOSIT_METHODS.WALLET_BALANCE,
        name: 'Existing Wallet Balance',
        icon: '💼',
        description: 'Transfer from another wallet',
        processingTime: 'Instant',
        fees: 'No fee',
        minAmount: 1,
        maxAmount: 999999,
        currencies: Object.values(CURRENCY_CODES),
        requiredFields: ['sourceWalletId', 'amount'],
        webhookSupported: false,
        available: true
      },

      // =============== MODERN FINTECH - OTHER PAYMENT METHODS ===============

      [DEPOSIT_METHODS.DLOCAL]: {
        id: DEPOSIT_METHODS.DLOCAL,
        name: 'dLocal',
        icon: '🌍',
        description: 'Local payments in 50+ countries (LatAm, Africa, Asia)',
        processingTime: 'Instant to 1 day',
        fees: '2-3%',
        minAmount: 10,
        maxAmount: 500000,
        currencies: ['USD', 'BRL', 'MXN', 'ARS', 'CLP', 'COP', 'PEN', 'UYU', 'ZAR', 'NGN', 'KES'],
        requiredFields: ['paymentMethod', 'amount'],
        webhookSupported: true,
        available: false,
        comingSoon: true,
        regions: ['Latin America', 'Africa', 'Asia-Pacific']
      },

      [DEPOSIT_METHODS.CIRCLE]: {
        id: DEPOSIT_METHODS.CIRCLE,
        name: 'Circle (Stablecoin)',
        icon: '🔵',
        description: 'USDC stablecoin payments & crypto on/off ramps',
        processingTime: 'Instant',
        fees: '0-1%',
        minAmount: 1,
        maxAmount: 999999,
        currencies: ['USDC', 'USD'],
        requiredFields: ['walletAddress', 'amount'],
        webhookSupported: true,
        blockchainSupported: true,
        available: false,
        comingSoon: true,
        chains: ['Ethereum', 'Polygon', 'Arbitrum', 'Solana']
      },

      [DEPOSIT_METHODS.FLUTTERWAVE]: {
        id: DEPOSIT_METHODS.FLUTTERWAVE,
        name: 'Flutterwave',
        icon: '🌊',
        description: 'African payment specialist (Nigeria, Kenya, Ghana)',
        processingTime: 'Instant to 2 days',
        fees: '1.4% + fixed',
        minAmount: 100,
        maxAmount: 100000,
        currencies: ['NGN', 'KES', 'GHS', 'ZAR', 'UGX', 'TZS', 'USD'],
        requiredFields: ['phoneNumber', 'amount'],
        webhookSupported: true,
        available: false,
        comingSoon: true,
        regions: ['Africa']
      },

      [DEPOSIT_METHODS.CHECKOUT]: {
        id: DEPOSIT_METHODS.CHECKOUT,
        name: 'Checkout.com',
        icon: '🛒',
        description: 'Modern European payment processor',
        processingTime: '1-3 days',
        fees: '2.75%',
        minAmount: 1,
        maxAmount: 500000,
        currencies: ['EUR', 'GBP', 'USD', 'CHF', 'SEK', 'DKK', 'NOK'],
        requiredFields: ['paymentToken', 'amount'],
        webhookSupported: true,
        available: false,
        comingSoon: true,
        regions: ['Europe']
      },

      [DEPOSIT_METHODS.MOONPAY]: {
        id: DEPOSIT_METHODS.MOONPAY,
        name: 'MoonPay',
        icon: '🌙',
        description: 'Crypto on/off ramp (buy crypto with fiat globally)',
        processingTime: 'Instant to 1 day',
        fees: '3.75% + fixed',
        minAmount: 20,
        maxAmount: 50000,
        currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'PHP', 'SGD'],
        requiredFields: ['cryptoAddress', 'cryptoSymbol', 'amount'],
        webhookSupported: true,
        blockchainSupported: true,
        available: false,
        comingSoon: true,
        chains: ['Ethereum', 'Polygon', 'Bitcoin', 'Solana', 'Arbitrum']
      },

      [DEPOSIT_METHODS.RAMP]: {
        id: DEPOSIT_METHODS.RAMP,
        name: 'Ramp',
        icon: '🚀',
        description: 'Crypto on/off ramp (international, privacy-focused)',
        processingTime: 'Instant to 2 days',
        fees: '2-4%',
        minAmount: 1,
        maxAmount: 1000000,
        currencies: ['USD', 'EUR', 'GBP', 'PHP', 'INR', 'AUD'],
        requiredFields: ['cryptoAddress', 'cryptoSymbol', 'amount'],
        webhookSupported: true,
        blockchainSupported: true,
        available: false,
        comingSoon: true,
        chains: ['Ethereum', 'Polygon', 'Arbitrum', 'Optimism', 'Solana']
      },

      [DEPOSIT_METHODS.BINANCE_PAY]: {
        id: DEPOSIT_METHODS.BINANCE_PAY,
        name: 'Binance Pay',
        icon: '📊',
        description: 'Crypto-native payments with global reach',
        processingTime: 'Instant',
        fees: '0-0.2%',
        minAmount: 1,
        maxAmount: 999999,
        currencies: ['BUSD', 'USDT', 'BNB', 'ETH', 'BTC'],
        requiredFields: ['binanceEmail', 'amount', 'cryptoSymbol'],
        webhookSupported: true,
        blockchainSupported: true,
        available: false,
        comingSoon: true,
        chains: ['BSC', 'Ethereum', 'Multiple']
      },

      [DEPOSIT_METHODS.CRYPTO_COM_PAY]: {
        id: DEPOSIT_METHODS.CRYPTO_COM_PAY,
        name: 'Crypto.com Pay',
        icon: '🎯',
        description: 'Crypto payments with fiat settlement',
        processingTime: 'Instant to 1 day',
        fees: '1-2%',
        minAmount: 1,
        maxAmount: 500000,
        currencies: ['USDC', 'USDT', 'CRO', 'BTC', 'ETH'],
        requiredFields: ['cryptoWallet', 'amount', 'cryptoSymbol'],
        webhookSupported: true,
        blockchainSupported: true,
        available: false,
        comingSoon: true,
        chains: ['Ethereum', 'Polygon', 'Cronos', 'Multiple']
      }
    }

    return methodConfig[methodId] || null
  }

  /**
   * Initiate a deposit with chosen payment method
   */
  async initiateDeposit(amount, currency, depositMethod, methodDetails = {}) {
    try {
      if (!this.wallet || !this.user) {
        throw new Error('Deposit service not initialized. Call initialize() first.')
      }

      if (amount <= 0) {
        throw new Error('Amount must be greater than 0')
      }

      const methodConfig = this.getMethodDetails(depositMethod)
      if (!methodConfig) {
        throw new Error(`Unsupported deposit method: ${depositMethod}`)
      }

      // Validate amount against method limits
      if (amount < methodConfig.minAmount || amount > methodConfig.maxAmount) {
        throw new Error(`Amount must be between ${methodConfig.minAmount} and ${methodConfig.maxAmount}`)
      }

      // Validate currency
      if (!methodConfig.currencies.includes(currency)) {
        throw new Error(`Currency ${currency} not supported for ${methodConfig.name}`)
      }

      const depositPayload = {
        userId: this.user.id,
        walletId: this.wallet.id,
        amount,
        currency,
        depositMethod,
        methodDetails,
        userEmail: this.user.email,
        userName: this.user.name || 'User',
        webhookUrl: `${WEBHOOK_BASE_URL}/functions/v1/deposit-webhook`
      }

      // Call the main deposit processor function
      const response = await fetch(DEPOSIT_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await this.supabase.auth.getSession())?.data?.session?.access_token}`
        },
        body: JSON.stringify(depositPayload)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || `Deposit initiation failed: ${response.status}`)
      }

      const result = await response.json()

      // Store initial deposit record (or update existing one if edge function created it)
      let deposit = null
      let depositError = null

      if (result.depositId) {
        // Edge function already created the deposit, update it with metadata
        const { data: updated, error: updateError } = await this.supabase
          .from('deposits')
          .update({
            description: `${methodConfig.name} deposit of ${amount} ${currency}`,
            notes: JSON.stringify(methodDetails),
            status: 'pending'
          })
          .eq('id', result.depositId)
          .select()
          .single()

        deposit = updated
        depositError = updateError
      } else {
        // Edge function didn't create deposit, create it now
        const { data: inserted, error: insertError } = await this.supabase
          .from('deposits')
          .insert([{
            user_id: this.user.id,
            wallet_id: this.wallet.id,
            amount,
            currency_code: currency,
            deposit_method: depositMethod,
            status: 'pending',
            payment_reference: result.paymentReference,
            external_tx_id: result.externalId,
            description: `${methodConfig.name} deposit of ${amount} ${currency}`,
            notes: JSON.stringify(methodDetails)
          }])
          .select()
          .single()

        deposit = inserted
        depositError = insertError
      }

      if (depositError) {
        console.error('Failed to record deposit:', depositError)
      }

      return {
        success: true,
        deposit: deposit || { id: result.depositId },
        ...result
      }
    } catch (error) {
      console.error('Deposit initiation error:', error)
      throw error
    }
  }

  /**
   * Get deposit status and details
   */
  async getDepositStatus(depositId) {
    try {
      const { data: deposit, error } = await this.supabase
        .from('deposits')
        .select('*')
        .eq('id', depositId)
        .single()

      if (error) throw error
      return deposit
    } catch (error) {
      console.error('Failed to fetch deposit status:', error)
      throw error
    }
  }

  /**
   * Get user's deposit history
   */
  async getDepositHistory(limit = 50, offset = 0) {
    try {
      if (!this.user) throw new Error('Deposit service not initialized')

      const { data: deposits, error } = await this.supabase
        .from('deposits')
        .select('*')
        .eq('user_id', this.user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error
      return deposits || []
    } catch (error) {
      console.error('Failed to fetch deposit history:', error)
      throw error
    }
  }

  /**
   * Get deposit summary stats
   */
  async getDepositStats() {
    try {
      if (!this.user) throw new Error('Deposit service not initialized')

      const { data: stats, error } = await this.supabase
        .from('deposits')
        .select('amount, status, currency_code')
        .eq('user_id', this.user.id)

      if (error) throw error

      const summary = {
        totalDeposited: 0,
        totalPending: 0,
        totalCompleted: 0,
        depositCount: 0,
        byMethod: {},
        byCurrency: {}
      }

      stats?.forEach(deposit => {
        summary.depositCount++
        
        if (deposit.status === 'completed') {
          summary.totalCompleted += parseFloat(deposit.amount)
        } else if (deposit.status === 'pending') {
          summary.totalPending += parseFloat(deposit.amount)
        }

        summary.totalDeposited += parseFloat(deposit.amount)
      })

      return summary
    } catch (error) {
      console.error('Failed to fetch deposit stats:', error)
      throw error
    }
  }

  /**
   * Cancel a pending deposit
   */
  async cancelDeposit(depositId) {
    try {
      const { data: deposit, error: fetchError } = await this.supabase
        .from('deposits')
        .select('*')
        .eq('id', depositId)
        .single()

      if (fetchError) throw fetchError

      if (deposit.status !== 'pending' && deposit.status !== 'processing') {
        throw new Error(`Cannot cancel deposit with status: ${deposit.status}`)
      }

      const { data: updated, error: updateError } = await this.supabase
        .from('deposits')
        .update({ status: 'cancelled' })
        .eq('id', depositId)
        .select()
        .single()

      if (updateError) throw updateError
      return updated
    } catch (error) {
      console.error('Failed to cancel deposit:', error)
      throw error
    }
  }

  /**
   * Validate deposit for fraud/limits
   */
  async validateDeposit(amount, currency, method) {
    try {
      // Check user deposit limits (daily, monthly)
      const { data: deposits, error } = await this.supabase
        .from('deposits')
        .select('amount, created_at, status')
        .eq('user_id', this.user.id)
        .eq('status', 'completed')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

      if (error) throw error

      const monthlyTotal = deposits?.reduce((sum, d) => sum + parseFloat(d.amount), 0) || 0
      const dailyDeposits = deposits?.filter(d => {
        const depositDate = new Date(d.created_at).toDateString()
        const today = new Date().toDateString()
        return depositDate === today
      }) || []
      const dailyTotal = dailyDeposits.reduce((sum, d) => sum + parseFloat(d.amount), 0)

      // Set conservative limits
      const limits = {
        daily: 50000,
        monthly: 500000
      }

      return {
        valid: dailyTotal + amount <= limits.daily && monthlyTotal + amount <= limits.monthly,
        dailyUsed: dailyTotal,
        monthlyUsed: monthlyTotal,
        limits,
        warnings: []
      }
    } catch (error) {
      console.error('Deposit validation error:', error)
      return { valid: true, warnings: ['Could not validate, proceeding'] }
    }
  }
}

// Export singleton factory
export async function createDepositService(supabaseClient, userId) {
  const service = new DepositService(supabaseClient)
  await service.initialize(userId)
  return service
}

export default DepositService
