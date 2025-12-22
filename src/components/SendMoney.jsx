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

  const handleSelectRecipient = (user) => {
    setSelectedRecipient(user)
    setRecipientEmail(user.email)
    setSearchQuery('')
    setSearchResults([])
    setShowSearchDropdown(false)
  }

  const handleAddBeneficiary = async (e) => {
    e.preventDefault()
    setError('')

    if (!selectedRecipient) {
      setError('Please select a recipient from the search results')
      return
    }

    try {
      await currencyAPI.addBeneficiary(userId, {
        recipient_email: selectedRecipient.email,
        recipient_name: selectedRecipient.full_name || selectedRecipient.email.split('@')[0],
        recipient_id: selectedRecipient.id,
        country_code: 'PH'
      })
      setSuccess('Recipient saved!')
      setTimeout(() => {
        setSuccess('')
        loadData()
      }, 2000)
    } catch (err) {
      setError(err.message || 'Failed to save recipient')
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
                      {/* Fiat Currencies Section */}
                      {(() => {
                        const { fiatWallets } = getWalletsByType()
                        return fiatWallets.length > 0 ? (
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-3">Fiat Currency</label>
                            <select
                              value={selectedSender}
                              onChange={(e) => setSelectedSender(e.target.value)}
                              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white"
                            >
                              {fiatWallets.map(wallet => (
                                <option key={wallet.id} value={wallet.currency_code}>
                                  {wallet.currency_code} ({getCurrencySymbol(wallet.currency_code)}) - Balance: {formatNumber(wallet.balance || 0)}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null
                      })()}

                      {/* Cryptocurrency Section */}
                      {(() => {
                        const { cryptoWallets } = getWalletsByType()
                        return cryptoWallets.length > 0 ? (
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-3">Cryptocurrency</label>
                            <select
                              value={selectedSender}
                              onChange={(e) => setSelectedSender(e.target.value)}
                              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white"
                            >
                              {cryptoWallets.map(wallet => (
                                <option key={wallet.id} value={wallet.currency_code}>
                                  {wallet.currency_code} - Balance: {formatNumber(wallet.balance || 0)}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null
                      })()}

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

                  {/* Recipient Currency */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-4">Recipient Currency</label>
                    {wallets.length === 0 ? (
                      <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 text-sm text-slate-600">
                        No wallets available
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {wallets.map(wallet => (
                          <button
                            key={wallet.id}
                            type="button"
                            onClick={() => setRecipientCurrency(wallet.currency_code)}
                            className={`text-left bg-white border-2 rounded-lg p-4 transition-all hover:shadow-lg ${
                              recipientCurrency === wallet.currency_code
                                ? 'border-blue-600 ring-2 ring-blue-200 shadow-lg'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {/* Header */}
                            <div className="mb-3 flex items-start justify-between">
                              <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                  {wallet.currency_code}
                                </p>
                                <p className="text-xl font-light text-slate-900">
                                  {getCurrencySymbol(wallet.currency_code)}
                                </p>
                              </div>
                              {recipientCurrency === wallet.currency_code && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                                  Selected
                                </span>
                              )}
                            </div>

                            {/* Balance */}
                            <div className="bg-slate-50 rounded-lg p-3 mb-3">
                              <p className="text-xs text-slate-600 mb-1">Current Balance</p>
                              <p className="text-lg font-light text-slate-900 font-mono">
                                {formatNumber(wallet.balance || 0)}
                              </p>
                            </div>

                            {/* Wallet ID */}
                            <div className="bg-blue-50 rounded-lg p-2 mb-3 border border-blue-200">
                              <p className="text-xs text-blue-700 font-medium mb-1">Wallet ID</p>
                              <p className="text-xs font-mono text-slate-900 break-all">
                                {wallet.id}
                              </p>
                            </div>

                            {/* Meta Info */}
                            <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-200">
                              <div>Account: {wallet.account_number || 'N/A'}</div>
                              <div>Created: {new Date(wallet.created_at).toLocaleDateString()}</div>
                            </div>
                          </button>
                        ))}
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
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-slate-900">Enter Amount</h3>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Amount ({getCurrencySymbol(selectedSender)} {selectedSender})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-lg"
                    />
                  </div>

                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-xs text-slate-600 font-medium uppercase tracking-wider mb-1">Recipient Receives</p>
                    <p className="text-3xl font-light text-slate-900">
                      {formatCurrency(receiverAmount, recipientCurrency)}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      Rate: {getCurrencySymbol(selectedSender)}1 = {getCurrencySymbol(recipientCurrency)}{exchangeRate.toFixed(4)} ({selectedSender}→{recipientCurrency})
                    </p>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                    <p className="text-sm font-medium text-slate-700">Transfer Fee</p>
                    <p className="text-lg font-light text-slate-900 mt-1">1% of amount</p>
                  </div>

                  {selectedRecipient && (
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm">
                      <p className="text-slate-600">Sending to: <span className="font-medium text-slate-900">{selectedRecipient.full_name || selectedRecipient.email}</span></p>
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
                      disabled={sending}
                      className="flex-1 bg-emerald-600 text-white py-3 rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50"
                    >
                      {sending ? 'Sending...' : 'Send Money'}
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
