import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { currencyAPI } from '../lib/payments'
import { formatNumber, getCurrencySymbol } from '../lib/currency'
import { CRYPTOCURRENCY_DEPOSITS } from '../data/cryptoDeposits'
import FiatCryptoToggle from './FiatCryptoToggle'
import receiveMoneyService from '../lib/receiveMoneyService'

export default function ReceiveMoney({ userId, globalCurrency = 'PHP' }) {
  // State: User/Guest info
  const [isGuest, setIsGuest] = useState(!userId || userId.includes('guest'))
  const [guestEmail, setGuestEmail] = useState('')
  const [wallets, setWallets] = useState([])
  const [selectedWallet, setSelectedWallet] = useState(null)

  // State: Amount & currency
  const [amount, setAmount] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState(globalCurrency)
  const [step, setStep] = useState(1) // 1: select wallet, 2: select method, 3: details, 4: confirmation
  const [activeType, setActiveType] = useState('fiat') // 'fiat' or 'crypto'

  // State: Payment method selection
  const [selectedMethod, setSelectedMethod] = useState(null) // 'gcash', 'bank', 'crypto'
  const [selectedCryptoNetwork, setSelectedCryptoNetwork] = useState(null)

  // State: Exchange rates
  const [exchangeRates, setExchangeRates] = useState({})
  const [ratesLoading, setRatesLoading] = useState(false)

  // State: Crypto deposits
  const [cryptoAddresses, setCryptoAddresses] = useState({}) // { 'BTC': [...addresses] }
  const [selectedCryptoAddress, setSelectedCryptoAddress] = useState(null)

  // State: Processing
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [receiveLink, setReceiveLink] = useState(null)
  const [copyFeedback, setCopyFeedback] = useState('')

  // State: Deposit history
  const [deposits, setDeposits] = useState([])

  const FIAT_METHODS = {
    gcash: {
      id: 'gcash',
      name: 'GCash',
      icon: '📱',
      description: 'Mobile wallet payment'
    },
    bank: {
      id: 'bank',
      name: 'Bank Transfer',
      icon: '🏦',
      description: 'Direct bank transfer'
    }
  }

  const CRYPTO_METHODS = {
    crypto: {
      id: 'crypto',
      name: 'Cryptocurrency',
      icon: '₿',
      description: 'Bitcoin, Ethereum, and more'
    }
  }

  // Load initial data
  useEffect(() => {
    loadData()
  }, [userId])

  // Fetch exchange rates
  useEffect(() => {
    if (activeType === 'crypto') {
      fetchExchangeRates()
    }
  }, [activeType])

  const loadData = async () => {
    try {
      setLoading(true)
      if (userId && !userId.includes('guest')) {
        // Load user's wallets
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

        // Load recent deposits
        const { data: userDeposits } = await supabase
          .from('deposits')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10)

        if (userDeposits) {
          setDeposits(userDeposits)
        }
      }

      // Organize crypto addresses by currency
      const addressesByCode = {}
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
      setCryptoAddresses(addressesByCode)

      // Set first crypto option as default
      const firstCryptoCode = Object.keys(addressesByCode)[0]
      if (firstCryptoCode) {
        setSelectedCryptoNetwork(firstCryptoCode)
      }
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Failed to load data')
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

  const handleCreateReceiveLink = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!selectedWallet && !guestEmail) {
      setError('Please select a wallet or enter guest email')
      return
    }

    setSubmitting(true)
    try {
      const linkId = `receive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const linkData = {
        id: linkId,
        user_id: userId || null,
        guest_email: isGuest ? guestEmail : null,
        wallet_id: selectedWallet,
        amount: amount ? parseFloat(amount) : null,
        currency: selectedCurrency,
        method: selectedMethod,
        crypto_network: selectedCryptoNetwork || null,
        crypto_address: selectedCryptoAddress?.address || null,
        status: 'active',
        created_at: new Date().toISOString()
      }

      // Create receive link record in database
      await receiveMoneyService.createReceiveLink(linkData)

      // If amount specified and it's crypto, pre-calculate PHP equivalent
      if (amount && selectedMethod === 'crypto') {
        const phpAmount = await receiveMoneyService.convertCryptoToPhp(amount, selectedCryptoNetwork)
        linkData.expected_php_amount = phpAmount
      }

      setReceiveLink(linkData)
      setSuccess('Receive link created! Share it with the sender.')

      setTimeout(() => {
        setAmount('')
        setSelectedWallet(null)
        setGuestEmail('')
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
                    <span className="text-3xl">✓</span>
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
                  {/* Step 1: Select Wallet */}
                  {step === 1 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-slate-900">Select Receiving Wallet</h3>

                      {/* Guest or User Toggle */}
                      <div className="flex gap-4 mb-6">
                        <button
                          type="button"
                          onClick={() => {
                            setIsGuest(false)
                            setGuestEmail('')
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
                          onClick={() => setIsGuest(true)}
                          className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                            isGuest
                              ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                              : 'border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          Guest Checkout
                        </button>
                      </div>

                      {/* Guest Email */}
                      {isGuest && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                          <input
                            type="email"
                            value={guestEmail}
                            onChange={e => setGuestEmail(e.target.value)}
                            placeholder="Enter email to receive funds"
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                            required={isGuest}
                          />
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
                                <a href="/deposit" className="font-medium underline">
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
                                  <div className="text-xs text-slate-500 mt-2">
                                    ID: {wallet.id} {wallet.account_number && `• Account: ${wallet.account_number}`}
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
                        disabled={!selectedWallet && !guestEmail}
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
                        {activeType === 'fiat' && Object.values(FIAT_METHODS).map(method => (
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
                              {method.icon} {method.name}
                            </div>
                            <div className="text-sm text-slate-600 mt-1">{method.description}</div>
                          </button>
                        ))}

                        {activeType === 'crypto' && (
                          <button
                            type="button"
                            onClick={() => setSelectedMethod('crypto')}
                            className={`p-4 rounded-lg border-2 transition-all text-left ${
                              selectedMethod === 'crypto'
                                ? 'border-blue-600 bg-blue-50'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="font-medium text-slate-900">₿ Cryptocurrency</div>
                            <div className="text-sm text-slate-600 mt-1">Bitcoin, Ethereum, and more</div>
                          </button>
                        )}
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
                                onClick={() => setSelectedCryptoNetwork(crypto.code)}
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

                      {/* Summary */}
                      <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                        <p className="text-sm font-medium text-slate-700">Summary</p>
                        {selectedWalletData && (
                          <div className="text-sm text-slate-600">
                            Wallet: <span className="font-medium text-slate-900">{selectedWalletData.currency_code}</span>
                          </div>
                        )}
                        {guestEmail && (
                          <div className="text-sm text-slate-600">
                            Guest: <span className="font-medium text-slate-900">{guestEmail}</span>
                          </div>
                        )}
                        <div className="text-sm text-slate-600">
                          Method:{' '}
                          <span className="font-medium text-slate-900">
                            {selectedMethod === 'gcash' && 'GCash'}
                            {selectedMethod === 'bank' && 'Bank Transfer'}
                            {selectedMethod === 'crypto' && `${selectedCryptoNetwork}`}
                          </span>
                        </div>
                      </div>

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
                          className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                          Next
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
                            <span className="text-slate-700">Wallet:</span>
                            <span className="font-medium text-slate-900">{selectedWalletData.currency_code}</span>
                          </div>
                        )}
                        {guestEmail && (
                          <div className="flex justify-between">
                            <span className="text-slate-700">Guest Email:</span>
                            <span className="font-medium text-slate-900">{guestEmail}</span>
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
                      </div>

                      {selectedMethod === 'crypto' && selectedCryptoNetwork && selectedCryptoAddresses.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-slate-700 mb-3">Receive Address</p>
                          <div className="space-y-2">
                            {selectedCryptoAddresses.map((addr, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedCryptoAddress(addr)}
                                className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                                  selectedCryptoAddress === addr
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
                          onClick={() => setStep(3)}
                          className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={submitting || (selectedMethod === 'crypto' && !selectedCryptoAddress)}
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
          {/* Receive Instructions */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-medium text-slate-900">How It Works</h3>
            <ol className="space-y-3 text-sm text-slate-700">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold">
                  1
                </span>
                <span>Select the wallet to receive funds</span>
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
                <span>Share the unique link with the sender</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold">
                  4
                </span>
                <span>Funds are credited when payment is verified</span>
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
                          deposit.status === 'confirmed'
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
            <h3 className="text-lg font-medium text-slate-900">Payment Methods</h3>
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
