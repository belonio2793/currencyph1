import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { currencyAPI } from '../lib/payments'
import { formatNumber, getCurrencySymbol } from '../lib/currency'
import { CRYPTOCURRENCY_DEPOSITS } from '../data/cryptoDeposits'
import FiatCryptoToggle from './FiatCryptoToggle'
import receiveMoneyService from '../lib/receiveMoneyService'

export default function ReceiveMoney({ userId, globalCurrency = 'PHP' }) {
  // State: Recipient selection
  const [isRequestMode, setIsRequestMode] = useState(!userId || userId.includes('guest'))
  const [guestSearch, setGuestSearch] = useState('')
  const [guestSearchResults, setGuestSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [selectedGuestProfile, setSelectedGuestProfile] = useState(null)

  const [wallets, setWallets] = useState([])
  const [selectedWallet, setSelectedWallet] = useState(null)
  
  // State: User profile
  const [userProfile, setUserProfile] = useState(null)

  // State: Amount & Currency with conversion
  const [amount, setAmount] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState(globalCurrency)
  const [convertedAmount, setConvertedAmount] = useState(null)
  const [conversionRate, setConversionRate] = useState(null)
  const [conversionLoading, setConversionLoading] = useState(false)

  // State: Flow control
  const [step, setStep] = useState(1) // 1: recipient+amount, 2: method, 3: finalization
  const [activeType, setActiveType] = useState('fiat')

  // State: Payment method
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [selectedCryptoNetwork, setSelectedCryptoNetwork] = useState(null)
  const [selectedDepositAddress, setSelectedDepositAddress] = useState(null)

  // State: Exchange rates and crypto
  const [exchangeRates, setExchangeRates] = useState({})
  const [ratesLoading, setRatesLoading] = useState(false)
  const [cryptoAddresses, setCryptoAddresses] = useState({})
  const [availableMethods, setAvailableMethods] = useState({ fiat: [], crypto: [] })

  // State: Processing
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [transferRecord, setTransferRecord] = useState(null)
  const [copyFeedback, setCopyFeedback] = useState('')
  const [deposits, setDeposits] = useState([])
  const [sendChatMessage, setSendChatMessage] = useState(true) // Optional setting for step 3
  const [recipientOnlineStatus, setRecipientOnlineStatus] = useState(null)

  const searchInputRef = useRef(null)

  // Load initial data
  useEffect(() => {
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

    loadDepositMethods()
    loadData()
  }, [userId])

  // Search profiles
  useEffect(() => {
    if (guestSearch.trim().length >= 2) {
      searchUserProfiles()
    } else {
      setGuestSearchResults([])
      setShowSearchResults(false)
    }
  }, [guestSearch])

  // Fetch conversion rate when amount or currency changes
  useEffect(() => {
    if (amount && selectedWallet) {
      const selectedWalletData = wallets.find(w => w.id === selectedWallet)
      if (selectedWalletData && selectedWalletData.currency_code !== selectedCurrency) {
        fetchConversionRate(selectedCurrency, selectedWalletData.currency_code)
      } else if (selectedWalletData) {
        setConvertedAmount(parseFloat(amount))
        setConversionRate(1)
      }
    }
  }, [amount, selectedCurrency, selectedWallet])

  const fetchConversionRate = async (from, to) => {
    setConversionLoading(true)
    try {
      const rate = await currencyAPI.getExchangeRate(from, to)
      if (rate) {
        setConversionRate(rate)
        if (amount) {
          setConvertedAmount(parseFloat(amount) * rate)
        }
      }
    } catch (err) {
      console.warn('Error fetching conversion rate:', err)
    } finally {
      setConversionLoading(false)
    }
  }

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
      const fiat = [
        { id: 'gcash', name: 'GCash', description: 'Mobile wallet' },
        { id: 'bank', name: 'Bank Transfer', description: 'Direct bank deposit' }
      ]
      const crypto = [
        { id: 'crypto', name: 'Cryptocurrency', description: '50+ cryptocurrencies' }
      ]

      setAvailableMethods({ fiat, crypto })
    } catch (err) {
      console.warn('Error loading deposit methods:', err)
      setAvailableMethods({ fiat: [{ id: 'gcash', name: 'GCash', description: 'Mobile wallet' }], crypto: [] })
    }
  }

  const loadUserProfile = async () => {
    try {
      if (!userId || userId.includes('guest')) return

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (!error && profile) {
        setUserProfile(profile)
      }
    } catch (err) {
      console.warn('Error loading user profile:', err)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

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

        await loadUserProfile()

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

  const handleSelectGuestProfile = (profile) => {
    setSelectedGuestProfile(profile)
    setGuestSearch('')
    setShowSearchResults(false)
    // Check if recipient is online
    checkRecipientStatus(profile.id)
  }

  const checkRecipientStatus = async (recipientUserId) => {
    try {
      const { data: presence } = await supabase
        .from('presence')
        .select('is_online')
        .eq('user_id', recipientUserId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (presence) {
        setRecipientOnlineStatus(presence.is_online)
      }
    } catch (err) {
      console.warn('Could not check recipient status:', err)
      setRecipientOnlineStatus(null)
    }
  }

  const handleCreateTransfer = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!selectedWallet && !selectedGuestProfile) {
      setError('Please select a wallet or profile')
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    setSubmitting(true)
    try {
      const selectedWalletData = wallets.find(w => w.id === selectedWallet)
      const finalAmount = convertedAmount || parseFloat(amount)
      const finalCurrency = selectedWalletData?.currency_code || selectedCurrency

      // Create transfer record
      const transferData = {
        user_id: userId || null,
        guest_user_id: selectedGuestProfile?.id || null,
        guest_name: selectedGuestProfile?.name || null,
        wallet_id: selectedWallet,
        amount: finalAmount,
        currency: finalCurrency,
        original_amount: parseFloat(amount),
        original_currency: selectedCurrency,
        conversion_rate: conversionRate,
        method: selectedMethod,
        crypto_network: selectedCryptoNetwork || null,
        crypto_address: selectedDepositAddress?.address || null,
        status: 'pending',
        created_at: new Date().toISOString()
      }

      // Insert into public.transfers
      const { data: insertedTransfer, error: transferError } = await supabase
        .from('transfers')
        .insert([transferData])
        .select()

      if (transferError) {
        throw new Error(transferError.message || 'Failed to create transfer')
      }

      const transfer = insertedTransfer?.[0]
      setTransferRecord(transfer)

      // Send chat message to the other user (if request mode AND user enabled it)
      if (selectedGuestProfile && sendChatMessage) {
        try {
          await sendPaymentRequestMessage(selectedGuestProfile, transfer, finalAmount, finalCurrency)
        } catch (chatErr) {
          console.warn('Could not send chat message:', chatErr)
        }
      }

      setSuccess('Transfer request created!')
    } catch (err) {
      console.error('Error creating transfer:', err)
      setError('Failed to create transfer: ' + (err.message || 'Unknown error'))
    } finally {
      setSubmitting(false)
    }
  }

  const sendPaymentRequestMessage = async (recipient, transfer, amount, currency) => {
    try {
      if (!userId) {
        console.warn('Cannot send message - no authenticated user')
        return
      }

      // Import conversations helper
      const { createConversation, addParticipantToConversation } = await import('../lib/conversations')

      const paymentLink = `${window.location.origin}/payment/${transfer.id}`
      const messageContent = `Payment Request: ${getCurrencySymbol(currency)}${formatNumber(amount)} from ${userProfile?.full_name || userProfile?.email || 'User'}. View and confirm: ${paymentLink}`

      try {
        // Create conversation with recipient
        const conversation = await createConversation(
          userId,
          `Payment Request: ${getCurrencySymbol(currency)}${formatNumber(amount)}`,
          [recipient.id]
        )

        // Send payment request message
        const { error: messageError } = await supabase
          .from('messages')
          .insert([
            {
              conversation_id: conversation.id,
              sender_id: userId,
              content: messageContent,
              message_type: 'payment_request',
              metadata: {
                payment_request: {
                  transfer_id: transfer.id,
                  amount: amount,
                  currency: currency,
                  from_user_id: userId,
                  to_user_id: recipient.id,
                  payment_link: paymentLink,
                  created_at: new Date().toISOString()
                }
              }
            }
          ])

        if (messageError) {
          console.warn('Could not send message:', messageError)
        } else {
          console.log('Payment request message sent successfully')
        }
      } catch (convErr) {
        console.warn('Could not create conversation:', convErr)
      }
    } catch (err) {
      console.warn('Error sending payment request message:', err)
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

  const checkoutLink = transferRecord ? `${window.location.origin}/checkout?transferId=${transferRecord.id}` : null

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
            {transferRecord ? (
              // Success Screen
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-block w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                    <span className="text-3xl font-bold text-emerald-700">✓</span>
                  </div>
                  <h3 className="text-2xl font-semibold text-slate-900 mb-2">Payment Request Sent</h3>
                  <p className="text-slate-600">Shared via chat message and payment link</p>
                </div>

                {/* Transfer Details */}
                <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                  {transferRecord.id && (
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium text-slate-700">Request ID:</span>
                      <span className="font-mono text-sm text-slate-600 text-right break-all">{transferRecord.id}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-slate-700">Amount:</span>
                    <span className="font-semibold text-slate-900">
                      {getCurrencySymbol(transferRecord.currency)}{formatNumber(transferRecord.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-slate-700">Method:</span>
                    <span className="text-slate-600">
                      {transferRecord.method === 'gcash' && 'GCash'}
                      {transferRecord.method === 'bank' && 'Bank Transfer'}
                      {transferRecord.method === 'crypto' && transferRecord.crypto_network}
                    </span>
                  </div>
                </div>

                {/* Payment Link */}
                {checkoutLink && (
                  <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-medium text-blue-700">Payment Link</p>
                    <div className="bg-white border border-slate-300 rounded p-3">
                      <div className="text-xs font-mono text-slate-900 break-all mb-3">{checkoutLink}</div>
                      <button
                        onClick={() => copyToClipboard(checkoutLink, 'Link copied!')}
                        className="w-full text-xs px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        {copyFeedback === 'Link copied!' ? 'Copied' : 'Copy Payment Link'}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    setTransferRecord(null)
                    setAmount('')
                    setSelectedWallet(null)
                    setSelectedGuestProfile(null)
                    setSelectedMethod(null)
                    setStep(1)
                  }}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Create Another Request
                </button>
              </div>
            ) : (
              // Form Steps
              <>
                {/* Step Indicator */}
                <div className="flex items-center space-x-4 mb-8">
                  {[1, 2, 3].map(s => (
                    <div key={s} className="flex items-center flex-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                          s <= step ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {s}
                      </div>
                      {s < 3 && <div className={`flex-1 h-1 mx-2 ${s < step ? 'bg-blue-600' : 'bg-slate-200'}`}></div>}
                    </div>
                  ))}
                </div>

                <form onSubmit={handleCreateTransfer} className="space-y-6">
                  {/* Step 1: Select Recipient & Enter Amount */}
                  {step === 1 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-slate-900">Who is receiving funds and how much?</h3>

                      {/* Toggle */}
                      <div className="flex gap-4 mb-6">
                        <button
                          type="button"
                          onClick={() => {
                            setIsRequestMode(false)
                            setSelectedGuestProfile(null)
                          }}
                          className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                            !isRequestMode
                              ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                              : 'border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          My Wallets
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsRequestMode(true)
                            setSelectedWallet(null)
                          }}
                          className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                            isRequestMode
                              ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                              : 'border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          Request Money
                        </button>
                      </div>

                      {/* Recipient Selection */}
                      {!isRequestMode && (
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
                                  <div className="font-medium text-slate-900 mb-2">{wallet.currency_code}</div>
                                  <div className="text-sm text-slate-600 mb-3">
                                    Balance: {getCurrencySymbol(wallet.currency_code)}{formatNumber(wallet.balance)}
                                  </div>
                                  <div className="bg-white/50 rounded p-2 mb-2 border border-slate-200">
                                    <p className="text-xs text-slate-600 font-semibold mb-1">Wallet ID</p>
                                    <p className="text-xs font-mono text-slate-900 break-all">{wallet.id}</p>
                                  </div>
                                  {wallet.account_number && (
                                    <div className="text-xs text-slate-600">
                                      Account: {wallet.account_number}
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {isRequestMode && (
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
                                      {profile.email}
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
                                  <p className="text-sm text-slate-600 mt-1">{selectedGuestProfile.email}</p>
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

                      {/* Amount Input with Conversion */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Amount to Receive</label>
                        <div className="flex gap-2 mb-3">
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
                            <option value="GBP">GBP</option>
                          </select>
                        </div>

                        {/* Conversion Display */}
                        {selectedWalletData && selectedCurrency !== selectedWalletData.currency_code && amount && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-xs text-blue-700 font-medium mb-2">Conversion</p>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-700">
                                {amount} {selectedCurrency} equals
                              </span>
                              <span className="text-lg font-semibold text-blue-600">
                                {conversionLoading ? 'Loading...' : formatNumber(convertedAmount)} {selectedWalletData.currency_code}
                              </span>
                            </div>
                            {conversionRate && (
                              <p className="text-xs text-slate-600 mt-2">
                                Rate: 1 {selectedCurrency} = {formatNumber(conversionRate)} {selectedWalletData.currency_code}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        disabled={(!selectedWallet && !selectedGuestProfile) || !amount || loading}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next: Select Payment Method
                      </button>
                    </div>
                  )}

                  {/* Step 2: Payment Method */}
                  {step === 2 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-slate-900">How will the payment be sent?</h3>

                      <div className="mb-6">
                        <FiatCryptoToggle active={activeType} onChange={setActiveType} />
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
                            <div className="font-medium text-slate-900">{method.name}</div>
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
                            <div className="font-medium text-slate-900">{method.name}</div>
                            <div className="text-sm text-slate-600 mt-1">{method.description}</div>
                          </button>
                        ))}
                      </div>

                      {/* Crypto Selection */}
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
                          onClick={() => setStep(1)}
                          className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={() => setStep(3)}
                          disabled={!selectedMethod || (selectedMethod === 'crypto' && !selectedDepositAddress)}
                          className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next: Review & Finalize
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Finalization with Profile & Payment Link */}
                  {step === 3 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-slate-900">Finalize Request</h3>

                      {/* Your Profile */}
                      {userProfile && (
                        <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-300 rounded-lg p-6 space-y-3">
                          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Your Profile</p>
                          <div>
                            <p className="text-2xl font-light text-slate-900 mb-2">{userProfile.full_name || userProfile.email || 'User'}</p>
                            {userProfile.email && <p className="text-sm text-slate-600">Email: {userProfile.email}</p>}
                            {userProfile.phone && <p className="text-sm text-slate-600">Phone: {userProfile.phone}</p>}
                          </div>
                        </div>
                      )}

                      {/* Summary */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                        <p className="text-sm font-medium text-slate-900">Payment Details</p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-700">From:</span>
                            <span className="font-medium text-slate-900">{userProfile?.full_name || 'You'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-700">Amount:</span>
                            <span className="font-medium text-slate-900">
                              {getCurrencySymbol(selectedWalletData?.currency_code || selectedCurrency)}{formatNumber(convertedAmount || amount)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-700">Method:</span>
                            <span className="font-medium text-slate-900">
                              {selectedMethod === 'gcash' && 'GCash'}
                              {selectedMethod === 'bank' && 'Bank Transfer'}
                              {selectedMethod === 'crypto' && selectedCryptoNetwork}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Crypto Address Display */}
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
                              {copyFeedback === 'Address copied!' ? 'Copied' : 'Copy Address'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Optional Chat Message Setting */}
                      {selectedGuestProfile && (
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-4 space-y-3">
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={sendChatMessage}
                              onChange={(e) => setSendChatMessage(e.target.checked)}
                              className="w-5 h-5 mt-0.5 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-900">Send payment request via chat</p>
                              <p className="text-xs text-slate-600 mt-1">
                                Notify {selectedGuestProfile.full_name || selectedGuestProfile.email} about this payment request
                                {recipientOnlineStatus ? ' (Currently online)' : recipientOnlineStatus === false ? ' (Offline)' : ''}
                              </p>
                            </div>
                          </label>
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
                          type="submit"
                          disabled={submitting}
                          className="flex-1 bg-emerald-600 text-white py-3 rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {submitting ? 'Creating...' : (
                            <>
                              Create Payment Request
                              {selectedGuestProfile && sendChatMessage && ' + Send Chat'}
                            </>
                          )}
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
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold">1</span>
                <span>Select recipient and enter amount with currency</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold">2</span>
                <span>Choose payment method (GCash, Bank, Crypto)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold">3</span>
                <span>Review details and send payment request</span>
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

          {/* Accepted Methods */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-medium text-slate-900">Accepted Methods</h3>
            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-700">G</div>
                <div>
                  <p className="font-medium text-slate-900">GCash</p>
                  <p className="text-xs text-slate-600">Mobile wallet</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-sm font-semibold text-green-700">B</div>
                <div>
                  <p className="font-medium text-slate-900">Bank Transfer</p>
                  <p className="text-xs text-slate-600">Direct bank deposit</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-shrink-0 w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-sm font-semibold text-orange-700">C</div>
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
