import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatLastUpdated, formatFullDateTime } from '../lib/dateTimeUtils'
import CurrencyCryptoToggle from './FiatCryptoToggle'
import CurrencySelect from './CurrencySelect'

export default function Rates() {
  const [currencies, setCurrencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  const [selectedFrom, setSelectedFrom] = useState(null)
  const [selectedTo, setSelectedTo] = useState(null)
  const [amount, setAmount] = useState('1')
  const [result, setResult] = useState(null)

  // Rates table view - default conversion target is USD
  const [targetCurrency, setTargetCurrency] = useState('USD')
  const [exchangeRates, setExchangeRates] = useState({})

  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [activeType, setActiveType] = useState('all')
  const [sortBy, setSortBy] = useState('code')
  const [sortDirection, setSortDirection] = useState('asc')
  const [favorites, setFavorites] = useState([])

  // Load all rates from database (currencies table + pairs table)
  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5 * 60 * 1000) // Refresh every 5 minutes
    return () => clearInterval(interval)
  }, [])

  // Load exchange rates when target currency changes
  useEffect(() => {
    if (currencies.length > 0 && targetCurrency) {
      loadExchangeRates(targetCurrency)
    }
  }, [targetCurrency, currencies])

  // Set default currencies when currencies load
  useEffect(() => {
    if (currencies.length > 0 && !selectedFrom) {
      const phpCurrency = currencies.find(c => c.code === 'PHP')
      setSelectedFrom(phpCurrency?.code || currencies[0].code)
    }

    if (currencies.length > 0 && !selectedTo) {
      const usdCurrency = currencies.find(c => c.code === 'USD')
      const firstNonSelected = currencies.find(c => c.code !== selectedFrom)
      setSelectedTo(usdCurrency?.code || firstNonSelected?.code)
    }
  }, [currencies, selectedFrom, selectedTo])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!supabase || typeof supabase.from !== 'function') {
        throw new Error('Supabase client not properly initialized')
      }

      // Fetch all active currencies from the currencies table
      const { data: currenciesData, error: currenciesError } = await supabase
        .from('currencies')
        .select('code, name, type, symbol, decimals, is_default, active')
        .eq('active', true)

      if (currenciesError) {
        throw new Error(`Failed to fetch currencies: ${currenciesError.message}`)
      }

      if (!currenciesData || currenciesData.length === 0) {
        throw new Error('No currencies available in database')
      }

      console.log(`Fetched ${currenciesData.length} currencies from database`)

      // Get the most recent update time from public.pairs
      const { data: latestPair } = await supabase
        .from('pairs')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)

      const mostRecentTime = latestPair?.[0]?.updated_at ? new Date(latestPair[0].updated_at) : new Date()

      // Build final currencies array with metadata
      const validCurrencies = currenciesData
        .map(curr => ({
          code: curr.code,
          name: curr.name,
          type: curr.type, // 'fiat' or 'crypto' from database
          symbol: curr.symbol,
          decimals: curr.decimals,
          is_default: curr.is_default,
          value: curr.code,
          label: curr.code,
          id: curr.code
        }))
        // Sort: fiat before crypto, then alphabetically by code
        .sort((a, b) => {
          // By type (fiat before crypto)
          if (a.type !== b.type) return a.type === 'fiat' ? -1 : 1

          // Then alphabetically by code
          return a.code.localeCompare(b.code)
        })

      setCurrencies(validCurrencies)
      setLastUpdated(mostRecentTime)
      console.log(`Loaded ${validCurrencies.length} currencies`)
      setError(null)
    } catch (err) {
      const errorMsg = err?.message || String(err) || 'Unknown error'
      console.error('Error loading currencies:', errorMsg)
      setError(`Failed to load currencies: ${errorMsg}`)
      setCurrencies([])
    } finally {
      setLoading(false)
    }
  }

  const loadExchangeRates = async (targetCurr) => {
    try {
      if (!supabase || !targetCurr) return

      const target = targetCurr.toUpperCase()
      const rates = {}

      // PHASE 1: Try public.pairs as primary source
      const { data: pairsData, error: pairsError } = await supabase
        .from('pairs')
        .select('from_currency, to_currency, rate, updated_at')
        .eq('to_currency', target)
        .gt('rate', 0)

      if (!pairsError && pairsData) {
        pairsData.forEach(pair => {
          const fromCode = pair.from_currency.toUpperCase()
          if (isFinite(Number(pair.rate)) && Number(pair.rate) > 0) {
            rates[fromCode] = Number(pair.rate)
          }
        })
      }

      // Try reverse pairs from public.pairs
      const initialMissing = currencies
        .map(c => c.code)
        .filter(code => !rates[code] && code !== target)

      if (initialMissing.length > 0) {
        const { data: reversePairs, error: reverseError } = await supabase
          .from('pairs')
          .select('from_currency, to_currency, rate')
          .eq('from_currency', target)
          .in('to_currency', initialMissing)
          .gt('rate', 0)

        if (!reverseError && reversePairs) {
          reversePairs.forEach(pair => {
            const toCode = pair.to_currency.toUpperCase()
            if (isFinite(Number(pair.rate)) && Number(pair.rate) > 0) {
              rates[toCode] = 1 / Number(pair.rate)
            }
          })
        }
      }

      // PHASE 2: Fill remaining gaps with currency_rates table (fiat currencies)
      const stillMissing = currencies
        .map(c => c.code)
        .filter(code => !rates[code] && code !== target)

      if (stillMissing.length > 0) {
        const { data: fiatRates, error: fiatError } = await supabase
          .from('currency_rates')
          .select('from_currency, to_currency, rate')
          .in('from_currency', stillMissing)
          .eq('to_currency', target)
          .gt('rate', 0)

        if (!fiatError && fiatRates) {
          fiatRates.forEach(pair => {
            const fromCode = pair.from_currency.toUpperCase()
            if (isFinite(Number(pair.rate)) && Number(pair.rate) > 0) {
              rates[fromCode] = Number(pair.rate)
            }
          })
        }
      }

      // Check again for missing after fiat lookup
      const afterFiat = currencies
        .map(c => c.code)
        .filter(code => !rates[code] && code !== target)

      if (afterFiat.length > 0) {
        // Try reverse lookup from target currency in currency_rates
        const { data: reverseFiat, error: reverseFiatError } = await supabase
          .from('currency_rates')
          .select('from_currency, to_currency, rate')
          .eq('from_currency', target)
          .in('to_currency', afterFiat)
          .gt('rate', 0)

        if (!reverseFiatError && reverseFiat) {
          reverseFiat.forEach(pair => {
            const toCode = pair.to_currency.toUpperCase()
            if (isFinite(Number(pair.rate)) && Number(pair.rate) > 0) {
              rates[toCode] = 1 / Number(pair.rate)
            }
          })
        }
      }

      // PHASE 3: Fill remaining gaps with cryptocurrency_rates table (crypto)
      const stillMissingCrypto = currencies
        .map(c => c.code)
        .filter(code => !rates[code] && code !== target)

      if (stillMissingCrypto.length > 0) {
        const { data: cryptoRates, error: cryptoError } = await supabase
          .from('cryptocurrency_rates')
          .select('from_currency, to_currency, rate')
          .in('from_currency', stillMissingCrypto)
          .eq('to_currency', target)
          .gt('rate', 0)

        if (!cryptoError && cryptoRates) {
          cryptoRates.forEach(pair => {
            const fromCode = pair.from_currency.toUpperCase()
            if (isFinite(Number(pair.rate)) && Number(pair.rate) > 0) {
              rates[fromCode] = Number(pair.rate)
            }
          })
        }
      }

      // Check again for missing after crypto lookup
      const afterCrypto = currencies
        .map(c => c.code)
        .filter(code => !rates[code] && code !== target)

      if (afterCrypto.length > 0) {
        // Try reverse lookup from target currency in cryptocurrency_rates
        const { data: reverseCrypto, error: reverseCryptoError } = await supabase
          .from('cryptocurrency_rates')
          .select('from_currency, to_currency, rate')
          .eq('from_currency', target)
          .in('to_currency', afterCrypto)
          .gt('rate', 0)

        if (!reverseCryptoError && reverseCrypto) {
          reverseCrypto.forEach(pair => {
            const toCode = pair.to_currency.toUpperCase()
            if (isFinite(Number(pair.rate)) && Number(pair.rate) > 0) {
              rates[toCode] = 1 / Number(pair.rate)
            }
          })
        }
      }

      // Add target currency with rate 1.0
      rates[target] = 1.0

      setExchangeRates(rates)
      const coveredCount = Object.keys(rates).length
      console.log(`Loaded ${coveredCount}/${currencies.length} exchange rates to ${target}`)
    } catch (err) {
      console.error('Error loading exchange rates:', err)
      setExchangeRates({})
    }
  }

  const filteredRates = useMemo(() => {
    let filtered = currencies

    // Filter by type (using actual database values: 'fiat' or 'crypto')
    if (typeFilter !== 'all') {
      const typeValue = typeFilter === 'currency' ? 'fiat' : (typeFilter === 'cryptocurrency' ? 'crypto' : typeFilter)
      filtered = filtered.filter(c => c.type === typeValue)
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(c =>
        c.code.toLowerCase().includes(search) ||
        c.name.toLowerCase().includes(search)
      )
    }

    // Enrich with exchange rates and separate by availability
    const enriched = filtered.map(c => ({
      ...c,
      rate: exchangeRates[c.code] || null
    }))

    // Separate currencies with rates from those without
    const currenciesWithRates = enriched.filter(c => c.rate !== null && isFinite(c.rate) && c.rate > 0)
    const currenciesWithoutRates = enriched.filter(c => c.rate === null || !isFinite(c.rate) || c.rate <= 0)

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
            // All rates from public.pairs updated at same time, so use code as tiebreaker
            comparison = a.code.localeCompare(b.code)
            break
          default:
            comparison = 0
        }

        return sortDirection === 'asc' ? comparison : -comparison
      })
    }

    return [...sortGroup(currenciesWithRates), ...sortGroup(currenciesWithoutRates)]
  }, [currencies, exchangeRates, typeFilter, searchTerm, sortBy, sortDirection])

  const favoriteRates = useMemo(() => {
    return currencies
      .filter(c => favorites.includes(c.code))
      .map(c => ({
        ...c,
        rate: exchangeRates[c.code] || null
      }))
  }, [currencies, favorites, exchangeRates])

  const calculateConversion = () => {
    const numAmount = parseFloat(amount)
    if (!isNaN(numAmount) && numAmount > 0) {
      const fromCurr = currencies.find(c => c.code === selectedFrom)
      const toCurr = currencies.find(c => c.code === selectedTo)

      if (!fromCurr || !toCurr) {
        setResult({
          error: 'Currency not found',
          message: `Currency ${!fromCurr ? selectedFrom : selectedTo} is not available.`
        })
        return
      }

      // Get rates relative to USD (or current target)
      const fromToUSD = exchangeRates[selectedFrom]
      const toToUSD = exchangeRates[selectedTo]

      if (!fromToUSD || !toToUSD || !isFinite(fromToUSD) || !isFinite(toToUSD) || fromToUSD <= 0 || toToUSD <= 0) {
        setResult({
          error: 'Rate not available',
          message: `Exchange rate data is not available for the selected currencies.`
        })
        return
      }

      // Convert: X from_currency to Y to_currency
      // If rates are relative to USD: (numAmount * toToUSD) / fromToUSD
      const convertedAmount = (numAmount * toToUSD) / fromToUSD
      setResult({
        amount: convertedAmount.toFixed(2),
        decimals: 2,
        rate: toToUSD / fromToUSD
      })
    } else {
      setResult(null)
    }
  }

  useEffect(() => {
    calculateConversion()
  }, [amount, selectedFrom, selectedTo, exchangeRates])

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

  if (currencies.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
        <div className="inline-block p-3 bg-slate-100 rounded-full mb-4">
          <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-slate-600 text-lg font-semibold">No currencies available</p>
        <p className="text-slate-500 text-sm mt-2">The database appears to be empty. Please check back later.</p>
      </div>
    )
  }

  const fromCurrency = currencies.find(c => c.code === selectedFrom)
  const toCurrency = currencies.find(c => c.code === selectedTo)
  const fiatCount = currencies.filter(c => c.type === 'fiat').length
  const cryptoCount = currencies.filter(c => c.type === 'crypto').length
  const targetCurrencyData = currencies.find(c => c.code === targetCurrency)

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
                  <CurrencySelect
                    value={selectedFrom}
                    onChange={setSelectedFrom}
                    options={currencies}
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
                  <button
                    onClick={() => {
                      const temp = selectedFrom
                      setSelectedFrom(selectedTo)
                      setSelectedTo(temp)
                    }}
                    className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg active:shadow-inner flex items-center justify-center gap-2"
                    title="Swap currencies"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m0 0l4 4m10-4v12m0 0l4-4m0 0l-4-4" />
                    </svg>
                    <span>Swap</span>
                  </button>

                  {/* To Currency */}
                  <CurrencySelect
                    value={selectedTo}
                    onChange={setSelectedTo}
                    options={currencies}
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
                    <button
                      onClick={loadData}
                      disabled={loading}
                      className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shadow-sm hover:shadow-md"
                    >
                      {loading ? 'Refreshing...' : '↻ Refresh'}
                    </button>
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

                {/* Target Currency Selector */}
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Convert All Rates To:
                  </label>
                  <select
                    value={targetCurrency}
                    onChange={(e) => setTargetCurrency(e.target.value)}
                    className="w-full sm:w-48 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium text-slate-900"
                  >
                    {currencies.map(curr => (
                      <option key={curr.code} value={curr.code}>
                        {curr.code} - {curr.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sticky Search and Filters */}
                <div className="sticky top-0 z-10 -mx-6 -mt-6 px-6 pt-6 pb-4 bg-white border-b border-slate-200 space-y-4 mb-6">
                  {/* Search */}
                  <input
                    type="text"
                    placeholder="Search by currency code or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                  />

                  {/* Filters and Sort */}
                  <div className="flex flex-wrap gap-3 items-center">
                    <CurrencyCryptoToggle active={activeType} onChange={handleTypeChange} />

                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
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

                {/* Separate Fiat and Crypto Sections */}
                {(() => {
                  const fiatRates = filteredRates.filter(c => c.type === 'fiat')
                  const cryptoRates = filteredRates.filter(c => c.type === 'crypto')

                  return (
                    <div className="space-y-8">
                      {/* Fiat Currencies Section */}
                      {fiatRates.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-blue-300">
                            <div className="w-6 h-6 flex items-center justify-center font-bold text-white text-sm bg-blue-500 rounded">F</div>
                            <h3 className="text-lg font-semibold text-slate-900">Fiat Currencies ({fiatRates.length})</h3>
                          </div>
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
                                      if (sortBy === 'rate') {
                                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                                      } else {
                                        setSortBy('rate')
                                        setSortDirection('desc')
                                      }
                                    }}
                                    className="text-right py-3 px-4 font-semibold text-slate-700 text-sm cursor-pointer hover:bg-slate-100 transition select-none"
                                  >
                                    Rate ({targetCurrencyData?.symbol || targetCurrency}) {sortBy === 'rate' && (sortDirection === 'asc' ? '↑' : '↓')}
                                  </th>
                                  <th className="text-center py-3 px-4 font-semibold text-slate-700 text-sm">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {fiatRates.map(currency => (
                                  <tr
                                    key={currency.code}
                                    className="border-b border-slate-100 hover:bg-blue-50 transition"
                                  >
                                    <td className="py-3 px-4">
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 flex items-center justify-center font-bold text-white text-sm bg-blue-500 rounded border border-slate-300">
                                          F
                                        </div>
                                        <div className="min-w-0">
                                          <div className="font-semibold text-slate-900">{currency.code}</div>
                                          <div className="text-xs text-slate-500">{currency.name}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono text-slate-900 font-medium">
                                      <span className="flex items-center justify-end gap-2">
                                        <span>{formatNumber(currency.rate, currency.decimals)}</span>
                                        {currency.symbol && <span className="text-xs text-slate-500">{currency.symbol}</span>}
                                      </span>
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
                      )}

                      {/* Crypto Currencies Section */}
                      {cryptoRates.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-orange-300">
                            <div className="w-6 h-6 flex items-center justify-center font-bold text-white text-sm bg-orange-500 rounded">C</div>
                            <h3 className="text-lg font-semibold text-slate-900">Cryptocurrencies ({cryptoRates.length})</h3>
                          </div>
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
                                      if (sortBy === 'rate') {
                                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                                      } else {
                                        setSortBy('rate')
                                        setSortDirection('desc')
                                      }
                                    }}
                                    className="text-right py-3 px-4 font-semibold text-slate-700 text-sm cursor-pointer hover:bg-slate-100 transition select-none"
                                  >
                                    Rate ({targetCurrencyData?.symbol || targetCurrency}) {sortBy === 'rate' && (sortDirection === 'asc' ? '↑' : '↓')}
                                  </th>
                                  <th className="text-center py-3 px-4 font-semibold text-slate-700 text-sm">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cryptoRates.map(currency => (
                                  <tr
                                    key={currency.code}
                                    className="border-b border-slate-100 hover:bg-orange-50 transition"
                                  >
                                    <td className="py-3 px-4">
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 flex items-center justify-center font-bold text-white text-sm bg-orange-500 rounded border border-slate-300">
                                          C
                                        </div>
                                        <div className="min-w-0">
                                          <div className="font-semibold text-slate-900">{currency.code}</div>
                                          <div className="text-xs text-slate-500">{currency.name}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono text-slate-900 font-medium">
                                      <span className="flex items-center justify-end gap-2">
                                        <span>{formatNumber(currency.rate, currency.decimals)}</span>
                                        {currency.symbol && <span className="text-xs text-slate-500">{currency.symbol}</span>}
                                      </span>
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
                      )}

                      {/* No results message */}
                      {fiatRates.length === 0 && cryptoRates.length === 0 && (
                        <div className="text-center py-12">
                          <p className="text-slate-500 text-lg">No currencies match your search</p>
                        </div>
                      )}
                    </div>
                  )
                })()}
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
                            <div
                              className={`w-6 h-6 flex items-center justify-center font-bold text-white text-xs border border-slate-300 ${
                                curr.type === 'crypto'
                                  ? 'bg-orange-500'
                                  : 'bg-blue-500'
                              }`}
                              title={curr.type === 'crypto' ? 'Cryptocurrency' : 'Fiat Currency'}
                            >
                              {curr.type === 'crypto' ? 'C' : 'F'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900">{curr.code}</div>
                              <div className="text-xs text-slate-500">{curr.name}</div>
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
                          {formatNumber(curr.rate, curr.decimals)}
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
                    <p className="text-sm font-semibold text-slate-900">
                      {fromCurrency.name}
                      {fromCurrency.symbol && <span className="text-xs text-slate-500 font-normal ml-1">({fromCurrency.symbol})</span>}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{fromCurrency.code} • {fromCurrency.type === 'crypto' ? 'Cryptocurrency' : 'Fiat'}</p>
                  </div>
                )}

                {toCurrency && (
                  <div className="pb-4 border-b border-slate-300">
                    <p className="text-xs text-slate-600 font-medium mb-1 uppercase tracking-wider">To Currency</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {toCurrency.name}
                      {toCurrency.symbol && <span className="text-xs text-slate-500 font-normal ml-1">({toCurrency.symbol})</span>}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{toCurrency.code} • {toCurrency.type === 'crypto' ? 'Cryptocurrency' : 'Fiat'}</p>
                  </div>
                )}

                <div className="pb-4 border-b border-slate-300">
                  <p className="text-xs text-slate-600 font-medium mb-1 uppercase tracking-wider">Data Source</p>
                  <p className="text-xs text-slate-500">
                    Open Exchange Rates, CoinGecko, Exconvert, Wise, Coins.ph
                  </p>
                </div>

                <div className="pb-4 border-b border-slate-300">
                  <p className="text-xs text-slate-600 font-medium mb-1 uppercase tracking-wider">Coverage</p>
                  <p className="text-xs text-slate-500">
                    {currencies.length} currencies ({fiatCount} fiat, {cryptoCount} crypto)
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
                    <span className="text-sm font-medium text-slate-700">Total Currencies</span>
                    <span className="text-lg font-bold text-slate-900">{currencies.length}</span>
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
