import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import CurrencyCryptoToggle from './FiatCryptoToggle'
import EnhancedWalletDropdown from './EnhancedWalletDropdown'
import SearchableCurrencyDropdown from './SearchableCurrencyDropdown'
import PaymentMethodsGrid from './PaymentMethodsGrid'
import { currencyAPI } from '../lib/currencyAPI'
import { getCryptoPrice, getMultipleCryptoPrices } from '../lib/cryptoRatesService'
import { coinsPhApi } from '../lib/coinsPhApi'
import { formatNumber } from '../lib/currency'
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
    icon: '📱',
    type: 'fiat',
    description: 'Instant mobile payment (Philippines)'
  },

  // Cryptocurrency Methods
  btc: { id: 'btc', name: 'Bitcoin', icon: '₿', type: 'crypto', description: 'Bitcoin deposit' },
  eth: { id: 'eth', name: 'Ethereum', icon: 'Ξ', type: 'crypto', description: 'Ethereum deposit' },
  usdt: { id: 'usdt', name: 'Tether (USDT)', icon: '₮', type: 'crypto', description: 'USDT deposit' },
  bnb: { id: 'bnb', name: 'Binance Coin', icon: '♡', type: 'crypto', description: 'BNB deposit' },
  xrp: { id: 'xrp', name: 'XRP', icon: '✕', type: 'crypto', description: 'XRP deposit' },
  usdc: { id: 'usdc', name: 'USD Coin', icon: 'Ⓒ', type: 'crypto', description: 'USDC deposit' },
  sol: { id: 'sol', name: 'Solana', icon: '◎', type: 'crypto', description: 'SOL deposit' },
  trx: { id: 'trx', name: 'Tron', icon: '⬢', type: 'crypto', description: 'TRX deposit' },
  doge: { id: 'doge', name: 'Dogecoin', icon: 'Ð', type: 'crypto', description: 'DOGE deposit' },
  ada: { id: 'ada', name: 'Cardano', icon: '₳', type: 'crypto', description: 'ADA deposit' },
  bch: { id: 'bch', name: 'Bitcoin Cash', icon: '₿ℂ', type: 'crypto', description: 'BCH deposit' },
  link: { id: 'link', name: 'Chainlink', icon: '⛓', type: 'crypto', description: 'LINK deposit' },
  xlm: { id: 'xlm', name: 'Stellar', icon: '★', type: 'crypto', description: 'XLM deposit' },
  ltc: { id: 'ltc', name: 'Litecoin', icon: 'Ł', type: 'crypto', description: 'LTC deposit' },
  sui: { id: 'sui', name: 'Sui', icon: '◆', type: 'crypto', description: 'SUI deposit' },
  avax: { id: 'avax', name: 'Avalanche', icon: '▲', type: 'crypto', description: 'AVAX deposit' },
  hbar: { id: 'hbar', name: 'Hedera', icon: 'ℌ', type: 'crypto', description: 'HBAR deposit' },
  shib: { id: 'shib', name: 'Shiba Inu', icon: '🐕', type: 'crypto', description: 'SHIB deposit' },
  pyusd: { id: 'pyusd', name: 'PayPal USD', icon: 'P', type: 'crypto', description: 'PYUSD deposit' },
  wld: { id: 'wld', name: 'Worldcoin', icon: 'W', type: 'crypto', description: 'WLD deposit' },
  ton: { id: 'ton', name: 'The Open Network', icon: '◉', type: 'crypto', description: 'TON deposit' },
  uni: { id: 'uni', name: 'Uniswap', icon: '∪', type: 'crypto', description: 'UNI deposit' },
  dot: { id: 'dot', name: 'Polkadot', icon: '●', type: 'crypto', description: 'DOT deposit' },
  aave: { id: 'aave', name: 'Aave', icon: 'Ⓐ', type: 'crypto', description: 'AAVE deposit' }
}

const SOLANA_ADDRESS = 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS'

// Helper function to query public.pairs directly
async function getRatesFromPublicPairs(currencies, toCurrency = 'PHP') {
  try {
    const toUpper = toCurrency.toUpperCase()
    const currencyUpperCase = currencies.map(c => c.toUpperCase())

    console.log(`[Deposits] Querying public.pairs for rates: ${currencyUpperCase.join(', ')} → ${toUpper}`)

    const { data, error } = await supabase
      .from('pairs')
      .select('from_currency, rate, updated_at, source_table')
      .eq('to_currency', toUpper)
      .in('from_currency', currencyUpperCase)

    if (error) {
      console.warn('[Deposits] Public.pairs query error:', error.message)
      return {}
    }

    if (!data || data.length === 0) {
      console.warn('[Deposits] Public.pairs returned no data for:', currencyUpperCase.join(', '))
      return {}
    }

    const rates = {}
    data.forEach(row => {
      rates[row.from_currency] = parseFloat(row.rate)
    })

    console.log(`[Deposits] Successfully loaded ${data.length} rates from public.pairs:`, Object.keys(rates).join(', '))
    return rates
  } catch (e) {
    console.error('[Deposits] Public.pairs helper failed:', e.message)
    return {}
  }
}

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

  useEffect(() => {
    loadInitialData()
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

  const fetchExchangeRates = async () => {
    try {
      setRatesLoading(true)
      const rates = {}

      // Helper to create timeout promise - each call creates a new one
      const createTimeout = (ms) => new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Rate fetch timeout')), ms)
      )

      if (activeType === 'currency') {
        try {
          // Fetch rates for ALL fiat currencies (not just wallet matches)
          const globalRates = await Promise.race([
            currencyAPI.getGlobalRates(),
            createTimeout(10000) // 10 second timeout for fiat rates
          ])

          let phpToUsdRate = 1 // fallback, will be overridden if found

          if (globalRates) {
            Object.entries(globalRates).forEach(([code, data]) => {
              const codeUpper = code.toUpperCase()
              rates[codeUpper] = data.rate
              // Track PHP to USD rate for crypto conversion
              if (codeUpper === 'PHP' && data.rate > 0) {
                phpToUsdRate = 1 / data.rate // If 1 USD = 58.5 PHP, then 1 PHP = 1/58.5 USD
              }
            })
          }

          // Store the USD to PHP rate for later use in conversions
          rates['_phpToUsdRate'] = phpToUsdRate

          // IMPORTANT: Also fetch crypto prices when in fiat mode
          // This enables fiat→crypto conversions (e.g., PHP→BTC)
          const cryptoCurrenciesToFetch = new Set()

          // If a crypto wallet is selected, fetch its crypto price
          if (selectedWallet) {
            const selectedWalletData = wallets.find(w => w.id === selectedWallet)
            if (selectedWalletData && selectedWalletData.currency_type === 'crypto') {
              cryptoCurrenciesToFetch.add(selectedWalletData.currency_code)
            }
          }

          // Also add any crypto currencies with available addresses
          Object.keys(cryptoAddresses).forEach(code => cryptoCurrenciesToFetch.add(code))

          // Fetch crypto prices if needed
          if (cryptoCurrenciesToFetch.size > 0) {
            const cryptoCodes = Array.from(cryptoCurrenciesToFetch)
            console.log(`[Deposits] Fetching crypto rates for fiat→crypto conversion: ${cryptoCodes.join(', ')}`)

            // TRY API FIRST (with timeout)
            let apiSuccess = false
            try {
              const pricesFromApi = await Promise.race([
                getMultipleCryptoPrices(cryptoCodes, 'PHP'),
                createTimeout(8000) // Shorter timeout - fall back quickly
              ])

              if (pricesFromApi && Object.keys(pricesFromApi).length > 0) {
                // Normalize API response to uppercase keys
                Object.entries(pricesFromApi).forEach(([code, rate]) => {
                  rates[code.toUpperCase()] = rate
                })
                console.log(`[Deposits] Successfully fetched ${Object.keys(pricesFromApi).length} crypto rates from API`)
                apiSuccess = true
              }
            } catch (e) {
              console.warn('[Deposits] API fetch timed out or failed:', e.message)
            }

            // CRITICAL: Always try public.pairs for any missing rates
            const stillMissingCryptos = cryptoCodes.filter(code => !rates[code])
            if (stillMissingCryptos.length > 0) {
              try {
                console.log(`[Deposits] Querying public.pairs for ${stillMissingCryptos.length} missing crypto rates: ${stillMissingCryptos.join(', ')}`)

                // Try direct pairs (CRYPTO -> PHP): BTC->PHP, ETH->PHP, etc.
                const { data: pairsData, error: pairsError } = await supabase
                  .from('pairs')
                  .select('from_currency, to_currency, rate, updated_at')
                  .eq('to_currency', 'PHP')
                  .in('from_currency', stillMissingCryptos)

                if (!pairsError && pairsData && pairsData.length > 0) {
                  pairsData.forEach(row => {
                    const upperCode = row.from_currency.toUpperCase()
                    rates[upperCode] = parseFloat(row.rate)
                  })
                  console.log(`[Deposits] Loaded ${pairsData.length} crypto rates from public.pairs (direct): ${pairsData.map(r => r.from_currency).join(', ')}`)
                }

                // Also try inverse pairs (PHP -> CRYPTO) for missing rates
                const stillMissingAfterDirect = cryptoCodes.filter(code => !rates[code])
                if (stillMissingAfterDirect.length > 0) {
                  console.log(`[Deposits] Trying inverse pairs (PHP -> CRYPTO) for: ${stillMissingAfterDirect.join(', ')}`)
                  const { data: inversePairs, error: inverseError } = await supabase
                    .from('pairs')
                    .select('from_currency, to_currency, rate, updated_at')
                    .eq('from_currency', 'PHP')
                    .in('to_currency', stillMissingAfterDirect)

                  if (!inverseError && inversePairs && inversePairs.length > 0) {
                    inversePairs.forEach(row => {
                      const upperCode = row.to_currency.toUpperCase()
                      // Invert the rate: if 1 PHP = 0.00004 BTC, then 1 BTC = 25000 PHP
                      rates[upperCode] = 1 / parseFloat(row.rate)
                    })
                    console.log(`[Deposits] Loaded ${inversePairs.length} crypto rates from public.pairs (inverted): ${inversePairs.map(r => r.to_currency).join(', ')}`)
                  }
                }

                if (pairsError && !pairsData) {
                  console.error('[Deposits] Public.pairs query failed:', pairsError.message)
                }
              } catch (e) {
                console.error('[Deposits] Public.pairs fallback threw error:', e.message)
              }
            }
          }

          // Ensure PHP and USD rates are set properly (normalized to uppercase)
          if (!rates['PHP']) rates['PHP'] = 58.5 // fallback PHP to USD rate (1 USD = 58.5 PHP)
          if (!rates['USD']) rates['USD'] = 1 // fallback USD rate
        } catch (e) {
          console.warn('Failed to fetch fiat exchange rates:', e.message)
          // Set minimal fallback rates
          rates['PHP'] = 58.5
          rates['USD'] = 1
        }
      } else {
        // For crypto mode, fetch rates for only selected/available currencies (not all)
        const cryptoCurrenciesToFetch = new Set()

        // Add only the selected currency and configured crypto addresses
        if (selectedCurrency && cryptoAddresses[selectedCurrency]) {
          cryptoCurrenciesToFetch.add(selectedCurrency)
        }

        // Add first 5 crypto addresses to prevent too many API calls
        const addressKeys = Object.keys(cryptoAddresses).slice(0, 5)
        addressKeys.forEach(code => cryptoCurrenciesToFetch.add(code))

        // Fetch crypto prices
        if (cryptoCurrenciesToFetch.size > 0) {
          try {
            const cryptoCodes = Array.from(cryptoCurrenciesToFetch)

            // Try batch fetch with timeout
            try {
              const pricesFromApi = await Promise.race([
                getMultipleCryptoPrices(cryptoCodes, 'PHP'),
                createTimeout(12000) // 12 second timeout for crypto rates
              ])

              if (pricesFromApi && Object.keys(pricesFromApi).length > 0) {
                Object.assign(rates, pricesFromApi)
              } else {
                console.warn('Batch crypto price fetch returned no data, trying public.pairs fallback...')
              }
            } catch (batchErr) {
              console.warn('Batch crypto fetch failed:', batchErr.message)
              // Will try public.pairs fallback below
            }

            // CRITICAL FALLBACK: Query public.pairs directly if API failed
            const stillMissingCryptos = cryptoCodes.filter(code => !rates[code])
            if (stillMissingCryptos.length > 0) {
              try {
                console.log(`[Deposits] Querying public.pairs for ${stillMissingCryptos.length} missing crypto rates (crypto mode): ${stillMissingCryptos.join(', ')}`)
                const { data: pairsData, error: pairsError } = await supabase
                  .from('pairs')
                  .select('from_currency, rate, updated_at')
                  .eq('to_currency', 'PHP')
                  .in('from_currency', stillMissingCryptos)

                if (!pairsError && pairsData && pairsData.length > 0) {
                  pairsData.forEach(row => {
                    const upperCode = row.from_currency.toUpperCase()
                    rates[upperCode] = parseFloat(row.rate)
                  })
                  console.log(`[Deposits] Loaded ${pairsData.length} rates from public.pairs (crypto mode): ${pairsData.map(r => r.from_currency).join(', ')}`)
                } else if (pairsError) {
                  console.error('[Deposits] Public.pairs query failed:', pairsError.message)
                } else {
                  console.warn('[Deposits] Public.pairs returned NO rows for:', stillMissingCryptos.join(', '), '| Check if cryptocurrency_rates table is populated')
                }
              } catch (e) {
                console.error('[Deposits] Public.pairs fallback threw error:', e.message)
              }
            }
          } catch (e) {
            console.error('Failed to fetch crypto rates:', e.message)
          }
        }

        // Ensure PHP rate is set to 1 for conversion calculations
        rates['PHP'] = 1
      }

      setExchangeRates(rates)
      setRatesLoading(false)
    } catch (err) {
      console.error('Error fetching exchange rates:', err.message)
      setExchangeRates({ PHP: 1, USD: 1 })
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
      const [walletsResult, currenciesResult] = await Promise.all([
        supabase
          .from('wallets')
          .select('id, user_id, currency_code, balance, total_deposited, total_withdrawn, is_active, created_at, updated_at, account_number, type')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('currency_code'),
        supabase
          .from('currencies')
          .select('code, name, type, symbol')
          .eq('active', true)
      ])

      if (walletsResult.error) throw walletsResult.error
      if (currenciesResult.error) throw currenciesResult.error

      let walletsData = walletsResult.data || []
      const allCurrencies = currenciesResult.data || []

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

  const calculateConvertedAmount = () => {
    if (!amount || !selectedWallet) return null

    const numAmount = parseFloat(amount)
    const selectedWalletData = wallets.find(w => w.id === selectedWallet)

    if (!selectedWalletData) return null

    // If same currency, no conversion needed
    if (selectedCurrency === selectedWalletData.currency_code) {
      return numAmount
    }

    // Get exchange rates for both currencies (try both uppercase and lowercase)
    const fromCurrencyUpper = selectedCurrency.toUpperCase()
    const toCurrencyUpper = selectedWalletData.currency_code.toUpperCase()

    let fromRate = exchangeRates[selectedCurrency] || exchangeRates[fromCurrencyUpper]
    let toRate = exchangeRates[selectedWalletData.currency_code] || exchangeRates[toCurrencyUpper]

    if (!fromRate || !toRate) {
      console.warn('Missing exchange rates for conversion:', {
        fromRate,
        toRate,
        from: selectedCurrency,
        to: selectedWalletData.currency_code,
        activeType,
        availableRates: Object.keys(exchangeRates),
        expectedFrom: [selectedCurrency, fromCurrencyUpper],
        expectedTo: [selectedWalletData.currency_code, toCurrencyUpper]
      })
      return null
    }

    // Check if source is crypto or fiat
    const sourceIsCrypto = activeType === 'cryptocurrency'
    const targetIsCrypto = selectedWalletData.currency_type === 'crypto'

    let convertedAmount

    if (sourceIsCrypto && !targetIsCrypto) {
      // Crypto to fiat: amount in crypto * price per crypto (in fiat)
      // fromRate = price of source crypto in target fiat (e.g., 1 BTC = 2,500,000 PHP)
      convertedAmount = numAmount * fromRate
    } else if (sourceIsCrypto && targetIsCrypto) {
      // Crypto to crypto
      // Both rates are prices in PHP: amount in PHP / price in PHP = amount in crypto
      // fromRate = source crypto price in PHP
      // toRate = target crypto price in PHP
      convertedAmount = (numAmount * fromRate) / toRate
    } else if (!sourceIsCrypto && targetIsCrypto) {
      // Fiat to crypto
      // fromRate = source fiat price in USD (e.g., 1 USD = 58.5 PHP, so PHP rate is 58.5)
      // toRate = target crypto price in PHP (e.g., 1 BTC = 2,500,000 PHP)
      // Convert: (amount in source / rate in USD) * (USD to PHP) / (crypto price in PHP)
      // Simplified: amount / toRate gives crypto amount if everything is in PHP
      // But fromRate is not in PHP directly... Let's use: (amount / fromRate) * USD_to_PHP_rate / toRate
      // Or more directly: convert source to PHP: amount * (PHP rate / source rate)... no wait
      // If fromRate = 58.5 (1 USD = 58.5 PHP), then 1 PHP = 1/58.5 USD
      // So: amount_php * (1/fromRate) = amount_usd
      // Then: amount_usd / (toRate / fromRate) = amount_crypto
      // = amount * (1/fromRate) * (fromRate / toRate) = amount / toRate
      // So the simple formula is: convertedAmount = numAmount / toRate (since everything is normalized to PHP)
      convertedAmount = numAmount / toRate
    } else {
      // Fiat to fiat
      // fromRate = source currency price in USD (e.g., 58.5)
      // toRate = target currency price in USD (e.g., 1)
      // Convert: amount * (USD to target) / (USD to source) = amount * toRate / fromRate
      // = (amount / fromRate) * toRate
      convertedAmount = (numAmount / fromRate) * toRate
    }

    // Round to appropriate decimal places
    const decimals = targetIsCrypto ? 8 : 2
    return Math.round(convertedAmount * Math.pow(10, decimals)) / Math.pow(10, decimals)
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

      // Determine the deposit currency and method
      // If a crypto method is selected, use its currency code; otherwise use selectedCurrency
      let depositCurrency = selectedCurrency
      let depositMethodId = selectedMethod

      if (selectedAddressMethod) {
        // For crypto method selections, use the method's currency code
        depositCurrency = selectedAddressMethod.depositCurrencyCode || selectedAddressMethod.cryptoSymbol || selectedCurrency
        depositMethodId = selectedAddressMethod.cryptoSymbol?.toLowerCase() || selectedCurrency.toLowerCase()
      }

      const result = await multiCurrencyDepositService.createMultiCurrencyDeposit({
        userId,
        walletId: selectedWallet,
        amount,
        depositCurrency: depositCurrency,
        walletCurrency: targetWalletData.currency_code,
        depositMethod: depositMethodId,
        paymentReference: selectedMethod === 'gcash' ? gcashReferenceNumber : null,
        paymentAddress: activeMethodData?.address || null,
        metadata: {
          activeType,
          methodName: activeMethodData?.name || depositCurrency,
          networkInfo: activeMethodData?.network ? { network: activeMethodData.network, provider: activeMethodData.provider } : null
        }
      })

      if (!result.success) {
        setError(result.error || 'Failed to create deposit')
        setSubmitting(false)
        return
      }

      // Success
      setDeposits([result.deposit, ...deposits])
      setSuccess(`Deposit initiated successfully! Converting ${selectedCurrency} to ${targetWalletData.currency_code} at rate ${result.conversion.rate.toFixed(6)}`)
      setError('')
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
        icon: cryptoCode,
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
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

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
            {success}
          </div>
        )}

        {/* Step 1: Enter Amount */}
        {step === 'amount' && (
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 mb-6">
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
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
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
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <div className={`border rounded-lg p-6 ${!calculateConvertedAmount() ? 'bg-amber-50 border-amber-200' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'}`}>
                  {selectedCurrency === selectedWalletData?.currency_code ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600">Deposit Amount</p>
                        <p className="text-xs text-emerald-600 font-medium mt-1">✓ No conversion needed - same currency</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-600">You will receive</p>
                        <p className="text-2xl font-bold text-emerald-600">
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
                          `${amount} ${selectedCurrency} = ${(parseFloat(amount) * exchangeRates[selectedCurrency]).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${selectedWalletData?.currency_code} as of ${new Date().toLocaleString(undefined, { month: 'short', day: 'numeric' })}`
                        )}
                      </p>
                      <div className="flex gap-4 items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-600 mb-1">Amount in {selectedCurrency}</p>
                          <p className="text-3xl font-bold text-slate-900">{parseFloat(amount) || 0}</p>
                        </div>
                        <div className="text-slate-400 text-xl">↔</div>
                        <div className="text-right">
                          <p className="text-xs text-slate-600 mb-1">You receive in {selectedWalletData?.currency_code}</p>
                          <p className={`text-3xl font-bold ${calculateConvertedAmount() ? 'text-indigo-600' : 'text-amber-600'}`}>
                            {calculateConvertedAmount() ? calculateConvertedAmount().toLocaleString(undefined, { maximumFractionDigits: 8 }) : (
                              exchangeRates[selectedCurrency] ? (parseFloat(amount) * exchangeRates[selectedCurrency]).toLocaleString(undefined, { maximumFractionDigits: 8 }) : '⏳'
                            )}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600">Conversion Rate</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {!exchangeRates[selectedCurrency] || !exchangeRates[selectedWalletData?.currency_code] ? (
                            <span>⏳ Fetching rates...</span>
                          ) : selectedWalletData?.currency_type === 'crypto' ? (
                            // For fiat-to-crypto conversions
                            `1 ${selectedCurrency} = ${(1 / exchangeRates[selectedWalletData?.currency_code]).toFixed(8)} ${selectedWalletData?.currency_code}`
                          ) : (
                            // For fiat-to-fiat conversions (both rates are USD-based)
                            `1 ${selectedCurrency} = ${(exchangeRates[selectedWalletData?.currency_code] / exchangeRates[selectedCurrency]).toFixed(6)} ${selectedWalletData?.currency_code}`
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-600">You will receive</p>
                        <p className={`text-2xl font-bold ${calculateConvertedAmount() ? 'text-blue-600' : 'text-amber-600'}`}>
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
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 mb-6">
            <h2 className="text-2xl font-semibold text-slate-900 mb-6">
              {formatNumber(parseFloat(amount) || 0)} {selectedCurrency.toUpperCase()} via {activeMethodData?.name || DEPOSIT_METHODS[selectedMethod]?.name || 'Payment'}
            </h2>

            {/* Deposit Summary */}
            <div className="bg-slate-50 rounded-lg p-6 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide">Amount</p>
                  <p className="text-xl font-semibold text-slate-900">{formatNumber(parseFloat(amount) || 0)} {selectedCurrency.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide">{activeType === 'cryptocurrency' ? 'Network' : 'Method'}</p>
                  <p className="text-lg font-semibold text-slate-900">{activeMethodData.name}</p>
                  {activeMethodData.network && (
                    <p className="text-xs text-blue-600 font-medium mt-1">🔗 {activeMethodData.network}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide">Wallet</p>
                  <p className="text-lg font-semibold text-slate-900">{selectedWalletData.currency_code}</p>
                </div>
                {calculateConvertedAmount() && selectedCurrency !== selectedWalletData.currency_code && (
                  <div>
                    <p className="text-xs text-slate-600 uppercase tracking-wide">You Receive</p>
                    <p className="text-xl font-semibold text-blue-600">{formatNumber(calculateConvertedAmount())} {selectedWalletData.currency_code}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Exchange Rate Summary */}
            {ratesLoading ? (
              <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-slate-700">Loading exchange rates...</p>
              </div>
            ) : (
              <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-slate-900 mb-4">Exchange Rate Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">You Send:</span>
                    <span className="font-semibold text-slate-900">{formatNumber(parseFloat(amount) || 0)} {selectedCurrency}</span>
                  </div>
                  {exchangeRates[selectedCurrency] && (
                    <div className="flex justify-between items-center text-sm text-slate-600">
                      <span>Rate:</span>
                      <span>1 {selectedCurrency} = {formatNumber(exchangeRates[selectedCurrency]) || 'N/A'} {selectedWalletData.currency_code}</span>
                    </div>
                  )}
                  {calculateConvertedAmount() && selectedCurrency !== selectedWalletData.currency_code && (
                    <div className="flex justify-between items-center pt-3 border-t border-blue-200">
                      <span className="text-slate-900 font-medium">You Receive:</span>
                      <span className="text-lg font-bold text-blue-600">{formatNumber(calculateConvertedAmount())} {selectedWalletData.currency_code}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* GCash Reference Number */}
            {selectedMethod === 'gcash' && (
              <div className="mb-8 p-6 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-sm text-slate-600 mb-4 font-medium">Complete your GCash payment using the merchant details:</p>
                <div className="bg-white p-3 rounded border border-emerald-200 mb-4">
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
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-slate-700">
                        <span className="font-medium">Network: </span>
                        <span className="font-semibold">{activeMethodData.network}</span>
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

            {/* Important Notes */}
            <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="font-semibold text-yellow-900 mb-2">Important:</p>
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
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {submitting ? 'Processing...' : 'Confirm Deposit'}
              </button>
            </div>
          </div>
        )}

        {/* Recent Deposits */}
        {deposits.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
            <h3 className="text-xl font-semibold text-slate-900 mb-4">Recent Deposits</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-slate-600 font-medium">Amount</th>
                    <th className="text-left py-3 px-4 text-slate-600 font-medium">Converted Amount</th>
                    <th className="text-left py-3 px-4 text-slate-600 font-medium">Currency</th>
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
                    const walletCurrency = notesMeta.wallet_currency || deposit.wallet_currency || deposit.currency_code

                    // Helper function to format numbers with proper decimal/thousand separators
                    const formatAmount = (num) => {
                      if (!num && num !== 0) return '—'
                      const numValue = typeof num === 'string' ? parseFloat(num) : num
                      if (isNaN(numValue)) return '—'
                      return numValue.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })
                    }

                    // Helper function to uppercase currency symbols
                    const formatCurrency = (curr) => (curr ? curr.toUpperCase() : '—')

                    return (
                      <tr key={deposit.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {formatAmount(deposit.amount)} {formatCurrency(originalCurrency)}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {convertedAmount ? formatAmount(convertedAmount) : '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {formatCurrency(walletCurrency)}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 font-mono">
                          {deposit.reference_number || deposit.phone_number || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            deposit.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                            deposit.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                            deposit.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
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

            <div className="flex gap-3">
              <button
                onClick={() => setShowWalletModal(false)}
                className="flex-1 px-4 py-3 border border-slate-300 rounded-lg text-slate-900 font-medium hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWallet}
                disabled={submitting}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Wallet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deposit Details Modal */}
      {showDepositDetailsModal && selectedDepositForDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowDepositDetailsModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-8" onClick={(e) => e.stopPropagation()}>
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
              const walletCurrency = notesMeta.wallet_currency || deposit.wallet_currency || deposit.currency_code
              const depositWallet = wallets.find(w => w.id === deposit.wallet_id)
              const exchangeRate = convertedAmount && deposit.amount ? (convertedAmount / deposit.amount).toFixed(8) : null
              const methodName = DEPOSIT_METHODS[deposit.deposit_method]?.name || deposit.deposit_method.toUpperCase()
              const createdDate = new Date(deposit.created_at)
              const completedDate = deposit.completed_at ? new Date(deposit.completed_at) : null

              return (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-semibold text-slate-900">Deposit Details</h3>
                    <button
                      onClick={() => setShowDepositDetailsModal(false)}
                      className="text-slate-500 hover:text-slate-700 text-3xl leading-none"
                    >
                      ×
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Transaction Status */}
                    <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">Status</p>
                          <p className="text-lg font-semibold text-slate-900">{deposit.status.toUpperCase()}</p>
                        </div>
                        <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                          deposit.status === 'approved' || deposit.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          deposit.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {deposit.status.charAt(0).toUpperCase() + deposit.status.slice(1)}
                        </span>
                      </div>
                    </div>

                    {/* Amount Information */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-600 uppercase tracking-wide mb-2">Original Amount</p>
                        <p className="text-2xl font-bold text-slate-900">{deposit.amount.toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 })}</p>
                        <p className="text-sm text-slate-600 mt-1">{originalCurrency.toUpperCase()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 uppercase tracking-wide mb-2">Received Amount</p>
                        <p className="text-2xl font-bold text-emerald-600">{convertedAmount ? convertedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</p>
                        <p className="text-sm text-slate-600 mt-1">{walletCurrency.toUpperCase()}</p>
                      </div>
                    </div>

                    {/* Exchange Rate */}
                    {exchangeRate && (
                      <div className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded">
                        <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">Exchange Rate</p>
                        <p className="text-xl font-semibold text-slate-900">1 {originalCurrency.toUpperCase()} = {exchangeRate} {walletCurrency.toUpperCase()}</p>
                      </div>
                    )}

                    {/* Deposit Method & Reference */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-600 uppercase tracking-wide mb-2">Deposit Method</p>
                        <p className="text-base font-semibold text-slate-900">{methodName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 uppercase tracking-wide mb-2">Reference Number</p>
                        <p className="text-base font-mono text-slate-900 break-all">{deposit.reference_number || deposit.phone_number || '—'}</p>
                      </div>
                    </div>

                    {/* Wallet Information */}
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <p className="text-xs text-slate-600 uppercase tracking-wide mb-3 font-semibold">Deposited To Wallet</p>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-slate-600">Wallet Currency</p>
                          <p className="text-sm font-semibold text-slate-900">{depositWallet?.currency_name || walletCurrency}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600">Wallet ID</p>
                          <p className="text-xs font-mono text-slate-900 break-all">{depositWallet?.id || deposit.wallet_id}</p>
                        </div>
                        {depositWallet?.account_number && (
                          <div>
                            <p className="text-xs text-slate-600">Account Number</p>
                            <p className="text-xs font-mono text-slate-900">{depositWallet.account_number}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Timestamps */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-600 uppercase tracking-wide mb-2">Created At</p>
                        <p className="text-sm font-semibold text-slate-900">{createdDate.toLocaleString()}</p>
                      </div>
                      {completedDate && (
                        <div>
                          <p className="text-xs text-slate-600 uppercase tracking-wide mb-2">Completed At</p>
                          <p className="text-sm font-semibold text-slate-900">{completedDate.toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {deposit.description && (
                      <div>
                        <p className="text-xs text-slate-600 uppercase tracking-wide mb-2">Description</p>
                        <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded border border-slate-200">{deposit.description}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setShowDepositDetailsModal(false)}
                      className="flex-1 px-4 py-3 bg-slate-200 text-slate-900 rounded-lg font-medium hover:bg-slate-300 transition"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowCryptoAddressModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-semibold text-slate-900">
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

            <div className="space-y-6">
              {/* Instructions */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-4">Steps to Deposit</h4>
                <ol className="space-y-3">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex items-center justify-center">
                      1
                    </span>
                    <span className="text-slate-700">Open your cryptocurrency wallet</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex items-center justify-center">
                      2
                    </span>
                    <span className="text-slate-700">Click "Send" and enter the deposit address below</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex items-center justify-center">
                      3
                    </span>
                    <span className="text-slate-700">Enter the amount you wish to deposit</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex items-center justify-center">
                      4
                    </span>
                    <span className="text-slate-700">Review the transaction details and confirm</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex items-center justify-center">
                      5
                    </span>
                    <span className="text-slate-700">Save the transaction hash for your records</span>
                  </li>
                </ol>
              </div>

              {/* Deposit Address */}
              {selectedAddressMethod.address && (
                <div className="p-6 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm font-semibold text-slate-900 mb-4">Deposit Address</p>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-slate-600">Currency</p>
                      <p className="font-semibold text-slate-900">{selectedCurrency.toUpperCase()}</p>
                    </div>
                    {selectedAddressMethod.network && (
                      <div>
                        <p className="text-xs text-slate-600">Network</p>
                        <p className="font-semibold text-slate-900">{selectedAddressMethod.network}</p>
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <p className="text-xs font-medium text-slate-600 mb-2">Copy the address below:</p>
                    <p className="font-mono text-xs bg-white p-3 rounded border border-slate-300 break-all text-slate-800 mb-2">
                      {selectedAddressMethod.address}
                    </p>
                    <button
                      onClick={() => copyToClipboard(selectedAddressMethod.address)}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Copy Address
                    </button>
                  </div>

                </div>
              )}

              {/* Important Notes */}
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="font-semibold text-yellow-900 mb-2">Important:</p>
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>• Only send {selectedAddressMethod.cryptoName} ({selectedAddressMethod.cryptoSymbol}) to this address</li>
                  {selectedAddressMethod.network && <li>• Network: {selectedAddressMethod.network}</li>}
                  <li>• Do not send other tokens or cryptocurrencies</li>
                  <li>• Transactions cannot be reversed</li>
                  <li>• Keep the transaction hash for your records</li>
                  <li>• Your balance will be updated within 1-2 minutes after confirmation</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCryptoAddressModal(false)}
                  className="flex-1 px-6 py-3 border border-slate-300 rounded-lg text-slate-900 font-medium hover:bg-slate-50 transition"
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
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
                >
                  Proceed with Deposit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default React.memo(DepositsComponent)
