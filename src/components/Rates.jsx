import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Rates({ globalCurrency }) {
  const [ratesMap, setRatesMap] = useState({})
  const [currenciesMetadata, setCurrenciesMetadata] = useState({})
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [allCurrencies, setAllCurrencies] = useState([])
  
  const baseCurrency = 'PHP'
  const [displayCurrency, setDisplayCurrency] = useState('PHP')

  // Load currencies metadata and exchange rates
  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 60 * 60 * 1000)

    const handleRateChange = (payload) => {
      if (payload.new) {
        if (payload.new.from_currency === 'USD') {
          setRatesMap(prev => ({
            ...prev,
            [payload.new.to_currency]: Number(payload.new.rate)
          }))
        } else if (payload.new.from_currency === 'PHP') {
          setRatesMap(prev => ({
            ...prev,
            ['PHP_' + payload.new.to_currency]: Number(payload.new.rate)
          }))
        }
        setLastUpdated(new Date())
      }
    }

    const channel = supabase
      .channel('public:pairs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pairs' }, handleRateChange)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pairs' }, handleRateChange)
      .subscribe()

    return () => {
      clearInterval(interval)
      try {
        supabase.removeChannel(channel)
      } catch (e) {}
    }
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)

      // Load currencies metadata
      const { data: currencies, error: currError } = await supabase
        .from('currencies')
        .select('code,name,type,symbol,decimals,is_default')
        .eq('active', true)

      if (!currError && currencies) {
        const metadata = {}
        currencies.forEach(c => {
          metadata[c.code] = c
        })
        setCurrenciesMetadata(metadata)
      }

      // Load pairs where PHP is source (PHP-based rates)
      const { data: phpPairs, error: phpError } = await supabase
        .from('pairs')
        .select('from_currency,to_currency,rate')
        .eq('from_currency', 'PHP')

      if (!phpError && phpPairs && Array.isArray(phpPairs)) {
        const map = {}
        const currencies_list = []
        const processedCodes = new Set()

        // Always include PHP first
        map['PHP'] = 1
        currencies_list.push({
          code: 'PHP',
          rate: 1,
          name: 'Philippine Peso',
          type: 'fiat',
          symbol: '₱',
          decimals: 2
        })
        processedCodes.add('PHP')

        // Add other currencies from pairs
        phpPairs.forEach(p => {
          if (p.to_currency && p.rate != null && !processedCodes.has(p.to_currency)) {
            const rate = Number(p.rate)
            if (isFinite(rate) && rate > 0) {
              map[p.to_currency] = rate
              const metadata = currenciesMetadata[p.to_currency] ||
                { code: p.to_currency, name: p.to_currency, type: 'unknown', decimals: 2 }
              currencies_list.push({
                code: p.to_currency,
                rate,
                name: metadata.name || p.to_currency,
                type: metadata.type || 'unknown',
                symbol: metadata.symbol || '',
                decimals: metadata.decimals || 2
              })
              processedCodes.add(p.to_currency)
            }
          }
        })

        setRatesMap(map)
        setAllCurrencies(currencies_list.sort((a, b) => {
          if (a.code === 'PHP') return -1
          if (b.code === 'PHP') return 1
          return a.code.localeCompare(b.code)
        }))
        setLastUpdated(new Date())
      }
    } catch (err) {
      console.error('Error loading exchange rates:', err)
      setRatesMap({})
      setAllCurrencies([])
    } finally {
      setLoading(false)
    }
  }

  const getRate = (from, to) => {
    if (from === to) return 1
    
    const fromRate = ratesMap[from]
    const toRate = ratesMap[to]
    
    if (fromRate === undefined || toRate === undefined) return null
    if (fromRate === 0 || toRate === 0) return null
    
    // Both have PHP-based rates
    return toRate / fromRate
  }

  const [selectedCurrency, setSelectedCurrency] = useState(null)
  const [selectedCrypto, setSelectedCrypto] = useState(null)
  const [amount1, setAmount1] = useState('')
  const [amount2, setAmount2] = useState('')
  const [search, setSearch] = useState('')
  const [favorites, setFavorites] = useState(['PHP', 'USD', 'BTC', 'EUR'])

  // Initialize selections
  useEffect(() => {
    if (!loading && allCurrencies.length > 0) {
      if (!selectedCurrency) {
        const php = allCurrencies.find(c => c.code === 'PHP')
        setSelectedCurrency(php || allCurrencies[0])
      }
      if (!selectedCrypto) {
        const btc = allCurrencies.find(c => c.code === 'BTC')
        setSelectedCrypto(btc || allCurrencies.find(c => c.code !== 'PHP'))
      }
    }
  }, [loading, allCurrencies, selectedCurrency, selectedCrypto])

  const handleAmount1Change = (val) => {
    setAmount1(val)
    if (!selectedCrypto || !val) {
      setAmount2('')
      return
    }
    const num = parseFloat(val)
    if (isNaN(num)) {
      setAmount2('')
      return
    }
    const rate = getRate(selectedCurrency.code, selectedCrypto.code)
    if (rate !== null) {
      const decimals = selectedCrypto.decimals || 2
      setAmount2((num * rate).toFixed(decimals))
    }
  }

  const handleAmount2Change = (val) => {
    setAmount2(val)
    if (!selectedCurrency || !val) {
      setAmount1('')
      return
    }
    const num = parseFloat(val)
    if (isNaN(num)) {
      setAmount1('')
      return
    }
    const rate = getRate(selectedCrypto.code, selectedCurrency.code)
    if (rate !== null) {
      const decimals = selectedCurrency.decimals || 2
      setAmount1((num * rate).toFixed(decimals))
    }
  }

  const toggleFavorite = (code) => {
    setFavorites(prev => 
      prev.includes(code) 
        ? prev.filter(c => c !== code)
        : [...prev, code]
    )
  }

  const filtered = allCurrencies.filter(c => {
    if (!search) return true
    return c.code.toLowerCase().includes(search.toLowerCase()) || 
           c.name.toLowerCase().includes(search.toLowerCase())
  })

  const favoritesCurrencies = allCurrencies.filter(c => favorites.includes(c.code))

  const formatNumber = (num, decimals = 2) => {
    if (num == null) return '—'
    const n = Number(num)
    if (!isFinite(n)) return '—'

    // For PHP (low-value currency), ensure we show enough decimals for small numbers
    let minDecimals = 0
    let maxDecimals = decimals

    if (n < 1 && n > 0) {
      // For numbers < 1, show at least 4 decimals to maintain precision
      minDecimals = Math.max(4, decimals)
      maxDecimals = Math.max(6, decimals)
    } else if (n >= 1) {
      // For numbers >= 1, use standard formatting
      minDecimals = decimals === 0 ? 0 : 2
      maxDecimals = decimals
    }

    return n.toLocaleString(undefined, { minimumFractionDigits: minDecimals, maximumFractionDigits: maxDecimals })
  }

  const getCurrencyColor = (type) => {
    if (type === 'crypto') return 'bg-orange-50 border-orange-200'
    if (type === 'fiat') return 'bg-slate-50 border-slate-200'
    return 'bg-slate-50 border-slate-200'
  }

  const getCurrencyTypeIcon = (type) => {
    if (type === 'crypto') return '₿'
    return '$'
  }

  if (loading) {
    return <div className="bg-white rounded-2xl shadow-lg p-6 text-slate-500">Loading exchange rates...</div>
  }

  if (allCurrencies.length === 0) {
    return <div className="bg-white rounded-2xl shadow-lg p-6 text-slate-500">No rates available</div>
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-light text-slate-900">Exchange Rates</h2>
          <p className="text-sm text-slate-500 mt-1">Base currency: <span className="font-semibold text-slate-700">Philippine Peso (₱)</span></p>
        </div>
        <div className="text-xs text-slate-500">Last updated: {lastUpdated.toLocaleTimeString()}</div>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 space-y-4">
          {/* Primary card - Display selected currency */}
          {selectedCurrency && (
            <div className={`rounded-lg p-6 border relative group ${getCurrencyColor(selectedCurrency.type)}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{selectedCurrency.symbol || getCurrencyTypeIcon(selectedCurrency.type)}</div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">{selectedCurrency.code}</h3>
                    <p className="text-xs text-slate-600">{selectedCurrency.name}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-slate-200 text-slate-700 text-xs rounded">
                      {selectedCurrency.type === 'crypto' ? 'Cryptocurrency' : 'Fiat'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-light text-slate-900">
                    {formatNumber(selectedCurrency.rate, selectedCurrency.decimals)}
                  </div>
                  <div className="text-xs text-slate-500 mt-2">per 1 {baseCurrency}</div>
                </div>
              </div>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                1 {baseCurrency} = {formatNumber(selectedCurrency.rate, selectedCurrency.decimals)} {selectedCurrency.code}
              </div>
            </div>
          )}

          {/* Secondary card - Compare with another currency */}
          {selectedCrypto && selectedCrypto.code !== selectedCurrency.code && (
            <div className={`rounded-lg p-6 border relative group ${getCurrencyColor(selectedCrypto.type)}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{selectedCrypto.symbol || getCurrencyTypeIcon(selectedCrypto.type)}</div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">{selectedCrypto.code}</h3>
                    <p className="text-xs text-slate-600">{selectedCrypto.name}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-slate-200 text-slate-700 text-xs rounded">
                      {selectedCrypto.type === 'crypto' ? 'Cryptocurrency' : 'Fiat'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-light text-slate-900">
                    {formatNumber(selectedCrypto.rate, selectedCrypto.decimals)}
                  </div>
                  <div className="text-xs text-slate-500 mt-2">per 1 {baseCurrency}</div>
                </div>
              </div>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                1 {baseCurrency} = {formatNumber(selectedCrypto.rate, selectedCrypto.decimals)} {selectedCrypto.code}
              </div>
            </div>
          )}

          {/* Quick Converter */}
          {selectedCurrency && selectedCrypto && selectedCrypto.code !== selectedCurrency.code && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Quick Converter</h4>
              <p className="text-xs text-slate-600 mb-3">
                1 {selectedCurrency.code} = {formatNumber(getRate(selectedCurrency.code, selectedCrypto.code), selectedCrypto.decimals)} {selectedCrypto.code}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-600 font-medium">{selectedCurrency.code} amount</label>
                  <input
                    type="number"
                    step="any"
                    value={amount1}
                    onChange={(e) => handleAmount1Change(e.target.value)}
                    className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-slate-500 mt-2">≈ {amount2 || '0'} {selectedCrypto.code}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-600 font-medium">{selectedCrypto.code} amount</label>
                  <input
                    type="number"
                    step="any"
                    value={amount2}
                    onChange={(e) => handleAmount2Change(e.target.value)}
                    className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-slate-500 mt-2">≈ {amount1 || '0'} {selectedCurrency.code}</p>
                </div>
              </div>
            </div>
          )}

          {/* Favorites section */}
          {favoritesCurrencies.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Favorite Rates</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {favoritesCurrencies.map(curr => (
                  <div 
                    key={curr.code}
                    className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition cursor-pointer"
                    onClick={() => setSelectedCurrency(curr)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm text-slate-900">{curr.code}</div>
                        <div className="text-xs text-slate-500">{curr.name}</div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleFavorite(curr.code)
                        }}
                        className="text-yellow-400 hover:text-yellow-500"
                      >
                        ★
                      </button>
                    </div>
                    <div className="text-sm font-semibold text-slate-900 mt-2">
                      {formatNumber(curr.rate, curr.decimals)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar with currency list */}
        <div className="w-80 border border-slate-100 rounded-lg p-4 bg-slate-50">
          <div className="mb-4">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by code or name..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex gap-2 mb-4">
            <button 
              onClick={() => setSearch('')}
              className="flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors"
              style={{ 
                backgroundColor: search === '' ? '#3b82f6' : '#e2e8f0',
                color: search === '' ? 'white' : '#475569'
              }}
            >
              All ({allCurrencies.length})
            </button>
            <button 
              onClick={() => setSearch('')}
              className="flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors"
              style={{ 
                backgroundColor: search === '' ? '#e2e8f0' : '#e2e8f0',
                color: '#475569'
              }}
            >
              Fiat ({allCurrencies.filter(c => c.type === 'fiat').length})
            </button>
            <button 
              onClick={() => setSearch('')}
              className="flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors"
              style={{ 
                backgroundColor: search === '' ? '#e2e8f0' : '#e2e8f0',
                color: '#475569'
              }}
            >
              Crypto ({allCurrencies.filter(c => c.type === 'crypto').length})
            </button>
          </div>

          <div className="h-96 overflow-y-auto space-y-1">
            {filtered.length === 0 ? (
              <div className="text-sm text-slate-500 p-4 text-center">No results</div>
            ) : (
              filtered.map(currency => (
                <div
                  key={currency.code}
                  onClick={() => setSelectedCurrency(currency)}
                  className={`p-3 rounded-lg cursor-pointer hover:bg-white transition relative group ${
                    selectedCurrency?.code === currency.code ? 'bg-white border border-blue-300 shadow-sm' : 'border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm text-slate-900">{currency.code}</div>
                      <div className="text-xs text-slate-600">{currency.name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {currency.type === 'crypto' ? '₿ Crypto' : '$ Fiat'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-slate-900">
                        {formatNumber(currency.rate, currency.decimals)}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleFavorite(currency.code)
                        }}
                        className="text-sm mt-1"
                        style={{ color: favorites.includes(currency.code) ? '#facc15' : '#cbd5e1' }}
                      >
                        ★
                      </button>
                    </div>
                  </div>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                    1 {baseCurrency} = {formatNumber(currency.rate, currency.decimals)} {currency.code}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
