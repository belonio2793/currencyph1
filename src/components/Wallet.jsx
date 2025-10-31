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
  const [internalWallets, setInternalWallets] = useState([])
  const [fiatWallets, setFiatWallets] = useState([])
  const [cryptoWallets, setCryptoWallets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddFunds, setShowAddFunds] = useState(false)

  // Preference states (separate for each table)
  const [enabledInternal, setEnabledInternal] = useState([])
  const [enabledFiat, setEnabledFiat] = useState([])
  const [enabledCrypto, setEnabledCrypto] = useState([])

  // Which preference modal is shown
  const [showPreferencesInternal, setShowPreferencesInternal] = useState(false)
  const [showPreferencesFiat, setShowPreferencesFiat] = useState(false)
  const [showPreferencesCrypto, setShowPreferencesCrypto] = useState(false)

  const [selectedWallet, setSelectedWallet] = useState(null)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Fiat modal state
  const [showFiatModal, setShowFiatModal] = useState(false)
  const [selectedFiatWallet, setSelectedFiatWallet] = useState(null)
  const [fiatAction, setFiatAction] = useState('deposit') // 'deposit' | 'pay'
  const [fiatAmount, setFiatAmount] = useState('')

  // Crypto modal state
  const [showCryptoModal, setShowCryptoModal] = useState(false)
  const [selectedCryptoWallet, setSelectedCryptoWallet] = useState(null)
  const [cryptoAction, setCryptoAction] = useState('send') // 'send' | 'receive'
  const [cryptoAmount, setCryptoAmount] = useState('')

  useEffect(() => {
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

    try {
      const chFiat = supabase
        .channel('public:wallets_fiat')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets_fiat', filter: `user_id=eq.${userId}` }, () => {
          loadWallets()
        })
        .subscribe()
      channels.push(chFiat)
    } catch (e) {
      console.warn('Failed to subscribe to wallets_fiat realtime:', e)
    }

    try {
      const chCrypto = supabase
        .channel('public:wallets_crypto')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets_crypto', filter: `user_id=eq.${userId}` }, () => {
          loadWallets()
        })
        .subscribe()
      channels.push(chCrypto)
    } catch (e) {
      console.warn('Failed to subscribe to wallets_crypto realtime:', e)
    }

    try {
      const chHouse = supabase
        .channel('public:wallets_house')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets_house' }, () => {
          loadWallets()
        })
        .subscribe()
      channels.push(chHouse)
    } catch (e) {
      console.warn('Failed to subscribe to wallets_house realtime:', e)
    }

    return () => {
      try {
        channels.forEach(c => c && c.unsubscribe && c.unsubscribe())
      } catch (e) {}
    }
  }, [userId])

  const loadPreferences = () => {
    const prefs = preferencesManager.getAllPreferences(userId)

    // Legacy key 'walletCurrencies' controls internal (public.wallets)
    if (prefs.walletCurrencies) setEnabledInternal(prefs.walletCurrencies)

    // New independent keys for fiat & crypto
    if (prefs.walletCurrencies_fiat) setEnabledFiat(prefs.walletCurrencies_fiat)
    if (prefs.walletCurrencies_crypto) setEnabledCrypto(prefs.walletCurrencies_crypto)

    // Defaults when not set
    if (!prefs.walletCurrencies) setEnabledInternal(['PHP', 'USD'])
    if (!prefs.walletCurrencies_fiat) setEnabledFiat(['PHP', 'USD'])
    if (!prefs.walletCurrencies_crypto) setEnabledCrypto(['BTC', 'ETH'])
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
    } else if (type === 'crypto') {
      prefs.walletCurrencies_crypto = currencies
      preferencesManager.setPreferences(userId, prefs)
      setEnabledCrypto(currencies)
    }
  }

  const loadWallets = async () => {
    try {
      if (!userId || userId.includes('guest-local') || userId === 'null' || userId === 'undefined') {
        setWallets([])
        setEnabledInternal(['PHP', 'USD'])
        setEnabledFiat(['PHP', 'USD'])
        setEnabledCrypto(['BTC', 'ETH'])
        setLoading(false)
        return
      }

      // Fetch internal (legacy) wallets and ensure each has an account number
      let internal = []
      try {
        const walletsWithAcct = await wisegcashAPI.ensureWalletsHaveAccountNumbers(userId)
        internal = walletsWithAcct || []
      } catch (err) {
        console.warn('Could not ensure account numbers for wallets:', err)
        const data = await wisegcashAPI.getWallets(userId)
        internal = data || []
      }
      setInternalWallets(internal)

      // Fetch additional fiat and crypto wallets from Supabase (new tables)
      let fiatMapped = []
      let cryptoMapped = []
      try {
        const { data: fData } = await supabase.from('wallets_fiat').select('*').eq('user_id', userId)
        fiatMapped = (fData || []).map(r => ({
          id: r.id,
          currency_code: r.currency,
          balance: Number(r.balance || 0),
          account_number: r.provider_account_id || null,
          provider: r.provider,
          source: 'fiat'
        }))
        setFiatWallets(fiatMapped)
      } catch (e) {
        console.warn('Error loading wallets_fiat from Supabase:', e)
      }

      try {
        const { data: cData } = await supabase.from('wallets_crypto').select('*').eq('user_id', userId)
        cryptoMapped = (cData || []).map(r => ({
          id: r.id,
          currency_code: r.chain || r.currency || 'CRYPTO',
          balance: Number(r.balance || 0),
          address: r.address,
          provider: r.provider,
          source: 'crypto'
        }))
        setCryptoWallets(cryptoMapped)
      } catch (e) {
        console.warn('Error loading wallets_crypto from Supabase:', e)
      }

      const combined = [...internal, ...fiatMapped, ...cryptoMapped]
      setWallets(combined)
      setError('')

      // Auto-populate preferences based on existing wallets if not set
      const prefs = preferencesManager.getAllPreferences(userId)
      if (!prefs.walletCurrencies && internal.length > 0) savePreferences('internal', internal.map(w => w.currency_code))
      if (!prefs.walletCurrencies_fiat && fiatMapped.length > 0) savePreferences('fiat', fiatMapped.map(w => w.currency_code))
      if (!prefs.walletCurrencies_crypto && cryptoMapped.length > 0) savePreferences('crypto', cryptoMapped.map(w => w.currency_code))

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

      if (!userId || userId === 'null' || userId === 'undefined' || userId.includes('guest-local')) {
        setError('Please sign in to create wallets')
        return
      }

      await wisegcashAPI.createWallet(userId, currency)
      await new Promise(resolve => setTimeout(resolve, 500))
      await loadWallets()
      setShowPreferencesInternal(false)
      setSuccess(`${currency} wallet created`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error(`Wallet creation error for ${currency}:`, err)
      const errorMsg = err?.message || String(err) || 'Unknown error'
      setError(`Failed to create ${currency} wallet: ${errorMsg}`)
      setTimeout(() => setError(''), 5000)
    }
  }


  // Fiat helpers
  const changeFiatBalance = async (walletId, delta) => {
    const w = fiatWallets.find(f => f.id === walletId)
    if (!w) return
    const newBalance = Math.max(0, Number(w.balance || 0) + delta)
    const { error: updErr } = await supabase
      .from('wallets_fiat')
      .update({ balance: newBalance, updated_at: new Date() })
      .eq('id', walletId)
    if (updErr) throw updErr
  }

  const handleFiatSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const amt = parseFloat(fiatAmount)
    if (!selectedFiatWallet || !amt || amt <= 0) {
      setError('Enter a valid amount')
      return
    }
    try {
      const delta = fiatAction === 'deposit' ? amt : -amt
      await changeFiatBalance(selectedFiatWallet.id, delta)
      setSuccess(`${fiatAction === 'deposit' ? 'Deposited' : 'Paid'} ${amt} ${selectedFiatWallet.currency_code}`)
      setFiatAmount('')
      setShowFiatModal(false)
      loadWallets()
    } catch (e) {
      setError(e.message || 'Failed to update fiat wallet')
    }
  }

  // Crypto helpers
  const changeCryptoBalance = async (walletId, delta) => {
    const w = cryptoWallets.find(c => c.id === walletId)
    if (!w) return
    const newBalance = Math.max(0, Number(w.balance || 0) + delta)
    const { error: updErr } = await supabase
      .from('wallets_crypto')
      .update({ balance: newBalance, updated_at: new Date() })
      .eq('id', walletId)
    if (updErr) throw updErr
  }

  const handleCryptoSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const amt = parseFloat(cryptoAmount)
    if (!selectedCryptoWallet || !amt || amt <= 0) {
      setError('Enter a valid amount')
      return
    }
    try {
      const delta = cryptoAction === 'receive' ? amt : -amt
      await changeCryptoBalance(selectedCryptoWallet.id, delta)
      setSuccess(`${cryptoAction === 'receive' ? 'Received' : 'Sent'} ${amt} ${selectedCryptoWallet.currency_code}`)
      setCryptoAmount('')
      setShowCryptoModal(false)
      loadWallets()
    } catch (e) {
      setError(e.message || 'Failed to update crypto wallet')
    }
  }

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
            onClick={() => setShowPreferencesInternal(true)}
            className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
          >
            ⚙️ Customize
          </button>
        </div>
      </div>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">{success}</div>}

      {/* Internal Wallets row (public.wallets) */}
      <div className="mb-6">
        <h3 className="text-xl font-light mb-3">Internal Wallets</h3>
        {internalWallets.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
            <p className="text-slate-500 mb-4">No internal wallets created yet</p>
            <button
              onClick={() => setShowPreferencesInternal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
            >
              Create Your First Wallet
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {internalWallets.filter(w => enabledCurrencies.includes(w.currency_code)).map(wallet => (
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
      </div>

      {/* Fiat wallets from wallets_fiat */}
      {fiatWallets.filter(w => enabledCurrencies.includes(w.currency_code)).length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-light mb-3">Fiat Wallets</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fiatWallets.filter(w => enabledCurrencies.includes(w.currency_code)).map(w => (
              <div key={w.id} className="bg-white border border-slate-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-600 font-medium uppercase tracking-wider">{w.currency_code}</p>
                  <p className="text-sm text-slate-500">{w.provider}</p>
                </div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Balance</p>
                <p className="text-2xl font-light text-slate-900 mb-2">{Number(w.balance || 0).toFixed(2)}</p>
                {w.account_number && <p className="text-xs text-slate-500 mb-4">Acct: {w.account_number}</p>}
                <button
                  onClick={() => { setSelectedFiatWallet(w); setFiatAction('deposit'); setFiatAmount(''); setShowFiatModal(true) }}
                  className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                  Deposit / Pay
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crypto wallets from wallets_crypto */}
      {cryptoWallets.filter(w => enabledCurrencies.includes(w.currency_code)).length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-light mb-3">Crypto Wallets</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cryptoWallets.filter(w => enabledCurrencies.includes(w.currency_code)).map(w => (
              <div key={w.id} className="bg-white border border-slate-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-600 font-medium uppercase tracking-wider">{w.currency_code}</p>
                  <p className="text-sm text-slate-500">{w.provider || w.chain}</p>
                </div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Balance</p>
                <p className="text-2xl font-light text-slate-900 mb-2">{Number(w.balance || 0).toFixed(6)}</p>
                {w.address && <p className="text-xs text-slate-500 mb-4 truncate">Addr: {w.address}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelectedCryptoWallet(w); setCryptoAction('send'); setCryptoAmount(''); setShowCryptoModal(true) }}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    Send
                  </button>
                  <button
                    onClick={() => { setSelectedCryptoWallet(w); setCryptoAction('receive'); setCryptoAmount(''); setShowCryptoModal(true) }}
                    className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                  >
                    Receive
                  </button>
                </div>
              </div>
            ))}
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

      {/* Fiat Modal */}
      {showFiatModal && selectedFiatWallet && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-light text-slate-900 mb-6">{fiatAction === 'deposit' ? 'Deposit' : 'Pay'} ({selectedFiatWallet.currency_code})</h3>
            <form onSubmit={handleFiatSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={fiatAmount}
                  onChange={e => setFiatAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-lg"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-600">Action</label>
                <select value={fiatAction} onChange={e => setFiatAction(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="deposit">Deposit</option>
                  <option value="pay">Pay</option>
                </select>
              </div>
              <div className="flex space-x-4">
                <button type="button" onClick={() => setShowFiatModal(false)} className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Crypto Modal */}
      {showCryptoModal && selectedCryptoWallet && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-light text-slate-900 mb-6">{cryptoAction === 'receive' ? 'Receive' : 'Send'} ({selectedCryptoWallet.currency_code})</h3>
            <form onSubmit={handleCryptoSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Amount</label>
                <input
                  type="number"
                  step="0.000001"
                  value={cryptoAmount}
                  onChange={e => setCryptoAmount(e.target.value)}
                  placeholder="0.000000"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-lg"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-600">Action</label>
                <select value={cryptoAction} onChange={e => setCryptoAction(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="send">Send</option>
                  <option value="receive">Receive</option>
                </select>
              </div>
              <div className="flex space-x-4">
                <button type="button" onClick={() => setShowCryptoModal(false)} className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
