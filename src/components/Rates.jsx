import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Rates() {
  const [currencies, setCurrencies] = useState({})
  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  const [selectedFrom, setSelectedFrom] = useState('PHP')
  const [selectedTo, setSelectedTo] = useState('USD')
  const [amount, setAmount] = useState('1')
  const [result, setResult] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('code')
  const [favorites, setFavorites] = useState(['PHP', 'USD', 'EUR', 'BTC', 'ETH'])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [currenciesRes, fiatRatesRes, cryptoRatesRes, pairsRes] = await Promise.all([
        supabase
          .from('currencies')
          .select('code,name,type,symbol,decimals,is_default,active')
          .eq('active', true),
        supabase
          .from('currency_rates')
          .select('from_currency,to_currency,rate')
          .eq('from_currency', 'PHP'),
        supabase
          .from('cryptocurrency_rates')
          .select('from_currency,to_currency,rate')
          .eq('from_currency', 'PHP'),
        supabase
          .from('pairs')
          .select('from_currency,to_currency,rate,source_table,updated_at')
          .eq('from_currency', 'PHP')
      ])

      if (currenciesRes.error) throw currenciesRes.error
      if (fiatRatesRes.error) throw fiatRatesRes.error
      if (cryptoRatesRes.error) throw cryptoRatesRes.error
      if (pairsRes.error) throw pairsRes.error

      const currencyMap = {}
      currenciesRes.data?.forEach(c => {
        currencyMap[c.code] = c
      })
      setCurrencies(currencyMap)

      const fiatCodes = new Set((fiatRatesRes.data || []).map(r => r.to_currency))
      const cryptoCodes = new Set((cryptoRatesRes.data || []).map(r => r.to_currency))

      const processedRates = (pairsRes.data || [])
        .map(pair => {
          const isFromFiat = fiatCodes.has(pair.to_currency)
          const isFromCrypto = cryptoCodes.has(pair.to_currency)
          const type = isFromCrypto ? 'crypto' : isFromFiat ? 'fiat' : (pair.source_table === 'cryptocurrency_rates' ? 'crypto' : 'fiat')

          return {
            code: pair.to_currency,
            rate: Number(pair.rate),
            metadata: currencyMap[pair.to_currency] || {
              code: pair.to_currency,
              name: pair.to_currency,
              type: type,
              symbol: '',
              decimals: type === 'crypto' ? 8 : 2
            },
            source: pair.source_table,
            updatedAt: pair.updated_at
          }
        })
        .filter(r => isFinite(r.rate) && r.rate > 0)
        .sort((a, b) => a.code.localeCompare(b.code))

      const phpExists = processedRates.some(r => r.code === 'PHP')
      if (currencyMap['PHP'] && !phpExists) {
        processedRates.unshift({
          code: 'PHP',
          rate: 1,
          metadata: currencyMap['PHP'],
          source: 'base',
          updatedAt: new Date().toISOString()
        })
      }

      setRates(processedRates)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Error loading rates:', err)
      setError('Failed to load exchange rates. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const filteredRates = useMemo(() => {
    let filtered = rates

    if (typeFilter !== 'all') {
      filtered = filtered.filter(r => r.metadata?.type === typeFilter)
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(r =>
        r.code.toLowerCase().includes(search) ||
        r.metadata?.name?.toLowerCase().includes(search)
      )
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'code':
          return a.code.localeCompare(b.code)
        case 'name':
          return (a.metadata?.name || '').localeCompare(b.metadata?.name || '')
        case 'rate':
          return b.rate - a.rate
        case 'recent':
          return new Date(b.updatedAt) - new Date(a.updatedAt)
        default:
          return 0
      }
    })

    return sorted
  }, [rates, typeFilter, searchTerm, sortBy])

  const favoriteRates = useMemo(() => {
    return rates.filter(r => favorites.includes(r.code))
  }, [rates, favorites])

  const calculateConversion = () => {
    const numAmount = parseFloat(amount)
    if (!isNaN(numAmount) && numAmount > 0) {
      const fromRate = rates.find(r => r.code === selectedFrom)
      const toRate = rates.find(r => r.code === selectedTo)

      if (fromRate && toRate && fromRate.rate > 0 && toRate.rate > 0) {
        const convertedAmount = (numAmount * toRate.rate) / fromRate.rate
        const toDecimals = toRate.metadata?.decimals || 2
        setResult({
          amount: convertedAmount.toFixed(toDecimals),
          decimals: toDecimals,
          rate: toRate.rate / fromRate.rate
        })
      } else {
        setResult(null)
      }
    } else {
      setResult(null)
    }
  }

  useEffect(() => {
    calculateConversion()
  }, [amount, selectedFrom, selectedTo, rates])

  const toggleFavorite = (code) => {
    setFavorites(prev =>
      prev.includes(code)
        ? prev.filter(c => c !== code)
        : [...prev, code]
    )
  }

  const formatNumber = (num, decimals = 2) => {
    if (num == null || !isFinite(num)) return '—'
    return Number(num).toLocaleString(undefined, {
      minimumFractionDigits: Math.min(decimals, 2),
      maximumFractionDigits: Math.max(decimals, 6)
    })
  }

  const getCurrencyIcon = (type) => {
    return type === 'crypto' ? '₿' : '$'
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-slate-500 text-lg">Loading exchange rates...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-12 border border-red-200">
        <p className="text-red-600 text-center text-lg font-medium">{error}</p>
        <button
          onClick={loadData}
          className="mt-4 mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (rates.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
        <p className="text-slate-500 text-lg">No exchange rates available</p>
      </div>
    )
  }

  const fromCurrency = rates.find(r => r.code === selectedFrom)
  const toCurrency = rates.find(r => r.code === selectedTo)

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-xl p-8 text-white">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-4xl font-bold">Exchange Rates</h1>
          <div className="text-sm text-slate-300">
            Last updated: {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <p className="text-slate-300 text-lg">Real-time currency and cryptocurrency exchange rates from PHP</p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Converter */}
        <div className="col-span-2 space-y-6">
          {/* Converter Card */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
            <h2 className="text-2xl font-semibold text-slate-900 mb-6">Currency Converter</h2>

            <div className="space-y-6">
              {/* From Currency */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">From</label>
                <select
                  value={selectedFrom}
                  onChange={(e) => setSelectedFrom(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {rates.map(r => (
                    <option key={r.code} value={r.code}>
                      {r.code} - {r.metadata?.name || r.code}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Amount</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                  placeholder="0.00"
                />
              </div>

              {/* To Currency */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">To</label>
                <select
                  value={selectedTo}
                  onChange={(e) => setSelectedTo(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {rates.map(r => (
                    <option key={r.code} value={r.code}>
                      {r.code} - {r.metadata?.name || r.code}
                    </option>
                  ))}
                </select>
              </div>

              {/* Result */}
              {result && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                  <p className="text-sm text-slate-600 mb-2">Result</p>
                  <div className="text-4xl font-bold text-blue-600 mb-2">
                    {result.amount} {selectedTo}
                  </div>
                  <p className="text-sm text-slate-600">
                    1 {selectedFrom} = {formatNumber(result.rate, toCurrency?.metadata?.decimals || 2)} {selectedTo}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Rates Table */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-slate-900">All Rates</h2>
              <div className="text-sm text-slate-500">
                {filteredRates.length} currency pair{filteredRates.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Controls */}
            <div className="mb-6 space-y-4">
              {/* Search */}
              <input
                type="text"
                placeholder="Search by currency code or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />

              {/* Filters and Sort */}
              <div className="flex flex-wrap gap-3">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Types</option>
                  <option value="fiat">Fiat Only</option>
                  <option value="crypto">Crypto Only</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="code">Sort by Code</option>
                  <option value="name">Sort by Name</option>
                  <option value="rate">Sort by Rate</option>
                  <option value="recent">Recently Updated</option>
                </select>
              </div>
            </div>

            {/* Rates List */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Currency</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Type</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700 text-sm">Rate (per 1 PHP)</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-700 text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRates.map(currency => (
                    <tr key={currency.code} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{currency.metadata?.symbol || getCurrencyIcon(currency.metadata?.type)}</span>
                          <span className="font-semibold text-slate-900">{currency.code}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{currency.metadata?.name || currency.code}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          currency.metadata?.type === 'crypto'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {currency.metadata?.type === 'crypto' ? 'Cryptocurrency' : 'Fiat'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-900">
                        {formatNumber(currency.rate, currency.metadata?.decimals || 2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => toggleFavorite(currency.code)}
                          className={`text-xl transition ${
                            favorites.includes(currency.code)
                              ? 'text-yellow-400 hover:text-yellow-500'
                              : 'text-slate-300 hover:text-yellow-400'
                          }`}
                        >
                          ★
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column - Favorites and Info */}
        <div className="space-y-6">
          {/* Favorites Card */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Favorite Rates</h3>
            <div className="space-y-3">
              {favoriteRates.length > 0 ? (
                favoriteRates.map(curr => (
                  <div
                    key={curr.code}
                    className="p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition cursor-pointer"
                    onClick={() => setSelectedFrom(curr.code)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-semibold text-slate-900">{curr.code}</div>
                        <div className="text-xs text-slate-500">{curr.metadata?.name}</div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleFavorite(curr.code)
                        }}
                        className="text-yellow-400 hover:text-yellow-500 text-lg"
                      >
                        ★
                      </button>
                    </div>
                    <div className="text-sm font-mono text-slate-900">
                      {formatNumber(curr.rate, curr.metadata?.decimals || 2)}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-6">Add currencies to favorites</p>
              )}
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-slate-50 rounded-2xl shadow-lg p-6 border border-slate-200 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Information</h3>

            {fromCurrency && (
              <div className="pb-4 border-b border-slate-200">
                <p className="text-xs text-slate-600 font-medium mb-1">Base Currency</p>
                <p className="text-sm font-semibold text-slate-900">{fromCurrency.metadata?.name}</p>
                <p className="text-xs text-slate-500 mt-1">{fromCurrency.code}</p>
              </div>
            )}

            {toCurrency && (
              <div className="pb-4 border-b border-slate-200">
                <p className="text-xs text-slate-600 font-medium mb-1">Target Currency</p>
                <p className="text-sm font-semibold text-slate-900">{toCurrency.metadata?.name}</p>
                <p className="text-xs text-slate-500 mt-1">{toCurrency.code}</p>
              </div>
            )}

            <div>
              <p className="text-xs text-slate-600 font-medium mb-1">Data Source</p>
              <p className="text-xs text-slate-500">
                Real-time rates from fiat and cryptocurrency markets
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-600 font-medium mb-1">Coverage</p>
              <p className="text-xs text-slate-500">
                {rates.length} currencies tracked
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Total Currencies</span>
                <span className="text-lg font-semibold text-slate-900">{rates.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Fiat Currencies</span>
                <span className="text-lg font-semibold text-slate-900">{rates.filter(r => r.metadata?.type === 'fiat').length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Cryptocurrencies</span>
                <span className="text-lg font-semibold text-slate-900">{rates.filter(r => r.metadata?.type === 'crypto').length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
