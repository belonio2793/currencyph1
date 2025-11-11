import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Rates({ globalCurrency }) {
  const [ratesMap, setRatesMap] = useState({}) // USD_XXX rates only
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [allCurrencies, setAllCurrencies] = useState([])
  
  const baseCurrency = 'USD'
  const displayCurrency = 'PHP'

  // Load all rates from pairs table
  useEffect(() => {
    loadRates()
    const interval = setInterval(loadRates, 60 * 60 * 1000)

    // Realtime subscription
    const handleRateChange = (payload) => {
      if (payload.new && payload.new.from_currency === 'USD') {
        setRatesMap(prev => ({
          ...prev,
          [payload.new.to_currency]: Number(payload.new.rate)
        }))
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

  const loadRates = async () => {
    try {
      setLoading(true)

      // Load only USD_XXX pairs (base rates)
      const { data: pairs, error } = await supabase
        .from('pairs')
        .select('from_currency,to_currency,rate')
        .eq('from_currency', 'USD')

      if (error) {
        console.error('Error loading pairs:', error)
        setRatesMap({})
        setAllCurrencies([])
        return
      }

      if (!Array.isArray(pairs) || pairs.length === 0) {
        console.warn('No USD pairs found in pairs table')
        setRatesMap({})
        setAllCurrencies([])
        return
      }

      // Build map: currency -> rate (1 USD = X currency)
      const map = {}
      const currencies = []

      pairs.forEach(p => {
        if (p.to_currency && p.rate != null) {
          const rate = Number(p.rate)
          if (isFinite(rate) && rate > 0) {
            map[p.to_currency] = rate
            currencies.push({ code: p.to_currency, rate })
          }
        }
      })

      console.debug(`Loaded ${Object.keys(map).length} USD exchange rates`)
      
      setRatesMap(map)
      setAllCurrencies(currencies.sort((a, b) => a.code.localeCompare(b.code)))
      setLastUpdated(new Date())
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
    
    if (!fromRate || !toRate) return null
    
    // If from and to both have USD rates:
    // 1 USD = fromRate from
    // 1 USD = toRate to
    // Therefore: from_to = toRate / fromRate
    return toRate / fromRate
  }

  const [selectedCurrency, setSelectedCurrency] = useState(null)
  const [selectedCrypto, setSelectedCrypto] = useState(null)
  const [amount1, setAmount1] = useState('')
  const [amount2, setAmount2] = useState('')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('all')

  // Initialize selections
  useEffect(() => {
    if (!loading && allCurrencies.length > 0) {
      if (!selectedCurrency) {
        const php = allCurrencies.find(c => c.code === displayCurrency)
        setSelectedCurrency(php || allCurrencies[0])
      }
      if (!selectedCrypto) {
        const btc = allCurrencies.find(c => c.code === 'BTC')
        setSelectedCrypto(btc || allCurrencies.find(c => c.code !== displayCurrency))
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
    if (rate) {
      setAmount2((num * rate).toFixed(8))
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
    if (rate) {
      setAmount1((num * rate).toFixed(2))
    }
  }

  const filtered = allCurrencies.filter(c => {
    if (!search) return true
    return c.code.toLowerCase().includes(search.toLowerCase())
  })

  const formatNumber = (num, decimals = 2) => {
    if (num == null) return '—'
    const n = Number(num)
    if (!isFinite(n)) return '—'
    return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals })
  }

  if (loading) {
    return <div className="bg-white rounded-2xl shadow-lg p-6 text-slate-500">Loading rates...</div>
  }

  if (allCurrencies.length === 0) {
    return <div className="bg-white rounded-2xl shadow-lg p-6 text-slate-500">No rates available</div>
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-light text-slate-900">Exchange Rates</h2>
        <div className="text-xs text-slate-500">Last updated: {lastUpdated.toLocaleTimeString()}</div>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 space-y-4">
          {/* Primary card */}
          {selectedCurrency && (
            <div className="rounded-lg p-6 border bg-slate-50 border-slate-200 relative group">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-medium">{selectedCurrency.code}</h3>
                  <p className="text-xs text-slate-500">{selectedCurrency.code}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-light">1</div>
                  <div className="text-xs text-slate-500">1 {baseCurrency}</div>
                </div>
              </div>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">
                1 {baseCurrency} = {formatNumber(selectedCurrency.rate)} {selectedCurrency.code}
              </div>
            </div>
          )}

          {/* Secondary card */}
          {selectedCrypto && (
            <div className="rounded-lg p-6 border bg-orange-50 border-orange-200 relative group">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-medium">{selectedCrypto.code}</h3>
                  <p className="text-xs text-slate-500">{selectedCrypto.code}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-light text-orange-700">
                    {formatNumber(selectedCrypto.rate, 8)}
                  </div>
                  <div className="text-xs text-slate-500">{selectedCrypto.code} per {baseCurrency}</div>
                </div>
              </div>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">
                1 {baseCurrency} = {formatNumber(selectedCrypto.rate, 8)} {selectedCrypto.code}
              </div>
            </div>
          )}

          {/* Converter */}
          {selectedCurrency && selectedCrypto && (
            <div className="bg-white rounded-lg p-4 border border-slate-100">
              <h4 className="text-sm font-medium text-slate-700 mb-3">Quick Converter</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500">{selectedCurrency.code} amount</label>
                  <input
                    type="number"
                    step="any"
                    value={amount1}
                    onChange={(e) => handleAmount1Change(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-slate-400 mt-1">Convert {selectedCurrency.code} → {selectedCrypto.code}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500">{selectedCrypto.code} amount</label>
                  <input
                    type="number"
                    step="any"
                    value={amount2}
                    onChange={(e) => handleAmount2Change(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-slate-400 mt-1">Convert {selectedCrypto.code} → {selectedCurrency.code}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar with rates list */}
        <div className="w-80 border border-slate-100 rounded-lg p-3">
          <div className="flex gap-2 mb-3">
            <button 
              onClick={() => setViewMode('all')} 
              className={`flex-1 py-2 rounded text-sm ${viewMode === 'all' ? 'bg-blue-600 text-white' : 'bg-white border'}`}
            >
              All
            </button>
          </div>

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search code"
            className="w-full px-3 py-2 border rounded mb-3 text-sm"
          />

          <div className="h-96 overflow-auto space-y-1">
            {filtered.length === 0 ? (
              <div className="text-sm text-slate-500">No results</div>
            ) : (
              filtered.map(currency => (
                <div
                  key={currency.code}
                  onClick={() => setSelectedCurrency(currency)}
                  className={`p-2 rounded cursor-pointer hover:bg-slate-50 flex items-center justify-between transition relative group ${
                    selectedCurrency?.code === currency.code ? 'bg-slate-100' : ''
                  }`}
                >
                  <div>
                    <div className="font-medium text-sm">{currency.code}</div>
                  </div>
                  <div className="text-xs text-slate-600">
                    {formatNumber(currency.rate, 6)}
                  </div>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                    1 {baseCurrency} = {formatNumber(currency.rate, 8)} {currency.code}
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
