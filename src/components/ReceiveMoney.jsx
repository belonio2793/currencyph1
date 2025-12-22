import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { currencyAPI } from '../lib/payments'
import { formatNumber, getCurrencySymbol } from '../lib/currency'
import { CRYPTOCURRENCY_DEPOSITS } from '../data/cryptoDeposits'
import FiatCryptoToggle from './FiatCryptoToggle'
import receiveMoneyService from '../lib/receiveMoneyService'

export default function ReceiveMoney({ userId, globalCurrency = 'PHP' }) {
  // State: User/Guest info
  const [isGuest, setIsGuest] = useState(!userId || userId.includes('guest'))
  const [guestSearch, setGuestSearch] = useState('')
  const [guestSearchResults, setGuestSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [selectedGuestProfile, setSelectedGuestProfile] = useState(null)

  const [wallets, setWallets] = useState([])
  const [selectedWallet, setSelectedWallet] = useState(null)

  // State: Amount & currency
  const [amount, setAmount] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState(globalCurrency)
  const [step, setStep] = useState(1) // 1: select wallet/guest, 2: method, 3: amount, 4: confirmation, 5: success
  const [activeType, setActiveType] = useState('fiat') // 'fiat' or 'crypto'

  // State: Payment method selection
  const [selectedMethod, setSelectedMethod] = useState(null) // 'gcash', 'bank', 'crypto'
  const [selectedCryptoNetwork, setSelectedCryptoNetwork] = useState(null)
  const [selectedDepositAddress, setSelectedDepositAddress] = useState(null)

  // State: Exchange rates
  const [exchangeRates, setExchangeRates] = useState({})
  const [ratesLoading, setRatesLoading] = useState(false)

  // State: Crypto deposits
  const [cryptoAddresses, setCryptoAddresses] = useState({}) // { 'BTC': [...addresses] }
  const [depositMethods, setDepositMethods] = useState({ crypto: [], fiat: [] })

  // State: Processing
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [receiveLink, setReceiveLink] = useState(null)
  const [copyFeedback, setCopyFeedback] = useState('')

  // State: Deposit history
  const [deposits, setDeposits] = useState([])

  const searchInputRef = useRef(null)

  const [availableMethods, setAvailableMethods] = useState({ fiat: [], crypto: [] })

  // Load initial data
  useEffect(() => {
    // Set crypto addresses immediately
    const addressesByCode = {}
    try {
      if (CRYPTOCURRENCY_DEPOSITS && CRYPTOCURRENCY_DEPOSITS.length > 0) {
        CRYPTOCURRENCY_DEPOSITS.forEach(deposit => {
          const code = deposit.currency.split('(')[1]?.replace(')', '') || deposit.currency.split(' ')[0]
          if (!addressesByCode[code]) {
            addressesByCode[code] = []
          }
          addressesByCode[code].push({
            currency: deposit.currency,
            network: deposit.network,
            address: deposit.address,
            metadata: deposit.metadata || {}
          })
        })
      }
    } catch (err) {
      console.warn('Error organizing crypto addresses:', err)
    }

    setCryptoAddresses(addressesByCode)
    const firstCryptoCode = Object.keys(addressesByCode)[0]
    if (firstCryptoCode) {
      setSelectedCryptoNetwork(firstCryptoCode)
    }

    // Load deposit methods
    loadDepositMethods()

    // Load wallets and deposits asynchronously
    loadData()
  }, [userId])

  // Search profiles when guest search changes
  useEffect(() => {
    if (guestSearch.trim().length >= 2) {
      searchUserProfiles()
    } else {
      setGuestSearchResults([])
      setShowSearchResults(false)
    }
  }, [guestSearch])

  const searchUserProfiles = async () => {
    try {
      const results = await receiveMoneyService.searchProfiles(guestSearch)
      setGuestSearchResults(results)
      setShowSearchResults(true)
    } catch (err) {
      console.error('Error searching profiles:', err)
      setGuestSearchResults([])
    }
  }

  const loadDepositMethods = async () => {
    try {
      // Fetch all transfer methods from public.transfers
      const { data: transfers, error } = await supabase
        .from('transfers')
        .select('id, name, type')
        .eq('active', true)

      if (error) throw error

      // Organize methods by type and filter out bank transfers
      const fiat = []
      const crypto = []

      if (transfers) {
        transfers.forEach(transfer => {
          // Skip bank transfer method
          if (transfer.name?.toLowerCase() === 'bank transfer' || transfer.name?.toLowerCase() === 'bank') {
            return
          }

          const method = {
            id: transfer.id || transfer.name?.toLowerCase(),
            name: transfer.name,
            description: transfer.type || ''
          }

          if (transfer.type?.toLowerCase() === 'crypto' || transfer.name?.toLowerCase().includes('crypto')) {
            crypto.push(method)
          } else {
            fiat.push(method)
          }
        })
      }

      setAvailableMethods({ fiat, crypto })
      setDepositMethods({ fiat, crypto })
    } catch (err) {
      console.warn('Error loading deposit methods:', err)
      // Fallback to default GCash only if no data
      setAvailableMethods({ fiat: [{ id: 'gcash', name: 'GCash', description: 'Mobile wallet' }], crypto: [] })
    }
  }

  // Fetch exchange rates
  useEffect(() => {
    if (activeType === 'crypto') {
      fetchExchangeRates()
    }
  }, [activeType])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      // Load user's wallets if authenticated
      if (userId && !userId.includes('guest')) {
        try {
          const { data: userWallets, error: walletsError } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })

          if (!walletsError && userWallets) {
            setWallets(userWallets)
            if (userWallets.length > 0) {
              setSelectedWallet(userWallets[0].id)
            }
          }
        } catch (err) {
          console.warn('Error loading wallets:', err)
        }

        // Load recent deposits
        try {
          const { data: userDeposits, error: depositsError } = await supabase
            .from('deposits')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10)

          if (!depositsError && userDeposits) {
            setDeposits(userDeposits)
          }
        } catch (err) {
          console.warn('Error loading deposits:', err)
        }
      }
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Some data could not be loaded, but you can still use the page')
    } finally {
      setLoading(false)
    }
  }

  const fetchExchangeRates = async () => {
    setRatesLoading(true)
    try {
      const rates = {}
      const cryptoCodes = Object.keys(cryptoAddresses)

      for (const code of cryptoCodes) {
        try {
          const rate = await currencyAPI.getExchangeRate(code, 'PHP')
          if (rate) {
            rates[code] = rate
          }
        } catch (err) {
          console.warn(`Failed to fetch rate for ${code}:`, err)
        }
      }

      setExchangeRates(rates)
    } catch (err) {
      console.error('Error fetching exchange rates:', err)
    } finally {
      setRatesLoading(false)
    }
  }

  const handleSelectGuestProfile = (profile) => {
    setSelectedGuestProfile(profile)
    setGuestSearch('')
    setShowSearchResults(false)
  }

  const handleCreateReceiveLink = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!selectedWallet && !selectedGuestProfile) {
      setError('Please select a wallet or guest profile')
      return
    }

    setSubmitting(true)
    try {
      const linkId = `receive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const linkData = {
        id: linkId,
        user_id: userId || null,
        guest_user_id: selectedGuestProfile?.id || null,
        guest_name: selectedGuestProfile?.name || null,
        wallet_id: selectedWallet,
        amount: amount ? parseFloat(amount) : null,
        currency: selectedCurrency,
        method: selectedMethod,
        crypto_network: selectedCryptoNetwork || null,
        crypto_address: selectedDepositAddress?.address || null,
        status: 'active',
        created_at: new Date().toISOString()
      }

      // Create receive link record in database
      await receiveMoneyService.createReceiveLink(linkData)

      // If crypto deposit, pre-calculate PHP equivalent
      if (amount && selectedMethod === 'crypto' && exchangeRates[selectedCryptoNetwork]) {
        const phpAmount = parseFloat(amount) * exchangeRates[selectedCryptoNetwork]
        linkData.expected_php_amount = phpAmount
      }

      setReceiveLink(linkData)
      setSuccess('Receive link created! Share it with the sender.')

      setTimeout(() => {
        setAmount('')
        setSelectedWallet(null)
        setSelectedGuestProfile(null)
        setSelectedMethod(null)
        setReceiveLink(null)
        setSuccess('')
        setStep(1)
      }, 4000)
    } catch (err) {
      console.error('Error creating receive link:', err)
      setError('Failed to create receive link: ' + (err.message || 'Unknown error'))
    } finally {
      setSubmitting(false)
    }
  }

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyFeedback(label)
      setTimeout(() => setCopyFeedback(''), 2000)
    } catch (err) {
      setError('Could not copy to clipboard')
      setTimeout(() => setError(''), 3000)
    }
  }

  const selectedWalletData = wallets.find(w => w.id === selectedWallet)
  const availableCryptos = Object.entries(cryptoAddresses).map(([code, addresses]) => ({
    code,
    addresses
  }))
  const selectedCryptoAddresses = selectedCryptoNetwork ? cryptoAddresses[selectedCryptoNetwork] || [] : []

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="text-center text-slate-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <h2 className="text-3xl font-light text-slate-900 mb-6 tracking-tight">Receive Money</h2>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-xl p-8">
            {receiveLink ? (
              // Confirmation Screen
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-block w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                    <span className="text-3xl">OK</span>
                  </div>
                  <h3 className="text-2xl font-semibold text-slate-900 mb-2">Receive Link Created</h3>
                  <p className="text-slate-600">Share this with the sender</p>
                </div>

                {/* Link Details */}
                <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-slate-700">Link ID:</span>
                    <span className="font-mono text-sm text-slate-600 text-right break-all">{receiveLink.id}</span>
                  </div>
                  {receiveLink.guest_name && (
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium text-slate-700">Receiving As:</span>
                      <span className="text-slate-600">{receiveLink.guest_name}</span>
                    </div>
                  )}
                  {receiveLink.amount && (
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium text-slate-700">Amount:</span>
                      <span className="font-semibold text-slate-900">
                        {getCurrencySymbol(receiveLink.currency)}{formatNumber(receiveLink.amount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-slate-700">Method:</span>
                    <span className="text-slate-600">
                      {receiveLink.method === 'gcash' && 'GCash'}
                      {receiveLink.method === 'bank' && 'Bank Transfer'}
                      {receiveLink.method === 'crypto' && `${receiveLink.crypto_network}`}
                    </span>
                  </div>
                  {receiveLink.expected_php_amount && (
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium text-slate-700">Expected PHP:</span>
                      <span className="font-semibold text-emerald-600">₱{formatNumber(receiveLink.expected_php_amount)}</span>
                    </div>
                  )}
                </div>

                {/* Copy Link */}
                <button
                  onClick={() => copyToClipboard(`${window.location.origin}/checkout?link=${receiveLink.id}`, 'Link copied!')}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  {copyFeedback === 'Link copied!' ? '✓ Copied Payment Link' : 'Copy Payment Link'}
                </button>

                <button
                  onClick={() => setReceiveLink(null)}
                  className="w-full px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  Create Another Link
                </button>
              </div>
            ) : (
              // Form Steps
              <>
                {/* Step Indicator */}
                <div className="flex items-center space-x-4 mb-8">
                  {[1, 2, 3, 4].map(s => (
                    <div key={s} className="flex items-center flex-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                          s <= step ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {s}
                      </div>
                      {s < 4 && <div className={`flex-1 h-1 mx-2 ${s < step ? 'bg-blue-600' : 'bg-slate-200'}`}></div>}
                    </div>
                  ))}
                </div>

                <form onSubmit={handleCreateReceiveLink} className="space-y-6">
                  {/* Step 1: Select Wallet or Guest Profile */}
                  {step === 1 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-slate-900">Who is receiving funds?</h3>

                      {/* Toggle between My Wallets and Guest */}
                      <div className="flex gap-4 mb-6">
                        <button
                          type="button"
                          onClick={() => {
                            setIsGuest(false)
                            setSelectedGuestProfile(null)
                          }}
                          className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                            !isGuest
                              ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                              : 'border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          My Wallets
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsGuest(true)
                            setSelectedWallet(null)
                          }}
                          className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                            isGuest
                              ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                              : 'border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          Guest Profile
                        </button>
                      </div>

                      {/* Guest Profile Search */}
                      {isGuest && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Search User Profile</label>
                          <div className="relative">
                            <input
                              ref={searchInputRef}
                              type="text"
                              value={guestSearch}
                              onChange={e => setGuestSearch(e.target.value)}
                              onFocus={() => guestSearch.length > 0 && setShowSearchResults(true)}
                              placeholder="Search by name, email, or phone"
                              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                            />

                            {showSearchResults && guestSearchResults.length > 0 && (
                              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                                {guestSearchResults.map((profile, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleSelectGuestProfile(profile)}
                                    className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 transition-colors"
                                  >
                                    <div className="font-medium text-slate-900">{profile.name}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {profile.phone && `Phone: ${profile.phone}`}
                                      {profile.email && ` Email: ${profile.email}`}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {selectedGuestProfile && (
                            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium text-slate-900">{selectedGuestProfile.name}</p>
                                  {selectedGuestProfile.phone && (
                                    <p className="text-sm text-slate-600 mt-1">📱 {selectedGuestProfile.phone}</p>
                                  )}
                                  {selectedGuestProfile.email && (
                                    <p className="text-sm text-slate-600 mt-1">📧 {selectedGuestProfile.email}</p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedGuestProfile(null)}
                                  className="text-xs px-3 py-1 border border-slate-300 rounded hover:bg-slate-100"
                                >
                                  Change
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* My Wallets */}
                      {!isGuest && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-3">Select Wallet</label>
                          {wallets.length === 0 ? (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                              <p className="text-sm text-amber-800">
                                No wallets found.{' '}
                                <a href="/wallets" className="font-medium underline">
                                  Create a wallet
                                </a>{' '}
                                first.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {wallets.map(wallet => (
                                <button
                                  key={wallet.id}
                                  type="button"
                                  onClick={() => setSelectedWallet(wallet.id)}
                                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                                    selectedWallet === wallet.id
                                      ? 'border-blue-600 bg-blue-50'
                                      : 'border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="font-medium text-slate-900">{wallet.currency_code}</div>
                                  <div className="text-sm text-slate-600 mt-1">
                                    Balance: {getCurrencySymbol(wallet.currency_code)}{formatNumber(wallet.balance)}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        disabled={(!selectedWallet && !selectedGuestProfile) || loading}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  )}

                  {/* Step 2: Select Payment Method */}
                  {step === 2 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-slate-900">Select Payment Method</h3>

                      <div className="mb-6">
                        <FiatCryptoToggle
                          active={activeType}
                          onChange={setActiveType}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        {activeType === 'fiat' && availableMethods.fiat.map(method => (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => setSelectedMethod(method.id)}
                            className={`p-4 rounded-lg border-2 transition-all text-left ${
                              selectedMethod === method.id
                                ? 'border-blue-600 bg-blue-50'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="font-medium text-slate-900">
                              {method.name}
                            </div>
                            <div className="text-sm text-slate-600 mt-1">{method.description}</div>
                          </button>
                        ))}

                        {activeType === 'crypto' && availableMethods.crypto.map(method => (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => setSelectedMethod(method.id)}
                            className={`p-4 rounded-lg border-2 transition-all text-left ${
                              selectedMethod === method.id
                                ? 'border-blue-600 bg-blue-50'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="font-medium text-slate-900">
                              {method.name}
                            </div>
                            <div className="text-sm text-slate-600 mt-1">{method.description}</div>
                          </button>
                        ))}
                      </div>

                      <div className="flex space-x-4">
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={() => setStep(3)}
                          disabled={!selectedMethod}
                          className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Payment Details */}
                  {step === 3 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-slate-900">Payment Details</h3>

                      {/* Amount */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Amount (Optional - if specified)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                          />
                          <select
                            value={selectedCurrency}
                            onChange={e => setSelectedCurrency(e.target.value)}
                            className="px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                          >
                            <option value="PHP">PHP</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                          </select>
                        </div>
                      </div>

                      {/* Crypto Network Selection */}
                      {selectedMethod === 'crypto' && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-3">
                            Select Cryptocurrency
                          </label>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {availableCryptos.map(crypto => (
                              <button
                                key={crypto.code}
                                type="button"
                                onClick={() => {
                                  setSelectedCryptoNetwork(crypto.code)
                                  // Auto-select first address
                                  if (crypto.addresses.length > 0) {
                                    setSelectedDepositAddress(crypto.addresses[0])
                                  }
                                }}
                                className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                                  selectedCryptoNetwork === crypto.code
                                    ? 'border-blue-600 bg-blue-50'
                                    : 'border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <div className="font-medium text-slate-900">{crypto.code}</div>
                                <div className="text-xs text-slate-600 mt-1">
                                  {crypto.addresses.length} network{crypto.addresses.length !== 1 ? 's' : ''}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Crypto Address Selection */}
                      {selectedMethod === 'crypto' && selectedCryptoNetwork && selectedCryptoAddresses.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-3">
                            Select Receive Address
                          </label>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {selectedCryptoAddresses.map((addr, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedDepositAddress(addr)}
                                className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                                  selectedDepositAddress === addr
                                    ? 'border-blue-600 bg-blue-50'
                                    : 'border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <div className="text-xs font-medium text-slate-700 mb-1">{addr.network}</div>
                                <div className="text-xs font-mono text-slate-900 break-all">{addr.address}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex space-x-4">
                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={() => setStep(4)}
                          disabled={selectedMethod === 'crypto' && !selectedDepositAddress}
                          className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Review
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Confirmation */}
                  {step === 4 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-slate-900">Confirm Details</h3>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3 text-sm">
                        <p className="font-medium text-slate-900">Receive Details</p>

                        {selectedWalletData && (
                          <div className="flex justify-between">
                            <span className="text-slate-700">Receiving Wallet:</span>
                            <span className="font-medium text-slate-900">{selectedWalletData.currency_code}</span>
                          </div>
                        )}

                        {selectedGuestProfile && (
                          <div className="flex justify-between">
                            <span className="text-slate-700">Guest Profile:</span>
                            <span className="font-medium text-slate-900">{selectedGuestProfile.name}</span>
                          </div>
                        )}

                        <div className="flex justify-between">
                          <span className="text-slate-700">Method:</span>
                          <span className="font-medium text-slate-900">
                            {selectedMethod === 'gcash' && 'GCash'}
                            {selectedMethod === 'bank' && 'Bank Transfer'}
                            {selectedMethod === 'crypto' && selectedCryptoNetwork}
                          </span>
                        </div>

                        {amount && (
                          <div className="flex justify-between">
                            <span className="text-slate-700">Amount:</span>
                            <span className="font-medium text-slate-900">
                              {getCurrencySymbol(selectedCurrency)}{formatNumber(amount)}
                            </span>
                          </div>
                        )}

                        {selectedMethod === 'crypto' && amount && exchangeRates[selectedCryptoNetwork] && (
                          <div className="flex justify-between">
                            <span className="text-slate-700">Expected PHP:</span>
                            <span className="font-medium text-emerald-600">
                              ₱{formatNumber(parseFloat(amount) * exchangeRates[selectedCryptoNetwork])}
                            </span>
                          </div>
                        )}
                      </div>

                      {selectedMethod === 'crypto' && selectedDepositAddress && (
                        <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                          <p className="text-sm font-medium text-slate-700 mb-2">Send to this address:</p>
                          <div className="bg-white border border-slate-300 rounded p-3">
                            <div className="text-xs font-medium text-slate-700 mb-2">{selectedDepositAddress.network}</div>
                            <div className="text-xs font-mono text-slate-900 break-all mb-3">{selectedDepositAddress.address}</div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(selectedDepositAddress.address, 'Address copied!')}
                              className="w-full text-xs px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                            >
                              {copyFeedback === 'Address copied!' ? '✓ Copied' : 'Copy Address'}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex space-x-4">
                        <button
                          type="button"
                          onClick={() => setStep(3)}
                          className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={submitting || (selectedMethod === 'crypto' && !selectedDepositAddress)}
                          className="flex-1 bg-emerald-600 text-white py-3 rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submitting ? 'Creating...' : 'Create Receive Link'}
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              </>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* How It Works */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-medium text-slate-900">How It Works</h3>
            <ol className="space-y-3 text-sm text-slate-700">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold">
                  1
                </span>
                <span>Select receiving wallet or guest profile</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold">
                  2
                </span>
                <span>Choose a payment method</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold">
                  3
                </span>
                <span>Enter amount (optional) and select details</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold">
                  4
                </span>
                <span>Share the unique link with the sender</span>
              </li>
            </ol>
          </div>

          {/* Recent Deposits */}
          {deposits.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-medium text-slate-900">Recent Deposits</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {deposits.slice(0, 5).map(deposit => (
                  <div key={deposit.id} className="border-b border-slate-100 pb-3 last:border-b-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {getCurrencySymbol(deposit.currency_code)}{formatNumber(deposit.amount)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(deposit.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded ${
                          deposit.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : deposit.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {deposit.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Methods Info */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-medium text-slate-900">Accepted Methods</h3>
            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-lg">📱</span>
                <div>
                  <p className="font-medium text-slate-900">GCash</p>
                  <p className="text-xs text-slate-600">Mobile wallet</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="text-lg">🏦</span>
                <div>
                  <p className="font-medium text-slate-900">Bank Transfer</p>
                  <p className="text-xs text-slate-600">Direct bank deposit</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="text-lg">₿</span>
                <div>
                  <p className="font-medium text-slate-900">Crypto</p>
                  <p className="text-xs text-slate-600">50+ cryptocurrencies</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
