import { useState, useEffect } from 'react'
import { wisegcashAPI } from '../lib/wisegcashAPI'
import { currencyAPI } from '../lib/currencyAPI'

export default function LandingPage({ userId, userEmail }) {
  const [amount, setAmount] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState('PHP')
  const [exchangeRates, setExchangeRates] = useState({})
  const [wallets, setWallets] = useState([])
  const [convertedAmount, setConvertedAmount] = useState('0.00')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [recentTransactions, setRecentTransactions] = useState([])
  const [allCurrencies, setAllCurrencies] = useState([])

  const [cryptoAmount, setCryptoAmount] = useState('')
  const [selectedCrypto, setSelectedCrypto] = useState('BTC')
  const [cryptoRates, setCryptoRates] = useState({})
  const [convertedCryptoAmount, setConvertedCryptoAmount] = useState('0.00')
  const [addingCrypto, setAddingCrypto] = useState(false)

  const cryptos = ['BTC', 'ETH', 'DOGE', 'XRP', 'ADA']
  const targetCurrency = 'PHP'

  // Default crypto prices in PHP (fallback values)
  const defaultCryptoPrices = {
    BTC: 4200000,
    ETH: 180000,
    DOGE: 8,
    XRP: 25,
    ADA: 35
  }

  const loadCryptoPrices = async () => {
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,dogecoin,ripple,cardano&vs_currencies=usd'
      )
      if (!response.ok) throw new Error('Failed to fetch crypto prices')
      
      const data = await response.json()
      const phpExchangeRate = exchangeRates['USD_PHP'] || 56
      
      const cryptoPricesInPhp = {
        BTC: Math.round(data.bitcoin.usd * phpExchangeRate * 100) / 100,
        ETH: Math.round(data.ethereum.usd * phpExchangeRate * 100) / 100,
        DOGE: Math.round(data.dogecoin.usd * phpExchangeRate * 100) / 100,
        XRP: Math.round(data.ripple.usd * phpExchangeRate * 100) / 100,
        ADA: Math.round(data.cardano.usd * phpExchangeRate * 100) / 100
      }
      setCryptoRates(cryptoPricesInPhp)
    } catch (err) {
      console.error('Error loading crypto prices:', err)
      setCryptoRates(defaultCryptoPrices)
    }
  }

  useEffect(() => {
    loadInitialData()
  }, [userId])

  const loadInitialData = async () => {
    try {
      setAllCurrencies(currencyAPI.getCurrencies())
      await Promise.all([
        loadWallets(),
        loadExchangeRates(),
        loadRecentTransactions()
      ])
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadWallets = async () => {
    try {
      const data = await wisegcashAPI.getWallets(userId)
      setWallets(data)
    } catch (err) {
      console.error('Error loading wallets:', err)
    }
  }

  const loadExchangeRates = async () => {
    try {
      const rates = await wisegcashAPI.getAllExchangeRates()
      const ratesMap = {}
      rates.forEach(r => {
        ratesMap[`${r.from_currency}_${r.to_currency}`] = r.rate
      })
      setExchangeRates(ratesMap)
      setTimeout(() => loadCryptoPrices(), 100)
    } catch (err) {
      console.error('Error loading exchange rates:', err)
    }
  }

  const loadRecentTransactions = async () => {
    try {
      const data = await wisegcashAPI.getTransactions(userId, 5)
      setRecentTransactions(data)
    } catch (err) {
      console.error('Error loading transactions:', err)
    }
  }

  useEffect(() => {
    if (amount && selectedCurrency) {
      calculateConversion()
    } else {
      setConvertedAmount('0.00')
    }
  }, [amount, selectedCurrency, exchangeRates])

  useEffect(() => {
    if (cryptoAmount && selectedCrypto) {
      calculateCryptoConversion()
    } else {
      setConvertedCryptoAmount('0.00')
    }
  }, [cryptoAmount, selectedCrypto, cryptoRates])

  useEffect(() => {
    const interval = setInterval(() => {
      if (Object.keys(exchangeRates).length > 0) {
        loadCryptoPrices()
      }
    }, 300000)
    return () => clearInterval(interval)
  }, [exchangeRates])

  const calculateConversion = () => {
    const numAmount = parseFloat(amount) || 0
    if (numAmount <= 0) {
      setConvertedAmount('0.00')
      return
    }

    const rateKey = `${selectedCurrency}_${targetCurrency}`
    const rate = exchangeRates[rateKey] || 1

    const converted = (numAmount * rate).toFixed(2)
    setConvertedAmount(converted)
  }

  const calculateCryptoConversion = () => {
    const numAmount = parseFloat(cryptoAmount) || 0
    if (numAmount <= 0) {
      setConvertedCryptoAmount('0.00')
      return
    }

    const price = cryptoRates[selectedCrypto] || defaultCryptoPrices[selectedCrypto] || 0
    const converted = (numAmount * price).toFixed(2)
    setConvertedCryptoAmount(converted)
  }

  const handleAddAmount = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setAdding(true)

    try {
      const numAmount = parseFloat(amount)
      if (!numAmount || numAmount <= 0) {
        throw new Error('Please enter a valid amount')
      }

      if (!selectedCurrency) {
        throw new Error('Please select a currency')
      }

      const convertedAmt = parseFloat(convertedAmount)

      await wisegcashAPI.addFunds(userId, targetCurrency, convertedAmt)
      setSuccess(`Successfully added ${amount} ${selectedCurrency} = ${convertedAmt} PHP`)
      setAmount('')
      setConvertedAmount('0.00')

      setTimeout(() => {
        setSuccess('')
        loadWallets()
        loadRecentTransactions()
      }, 2000)
    } catch (err) {
      setError(err.message || 'Failed to add funds')
    } finally {
      setAdding(false)
    }
  }

  const handleAddCrypto = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setAddingCrypto(true)

    try {
      const numAmount = parseFloat(cryptoAmount)
      if (!numAmount || numAmount <= 0) {
        throw new Error('Please enter a valid amount')
      }

      if (!selectedCrypto) {
        throw new Error('Please select a cryptocurrency')
      }

      const convertedAmt = parseFloat(convertedCryptoAmount)

      await wisegcashAPI.addFunds(userId, targetCurrency, convertedAmt)
      setSuccess(`Successfully added ${cryptoAmount} ${selectedCrypto} = ${convertedAmt} PHP`)
      setCryptoAmount('')
      setConvertedCryptoAmount('0.00')

      setTimeout(() => {
        setSuccess('')
        loadWallets()
        loadRecentTransactions()
      }, 2000)
    } catch (err) {
      setError(err.message || 'Failed to add crypto')
    } finally {
      setAddingCrypto(false)
    }
  }

  const getTotalBalance = () => {
    return wallets.reduce((sum, w) => sum + (w.balance || 0), 0).toFixed(2)
  }

  const getRate = (from, to) => {
    const key = `${from}_${to}`
    return exchangeRates[key]?.toFixed(4) || '0.0000'
  }

  const getCryptoPrice = (crypto) => {
    return (cryptoRates[crypto] || defaultCryptoPrices[crypto] || 0).toFixed(2)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl font-light text-slate-900 mb-2">currency.ph</div>
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Main Hero Section */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Welcome Message */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-light text-slate-900 mb-3 tracking-tight">
            Welcome to currency.ph
          </h1>
          <p className="text-slate-600 text-lg">
            Add funds with real-time currency conversion
          </p>
        </div>

        {/* Error & Success Messages */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-8 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">
            {success}
          </div>
        )}

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-slate-200">
          {/* Total Balance */}
          <div className="mb-8 text-center">
            <p className="text-slate-600 text-sm uppercase tracking-wider mb-2">Total Balance</p>
            <h2 className="text-5xl font-light text-slate-900">
              {getTotalBalance()}
            </h2>
          </div>

          {/* Side by Side Forms */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Fiat Currency Form */}
            <form onSubmit={handleAddAmount} className="space-y-6">
              <h3 className="text-xl font-light text-slate-900 tracking-tight">Add Fiat Currency</h3>

              {/* Currency Selection Dropdown */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select Currency
                </label>
                <select
                  value={selectedCurrency}
                  onChange={e => setSelectedCurrency(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-0 text-sm font-medium bg-white"
                >
                  {allCurrencies.map(curr => (
                    <option key={curr.code} value={curr.code}>
                      {curr.code} - {curr.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Amount ({selectedCurrency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-6 py-4 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-0 text-lg font-light"
                />
              </div>

              {/* Conversion Preview */}
              {amount && (
                <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-lg p-6 border border-blue-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-600 text-sm mb-1">You send</p>
                      <p className="text-2xl font-light text-slate-900">
                        {amount} {selectedCurrency}
                      </p>
                    </div>
                    <div className="text-2xl text-slate-400">→</div>
                    <div className="text-right">
                      <p className="text-slate-600 text-sm mb-1">You get</p>
                      <p className="text-2xl font-light text-blue-600">
                        {convertedAmount} {targetCurrency}
                      </p>
                    </div>
                  </div>
                  {getRate(selectedCurrency, targetCurrency) && (
                    <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-blue-200">
                      Rate: 1 {selectedCurrency} = {getRate(selectedCurrency, targetCurrency)} {targetCurrency}
                    </p>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={adding || !amount}
                className="w-full bg-blue-600 text-white py-4 rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? 'Processing...' : `Add ${convertedAmount} ${targetCurrency}`}
              </button>
            </form>

            {/* Cryptocurrency Form */}
            <form onSubmit={handleAddCrypto} className="space-y-6">
              <h3 className="text-xl font-light text-slate-900 tracking-tight">Add Cryptocurrency</h3>

              {/* Cryptocurrency Selection Dropdown */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select Cryptocurrency
                </label>
                <select
                  value={selectedCrypto}
                  onChange={e => setSelectedCrypto(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-orange-600 focus:ring-0 text-sm font-medium bg-white"
                >
                  {cryptos.map(crypto => (
                    <option key={crypto} value={crypto}>
                      {crypto} - {getCryptoPrice(crypto)} {targetCurrency}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Amount ({selectedCrypto})
                </label>
                <input
                  type="number"
                  step="0.00000001"
                  value={cryptoAmount}
                  onChange={e => setCryptoAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-6 py-4 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-orange-600 focus:ring-0 text-lg font-light"
                />
              </div>

              {/* Conversion Preview */}
              {cryptoAmount && (
                <div className="bg-gradient-to-br from-orange-50 to-slate-50 rounded-lg p-6 border border-orange-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-600 text-sm mb-1">You send</p>
                      <p className="text-2xl font-light text-slate-900">
                        {cryptoAmount} {selectedCrypto}
                      </p>
                    </div>
                    <div className="text-2xl text-slate-400">→</div>
                    <div className="text-right">
                      <p className="text-slate-600 text-sm mb-1">You get</p>
                      <p className="text-2xl font-light text-orange-600">
                        {convertedCryptoAmount} {targetCurrency}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-orange-200">
                    Rate: 1 {selectedCrypto} = {getCryptoPrice(selectedCrypto)} {targetCurrency}
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={addingCrypto || !cryptoAmount}
                className="w-full bg-orange-600 text-white py-4 rounded-lg hover:bg-orange-700 transition-colors font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingCrypto ? 'Processing...' : `Add ${convertedCryptoAmount} ${targetCurrency}`}
              </button>
            </form>
          </div>
        </div>

        {/* Recent Transactions */}
        {recentTransactions.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
            <h3 className="text-xl font-light text-slate-900 mb-6 tracking-tight">Recent Transactions</h3>
            <div className="space-y-3">
              {recentTransactions.slice(0, 5).map(txn => (
                <div key={txn.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{txn.description}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(txn.created_at).toLocaleDateString()} {new Date(txn.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-light ${
                      txn.transaction_type.includes('sent') || txn.transaction_type === 'bill_payment'
                        ? 'text-red-600'
                        : 'text-emerald-600'
                    }`}>
                      {txn.transaction_type.includes('sent') || txn.transaction_type === 'bill_payment' ? '-' : '+'}
                      {txn.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">{txn.currency_code}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center">
          <p className="text-slate-500 text-sm">
            &copy; 2024 currency.ph • Secure • Real-time Rates • Global Payments
          </p>
        </div>
      </footer>
    </div>
  )
}
