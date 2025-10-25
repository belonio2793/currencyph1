import { useState, useEffect } from 'react'
import { currencyAPI } from '../lib/currencyAPI'
import { dogTokenAPI } from '../lib/supabaseClient'

export default function CurrencyRates() {
  const [rates, setRates] = useState({})
  const [cryptoPrices, setCryptoPrices] = useState(null)
  const [dogPrice, setDogPrice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  useEffect(() => {
    const fetchRates = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch all rates in parallel
        const [fiatRates, cryptos, dog] = await Promise.all([
          currencyAPI.getGlobalRates(),
          currencyAPI.getCryptoPrices(),
          dogTokenAPI.calculateDOGPrice()
        ])

        setRates(fiatRates)
        setCryptoPrices(cryptos)
        setDogPrice(dog)
        setLastUpdate(new Date())
      } catch (err) {
        console.error('Error fetching rates:', err)
        setError('Failed to load rates')
      } finally {
        setLoading(false)
      }
    }

    fetchRates()

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchRates, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 p-6 mb-6">
        <p className="text-gray-500 text-sm">Loading global rates...</p>
      </div>
    )
  }

  const displayRates = Object.values(rates).sort((a, b) => a.code.localeCompare(b.code))

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="bg-white border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-black mb-2">Global Exchange Rates</h2>
            <p className="text-gray-600 text-sm">Real-time rates from leading financial institutions</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">
              Last updated: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
            </p>
            <p className="text-xs text-gray-400">Auto-refreshes every 30s</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 p-3 rounded text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* DOG Token Price Card */}
      {dogPrice && (
        <div className="bg-black text-white p-6 mb-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">🐕 DOG Token</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-300 text-xs mb-1">Price</p>
              <p className="text-2xl font-bold">${dogPrice.dogPrice.toFixed(4)}</p>
            </div>
            <div>
              <p className="text-gray-300 text-xs mb-1">Total Supply</p>
              <p className="text-2xl font-bold">{dogPrice.totalSupply.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-300 text-xs mb-1">Market Cap</p>
              <p className="text-2xl font-bold">${dogPrice.marketCap.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-300 text-xs mb-1">Total Deposits</p>
              <p className="text-2xl font-bold">${dogPrice.totalDeposits.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Cryptocurrency Prices */}
      {cryptoPrices && (
        <div className="bg-white border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-black mb-4">Major Cryptocurrencies</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(cryptoPrices).map(([symbol, crypto]) => (
              <div key={symbol} className="border border-gray-200 p-4 rounded">
                <p className="font-semibold text-black mb-2">{symbol} - {crypto.name}</p>
                <p className="text-2xl font-bold text-black mb-3">
                  ${crypto.prices.usd?.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-gray-600">Market Cap</p>
                    <p className="text-gray-900 font-medium">
                      ${(crypto.prices.usd_market_cap / 1e9).toFixed(1)}B
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">24h Vol</p>
                    <p className="text-gray-900 font-medium">
                      ${(crypto.prices.usd_24h_vol / 1e9).toFixed(1)}B
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Currency Grid */}
      <div className="bg-white border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-black mb-4">Fiat Currencies (1 USD = X)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {displayRates.map((currency) => (
            <div key={currency.code} className="border border-gray-200 p-4 rounded hover:bg-gray-50 transition">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{currency.flag}</span>
                <div>
                  <p className="font-semibold text-black text-sm">{currency.code}</p>
                  <p className="text-gray-600 text-xs">{currency.name}</p>
                </div>
              </div>
              <p className="text-lg font-bold text-black">
                {currency.symbol}{currency.rate.toLocaleString('en-US', {
                  maximumFractionDigits: currency.code === 'JPY' || currency.code === 'KRW' || currency.code === 'IDR' ? 0 : 2
                })}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {currency.rate > 0.1 && currency.rate < 10 ? 
                  `${(1 / currency.rate).toFixed(4)} ${currency.code}/USD` : 
                  ''}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Info Footer */}
      <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
        <p>
          <strong>Rate Calculation:</strong> DOG Token price is calculated as: Total Market Value of Deposits ÷ Total DOG in Circulation.
          All fiat rates are relative to USD. Data is refreshed every 30 seconds from global financial networks.
        </p>
      </div>
    </div>
  )
}
