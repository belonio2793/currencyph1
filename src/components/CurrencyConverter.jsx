import { useState, useEffect, useMemo } from 'react'
import SearchableCurrencyDropdown from './SearchableCurrencyDropdown'

/**
 * Enhanced Currency Converter with:
 * - Searchable dropdowns for both from/to currencies
 * - Clear visual distinction between fiat and cryptocurrency
 * - Bidirectional conversion (swap currencies)
 * - Real-time calculation and intelligent propagation
 * - Support for cross-conversion (BTC to USD, etc)
 */
export default function CurrencyConverter({ rates = [] }) {
  const [selectedFrom, setSelectedFrom] = useState('USD')
  const [selectedTo, setSelectedTo] = useState('PHP')
  const [fromAmount, setFromAmount] = useState('1')
  const [toAmount, setToAmount] = useState('')
  const [lastEdited, setLastEdited] = useState('from') // Track which field was edited
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // Transform rates into currency list with type info
  const currencies = useMemo(() => {
    if (!rates || rates.length === 0) return []

    return rates.map(rate => ({
      code: rate.code,
      name: rate.metadata?.name || rate.code,
      type: rate.metadata?.type === 'cryptocurrency' ? 'crypto' : 'fiat',
      rate: rate.rate,
      decimals: rate.metadata?.decimals || 2,
      metadata: rate.metadata
    })).sort((a, b) => {
      // Sort: fiat first, then crypto, alphabetically within each group
      if (a.type !== b.type) {
        return a.type === 'fiat' ? -1 : 1
      }
      return a.code.localeCompare(b.code)
    })
  }, [rates])

  // Get currency data for display
  const fromCurrency = currencies.find(c => c.code === selectedFrom)
  const toCurrency = currencies.find(c => c.code === selectedTo)

  // Calculate conversion
  const calculateConversion = () => {
    const numAmount = parseFloat(lastEdited === 'from' ? fromAmount : toAmount)

    if (!isNaN(numAmount) && numAmount > 0 && fromCurrency && toCurrency) {
      // Check if both rates are valid
      const fromRateValid = fromCurrency.rate && isFinite(fromCurrency.rate) && fromCurrency.rate > 0
      const toRateValid = toCurrency.rate && isFinite(toCurrency.rate) && toCurrency.rate > 0

      if (!fromRateValid || !toRateValid) {
        setError(`Exchange rate not available for ${!fromRateValid ? selectedFrom : selectedTo}`)
        setResult(null)
        return
      }

      let convertedAmount
      const exchangeRate = toCurrency.rate / fromCurrency.rate

      if (lastEdited === 'from') {
        // User edited "from" field, calculate "to"
        convertedAmount = numAmount * exchangeRate
        setToAmount(convertedAmount.toFixed(toCurrency.decimals))
      } else {
        // User edited "to" field, calculate "from"
        convertedAmount = numAmount / exchangeRate
        setFromAmount(convertedAmount.toFixed(fromCurrency.decimals))
      }

      setResult({
        fromAmount: lastEdited === 'from' ? numAmount : convertedAmount,
        toAmount: lastEdited === 'from' ? convertedAmount : numAmount,
        exchangeRate: exchangeRate,
        fromCurrency: selectedFrom,
        toCurrency: selectedTo
      })
      setError(null)
    } else {
      setResult(null)
      if (isNaN(numAmount) || numAmount <= 0) {
        setError(null)
      }
    }
  }

  // Recalculate when amounts or currency selection changes
  useEffect(() => {
    calculateConversion()
  }, [fromAmount, toAmount, selectedFrom, selectedTo, lastEdited, fromCurrency, toCurrency])

  // Handle swap currencies
  const swapCurrencies = () => {
    const temp = selectedFrom
    setSelectedFrom(selectedTo)
    setSelectedTo(temp)

    // Also swap amounts
    const tempAmount = fromAmount
    setFromAmount(toAmount)
    setToAmount(tempAmount)
    setLastEdited(lastEdited === 'from' ? 'to' : 'from')
  }

  const handleFromAmountChange = (e) => {
    setFromAmount(e.target.value)
    setLastEdited('from')
  }

  const handleToAmountChange = (e) => {
    setToAmount(e.target.value)
    setLastEdited('to')
  }

  const handleFromCurrencyChange = (code) => {
    setSelectedFrom(code)
    setLastEdited('from') // Keep the from field as the primary
  }

  const handleToCurrencyChange = (code) => {
    setSelectedTo(code)
    setLastEdited('from') // Recalculate based on from amount
  }

  if (currencies.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
        <p className="text-slate-500 text-center">Loading currencies...</p>
      </div>
    )
  }

  // Separate currencies by type for tab filtering
  const fiatCurrencies = currencies.filter(c => c.type === 'fiat')
  const cryptoCurrencies = currencies.filter(c => c.type === 'crypto')

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 border border-slate-200">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Currency Converter</h2>
        <p className="text-sm text-slate-600">Convert between fiat currencies and cryptocurrencies with real-time rates</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* From Currency Section */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">
            From
            {fromCurrency && (
              <span className={`ml-2 inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                fromCurrency.type === 'crypto'
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {fromCurrency.type === 'crypto' ? '₿ Cryptocurrency' : '💵 Fiat'}
              </span>
            )}
          </label>
          <SearchableCurrencyDropdown
            currencies={currencies}
            selectedCurrency={selectedFrom}
            onChange={handleFromCurrencyChange}
            defaultTab="all"
          />
        </div>

        {/* From Amount Input */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700">Amount</label>
          <div className="relative">
            <input
              type="number"
              step="any"
              min="0"
              value={fromAmount}
              onChange={handleFromAmountChange}
              placeholder="0.00"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
            />
            {fromCurrency && (
              <div className="absolute right-4 top-3.5 text-slate-500 font-medium pointer-events-none">
                {fromCurrency.code}
              </div>
            )}
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center">
          <button
            onClick={swapCurrencies}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-3 rounded-lg transition-colors border border-slate-300"
            title="Swap currencies"
            aria-label="Swap from and to currencies"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m0 0l4 4m10-4v12m0 0l4-4m0 0l-4-4" />
            </svg>
          </button>
        </div>

        {/* To Currency Section */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">
            To
            {toCurrency && (
              <span className={`ml-2 inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                toCurrency.type === 'crypto'
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {toCurrency.type === 'crypto' ? '₿ Cryptocurrency' : '💵 Fiat'}
              </span>
            )}
          </label>
          <SearchableCurrencyDropdown
            currencies={currencies}
            selectedCurrency={selectedTo}
            onChange={handleToCurrencyChange}
            defaultTab="all"
          />
        </div>

        {/* To Amount Input */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700">Converted Amount</label>
          <div className="relative">
            <input
              type="number"
              step="any"
              min="0"
              value={toAmount}
              onChange={handleToAmountChange}
              placeholder="0.00"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
            />
            {toCurrency && (
              <div className="absolute right-4 top-3.5 text-slate-500 font-medium pointer-events-none">
                {toCurrency.code}
              </div>
            )}
          </div>
        </div>

        {/* Exchange Rate Display */}
        {result && fromCurrency && toCurrency && (
          <div className={`rounded-lg p-4 border-2 ${
            selectedFrom === selectedTo
              ? 'bg-slate-50 border-slate-200'
              : 'bg-gradient-to-br border-blue-200'
          }`}
          style={selectedFrom !== selectedTo ? {
            backgroundImage: 'linear-gradient(to right, rgb(240, 249, 255), rgb(240, 245, 250))'
          } : {}}>
            <div className="space-y-2">
              <div className="text-sm text-slate-600">
                <span className="font-semibold">Exchange Rate</span>
              </div>
              <div className="text-lg font-bold text-slate-900">
                1 <span className="font-mono">{selectedFrom}</span> = {result.exchangeRate.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: Math.max(8, toCurrency.decimals)
                })} <span className="font-mono">{selectedTo}</span>
              </div>
              <div className="text-xs text-slate-500 pt-1">
                {selectedFrom} and {selectedTo} rates last updated from public.pairs database
              </div>
            </div>
          </div>
        )}

        {/* Currency Type Legend */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-100 rounded-full border border-blue-300"></div>
            <span className="text-xs text-slate-600">Fiat Currencies ({fiatCurrencies.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-100 rounded-full border border-orange-300"></div>
            <span className="text-xs text-slate-600">Cryptocurrencies ({cryptoCurrencies.length})</span>
          </div>
        </div>
      </div>
    </div>
  )
}
