import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { currencyAPI } from '../lib/payments'
import { walletService } from '../lib/walletService'
import { preferencesManager } from '../lib/preferencesManager'
import { formatNumber } from '../lib/currency'
import { fetchRatesMap, convertAmount } from '../lib/reconciliation'

export default function Wallet({ userId, totalBalancePHP = 0, globalCurrency = 'PHP' }) {
  const [wallets, setWallets] = useState([])
  const [internalWallets, setInternalWallets] = useState([])
  const [allCurrencies, setAllCurrencies] = useState([])
  const [currenciesGrouped, setCurrenciesGrouped] = useState({ fiat: [], crypto: [] })
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

  // View controls
  const [viewMode, setViewMode] = useState('list') // 'grid' or 'list'
  const [selectedCurrency, setSelectedCurrency] = useState(null)
  const [showFiatOnly, setShowFiatOnly] = useState(false)
  const [showCryptoOnly, setShowCryptoOnly] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false)

  // Filtered currencies for search
  const getFilteredCurrencies = () => {
    const query = searchInput.toLowerCase()

    if (!query) {
      return currenciesGrouped
    }

    return {
      fiat: currenciesGrouped.fiat.filter(c =>
        c.code.toLowerCase().includes(query) ||
        c.name.toLowerCase().includes(query)
      ),
      crypto: currenciesGrouped.crypto.filter(c =>
        c.code.toLowerCase().includes(query) ||
        c.name.toLowerCase().includes(query)
      )
    }
  }

  useEffect(() => {
    // Load currencies from database first
    const initializeCurrencies = async () => {
      try {
        const grouped = await walletService.getCurrenciesGrouped()
        setCurrenciesGrouped(grouped)

        const allCurrs = await walletService.getAllCurrencies()
        setAllCurrencies(allCurrs)
      } catch (err) {
        console.warn('Failed to load currencies:', err)
      }
    }

    initializeCurrencies()

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
      const allCurrencyCodes = allCurrencies.map(c => c.code)
      setEnabledInternal(allCurrencyCodes)
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
        const allCurrencyCodes = allCurrencies.map(c => c.code)
        setEnabledInternal(allCurrencyCodes)
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

      // Fetch all wallets with currency details
      let allWallets = []
      try {
        allWallets = await walletService.getUserWalletsWithDetails(userId)
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
        const allCodes = allWallets.map(w => w.currency_code)
        savePreferences('internal', allCodes)
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

  const handlePopulateDemoData = async () => {
    if (!userId || userId.includes('guest-local')) {
      setError('Demo data can only be added for registered users')
      return
    }

    setError('')
    setSuccess('')

    try {
      const demoBalances = {
        'PHP': 50000,
        'USD': 1000,
        'EUR': 500,
        'GBP': 400,
        'JPY': 100000,
        'BTC': 0.05,
        'ETH': 0.5,
        'XRP': 1000,
        'ADA': 500,
        'SOL': 10,
        'USDT': 5000,
        'USDC': 5000
      }

      let successCount = 0
      let failedCount = 0

      for (const [currency, amount] of Object.entries(demoBalances)) {
        try {
          await currencyAPI.addFunds(userId, currency, amount)
          successCount++
        } catch (err) {
          console.warn(`Failed to add ${currency}:`, err)
          failedCount++
        }
      }

      setSuccess(`✓ Added demo balances! ${successCount} currencies updated.`)
      if (failedCount > 0) {
        setSuccess(prev => `${prev} (${failedCount} failed)`)
      }

      setTimeout(() => loadWallets(), 500)
    } catch (err) {
      setError('Failed to populate demo data: ' + (err.message || 'Unknown error'))
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center text-slate-500">Loading wallets...</div>
      </div>
    )
  }

  // Separate wallets by type
  let fiatWalletsFiltered = internalWallets.filter(w => w.currency_type === 'fiat' && enabledInternal.includes(w.currency_code)).sort((a, b) => a.currency_code.localeCompare(b.currency_code))
  let cryptoWalletsFiltered = internalWallets.filter(w => w.currency_type === 'crypto' && enabledInternal.includes(w.currency_code)).sort((a, b) => a.currency_code.localeCompare(b.currency_code))

  // Build complete wallet list including placeholders for currencies without wallets
  const buildCompleteWalletList = () => {
    const walletMap = {}
    internalWallets.forEach(w => {
      walletMap[w.currency_code] = w
    })

    const completeList = []

    // Get all active currencies
    const currenciesToShow = selectedCurrency
      ? allCurrencies.filter(c => c.code === selectedCurrency)
      : allCurrencies.filter(c => enabledInternal.includes(c.code))

    // Filter by type
    let typedCurrencies = currenciesToShow
    if (showFiatOnly) {
      typedCurrencies = typedCurrencies.filter(c => c.type === 'fiat')
    } else if (showCryptoOnly) {
      typedCurrencies = typedCurrencies.filter(c => c.type === 'crypto')
    }

    // Build list with wallets or placeholders
    typedCurrencies.forEach(currency => {
      if (walletMap[currency.code]) {
        completeList.push(walletMap[currency.code])
      } else {
        // Create placeholder for missing wallet
        completeList.push({
          id: `placeholder-${currency.code}`,
          wallet_id: null,
          currency_code: currency.code,
          currency_name: currency.name,
          currency_type: currency.type,
          symbol: currency.symbol,
          decimals: currency.decimals,
          balance: 0,
          total_deposited: 0,
          total_withdrawn: 0,
          is_active: true,
          user_id: userId,
          is_placeholder: true
        })
      }
    })

    return completeList.sort((a, b) => a.currency_code.localeCompare(b.currency_code))
  }

  // Apply currency filters on fiat/crypto wallets
  if (selectedCurrency) {
    const selectedCurr = allCurrencies.find(c => c.code === selectedCurrency)
    if (selectedCurr?.type === 'fiat') {
      fiatWalletsFiltered = fiatWalletsFiltered.filter(w => w.currency_code === selectedCurrency)
      cryptoWalletsFiltered = []
    } else {
      cryptoWalletsFiltered = cryptoWalletsFiltered.filter(w => w.currency_code === selectedCurrency)
      fiatWalletsFiltered = []
    }
  }

  if (showFiatOnly) {
    cryptoWalletsFiltered = []
  }
  if (showCryptoOnly) {
    fiatWalletsFiltered = []
  }

  const allWalletsForList = buildCompleteWalletList()
  const filteredCurrencies = getFilteredCurrencies()

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="w-full px-4 sm:px-6 py-6 flex-1">
        {/* Header with total balance */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-light text-slate-900 tracking-tight mb-2">My Wallets</h1>
          <div className="flex items-baseline gap-2 mb-6 flex-wrap">
            <p className="text-sm text-slate-600">Total Balance</p>
            <p className="text-2xl sm:text-3xl font-light text-slate-900">{formatNumber(consolidatedBalance > 0 ? consolidatedBalance : totalBalancePHP)}</p>
            <p className="text-sm text-slate-500">{globalCurrency}</p>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-4 items-start">
            {/* Left controls */}
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              {/* Searchable Currency Selector */}
              <div className="relative w-full sm:w-64">
                <button
                  onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white text-left flex items-center justify-between hover:border-slate-400 transition-colors"
                >
                  <span>{selectedCurrency ? `${selectedCurrency} ${CURRENCY_SYMBOLS[selectedCurrency] || ''}` : 'All Currencies'}</span>
                  <svg className={`w-4 h-4 transition-transform ${showCurrencyDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </button>

                {showCurrencyDropdown && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border border-slate-300 rounded-lg shadow-lg">
                    {/* Search input */}
                    <div className="p-2 border-b border-slate-200">
                      <input
                        type="text"
                        placeholder="Search currency..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                        autoFocus
                      />
                    </div>

                    {/* Options */}
                    <div className="max-h-64 overflow-y-auto">
                      {/* All Currencies option */}
                      {!searchInput && (
                        <button
                          onClick={() => {
                            setSelectedCurrency(null)
                            setShowCurrencyDropdown(false)
                            setSearchInput('')
                          }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-100 transition-colors ${
                            selectedCurrency === null ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-900'
                          }`}
                        >
                          All Currencies
                        </button>
                      )}

                      {/* Fiat currencies */}
                      {filteredCurrencies.fiat.length > 0 && (
                        <>
                          {!searchInput && (
                            <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                              Fiat
                            </div>
                          )}
                          {filteredCurrencies.fiat.map(curr => (
                            <button
                              key={curr.code}
                              onClick={() => {
                                setSelectedCurrency(curr.code)
                                setShowCurrencyDropdown(false)
                                setSearchInput('')
                              }}
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-100 transition-colors ${
                                selectedCurrency === curr.code ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-900'
                              }`}
                            >
                              <span className="font-medium">{curr.code}</span> <span className="text-slate-500">{curr.symbol || curr.code}</span>
                            </button>
                          ))}
                        </>
                      )}

                      {/* Crypto currencies */}
                      {filteredCurrencies.crypto.length > 0 && (
                        <>
                          {!searchInput && (
                            <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                              Crypto
                            </div>
                          )}
                          {filteredCurrencies.crypto.map(curr => (
                            <button
                              key={curr.code}
                              onClick={() => {
                                setSelectedCurrency(curr.code)
                                setShowCurrencyDropdown(false)
                                setSearchInput('')
                              }}
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-100 transition-colors ${
                                selectedCurrency === curr.code ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-900'
                              }`}
                            >
                              <span className="font-medium">{curr.code}</span> <span className="text-slate-500">{curr.symbol || curr.code}</span>
                            </button>
                          ))}
                        </>
                      )}

                      {/* No results */}
                      {filteredCurrencies.fiat.length === 0 && filteredCurrencies.crypto.length === 0 && (
                        <div className="px-4 py-4 text-center text-sm text-slate-500">
                          No currencies found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Filter buttons */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setShowFiatOnly(!showFiatOnly)
                    setShowCryptoOnly(false)
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    showFiatOnly
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Fiat Only
                </button>
                <button
                  onClick={() => {
                    setShowCryptoOnly(!showCryptoOnly)
                    setShowFiatOnly(false)
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    showCryptoOnly
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Crypto Only
                </button>
              </div>
            </div>

            {/* Right controls - View mode toggle */}
            <div className="flex gap-2 border border-slate-300 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Grid
              </button>
            </div>
          </div>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
        {success && <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">{success}</div>}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="mb-12">
            {allWalletsForList.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
                <p className="text-slate-500">No currencies available</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left py-4 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Currency</th>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Balance (Native)</th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Balance ({globalCurrency})</th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allWalletsForList.map(wallet => {
                      const isSameCurrency = wallet.currency_code === globalCurrency
                      let balanceInGlobalCurrency = Number(wallet.balance || 0)
                      if (!isSameCurrency) {
                        const converted = convertAmount(Number(wallet.balance || 0), wallet.currency_code, globalCurrency, ratesMap)
                        balanceInGlobalCurrency = converted !== null ? converted : Number(wallet.balance || 0)
                      }

                      // Get symbol from wallet object (database) or fallback
                      const symbol = wallet.symbol || wallet.currency_code
                      const isCrypto = wallet.currency_type === 'crypto'
                      const isPlaceholder = wallet.id && wallet.id.startsWith('placeholder-')

                      return (
                        <tr key={wallet.id} className={`border-b border-slate-100 transition-colors ${
                          isPlaceholder ? 'bg-slate-50' : 'hover:bg-slate-50'
                        }`}>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-semibold text-slate-900">{wallet.currency_code}</p>
                                <p className="text-xs text-slate-500">{symbol}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                              isCrypto
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {isCrypto ? 'Crypto' : 'Fiat'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <p className="font-mono text-slate-700">{formatNumber(Number(wallet.balance || 0))}</p>
                            {isPlaceholder && <p className="text-xs text-slate-400">—</p>}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <p className="font-mono text-slate-700">{formatNumber(balanceInGlobalCurrency)}</p>
                            {isPlaceholder && <p className="text-xs text-slate-400">—</p>}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedWallet(wallet)
                                setShowAddFunds(true)
                              }}
                              className={`px-3 py-1 rounded text-xs font-medium text-white transition-colors ${
                                isCrypto
                                  ? 'bg-orange-600 hover:bg-orange-700'
                                  : 'bg-blue-600 hover:bg-blue-700'
                              }`}
                            >
                              Add
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Grid View */}
        {viewMode === 'grid' && (
          <>
            {!showCryptoOnly && (
              <div className="mb-12">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h2 className="text-2xl font-light text-slate-900 tracking-tight">Fiat Currencies</h2>
                  <p className="text-sm text-slate-500">{currenciesGrouped.fiat.filter(c => enabledInternal.includes(c.code)).length} available</p>
                </div>

                {currenciesGrouped.fiat.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
                    <p className="text-slate-500">No fiat currencies available</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {currenciesGrouped.fiat.filter(c => {
                      // Apply enabled filter
                      if (!enabledInternal.includes(c.code)) return false
                      // Apply selected currency filter
                      if (selectedCurrency && selectedCurrency !== c.code) return false
                      return true
                    }).map(currency => {
                      const wallet = internalWallets.find(w => w.currency_code === currency.code)
                      return wallet || {
                        id: `placeholder-${currency.code}`,
                        wallet_id: null,
                        currency_code: currency.code,
                        currency_name: currency.name,
                        currency_type: currency.type,
                        symbol: currency.symbol,
                        balance: 0,
                        is_placeholder: true
                      }
                    }).map(wallet => {
                      const isSameCurrency = wallet.currency_code === globalCurrency
                      let balanceInGlobalCurrency = Number(wallet.balance || 0)
                      if (!isSameCurrency) {
                        const converted = convertAmount(Number(wallet.balance || 0), wallet.currency_code, globalCurrency, ratesMap)
                        balanceInGlobalCurrency = converted !== null ? converted : Number(wallet.balance || 0)
                      }
                      const symbol = wallet.symbol || wallet.currency_code
                      const isPlaceholder = wallet.id && wallet.id.startsWith('placeholder-')

                      return (
                        <div key={wallet.id} className={`bg-white border border-slate-200 rounded-lg p-5 hover:shadow-lg transition-all hover:border-slate-300 ${isPlaceholder ? 'opacity-75' : ''}`}>
                          <div className="mb-4">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Fiat Currency</p>
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
            )}

            {!showFiatOnly && (
              <div className="mb-12">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h2 className="text-2xl font-light text-slate-900 tracking-tight">Cryptocurrencies</h2>
                  <p className="text-sm text-slate-500">{cryptoWalletsFiltered.length} available</p>
                </div>

                {cryptoWalletsFiltered.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
                    <p className="text-slate-500">No crypto wallets available</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {(cryptoWalletsFiltered.length > 0 ? cryptoWalletsFiltered : currenciesGrouped.crypto.map(c => {
                      const existing = internalWallets.find(w => w.currency_code === c.code)
                      return existing || {
                        id: `placeholder-${c.code}`,
                        currency_code: c.code,
                        currency_name: c.name,
                        currency_type: c.type,
                        symbol: c.symbol,
                        balance: 0,
                        is_placeholder: true
                      }
                    })).map(wallet => {
                      const isSameCurrency = wallet.currency_code === globalCurrency
                      let balanceInGlobalCurrency = Number(wallet.balance || 0)
                      if (!isSameCurrency) {
                        const converted = convertAmount(Number(wallet.balance || 0), wallet.currency_code, globalCurrency, ratesMap)
                        balanceInGlobalCurrency = converted !== null ? converted : Number(wallet.balance || 0)
                      }
                      const symbol = wallet.symbol || wallet.currency_code
                      const isPlaceholder = wallet.id && wallet.id.startsWith('placeholder-')

                      return (
                        <div key={wallet.id} className={`bg-white border border-slate-200 rounded-lg p-5 hover:shadow-lg transition-all hover:border-slate-300 ${isPlaceholder ? 'opacity-75' : ''}`}>
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
            )}
          </>
        )}


        {/* Add Funds Modal */}
        {showAddFunds && selectedWallet && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-xl">
              <h3 className="text-2xl font-light text-slate-900 mb-2">Add Funds</h3>
              <p className="text-sm text-slate-600 mb-6">
                {selectedWallet.currency_type === 'crypto' ? 'Cryptocurrency' : 'Fiat Currency'} · {selectedWallet.currency_code}
              </p>

              <form onSubmit={handleAddFunds} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Amount ({selectedWallet.currency_code})
                  </label>
                  <input
                    type="number"
                    step={selectedWallet.currency_type === 'crypto' ? "0.00000001" : "0.01"}
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-lg"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
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
                      selectedWallet.currency_type === 'crypto'
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
    </div>
  )
}
