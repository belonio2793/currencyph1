import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import CurrencyCryptoToggle from './FiatCryptoToggle'
import { currencyAPI } from '../lib/currencyAPI'
import { getCryptoPrice, getMultipleCryptoPrices } from '../lib/cryptoRatesService'
import { coinsPhApi } from '../lib/coinsPhApi'
import { formatNumber } from '../lib/currency'

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
  gcash: {
    id: 'gcash',
    name: 'GCash',
    icon: '📱',
    type: 'fiat',
    description: 'Instant mobile payment (Philippines)'
  },
  solana: {
    id: 'solana',
    name: 'Solana',
    icon: '◎',
    type: 'crypto',
    description: 'Cryptocurrency transfer'
  }
}

const SOLANA_ADDRESS = 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS'

// Custom Wallet Dropdown Component
function WalletDropdown({ wallets, selectedWallet, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  const selectedWalletData = wallets.find(w => w.id === selectedWallet)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-base text-left flex justify-between items-center hover:border-slate-400"
      >
        <div>
          {selectedWalletData ? (
            <div>
              <div className="text-slate-900 font-medium">
                {selectedWalletData.currency_name} • Balance: {formatNumber(selectedWalletData.balance)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                <span className="text-blue-600">Wallet ID:</span>{' '}
                <span className="font-mono">{selectedWalletData.id}</span>
                {selectedWalletData.account_number && (
                  <>
                    {' '} • <span className="text-blue-600">Account Number:</span>{' '}
                    <span className="font-mono">{selectedWalletData.account_number}</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <span className="text-slate-500">Select a wallet</span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-2 bg-white border border-slate-300 rounded-lg shadow-lg">
          <div className="max-h-64 overflow-y-auto">
            {wallets.length > 0 ? (
              wallets.map(w => (
                <button
                  key={w.id}
                  onClick={() => {
                    onChange(w.id)
                    setIsOpen(false)
                  }}
                  className={`w-full px-4 py-4 text-left border-b border-slate-100 last:border-b-0 hover:bg-blue-50 transition-colors ${
                    selectedWallet === w.id ? 'bg-blue-100' : ''
                  }`}
                >
                  <div className="text-slate-900 font-medium">
                    {w.currency_name} • Balance: {formatNumber(w.balance)}
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    <span className="text-blue-600 text-xs">Wallet ID:</span>{' '}
                    <span className="font-mono text-slate-600">{w.id}</span>
                    {w.account_number && (
                      <>
                        {' '} • <span className="text-blue-600 text-xs">Account Number:</span>{' '}
                        <span className="font-mono text-slate-600">{w.account_number}</span>
                      </>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-slate-500 text-sm">No wallets available</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
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
  const [activeType, setActiveType] = useState('currency') // 'currency' or 'cryptocurrency'
  const [showCryptoAddressModal, setShowCryptoAddressModal] = useState(false)
  const [selectedAddressMethod, setSelectedAddressMethod] = useState(null)
  const [showDepositDetailsModal, setShowDepositDetailsModal] = useState(false)
  const [selectedDepositForDetails, setSelectedDepositForDetails] = useState(null)

  useEffect(() => {
    loadInitialData()
  }, [userId])

  useEffect(() => {
    fetchExchangeRates()

    // When switching to crypto mode
    if (activeType === 'cryptocurrency') {
      // Select the first available crypto currency
      const availableCrypto = cryptoCurrencies.find(c => c.code in cryptoAddresses)
      if (availableCrypto) {
        setSelectedCurrency(availableCrypto.code)
      }

      // Auto-select PHP wallet for crypto deposits
      const phpWallet = wallets.find(w => w.currency_code === 'PHP')
      if (phpWallet) {
        setSelectedWallet(phpWallet.id)
      }
    }
  }, [activeType, cryptoAddresses, wallets])

  const fetchExchangeRates = async () => {
    try {
      setRatesLoading(true)
      const rates = {}

      if (activeType === 'currency') {
        try {
          const globalRates = await currencyAPI.getGlobalRates()
          if (globalRates) {
            Object.entries(globalRates).forEach(([code, data]) => {
              rates[code] = data.rate
            })
          }
        } catch (e) {
          console.warn('Failed to fetch fiat exchange rates:', e)
        }
      } else {
        // For crypto, fetch rates for all available crypto currencies
        // First collect all cryptos to fetch
        const cryptoCurrenciesToFetch = new Set(Object.keys(cryptoAddresses))

        // Also include any crypto wallets the user has
        wallets.forEach(wallet => {
          if (wallet.currency_type === 'crypto') {
            cryptoCurrenciesToFetch.add(wallet.currency_code)
          }
        })

        // Fetch all crypto prices in one API call (more efficient than individual calls)
        if (cryptoCurrenciesToFetch.size > 0) {
          try {
            const cryptoCodes = Array.from(cryptoCurrenciesToFetch)
            const pricesFromApi = await getMultipleCryptoPrices(cryptoCodes, 'PHP')

            if (pricesFromApi && Object.keys(pricesFromApi).length > 0) {
              Object.assign(rates, pricesFromApi)
            } else {
              // If batch fetch fails, try individual fetches as fallback
              console.warn('Batch crypto price fetch returned no data, trying individual fetches...')
              for (const cryptoCode of cryptoCodes) {
                try {
                  const price = await getCryptoPrice(cryptoCode, 'PHP')
                  if (price) {
                    rates[cryptoCode] = price
                  }
                } catch (e) {
                  console.warn(`Failed to fetch individual rate for ${cryptoCode}:`, e.message)
                }
              }
            }
          } catch (e) {
            console.error('Failed to fetch batch crypto rates:', e.message)
          }
        }

        // Ensure PHP rate is set to 1 for conversion calculations
        rates['PHP'] = 1
      }

      setExchangeRates(rates)
      setRatesLoading(false)
    } catch (err) {
      console.error('Error fetching exchange rates:', err)
      setExchangeRates({ PHP: 1 })
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
      setLoading(true)
      setError('')

      if (!userId || userId.includes('guest')) {
        setLoading(false)
        return
      }

      // Load wallets, currencies, and crypto addresses in parallel
      const [walletsResult, currenciesResult] = await Promise.all([
        supabase
          .from('wallets')
          .select('id, user_id, currency_code, balance, created_at, account_number')
          .eq('user_id', userId),
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
              balance: 0
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

      // Set PHP as default wallet (it should always exist now)
      const phpWallet = enrichedWallets.find(w => w.currency_code === 'PHP')
      if (phpWallet) {
        setSelectedWallet(phpWallet.id)
      } else if (enrichedWallets.length > 0) {
        setSelectedWallet(enrichedWallets[0].id)
      }

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

      setLoading(false)
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

      const { data, error: err } = await supabase
        .from('wallets')
        .insert([{
          user_id: userId,
          currency_code: newWalletCurrency,
          balance: 0
        }])
        .select()
        .single()

      if (err) throw err

      setWallets([...wallets, data])
      setSelectedWallet(data.id)
      setShowWalletModal(false)
      setSuccess(`${newWalletCurrency} wallet created successfully`)
      setTimeout(() => setSuccess(''), 2000)
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

    // Get exchange rates for both currencies
    const fromRate = exchangeRates[selectedCurrency]
    const toRate = exchangeRates[selectedWalletData.currency_code]

    if (!fromRate || !toRate) {
      console.warn('Missing exchange rates for conversion:', { fromRate, toRate, from: selectedCurrency, to: selectedWalletData.currency_code })
      return null
    }

    // Check if this is a crypto-to-fiat conversion
    // For crypto: exchangeRates[crypto] = price in PHP, exchangeRates[PHP] = 1
    // For fiat: exchangeRates[fiat] = exchange rate relative to a base
    const isCryptoToFiat = activeType === 'cryptocurrency' && selectedWalletData.currency_code === 'PHP'

    if (isCryptoToFiat) {
      // For crypto to PHP: amount in crypto * price per crypto
      // fromRate is the price in PHP, so just multiply
      const convertedAmount = numAmount * fromRate
      return Math.round(convertedAmount * 100) / 100
    } else {
      // For fiat-to-fiat: (amount in from currency / from rate) * to rate
      const convertedAmount = (numAmount / fromRate) * toRate
      return Math.round(convertedAmount * 100) / 100
    }
  }

  const handleInitiateDeposit = async () => {
    try {
      setSubmitting(true)
      setError('')

      if (!amount || parseFloat(amount) <= 0) {
        setError('Please enter a valid amount')
        setSubmitting(false)
        return
      }

      if (!selectedMethod) {
        setError('Please select a payment method')
        setSubmitting(false)
        return
      }

      // For GCash, require reference number
      if (selectedMethod === 'gcash' && !gcashReferenceNumber.trim()) {
        setError('Please enter your GCash transaction reference number')
        setSubmitting(false)
        return
      }

      // For crypto deposits, always use PHP wallet as target
      let targetWalletId = selectedWallet
      let targetWalletData = wallets.find(w => w.id === selectedWallet)

      const isCryptoDeposit = activeType === 'cryptocurrency'
      if (isCryptoDeposit) {
        const phpWallet = wallets.find(w => w.currency_code === 'PHP')
        if (!phpWallet) {
          throw new Error('PHP wallet not found. Please create one first.')
        }
        targetWalletId = phpWallet.id
        targetWalletData = phpWallet
      }

      // Calculate converted amount using real-time rates
      let convertedAmount = null
      if (isCryptoDeposit) {
        // For crypto, convert from crypto to PHP using real-time rates
        const cryptoRate = exchangeRates[selectedCurrency]
        const phpRate = exchangeRates['PHP'] || 1

        if (!cryptoRate) {
          setError(`Could not fetch exchange rate for ${selectedCurrency}. Please try again.`)
          setSubmitting(false)
          return
        }

        // Convert: (amount in crypto) * (crypto rate / PHP rate)
        convertedAmount = parseFloat(amount) * (cryptoRate / phpRate)
        convertedAmount = Math.round(convertedAmount * 100) / 100
      } else {
        // For fiat deposits
        const fromRate = exchangeRates[selectedCurrency]
        const toRate = exchangeRates[targetWalletData?.currency_code]

        if (fromRate && toRate) {
          convertedAmount = (parseFloat(amount) / fromRate) * toRate
          convertedAmount = Math.round(convertedAmount * 100) / 100
        } else {
          console.warn('Rates unavailable, using original amount')
          convertedAmount = parseFloat(amount)
        }
      }

      if (!convertedAmount || convertedAmount <= 0) {
        setError('Could not calculate conversion amount. Please try again.')
        setSubmitting(false)
        return
      }

      // All deposits start as pending - status will update based on verification
      const depositStatus = 'pending'

      // Determine the deposit method
      // For crypto: use the selected currency (e.g., 'btc', 'eth', 'sol')
      // For fiat: use the selected method (e.g., 'gcash', 'stripe')
      let depositMethodValue = selectedMethod
      if (activeType === 'cryptocurrency' && selectedCurrency) {
        depositMethodValue = selectedCurrency.toLowerCase()
      }

      // Create deposit record with conversion info
      const { data: deposit, error: err } = await supabase
        .from('deposits')
        .insert([{
          user_id: userId,
          wallet_id: targetWalletId,
          amount: parseFloat(amount),
          currency_code: targetWalletData.currency_code,
          deposit_method: depositMethodValue,
          phone_number: selectedMethod === 'gcash' ? gcashReferenceNumber.trim() : null,
          status: depositStatus,
          description: `${activeType === 'cryptocurrency' ? selectedCurrency : selectedMethod} deposit of ${amount} ${selectedCurrency}${convertedAmount ? ` (≈ ${convertedAmount} ${targetWalletData.currency_code} at ${(convertedAmount / parseFloat(amount)).toFixed(6)})` : ''}`,
          notes: JSON.stringify({
            original_currency: selectedCurrency,
            deposit_type: activeType,
            converted_amount: convertedAmount,
            conversion_rate: convertedAmount ? (convertedAmount / parseFloat(amount)).toFixed(6) : null,
            wallet_currency: targetWalletData.currency_code,
            network: activeMethodData?.network || null
          })
        }])
        .select()
        .single()

      if (err) {
        console.error('Deposit insert error details:', err)
        console.error('Error code:', err?.code)
        console.error('Error hint:', err?.hint)
        throw new Error(err.message || JSON.stringify(err))
      }

      // Add to deposits list
      setDeposits([deposit, ...deposits])

      setSuccess('Pending')
      setError('')

      // Move to confirmation step
      setStep('confirm')
    } catch (err) {
      const errorMsg = err?.message || err?.toString?.() || JSON.stringify(err) || 'Failed to initiate deposit'
      console.error('Error creating deposit:', err)
      console.error('Error message:', errorMsg)
      setError(errorMsg)
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

  // Filter wallets by type
  const currencyWallets = wallets.filter(w => w.currency_type === 'fiat')
  // For crypto deposits, only show PHP wallet to receive converted funds
  const cryptocurrencyWallets = wallets.filter(w => w.currency_code === 'PHP')

  // Get currency codes that user has wallets for
  const userCurrencyCodes = new Set(wallets.map(w => w.currency_code))

  // Filter currencies by type
  // For fiat: only show those with existing wallets
  // For crypto: show only those with addresses configured in wallets_house
  const currencyCurrencies = currencies.filter(c => c.type === 'fiat' && userCurrencyCodes.has(c.code))
  const cryptoCurrencies = currencies.filter(c => c.type === 'crypto' && cryptoAddresses[c.code])
  const displayedCurrencies = activeType === 'currency' ? currencyCurrencies : cryptoCurrencies

  // For Create Wallet modal, show currencies they don't have yet
  const availableForNewWallets = activeType === 'currency'
    ? currencies.filter(c => c.type === 'fiat' && !userCurrencyCodes.has(c.code))
    : currencies.filter(c => c.type === 'crypto' && !userCurrencyCodes.has(c.code))

  // Filter deposit methods by type
  let availableMethods = Object.values(DEPOSIT_METHODS).filter(m =>
    activeType === 'currency' ? m.type === 'fiat' : m.type === 'crypto'
  )

  // For crypto, add dynamic methods from wallets_house - ONLY for selected currency
  if (activeType === 'cryptocurrency' && Object.keys(cryptoAddresses).length > 0) {
    const dynamicMethods = []

    // Only show methods for the selected currency
    if (selectedCurrency && cryptoAddresses[selectedCurrency]) {
      const data = cryptoAddresses[selectedCurrency]
      // Handle both single address and multiple networks
      const addresses = Array.isArray(data) ? data : [data]
      addresses.forEach((addressData, idx) => {
        const cryptoName = addressData.currency_name || selectedCurrency
        dynamicMethods.push({
          id: addresses.length > 1 ? `${selectedCurrency.toLowerCase()}-${idx}` : selectedCurrency.toLowerCase(),
          name: addresses.length > 1 ? `${selectedCurrency} (${addressData.network})` : selectedCurrency,
          icon: selectedCurrency,
          type: 'crypto',
          description: `Send ${cryptoName} directly to our wallet${addresses.length > 1 ? ` via ${addressData.network}` : ''}`,
          address: addressData.address,
          network: addressData.network,
          provider: addressData.provider,
          cryptoSymbol: selectedCurrency,
          cryptoName: cryptoName
        })
      })
    }
    // Replace hardcoded methods with dynamic ones
    availableMethods = dynamicMethods
  }

  // When switching currencies in crypto mode, reset the selected method and step
  // This ensures only methods for the selected currency are shown
  useEffect(() => {
    if (activeType === 'cryptocurrency') {
      // Check if selected method is still valid for the new currency
      const isValidForCurrency = selectedCurrency && cryptoAddresses[selectedCurrency]
      if (selectedMethod && !isValidForCurrency) {
        setSelectedMethod(null)
        // If we were in confirm step, go back to amount step since method is no longer valid
        if (step === 'confirm') {
          setStep('amount')
        }
      }
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
  // For fiat methods, use DEPOSIT_METHODS; for crypto methods, use selectedAddressMethod
  const selectedMethodData = selectedMethod && DEPOSIT_METHODS[selectedMethod] ? DEPOSIT_METHODS[selectedMethod] : null
  // For the confirm step, use whichever method is available (fiat or crypto)
  const activeMethodData = selectedMethodData || selectedAddressMethod

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
          {(currencyCurrencies.length > 0 || cryptoCurrencies.length > 0) && (
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
            <h2 className="text-2xl font-semibold text-slate-900 mb-6">How much would you like to deposit?</h2>

            <div className="space-y-6">
              {/* Create Wallet Button - First Row */}
              <div className="flex items-center justify-end mb-2">
                <button
                  type="button"
                  onClick={() => setShowWalletModal(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Create Wallet
                </button>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Amount</label>
                <div className="flex gap-3">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                    className="px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {displayedCurrencies.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Wallet Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Deposit to Wallet</label>
                <WalletDropdown
                  wallets={activeType === 'currency' ? currencyWallets : cryptocurrencyWallets}
                  selectedWallet={selectedWallet}
                  onChange={setSelectedWallet}
                />
                {!selectedWallet && (
                  <p className="text-xs text-slate-500 mt-2">Create a wallet if you don't have one for this currency</p>
                )}
              </div>

              {/* Conversion Display */}
              {amount && selectedWallet && (activeType === 'cryptocurrency' || selectedCurrency !== selectedWalletData?.currency_code) && (
                <div className={`border rounded-lg p-6 ${!calculateConvertedAmount() && !exchangeRates[selectedCurrency] ? 'bg-amber-50 border-amber-200' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'}`}>
                  {activeType === 'cryptocurrency' ? (
                    <>
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">
                        Convert {selectedCurrency} <span className="text-indigo-600">{selectedCurrency}</span> to Philippine Peso <span className="text-indigo-600">PHP</span>
                      </h3>
                      <p className="text-sm text-slate-600 mb-4">
                        {!exchangeRates[selectedCurrency] ? (
                          <span>⏳ Fetching rate for {selectedCurrency}...</span>
                        ) : (
                          `${amount} ${selectedCurrency} = ${(parseFloat(amount) * exchangeRates[selectedCurrency]).toLocaleString(undefined, { maximumFractionDigits: 2 })} PHP as of ${new Date().toLocaleString(undefined, { month: 'short', day: 'numeric' })}`
                        )}
                      </p>
                      <div className="flex gap-4 items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-600 mb-1">Amount in {selectedCurrency}</p>
                          <p className="text-3xl font-bold text-slate-900">{parseFloat(amount) || 0}</p>
                        </div>
                        <div className="text-slate-400 text-xl">↔</div>
                        <div className="text-right">
                          <p className="text-xs text-slate-600 mb-1">You receive in PHP</p>
                          <p className={`text-3xl font-bold ${calculateConvertedAmount() ? 'text-indigo-600' : 'text-amber-600'}`}>
                            {calculateConvertedAmount() ? calculateConvertedAmount().toLocaleString(undefined, { maximumFractionDigits: 2 }) : (
                              exchangeRates[selectedCurrency] ? (parseFloat(amount) * exchangeRates[selectedCurrency]).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '⏳'
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
                          ) : (
                            `1 ${selectedCurrency} = ${(exchangeRates[selectedWalletData?.currency_code] / exchangeRates[selectedCurrency]).toFixed(6)} ${selectedWalletData?.currency_code}`
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-600">You will receive</p>
                        <p className={`text-2xl font-bold ${calculateConvertedAmount() ? 'text-blue-600' : 'text-amber-600'}`}>
                          {calculateConvertedAmount() ? calculateConvertedAmount().toLocaleString(undefined, { maximumFractionDigits: 2 }) : (
                            exchangeRates[selectedCurrency] && exchangeRates[selectedWalletData?.currency_code] ? (parseFloat(amount) * (exchangeRates[selectedCurrency] / exchangeRates[selectedWalletData?.currency_code])).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '⏳'
                          )} {selectedWalletData?.currency_code}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Select Deposit Method / Network */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-slate-700">
                    {activeType === 'cryptocurrency' ? 'Blockchain Network' : 'Payment Method'}
                  </label>
                  {activeType === 'cryptocurrency' && !exchangeRates[selectedCurrency] && (
                    <button
                      onClick={fetchExchangeRates}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Retry Rate
                    </button>
                  )}
                </div>
                {availableMethods.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {availableMethods.map(method => (
                      <button
                        key={method.id}
                        onClick={() => {
                          setSelectedAddressMethod(method)
                          setShowCryptoAddressModal(true)
                        }}
                        className="p-4 border-2 border-slate-200 rounded-lg text-left transition-all hover:border-blue-400 hover:bg-blue-50"
                      >
                        <div className="font-semibold text-slate-900">{method.name}</div>
                        <div className="text-sm text-slate-600">{method.description}</div>
                        {method.network && (
                          <div className="text-xs text-blue-600 font-medium mt-2">{method.network}</div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                    {activeType === 'cryptocurrency' ? (
                      <>
                        <p className="font-medium mb-2">⚠️ No deposit methods available for {selectedCurrency}</p>
                        <p>This cryptocurrency may not be configured yet. Please select a different currency or contact support.</p>
                      </>
                    ) : (
                      <p>No payment methods available for {selectedCurrency}. Please create a wallet first.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Payment Instructions */}
        {step === 'confirm' && activeMethodData && selectedWalletData && (
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 mb-6">
            <h2 className="text-2xl font-semibold text-slate-900 mb-6">
              {amount} {selectedCurrency.toUpperCase()} via {activeMethodData.name}
            </h2>

            {/* Deposit Summary */}
            <div className="bg-slate-50 rounded-lg p-6 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide">Amount</p>
                  <p className="text-xl font-semibold text-slate-900">{amount} {selectedCurrency.toUpperCase()}</p>
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
                    <span className="font-semibold text-slate-900">{amount} {selectedCurrency}</span>
                  </div>
                  {exchangeRates[selectedCurrency] && (
                    <div className="flex justify-between items-center text-sm text-slate-600">
                      <span>Rate:</span>
                      <span>1 {selectedCurrency} = {exchangeRates[selectedCurrency]?.toFixed(2) || 'N/A'} {selectedWalletData.currency_code}</span>
                    </div>
                  )}
                  {calculateConvertedAmount() && selectedCurrency !== selectedWalletData.currency_code && (
                    <div className="flex justify-between items-center pt-3 border-t border-blue-200">
                      <span className="text-slate-900 font-medium">You Receive:</span>
                      <span className="text-lg font-bold text-blue-600">{calculateConvertedAmount()} {selectedWalletData.currency_code}</span>
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
                disabled={submitting || (selectedMethod === 'gcash' && !gcashReferenceNumber.trim())}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {submitting ? 'Processing...' : 'Send Payment'}
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
