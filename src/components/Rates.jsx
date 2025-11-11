import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Rates({ globalCurrency }) {
  const [exchangeRates, setExchangeRates] = useState({})
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [allCurrencies, setAllCurrencies] = useState([])
  const [allCryptos, setAllCryptos] = useState([])
  
  const baseCurrency = 'PHP'

  // Load all rates from currency_rates table only
  useEffect(() => {
    loadRates()
    // Poll hourly to avoid excessive calls
    const interval = setInterval(loadRates, 60 * 60 * 1000)

    // Realtime subscription to currency_rates table
    const channel = supabase
      .channel('public:currency_rates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'currency_rates' }, payload => {
        setExchangeRates(prev => ({
          ...prev,
          [`${payload.new.from_currency}_${payload.new.to_currency}`]: payload.new.rate
        }))
        setLastUpdated(new Date())
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'currency_rates' }, payload => {
        setExchangeRates(prev => ({
          ...prev,
          [`${payload.new.from_currency}_${payload.new.to_currency}`]: payload.new.rate
        }))
        setLastUpdated(new Date())
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'currency_rates' }, payload => {
        setExchangeRates(prev => {
          const copy = { ...prev }
          delete copy[`${payload.old.from_currency}_${payload.old.to_currency}`]
          return copy
        })
        setLastUpdated(new Date())
      })

    channel.subscribe()

    return () => {
      clearInterval(interval)
      try {
        supabase.removeChannel(channel)
      } catch (e) {
        // ignore
      }
    }
  }, [])

  const loadRates = async () => {
    try {
      setLoading(true)
      const { data: rates, error, status, statusText } = await supabase
        .from('currency_rates')
        .select('from_currency,to_currency,rate')

      console.debug('Currency rates query:', { status, statusText, rowCount: rates?.length })

      if (error) {
        console.error('Error loading currency rates:', error)
        setExchangeRates({})
        setAllCurrencies([])
        setAllCryptos([])
        return
      }

      if (!Array.isArray(rates) || rates.length === 0) {
        console.warn('currency_rates table returned 0 rows')
        setExchangeRates({})
        setAllCurrencies([])
        setAllCryptos([])
        return
      }

      // Build rates map and discover currencies
      const ratesMap = {}
      const currencySet = new Set()
      const cryptoSet = new Set()
      
      // Common crypto codes to identify cryptos
      const commonCryptos = new Set(['BTC', 'ETH', 'LTC', 'DOGE', 'XRP', 'ADA', 'SOL', 'AVAX', 'MATIC', 'DOT', 'LINK', 'UNI', 'AAVE', 'USDC', 'USDT'])

      rates.forEach(r => {
        if (r && r.from_currency && r.to_currency && r.rate != null) {
          ratesMap[`${r.from_currency}_${r.to_currency}`] = Number(r.rate)
          
          // Classify currencies
          if (commonCryptos.has(r.from_currency)) {
            cryptoSet.add(r.from_currency)
          } else {
            currencySet.add(r.from_currency)
          }
          
          if (commonCryptos.has(r.to_currency)) {
            cryptoSet.add(r.to_currency)
          } else {
            currencySet.add(r.to_currency)
          }
        }
      })

      console.debug(`Loaded ${Object.keys(ratesMap).length} exchange rate pairs from currency_rates`)
      
      setExchangeRates(ratesMap)
      
      // Convert to array of currency objects, ensure PHP is first
      const fiatCurrencies = Array.from(currencySet)
        .map(code => ({ code, name: code }))
        .sort((a, b) => {
          if (a.code === baseCurrency) return -1
          if (b.code === baseCurrency) return 1
          return a.code.localeCompare(b.code)
        })
      
      const cryptoCurrencies = Array.from(cryptoSet)
        .map(code => ({ code, name: code }))
        .sort((a, b) => a.code.localeCompare(b.code))
      
      setAllCurrencies(fiatCurrencies)
      setAllCryptos(cryptoCurrencies)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Error loading exchange rates:', err)
      setExchangeRates({})
      setAllCurrencies([])
      setAllCryptos([])
    } finally {
      setLoading(false)
    }
  }

  // Get rate between two currencies with multiple fallback strategies
  const getRate = (from, to) => {
    if (!from || !to) return null
    if (from === to) return 1

    // Try direct pair first
    const direct = exchangeRates[`${from}_${to}`]
    if (typeof direct === 'number' && isFinite(direct)) return direct

    // Try reverse pair and invert
    const reverse = exchangeRates[`${to}_${from}`]
    if (typeof reverse === 'number' && reverse > 0) return 1 / reverse

    // Try compute via USD if both have USD pairs
    const usdToFrom = exchangeRates[`USD_${from}`]
    const usdToTo = exchangeRates[`USD_${to}`]
    if (typeof usdToFrom === 'number' && typeof usdToTo === 'number' && usdToFrom > 0) {
      return usdToTo / usdToFrom
    }

    // Try compute via PHP (base currency) if both have PHP pairs
    const phpToFrom = exchangeRates[`${baseCurrency}_${from}`]
    const phpToTo = exchangeRates[`${baseCurrency}_${to}`]
    if (typeof phpToFrom === 'number' && typeof phpToTo === 'number' && phpToFrom > 0) {
      return phpToTo / phpToFrom
    }

    return null
  }

  // UI state
  const [viewMode, setViewMode] = useState('fiat')
  const [search, setSearch] = useState('')
  const [selectedFiat, setSelectedFiat] = useState(null)
  const [selectedCrypto, setSelectedCrypto] = useState(null)
  const [fiatInput, setFiatInput] = useState('')
  const [cryptoInput, setCryptoInput] = useState('')

  // Initialize selections after loading
  useEffect(() => {
    if (!loading && allCurrencies.length > 0 && !selectedFiat) {
      const php = allCurrencies.find(c => c.code === baseCurrency) || allCurrencies[0]
      setSelectedFiat(php)
    }
  }, [loading, allCurrencies, selectedFiat])

  useEffect(() => {
    if (!loading && allCryptos.length > 0 && !selectedCrypto) {
      setSelectedCrypto(allCryptos[0])
    }
  }, [loading, allCryptos, selectedCrypto])

  const formatNumber = (v, decimals = 2) => {
    if (v == null || Number.isNaN(Number(v))) return '—'
    try {
      return Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals })
    } catch (e) {
      return Number(v).toFixed(decimals)
    }
  }

  const listItems = () => {
    if (viewMode === 'fiat') {
      return (allCurrencies || []).map(c => ({ type: 'fiat', code: c.code, name: c.name }))
    }
    return (allCryptos || []).map(c => ({ type: 'crypto', code: c.code, name: c.name }))
  }

  const filtered = listItems().filter(item => {
    if (!search) return true
    const s = search.toLowerCase()
    return item.code.toLowerCase().includes(s) || item.name.toLowerCase().includes(s)
  })

  const onSelect = (item) => {
    if (item.type === 'fiat') setSelectedFiat({ code: item.code, name: item.name })
    else setSelectedCrypto({ code: item.code, name: item.name })
  }

  const navigate = (type, direction) => {
    const items = type === 'fiat' ? allCurrencies : allCryptos
    if (!items || items.length === 0) return

    const selected = type === 'fiat' ? selectedFiat : selectedCrypto
    if (!selected) return

    const idx = items.findIndex(i => i.code === selected.code)
    const nextIdx = direction === 'next' 
      ? (idx + 1) % items.length 
      : (idx - 1 + items.length) % items.length

    if (type === 'fiat') {
      setSelectedFiat(items[nextIdx])
    } else {
      setSelectedCrypto(items[nextIdx])
    }
  }

  const onChangeFiat = (val) => {
    if (val === '' || val === null) {
      setFiatInput('')
      setCryptoInput('')
      return
    }

    setFiatInput(val)
    const num = parseFloat(val)
    if (isNaN(num) || !selectedFiat || !selectedCrypto) {
      setCryptoInput('')
      return
    }

    const rate = getRate(selectedFiat.code, selectedCrypto.code)
    if (!rate) {
      setCryptoInput('')
      return
    }

    const cryptoAmount = num / rate
    setCryptoInput(isFinite(cryptoAmount) ? Number(cryptoAmount).toFixed(8) : '')
  }

  const onChangeCrypto = (val) => {
    if (val === '' || val === null) {
      setCryptoInput('')
      setFiatInput('')
      return
    }

    setCryptoInput(val)
    const num = parseFloat(val)
    if (isNaN(num) || !selectedFiat || !selectedCrypto) {
      setFiatInput('')
      return
    }

    const rate = getRate(selectedFiat.code, selectedCrypto.code)
    if (!rate) {
      setFiatInput('')
      return
    }

    const fiatAmount = num * rate
    setFiatInput(isFinite(fiatAmount) ? Number(fiatAmount).toFixed(2) : '')
  }

  const renderFiatCard = (isPrimary) => {
    if (!selectedFiat) return null
    const isBase = selectedFiat.code === baseCurrency
    const displayPrice = isBase ? 1 : getRate(selectedFiat.code, baseCurrency)
    const pairKey = isBase ? `${baseCurrency}_${baseCurrency}` : `${selectedFiat.code}_${baseCurrency}`

    return (
      <div
        className={`rounded-lg p-6 border w-full relative group ${isPrimary ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100'}`}
        title={`Pair: ${pairKey}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-medium">{selectedFiat.code}</h3>
            <p className="text-xs text-slate-500">{selectedFiat.name}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-light text-slate-900">{typeof displayPrice === 'number' ? (displayPrice === 1 && isBase ? '1' : displayPrice.toFixed(2)) : '—'}</div>
            <div className="text-xs text-slate-500">{isBase ? `1 ${baseCurrency}` : `1 ${selectedFiat.code} = ${displayPrice ? displayPrice.toFixed(2) : '—'} ${baseCurrency}`}</div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={() => navigate('fiat', 'prev')} className="px-3 py-2 bg-white border rounded hover:bg-slate-100">Prev</button>
          <button onClick={() => navigate('fiat', 'next')} className="px-3 py-2 bg-white border rounded hover:bg-slate-100">Next</button>
        </div>

        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10 max-w-xs">
          {isBase ? `Base currency (1 ${baseCurrency} = 1 ${baseCurrency})` : `1 ${selectedFiat.code} = ${displayPrice ? displayPrice.toFixed(2) : '?'} ${baseCurrency}`}
        </div>
      </div>
    )
  }

  const renderCryptoCard = (isPrimary) => {
    if (!selectedCrypto || !selectedFiat) return null
    const price = getRate(selectedCrypto.code, selectedFiat.code)
    const pairKey = `${selectedCrypto.code}_${selectedFiat.code}`

    return (
      <div
        className={`rounded-lg p-6 border w-full relative group ${isPrimary ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-100'}`}
        title={`Pair: ${pairKey}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-medium">{selectedCrypto.code}</h3>
            <p className="text-xs text-slate-500">{selectedCrypto.name}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-light text-orange-700">{price ? (typeof price === 'number' ? formatNumber(price, 2) : '—') : '—'}</div>
            <div className="text-xs text-slate-500">{selectedFiat.code} per {selectedCrypto.code}</div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={() => navigate('crypto', 'prev')} className="px-3 py-2 bg-white border rounded hover:bg-slate-100">Prev</button>
          <button onClick={() => navigate('crypto', 'next')} className="px-3 py-2 bg-white border rounded hover:bg-slate-100">Next</button>
        </div>

        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10 max-w-xs">
          1 {selectedCrypto.code} = {price ? formatNumber(price, 2) : '?'} {selectedFiat.code}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-light text-slate-900">Exchange Rates</h2>
        <div className="text-xs text-slate-500">Last updated: {lastUpdated.toLocaleTimeString()}</div>
      </div>

      <div className="flex gap-6">
        <div className="flex-1">
          {loading ? (
            <div className="text-slate-500">Loading...</div>
          ) : allCurrencies.length === 0 ? (
            <div className="text-slate-500 text-sm">No exchange rates available. Please ensure currency_rates table is populated.</div>
          ) : (
            <div className="space-y-4">
              {renderFiatCard(true)}
              {allCryptos.length > 0 && renderCryptoCard(false)}

              <div className="bg-white rounded-lg p-4 border border-slate-100 w-full mt-4">
                <h4 className="text-sm font-medium text-slate-700 mb-2">Quick Converter</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500">{selectedFiat ? selectedFiat.code : 'Fiat'} amount</label>
                    <input
                      type="number"
                      step="any"
                      value={fiatInput}
                      onChange={(e) => onChangeFiat(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border rounded"
                      placeholder="0.00"
                      disabled={!selectedFiat || !selectedCrypto || !getRate(selectedFiat.code, selectedCrypto.code)}
                    />
                    <p className="text-xs text-slate-400 mt-1">Convert {selectedFiat ? selectedFiat.code : '—'} → {selectedCrypto ? selectedCrypto.code : '—'}</p>
                    {cryptoInput !== '' && (
                      <p className="text-xs text-slate-400 mt-1">= {formatNumber(cryptoInput, 8)} {selectedCrypto.code}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-slate-500">{selectedCrypto ? selectedCrypto.code : 'Crypto'} amount</label>
                    <input
                      type="number"
                      step="any"
                      value={cryptoInput}
                      onChange={(e) => onChangeCrypto(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border rounded"
                      placeholder="0.00"
                      disabled={!selectedFiat || !selectedCrypto || !getRate(selectedFiat.code, selectedCrypto.code)}
                    />
                    <p className="text-xs text-slate-400 mt-1">Convert {selectedCrypto ? selectedCrypto.code : '—'} → {selectedFiat ? selectedFiat.code : '—'}</p>
                    {fiatInput !== '' && (
                      <p className="text-xs text-slate-400 mt-1">= {formatNumber(fiatInput, 2)} {selectedFiat.code}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-full sm:w-80 border border-slate-100 rounded-lg p-3">
          <div className="flex gap-2 mb-3">
            <button onClick={() => setViewMode('fiat')} className={`flex-1 py-2 rounded ${viewMode === 'fiat' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>Fiat</button>
            <button onClick={() => setViewMode('crypto')} className={`flex-1 py-2 rounded ${viewMode === 'crypto' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>Crypto</button>
          </div>

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search code or name"
            className="w-full px-3 py-2 border rounded mb-3 text-sm"
          />

          <div className="h-72 overflow-auto">
            {filtered.length === 0 ? (
              <div className="text-sm text-slate-500">No results</div>
            ) : (
              filtered.map(item => {
                const rate = viewMode === 'fiat'
                  ? selectedFiat && getRate(selectedFiat.code, item.code)
                  : selectedCrypto && getRate(selectedCrypto.code, item.code)

                return (
                  <div
                    key={`${item.type}-${item.code}`}
                    onClick={() => onSelect(item)}
                    className={`p-2 rounded cursor-pointer hover:bg-slate-50 flex items-center justify-between relative group ${
                      viewMode === 'fiat'
                        ? selectedFiat?.code === item.code ? 'bg-slate-100' : ''
                        : selectedCrypto?.code === item.code ? 'bg-slate-100' : ''
                    }`}
                  >
                    <div>
                      <div className="font-medium">{item.code}</div>
                      <div className="text-xs text-slate-500">{item.name}</div>
                    </div>
                    <div className="text-sm text-slate-600">
                      {rate ? formatNumber(rate, viewMode === 'crypto' ? 6 : 2) : '—'}
                    </div>

                    {rate && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10 max-w-xs">
                        {viewMode === 'fiat'
                          ? `1 ${selectedFiat?.code || '?'} = ${formatNumber(rate, 2)} ${item.code}`
                          : `1 ${selectedCrypto?.code || '?'} = ${formatNumber(rate, 6)} ${item.code}`
                        }
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
