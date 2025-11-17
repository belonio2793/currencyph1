import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { currencyAPI } from '../lib/payments'
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
  'MYR': 'RM', 'THB': 'THB', 'VND': '₫', 'KRW': '���', 'ZAR': 'R',
  'BRL': 'R$', 'MXN': '$', 'NOK': 'kr', 'DKK': 'kr', 'AED': '��.إ',
  'BTC': 'BTC', 'ETH': 'ETH', 'XRP': 'XRP', 'ADA': 'ADA', 'SOL': 'SOL',
  'DOGE': 'DOGE', 'MATIC': 'MATIC', 'LINK': 'LINK', 'LTC': 'LTC', 'BCH': 'BCH',
  'USDT': 'USDT', 'USDC': 'USDC', 'BUSD': 'BUSD', 'SHIB': 'SHIB',
  'AVAX': 'AVAX', 'DOT': 'DOT'
}

export default function Wallet({ userId, totalBalancePHP = 0, globalCurrency = 'PHP' }) {
  const [wallets, setWallets] = useState([])
  const [internalWallets, setInternalWallets] = useState([])
  const [fiatWallets, setFiatWallets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddFunds, setShowAddFunds] = useState(false)

  // Preference states (separate for each table)
  const [enabledInternal, setEnabledInternal] = useState([])
  const [enabledFiat, setEnabledFiat] = useState([])

  // Which preference modal is shown
  const [showPreferencesInternal, setShowPreferencesInternal] = useState(false)
  const [showPreferencesFiat, setShowPreferencesFiat] = useState(false)

  const [selectedWallet, setSelectedWallet] = useState(null)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState('all') // all | favorites | owned
  const [showConnectedMenu, setShowConnectedMenu] = useState(false)

  // Fiat modal state
  const [showFiatModal, setShowFiatModal] = useState(false)

  const fmtErr = (e) => {
    if (!e) return ''
    if (typeof e === 'string') return e
    if (e instanceof Error && e.message) return e.message
    if (e && typeof e === 'object') {
      if (e.message) return e.message
      if (e.error) return typeof e.error === 'string' ? e.error : (e.error.message || JSON.stringify(e.error))
      try { return JSON.stringify(e) } catch (ex) { return String(e) }
    }
    return String(e)
  }
  const [selectedFiatWallet, setSelectedFiatWallet] = useState(null)
  const [fiatAction, setFiatAction] = useState('deposit') // 'deposit' | 'pay'
  const [fiatAmount, setFiatAmount] = useState('')



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

    // New independent keys for fiat
    if (prefs.walletCurrencies_fiat) setEnabledFiat(prefs.walletCurrencies_fiat)

    // Defaults when not set
    if (!prefs.walletCurrencies) setEnabledInternal(['PHP', 'USD'])
    if (!prefs.walletCurrencies_fiat) setEnabledFiat(['PHP', 'USD'])
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
        setEnabledInternal(['PHP', 'USD'])
        setEnabledFiat(['PHP', 'USD'])
        setEnabledCrypto(['BTC', 'ETH'])
        setLoading(false)
        return
      }

      // Fetch internal (legacy) wallets and ensure each has an account number
      let internal = []
      try {
        const walletsWithAcct = await currencyAPI.ensureWalletsHaveAccountNumbers(userId)
        internal = walletsWithAcct || []
      } catch (err) {
        console.warn('Could not ensure account numbers for wallets:', err)
        const data = await currencyAPI.getWallets(userId)
        internal = data || []
      }
      setInternalWallets(internal)

      // Fetch additional fiat wallets from Supabase (new tables)
      let fiatMapped = []
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

      const combined = [...internal, ...fiatMapped]
      setWallets(combined)
      setError('')

      // Auto-populate preferences based on existing wallets if not set
      const prefs = preferencesManager.getAllPreferences(userId)
      if (!prefs.walletCurrencies && internal.length > 0) savePreferences('internal', internal.map(w => w.currency_code))
      if (!prefs.walletCurrencies_fiat && fiatMapped.length > 0) savePreferences('fiat', fiatMapped.map(w => w.currency_code))

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
      await currencyAPI.addFunds(userId, selectedWallet.currency_code, parseFloat(amount))
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

      await currencyAPI.createWallet(userId, currency)
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
          <p className="text-xs text-slate-500 mt-1">Total value ({globalCurrency}): <span className="font-mono text-sm">{formatNumber(totalBalancePHP)}</span></p>
        </div>

      </div>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">{success}</div>}

      {/* Fiat wallets from wallets_fiat */}
      <div className="mb-6">

        {fiatWallets.filter(w => enabledFiat.includes(w.currency_code)).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fiatWallets.filter(w => enabledFiat.includes(w.currency_code)).map(w => {
              const balanceInGlobalCurrency = convertBalance(w.balance, w.currency_code)
              const isSameCurrency = w.currency_code === globalCurrency
              return (
                <div key={w.id} className="bg-white border border-slate-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-slate-600 font-medium uppercase tracking-wider">FIAT</p>
                  </div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Balance ({globalCurrency})</p>
                  <p className="text-2xl font-light text-slate-900 mb-2">{formatNumber(balanceInGlobalCurrency)}</p>
                  {!isSameCurrency && Number(w.balance || 0) !== 0 && (
                    <p className="text-xs text-slate-400 mb-4">({formatNumber(Number(w.balance || 0))} {w.currency_code})</p>
                  )}
                  {w.account_number && <p className="text-xs text-slate-500 mb-4">Acct: {w.account_number}</p>}
                  <button
                    onClick={() => { setSelectedFiatWallet(w); setFiatAction('deposit'); setFiatAmount(''); setShowFiatModal(true) }}
                    className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    Deposit / Pay
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Internal Wallets row (public.wallets) */}
      <div className="mb-6">
        <h3 className="text-xl font-light mb-3">Wallets</h3>
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
            {internalWallets
              .filter(w => enabledInternal.includes(w.currency_code))
              .sort((a, b) => {
                const aIsFiat = FIAT_CURRENCIES.includes(a.currency_code)
                const bIsFiat = FIAT_CURRENCIES.includes(b.currency_code)
                if (aIsFiat === bIsFiat) return 0
                return aIsFiat ? -1 : 1
              })
              .map(wallet => {
                const balanceInGlobalCurrency = convertBalance(wallet.balance, wallet.currency_code)
                const isSameCurrency = wallet.currency_code === globalCurrency
                return (
                  <div key={wallet.id} className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-slate-600 font-medium uppercase tracking-wider">{CRYPTO_CURRENCIES.includes(wallet.currency_code) ? 'CRYPTOCURRENCY' : 'FIAT'}</p>
                    </div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Balance ({globalCurrency})</p>
                    <p className="text-3xl font-light text-slate-900 mb-2">{formatNumber(balanceInGlobalCurrency)}</p>
                    {!isSameCurrency && Number(wallet.balance || 0) !== 0 && (
                      <p className="text-xs text-slate-400 mb-2">({formatNumber(Number(wallet.balance || 0))} {wallet.currency_code})</p>
                    )}
                    {wallet.account_number && (
                      <p className="text-xs text-slate-500 mb-2">Acct: {wallet.account_number}</p>
                    )}
                    {wallet.tokens && wallet.tokens.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-slate-500 mb-1">Tokens</div>
                        <div className="flex flex-col gap-1 text-xs text-slate-600">
                          {wallet.tokens.slice(0,3).map(t => (
                            <div key={t.token_address} className="flex items-center justify-between">
                              <div className="truncate">{t.metadata?.symbol || t.token_address.slice(0,6)}</div>
                              <div className="font-mono">{formatNumber(Number(t.balance || 0))}</div>
                            </div>
                          ))}
                          {wallet.tokens.length > 3 && <div className="text-xs text-slate-400">+{wallet.tokens.length - 3} more</div>}
                        </div>
                      </div>
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
                )
              })}
          </div>
        )}
      </div>


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
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 border border-slate-200 shadow-xl">
            <h3 className="text-lg font-medium text-slate-900 mb-4">{fiatAction === 'deposit' ? 'Deposit' : 'Pay'} ({selectedFiatWallet.currency_code})</h3>
            <form onSubmit={handleFiatSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={fiatAmount}
                  onChange={e => setFiatAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-base"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-700">Action</label>
                <select value={fiatAction} onChange={e => setFiatAction(e.target.value)} className="px-2 py-1 border border-slate-300 rounded-lg text-xs">
                  <option value="deposit">Deposit</option>
                  <option value="pay">Pay</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowFiatModal(false)} className="flex-1 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-xs font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Crypto Modal */}
      {showCryptoModal && selectedCryptoWallet && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">{cryptoAction === 'receive' ? 'Receive Crypto' : 'Send Crypto'}</h3>
              <button onClick={() => { setShowCryptoModal(false); setRecipientAddress(''); setCryptoAmount('') }} className="text-slate-400 hover:text-slate-600 text-2xl font-light">×</button>
            </div>

            {/* Source Wallet Info */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">From Wallet</label>
              <div className="bg-slate-900 rounded-lg p-3 space-y-1 font-mono">
                <p className="text-sm text-amber-400 break-all">{selectedCryptoWallet.address}</p>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{selectedCryptoWallet.chain}</span>
                  <span className="text-amber-400 font-semibold">{Number(selectedCryptoWallet.balance || 0).toFixed(6)} {selectedCryptoWallet.chain}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleCryptoSubmit} className="space-y-3">
              {/* Amount Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Total Amount ({selectedCryptoWallet.chain})</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.000001"
                    min="0"
                    max={selectedCryptoWallet.balance || 0}
                    value={cryptoAmount}
                    onChange={e => setCryptoAmount(e.target.value)}
                    placeholder="0.000000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setCryptoAmount(String(selectedCryptoWallet.balance || 0))}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
                  >
                    Max
                  </button>
                </div>
              </div>

              {/* Recipient Address (for Send) */}
              {cryptoAction === 'send' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Recipient Address</label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={e => setRecipientAddress(e.target.value)}
                    placeholder="0x... or recipient address"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs font-mono"
                  />
                  <p className="text-xs text-slate-500 mt-1">Enter the wallet address where you want to send {selectedCryptoWallet.chain}</p>
                </div>
              )}

              {/* Receive Display (for Receive) */}
              {cryptoAction === 'receive' && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2">
                  <p className="text-xs font-semibold text-indigo-900 uppercase tracking-wide mb-1">Your Receive Address</p>
                  <p className="text-xs text-indigo-700 font-mono break-all mb-2 p-1 bg-white rounded border border-indigo-100">{selectedCryptoWallet.address}</p>
                  <p className="text-xs text-indigo-600">Share this address with the sender to receive {selectedCryptoWallet.chain}</p>
                </div>
              )}

              {/* Summary */}
              {cryptoAmount && parseFloat(cryptoAmount) > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Amount:</span>
                      <span className="font-semibold text-slate-900">{parseFloat(cryptoAmount).toFixed(6)} {selectedCryptoWallet.chain}</span>
                    </div>
                    {cryptoAction === 'send' && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">To:</span>
                        <span className="font-mono text-xs text-slate-700 text-right">{formatWalletAddress(recipientAddress)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Error message if amount exceeds balance */}
              {cryptoAmount && parseFloat(cryptoAmount) > (selectedCryptoWallet.balance || 0) && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-700">Insufficient balance. Available: {Number(selectedCryptoWallet.balance || 0).toFixed(6)} {selectedCryptoWallet.chain}</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowCryptoModal(false); setRecipientAddress(''); setCryptoAmount('') }}
                  className="flex-1 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingCrypto || !cryptoAmount || parseFloat(cryptoAmount) <= 0 || (cryptoAction === 'send' && !recipientAddress) || parseFloat(cryptoAmount) > (selectedCryptoWallet.balance || 0)}
                  className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingCrypto ? 'Processing...' : cryptoAction === 'send' ? 'Send' : 'Confirm Receive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
