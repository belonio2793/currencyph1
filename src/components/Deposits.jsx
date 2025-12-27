import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import CurrencyCryptoToggle from './FiatCryptoToggle'
import EnhancedWalletDropdown from './EnhancedWalletDropdown'
import SearchableCurrencyDropdown from './SearchableCurrencyDropdown'
import PaymentMethodsGrid from './PaymentMethodsGrid'
import { currencyAPI } from '../lib/currencyAPI'
import { coinsPhApi } from '../lib/coinsPhApi'
import { formatNumber, formatExchangeRate, convertCurrency, isCryptoCurrency } from '../lib/currency'
import { walletService } from '../lib/walletService'
import { multiCurrencyDepositService } from '../lib/multiCurrencyDepositService'
import {
  validateDepositInput,
  validateWalletCurrency,
  validateGCashReference,
  buildDepositRecord,
  validateCompleteDeposit
} from '../lib/depositValidationService'

// Currency symbols
const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  PHP: '₱',
  INR: '₹',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  HKD: 'HK$',
  IDR: 'Rp',
  MYR: 'RM',
  THB: '฿',
  VND: '₫',
  KRW: '₩',
  ZAR: 'R',
  BRL: 'R$',
  MXN: '$',
  NOK: 'kr',
  DKK: 'kr',
  AED: 'د.إ'
}

const DEPOSIT_METHODS = {
  // Fiat Payment Methods
  gcash: {
    id: 'gcash',
    name: 'GCash',
    icon: 'F',
    type: 'fiat',
    description: 'Instant mobile payment (Philippines)'
  },

  // Cryptocurrency Methods
  btc: { id: 'btc', name: 'Bitcoin', icon: 'C', type: 'crypto', description: 'Bitcoin deposit' },
  eth: { id: 'eth', name: 'Ethereum', icon: 'C', type: 'crypto', description: 'Ethereum deposit' },
  usdt: { id: 'usdt', name: 'Tether (USDT)', icon: 'C', type: 'crypto', description: 'USDT deposit' },
  bnb: { id: 'bnb', name: 'Binance Coin', icon: 'C', type: 'crypto', description: 'BNB deposit' },
  xrp: { id: 'xrp', name: 'XRP', icon: 'C', type: 'crypto', description: 'XRP deposit' },
  usdc: { id: 'usdc', name: 'USD Coin', icon: 'C', type: 'crypto', description: 'USDC deposit' },
  sol: { id: 'sol', name: 'Solana', icon: 'C', type: 'crypto', description: 'SOL deposit' },
  trx: { id: 'trx', name: 'Tron', icon: 'C', type: 'crypto', description: 'TRX deposit' },
  doge: { id: 'doge', name: 'Dogecoin', icon: 'C', type: 'crypto', description: 'DOGE deposit' },
  ada: { id: 'ada', name: 'Cardano', icon: 'C', type: 'crypto', description: 'ADA deposit' },
  bch: { id: 'bch', name: 'Bitcoin Cash', icon: 'C', type: 'crypto', description: 'BCH deposit' },
  link: { id: 'link', name: 'Chainlink', icon: 'C', type: 'crypto', description: 'LINK deposit' },
  xlm: { id: 'xlm', name: 'Stellar', icon: 'C', type: 'crypto', description: 'XLM deposit' },
  ltc: { id: 'ltc', name: 'Litecoin', icon: 'C', type: 'crypto', description: 'LTC deposit' },
  sui: { id: 'sui', name: 'Sui', icon: 'C', type: 'crypto', description: 'SUI deposit' },
  avax: { id: 'avax', name: 'Avalanche', icon: 'C', type: 'crypto', description: 'AVAX deposit' },
  hbar: { id: 'hbar', name: 'Hedera', icon: 'C', type: 'crypto', description: 'HBAR deposit' },
  shib: { id: 'shib', name: 'Shiba Inu', icon: 'C', type: 'crypto', description: 'SHIB deposit' },
  pyusd: { id: 'pyusd', name: 'PayPal USD', icon: 'C', type: 'crypto', description: 'PYUSD deposit' },
  wld: { id: 'wld', name: 'Worldcoin', icon: 'C', type: 'crypto', description: 'WLD deposit' },
  ton: { id: 'ton', name: 'The Open Network', icon: 'C', type: 'crypto', description: 'TON deposit' },
  uni: { id: 'uni', name: 'Uniswap', icon: 'C', type: 'crypto', description: 'UNI deposit' },
  dot: { id: 'dot', name: 'Polkadot', icon: 'C', type: 'crypto', description: 'DOT deposit' },
  aave: { id: 'aave', name: 'Aave', icon: 'C', type: 'crypto', description: 'AAVE deposit' }
}

const SOLANA_ADDRESS = 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS'

function DepositsComponent({ userId, globalCurrency = 'PHP' }) {
  // Form state
  const [amount, setAmount] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState(globalCurrency)
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [selectedWallet, setSelectedWallet] = useState(null)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [newWalletCurrency, setNewWalletCurrency] = useState(selectedCurrency)
  const [gcashReferenceNumber, setGcashReferenceNumber] = useState('')

  // Data state
  const [wallets, setWallets] = useState([])
  const [currencies, setCurrencies] = useState([])
  const [deposits, setDeposits] = useState([])
  const [cryptoAddresses, setCryptoAddresses] = useState({}) // { 'BTC': { address: '...', network: '...', provider: 'coins.ph' } }
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [exchangeRates, setExchangeRates] = useState({})
  const [ratesLoading, setRatesLoading] = useState(false)

  // UI state
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [step, setStep] = useState('amount') // amount -> method -> confirm
  const [activeType, setActiveType] = useState('all') // 'all', 'currency' or 'cryptocurrency'
  const [showCryptoAddressModal, setShowCryptoAddressModal] = useState(false)
  const [selectedAddressMethod, setSelectedAddressMethod] = useState(null)
  const [showDepositDetailsModal, setShowDepositDetailsModal] = useState(false)
  const [selectedDepositForDetails, setSelectedDepositForDetails] = useState(null)
  const [initializingWallets, setInitializingWallets] = useState(new Set()) // Track wallets being initialized
  const [showSuccessModal, setShowSuccessModal] = useState(false) // Show success confirmation modal
  const [lastSuccessDeposit, setLastSuccessDeposit] = useState(null) // Store last successful deposit
  const ratesPollingRef = useRef(null) // Track rate polling

  useEffect(() => {
    loadInitialData()
  }, [userId])

  // Fetch rates on component mount
  useEffect(() => {
    fetchExchangeRates()
  }, [])

  // Subscribe to real-time deposit updates
  useEffect(() => {
    if (!userId || userId.includes('guest')) return

    const channel = supabase
      .channel(`deposits-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deposits',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.debug('[Deposits] Deposit update detected:', payload.eventType)
          // Reload deposits when any change is detected
          loadInitialData()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [userId])

  // Auto-refresh wallets while any are initializing
  useEffect(() => {
    if (initializingWallets.size === 0) return

    const interval = setInterval(() => {
      loadInitialData()
    }, 2000) // Refresh every 2 seconds

    return () => clearInterval(interval)
  }, [initializingWallets, userId])

  useEffect(() => {
    let isMounted = true

    const loadRates = async () => {
      if (isMounted) {
        await fetchExchangeRates()
      }
    }

    loadRates()

    // When switching to crypto mode, select first available crypto currency
    if (activeType === 'cryptocurrency' && cryptoAddresses && Object.keys(cryptoAddresses).length > 0) {
      // Select first available crypto with an address
      const availableCode = Object.keys(cryptoAddresses)[0]
      if (availableCode && isMounted) {
        setSelectedCurrency(availableCode)
      }
    }

    return () => {
      isMounted = false
    }
  }, [activeType, cryptoAddresses, selectedWallet, wallets])

  const fetchExchangeRates = async (targetCurr = 'PHP') => {
    try {
      setRatesLoading(true)
      const target = targetCurr.toUpperCase()
      const rates = {}

      // PHASE 1: Try public.pairs as primary source (mirrors /rates.jsx)
      const { data: pairsData } = await supabase
        .from('pairs')
        .select('from_currency, to_currency, rate')
        .eq('to_currency', target)
        .gt('rate', 0)

      if (pairsData) {
        pairsData.forEach(pair => {
          const fromCode = pair.from_currency.toUpperCase()
          if (isFinite(Number(pair.rate)) && Number(pair.rate) > 0) {
            rates[fromCode] = Number(pair.rate)
          }
        })
      }

      // Try reverse pairs from public.pairs
      const missingCodes = currencies
        .map(c => c.code)
        .filter(code => !rates[code] && code !== target)

      if (missingCodes.length > 0) {
        const { data: reversePairs } = await supabase
          .from('pairs')
          .select('from_currency, to_currency, rate')
          .eq('from_currency', target)
          .in('to_currency', missingCodes)
          .gt('rate', 0)

        if (reversePairs) {
          reversePairs.forEach(pair => {
            const toCode = pair.to_currency.toUpperCase()
            if (isFinite(Number(pair.rate)) && Number(pair.rate) > 0) {
              rates[toCode] = 1 / Number(pair.rate)
            }
          })
        }
      }

      // PHASE 2: Fill gaps with currency_rates table
      const stillMissing = currencies
        .map(c => c.code)
        .filter(code => !rates[code] && code !== target)

      if (stillMissing.length > 0) {
        const { data: fiatRates } = await supabase
          .from('currency_rates')
          .select('from_currency, to_currency, rate')
          .in('from_currency', stillMissing)
          .eq('to_currency', target)
          .gt('rate', 0)

        if (fiatRates) {
          fiatRates.forEach(pair => {
            const fromCode = pair.from_currency.toUpperCase()
            if (isFinite(Number(pair.rate)) && Number(pair.rate) > 0) {
              rates[fromCode] = Number(pair.rate)
            }
          })
        }
      }

      // PHASE 3: Fill remaining gaps with cryptocurrency_rates
      const stillMissingCrypto = currencies
        .map(c => c.code)
        .filter(code => !rates[code] && code !== target)

      if (stillMissingCrypto.length > 0) {
        const { data: cryptoRates } = await supabase
          .from('cryptocurrency_rates')
          .select('from_currency, to_currency, rate')
          .in('from_currency', stillMissingCrypto)
          .eq('to_currency', target)
          .gt('rate', 0)

        if (cryptoRates) {
          cryptoRates.forEach(pair => {
            const fromCode = pair.from_currency.toUpperCase()
            if (isFinite(Number(pair.rate)) && Number(pair.rate) > 0) {
              rates[fromCode] = Number(pair.rate)
            }
          })
        }
      }

      // Add target currency as 1.0
      rates[target] = 1.0

      setExchangeRates(rates)
      console.log(`[Deposits] Loaded ${Object.keys(rates).length}/${currencies.length} rates`)
      setRatesLoading(false)
    } catch (err) {
      console.error('[Deposits] Error fetching exchange rates:', err.message)
      setExchangeRates({})
      setRatesLoading(false)
    }
  }

  const loadCryptoAddresses = async () => {
    try {
      const { data: houseWallets, error } = await supabase
        .from('wallets_house')
        .select('currency, currency_name, currency_symbol, address, network, provider')
        .eq('wallet_type', 'crypto')

      if (error) throw error

      // Map to { 'BTC': { address: '...', network: '...', provider: 'internal' }, ... }
      // For multiple networks, store as array
      // Filter out entries where address is null or 'PENDING'
      const addressMap = {}
      if (houseWallets && houseWallets.length > 0) {
        houseWallets.forEach(wallet => {
          // Skip entries without valid addresses
          if (!wallet.address || wallet.address === 'PENDING' || wallet.address === null) {
            return
          }

          if (!addressMap[wallet.currency]) {
            addressMap[wallet.currency] = []
          }
          addressMap[wallet.currency].push({
            address: wallet.address,
            network: wallet.network,
            provider: wallet.provider,
            currency_name: wallet.currency_name,
            currency_symbol: wallet.currency_symbol
          })
        })
        // For single address, use the first one directly; for multiple, use array
        Object.keys(addressMap).forEach(currency => {
          if (addressMap[currency].length === 1) {
            addressMap[currency] = addressMap[currency][0]
          }
        })
      }
      setCryptoAddresses(addressMap)
    } catch (err) {
      console.error('Failed to load crypto addresses:', err)
      setCryptoAddresses({})
    }
  }

  const loadInitialData = async () => {
    try {
      // Don't set loading during auto-refresh (when wallets are initializing)
      const isAutoRefresh = initializingWallets.size > 0
      if (!isAutoRefresh) {
        setLoading(true)
      }
      setError('')

      if (!userId || userId.includes('guest')) {
        setLoading(false)
        return
      }

      // Load wallets, currencies, and crypto addresses in parallel
      const [walletsResult, currenciesResult, cryptosResult] = await Promise.all([
        supabase
          .from('wallets')
          .select('id, user_id, currency_code, balance, total_deposited, total_withdrawn, is_active, created_at, updated_at, account_number, type')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('currency_code'),
        supabase
          .from('currencies')
          .select('code, name, type, symbol, decimals')
          .eq('active', true),
        supabase
          .from('cryptocurrencies')
          .select('code, name, coingecko_id')
      ])

      if (walletsResult.error) throw walletsResult.error
      if (currenciesResult.error) throw currenciesResult.error
      if (cryptosResult.error) throw cryptosResult.error

      let walletsData = walletsResult.data || []
      let allCurrencies = currenciesResult.data || []
      const allCryptos = cryptosResult.data || []

      // Merge cryptocurrency metadata into currencies list
      // This ensures cryptocurrencies have the coingecko_id for better rate calculations
      const cryptoMap = Object.fromEntries(allCryptos.map(c => [c.code, c]))
      allCurrencies = allCurrencies.map(c => {
        if (cryptoMap[c.code]) {
          return { ...c, ...cryptoMap[c.code] }
        }
        return c
      })

      // Add any cryptocurrencies not in the currencies table
      allCryptos.forEach(crypto => {
        if (!allCurrencies.find(c => c.code === crypto.code)) {
          allCurrencies.push({
            code: crypto.code,
            name: crypto.name,
            type: 'crypto',
            symbol: '',
            decimals: 8,
            coingecko_id: crypto.coingecko_id
          })
        }
      })

      // Create a map of currencies for quick lookup
      const currencyMap = Object.fromEntries(
        allCurrencies.map(c => [c.code, c])
      )

      // Ensure user has a PHP wallet for receiving crypto deposits
      const hasPHPWallet = walletsData.some(w => w.currency_code === 'PHP')
      if (!hasPHPWallet) {
        try {
          const { data: newPHPWallet, error: createErr } = await supabase
            .from('wallets')
            .insert([{
              user_id: userId,
              currency_code: 'PHP',
              balance: 0,
              is_active: true
            }])
            .select()
            .single()

          if (!createErr && newPHPWallet) {
            walletsData = [...walletsData, newPHPWallet]
            console.log('Created PHP wallet for user')
          }
        } catch (err) {
          console.warn('Could not auto-create PHP wallet:', err)
        }
      }

      // Enrich wallets with currency type and name info
      const enrichedWallets = walletsData.map(w => ({
        ...w,
        currency_type: currencyMap[w.currency_code]?.type || 'unknown',
        currency_name: currencyMap[w.currency_code]?.name || w.currency_code,
        currency_symbol: currencyMap[w.currency_code]?.symbol || ''
      }))

      setWallets(enrichedWallets)

      // Update initializing wallets: remove any that now exist
      const newWalletIds = new Set(enrichedWallets.map(w => w.currency_code))
      setInitializingWallets(prev => {
        const updated = new Set(prev)
        for (const currencyCode of prev) {
          if (newWalletIds.has(currencyCode)) {
            updated.delete(currencyCode)
          }
        }
        return updated
      })

      // Don't auto-select a wallet - let currency selection trigger wallet selection
      // The useEffect with selectedCurrency will handle selecting the appropriate wallet
      setSelectedWallet(null)

      // For create wallet modal, show ALL active currencies (not just those with existing wallets)
      setCurrencies(allCurrencies)

      // Load user's deposits and crypto addresses in parallel
      const [depositsResult] = await Promise.all([
        supabase
          .from('deposits')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10),
        loadCryptoAddresses()
      ])

      if (depositsResult.error) throw depositsResult.error
      setDeposits(depositsResult.data || [])

      if (!isAutoRefresh) {
        setLoading(false)
      }
    } catch (err) {
      console.error('Error loading data:', err?.message || err)
      setError(err?.message || 'Failed to load wallet data')
      setLoading(false)
    }
  }

  const handleCreateWallet = async () => {
    try {
      setSubmitting(true)
      setError('')

      if (!newWalletCurrency) {
        setError('Please select a currency')
        setSubmitting(false)
        return
      }

      // First, verify the currency exists in the currencies table
      const { data: currencyData, error: currencyError } = await supabase
        .from('currencies')
        .select('code, type, name, symbol')
        .eq('code', newWalletCurrency)
        .single()

      if (currencyError || !currencyData) {
        setError(`Currency ${newWalletCurrency} not found in the system. Please contact support.`)
        setSubmitting(false)
        return
      }

      // Use the wallet service to create the wallet with proper type checking
      const newWallet = await walletService.createWallet(userId, newWalletCurrency)

      if (!newWallet) {
        setError(`Failed to create ${newWalletCurrency} wallet. Please try again.`)
        setSubmitting(false)
        return
      }

      // Verify the wallet was created with the correct type
      if (newWallet.type !== currencyData.type) {
        console.warn(`Wallet type mismatch: expected ${currencyData.type}, got ${newWallet.type}`)
      }

      // Track this wallet as initializing
      setInitializingWallets(prev => new Set([...prev, newWalletCurrency]))

      // Close modal immediately
      setShowWalletModal(false)

      // Show success message
      setSuccess(`${newWalletCurrency} wallet created successfully!`)
      setTimeout(() => setSuccess(''), 5000)

      // Start polling for wallet availability
      await loadInitialData()
    } catch (err) {
      console.error('Error creating wallet:', err)
      setError(err.message || 'Failed to create wallet')
    } finally {
      setSubmitting(false)
    }
  }

  // Calculate the exchange rate between two currencies from pairs data
  const getExchangeRate = (fromCurrency, toCurrency) => {
    if (!fromCurrency || !toCurrency) return null

    if (fromCurrency === toCurrency) return 1

    const fromCurrencyUpper = fromCurrency.toUpperCase()
    const toCurrencyUpper = toCurrency.toUpperCase()

    const fromRate = exchangeRates[fromCurrencyUpper]
    const toRate = exchangeRates[toCurrencyUpper]

    // Both rates must be available (both relative to PHP)
    if (!fromRate || !toRate || !isFinite(fromRate) || !isFinite(toRate) || fromRate <= 0 || toRate <= 0) {
      return null
    }

    // Rate = fromCurrency to PHP / toCurrency to PHP
    // This gives us: 1 fromCurrency = ? toCurrency
    return fromRate / toRate
  }

  const calculateConvertedAmount = () => {
    if (!amount || !selectedWallet) return null

    const numAmount = parseFloat(amount)
    const selectedWalletData = wallets.find(w => w.id === selectedWallet)

    if (!selectedWalletData) return null

    // If same currency, no conversion needed
    if (selectedCurrency === selectedWalletData.currency_code) {
      return numAmount
    }

    // Get exchange rate between the two currencies
    const rate = getExchangeRate(selectedCurrency, selectedWalletData.currency_code)

    if (rate === null) {
      console.warn('[Deposits] Missing or invalid exchange rates:', {
        from: selectedCurrency,
        to: selectedWalletData.currency_code,
        availableRates: Object.keys(exchangeRates)
      })
      return null
    }

    // Convert: amount in destination currency = amount * rate
    const convertedAmount = numAmount * rate

    // Round to appropriate decimal places (crypto: 8, fiat: 2)
    const decimals = selectedWalletData.currency_type === 'crypto' ? 8 : 2
    return Math.round(convertedAmount * Math.pow(10, decimals)) / Math.pow(10, decimals)
  }

  // Calculate the amount user needs to send in the deposit method's currency
  const getDepositMethodAmount = () => {
    if (!amount || !selectedCurrency) return null

    let depositMethodCurrency = selectedCurrency

    // If crypto method is selected, get the crypto currency code
    if (selectedAddressMethod) {
      depositMethodCurrency = selectedAddressMethod.depositCurrencyCode || selectedAddressMethod.cryptoSymbol || selectedCurrency
    }

    if (depositMethodCurrency === selectedCurrency) {
      return parseFloat(amount)
    }

    // Convert from selected currency to deposit method currency
    return convertCurrency(amount, selectedCurrency, depositMethodCurrency, exchangeRates)
  }

  const handleInitiateDeposit = async () => {
    try {
      setSubmitting(true)
      setError('')

      // ===== CLIENT-SIDE VALIDATION BEFORE ANY DATABASE OPERATION =====

      // 1. Validate basic input
      const inputValidation = validateDepositInput(amount, selectedCurrency, selectedWallet)
      if (!inputValidation.isValid) {
        setError(inputValidation.errors.join('; '))
        setSubmitting(false)
        return
      }

      // 2. Get and validate wallet
      const targetWalletData = wallets.find(w => w.id === selectedWallet)
      if (!targetWalletData) {
        setError(`Wallet not found`)
        setSubmitting(false)
        return
      }

      // 3. Validate wallet exists (removed currency match requirement for cross-currency deposits)

      // 4. Validate payment method
      if (!selectedMethod && !selectedAddressMethod) {
        setError('Please select a payment method')
        setSubmitting(false)
        return
      }

      // 5. Validate GCash reference if applicable
      if (selectedMethod === 'gcash') {
        const gcashValidation = validateGCashReference(gcashReferenceNumber)
        if (!gcashValidation.isValid) {
          setError(gcashValidation.error)
          setSubmitting(false)
          return
        }
      }

      // ===== USE MULTI-CURRENCY DEPOSIT SERVICE =====
      // This handles all conversion and validation automatically

      // CRITICAL FIX: Properly handle three-currency model
      // - depositCurrency: Input currency (what user specifies - e.g., USD)
      // - paymentMethodCurrency: Payment method currency (how they pay - e.g., ETH)
      // - walletCurrency: Wallet currency (what they receive in - e.g., PHP)
      // DO NOT confuse these three!

      const depositCurrency = selectedCurrency // INPUT CURRENCY (what user specifies)
      let depositMethodId = selectedMethod
      let paymentMethodCurrency = null // PAYMENT METHOD CURRENCY

      if (selectedAddressMethod) {
        // For crypto method selections, the payment method currency is the crypto symbol
        paymentMethodCurrency = selectedAddressMethod.cryptoSymbol?.toUpperCase() || null
        depositMethodId = selectedAddressMethod.cryptoSymbol?.toLowerCase() || selectedCurrency.toLowerCase()
      }

      const result = await multiCurrencyDepositService.createMultiCurrencyDeposit({
        userId,
        walletId: selectedWallet,
        amount,
        depositCurrency: depositCurrency, // Input currency (what user specifies)
        walletCurrency: targetWalletData.currency_code, // Wallet currency (what they receive)
        depositMethod: depositMethodId,
        paymentMethodCurrency: paymentMethodCurrency, // Payment method currency (NEW - how they pay)
        paymentReference: selectedMethod === 'gcash' ? gcashReferenceNumber : null,
        paymentAddress: activeMethodData?.address || null,
        metadata: {
          activeType,
          methodName: activeMethodData?.name || depositCurrency,
          networkInfo: activeMethodData?.network ? { network: activeMethodData.network, provider: activeMethodData.provider } : null,
          // AUDIT: Document the three-currency model
          depositCurrencyModel: {
            input: depositCurrency,
            payment: paymentMethodCurrency,
            wallet: targetWalletData.currency_code
          }
        }
      })

      if (!result.success) {
        setError(result.error || 'Failed to create deposit')
        setSubmitting(false)
        return
      }

      // Success - Display THREE-CURRENCY model in success message
      const rate = result.conversion.rate
      const formattedRate = formatExchangeRate(rate)

      // Build comprehensive success message with all three currencies
      let successMessage = ''
      if (paymentMethodCurrency && paymentMethodCurrency !== depositCurrency) {
        // Three currencies: input, payment, wallet
        const paymentAmount = result.deposit.payment_amount || result.conversion.toAmount
        successMessage = `✓ Deposit initiated! ${amount} ${depositCurrency} → ${paymentAmount?.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${paymentMethodCurrency} → ${result.conversion.toAmount?.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${targetWalletData.currency_code}`
      } else {
        // Two currencies: input, wallet
        successMessage = `✓ Deposit initiated! ${amount} ${selectedCurrency} → ${result.conversion.toAmount?.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${targetWalletData.currency_code}`
      }

      // Log the actual rate for debugging
      console.debug('[Deposits] Deposit success - Three-Currency Details:', {
        rate: rate,
        inputAmount: result.conversion.fromAmount,
        inputCurrency: result.conversion.fromCurrency,
        paymentMethodCurrency: paymentMethodCurrency,
        paymentAmount: result.deposit.payment_amount,
        receivedAmount: result.conversion.toAmount,
        receivedCurrency: result.conversion.toCurrency,
        formattedRate: formattedRate,
        deposit: result.deposit
      })

      setDeposits([result.deposit, ...deposits])
      setLastSuccessDeposit(result.deposit)
      setSuccess(successMessage)
      setError('')
      setShowSuccessModal(true) // Show success modal with celebration
      setStep('confirm')
    } catch (err) {
      // Catch any unexpected errors
      console.error('Unexpected error creating deposit:', err)
      setError(err?.message || 'An unexpected error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStartNewDeposit = () => {
    setAmount('')
    setSelectedCurrency(globalCurrency)
    setSelectedMethod(null)
    setGcashReferenceNumber('')
    setStep('amount')
    setSuccess('')
    setError('')
  }

  // All wallets available for any currency deposit (EnhancedWalletDropdown handles fiat/crypto separation)
  // Users can now deposit any currency into any wallet with automatic conversion
  const allWallets = wallets

  // Get currency codes that user has wallets for
  const userCurrencyCodes = new Set(wallets.map(w => w.currency_code))

  // Filter currencies by type (show ALL currencies, not just wallet matches)
  // Users can now deposit ANY currency into ANY wallet
  const fiatCurrencies = currencies.filter(c => c.type === 'fiat')
  const cryptoCurrencies = currencies.filter(c => c.type === 'crypto' && cryptoAddresses[c.code])

  // For Create Wallet modal, show currencies they don't have yet
  const availableForNewWallets = activeType === 'currency' || activeType === 'all'
    ? currencies.filter(c => c.type === 'fiat' && !userCurrencyCodes.has(c.code))
    : currencies.filter(c => c.type === 'crypto' && !userCurrencyCodes.has(c.code))

  // Determine available payment methods - show all methods regardless of currency type
  let availableMethods = []

  // Always include fiat payment methods (e.g., GCash) for all currency types
  const fiatMethods = Object.values(DEPOSIT_METHODS).filter(m => m.type === 'fiat')
  availableMethods.push(...fiatMethods)

  // Always include available crypto deposit methods from wallets_house
  // Create crypto methods for all available cryptos, not just selected currency
  Object.keys(cryptoAddresses).forEach(cryptoCode => {
    const data = cryptoAddresses[cryptoCode]
    const addresses = Array.isArray(data) ? data : [data]

    addresses.forEach((addressData, idx) => {
      const cryptoName = addressData.currency_name || cryptoCode
      availableMethods.push({
        id: addresses.length > 1 ? `${cryptoCode.toLowerCase()}-${idx}` : cryptoCode.toLowerCase(),
        name: addresses.length > 1 ? `${cryptoCode} (${addressData.network})` : cryptoCode,
        icon: 'C',
        type: 'crypto',
        description: `Send ${cryptoName} directly to our wallet${addresses.length > 1 ? ` via ${addressData.network}` : ''}`,
        address: addressData.address,
        network: addressData.network,
        provider: addressData.provider,
        cryptoSymbol: cryptoCode,
        cryptoName: cryptoName,
        depositCurrencyCode: cryptoCode
      })
    })
  })

  // When switching currencies, reset method selection since available methods change
  useEffect(() => {
    setSelectedMethod(null)
    setSelectedAddressMethod(null)

    // If we were in confirm step and changed currency, go back to method selection
    if (step === 'confirm') {
      setStep('amount')
    }
  }, [selectedCurrency, activeType])

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setSuccess('Copied to clipboard')
      setTimeout(() => setSuccess(''), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      setError('Failed to copy address')
      setTimeout(() => setError(''), 2000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl font-light text-slate-900 mb-2">currency.ph</div>
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!userId || userId.includes('guest')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Please sign in to make a deposit</p>
        </div>
      </div>
    )
  }

  const selectedWalletData = wallets.find(w => w.id === selectedWallet)

  // Determine which method data to use based on selected method
  let activeMethodData = null
  if (selectedAddressMethod) {
    // For crypto method selections, use the selected address method (works for all currency types)
    activeMethodData = selectedAddressMethod
  } else if (selectedMethod) {
    // For fiat method selections, look up in DEPOSIT_METHODS
    activeMethodData = DEPOSIT_METHODS[selectedMethod] || null
  }

  return (
    <div className="min-h-screen bg-white py-4 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header with Toggle */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Add Funds</h1>
            <p className="text-slate-600 mt-2">
              Deposit cryptocurrencies or fiat to your wallet quickly and securely
            </p>
          </div>
          {(fiatCurrencies.length > 0 || cryptoCurrencies.length > 0) && (
            <CurrencyCryptoToggle active={activeType} onChange={setActiveType} />
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}


        {/* Step 1: Enter Amount */}
        {step === 'amount' && (
          <div className="bg-white rounded-lg shadow border border-slate-200 p-8 mb-6">
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">How much would you like to deposit?</h2>
            <p className="text-slate-600 text-sm mb-6">Deposit any currency to any wallet - we'll handle the conversion automatically</p>

            <div className="space-y-6">
              {/* Create Wallet Button - First Row */}
              <div className="flex items-center justify-end mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setNewWalletCurrency(selectedCurrency)
                    setShowWalletModal(true)
                  }}
                  className="text-sm text-slate-700 hover:text-slate-900 font-medium"
                >
                  + Create Wallet
                </button>
              </div>

              {/* Amount and Currency in 1 Row - 50% Each */}
              <div className="grid grid-cols-2 gap-4">
                {/* Amount Input - 50% Width */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>

                {/* Currency Selection - 50% Width */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Currency</label>
                  <SearchableCurrencyDropdown
                    currencies={currencies}
                    selectedCurrency={selectedCurrency}
                    onChange={setSelectedCurrency}
                    defaultTab="all"
                  />
                </div>
              </div>

              {/* Wallet Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select Wallet
                </label>
                {wallets.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800 font-medium mb-3">
                      You don't have any wallets yet
                    </p>
                    <p className="text-xs text-amber-700 mb-4">
                      Create your first wallet to start making deposits.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setNewWalletCurrency('PHP')
                        setShowWalletModal(true)
                      }}
                      className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition text-sm"
                    >
                      Create Your First Wallet
                    </button>
                  </div>
                ) : (
                  <>
                    <EnhancedWalletDropdown
                      wallets={allWallets}
                      selectedWallet={selectedWallet}
                      onChange={setSelectedWallet}
                    />
                  </>
                )}
              </div>


              {/* Conversion Display */}
              {amount && selectedWallet && (
                <div className={`border rounded-lg p-6 ${!calculateConvertedAmount() ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-300'}`}>
                  {selectedCurrency === selectedWalletData?.currency_code ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600">Deposit Amount</p>
                        <p className="text-xs text-slate-600 font-medium mt-1">✓ No conversion needed - same currency</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-600">You will receive</p>
                        <p className="text-2xl font-bold text-emerald-600 break-words">
                          {parseFloat(amount).toLocaleString(undefined, { maximumFractionDigits: 8 })} {selectedWalletData?.currency_code}
                        </p>
                      </div>
                    </div>
                  ) : activeType === 'cryptocurrency' ? (
                    <>
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">
                        Converting {selectedCurrency} <span className="text-indigo-600">{selectedCurrency}</span> to {selectedWalletData?.currency_name} <span className="text-indigo-600">{selectedWalletData?.currency_code}</span>
                      </h3>
                      <p className="text-sm text-slate-600 mb-4">
                        {!exchangeRates[selectedCurrency] ? (
                          <span>⏳ Fetching rate for {selectedCurrency}...</span>
                        ) : (
                          `${amount} ${selectedCurrency} = ${(parseFloat(amount) * exchangeRates[selectedCurrency]).toLocaleString(undefined, { maximumFractionDigits: isCryptoCurrency(selectedWalletData?.currency_code) ? 8 : 2 })} ${selectedWalletData?.currency_code} as of ${new Date().toLocaleString(undefined, { month: 'short', day: 'numeric' })}`
                        )}
                      </p>
                      <div className="flex gap-4 items-center justify-between flex-wrap">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-600 mb-1">Amount in {selectedCurrency}</p>
                          <p className="text-3xl font-bold text-slate-900 break-words">{parseFloat(amount) || 0}</p>
                        </div>
                        <div className="text-slate-400 text-xl flex-shrink-0">↔</div>
                        <div className="text-right flex-1 min-w-0">
                          <p className="text-xs text-slate-600 mb-1">You receive in {selectedWalletData?.currency_code}</p>
                          <p className={`text-3xl font-bold break-words ${calculateConvertedAmount() ? 'text-indigo-600' : 'text-amber-600'}`}>
                            {calculateConvertedAmount() ? calculateConvertedAmount().toLocaleString(undefined, { maximumFractionDigits: 8 }) : (
                              exchangeRates[selectedCurrency] ? (parseFloat(amount) * exchangeRates[selectedCurrency]).toLocaleString(undefined, { maximumFractionDigits: 8 }) : '⏳'
                            )}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-600">Conversion Rate</p>
                        <p className="text-xs text-slate-500 mt-1 break-words">
                          {!exchangeRates[selectedCurrency] || !exchangeRates[selectedWalletData?.currency_code] ? (
                            <span>⏳ Fetching rates...</span>
                          ) : selectedWalletData?.currency_type === 'crypto' ? (
                            // For fiat-to-crypto conversions
                            `1 ${selectedCurrency} = ${formatExchangeRate(1 / exchangeRates[selectedWalletData?.currency_code])} ${selectedWalletData?.currency_code}`
                          ) : (
                            // For fiat-to-fiat conversions (both rates are USD-based)
                            `1 ${selectedCurrency} = ${formatExchangeRate(exchangeRates[selectedWalletData?.currency_code] / exchangeRates[selectedCurrency])} ${selectedWalletData?.currency_code}`
                          )}
                        </p>
                      </div>
                      <div className="text-right flex-1 min-w-0">
                        <p className="text-sm text-slate-600">You will receive</p>
                        <p className={`text-2xl font-bold break-words ${calculateConvertedAmount() ? 'text-blue-600' : 'text-amber-600'}`}>
                          {calculateConvertedAmount() ? calculateConvertedAmount().toLocaleString(undefined, { maximumFractionDigits: 8 }) : (
                            exchangeRates[selectedCurrency] && exchangeRates[selectedWalletData?.currency_code] ? (
                              selectedWalletData?.currency_type === 'crypto'
                                ? (parseFloat(amount) / exchangeRates[selectedWalletData?.currency_code]).toLocaleString(undefined, { maximumFractionDigits: 8 })
                                : (parseFloat(amount) * (exchangeRates[selectedWalletData?.currency_code] / exchangeRates[selectedCurrency])).toLocaleString(undefined, { maximumFractionDigits: 8 })
                            ) : '⏳'
                          )} {selectedWalletData?.currency_code}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Rate Status Warning */}
              {amount && selectedWallet && !calculateConvertedAmount() && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-amber-900">⚠️ Conversion Rate Not Available</p>
                      <p className="text-xs text-amber-700 mt-1">
                        {ratesLoading
                          ? `Fetching rates for ${selectedCurrency}...`
                          : `Unable to fetch rates for ${selectedCurrency} → ${selectedWalletData?.currency_code}. Please try again.`}
                      </p>
                    </div>
                    {!ratesLoading && (
                      <button
                        onClick={() => {
                          setExchangeRates({})
                          fetchExchangeRates()
                        }}
                        className="ml-4 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded hover:bg-amber-700 transition"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Select Deposit Method / Network */}
              {selectedWallet && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-slate-700">
                      {activeType === 'cryptocurrency' ? 'Blockchain Network' : 'Payment Method'}
                    </label>
                  </div>
                  {availableMethods.length > 0 ? (
                    <PaymentMethodsGrid
                      methods={availableMethods}
                      selectedMethod={selectedMethod}
                      selectedAddressMethod={selectedAddressMethod}
                      onSelectMethod={(method) => {
                        setSelectedMethod(method.id)
                        setStep('confirm')
                      }}
                      onSelectCryptoMethod={(method) => {
                        setSelectedAddressMethod(method)
                        setShowCryptoAddressModal(true)
                      }}
                      amount={amount}
                      selectedCurrency={selectedCurrency}
                      exchangeRates={exchangeRates}
                      walletData={selectedWalletData}
                    />
                  ) : (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                      {activeType === 'cryptocurrency' ? (
                        <>
                          <p className="font-medium mb-2">⚠️ No deposit methods available for {selectedCurrency}</p>
                          <p>This cryptocurrency may not be configured yet. Please select a different currency or contact support.</p>
                        </>
                      ) : (
                        <p>No payment methods available for {selectedCurrency}. Please check your currency selection or contact support.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Payment Instructions */}
        {step === 'confirm' && (activeMethodData || selectedMethod) && selectedWalletData && (
          <div className="bg-white rounded-lg shadow border border-slate-200 p-8 mb-6">
            <h2 className="text-2xl font-semibold text-slate-900 mb-6 break-words">
              {formatNumber(parseFloat(amount) || 0, selectedCurrency)} {selectedCurrency.toUpperCase()} via {activeMethodData?.name || DEPOSIT_METHODS[selectedMethod]?.name || 'Payment'}
            </h2>

            {/* Deposit Summary */}
            <div className="bg-slate-50 rounded-lg p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left side: What user sends */}
                <div>
                  <div className="mb-4">
                    <p className="text-xs text-slate-600 uppercase tracking-wide font-semibold">You Send</p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Amount</p>
                      <p className="text-2xl font-bold text-slate-900 break-words">{formatNumber(parseFloat(amount) || 0, selectedCurrency)} {selectedCurrency.toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">{activeType === 'cryptocurrency' ? 'Network' : 'Payment Method'}</p>
                      <p className="text-lg font-semibold text-slate-900">{activeMethodData.name}</p>
                      {activeMethodData.network && (
                        <p className="text-xs text-blue-600 font-medium mt-1">🔗 {activeMethodData.network}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: What user receives */}
                <div>
                  <div className="mb-4">
                    <p className="text-xs text-slate-600 uppercase tracking-wide font-semibold">You Receive</p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Wallet</p>
                      <p className="text-2xl font-bold text-blue-600 break-words">{formatNumber(calculateConvertedAmount(), selectedWalletData.currency_code)} {selectedWalletData.currency_code}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Destination Wallet</p>
                      <p className="text-lg font-semibold text-slate-900">{selectedWalletData.currency_code}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* THREE-CURRENCY MODEL DISPLAY: Show all three currencies clearly */}
            {selectedAddressMethod && selectedCurrency !== selectedAddressMethod?.cryptoSymbol?.toUpperCase() && (
              <div className="mb-8 p-6 bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50 border-2 border-indigo-300 rounded-lg">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <span className="text-lg">🔄</span> Three-Currency Deposit Model
                </h3>
                <div className="space-y-4">
                  {/* INPUT CURRENCY */}
                  <div className="bg-white p-4 rounded-lg border-l-4 border-blue-500">
                    <p className="text-xs text-slate-600 font-semibold mb-1">1️⃣ INPUT CURRENCY (What you specify)</p>
                    <p className="text-2xl font-bold text-blue-600 break-words">{formatNumber(parseFloat(amount) || 0, selectedCurrency)} {selectedCurrency}</p>
                  </div>

                  {/* PAYMENT CURRENCY */}
                  <div className="flex items-center justify-center">
                    <div className="text-indigo-400 text-2xl">↓</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg border-l-4 border-purple-500">
                    <p className="text-xs text-slate-600 font-semibold mb-1">2️⃣ PAYMENT CURRENCY (How you pay)</p>
                    <p className="text-2xl font-bold text-purple-600 break-words">{getDepositMethodAmount()?.toLocaleString(undefined, {
                      minimumFractionDigits: isCryptoCurrency(selectedAddressMethod?.cryptoSymbol) ? 2 : 2,
                      maximumFractionDigits: isCryptoCurrency(selectedAddressMethod?.cryptoSymbol) ? 8 : 2
                    })} {selectedAddressMethod?.cryptoSymbol?.toUpperCase()}</p>
                    <p className="text-xs text-purple-600 mt-2">Send this amount via {activeMethodData?.name || 'cryptocurrency'}</p>
                  </div>

                  {/* WALLET CURRENCY */}
                  <div className="flex items-center justify-center">
                    <div className="text-indigo-400 text-2xl">↓</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg border-l-4 border-emerald-500">
                    <p className="text-xs text-slate-600 font-semibold mb-1">3️⃣ WALLET CURRENCY (What you receive)</p>
                    <p className="text-2xl font-bold text-emerald-600 break-words">{formatNumber(calculateConvertedAmount(), selectedWalletData?.currency_code)} {selectedWalletData?.currency_code}</p>
                    <p className="text-xs text-emerald-600 mt-2">Credited to your {selectedWalletData?.currency_code} wallet</p>
                  </div>
                </div>

                {/* WARNING BOX */}
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-900 font-medium">
                    ⚠️ Make sure you understand all three steps:
                  </p>
                  <ul className="text-xs text-amber-800 mt-2 space-y-1 ml-4">
                    <li>• You specify: <strong>{formatNumber(parseFloat(amount) || 0, selectedCurrency)} {selectedCurrency}</strong></li>
                    <li>• You send: <strong>{getDepositMethodAmount()?.toLocaleString(undefined, {
                      minimumFractionDigits: isCryptoCurrency(selectedAddressMethod?.cryptoSymbol) ? 2 : 2,
                      maximumFractionDigits: isCryptoCurrency(selectedAddressMethod?.cryptoSymbol) ? 8 : 2
                    })} {selectedAddressMethod?.cryptoSymbol?.toUpperCase()}</strong></li>
                    <li>• You receive: <strong>{formatNumber(calculateConvertedAmount(), selectedWalletData?.currency_code)} {selectedWalletData?.currency_code}</strong></li>
                  </ul>
                </div>
              </div>
            )}

            {/* Exchange Rate Summary */}
            {ratesLoading ? (
              <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-slate-700">Loading exchange rates...</p>
              </div>
            ) : (
              <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-slate-900 mb-4">Exchange Rate Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center gap-4 flex-wrap">
                    <span className="text-slate-700">You Send:</span>
                    <span className="font-semibold text-slate-900 break-words">{formatNumber(parseFloat(amount) || 0, selectedCurrency)} {selectedCurrency}</span>
                  </div>
                  {selectedCurrency !== selectedWalletData.currency_code && (
                    <div className="flex justify-between items-center text-sm text-slate-600 gap-4 flex-wrap">
                      <span>Rate:</span>
                      <span className="break-words">
                        {getExchangeRate(selectedCurrency, selectedWalletData.currency_code) ? (
                          <>1 {selectedCurrency} = {formatExchangeRate(getExchangeRate(selectedCurrency, selectedWalletData.currency_code))} {selectedWalletData.currency_code}</>
                        ) : (
                          '⏳ Loading rate...'
                        )}
                      </span>
                    </div>
                  )}
                  {calculateConvertedAmount() && selectedCurrency !== selectedWalletData.currency_code && (
                    <div className="flex justify-between items-center pt-3 border-t border-blue-200 gap-4 flex-wrap">
                      <span className="text-slate-900 font-medium">You Receive:</span>
                      <span className="text-lg font-bold text-blue-600 break-words">{formatNumber(calculateConvertedAmount(), selectedWalletData.currency_code)} {selectedWalletData.currency_code}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* GCash Reference Number */}
            {selectedMethod === 'gcash' && (
              <div className="mb-8 p-6 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-sm text-slate-600 mb-4 font-medium">Complete your GCash payment using the merchant details:</p>
                <div className="bg-white p-3 rounded border border-slate-300 mb-4">
                  <p className="text-xs text-slate-600"><span className="font-semibold">Mobile No.:</span> 09308510351</p>
                  <p className="text-xs text-slate-600 mt-2"><span className="font-semibold">User ID:</span> •••••••••••4ROQPN</p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">GCash Reference Number</label>
                  <input
                    type="text"
                    value={gcashReferenceNumber}
                    onChange={(e) => setGcashReferenceNumber(e.target.value)}
                    placeholder="Enter your GCash transaction reference (e.g., GCR123456789)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">You'll find this in your GCash app after sending the payment</p>
                </div>
              </div>
            )}

            {/* Cryptocurrency Address QR */}
            {activeMethodData?.type === 'crypto' && (
              <div className="mb-8 p-6 bg-purple-50 border border-purple-200 rounded-lg">
                {activeMethodData?.address ? (
                  <>
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-slate-900 mb-2">Deposit Address</p>
                      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                        <div>
                          <p className="text-slate-600">Currency</p>
                          <p className="font-semibold text-slate-900">{selectedCurrency}</p>
                        </div>
                        <div>
                          <p className="text-slate-600">Network</p>
                          <p className="font-semibold text-slate-900">{activeMethodData.network}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-xs font-medium text-slate-600 mb-2">Copy the address below:</p>
                      <p className="font-mono text-xs bg-white p-3 rounded border border-slate-300 break-all text-slate-800 mb-2">
                        {activeMethodData.address}
                      </p>
                      <button
                        onClick={() => copyToClipboard(activeMethodData.address)}
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                      >
                        Copy Address
                      </button>
                    </div>

                    {activeMethodData.network && (
                      <div className="p-2 bg-slate-50 border border-slate-300 rounded text-xs text-slate-700">
                        <span className="font-semibold">Network: {activeMethodData.network}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-4 bg-yellow-100 border border-yellow-300 rounded text-yellow-800 text-sm">
                    <p className="font-medium">Address not available</p>
                    <p className="mt-2">{activeMethodData.name} via {activeMethodData.network} is not currently configured for deposits.</p>
                  </div>
                )}
              </div>
            )}

            {/* CRITICAL WARNING: Multi-Currency Deposit Confirmation */}
            {selectedAddressMethod && selectedCurrency !== selectedAddressMethod?.cryptoSymbol?.toUpperCase() && (
              <div className="mb-8 p-6 bg-red-50 border-2 border-red-400 rounded-lg">
                <h4 className="font-bold text-red-900 mb-3 flex items-center gap-2">
                  <span className="text-xl">⚠️</span> CRITICAL: Verify Before Sending
                </h4>
                <div className="space-y-3 text-sm text-red-800">
                  <p className="font-semibold">You are making a multi-currency deposit. Understand all three steps:</p>
                  <div className="bg-white p-3 rounded border border-red-200 space-y-2">
                    <div className="flex gap-2">
                      <span className="font-bold text-blue-600 flex-shrink-0">1️⃣</span>
                      <div>
                        <p className="font-semibold">You Specify: {formatNumber(parseFloat(amount) || 0, selectedCurrency)} {selectedCurrency}</p>
                        <p className="text-xs opacity-75">This is the amount you're depositing in your chosen currency</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold text-purple-600 flex-shrink-0">2️⃣</span>
                      <div>
                        <p className="font-semibold">You Send: {getDepositMethodAmount()?.toLocaleString(undefined, {
                          minimumFractionDigits: isCryptoCurrency(selectedAddressMethod?.cryptoSymbol) ? 2 : 2,
                          maximumFractionDigits: isCryptoCurrency(selectedAddressMethod?.cryptoSymbol) ? 8 : 2
                        })} {selectedAddressMethod?.cryptoSymbol?.toUpperCase()}</p>
                        <p className="text-xs opacity-75">This is the ACTUAL amount you need to send (different from step 1!)</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold text-emerald-600 flex-shrink-0">3️⃣</span>
                      <div>
                        <p className="font-semibold">You Receive: {formatNumber(calculateConvertedAmount(), selectedWalletData?.currency_code)} {selectedWalletData?.currency_code}</p>
                        <p className="text-xs opacity-75">This is what gets credited to your wallet</p>
                      </div>
                    </div>
                  </div>
                  <p className="font-bold bg-red-100 p-2 rounded text-red-900 mt-3">
                    🔴 DO NOT send {selectedCurrency} to a {selectedAddressMethod?.cryptoSymbol?.toUpperCase()} address. You will lose your funds!
                  </p>
                </div>
              </div>
            )}

            {/* Important Notes */}
            <div className="mb-8 p-4 bg-slate-50 border border-slate-300 rounded-lg">
              <p className="font-semibold text-slate-900 mb-2">Important:</p>
              <ul className="text-sm text-yellow-800 space-y-1">
                {activeMethodData?.type === 'crypto' && (
                  <>
                    <li>• Only send {activeMethodData.cryptoName} ({activeMethodData.cryptoSymbol}) to this address</li>
                    {activeMethodData.network && <li>• Network: {activeMethodData.network}</li>}
                    <li>• Do not send other tokens or cryptocurrencies</li>
                    <li>• Transactions cannot be reversed</li>
                    <li>• Keep the transaction hash for your records</li>
                  </>
                )}
                {activeMethodData?.type === 'fiat' && (
                  <>
                    <li>• Ensure you have sufficient balance</li>
                    <li>• Double-check the amount before confirming</li>
                    <li>• Transaction may take 1-5 minutes to process</li>
                  </>
                )}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => setStep('amount')}
                disabled={submitting}
                className="flex-1 px-6 py-3 border border-slate-300 rounded-lg text-slate-900 font-medium hover:bg-slate-50 transition disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleInitiateDeposit}
                disabled={submitting || !selectedWalletData || (selectedMethod === 'gcash' && !gcashReferenceNumber.trim())}
                className={`flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                  submitting
                    ? 'opacity-75 cursor-wait'
                    : 'hover:bg-slate-800 active:scale-95'
                } ${submitting || !selectedWalletData || (selectedMethod === 'gcash' && !gcashReferenceNumber.trim()) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {submitting && (
                  <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {submitting ? 'Processing Deposit...' : 'Confirm Deposit'}
              </button>
            </div>
          </div>
        )}

        {/* Recent Deposits */}
        {deposits.length > 0 && (
          <div className="bg-white rounded-lg shadow border border-slate-200 p-8">
            <h3 className="text-xl font-semibold text-slate-900 mb-4">Recent Deposits</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-slate-600 font-medium">You Sent</th>
                    <th className="text-left py-3 px-4 text-slate-600 font-medium">Payment Currency</th>
                    <th className="text-left py-3 px-4 text-slate-600 font-medium">Exchange Rate</th>
                    <th className="text-left py-3 px-4 text-slate-600 font-medium">You Received</th>
                    <th className="text-left py-3 px-4 text-slate-600 font-medium">Reference</th>
                    <th className="text-left py-3 px-4 text-slate-600 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-slate-600 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.slice(0, 5).map(deposit => {
                    // Parse notes to get stored metadata
                    let notesMeta = {}
                    try {
                      if (deposit.notes) {
                        notesMeta = JSON.parse(deposit.notes)
                      }
                    } catch (e) {
                      console.error('Failed to parse deposit notes:', e)
                    }

                    // Get original currency and converted amount from notes or columns
                    const originalCurrency = notesMeta.original_currency || deposit.original_currency || deposit.currency_code
                    const convertedAmount = notesMeta.converted_amount || deposit.converted_amount
                    const depositWallet = wallets.find(w => w.id === deposit.wallet_id)
                    const walletCurrency = notesMeta.wallet_currency || deposit.wallet_currency || depositWallet?.currency_code || deposit.currency_code

                    // Helper function to format numbers with proper decimal/thousand separators
                    const formatAmount = (num, currency = null) => {
                      if (!num && num !== 0) return '—'
                      const numValue = typeof num === 'string' ? parseFloat(num) : num
                      if (isNaN(numValue)) return '—'
                      // Use 8 decimals for crypto, 2 for fiat
                      const maxDecimals = currency && isCryptoCurrency(currency) ? 8 : 2
                      return numValue.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: maxDecimals
                      })
                    }

                    // Calculate exchange rate
                    const exchangeRate = convertedAmount && deposit.amount ? (convertedAmount / deposit.amount) : null

                    return (
                      <tr key={deposit.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {formatAmount(deposit.amount, originalCurrency)} {originalCurrency.toUpperCase()}
                        </td>
                        <td className="py-3 px-4 text-slate-700 text-xs">
                          {notesMeta.payment_method_currency || deposit.payment_method_currency ? (
                            <>
                              <div className="font-medium text-slate-900">
                                {notesMeta.payment_method_currency || deposit.payment_method_currency}
                              </div>
                              {(notesMeta.payment_amount || deposit.payment_amount) && (
                                <div className="text-slate-600">
                                  {formatAmount(notesMeta.payment_amount || deposit.payment_amount, notesMeta.payment_method_currency || deposit.payment_method_currency)}
                                </div>
                              )}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700 text-xs">
                          {exchangeRate ? `1 ${originalCurrency.toUpperCase()} = ${formatExchangeRate(exchangeRate)} ${walletCurrency.toUpperCase()}` : '—'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-emerald-600">
                          {convertedAmount ? `${formatAmount(convertedAmount, walletCurrency)} ${walletCurrency.toUpperCase()}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 font-mono">
                          {deposit.reference_number || deposit.phone_number || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-900">
                            {deposit.status.charAt(0).toUpperCase() + deposit.status.slice(1)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => {
                              setSelectedDepositForDetails(deposit)
                              setShowDepositDetailsModal(true)
                            }}
                            className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create Wallet Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-4 my-4">
            <h3 className="text-xl font-semibold text-slate-900 mb-4">Create New Wallet</h3>
            <p className="text-slate-600 text-sm mb-4">Select a currency for your new wallet</p>

            <select
              value={newWalletCurrency}
              onChange={(e) => setNewWalletCurrency(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white mb-6"
            >
              <option value="">Select a currency</option>
              {availableForNewWallets.length > 0 ? (
                availableForNewWallets.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name}
                  </option>
                ))
              ) : (
                <option disabled>No new currencies available</option>
              )}
            </select>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowWalletModal(false)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded text-slate-900 text-sm font-medium hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWallet}
                disabled={submitting}
                className="flex-1 px-3 py-2 bg-slate-800 text-white rounded text-sm font-medium hover:bg-slate-900 transition disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Wallet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deposit Details Modal */}
      {showDepositDetailsModal && selectedDepositForDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => setShowDepositDetailsModal(false)}>
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-4 sm:p-6 my-4" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const deposit = selectedDepositForDetails
              let notesMeta = {}
              try {
                if (deposit.notes) {
                  notesMeta = JSON.parse(deposit.notes)
                }
              } catch (e) {
                console.warn('Failed to parse deposit notes')
              }

              const originalCurrency = notesMeta.original_currency || deposit.original_currency || deposit.currency_code
              const convertedAmount = notesMeta.converted_amount || deposit.converted_amount
              const depositWallet = wallets.find(w => w.id === deposit.wallet_id)
              const walletCurrency = notesMeta.wallet_currency || deposit.wallet_currency || depositWallet?.currency_code || deposit.currency_code
              const exchangeRate = convertedAmount && deposit.amount ? (convertedAmount / deposit.amount).toFixed(8) : null
              const methodName = DEPOSIT_METHODS[deposit.deposit_method]?.name || deposit.deposit_method.toUpperCase()
              const createdDate = new Date(deposit.created_at)
              const completedDate = deposit.completed_at ? new Date(deposit.completed_at) : null

              return (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">Deposit Details</h3>
                    <button
                      onClick={() => setShowDepositDetailsModal(false)}
                      className="text-slate-500 hover:text-slate-700 text-3xl leading-none"
                    >
                      ×
                    </button>
                  </div>

                  <div className="space-y-3">
                    {/* Transaction Status */}
                    <div className="bg-slate-50 rounded p-3 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">Status</p>
                          <p className="text-lg font-semibold text-slate-900">{deposit.status.toUpperCase()}</p>
                        </div>
                        <span className="px-4 py-2 rounded-full text-sm font-medium bg-slate-200 text-slate-900">
                          {deposit.status.charAt(0).toUpperCase() + deposit.status.slice(1)}
                        </span>
                      </div>
                    </div>

                    {/* Amount Information */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-600 font-semibold mb-1">Original Amount</p>
                        <p className="text-lg font-bold text-slate-900">
                          {deposit.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: isCryptoCurrency(originalCurrency) ? 8 : 2 })} {originalCurrency.toUpperCase()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 font-semibold mb-1">Received Amount</p>
                        <p className="text-lg font-bold text-slate-900">
                          {convertedAmount ? `${convertedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: isCryptoCurrency(walletCurrency) ? 8 : 2 })} ${walletCurrency.toUpperCase()}` : '—'}
                        </p>
                      </div>
                    </div>

                    {/* Exchange Rate */}
                    {exchangeRate && (
                      <div className="border-l-4 border-slate-400 bg-slate-50 p-3 rounded">
                        <p className="text-xs text-slate-600 font-semibold mb-1">Exchange Rate</p>
                        <p className="text-sm font-semibold text-slate-900">1 {originalCurrency.toUpperCase()} = {exchangeRate} {walletCurrency.toUpperCase()}</p>
                      </div>
                    )}

                    {/* Deposit Method & Reference */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-600 font-semibold mb-1">Deposit Method</p>
                        <p className="text-sm font-semibold text-slate-900">{methodName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 font-semibold mb-1">Reference Number</p>
                        <p className="text-xs font-mono text-slate-900 break-all">{deposit.reference_number || deposit.phone_number || '—'}</p>
                      </div>
                    </div>

                    {/* Wallet Information */}
                    <div className="bg-slate-50 rounded p-3 border border-slate-200">
                      <p className="text-xs text-slate-600 font-semibold mb-2">Deposited To Wallet</p>
                      <div className="space-y-1 text-xs">
                        <div>
                          <p className="text-slate-600">Currency: <span className="font-semibold text-slate-900">{depositWallet?.currency_name || walletCurrency}</span></p>
                        </div>
                        <div>
                          <p className="text-slate-600">ID: <span className="font-mono text-slate-900">{depositWallet?.id || deposit.wallet_id}</span></p>
                        </div>
                        {depositWallet?.account_number && (
                          <div>
                            <p className="text-slate-600">Account: <span className="font-mono text-slate-900">{depositWallet.account_number}</span></p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Timestamps */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-slate-600 font-semibold mb-1">Created At</p>
                        <p className="text-slate-900">{createdDate.toLocaleString()}</p>
                      </div>
                      {completedDate && (
                        <div>
                          <p className="text-slate-600 font-semibold mb-1">Completed At</p>
                          <p className="text-slate-900">{completedDate.toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {deposit.description && (
                      <div>
                        <p className="text-xs text-slate-600 font-semibold mb-1">Description</p>
                        <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">{deposit.description}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setShowDepositDetailsModal(false)}
                      className="flex-1 px-3 py-2 bg-slate-800 text-white rounded text-sm font-medium hover:bg-slate-900 transition"
                    >
                      Close
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Crypto Deposit Instructions Modal */}
      {showCryptoAddressModal && selectedAddressMethod && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => setShowCryptoAddressModal(false)}>
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-4 sm:p-6 my-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {selectedAddressMethod.name} Deposit Instructions
                </h3>
                {selectedAddressMethod.network && (
                  <p className="text-sm text-slate-600 mt-1">🔗 Network: {selectedAddressMethod.network}</p>
                )}
              </div>
              <button
                onClick={() => setShowCryptoAddressModal(false)}
                className="text-slate-500 hover:text-slate-700 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Amount to Send Section */}
              {amount && selectedCurrency && getDepositMethodAmount() && (
                <div className="p-4 bg-slate-50 border border-slate-300 rounded">
                  <h4 className="font-semibold text-slate-900 mb-3 text-sm">Amount to Send</h4>
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <span className="text-sm text-slate-700">You need to send:</span>
                      <span className="text-2xl font-bold text-slate-900 break-words">
                        {getDepositMethodAmount()?.toLocaleString(undefined, {
                          minimumFractionDigits: isCryptoCurrency(selectedAddressMethod.cryptoSymbol) ? 2 : 2,
                          maximumFractionDigits: isCryptoCurrency(selectedAddressMethod.cryptoSymbol) ? 8 : 2
                        })} {selectedAddressMethod.cryptoSymbol}
                      </span>
                    </div>
                    {selectedCurrency.toUpperCase() !== selectedAddressMethod.cryptoSymbol?.toUpperCase() && (
                      <div className="flex items-baseline justify-between pt-2 border-t border-slate-200 gap-2 flex-wrap">
                        <span className="text-slate-600 text-xs">Original amount:</span>
                        <span className="text-sm font-semibold text-slate-900 break-words">
                          {parseFloat(amount).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 8
                          })} {selectedCurrency.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-3 text-sm">Steps to Deposit</h4>
                <ol className="space-y-2">
                  <li className="flex gap-2 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center">
                      1
                    </span>
                    <span className="text-slate-700">Open your cryptocurrency wallet</span>
                  </li>
                  <li className="flex gap-2 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center">
                      2
                    </span>
                    <span className="text-slate-700">Click "Send" and enter the deposit address below</span>
                  </li>
                  <li className="flex gap-2 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center">
                      3
                    </span>
                    <span className="text-slate-700">Enter the amount you wish to deposit</span>
                  </li>
                  <li className="flex gap-2 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center">
                      4
                    </span>
                    <span className="text-slate-700">Review the transaction details and confirm</span>
                  </li>
                  <li className="flex gap-2 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center">
                      5
                    </span>
                    <span className="text-slate-700">Save the transaction hash for your records</span>
                  </li>
                </ol>
              </div>

              {/* Deposit Summary - What you receive */}
              {selectedWallet && calculateConvertedAmount() && selectedCurrency !== selectedWallet.currency_code && (
                <div className="p-4 bg-slate-50 border border-slate-300 rounded">
                  <h4 className="font-semibold text-slate-900 mb-3 text-sm">What You Will Receive</h4>
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <span className="text-sm text-slate-700">Deposited to your {selectedWallet.currency_code} wallet:</span>
                    <span className="text-xl font-bold text-slate-900 break-words">
                      {calculateConvertedAmount()?.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 8
                      })} {selectedWallet.currency_code}
                    </span>
                  </div>
                </div>
              )}

              {/* Deposit Address */}
              {selectedAddressMethod.address && (
                <div className="p-4 bg-slate-50 border border-slate-300 rounded">
                  <p className="text-sm font-semibold text-slate-900 mb-3">Deposit Address</p>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-slate-600 font-semibold">Currency</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedAddressMethod.cryptoSymbol}</p>
                    </div>
                    {selectedAddressMethod.network && (
                      <div>
                        <p className="text-xs text-slate-600 font-semibold">Network</p>
                        <p className="text-sm font-semibold text-slate-900">{selectedAddressMethod.network}</p>
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <p className="text-xs font-semibold text-slate-600 mb-2">Copy the address below:</p>
                    <p className="font-mono text-xs bg-white p-2 rounded border border-slate-300 break-all text-slate-800 mb-2">
                      {selectedAddressMethod.address}
                    </p>
                    <button
                      onClick={() => copyToClipboard(selectedAddressMethod.address)}
                      className="text-xs text-slate-700 hover:text-slate-900 font-semibold"
                    >
                      Copy Address
                    </button>
                  </div>

                </div>
              )}

              {/* Important Notes */}
              <div className="p-3 bg-slate-50 border border-slate-300 rounded">
                <p className="font-semibold text-slate-900 mb-2 text-sm">Important:</p>
                <ul className="text-xs text-slate-700 space-y-1">
                  <li>• Only send {selectedAddressMethod.cryptoName} ({selectedAddressMethod.cryptoSymbol}) to this address</li>
                  {selectedAddressMethod.network && <li>• Network: {selectedAddressMethod.network}</li>}
                  <li>• Do not send other tokens or cryptocurrencies</li>
                  <li>• Transactions cannot be reversed</li>
                  <li>• Keep the transaction hash for your records</li>
                  <li>• Your balance will be updated within 1-2 minutes after confirmation</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCryptoAddressModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded text-slate-900 text-sm font-medium hover:bg-slate-50 transition"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    if (selectedAddressMethod && selectedAddressMethod.id) {
                      setSelectedMethod(selectedAddressMethod.id)
                      setShowCryptoAddressModal(false)
                      setStep('confirm')
                    } else {
                      setError('Invalid method selected. Please try again.')
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-slate-800 text-white rounded text-sm font-medium hover:bg-slate-900 transition"
                >
                  Proceed with Deposit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deposit Success Modal */}
      {showSuccessModal && lastSuccessDeposit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => setShowSuccessModal(false)}>
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-4 my-4" onClick={(e) => e.stopPropagation()}>
            {/* Celebration Animation */}
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-3">
                <span className="text-3xl animate-bounce">✓</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">Deposit Confirmed!</h2>
              <p className="text-xs text-slate-600">Your deposit has been initiated successfully</p>
            </div>

            {/* Deposit Summary - THREE-CURRENCY MODEL */}
            <div className="bg-slate-50 rounded p-3 mb-4 border border-slate-300">
              <h3 className="font-semibold text-slate-900 mb-3 text-sm">Deposit Details</h3>
              <div className="space-y-2">
                {/* INPUT AMOUNT */}
                <div className="bg-white rounded p-2 border-l-4 border-slate-400">
                  <p className="text-xs text-slate-600 font-semibold mb-1">1. You Specified</p>
                  <p className="text-sm font-bold text-slate-900">
                    {(lastSuccessDeposit.input_amount || lastSuccessDeposit.amount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 8
                    })} {(lastSuccessDeposit.input_currency || lastSuccessDeposit.original_currency || lastSuccessDeposit.currency_code).toUpperCase()}
                  </p>
                </div>

                {/* PAYMENT AMOUNT (if different from input) */}
                {lastSuccessDeposit.payment_amount && lastSuccessDeposit.payment_method_currency && (
                  <div className="bg-white rounded p-2 border-l-4 border-slate-400">
                    <p className="text-xs text-slate-600 font-semibold mb-1">2. Send via {lastSuccessDeposit.deposit_method?.toUpperCase() || lastSuccessDeposit.payment_method_currency}</p>
                    <p className="text-sm font-bold text-slate-900">
                      {lastSuccessDeposit.payment_amount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 8
                      })} {lastSuccessDeposit.payment_method_currency.toUpperCase()}
                    </p>
                  </div>
                )}

                {/* WALLET CREDIT */}
                {lastSuccessDeposit.received_amount && (
                  <div className="bg-white rounded p-2 border-l-4 border-slate-400">
                    <p className="text-xs text-slate-600 font-semibold mb-1">3. You'll Receive</p>
                    <p className="text-sm font-bold text-slate-900">
                      {lastSuccessDeposit.received_amount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 8
                      })} {(lastSuccessDeposit.received_currency || lastSuccessDeposit.currency_code).toUpperCase()}
                    </p>
                  </div>
                )}

                {/* FALLBACK for old deposits without received_amount */}
                {lastSuccessDeposit.converted_amount && !lastSuccessDeposit.received_amount && (
                  <div className="bg-white rounded p-2 border-l-4 border-slate-400">
                    <p className="text-xs text-slate-600 font-semibold mb-1">You'll Receive</p>
                    <p className="text-sm font-bold text-slate-900">
                      {lastSuccessDeposit.converted_amount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 8
                      })} {lastSuccessDeposit.received_currency || lastSuccessDeposit.currency_symbol || 'BTC'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Reference Number */}
            {lastSuccessDeposit.reference_number && (
              <div className="bg-slate-50 rounded p-3 mb-3 border border-slate-300">
                <p className="text-xs text-slate-600 font-semibold mb-1">Reference Number</p>
                <p className="text-xs font-mono font-semibold text-slate-900 break-all">{lastSuccessDeposit.reference_number}</p>
                <p className="text-xs text-slate-600 mt-1">Save this for your records</p>
              </div>
            )}

            {/* Next Steps */}
            <div className="bg-slate-50 rounded p-3 mb-4 border border-slate-300">
              <h4 className="font-semibold text-slate-900 mb-2 text-sm">What's Next</h4>
              <ul className="space-y-1 text-xs text-slate-700">
                <li className="flex gap-2">
                  <span className="font-semibold">•</span>
                  <span>Your deposit is being processed</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold">•</span>
                  <span>Status will update to Approved shortly</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold">•</span>
                  <span>Check the Recent Deposits table for updates</span>
                </li>
              </ul>
            </div>

            {/* Action Button */}
            <button
              onClick={() => {
                setShowSuccessModal(false)
                handleStartNewDeposit()
              }}
              className="w-full px-4 py-2 bg-slate-800 text-white rounded text-sm font-medium hover:bg-slate-900 transition"
            >
              Start New Deposit
            </button>

            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full px-4 py-2 mt-3 bg-slate-200 text-slate-900 rounded text-sm font-semibold hover:bg-slate-300 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

export default React.memo(DepositsComponent)
