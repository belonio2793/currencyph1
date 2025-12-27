import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatLastUpdated, formatFullDateTime } from '../lib/dateTimeUtils'
import CurrencyCryptoToggle from './FiatCryptoToggle'
import SearchableSelect from './SearchableSelect'

export default function Rates() {
  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  const [selectedFrom, setSelectedFrom] = useState(null)
  const [selectedTo, setSelectedTo] = useState(null)
  const [amount, setAmount] = useState('1')
  const [result, setResult] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [activeType, setActiveType] = useState('all')
  const [sortBy, setSortBy] = useState('code')
  const [sortDirection, setSortDirection] = useState('asc')
  const [favorites, setFavorites] = useState([])

  // Load all rates from public_pairs (unified source for all currency pairs)
  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5 * 60 * 1000) // Refresh every 5 minutes
    return () => clearInterval(interval)
  }, [])

  // Set default currencies when rates load
  useEffect(() => {
    if (rates.length > 0 && !selectedFrom) {
      const phpRate = rates.find(r => r.code === 'PHP')
      setSelectedFrom(phpRate?.code || rates[0].code)
    }

    if (rates.length > 0 && !selectedTo) {
      const usdRate = rates.find(r => r.code === 'USD')
      const firstNonSelected = rates.find(r => r.code !== selectedFrom)
      setSelectedTo(usdRate?.code || firstNonSelected?.code)
    }
  }, [rates, selectedFrom, selectedTo])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!supabase || typeof supabase.from !== 'function') {
        throw new Error('Supabase client not properly initialized')
      }

      // Fetch all currency pairs from public_pairs (primary unified source)
      const { data: pairsData, error: pairsError } = await supabase
        .from('pairs')
        .select('from_currency, to_currency, rate, source_table, updated_at')
        .limit(10000)

      if (pairsError) {
        throw new Error(`Failed to fetch pairs: ${pairsError.message}`)
      }

      if (!pairsData || pairsData.length === 0) {
        throw new Error('No currency pairs available in database')
      }

      // Get unique currency codes
      const codes = new Set()
      pairsData.forEach(pair => {
        if (pair.from_currency) codes.add(pair.from_currency)
        if (pair.to_currency) codes.add(pair.to_currency)
      })

      const codeArray = Array.from(codes)

      // Fetch fiat currency codes - use the pairs table which has all data
      const { data: fiatData } = await supabase
        .from('pairs')
        .select('from_currency')
        .eq('source_table', 'currency_rates')
        .limit(10000)

      // Fetch crypto currency codes
      const { data: cryptoData } = await supabase
        .from('pairs')
        .select('from_currency')
        .eq('source_table', 'cryptocurrency_rates')
        .limit(10000)

      // Build metadata map - preference: crypto first, then fiat
      const cryptoCodes = new Set(cryptoData?.map(row => row.from_currency) || [])
      const fiatCodes = new Set(fiatData?.map(row => row.from_currency) || [])

      // Build rates list - one entry per unique currency code
      const ratesByCode = {}
      let mostRecentTime = new Date()

      codeArray.forEach(code => {
        const isCrypto = cryptoCodes.has(code)
        const isFiat = fiatCodes.has(code)

        // Determine type: if in both tables, prefer crypto
        let type = 'currency'
        if (isCrypto) {
          type = 'cryptocurrency'
        } else if (isFiat) {
          type = 'currency'
        }

        ratesByCode[code] = {
          code,
          rate: null,
          type,
          updatedAt: new Date().toISOString()
        }
      })

      // Populate rates from pairs data
      pairsData.forEach(pair => {
        if (pair.rate && isFinite(Number(pair.rate)) && Number(pair.rate) > 0) {
          const fromCode = pair.from_currency
          if (ratesByCode[fromCode]) {
            ratesByCode[fromCode].rate = Number(pair.rate)
            ratesByCode[fromCode].updatedAt = pair.updated_at || new Date().toISOString()

            // Track most recent timestamp
            const pairTime = new Date(pair.updated_at || 0)
            if (pairTime > mostRecentTime) {
              mostRecentTime = pairTime
            }
          }
        }
      })

      // Convert to array and sort (rates with values first)
      const ratesWithValues = Object.values(ratesByCode)
        .filter(r => r.rate !== null && isFinite(r.rate) && r.rate > 0)
        .sort((a, b) => a.code.localeCompare(b.code))
        .map(r => ({
          ...r,
          value: r.code,
          label: r.code,
          id: r.code
        }))

      const ratesWithoutValues = Object.values(ratesByCode)
        .filter(r => r.rate === null || !isFinite(r.rate) || r.rate <= 0)
        .sort((a, b) => a.code.localeCompare(b.code))
        .map(r => ({
          ...r,
          value: r.code,
          label: r.code,
          id: r.code
        }))

      const validRates = [...ratesWithValues, ...ratesWithoutValues]

      setRates(validRates)
      setLastUpdated(mostRecentTime)
      console.log(`Loaded ${validRates.length} rates (${ratesWithValues.length} with values, ${ratesWithoutValues.length} without)`)
      setError(null)
    } catch (err) {
      const errorMsg = err?.message || String(err) || 'Unknown error'
      console.error('Error loading rates:', errorMsg)
      setError(`Failed to load exchange rates: ${errorMsg}`)
      setRates([])
    } finally {
      setLoading(false)
    }
  }

  const filteredRates = useMemo(() => {
    let filtered = rates

    if (typeFilter !== 'all') {
      filtered = filtered.filter(r => r.type === typeFilter)
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(r => r.code.toLowerCase().includes(search))
    }

    // Separate rates with values from those without
    const ratesWithValues = filtered.filter(r => r.rate !== null && isFinite(r.rate) && r.rate > 0)
    const ratesWithoutValues = filtered.filter(r => r.rate === null || !isFinite(r.rate) || r.rate <= 0)

    // Sort each group
    const sortGroup = (group) => {
      return [...group].sort((a, b) => {
        let comparison = 0

        switch (sortBy) {
          case 'code':
            comparison = a.code.localeCompare(b.code)
            break
          case 'rate':
            comparison = (a.rate || 0) - (b.rate || 0)
            break
          case 'recent':
            comparison = new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
            break
          default:
            comparison = 0
        }

        return sortDirection === 'asc' ? comparison : -comparison
      })
    }

    return [...sortGroup(ratesWithValues), ...sortGroup(ratesWithoutValues)]
  }, [rates, typeFilter, searchTerm, sortBy, sortDirection])

  const favoriteRates = useMemo(() => {
    return rates.filter(r => favorites.includes(r.code))
  }, [rates, favorites])

  const calculateConversion = () => {
    const numAmount = parseFloat(amount)
    if (!isNaN(numAmount) && numAmount > 0) {
      const fromRate = rates.find(r => r.code === selectedFrom)
      const toRate = rates.find(r => r.code === selectedTo)

      if (!fromRate || !toRate) {
        setResult({
          error: 'Rate not available',
          message: `Exchange rate for ${!fromRate ? selectedFrom : selectedTo} is not available.`
        })
        return
      }

      const fromRateValid = isFinite(fromRate.rate) && fromRate.rate > 0
      const toRateValid = isFinite(toRate.rate) && toRate.rate > 0

      if (!fromRateValid || !toRateValid) {
        setResult({
          error: 'Rate not available',
          message: 'Exchange rate data is not available for the selected currencies.'
        })
        return
      }

      const convertedAmount = (numAmount * toRate.rate) / fromRate.rate
      setResult({
        amount: convertedAmount.toFixed(2),
        decimals: 2,
        rate: toRate.rate / fromRate.rate
      })
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

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
        <div className="flex justify-center mb-4">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-blue-600"></div>
        </div>
        <p className="text-slate-600 text-lg font-medium">Loading exchange rates...</p>
        <p className="text-slate-500 text-sm mt-2">Please wait while we fetch the latest rates</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-red-200">
        <div className="text-center mb-6">
          <div className="inline-block p-3 bg-red-100 rounded-full mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 0v2m0-6v-2m0 0V7a2 2 0 012-2h.5a2 2 0 012 2v1m0 0a2 2 0 012 2v3m0 0a2 2 0 01-2 2h-.5a2 2 0 01-2-2m0 0V9m0 0a2 2 0 00-2-2H7a2 2 0 00-2 2m6 6a2 2 0 01-2-2m0 0V7a2 2 0 012-2h.5a2 2 0 012 2v1" />
            </svg>
          </div>
          <p className="text-red-600 text-center text-lg font-semibold">{error}</p>
        </div>
        <button
          onClick={loadData}
          className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-md hover:shadow-lg"
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
  const fiatCount = rates.filter(r => r.type === 'currency').length
  const cryptoCount = rates.filter(r => r.type === 'cryptocurrency').length

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
                <div className="flex items-center gap-3 mb-6">
                  <div className="px-3 py-2 bg-blue-100 rounded-lg text-blue-700 font-bold">FX</div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">Currency Converter</h2>
                </div>

                <div className="space-y-4">
                  {/* From Currency */}
                  <SearchableSelect
                    value={selectedFrom}
                    onChange={setSelectedFrom}
                    options={rates}
                    label="From"
                  />

                  {/* Amount Input */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Amount</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-medium"
                      placeholder="0.00"
                    />
                  </div>

                  {/* Swap Button */}
                  <div className="flex justify-center">
                    <button
                      onClick={() => {
                        const temp = selectedFrom
                        setSelectedFrom(selectedTo)
                        setSelectedTo(temp)
                      }}
                      className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition text-slate-700 font-semibold"
                      title="Swap currencies"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m0 0l4 4m10-4v12m0 0l4-4m0 0l-4-4" />
                      </svg>
                    </button>
                  </div>

                  {/* To Currency */}
                  <SearchableSelect
                    value={selectedTo}
                    onChange={setSelectedTo}
                    options={rates}
                    label="To"
                  />

                  {/* Result */}
                  {result && !result.error && (
                    <div className="bg-white rounded-xl p-6 border-2 border-slate-300 mt-6">
                      <p className="text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wider">Conversion Result</p>
                      <div className="flex items-baseline justify-between mb-3">
                        <div>
                          <p className="text-5xl font-bold text-slate-900 mb-1">
                            {result.amount}
                          </p>
                          <p className="text-lg font-semibold text-slate-700">
                            {selectedTo}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-slate-600 mb-1">Exchange Rate</p>
                          <p className="text-lg font-mono font-semibold text-slate-900">
                            1 {selectedFrom} = {formatNumber(result.rate, 6)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Rates Table */}
              <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 border border-slate-200">
                {/* Last Updated Info Banner */}
                <div className="mb-6 p-4 bg-slate-50 border border-slate-300 rounded-lg">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-sm text-slate-900">
                        <span className="font-semibold">Last Updated:</span>{' '}
                        <span className="text-slate-700">{formatFullDateTime(lastUpdated)}</span>
                      </p>
                      {lastUpdated && (
                        <p className="text-xs text-slate-600 mt-1">
                          {(() => {
                            const minutes = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 1000 / 60)
                            if (minutes < 1) return 'Just now'
                            if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
                            const hours = Math.floor(minutes / 60)
                            if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
                            return `${Math.floor(hours / 24)} day${Math.floor(hours / 24) !== 1 ? 's' : ''} ago`
                          })()}
                        </p>
                      )}
                    </div>
                    {!loading && (
                      <button
                        onClick={loadData}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition whitespace-nowrap"
                      >
                        {loading ? 'Refreshing...' : 'Refresh'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">Exchange Rates</h2>
                  </div>
                  <div className="text-sm font-medium text-slate-700">
                    <span className="text-blue-600">{fiatCount}</span> Fiat •{' '}
                    <span className="text-orange-600">{cryptoCount}</span> Crypto
                  </div>
                </div>

                {/* Controls */}
                <div className="mb-6 space-y-4">
                  {/* Search */}
                  <input
                    type="text"
                    placeholder="Search by currency code..."
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

                {/* Rates Table */}
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
                          Rate {sortBy === 'rate' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-slate-700 text-sm">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRates.map(currency => (
                        <tr
                          key={currency.code}
                          className={`border-b border-slate-100 hover:bg-slate-50 transition ${
                            currency.type === 'cryptocurrency' ? 'hover:bg-orange-50' : 'hover:bg-blue-50'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-600">
                                {currency.type === 'cryptocurrency' ? 'CRY' : 'FIA'}
                              </span>
                              <span className="font-semibold text-slate-900">{currency.code}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-900">
                              {currency.type === 'cryptocurrency' ? 'Cryptocurrency' : 'Fiat'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-900 font-medium">
                            {formatNumber(currency.rate, 2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => toggleFavorite(currency.code)}
                              className={`text-xs font-semibold px-2 py-1 rounded transition ${
                                favorites.includes(currency.code)
                                  ? 'bg-yellow-200 text-yellow-900 hover:bg-yellow-300 animate-pulse'
                                  : 'bg-slate-200 text-slate-600 hover:bg-yellow-200'
                              }`}
                              title={favorites.includes(currency.code) ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              {favorites.includes(currency.code) ? 'FAV' : 'Add'}
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
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Favorite Rates</h3>
                </div>
                <div className="space-y-3">
                  {favoriteRates.length > 0 ? (
                    favoriteRates.map(curr => (
                      <div
                        key={curr.code}
                        className="p-4 border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                        onClick={() => setSelectedFrom(curr.code)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-xs font-semibold text-slate-600">
                              {curr.type === 'cryptocurrency' ? 'CRY' : 'FIA'}
                            </span>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900">{curr.code}</div>
                              <div className="text-xs text-slate-500">{curr.type}</div>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleFavorite(curr.code)
                            }}
                            className="text-xs font-semibold px-2 py-1 rounded bg-yellow-200 text-yellow-900 hover:bg-yellow-300 ml-2 flex-shrink-0"
                            title="Remove from favorites"
                          >
                            DEL
                          </button>
                        </div>
                        <div className="text-sm font-mono font-semibold text-slate-900 ml-7">
                          {formatNumber(curr.rate, 2)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-8">
                      <span className="block mb-2">No favorites yet</span>
                      Add currencies to favorites by clicking the Add button in the rates table
                    </p>
                  )}
                </div>
              </div>

              {/* Info Card */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl shadow-lg p-6 border border-slate-200 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-slate-900">Information</h3>
                </div>

                {fromCurrency && (
                  <div className="pb-4 border-b border-slate-300">
                    <p className="text-xs text-slate-600 font-medium mb-1 uppercase tracking-wider">From Currency</p>
                    <p className="text-sm font-semibold text-slate-900">{fromCurrency.code}</p>
                    <p className="text-xs text-slate-500 mt-1">{fromCurrency.type}</p>
                  </div>
                )}

                {toCurrency && (
                  <div className="pb-4 border-b border-slate-300">
                    <p className="text-xs text-slate-600 font-medium mb-1 uppercase tracking-wider">To Currency</p>
                    <p className="text-sm font-semibold text-slate-900">{toCurrency.code}</p>
                    <p className="text-xs text-slate-500 mt-1">{toCurrency.type}</p>
                  </div>
                )}

                <div className="pb-4 border-b border-slate-300">
                  <p className="text-xs text-slate-600 font-medium mb-1 uppercase tracking-wider">Data Source</p>
                  <p className="text-xs text-slate-500">
                    currency_rates (fiat) + cryptocurrency_rates (crypto) via public_pairs
                  </p>
                </div>

                <div className="pb-4 border-b border-slate-300">
                  <p className="text-xs text-slate-600 font-medium mb-1 uppercase tracking-wider">Coverage</p>
                  <p className="text-xs text-slate-500">
                    {rates.length} currencies ({fiatCount} fiat, {cryptoCount} crypto)
                  </p>
                </div>

                <div className="pt-2">
                  <p className="text-xs text-slate-600 font-medium mb-1 uppercase tracking-wider">Update Frequency</p>
                  <p className="text-xs text-slate-500">
                    Hourly updates
                  </p>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Overview</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-medium text-slate-700">Total Rates</span>
                    <span className="text-lg font-bold text-slate-900">{rates.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-100 rounded-lg">
                    <span className="text-sm font-medium text-slate-700">Fiat Currencies</span>
                    <span className="text-lg font-bold text-slate-900">{fiatCount}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-100 rounded-lg">
                    <span className="text-sm font-medium text-slate-700">Cryptocurrencies</span>
                    <span className="text-lg font-bold text-slate-900">{cryptoCount}</span>
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
