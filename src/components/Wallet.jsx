import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { wisegcashAPI } from '../lib/payments'
import { preferencesManager } from '../lib/preferencesManager'
import { formatNumber } from '../lib/currency'

const FIAT_CURRENCIES = [
  'PHP', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'AUD',
  'CAD', 'CHF', 'SEK', 'NZD', 'SGD', 'HKD', 'IDR', 'MYR',
  'THB', 'VND', 'KRW', 'ZAR', 'BRL', 'MXN', 'NOK', 'DKK', 'AED'
]

const CRYPTO_CURRENCIES = [
  'BTC', 'ETH', 'XRP', 'ADA', 'SOL', 'DOGE', 'MATIC', 'LINK',
  'LTC', 'BCH', 'USDT', 'USDC', 'BUSD', 'SHIB', 'AVAX', 'DOT'
]

const ALL_CURRENCIES = [...FIAT_CURRENCIES, ...CRYPTO_CURRENCIES]

const CURRENCY_SYMBOLS = {
  'PHP': '₱', 'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥',
  'CNY': '¥', 'INR': '₹', 'AUD': '$', 'CAD': '$', 'CHF': 'CHF',
  'SEK': 'kr', 'NZD': '$', 'SGD': '$', 'HKD': '$', 'IDR': 'Rp',
  'MYR': 'RM', 'THB': 'THB', 'VND': '₫', 'KRW': '₩', 'ZAR': 'R',
  'BRL': 'R$', 'MXN': '$', 'NOK': 'kr', 'DKK': 'kr', 'AED': 'د.إ',
  'BTC': 'BTC', 'ETH': 'ETH', 'XRP': 'XRP', 'ADA': 'ADA', 'SOL': 'SOL',
  'DOGE': 'DOGE', 'MATIC': 'MATIC', 'LINK': 'LINK', 'LTC': 'LTC', 'BCH': 'BCH',
  'USDT': 'USDT', 'USDC': 'USDC', 'BUSD': 'BUSD', 'SHIB': 'SHIB',
  'AVAX': 'AVAX', 'DOT': 'DOT'
}

export default function Wallet({ userId, totalBalancePHP = 0 }) {
  const [wallets, setWallets] = useState([])
  const [fiatWallets, setFiatWallets] = useState([])
  const [cryptoWallets, setCryptoWallets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddFunds, setShowAddFunds] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState(null)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [enabledCurrencies, setEnabledCurrencies] = useState([])

  useEffect(() => {
    loadWallets()
    loadPreferences()
  }, [userId])

  const loadPreferences = () => {
    const prefs = preferencesManager.getAllPreferences(userId)
    if (prefs.walletCurrencies) {
      setEnabledCurrencies(prefs.walletCurrencies)
    }
  }

  const savePreferences = (currencies) => {
    const prefs = preferencesManager.getAllPreferences(userId)
    prefs.walletCurrencies = currencies
    preferencesManager.setPreferences(userId, prefs)
    setEnabledCurrencies(currencies)
  }

  const loadWallets = async () => {
    try {
      if (!userId || userId.includes('guest-local') || userId === 'null' || userId === 'undefined') {
        setWallets([])
        setEnabledCurrencies(['PHP', 'USD'])
        setLoading(false)
        return
      }

      // Fetch wallets and ensure each has an account number (legacy/internal)
      let mergedWallets = []
      try {
        const walletsWithAcct = await wisegcashAPI.ensureWalletsHaveAccountNumbers(userId)
        mergedWallets = walletsWithAcct || []
      } catch (err) {
        console.warn('Could not ensure account numbers for wallets:', err)
        const data = await wisegcashAPI.getWallets(userId)
        mergedWallets = data || []
      }

      // Fetch additional fiat and crypto wallets from Supabase (new tables)
      try {
        const { data: fData } = await supabase.from('wallets_fiat').select('*').eq('user_id', userId)
        const fiatMapped = (fData || []).map(r => ({
          id: r.id,
          currency_code: r.currency,
          balance: Number(r.balance || 0),
          account_number: r.provider_account_id || null,
          provider: r.provider,
          source: 'fiat'
        }))
        setFiatWallets(fiatMapped)
        mergedWallets = [...mergedWallets, ...fiatMapped]
      } catch (e) {
        console.warn('Error loading wallets_fiat from Supabase:', e)
      }

      try {
        const { data: cData } = await supabase.from('wallets_crypto').select('*').eq('user_id', userId)
        const cryptoMapped = (cData || []).map(r => ({
          id: r.id,
          currency_code: r.chain || r.currency || 'CRYPTO',
          balance: Number(r.balance || 0),
          address: r.address,
          provider: r.provider,
          source: 'crypto'
        }))
        setCryptoWallets(cryptoMapped)
        mergedWallets = [...mergedWallets, ...cryptoMapped]
      } catch (e) {
        console.warn('Error loading wallets_crypto from Supabase:', e)
      }

      setWallets(mergedWallets)
      setError('')

      // Auto-populate preferences based on existing wallets if not set
      const prefs = preferencesManager.getAllPreferences(userId)
      if (!prefs.walletCurrencies && mergedWallets.length > 0) {
        const walletCurrencies = mergedWallets.map(w => w.currency_code)
        savePreferences(walletCurrencies)
      } else if (!prefs.walletCurrencies) {
        savePreferences(['PHP', 'USD'])
      }

    } catch (err) {
      console.error('Error loading wallets:', err)
      setWallets([])
      setError('')
    } finally {
      setLoading(false)
    }
  }

  const handleAddFunds = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!selectedWallet || !amount || parseFloat(amount) <= 0) {
      setError('Please select a wallet and enter a valid amount')
      return
    }

    try {
      await wisegcashAPI.addFunds(userId, selectedWallet.currency_code, parseFloat(amount))
      setSuccess(`Successfully added ${amount} ${selectedWallet.currency_code}`)
      setAmount('')
      setShowAddFunds(false)
      loadWallets()
    } catch (err) {
      setError(err.message || 'Failed to add funds')
    }
  }

  const handleCreateWallet = async (currency) => {
    try {
      setError('')
      setSuccess('')

      // Validate user before attempting wallet creation
      if (!userId || userId === 'null' || userId === 'undefined' || userId.includes('guest-local')) {
        setError('Please sign in to create wallets')
        return
      }

      await wisegcashAPI.createWallet(userId, currency)

      // Add small delay to allow database to sync
      await new Promise(resolve => setTimeout(resolve, 500))

      // Refresh wallet list
      await loadWallets()

      // Close the modal to show updated wallet list
      setShowPreferences(false)

      setSuccess(`${currency} wallet created`)

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error(`Wallet creation error for ${currency}:`, err)
      const errorMsg = err?.message || String(err) || 'Unknown error'
      setError(`Failed to create ${currency} wallet: ${errorMsg}`)

      // Clear error after 5 seconds
      setTimeout(() => setError(''), 5000)
    }
  }

  const toggleCurrency = (currency) => {
    let updated
    if (enabledCurrencies.includes(currency)) {
      updated = enabledCurrencies.filter(c => c !== currency)
    } else {
      updated = [...enabledCurrencies, currency].sort()
    }
    savePreferences(updated)
  }

  const filteredCurrencies = ALL_CURRENCIES.filter(c =>
    c.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const visibleWallets = wallets.filter(w => enabledCurrencies.includes(w.currency_code))

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="text-center text-slate-500">Loading wallets...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-light text-slate-900 tracking-tight">My Wallets</h2>
          <p className="text-xs text-slate-500 mt-1">Total value (PHP): <span className="font-mono text-sm">{formatNumber(totalBalancePHP)}</span></p>
        </div>

        <div>
          <button
            onClick={() => setShowPreferences(true)}
            className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
          >
            ⚙️ Customize
          </button>
        </div>
      </div>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">{success}</div>}

      {/* Wallets Display */}
      {visibleWallets.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-slate-500 mb-4">No wallets created yet</p>
          <button
            onClick={() => setShowPreferences(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            Create Your First Wallet
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {visibleWallets.map(wallet => (
            <div key={wallet.id} className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-600 font-medium uppercase tracking-wider">{wallet.currency_code}</p>
                <span className="text-2xl">{CURRENCY_SYMBOLS[wallet.currency_code] || '$'}</span>
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Balance</p>
              <p className="text-3xl font-light text-slate-900 mb-2">{Number(wallet.balance || 0).toFixed(2)}</p>
              {wallet.account_number && (
                <p className="text-xs text-slate-500 mb-4">Acct: {wallet.account_number}</p>
              )}
              <button
                onClick={() => {
                  setSelectedWallet(wallet)
                  setShowAddFunds(true)
                }}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
              >
                Add Funds
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Preferences Modal */}

      {/* New: Fiat wallets from wallets_fiat table */}
      {fiatWallets.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-light mb-3">Fiat Wallets</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fiatWallets.map(w => (
              <div key={w.id} className="bg-white border border-slate-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-600 font-medium uppercase tracking-wider">{w.currency_code}</p>
                  <p className="text-sm text-slate-500">{w.provider}</p>
                </div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Balance</p>
                <p className="text-2xl font-light text-slate-900 mb-2">{Number(w.balance || 0).toFixed(2)}</p>
                {w.account_number && <p className="text-xs text-slate-500 mb-4">Acct: {w.account_number}</p>}
                <button className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors text-sm">Deposit / Pay</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New: Crypto wallets from wallets_crypto table */}
      {cryptoWallets.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-light mb-3">Crypto Wallets</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cryptoWallets.map(w => (
              <div key={w.id} className="bg-white border border-slate-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-600 font-medium uppercase tracking-wider">{w.currency_code}</p>
                  <p className="text-sm text-slate-500">{w.provider || w.chain}</p>
                </div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Balance</p>
                <p className="text-2xl font-light text-slate-900 mb-2">{Number(w.balance || 0).toFixed(6)}</p>
                {w.address && <p className="text-xs text-slate-500 mb-4 truncate">Addr: {w.address}</p>}
                <div className="flex gap-2">
                  <button className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm">Send</button>
                  <button className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm">Receive</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showPreferences && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-light text-slate-900">Customize Wallets</h3>
              <button
                onClick={() => setShowPreferences(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-4">Select which currencies and cryptocurrencies to display</p>

            {/* Search */}
            <input
              type="text"
              placeholder="Search currencies..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent mb-6 text-sm"
            />

            {/* Currency Grid - Two Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Fiat Currencies */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Fiat Currencies</h4>
                <div className="space-y-2">
                  {FIAT_CURRENCIES.filter(c => !searchQuery || c.toLowerCase().includes(searchQuery.toLowerCase())).map(currency => {
                    const walletExists = wallets.some(w => w.currency_code === currency)
                    const isEnabled = enabledCurrencies.includes(currency)

                    return (
                      <label
                        key={currency}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => toggleCurrency(currency)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{currency}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {walletExists ? `Balance: ${wallets.find(w => w.currency_code === currency)?.balance?.toFixed(2) || '0.00'}` : 'No wallet yet'}
                          </p>
                          {walletExists && wallets.find(w => w.currency_code === currency)?.account_number && (
                            <p className="text-xs text-slate-400 truncate">Acct: {wallets.find(w => w.currency_code === currency)?.account_number}</p>
                          )}
                        </div>
                        {!walletExists && isEnabled && (
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              handleCreateWallet(currency)
                            }}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors shrink-0"
                          >
                            Create
                          </button>
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Cryptocurrencies */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Cryptocurrencies</h4>
                <div className="space-y-2">
                  {CRYPTO_CURRENCIES.filter(c => !searchQuery || c.toLowerCase().includes(searchQuery.toLowerCase())).map(currency => {
                    const walletExists = wallets.some(w => w.currency_code === currency)
                    const isEnabled = enabledCurrencies.includes(currency)

                    return (
                      <label
                        key={currency}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => toggleCurrency(currency)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{currency}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {walletExists ? `Balance: ${wallets.find(w => w.currency_code === currency)?.balance?.toFixed(2) || '0.00'}` : 'No wallet yet'}
                          </p>
                          {walletExists && wallets.find(w => w.currency_code === currency)?.account_number && (
                            <p className="text-xs text-slate-400 truncate">Acct: {wallets.find(w => w.currency_code === currency)?.account_number}</p>
                          )}
                        </div>
                        {!walletExists && isEnabled && (
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              handleCreateWallet(currency)
                            }}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors shrink-0"
                          >
                            Create
                          </button>
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPreferences(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Funds Modal */}
      {showAddFunds && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-light text-slate-900 mb-6">Add Funds</h3>

            <form onSubmit={handleAddFunds} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Amount ({selectedWallet?.currency_code})
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

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setShowAddFunds(false)}
                  className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Add Funds
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
