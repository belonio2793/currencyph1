import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import FiatCryptoToggle from './FiatCryptoToggle'

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

function DepositsComponent({ userId, globalCurrency = 'PHP' }) {
  // Form state
  const [amount, setAmount] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState(globalCurrency)
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [selectedWallet, setSelectedWallet] = useState(null)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [newWalletCurrency, setNewWalletCurrency] = useState(selectedCurrency)

  // Data state
  const [wallets, setWallets] = useState([])
  const [currencies, setCurrencies] = useState([])
  const [deposits, setDeposits] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // UI state
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [step, setStep] = useState('amount') // amount -> method -> confirm
  const [activeType, setActiveType] = useState('fiat') // 'fiat' or 'crypto'

  useEffect(() => {
    loadInitialData()
  }, [userId])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      setError('')

      if (!userId || userId.includes('guest')) {
        setLoading(false)
        return
      }

      // Load wallets and currencies separately
      const [walletsResult, currenciesResult] = await Promise.all([
        supabase
          .from('wallets')
          .select('id, user_id, currency_code, balance, created_at')
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

      // Load user's deposits
      const { data: depositsData, error: depositsError } = await supabase
        .from('deposits')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (depositsError) throw depositsError
      setDeposits(depositsData || [])

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

      // Create pending deposit record
      const { data: deposit, error: err } = await supabase
        .from('deposits')
        .insert([{
          user_id: userId,
          wallet_id: selectedWallet,
          amount: parseFloat(amount),
          currency_code: selectedCurrency,
          deposit_method: selectedMethod,
          status: 'pending',
          description: `${DEPOSIT_METHODS[selectedMethod].name} deposit of ${amount} ${selectedCurrency}`
        }])
        .select()
        .single()

      if (err) throw err

      // Add to deposits list
      setDeposits([deposit, ...deposits])
      setSuccess('Deposit initiated. Awaiting payment...')
      
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

  // Filter currencies by type
  const fiatCurrencies = currencies.filter(c => c.type === 'fiat')
  const cryptoCurrencies = currencies.filter(c => c.type === 'crypto')
  const displayedCurrencies = activeType === 'fiat' ? fiatCurrencies : cryptoCurrencies

  // Filter wallets by type
  const fiatWallets = wallets.filter(w => w.currency_type === 'fiat')
  const cryptoWallets = wallets.filter(w => w.currency_type === 'crypto')

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
            <p className="text-slate-600 mt-2">Deposit money into your wallet using GCash or Solana</p>
          </div>
          {(fiatCurrencies.length > 0 || cryptoCurrencies.length > 0) && (
            <FiatCryptoToggle active={activeType} onChange={setActiveType} />
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
                    {fiatCurrencies.length > 0 && (
                      <>
                        <option disabled style={{ fontWeight: 'bold', backgroundColor: '#f3f4f6' }}>
                          ━━━ CURRENCIES ━━━
                        </option>
                        {fiatCurrencies.map(c => (
                          <option key={c.code} value={c.code}>
                            {c.code} {CURRENCY_SYMBOLS[c.code] || ''}
                          </option>
                        ))}
                      </>
                    )}
                    {cryptoCurrencies.length > 0 && (
                      <>
                        <option disabled style={{ fontWeight: 'bold', backgroundColor: '#f3f4f6' }}>
                          ━━━ CRYPTOCURRENCIES ━━━
                        </option>
                        {cryptoCurrencies.map(c => (
                          <option key={c.code} value={c.code}>
                            {c.code} {CURRENCY_SYMBOLS[c.code] || ''}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Wallet Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">Deposit to Wallet</label>
                  <button
                    type="button"
                    onClick={() => setShowWalletModal(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + Create Wallet
                  </button>
                </div>
                <select
                  value={selectedWallet || ''}
                  onChange={(e) => setSelectedWallet(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select a wallet</option>
                  {fiatWallets.length > 0 && (
                    <>
                      <option disabled style={{ fontWeight: 'bold', backgroundColor: '#f3f4f6' }}>
                        ━━━ CURRENCIES ━━━
                      </option>
                      {fiatWallets.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.currency_name} ({w.currency_symbol} {w.balance.toFixed(2)})
                        </option>
                      ))}
                    </>
                  )}
                  {cryptoWallets.length > 0 && (
                    <>
                      <option disabled style={{ fontWeight: 'bold', backgroundColor: '#f3f4f6' }}>
                        ━━━ CRYPTOCURRENCIES ━━━
                      </option>
                      {cryptoWallets.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.currency_name} ({w.currency_symbol} {w.balance.toFixed(2)})
                        </option>
                      ))}
                    </>
                  )}
                </select>
                {!selectedWallet && (
                  <p className="text-xs text-slate-500 mt-1">Create a wallet if you don't have one for this currency</p>
                )}
              </div>

              {/* Select Deposit Method */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">Payment Method</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.values(DEPOSIT_METHODS).map(method => (
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
              <div className="grid grid-cols-3 gap-4">
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

            {/* Solana Address QR */}
            {selectedMethod === 'solana' && (
              <div className="mb-8 p-6 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm text-slate-600 mb-3 font-medium">Send Solana to this address:</p>
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
                      {SOLANA_ADDRESS}
                    </p>
                    <button
                      onClick={() => copyToClipboard(SOLANA_ADDRESS)}
                      className="mt-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Copy Address
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Important Notes */}
            <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="font-semibold text-yellow-900 mb-2">⚠️ Important:</p>
              <ul className="text-sm text-yellow-800 space-y-1">
                {selectedMethod === 'solana' && (
                  <>
                    <li>• Only send Solana (SOL) to this address</li>
                    <li>• Do not send other tokens or NFTs</li>
                    <li>• Transactions cannot be reversed</li>
                    <li>• Keep the transaction hash for your records</li>
                  </>
                )}
                {selectedMethod === 'gcash' && (
                  <>
                    <li>• Ensure you have sufficient balance in GCash</li>
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
                    <th className="text-left py-3 px-4 text-slate-600 font-medium">Method</th>
                    <th className="text-left py-3 px-4 text-slate-600 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-slate-600 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.slice(0, 5).map(deposit => (
                    <tr key={deposit.id} className="border-b border-slate-100">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {deposit.amount} {deposit.currency_code}
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
              {fiatCurrencies.length > 0 && (
                <>
                  <option disabled style={{ fontWeight: 'bold', backgroundColor: '#f3f4f6' }}>
                    ━━━ CURRENCIES ━━━
                  </option>
                  {fiatCurrencies.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name} ({c.symbol || ''})
                    </option>
                  ))}
                </>
              )}
              {cryptoCurrencies.length > 0 && (
                <>
                  <option disabled style={{ fontWeight: 'bold', backgroundColor: '#f3f4f6' }}>
                    ━━━ CRYPTOCURRENCIES ━━━
                  </option>
                  {cryptoCurrencies.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name} ({c.symbol || ''})
                    </option>
                  ))}
                </>
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
