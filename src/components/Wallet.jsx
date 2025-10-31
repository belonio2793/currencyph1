import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { wisegcashAPI } from '../lib/payments'
import { preferencesManager } from '../lib/preferencesManager'
import { formatNumber } from '../lib/currency'
import { connectWallet, getWalletInfo, SUPPORTED_CHAINS, CHAIN_IDS, formatWalletAddress, sendCryptoTransaction } from '../lib/thirdwebClient'

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
  const [favoriteCrypto, setFavoriteCrypto] = useState([])
  const [filterMode, setFilterMode] = useState('all') // all | favorites | owned

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
  const [recipientAddress, setRecipientAddress] = useState('')
  const [sendingCrypto, setSendingCrypto] = useState(false)

  // Thirdweb integration state
  const [connectedWallet, setConnectedWallet] = useState(null)
  const [selectedChainId, setSelectedChainId] = useState(null)
  const [showThirdwebModal, setShowThirdwebModal] = useState(false)
  const [thirdwebConnecting, setThirdwebConnecting] = useState(false)

  // Manual wallet creation state
  const [showCreateManualWalletModal, setShowCreateManualWalletModal] = useState(false)
  const [selectedManualChainId, setSelectedManualChainId] = useState(null)
  const [creatingManualWallet, setCreatingManualWallet] = useState(false)

  // Network wallets (house) UI state
  const [showNetworkPanel, setShowNetworkPanel] = useState(false)
  const [networkWallets, setNetworkWallets] = useState([])
  const [generatingNetwork, setGeneratingNetwork] = useState(false)
  const [networkProgress, setNetworkProgress] = useState({ done: 0, total: 0 })

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

    // Favorites for crypto
    if (prefs.walletFavorites_crypto) setFavoriteCrypto(prefs.walletFavorites_crypto)

    // Defaults when not set
    if (!prefs.walletCurrencies) setEnabledInternal(['PHP', 'USD'])
    if (!prefs.walletCurrencies_fiat) setEnabledFiat(['PHP', 'USD'])
    if (!prefs.walletCurrencies_crypto) setEnabledCrypto(['BTC', 'ETH'])
    if (!prefs.walletFavorites_crypto) setFavoriteCrypto([])
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

  const saveFavoriteCrypto = (favorites) => {
    const prefs = preferencesManager.getAllPreferences(userId)
    prefs.walletFavorites_crypto = favorites
    preferencesManager.setPreferences(userId, prefs)
    setFavoriteCrypto(favorites)
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
          chain_id: r.chain_id || null,
          balance: Number(r.balance || 0),
          address: r.address,
          provider: r.provider,
          chain: r.chain,
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

  // ============ Network Wallets (house) helpers ============
  const loadNetworkWallets = async () => {
    try {
      const { data, error } = await supabase.from('wallets_house').select('*')
      if (error) throw error
      setNetworkWallets(data || [])
    } catch (e) {
      console.warn('Failed loading network wallets:', e)
      setNetworkWallets([])
    }
  }

  const generateNetworkWalletForChain = async (chain) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-wallet-pairs', {
        body: {
          chain_id: chain.chainId,
          create_house: true
        }
      })
      if (error) throw error
      return data
    } catch (e) {
      console.error('Failed creating network wallet for', chain.name, e)
      return null
    }
  }

  const generateAllNetworkWallets = async () => {
    try {
      setGeneratingNetwork(true)
      const chains = Object.values(SUPPORTED_CHAINS)
      setNetworkProgress({ done: 0, total: chains.length })
      await loadNetworkWallets()
      for (let i = 0; i < chains.length; i++) {
        const chain = chains[i]
        // skip if already present
        const exists = networkWallets.some(nw => nw.network && nw.network.toLowerCase() === chain.name.toLowerCase())
        if (!exists) {
          await generateNetworkWalletForChain(chain)
        }
        setNetworkProgress(prev => ({ ...prev, done: prev.done + 1 }))
      }
      await loadNetworkWallets()
      setGeneratingNetwork(false)
    } catch (e) {
      console.error('generateAllNetworkWallets error:', e)
      setGeneratingNetwork(false)
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

  // Thirdweb wallet functions
  const handleConnectWallet = async () => {
    try {
      setThirdwebConnecting(true)
      setError('')
      const wallet = await connectWallet()
      const walletInfo = await getWalletInfo(wallet)
      setConnectedWallet(walletInfo)
      setSelectedChainId(walletInfo.chainId)
      setSuccess(`Connected to ${walletInfo.chainName}`)
    } catch (err) {
      console.error('Error connecting wallet:', err)
      setError('Failed to connect wallet. Make sure you have a Web3 wallet extension (MetaMask, WalletConnect, etc.)')
    } finally {
      setThirdwebConnecting(false)
    }
  }

  const handleSaveConnectedWallet = async () => {
    if (!connectedWallet || !selectedChainId) {
      setError('Please connect a wallet and select a chain')
      return
    }

    try {
      setThirdwebConnecting(true)
      setError('')

      if (!userId || userId === 'null' || userId === 'undefined' || userId.includes('guest-local')) {
        setError('Please sign in to save wallet connection')
        return
      }

      // Upsert to wallets_crypto table
      const { error: upsertErr } = await supabase
        .from('wallets_crypto')
        .upsert([{
          user_id: userId,
          chain: (CHAIN_IDS[selectedChainId]?.name || connectedWallet.chainName || '').toUpperCase(),
          chain_id: selectedChainId,
          address: connectedWallet.address,
          provider: 'thirdweb',
          balance: 0,
          metadata: {
            chainName: connectedWallet.chainName,
            chainSymbol: connectedWallet.chainSymbol,
            connected_at: new Date().toISOString()
          }
        }], {
          onConflict: 'user_id,chain,address'
        })

      if (upsertErr) throw upsertErr

      setSuccess(`Wallet connected and saved (${formatWalletAddress(connectedWallet.address)})`)
      setShowThirdwebModal(false)
      setConnectedWallet(null)
      setSelectedChainId(null)
      await loadWallets()
    } catch (err) {
      console.error('Error saving wallet:', err)
      setError(err.message || 'Failed to save wallet connection')
    } finally {
      setThirdwebConnecting(false)
    }
  }

  const disconnectWallet = async () => {
    setConnectedWallet(null)
    setSelectedChainId(null)
    setSuccess('Wallet disconnected')
  }

  const handleCreateManualWallet = async () => {
    if (!selectedManualChainId) {
      setError('Please select a blockchain')
      return
    }

    if (!userId || userId === 'null' || userId === 'undefined' || userId.includes('guest-local')) {
      setError('Please sign in to create a wallet')
      return
    }

    try {
      setCreatingManualWallet(true)
      setError('')

      // Call edge function to create wallet
      const { data, error: invokeError } = await supabase.functions.invoke('create-wallet-pairs', {
        body: {
          user_id: userId,
          chain_id: selectedManualChainId
        }
      })

      if (invokeError) throw invokeError
      if (!data || !data.ok) throw new Error(data?.error || 'Failed to create wallet')

      setSuccess(`Wallet created on ${data.wallet.chainName} (${formatWalletAddress(data.wallet.address)})`)
      setShowCreateManualWalletModal(false)
      setSelectedManualChainId(null)
      await loadWallets()
    } catch (err) {
      console.error('Error creating wallet:', err)
      setError(err.message || 'Failed to create wallet')
    } finally {
      setCreatingManualWallet(false)
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
            Customize
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
            {internalWallets.filter(w => enabledInternal.includes(w.currency_code)).map(wallet => (
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
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-light">Fiat Wallets</h3>
          <button onClick={() => setShowPreferencesFiat(true)} className="text-sm px-3 py-1 bg-slate-100 rounded">Customize</button>
        </div>

        {fiatWallets.filter(w => enabledFiat.includes(w.currency_code)).length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
            <p className="text-slate-500 mb-4">No fiat wallets created yet</p>
            <button
              onClick={async () => {
                try {
                  setError('')
                  setSuccess('')
                  // create a default fiat wallet (PHP)
                  await supabase.from('wallets_fiat').insert([{
                    user_id: userId,
                    currency: 'PHP',
                    balance: 0,
                    provider: 'manual',
                    provider_account_id: null
                  }])
                  setSuccess('Fiat wallet created')
                  await loadWallets()
                } catch (e) {
                  console.error('Failed to create fiat wallet', e)
                  setError('Failed to create fiat wallet')
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
            >
              Create Fiat Wallet
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fiatWallets.filter(w => enabledFiat.includes(w.currency_code)).map(w => (
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
        )}
      </div>

      {/* Crypto wallets from wallets_crypto - searchable full chain list */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xl font-light">Crypto Wallets</h3>
            <p className="text-xs text-slate-500 mt-1">Manage your on-chain wallets. Connect a Web3 wallet or create a manual wallet for any supported chain.</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-3 items-center">
          <button
            onClick={() => setShowThirdwebModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
          >
            Connect Web3 Wallet
          </button>
          <button
            onClick={() => setShowCreateManualWalletModal(true)}
            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium text-sm"
          >
            Create Manual Wallet
          </button>
          <div
            role="tab"
            onClick={() => {
              setShowNetworkPanel(prev => {
                const next = !prev
                if (next) loadNetworkWallets()
                return next
              })
            }}
            className="px-4 py-2 text-sm font-medium rounded-lg cursor-pointer text-slate-700/70 hover:text-slate-900/90 bg-transparent border border-transparent hover:bg-white/5 transition-colors"
            aria-selected={showNetworkPanel}
          >
            Network Balances
          </div>

          <div className="ml-auto flex items-center gap-2">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chains (e.g. bitcoin, eth, polygon)"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-80 md:w-96 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select value={filterMode} onChange={(e) => setFilterMode(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
              <option value="all">All</option>
              <option value="favorites">Favorites</option>
              <option value="owned">Owned</option>
            </select>
          </div>
        </div>

        {/* Favorites row */}
        {favoriteCrypto && favoriteCrypto.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-slate-700 mb-2">Favorites</h4>
            <div className="flex flex-wrap gap-2">
              {favoriteCrypto.map(fav => {
                const chain = Object.values(SUPPORTED_CHAINS).find(c => c.chainId === Number(fav) || c.name.toLowerCase() === String(fav).toLowerCase())
                if (!chain) return null
                const existing = cryptoWallets.find(w => Number(w.chain_id) === Number(chain.chainId))
                return (
                  <div key={chain.chainId} className="px-3 py-2 bg-white/80 border border-slate-200 rounded-lg text-sm flex items-center gap-3">
                    <div className="font-semibold">{chain.symbol}</div>
                    <div className="text-xs text-slate-500">{chain.name}</div>
                    {existing && <div className="text-xs text-slate-400 ml-2">• {Number(existing.balance || 0).toFixed(6)}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Network Wallets Panel */}
        {showNetworkPanel && (
          <div className="mb-4 p-4 bg-gradient-to-r from-white/40 to-white/10 backdrop-blur-sm border border-slate-100/30 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-lg font-semibold text-slate-800">Network Balances</h4>
                <p className="text-xs text-slate-500">Platform house/network balances per chain (read from wallets_house). Public addresses, IDs and balances are shown below.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { loadNetworkWallets() }} className="px-3 py-2 bg-slate-100 rounded">Refresh</button>
                <button onClick={() => setShowNetworkPanel(false)} className="px-3 py-2 bg-white border rounded">Close</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {networkWallets && networkWallets.length > 0 ? networkWallets.map((nw) => (
                <div key={nw.id || nw.network} className="p-3 bg-white border border-slate-100 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">{nw.network || nw.currency}</div>
                      <div className="text-xs text-slate-500">{nw.currency}</div>
                    </div>
                    <div className="text-sm font-mono text-slate-600">{Number(nw.balance || 0).toFixed(6)}</div>
                  </div>
                  <div className="mt-2 text-xs text-slate-500 break-all">Address: {nw.metadata?.address || nw.address || '—'}</div>
                  {nw?.metadata?.public_key && (
                    <div className="mt-1 text-xs text-slate-500 break-all">Public Key: {nw.metadata.public_key}</div>
                  )}
                  <div className="mt-2 text-xs text-slate-400">Wallet ID: <span className="font-mono">{nw.id}</span></div>
                  {nw.updated_at && <div className="text-xs text-slate-400">Updated: {new Date(nw.updated_at).toLocaleString()}</div> }
                </div>
              )) : (
                <div className="p-4 text-sm text-slate-500">No network wallets found. Click "Generate All" to create house wallets for all supported chains.</div>
              )}
            </div>
          </div>
        )}

        {/* List of supported chains with search/filter in vertical list style */}
        <div className="bg-white/80 border border-slate-200 rounded-lg">
          {Object.values(SUPPORTED_CHAINS)
            .sort((a,b) => a.name.localeCompare(b.name))
            .filter(chain => {
              const q = (searchQuery || '').toLowerCase()
              if (q) {
                if (!(chain.name.toLowerCase().includes(q) || (chain.symbol || '').toLowerCase().includes(q) || String(chain.chainId).includes(q))) return false
              }
              if (filterMode === 'favorites') {
                return favoriteCrypto.includes(String(chain.chainId)) || favoriteCrypto.map(String).includes(chain.name.toLowerCase())
              }
              if (filterMode === 'owned') {
                return cryptoWallets.some(w => Number(w.chain_id) === Number(chain.chainId) || (w.chain && w.chain.toLowerCase() === chain.name.toLowerCase()))
              }
              return true
            })
            .map((chain, idx) => {
              const existing = cryptoWallets.find(w => Number(w.chain_id) === Number(chain.chainId) || (w.chain && w.chain.toLowerCase() === chain.name.toLowerCase()))
              const isFav = favoriteCrypto.includes(String(chain.chainId)) || favoriteCrypto.map(String).includes(chain.name.toLowerCase())
              return (
                <div key={chain.chainId} className={`flex items-center justify-between p-4 ${idx < Object.values(SUPPORTED_CHAINS).length-1 ? 'border-b border-slate-200' : ''}`}>
                  <div className="flex items-center gap-4">
                    <button onClick={() => {
                      const idStr = String(chain.chainId)
                      if (favoriteCrypto.includes(idStr) || favoriteCrypto.map(String).includes(chain.name.toLowerCase())) {
                        const newFav = favoriteCrypto.filter(f => String(f) !== idStr && String(f).toLowerCase() !== chain.name.toLowerCase())
                        saveFavoriteCrypto(newFav)
                      } else {
                        const newFav = [ ...favoriteCrypto, idStr ]
                        saveFavoriteCrypto(newFav)
                      }
                    }} className={`p-2 rounded ${isFav ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-600'} transition-colors`}>
                      {isFav ? '★' : '☆'}
                    </button>

                    <div>
                      <div className="text-sm font-semibold text-slate-700">{chain.name}</div>
                      <div className="text-xs text-slate-500">{chain.symbol} • Chain ID: {chain.chainId}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {existing ? (
                      <>
                        <div className="text-sm text-slate-700 font-mono mr-4">{Number(existing.balance || 0).toFixed(6)}</div>
                        <button onClick={() => { setSelectedCryptoWallet(existing); setCryptoAction('send'); setCryptoAmount(''); setShowCryptoModal(true) }} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">Send</button>
                        <button onClick={() => { setSelectedCryptoWallet(existing); setCryptoAction('receive'); setCryptoAmount(''); setShowCryptoModal(true) }} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm">Receive</button>
                      </>
                    ) : (
                      <button onClick={() => { setSelectedManualChainId(chain.chainId); setShowCreateManualWalletModal(true) }} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm">Create Wallet</button>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      </div>


      {/* Thirdweb Connect Wallet Modal */}
      {showThirdwebModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-semibold text-slate-900">Web3 Wallet Connection</h3>
              <button onClick={() => setShowThirdwebModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-light">×</button>
            </div>

            {!connectedWallet ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600 mb-6">Connect your Web3 wallet to manage cryptocurrency directly on-chain. Your assets remain under your control.</p>
                <button
                  onClick={handleConnectWallet}
                  disabled={thirdwebConnecting}
                  className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {thirdwebConnecting ? 'Connecting to wallet...' : 'Connect Wallet'}
                </button>
                <p className="text-xs text-slate-500 text-center mt-4">Compatible with: MetaMask • WalletConnect • Rainbow • Coinbase Wallet</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-slate-900 rounded-lg p-4 space-y-2 font-mono">
                  <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Wallet Address</p>
                  <p className="text-sm text-amber-400 break-all">{connectedWallet.address}</p>
                  <p className="text-xs text-slate-500 mt-2">{formatWalletAddress(connectedWallet.address)}</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Target Blockchain</label>
                  <select
                    value={selectedChainId || ''}
                    onChange={(e) => setSelectedChainId(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Select blockchain...</option>
                    {Object.values(SUPPORTED_CHAINS).map((chain) => (
                      <option key={chain.chainId} value={chain.chainId}>
                        {chain.name} ({chain.symbol}) • Chain ID: {chain.chainId}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-600">
                    <strong>Current Network:</strong> {connectedWallet.chainName} ({connectedWallet.chainSymbol})
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={disconnectWallet}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors text-sm font-medium"
                  >
                    Disconnect
                  </button>
                  <button
                    onClick={handleSaveConnectedWallet}
                    disabled={thirdwebConnecting || !selectedChainId}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {thirdwebConnecting ? 'Saving...' : 'Save Connection'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Manual Wallet Modal */}
      {showCreateManualWalletModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-semibold text-slate-900">Create Blockchain Wallet</h3>
              <button onClick={() => setShowCreateManualWalletModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-light">×</button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-slate-600">Select the blockchain network where you want to create a new wallet.</p>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Blockchain Network</label>
                <select
                  value={selectedManualChainId || ''}
                  onChange={(e) => setSelectedManualChainId(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Select blockchain...</option>
                  {(() => {
                    const all = Object.values(SUPPORTED_CHAINS)
                    const btc = all.find(c => (c.symbol && c.symbol.toLowerCase() === 'btc') || (c.name && c.name.toLowerCase() === 'bitcoin'))
                    const others = all.filter(c => c !== btc).sort((a, b) => a.name.localeCompare(b.name))
                    const ordered = btc ? [btc, ...others] : others
                    return ordered.map((chain) => (
                      <option key={chain.chainId} value={chain.chainId}>
                        {chain.name} ({chain.symbol})
                      </option>
                    ))
                  })()}
                </select>
              </div>

              {selectedManualChainId && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-600">
                    <strong>Network:</strong> {SUPPORTED_CHAINS[Object.keys(SUPPORTED_CHAINS).find(k => SUPPORTED_CHAINS[k].chainId === selectedManualChainId)]?.name.toUpperCase() || 'Unknown'}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setShowCreateManualWalletModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateManualWallet}
                  disabled={creatingManualWallet || !selectedManualChainId}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingManualWallet ? 'Creating...' : 'Create Wallet'}
                </button>
              </div>
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
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-semibold text-slate-900">{cryptoAction === 'receive' ? 'Receive' : 'Send'}</h3>
              <button onClick={() => { setShowCryptoModal(false); setRecipientAddress(''); setCryptoAmount('') }} className="text-slate-400 hover:text-slate-600 text-2xl font-light">×</button>
            </div>

            {/* Wallet Info */}
            <div className="bg-slate-900 rounded-lg p-4 mb-6 space-y-2 font-mono">
              <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Wallet Address</p>
              <p className="text-sm text-amber-400 break-all">{selectedCryptoWallet.address}</p>
              <p className="text-xs text-slate-500 mt-2">Chain: {selectedCryptoWallet.chain} | Balance: {Number(selectedCryptoWallet.balance || 0).toFixed(6)}</p>
            </div>

            <form onSubmit={handleCryptoSubmit} className="space-y-4">
              {cryptoAction === 'send' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Recipient Address</label>
                    <input
                      type="text"
                      value={recipientAddress}
                      onChange={e => setRecipientAddress(e.target.value)}
                      placeholder="0x... or recipient address"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-mono"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Amount ({selectedCryptoWallet.chain})</label>
                <input
                  type="number"
                  step="0.000001"
                  value={cryptoAmount}
                  onChange={e => setCryptoAmount(e.target.value)}
                  placeholder="0.000000"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg"
                />
              </div>

              {cryptoAction === 'receive' && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <p className="text-xs text-indigo-700">
                    <strong>Your receive address:</strong><br/>
                    <span className="font-mono break-all">{selectedCryptoWallet.address}</span>
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowCryptoModal(false); setRecipientAddress(''); setCryptoAmount('') }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingCrypto || !cryptoAmount}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingCrypto ? 'Processing...' : cryptoAction === 'send' ? 'Send' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
