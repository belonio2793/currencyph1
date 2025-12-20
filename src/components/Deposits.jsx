import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import CurrencyCryptoToggle from './FiatCryptoToggle'
import { currencyAPI } from '../lib/currencyAPI'
import { getCryptoPrice } from '../lib/cryptoRatesService'
import { coinsPhApi } from '../lib/coinsPhApi'

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
    description: 'Instant mobile payment (Philippines)',
    instructions: [
      'Open your GCash app',
      'Go to Send Money or Payment option',
      'Enter the merchant details provided below',
      'Confirm the amount and complete the transaction',
      'Your balance will be updated within 1-5 minutes'
    ]
  },
  solana: {
    id: 'solana',
    name: 'Solana',
    icon: '◎',
    type: 'crypto',
    description: 'Cryptocurrency transfer',
    instructions: [
      'Open your Solana wallet app',
      'Scan the QR code or copy the address below',
      'Enter the amount in SOL',
      'Verify the recipient address and amount',
      'Confirm the transaction',
      'Your balance will be updated within 1-2 minutes'
    ]
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
                {selectedWalletData.currency_name} ({selectedWalletData.balance.toFixed(2)})
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
                    {w.currency_name} ({w.balance.toFixed(2)})
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

  useEffect(() => {
    loadInitialData()
  }, [userId])

  useEffect(() => {
    fetchExchangeRates()
  }, [activeType])

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
        // For crypto, fetch rates for each crypto currency we have
        const cryptoWallets = wallets.filter(w => w.currency_type === 'crypto')
        for (const wallet of cryptoWallets) {
          try {
            const price = await getCryptoPrice(wallet.currency_code)
            if (price) {
              rates[wallet.currency_code] = price
            }
          } catch (e) {
            console.warn(`Failed to fetch rate for ${wallet.currency_code}:`, e.message)
          }
        }
      }

      setExchangeRates(rates)
      setRatesLoading(false)
    } catch (err) {
      console.error('Error fetching exchange rates:', err)
      setRatesLoading(false)
    }
  }

  const loadCryptoAddresses = async () => {
    try {
      const { data: houseWallets, error } = await supabase
        .from('wallets_house')
        .select('currency, address, network, provider')
        .eq('wallet_type', 'crypto')
        .eq('provider', 'coins.ph')

      if (error) throw error

      // Map to { 'BTC': { address: '...', network: '...', provider: 'coins.ph' } }
      const addressMap = {}
      if (houseWallets && houseWallets.length > 0) {
        houseWallets.forEach(wallet => {
          addressMap[wallet.currency] = {
            address: wallet.address,
            network: wallet.network,
            provider: wallet.provider
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

      const walletsData = walletsResult.data || []
      const allCurrencies = currenciesResult.data || []

      // Create a map of currencies for quick lookup
      const currencyMap = Object.fromEntries(
        allCurrencies.map(c => [c.code, c])
      )

      // Enrich wallets with currency type and name info
      const enrichedWallets = walletsData.map(w => ({
        ...w,
        currency_type: currencyMap[w.currency_code]?.type || 'unknown',
        currency_name: currencyMap[w.currency_code]?.name || w.currency_code,
        currency_symbol: currencyMap[w.currency_code]?.symbol || ''
      }))

      setWallets(enrichedWallets)

      // Set PHP as default wallet if it exists, otherwise use first wallet
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

    // Convert: (amount in from currency / from rate) * to rate
    const convertedAmount = (numAmount / fromRate) * toRate
    return Math.round(convertedAmount * 100) / 100
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

      if (!selectedWallet) {
        setError('Please select a wallet')
        setSubmitting(false)
        return
      }

      const selectedWalletData = wallets.find(w => w.id === selectedWallet)
      let convertedAmount = calculateConvertedAmount()

      // If conversion failed due to missing rates, use the original amount
      if (!convertedAmount && selectedCurrency !== selectedWalletData.currency_code) {
        console.warn('Conversion rates unavailable, using original amount')
        convertedAmount = parseFloat(amount)
      } else if (!convertedAmount) {
        convertedAmount = parseFloat(amount)
      }

      // Determine deposit status based on method
      // Crypto deposits auto-approve, fiat stays pending
      const depositStatus = selectedMethod === 'solana' ? 'approved' : 'pending'

      // Create deposit record with conversion info
      const { data: deposit, error: err } = await supabase
        .from('deposits')
        .insert([{
          user_id: userId,
          wallet_id: selectedWallet,
          amount: parseFloat(amount),
          original_currency: selectedCurrency,
          converted_amount: convertedAmount,
          wallet_currency: selectedWalletData.currency_code,
          currency_code: selectedWalletData.currency_code,
          deposit_method: selectedMethod,
          status: depositStatus,
          description: `${DEPOSIT_METHODS[selectedMethod].name} deposit of ${amount} ${selectedCurrency}${convertedAmount && selectedCurrency !== selectedWalletData.currency_code ? ` (≈ ${convertedAmount} ${selectedWalletData.currency_code})` : ''}`
        }])
        .select()
        .single()

      if (err) throw err

      // Update wallet balance if approved
      if (depositStatus === 'approved' && convertedAmount) {
        const newBalance = selectedWalletData.balance + convertedAmount
        await supabase
          .from('wallets')
          .update({ balance: newBalance })
          .eq('id', selectedWallet)
      }

      // Add to deposits list
      setDeposits([deposit, ...deposits])

      const statusMessage = depositStatus === 'approved'
        ? 'Deposit approved and credited to your wallet!'
        : 'Deposit initiated. Awaiting payment...'
      setSuccess(statusMessage)

      // Move to confirmation step
      setStep('confirm')
    } catch (err) {
      console.error('Error creating deposit:', err)
      setError(err.message || 'Failed to initiate deposit')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStartNewDeposit = () => {
    setAmount('')
    setSelectedCurrency(globalCurrency)
    setSelectedMethod(null)
    setStep('amount')
    setSuccess('')
    setError('')
  }

  // Filter wallets by type
  const currencyWallets = wallets.filter(w => w.currency_type === 'fiat')
  const cryptocurrencyWallets = wallets.filter(w => w.currency_type === 'crypto')

  // Get currency codes that user has wallets for
  const userCurrencyCodes = new Set(wallets.map(w => w.currency_code))

  // Filter currencies by type and only show currencies user has wallets for
  const currencyCurrencies = currencies.filter(c => c.type === 'fiat' && userCurrencyCodes.has(c.code))
  const cryptoCurrencies = currencies.filter(c => c.type === 'crypto' && userCurrencyCodes.has(c.code))
  const displayedCurrencies = activeType === 'currency' ? currencyCurrencies : cryptoCurrencies

  // For Create Wallet modal, show currencies they don't have yet
  const availableForNewWallets = activeType === 'currency'
    ? currencies.filter(c => c.type === 'fiat' && !userCurrencyCodes.has(c.code))
    : currencies.filter(c => c.type === 'crypto' && !userCurrencyCodes.has(c.code))

  // Filter deposit methods by type
  let availableMethods = Object.values(DEPOSIT_METHODS).filter(m =>
    activeType === 'currency' ? m.type === 'fiat' : m.type === 'crypto'
  )

  // For crypto, add dynamic methods from wallets_house
  if (activeType === 'cryptocurrency' && Object.keys(cryptoAddresses).length > 0) {
    const dynamicMethods = Object.entries(cryptoAddresses).map(([symbol, data]) => ({
      id: symbol.toLowerCase(),
      name: symbol,
      icon: '₿', // Generic crypto icon
      type: 'crypto',
      description: `Send ${symbol} directly to our wallet`,
      instructions: [
        `Open your ${symbol} wallet app`,
        `Scan the QR code or copy the address below`,
        `Enter the amount in ${symbol}`,
        `Verify the recipient address and amount`,
        `Confirm the transaction`,
        `Your balance will be updated within 1-2 minutes`
      ],
      address: data.address,
      network: data.network,
      provider: data.provider
    }))
    // Replace hardcoded methods with dynamic ones
    availableMethods = dynamicMethods
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setSuccess('Copied to clipboard')
    setTimeout(() => setSuccess(''), 2000)
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
  const selectedMethodData = DEPOSIT_METHODS[selectedMethod]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header with Toggle */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Add Funds</h1>
            <p className="text-slate-600 mt-2">
              Deposit money into your wallet using {
                Object.keys(cryptoAddresses).length > 0
                  ? `${Object.keys(cryptoAddresses).join(', ')} or other payment methods`
                  : 'available payment methods'
              }
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
              {amount && selectedWallet && selectedCurrency !== selectedWalletData?.currency_code && (
                <div className={`border rounded-lg p-4 ${ratesLoading || !calculateConvertedAmount() ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Conversion Rate</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {ratesLoading ? 'Loading rates...' : !exchangeRates[selectedCurrency] || !exchangeRates[selectedWalletData?.currency_code] ? '⚠️ Rates unavailable - using original amount' : `1 ${selectedCurrency} = ${(exchangeRates[selectedWalletData?.currency_code] / exchangeRates[selectedCurrency]).toFixed(6)} ${selectedWalletData?.currency_code}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-600">You will receive</p>
                      <p className={`text-2xl font-bold ${calculateConvertedAmount() ? 'text-blue-600' : 'text-amber-600'}`}>
                        {ratesLoading ? 'Calculating...' : `${calculateConvertedAmount() || parseFloat(amount)} ${selectedWalletData?.currency_code}`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Select Deposit Method */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">Payment Method</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availableMethods.map(method => (
                    <button
                      key={method.id}
                      onClick={() => {
                        setSelectedMethod(method.id)
                        setStep('confirm')
                      }}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        selectedMethod === method.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-2xl mb-2">{method.icon}</div>
                      <div className="font-semibold text-slate-900">{method.name}</div>
                      <div className="text-sm text-slate-600">{method.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Payment Instructions */}
        {step === 'confirm' && selectedMethodData && selectedWalletData && (
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 mb-6">
            <h2 className="text-2xl font-semibold text-slate-900 mb-6">
              {amount} {selectedCurrency} via {selectedMethodData.name}
            </h2>

            {/* Deposit Summary */}
            <div className="bg-slate-50 rounded-lg p-6 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide">Amount</p>
                  <p className="text-xl font-semibold text-slate-900">{amount} {selectedCurrency}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide">Method</p>
                  <p className="text-lg font-semibold text-slate-900">{selectedMethodData.name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide">Wallet</p>
                  <p className="text-lg font-semibold text-slate-900">{selectedWalletData.currency_code}</p>
                </div>
                {calculateConvertedAmount() && selectedCurrency !== selectedWalletData.currency_code && (
                  <div>
                    <p className="text-xs text-slate-600 uppercase tracking-wide">You Receive</p>
                    <p className="text-xl font-semibold text-blue-600">{calculateConvertedAmount()} {selectedWalletData.currency_code}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Instructions */}
            <div className="mb-8">
              <h3 className="font-semibold text-slate-900 mb-4">📋 Payment Instructions:</h3>
              <ol className="space-y-3">
                {selectedMethodData.instructions.map((instruction, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-slate-700">{instruction}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Cryptocurrency Address QR */}
            {selectedMethod && selectedMethodData?.type === 'crypto' && selectedMethodData?.address && (
              <div className="mb-8 p-6 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm text-slate-600 mb-3 font-medium">Send {selectedMethodData.name} to this address:</p>
                <div className="flex gap-4 items-center">
                  <div className="flex-shrink-0">
                    <svg width="120" height="120" viewBox="0 0 120 120">
                      <rect width="120" height="120" fill="white" rx="8" />
                      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="10" fill="#1e1b4b">
                        [QR Code]
                      </text>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-mono text-xs bg-white p-3 rounded border border-slate-300 break-all text-slate-800">
                      {selectedMethodData.address}
                    </p>
                    <button
                      onClick={() => copyToClipboard(selectedMethodData.address)}
                      className="mt-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Copy Address
                    </button>
                  </div>
                </div>
                {selectedMethodData.network && (
                  <p className="text-xs text-slate-600 mt-3">Network: <span className="font-semibold">{selectedMethodData.network}</span></p>
                )}
                {selectedMethodData.provider && (
                  <p className="text-xs text-slate-600">Provider: <span className="font-semibold">{selectedMethodData.provider}</span></p>
                )}
              </div>
            )}

            {/* Important Notes */}
            <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="font-semibold text-yellow-900 mb-2">⚠️ Important:</p>
              <ul className="text-sm text-yellow-800 space-y-1">
                {selectedMethodData?.type === 'crypto' && (
                  <>
                    <li>• Only send {selectedMethodData.name} ({selectedMethodData.name}) to this address</li>
                    {selectedMethodData.network && <li>• Network: {selectedMethodData.network}</li>}
                    <li>• Do not send other tokens or cryptocurrencies</li>
                    <li>• Transactions cannot be reversed</li>
                    <li>• Keep the transaction hash for your records</li>
                    <li>• Address is from our official Coins.ph account</li>
                  </>
                )}
                {selectedMethodData?.type === 'fiat' && (
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
                onClick={handleStartNewDeposit}
                className="flex-1 px-6 py-3 border border-slate-300 rounded-lg text-slate-900 font-medium hover:bg-slate-50 transition"
              >
                Back
              </button>
              <button
                onClick={handleStartNewDeposit}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
              >
                Done
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
                    <th className="text-left py-3 px-4 text-slate-600 font-medium">Method</th>
                    <th className="text-left py-3 px-4 text-slate-600 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-slate-600 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.slice(0, 5).map(deposit => (
                    <tr key={deposit.id} className="border-b border-slate-100">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {deposit.amount} {deposit.original_currency || deposit.currency_code}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {deposit.converted_amount ? `${deposit.converted_amount} ${deposit.wallet_currency || deposit.currency_code}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {DEPOSIT_METHODS[deposit.deposit_method]?.name || deposit.deposit_method}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          deposit.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          deposit.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {deposit.status.charAt(0).toUpperCase() + deposit.status.slice(1)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs">
                        {new Date(deposit.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
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
    </div>
  )
}

export default React.memo(DepositsComponent)
