import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { preferencesManager } from '../lib/preferencesManager'
import CurrencyCryptoToggle from './FiatCryptoToggle'

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
  const [activeType, setActiveType] = useState('all') // 'all', 'currency' or 'cryptocurrency'
  const [sortBy, setSortBy] = useState('code')
  const [sortDirection, setSortDirection] = useState('asc')
  const [favorites, setFavorites] = useState(['PHP', 'USD', 'EUR', 'BTC', 'ETH'])
  const [trackedCurrencies, setTrackedCurrencies] = useState(preferencesManager.getDefaultTrackedCurrencies())
  const [customizationOpen, setCustomizationOpen] = useState(false)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // 1. Fetch all pairs from pairs table with pagination
      console.log('📥 Starting to fetch all pairs from public.pairs table...')
      const pageSize = 500
      let allPairs = []
      let offset = 0
      let hasMore = true
      let pageCount = 0

      while (hasMore) {
        try {
          console.log(`📥 Fetching page ${pageCount + 1} at offset ${offset}...`)

          const pairsRes = await supabase
            .from('pairs')
            .select('from_currency,to_currency,rate,source_table,updated_at', { count: 'exact' })
            .range(offset, offset + pageSize - 1)

          if (pairsRes.error) {
            console.error('❌ pairs query failed with error:')
            console.error('  Error message:', pairsRes.error.message)
            console.error('  Error details:', JSON.stringify(pairsRes.error, null, 2))
            throw new Error(`Supabase error: ${pairsRes.error.message}`)
          }

          const pageData = pairsRes.data || []
          console.log(`✅ Page ${pageCount + 1}: Got ${pageData.length} pairs (total so far: ${allPairs.length + pageData.length})`)

          if (pageData.length === 0) {
            hasMore = false
            console.log('📭 No more data, pagination complete')
          } else {
            allPairs.push(...pageData)
            offset += pageSize
            pageCount++

            // Delay between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        } catch (pageErr) {
          console.error(`❌ Error loading page ${pageCount + 1}:`, pageErr)
          throw new Error(`Failed to load pairs at page ${pageCount + 1}: ${pageErr.message}`)
        }
      }

      console.log(`✅ Pagination complete! Loaded ${allPairs.length} total rate pairs from ${pageCount} pages`)

      // 2. Extract all unique currencies and cryptocurrencies from pairs
      const uniqueCodes = new Set()
      let timestamps = []

      allPairs.forEach(pair => {
        if (pair.from_currency) uniqueCodes.add(pair.from_currency)
        if (pair.to_currency) uniqueCodes.add(pair.to_currency)
        if (pair.updated_at) timestamps.push(new Date(pair.updated_at))
      })

      const codesArray = Array.from(uniqueCodes)
      console.log(`📊 Found ${codesArray.length} unique currency codes in pairs table`)

      // 3. Fetch metadata for all currencies and cryptocurrencies
      let allMetadata = {}
      const [currenciesRes, cryptosRes] = await Promise.all([
        supabase
          .from('currencies')
          .select('code,name,type,symbol,decimals,is_default,active'),
        supabase
          .from('cryptocurrencies')
          .select('code,name,coingecko_id')
      ])

      if (currenciesRes.data) {
        currenciesRes.data.forEach(c => {
          allMetadata[c.code] = { ...c, type: 'currency' }
        })
      }

      if (cryptosRes.data) {
        cryptosRes.data.forEach(c => {
          allMetadata[c.code] = { ...c, type: 'cryptocurrency' }
        })
      }

      setCurrencies(allMetadata)
      console.log(`📋 Loaded metadata for ${Object.keys(allMetadata).length} currencies/cryptos`)

      // 4. Build deduplicated rates list
      const ratesByCode = {}

      // Process all pairs to find the best rate for each unique code
      allPairs.forEach(pair => {
        // Track from_currency
        if (pair.from_currency && !ratesByCode[pair.from_currency]) {
          const metadata = allMetadata[pair.from_currency] || {
            code: pair.from_currency,
            name: pair.from_currency,
            type: 'currency',
            symbol: '',
            decimals: 2
          }

          ratesByCode[pair.from_currency] = {
            code: pair.from_currency,
            rate: null,
            metadata: metadata,
            source: pair.source_table || 'pairs',
            updatedAt: pair.updated_at || new Date().toISOString()
          }
        }

        // Track to_currency
        if (pair.to_currency && !ratesByCode[pair.to_currency]) {
          const metadata = allMetadata[pair.to_currency] || {
            code: pair.to_currency,
            name: pair.to_currency,
            type: 'currency',
            symbol: '',
            decimals: 2
          }

          ratesByCode[pair.to_currency] = {
            code: pair.to_currency,
            rate: null,
            metadata: metadata,
            source: pair.source_table || 'pairs',
            updatedAt: pair.updated_at || new Date().toISOString()
          }
        }

        // Try to extract rate if available
        if (pair.rate && isFinite(Number(pair.rate)) && Number(pair.rate) > 0) {
          if (pair.from_currency === 'PHP' && pair.to_currency && !ratesByCode[pair.to_currency].rate) {
            ratesByCode[pair.to_currency].rate = Number(pair.rate)
            ratesByCode[pair.to_currency].updatedAt = pair.updated_at || new Date().toISOString()
          } else if (pair.to_currency === 'PHP' && pair.from_currency && !ratesByCode[pair.from_currency].rate) {
            const invertedRate = 1 / Number(pair.rate)
            if (isFinite(invertedRate) && invertedRate > 0) {
              ratesByCode[pair.from_currency].rate = invertedRate
              ratesByCode[pair.from_currency].updatedAt = pair.updated_at || new Date().toISOString()
            }
          }
        }
      })

      // 5. Get the most recent timestamp
      let mostRecentTimestamp = new Date()
      if (timestamps.length > 0) {
        timestamps.sort((a, b) => b - a)
        mostRecentTimestamp = timestamps[0]
      }

      // 6. Sort: rates with values first, then without
      const ratesWithValues = Object.values(ratesByCode)
        .filter(r => r.rate !== null && isFinite(r.rate) && r.rate > 0)
        .sort((a, b) => a.code.localeCompare(b.code))

      const ratesWithoutValues = Object.values(ratesByCode)
        .filter(r => r.rate === null || !isFinite(r.rate) || r.rate <= 0)
        .sort((a, b) => a.code.localeCompare(b.code))

      const validRates = [...ratesWithValues, ...ratesWithoutValues]

      setRates(validRates)
      setLastUpdated(mostRecentTimestamp)
      console.log(`✅ Final rates list: ${validRates.length} unique items (${ratesWithValues.length} with rates)`)
    } catch (err) {
      const errorMsg = err?.message || String(err) || 'Unknown error'
      console.error('❌ Error loading rates:', errorMsg)
      console.error('Full error object:', err)

      // Check if it's a network error
      if (err.message?.includes('Failed to fetch')) {
        setError(`Network error - could not connect to database. Please check your internet connection.`)
      } else if (err.message?.includes('CORS')) {
        setError(`CORS error - check Supabase configuration`)
      } else {
        setError(`Failed to load exchange rates: ${errorMsg}`)
      }
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
      let comparison = 0

      switch (sortBy) {
        case 'code':
          comparison = a.code.localeCompare(b.code)
          break
        case 'name':
          comparison = (a.metadata?.name || '').localeCompare(b.metadata?.name || '')
          break
        case 'rate':
          comparison = a.rate - b.rate
          break
        case 'recent':
          comparison = new Date(b.updatedAt) - new Date(a.updatedAt)
          break
        default:
          comparison = 0
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [rates, typeFilter, searchTerm, sortBy, sortDirection])

  const favoriteRates = useMemo(() => {
    return rates.filter(r => favorites.includes(r.code))
  }, [rates, favorites])

  const calculateConversion = () => {
    const numAmount = parseFloat(amount)
    if (!isNaN(numAmount) && numAmount > 0) {
      const fromRate = rates.find(r => r.code === selectedFrom)
      const toRate = rates.find(r => r.code === selectedTo)

      if (fromRate && toRate && isFinite(fromRate.rate) && fromRate.rate > 0 && isFinite(toRate.rate) && toRate.rate > 0) {
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

  const handleTypeChange = (type) => {
    setActiveType(type)
    setTypeFilter(type)
  }

  const formatNumber = (num, decimals = 2) => {
    if (num == null || !isFinite(num) || num <= 0) return '—'
    return Number(num).toLocaleString(undefined, {
      minimumFractionDigits: Math.min(decimals, 2),
      maximumFractionDigits: Math.max(decimals, 6)
    })
  }

  const getCurrencyIcon = (type) => {
    return type === 'cryptocurrency' ? '₿' : '$'
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
    <div className="w-full min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
        <div className="space-y-6 sm:space-y-8">
          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Left Column - Converter */}
        <div className="lg:col-span-2 space-y-6">
          {/* Converter Card */}
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 border border-slate-200">
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-6">Currency Converter</h2>

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
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 border border-slate-200">
            {/* Last Updated Info Banner */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <span className="font-semibold">Last Fetched Rates:</span>{' '}
                {lastUpdated.toLocaleString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">All Rates</h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-slate-500">
                  {filteredRates.length} currency pair{filteredRates.length !== 1 ? 's' : ''}
                </div>
                <button
                  onClick={loadData}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {loading ? '🔄 Refreshing...' : '🔄 Refresh'}
                </button>
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
              <div className="flex flex-wrap gap-3 items-center">
                <CurrencyCryptoToggle active={activeType} onChange={handleTypeChange} />

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="code">Sort by Code</option>
                  <option value="name">Sort by Name</option>
                  <option value="rate">Sort by Rate</option>
                  <option value="recent">Recently Updated</option>
                </select>

                <button
                  onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  {sortDirection === 'asc' ? '↑ Ascending' : '↓ Descending'}
                </button>
              </div>
            </div>

            {/* Rates List */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th
                      onClick={() => {
                        if (sortBy === 'code') {
                          setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                        } else {
                          setSortBy('code')
                          setSortDirection('asc')
                        }
                      }}
                      className="text-left py-3 px-4 font-semibold text-slate-700 text-sm cursor-pointer hover:bg-slate-100 transition select-none"
                    >
                      Currency {sortBy === 'code' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      onClick={() => {
                        if (sortBy === 'name') {
                          setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                        } else {
                          setSortBy('name')
                          setSortDirection('asc')
                        }
                      }}
                      className="text-left py-3 px-4 font-semibold text-slate-700 text-sm cursor-pointer hover:bg-slate-100 transition select-none"
                    >
                      Name {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Type</th>
                    <th
                      onClick={() => {
                        if (sortBy === 'rate') {
                          setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                        } else {
                          setSortBy('rate')
                          setSortDirection('desc')
                        }
                      }}
                      className="text-right py-3 px-4 font-semibold text-slate-700 text-sm cursor-pointer hover:bg-slate-100 transition select-none"
                    >
                      Rate (per 1 PHP) {sortBy === 'rate' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-700 text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRates.map(currency => (
                    <tr key={currency.code} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900">{currency.code}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{currency.metadata?.name || currency.code}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          currency.metadata?.type === 'cryptocurrency'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {currency.metadata?.type === 'cryptocurrency' ? 'Cryptocurrency' : 'Currency'}
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
        <div className="lg:col-span-1 space-y-6">
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

            <div className="pt-2 border-t border-slate-200">
              <p className="text-xs text-slate-600 font-medium mb-1">Last Updated</p>
              <p className="text-xs text-slate-500">
                {lastUpdated.toLocaleString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
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
                <span className="text-sm text-slate-600">Currencies</span>
                <span className="text-lg font-semibold text-slate-900">{rates.filter(r => r.metadata?.type === 'currency').length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Cryptocurrencies</span>
                <span className="text-lg font-semibold text-slate-900">{rates.filter(r => r.metadata?.type === 'cryptocurrency').length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  )
}
