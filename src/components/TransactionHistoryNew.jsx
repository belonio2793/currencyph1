import { useState, useEffect } from 'react'
import { currencyAPI } from '../lib/payments'
import { formatNumber } from '../lib/currency'

const CRYPTO_CURRENCIES = ['USDC', 'USDT', 'BTC', 'ETH', 'MATIC', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LTC', 'BCH', 'LINK', 'DOT', 'UNI', 'AAVE', 'CRV', 'WETH', 'DAI', 'BUSD', 'SHIB']

const CRYPTO_IDS = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'USDC': 'usd-coin',
  'USDT': 'tether',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'SOL': 'solana',
  'MATIC': 'matic-network',
  'DOGE': 'dogecoin',
  'LTC': 'litecoin',
  'AVAX': 'avalanche-2',
  'BCH': 'bitcoin-cash',
  'LINK': 'chainlink',
  'DOT': 'polkadot',
  'UNI': 'uniswap',
  'AAVE': 'aave',
  'CRV': 'curve-dao-token',
  'WETH': 'ethereum',
  'DAI': 'dai',
  'BUSD': 'binance-usd',
  'SHIB': 'shiba-inu'
}

export default function TransactionHistory({ userId }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selectedCurrency, setSelectedCurrency] = useState('all')
  const [cryptoRates, setCryptoRates] = useState({})

  const getCurrencySymbol = (currencyCode) => {
    const code = currencyCode?.toUpperCase() || 'USD'
    if (CRYPTO_CURRENCIES.includes(code)) {
      return '' // No symbol for crypto, just show the code
    }
    switch (code) {
      case 'PHP':
        return '₱'
      case 'EUR':
        return '€'
      case 'GBP':
        return '£'
      case 'JPY':
        return '¥'
      default:
        return '$'
    }
  }

  const isCryptoCurrency = (currencyCode) => {
    return CRYPTO_CURRENCIES.includes(currencyCode?.toUpperCase())
  }

  const fetchCryptoRates = async () => {
    try {
      const ids = Object.values(CRYPTO_IDS).join(',')
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_market_cap=false&include_24hr_vol=false`)
      const data = await response.json()

      const rates = {}
      for (const [symbol, id] of Object.entries(CRYPTO_IDS)) {
        if (data[id]) {
          rates[symbol] = data[id].usd
        }
      }
      setCryptoRates(rates)
    } catch (err) {
      console.error('Failed to fetch crypto rates:', err)
    }
  }

  const formatFullPrecision = (amount) => {
    if (amount == null || isNaN(amount)) return '0'
    return String(amount)
  }

  const getCryptoInUSD = (amount, currency) => {
    if (!isCryptoCurrency(currency) || !cryptoRates[currency?.toUpperCase()]) {
      return null
    }
    const rate = cryptoRates[currency?.toUpperCase()]
    const usdValue = amount * rate
    return usdValue
  }

  useEffect(() => {
    loadTransactions()
  }, [userId])

  const loadTransactions = async () => {
    try {
      // Skip for guest-local or invalid user IDs
      if (!userId || userId.includes('guest-local') || userId === 'null' || userId === 'undefined') {
        setTransactions([])
        setLoading(false)
        return
      }
      const data = await currencyAPI.getTransactions(userId, 100)
      setTransactions(data)
    } catch (err) {
      // Silently fail - transactions are optional
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'transfer_sent':
        return '→'
      case 'transfer_received':
        return '←'
      case 'add_funds':
        return '+'
      case 'bill_payment':
        return '•'
      case 'withdrawal':
        return '↓'
      default:
        return '•'
    }
  }

  const getTransactionLabel = (type) => {
    switch (type) {
      case 'transfer_sent':
        return 'Money Sent'
      case 'transfer_received':
        return 'Money Received'
      case 'add_funds':
        return 'Added Funds'
      case 'bill_payment':
        return 'Bill Payment'
      case 'withdrawal':
        return 'Withdrawal'
      default:
        return type
    }
  }

  const filteredTransactions = transactions.filter(t => {
    if (filter !== 'all' && t.transaction_type !== filter) return false
    if (selectedCurrency !== 'all' && t.currency_code !== selectedCurrency) return false
    return true
  })

  const currencies = [...new Set(transactions.map(t => t.currency_code))]

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="text-center text-slate-500">Loading transactions...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <h2 className="text-3xl font-light text-slate-900 mb-6 tracking-tight">Transaction History</h2>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Transaction Type</label>
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="transfer_sent">Money Sent</option>
              <option value="transfer_received">Money Received</option>
              <option value="add_funds">Added Funds</option>
              <option value="bill_payment">Bill Payments</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Currency</label>
            <select
              value={selectedCurrency}
              onChange={e => setSelectedCurrency(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            >
              <option value="all">All Currencies</option>
              {currencies.map(curr => (
                <option key={curr} value={curr}>{curr?.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      {filteredTransactions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
          <p className="text-slate-500 text-sm">No transactions found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTransactions.map(transaction => (
            <div key={transaction.id} className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-light text-lg ${
                    transaction.transaction_type?.includes('sent') || transaction.transaction_type === 'bill_payment'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {getTransactionIcon(transaction.transaction_type)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{getTransactionLabel(transaction.transaction_type)}</p>
                    <p className="text-xs text-slate-500 mt-1">{transaction.description?.toUpperCase()}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(transaction.created_at).toLocaleDateString()} {new Date(transaction.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className={`text-lg font-light ${
                    transaction.transaction_type?.includes('sent') || transaction.transaction_type === 'bill_payment'
                      ? 'text-red-600'
                      : 'text-emerald-600'
                  }`}>
                    {transaction.transaction_type?.includes('sent') || transaction.transaction_type === 'bill_payment' ? '-' : '+'}
                    {getCurrencySymbol(transaction.currency_code)}
                    {formatNumber(transaction.amount)}
                  </p>
                  <p className="text-xs text-slate-500">{transaction.currency_code?.toUpperCase()}</p>
                </div>
              </div>

              {transaction.reference_number && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500">Ref: {transaction.reference_number}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
