import { useState, useEffect } from 'react'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { currencyAPI } from '../lib/payments'
import { preferencesManager } from '../lib/preferencesManager'
import { formatNumber } from '../lib/currency'
import { fetchRatesMap, convertAmount } from '../lib/reconciliation'


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
  'BRL': 'R$', 'MXN': '$', 'NOK': 'kr', 'DKK': 'kr', 'AED': '��.إ',
  'BTC': 'BTC', 'ETH': 'ETH', 'XRP': 'XRP', 'ADA': 'ADA', 'SOL': 'SOL',
  'DOGE': 'DOGE', 'MATIC': 'MATIC', 'LINK': 'LINK', 'LTC': 'LTC', 'BCH': 'BCH',
  'USDT': 'USDT', 'USDC': 'USDC', 'BUSD': 'BUSD', 'SHIB': 'SHIB',
  'AVAX': 'AVAX', 'DOT': 'DOT'
}

export default function Wallet({ userId, totalBalancePHP = 0, globalCurrency = 'PHP' }) {
  const [wallets, setWallets] = useState([])
  const [internalWallets, setInternalWallets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddFunds, setShowAddFunds] = useState(false)

  // Preference states
  const [enabledInternal, setEnabledInternal] = useState([])

  const [selectedWallet, setSelectedWallet] = useState(null)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Exchange rates and consolidated balance
  const [ratesMap, setRatesMap] = useState({})
  const [consolidatedBalance, setConsolidatedBalance] = useState(0)



  useEffect(() => {
    // Ensure user has wallets for all active currencies (for existing users)
    if (userId && !userId.includes('guest-local') && userId !== 'null' && userId !== 'undefined') {
      currencyAPI.ensureUserWallets(userId).catch(err => {
        console.warn('Failed to ensure user wallets:', err)
      })
    }

    loadWallets()
    loadPreferences()

    // Subscribe to realtime changes so UI updates automatically
    const channels = []

    try {
      const chWallets = supabase
        .channel('public:wallets')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` }, () => {
          loadWallets()
        })
        .subscribe()
      channels.push(chWallets)
    } catch (e) {
      console.warn('Failed to subscribe to wallets realtime:', e)
    }

    return () => {
      try {
        channels.forEach(c => c && c.unsubscribe && c.unsubscribe())
      } catch (e) {}
    }
  }, [userId])

  const loadPreferences = () => {
    const prefs = preferencesManager.getAllPreferences(userId)

    // Load enabled wallets from preferences
    if (prefs.walletCurrencies) {
      setEnabledInternal(prefs.walletCurrencies)
    } else {
      // Default: show all currencies since they're auto-created
      setEnabledInternal(ALL_CURRENCIES)
    }
  }

  const savePreferences = (type, currencies) => {
    const prefs = preferencesManager.getAllPreferences(userId)
    if (type === 'internal') {
      prefs.walletCurrencies = currencies
      preferencesManager.setPreferences(userId, prefs)
      setEnabledInternal(currencies)
    } else if (type === 'fiat') {
      prefs.walletCurrencies_fiat = currencies
      preferencesManager.setPreferences(userId, prefs)
      setEnabledFiat(currencies)
    }
  }

  const loadWallets = async () => {
    try {
      if (!userId || userId.includes('guest-local') || userId === 'null' || userId === 'undefined') {
        setWallets([])
        setEnabledInternal(ALL_CURRENCIES)
        setLoading(false)
        return
      }

      // Fetch exchange rates for conversion
      let rates = {}
      try {
        rates = await fetchRatesMap()
        setRatesMap(rates)
      } catch (e) {
        console.warn('Could not fetch exchange rates:', e)
      }

      // Fetch all wallets from the unified wallets table
      let allWallets = []
      try {
        const data = await currencyAPI.getWallets(userId)
        allWallets = data || []
      } catch (err) {
        console.warn('Could not load wallets:', err)
      }

      setInternalWallets(allWallets)
      setWallets(allWallets)

      // Calculate consolidated balance in global currency
      let total = 0
      allWallets.forEach(wallet => {
        const isSameCurrency = wallet.currency_code === globalCurrency
        let converted = 0
        if (isSameCurrency) {
          converted = Number(wallet.balance || 0)
        } else {
          converted = convertAmount(Number(wallet.balance || 0), wallet.currency_code, globalCurrency, rates)
        }
        if (converted !== null) {
          total += converted
        }
      })
      setConsolidatedBalance(total)
      setError('')

      // Auto-populate preferences to show all currencies
      const prefs = preferencesManager.getAllPreferences(userId)
      if (!prefs.walletCurrencies) {
        savePreferences('internal', allWallets.map(w => w.currency_code))
      }

    } catch (err) {
      console.error('Error loading wallets:', err)
      setWallets([])
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
      await currencyAPI.addFunds(userId, selectedWallet.currency_code, parseFloat(amount))
      setSuccess(`Successfully added ${amount} ${selectedWallet.currency_code}`)
      setAmount('')
      setShowAddFunds(false)
      loadWallets()
    } catch (err) {
      setError(err.message || 'Failed to add funds')
    }
  }





  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="text-center text-slate-500">Loading wallets...</div>
      </div>
    )
  }

  // Separate wallets by type
  const fiatWalletsFiltered = internalWallets.filter(w => FIAT_CURRENCIES.includes(w.currency_code) && enabledInternal.includes(w.currency_code)).sort((a, b) => a.currency_code.localeCompare(b.currency_code))
  const cryptoWalletsFiltered = internalWallets.filter(w => CRYPTO_CURRENCIES.includes(w.currency_code) && enabledInternal.includes(w.currency_code)).sort((a, b) => a.currency_code.localeCompare(b.currency_code))

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Header with total balance */}
      <div className="mb-8">
        <h1 className="text-4xl font-light text-slate-900 tracking-tight mb-2">My Wallets</h1>
        <div className="flex items-baseline gap-2">
          <p className="text-sm text-slate-600">Total Balance</p>
          <p className="text-3xl font-light text-slate-900">{formatNumber(consolidatedBalance > 0 ? consolidatedBalance : totalBalancePHP)}</p>
          <p className="text-sm text-slate-500">{globalCurrency}</p>
        </div>
      </div>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">{success}</div>}

      {/* Fiat Currencies Section */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-light text-slate-900 tracking-tight">Fiat Currencies</h2>
          <p className="text-sm text-slate-500">{fiatWalletsFiltered.length} available</p>
        </div>

        {fiatWalletsFiltered.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
            <p className="text-slate-500">No fiat wallets available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {fiatWalletsFiltered.map(wallet => {
              const isSameCurrency = wallet.currency_code === globalCurrency
              let balanceInGlobalCurrency = Number(wallet.balance || 0)
              if (!isSameCurrency) {
                const converted = convertAmount(Number(wallet.balance || 0), wallet.currency_code, globalCurrency, ratesMap)
                balanceInGlobalCurrency = converted !== null ? converted : Number(wallet.balance || 0)
              }
              const symbol = CURRENCY_SYMBOLS[wallet.currency_code] || wallet.currency_code

              return (
                <div key={wallet.id} className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-lg transition-all hover:border-slate-300">
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Currency</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-light text-slate-900">{wallet.currency_code}</p>
                      <p className="text-sm text-slate-500">{symbol}</p>
                    </div>
                  </div>

                  <div className="mb-4 pb-4 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Balance ({globalCurrency})</p>
                    <p className="text-xl font-light text-slate-900 font-mono">{formatNumber(balanceInGlobalCurrency)}</p>
                    {!isSameCurrency && Number(wallet.balance || 0) > 0 && (
                      <p className="text-xs text-slate-400 mt-1">{formatNumber(Number(wallet.balance || 0))} {wallet.currency_code}</p>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setSelectedWallet(wallet)
                      setShowAddFunds(true)
                    }}
                    className="w-full py-2 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Add Funds
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Cryptocurrency Section */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-light text-slate-900 tracking-tight">Cryptocurrencies</h2>
          <p className="text-sm text-slate-500">{cryptoWalletsFiltered.length} available</p>
        </div>

        {cryptoWalletsFiltered.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
            <p className="text-slate-500">No crypto wallets available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cryptoWalletsFiltered.map(wallet => {
              const isSameCurrency = wallet.currency_code === globalCurrency
              let balanceInGlobalCurrency = Number(wallet.balance || 0)
              if (!isSameCurrency) {
                const converted = convertAmount(Number(wallet.balance || 0), wallet.currency_code, globalCurrency, ratesMap)
                balanceInGlobalCurrency = converted !== null ? converted : Number(wallet.balance || 0)
              }
              const symbol = CURRENCY_SYMBOLS[wallet.currency_code] || wallet.currency_code

              return (
                <div key={wallet.id} className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-lg transition-all hover:border-slate-300">
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Cryptocurrency</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-light text-slate-900">{wallet.currency_code}</p>
                      <p className="text-sm text-slate-500">{symbol}</p>
                    </div>
                  </div>

                  <div className="mb-4 pb-4 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Balance ({globalCurrency})</p>
                    <p className="text-xl font-light text-slate-900 font-mono">{formatNumber(balanceInGlobalCurrency)}</p>
                    {!isSameCurrency && Number(wallet.balance || 0) > 0 && (
                      <p className="text-xs text-slate-400 mt-1">{formatNumber(Number(wallet.balance || 0))} {wallet.currency_code}</p>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setSelectedWallet(wallet)
                      setShowAddFunds(true)
                    }}
                    className="w-full py-2 px-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                  >
                    Add Funds
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>


      {/* Add Funds Modal */}
      {showAddFunds && selectedWallet && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-2xl font-light text-slate-900 mb-2">Add Funds</h3>
            <p className="text-sm text-slate-600 mb-6">
              {CRYPTO_CURRENCIES.includes(selectedWallet.currency_code) ? 'Cryptocurrency' : 'Fiat Currency'} · {selectedWallet.currency_code}
            </p>

            <form onSubmit={handleAddFunds} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Amount ({selectedWallet.currency_code})
                </label>
                <input
                  type="number"
                  step={CRYPTO_CURRENCIES.includes(selectedWallet.currency_code) ? "0.00000001" : "0.01"}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-lg"
                  autoFocus
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddFunds(false)}
                  className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 px-4 py-3 text-white rounded-lg hover:opacity-90 transition-opacity font-medium text-sm ${
                    CRYPTO_CURRENCIES.includes(selectedWallet.currency_code)
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
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
