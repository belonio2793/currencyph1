import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { currencyAPI } from '../lib/payments'
import { currencySymbols, formatCurrency, getCurrencySymbol, formatNumber, isFiatCurrency, isCryptoCurrency } from '../lib/currency'

export default function SendMoney({ userId }) {
  const [wallets, setWallets] = useState([])
  const [beneficiaries, setBeneficiaries] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSender, setSelectedSender] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [selectedRecipient, setSelectedRecipient] = useState(null)
  const [recipientWallets, setRecipientWallets] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [recipientCurrency, setRecipientCurrency] = useState('')
  const [amount, setAmount] = useState('')
  const [exchangeRate, setExchangeRate] = useState(1)
  const [receiverAmount, setReceiverAmount] = useState('0')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sending, setSending] = useState(false)
  const [step, setStep] = useState(1)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [loadingRecipientWallets, setLoadingRecipientWallets] = useState(false)

  useEffect(() => {
    loadData()
  }, [userId])

  const loadData = async () => {
    try {
      // Skip for guest-local or invalid user IDs
      if (!userId || userId.includes('guest-local') || userId === 'null' || userId === 'undefined') {
        setWallets([])
        setBeneficiaries([])
        setLoading(false)
        return
      }
      let walletsData = []
      let beneficiariesData = []

      try {
        walletsData = await currencyAPI.getWallets(userId)
      } catch (err) {
        console.debug('Failed to load wallets:', err)
        walletsData = []
      }

      try {
        beneficiariesData = await currencyAPI.getBeneficiaries(userId)
      } catch (err) {
        console.debug('Failed to load beneficiaries:', err)
        beneficiariesData = []
      }

      setWallets(walletsData)
      setBeneficiaries(beneficiariesData)
      if (walletsData.length > 0) {
        // Prioritize PHP wallet as default
        const phpWallet = walletsData.find(w => w.currency_code === 'PHP')
        const defaultCurrency = phpWallet ? 'PHP' : walletsData[0].currency_code
        setSelectedSender(defaultCurrency)
        setRecipientCurrency(defaultCurrency)
      }
    } catch (err) {
      setError('Failed to load data')
      setWallets([])
      setBeneficiaries([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (amount && selectedSender) {
      calculateExchangeRate()
    }
  }, [amount, selectedSender, recipientCurrency])

  const calculateExchangeRate = async () => {
    try {
      const rate = await currencyAPI.getExchangeRate(selectedSender, recipientCurrency)
      if (rate) {
        setExchangeRate(rate)
        setReceiverAmount(parseFloat(amount) * rate)
      }
    } catch (err) {
      console.warn('Could not fetch exchange rate:', err)
    }
  }

  const getWalletsByType = () => {
    const fiatWallets = wallets.filter(w => isFiatCurrency(w.currency_code))
    const cryptoWallets = wallets.filter(w => isCryptoCurrency(w.currency_code))
    return { fiatWallets, cryptoWallets }
  }

  const getWalletByCurrency = (code) => {
    return wallets.find(w => w.currency_code === code)
  }

  const fetchRecipientWallets = async (recipientUserId) => {
    if (!recipientUserId) return
    setLoadingRecipientWallets(true)
    try {
      const walletsData = await currencyAPI.getWallets(recipientUserId)
      setRecipientWallets(walletsData)
      // Default to PHP wallet if available
      const phpWallet = walletsData.find(w => w.currency_code === 'PHP')
      setRecipientCurrency(phpWallet ? 'PHP' : (walletsData[0]?.currency_code || ''))
    } catch (err) {
      console.warn('Failed to load recipient wallets:', err)
      setRecipientWallets([])
    } finally {
      setLoadingRecipientWallets(false)
    }
  }

  useEffect(() => {
    if (!showSearchDropdown) return
    const q = searchQuery.trim()
    if (q.length < 2) {
      setSearchResults([])
      return
    }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const results = await currencyAPI.searchUsers(q)
        if (!cancelled) setSearchResults(results)
      } catch (err) {
        console.error('Error searching users:', err)
        if (!cancelled) setError('Failed to search users')
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [searchQuery, showSearchDropdown])

  const handleSelectRecipient = async (user) => {
    setSelectedRecipient(user)
    setRecipientEmail(user.email)
    setSearchQuery('')
    setSearchResults([])
    setShowSearchDropdown(false)
    await fetchRecipientWallets(user.id)
  }

  const handleAddBeneficiary = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!selectedRecipient) {
      setError('Please select a recipient from the search results')
      return
    }

    try {
      const result = await currencyAPI.addBeneficiary(userId, {
        recipient_id: selectedRecipient.id,
        recipient_email: selectedRecipient.email,
        recipient_name: selectedRecipient.full_name || selectedRecipient.email.split('@')[0],
        recipient_phone: selectedRecipient.phone_number || null,
        country_code: selectedRecipient.country_code || 'PH',
        relationship: 'Other',
        is_favorite: false
      })

      if (result) {
        setSuccess('Recipient saved successfully!')
        setTimeout(() => {
          setSuccess('')
          loadData()
        }, 2000)
      }
    } catch (err) {
      setError(err.message || 'Failed to save recipient')
      console.error('Add beneficiary error:', err)
    }
  }

  const handleSendMoney = async (e) => {
    e.preventDefault()
    setError('')
    setSending(true)

    try {
      if (!selectedSender || !selectedRecipient || !amount) {
        throw new Error('Please fill in all fields')
      }

      await currencyAPI.sendMoney(
        userId,
        selectedRecipient.email,
        selectedSender,
        recipientCurrency,
        parseFloat(amount),
        exchangeRate
      )

      setSuccess('Money sent successfully!')
      setAmount('')
      setReceiverAmount('0')
      setSelectedRecipient(null)
      setRecipientEmail('')
      setSearchQuery('')
      setStep(1)
      setTimeout(() => {
        setSuccess('')
        loadData()
      }, 2000)
    } catch (err) {
      setError(err.message || 'Failed to send money')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="text-center text-slate-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <h2 className="text-3xl font-light text-slate-900 mb-6 tracking-tight">Send Money</h2>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Send Form */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <form onSubmit={handleSendMoney} className="space-y-6">
              {/* Step Indicator */}
              <div className="flex items-center space-x-4">
                { /* labels for steps */ }
                {(() => {
                  const stepLabels = ['Sender Account', 'Recipient', 'Amount']
                  return stepLabels.map((label, idx) => {
                    const s = idx + 1
                    return (
                      <div key={s} className="flex-1">
                        <div className="flex items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                            s <= step ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {s}
                          </div>
                          {s < stepLabels.length && <div className={`flex-1 h-1 mx-2 ${s < step ? 'bg-blue-600' : 'bg-slate-200'}`}></div>}
                        </div>
                        <div className="mt-2 text-xs text-center text-slate-600">{label}</div>
                      </div>
                    )
                  })
                })()}
              </div>

              {step === 1 && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-slate-900">Select Sender Account</h3>
                  {wallets.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <p className="text-sm text-amber-800">
                        You don't have any wallets yet. <a href="#" onClick={e => {e.preventDefault(); window.location.href = '/deposit'}} className="font-medium underline">Create a wallet</a> to send money.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-3">Select Your Wallet</label>
                        <select
                          value={selectedSender}
                          onChange={(e) => setSelectedSender(e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white"
                        >
                          <option value="">Choose a wallet...</option>

                          {/* Fiat Currencies Group */}
                          {(() => {
                            const { fiatWallets } = getWalletsByType()
                            return fiatWallets.length > 0 ? (
                              <optgroup label="FIAT CURRENCY">
                                {fiatWallets.map(wallet => (
                                  <option key={wallet.id} value={wallet.currency_code}>
                                    {wallet.currency_code} ({getCurrencySymbol(wallet.currency_code)}) - Balance: {formatNumber(wallet.balance || 0)}
                                  </option>
                                ))}
                              </optgroup>
                            ) : null
                          })()}

                          {/* Cryptocurrency Group */}
                          {(() => {
                            const { cryptoWallets } = getWalletsByType()
                            return cryptoWallets.length > 0 ? (
                              <optgroup label="CRYPTOCURRENCY">
                                {cryptoWallets.map(wallet => (
                                  <option key={wallet.id} value={wallet.currency_code}>
                                    {wallet.currency_code} - Balance: {formatNumber(wallet.balance || 0)}
                                  </option>
                                ))}
                              </optgroup>
                            ) : null
                          })()}
                        </select>
                      </div>

                      {/* Selected Account Details */}
                      {selectedSender && (() => {
                        const wallet = getWalletByCurrency(selectedSender)
                        return wallet ? (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-slate-900 mb-3">Selected Account Details</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-slate-600">Currency</span>
                                <span className="font-medium text-slate-900">{wallet.currency_code} ({getCurrencySymbol(wallet.currency_code)})</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600">Current Balance</span>
                                <span className="font-medium font-mono text-slate-900">{formatNumber(wallet.balance || 0)}</span>
                              </div>
                              <div className="pt-2 border-t border-blue-200">
                                <p className="text-xs text-blue-700 font-medium mb-1">Wallet ID</p>
                                <p className="text-xs font-mono text-slate-900 break-all bg-white p-2 rounded border border-blue-200">{wallet.id}</p>
                              </div>
                              <div className="text-xs text-slate-500 space-y-1 pt-2">
                                <div>Account: {wallet.account_number || 'N/A'}</div>
                                <div>Created: {new Date(wallet.created_at).toLocaleDateString()}</div>
                              </div>
                            </div>
                          </div>
                        ) : null
                      })()}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={wallets.length === 0 || !selectedSender}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-slate-900">Select Recipient</h3>

                  {/* Recipient Search */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Search Recipient</label>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => {
                        setSearchQuery(e.target.value)
                        setShowSearchDropdown(true)
                      }}
                      onFocus={() => setShowSearchDropdown(true)}
                      placeholder="Search by email or name..."
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />

                    {/* Search Results Dropdown */}
                    {showSearchDropdown && searchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                        {searchResults.map(user => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => handleSelectRecipient(user)}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 transition-colors"
                          >
                            <p className="font-medium text-slate-900">{user.full_name || user.email.split('@')[0]}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </button>
                        ))}
                      </div>
                    )}

                    {showSearchDropdown && searching && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-50 p-4 text-center text-slate-500">
                        Searching...
                      </div>
                    )}

                    {showSearchDropdown && searchQuery && searchResults.length === 0 && !searching && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-50 p-4 text-center text-slate-500 text-sm">
                        No users found
                      </div>
                    )}
                  </div>

                  {/* Selected Recipient Display */}
                  {selectedRecipient && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm font-medium text-slate-700 mb-3">Recipient Profile (Verification)</p>
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold overflow-hidden">
                          {selectedRecipient.profile_picture_url ? (
                            <img src={selectedRecipient.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <span>{(selectedRecipient.full_name || selectedRecipient.email)?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex-1 space-y-1 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">Name</span>
                            <span className="font-medium text-slate-900">{selectedRecipient.full_name || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">Email</span>
                            <span className="font-medium text-slate-900">{selectedRecipient.email}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">Phone</span>
                            <span className="font-medium text-slate-900">{selectedRecipient.phone_number || '—'}</span>
                          </div>
                          {selectedRecipient.country_code && (
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600">Country</span>
                              <span className="font-medium text-slate-900">{selectedRecipient.country_code}</span>
                            </div>
                          )}
                          {selectedRecipient.created_at && (
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600">Member Since</span>
                              <span className="font-medium text-slate-900">{new Date(selectedRecipient.created_at).toLocaleDateString()}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">Verification</span>
                            <span className={`text-xs font-medium px-2 py-1 rounded ${selectedRecipient.phone_number ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {selectedRecipient.phone_number ? 'Verified (Phone on file)' : 'Unverified'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRecipient(null)
                          setRecipientEmail('')
                          setSearchQuery('')
                        }}
                        className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Change Recipient
                      </button>
                    </div>
                  )}

                  {/* Recipient Wallets */}
                  <div className="space-y-6">
                    <h4 className="text-lg font-medium text-slate-900">Recipient's Wallets</h4>
                    {loadingRecipientWallets ? (
                      <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 text-center text-slate-600">
                        Loading recipient wallets...
                      </div>
                    ) : recipientWallets.length === 0 ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-800">
                          This recipient doesn't have any wallets yet.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-3">Select Recipient's Wallet</label>
                          <select
                            value={recipientCurrency}
                            onChange={(e) => setRecipientCurrency(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white"
                          >
                            <option value="">Choose wallet...</option>
                            {recipientWallets.map(wallet => (
                              <option key={wallet.id} value={wallet.currency_code}>
                                {wallet.currency_code} ({getCurrencySymbol(wallet.currency_code)})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Selected Wallet Details */}
                        {recipientCurrency && (() => {
                          const wallet = recipientWallets.find(w => w.currency_code === recipientCurrency)
                          return wallet ? (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                              <h5 className="text-sm font-semibold text-slate-900 mb-3">Recipient Wallet Details</h5>
                              <div className="space-y-3 text-sm">
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-600">Currency</span>
                                  <span className="font-semibold text-emerald-700">{wallet.currency_code} ({getCurrencySymbol(wallet.currency_code)})</span>
                                </div>
                                <div className="pt-2 border-t border-emerald-200">
                                  <p className="text-xs text-emerald-700 font-medium mb-2">Wallet ID</p>
                                  <p className="text-xs font-mono text-slate-900 break-all bg-white p-2 rounded border border-emerald-200">{wallet.id}</p>
                                </div>
                                {wallet.account_number && (
                                  <div>
                                    <p className="text-xs text-slate-600 font-medium mb-1">Account Number</p>
                                    <p className="text-sm font-mono text-slate-900">{wallet.account_number}</p>
                                  </div>
                                )}
                                <div className="text-xs text-emerald-700 pt-2">
                                  ✓ Funds will be sent to this wallet
                                </div>
                              </div>
                            </div>
                          ) : null
                        })()}
                      </div>
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
                      disabled={!selectedRecipient}
                      className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-slate-900">Review Transaction</h3>

                  {/* Amount Input Section */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      Enter Amount to Send ({selectedSender})
                    </label>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-2xl font-light text-slate-900">{getCurrencySymbol(selectedSender)}</span>
                      <input
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-3xl font-light"
                      />
                    </div>
                  </div>

                  {/* Transaction Details Summary */}
                  <div className="border-t border-slate-200 pt-6">
                    <h4 className="text-sm font-semibold text-slate-900 mb-4">Transaction Details</h4>

                    {/* From Section */}
                    <div className="mb-6 pb-6 border-b border-slate-200">
                      <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-3">From</p>
                      {(() => {
                        const senderWallet = getWalletByCurrency(selectedSender)
                        return senderWallet ? (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between items-center">
                                <span className="text-slate-600">Wallet</span>
                                <span className="font-medium text-slate-900">{senderWallet.currency_code}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-600">Available Balance</span>
                                <span className="font-medium font-mono text-slate-900">{getCurrencySymbol(selectedSender)}{formatNumber(senderWallet.balance || 0)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-600">Wallet ID</span>
                                <span className="text-xs font-mono text-slate-500">{senderWallet.id.substring(0, 16)}...</span>
                              </div>
                            </div>
                          </div>
                        ) : null
                      })()}
                    </div>

                    {/* To Section */}
                    <div className="mb-6 pb-6 border-b border-slate-200">
                      <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-3">To</p>
                      {selectedRecipient && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="shrink-0 w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-semibold overflow-hidden">
                              {selectedRecipient.profile_picture_url ? (
                                <img src={selectedRecipient.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
                              ) : (
                                <span>{(selectedRecipient.full_name || selectedRecipient.email)?.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-slate-900">{selectedRecipient.full_name || selectedRecipient.email}</p>
                              <p className="text-xs text-slate-500">{selectedRecipient.email}</p>
                            </div>
                          </div>

                          <div className="space-y-3 text-sm border-t border-emerald-200 pt-3">
                            {/* Contact Information */}
                            <div className="flex justify-between items-start">
                              <span className="text-slate-600">Email</span>
                              <span className="text-right font-mono text-xs text-slate-900">{selectedRecipient.email}</span>
                            </div>

                            {selectedRecipient.phone_number && (
                              <div className="flex justify-between items-start">
                                <span className="text-slate-600">Phone</span>
                                <span className="font-medium text-slate-900">{selectedRecipient.phone_number}</span>
                              </div>
                            )}

                            {/* Account Details */}
                            <div className="flex justify-between items-start">
                              <span className="text-slate-600">Receive In</span>
                              <span className="font-semibold text-emerald-700">{recipientCurrency} ({getCurrencySymbol(recipientCurrency)})</span>
                            </div>

                            {/* Recipient Wallet Details */}
                            {(() => {
                              const recipientWallet = recipientWallets.find(w => w.currency_code === recipientCurrency)
                              return recipientWallet ? (
                                <>
                                  <div className="pt-2 border-t border-emerald-200">
                                    <p className="text-xs text-emerald-700 font-medium mb-1">Wallet ID</p>
                                    <p className="text-xs font-mono text-slate-900 break-all">{recipientWallet.id}</p>
                                  </div>
                                  {recipientWallet.account_number && (
                                    <div>
                                      <p className="text-xs text-slate-600 font-medium mb-1">Account Number</p>
                                      <p className="text-xs font-mono text-slate-900">{recipientWallet.account_number}</p>
                                    </div>
                                  )}
                                </>
                              ) : null
                            })()}

                            {selectedRecipient.country_code && (
                              <div className="flex justify-between items-start">
                                <span className="text-slate-600">Country</span>
                                <span className="font-medium text-slate-900">{selectedRecipient.country_code}</span>
                              </div>
                            )}

                            {/* Verification Status */}
                            <div className="flex justify-between items-center pt-2 border-t border-emerald-200">
                              <span className="text-slate-600">Status</span>
                              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${selectedRecipient.phone_number ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {selectedRecipient.phone_number ? '✓ Verified' : 'Pending Verification'}
                              </span>
                            </div>

                            {/* Account Age */}
                            {selectedRecipient.created_at && (
                              <div className="flex justify-between items-center">
                                <span className="text-slate-600">Member Since</span>
                                <span className="text-xs text-slate-500">{new Date(selectedRecipient.created_at).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Amount Conversion Section */}
                    {amount && (
                      <div className="mb-6 pb-6 border-b border-slate-200">
                        <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-3">Amount & Conversion</p>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                            <span className="text-slate-600">Amount Sending</span>
                            <span className="font-medium text-lg text-slate-900">{getCurrencySymbol(selectedSender)}{formatNumber(parseFloat(amount) || 0)}</span>
                          </div>

                          {selectedSender !== recipientCurrency && (
                            <>
                              <div className="flex items-center justify-center">
                                <div className="text-xs text-slate-500 font-medium">Exchange Rate</div>
                              </div>
                              <div className="text-center py-2 px-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-xs text-amber-700 font-medium">
                                  {getCurrencySymbol(selectedSender)}1 = {getCurrencySymbol(recipientCurrency)}{exchangeRate.toFixed(4)}
                                </p>
                              </div>
                            </>
                          )}

                          <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                            <span className="text-emerald-700 font-medium">Recipient Receives</span>
                            <span className="font-semibold text-lg text-emerald-700">{getCurrencySymbol(recipientCurrency)}{formatNumber(parseFloat(receiverAmount) || 0)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Fees Section */}
                    <div className="mb-6 pb-6 border-b border-slate-200">
                      <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-3">Fees & Charges</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center p-2">
                          <span className="text-slate-600">Transfer Fee (1%)</span>
                          <span className="font-medium text-slate-900">{getCurrencySymbol(selectedSender)}{formatNumber((parseFloat(amount) * 0.01) || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg border border-amber-200 mt-2">
                          <span className="font-medium text-amber-700">Total Debit</span>
                          <span className="font-semibold text-amber-700">{getCurrencySymbol(selectedSender)}{formatNumber((parseFloat(amount) * 1.01) || 0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Confirmation Disclaimer */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-xs text-blue-700">
                        <span className="font-semibold">Please review carefully:</span> Once you confirm this transaction, the funds will be transferred to {selectedRecipient?.full_name || selectedRecipient?.email}. This action cannot be reversed.
                      </p>
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
                      type="submit"
                      disabled={sending || !amount || parseFloat(amount) <= 0}
                      className="flex-1 bg-emerald-600 text-white py-3 rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sending ? 'Processing...' : 'Confirm & Send'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Beneficiaries Sidebar */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Recent Recipients</h3>
            <div className="space-y-2">
              {beneficiaries.length === 0 ? (
                <p className="text-slate-500 text-sm">No saved recipients yet</p>
              ) : (
                beneficiaries.slice(0, 5).map(b => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setSelectedRecipient({
                        id: b.recipient_id,
                        email: b.recipient_email,
                        full_name: b.recipient_name
                      })
                      setRecipientEmail(b.recipient_email)
                      setStep(2)
                    }}
                    className="w-full text-left p-3 bg-slate-50 rounded-lg hover:bg-blue-50 transition-colors text-sm"
                  >
                    <p className="font-medium text-slate-900">{b.recipient_name}</p>
                    <p className="text-xs text-slate-500 mt-1">{b.recipient_email}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Save Current Recipient</h3>
            {selectedRecipient ? (
              <form onSubmit={handleAddBeneficiary} className="space-y-3">
                <p className="text-sm text-slate-600">
                  Save <span className="font-medium">{selectedRecipient.full_name || selectedRecipient.email}</span> as a beneficiary?
                </p>
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                  Save Recipient
                </button>
              </form>
            ) : (
              <p className="text-slate-500 text-sm">Select a recipient above to save</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
