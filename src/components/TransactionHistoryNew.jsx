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
  const [selectedTransaction, setSelectedTransaction] = useState(null)

  const getCurrencySymbol = (currencyCode) => {
    return currencyCode?.toUpperCase() || 'USD'
  }

  const getCurrencyDisplayName = (currencyCode) => {
    const code = currencyCode?.toUpperCase() || 'USD'
    const currencyNames = {
      'PHP': 'Philippine Peso',
      'USD': 'US Dollar',
      'EUR': 'Euro',
      'GBP': 'British Pound',
      'JPY': 'Japanese Yen',
      'BTC': 'Bitcoin',
      'ETH': 'Ethereum',
      'USDC': 'USD Coin',
      'USDT': 'Tether'
    }
    return currencyNames[code] || code
  }

  const isCryptoCurrency = (currencyCode) => {
    return CRYPTO_CURRENCIES.includes(currencyCode?.toUpperCase())
  }

  const formatCurrencyAmount = (amount, currencyCode) => {
    if (amount == null || isNaN(amount)) return '0'
    const code = currencyCode?.toUpperCase() || 'USD'
    const symbol = getCurrencySymbol(code)
    const formatted = formatFullPrecision(amount)
    return `${symbol}${formatted} ${code}`
  }

  const getAmountDisplay = (amount, currencyCode, isOutgoing = false) => {
    if (amount == null || isNaN(amount)) return { text: '0', symbol: '', code: currencyCode?.toUpperCase() || 'USD' }
    const code = currencyCode?.toUpperCase() || 'USD'
    const symbol = getCurrencySymbol(code)
    const formatted = formatFullPrecision(amount)
    const prefix = isOutgoing ? '-' : '+'
    return {
      text: `${prefix}${symbol}${formatted}`,
      symbol,
      code,
      formatted,
      fullText: `${prefix}${symbol}${formatted} ${code}`
    }
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

    const str = String(amount)
    const parts = str.split('.')
    const integerPart = parts[0]
    const decimalPart = parts[1] || ''

    const formattedInteger = parseInt(integerPart).toLocaleString('en-US')

    return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger
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
    fetchCryptoRates()
    const interval = setInterval(fetchCryptoRates, 60000)
    return () => clearInterval(interval)
  }, [userId])

  const loadTransactions = async () => {
    try {
      if (!userId || userId.includes('guest-local') || userId === 'null' || userId === 'undefined') {
        setTransactions([])
        setLoading(false)
        return
      }
      const data = await currencyAPI.getTransactions(userId, 100)
      setTransactions(data)
    } catch (err) {
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
      case 'deposit_pending':
        return '⏳'
      case 'deposit_approved':
        return '✓'
      case 'deposit_rejected':
        return '✗'
      case 'deposit_reversed':
        return '↺'
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
      case 'deposit_pending':
        return 'Deposit Pending'
      case 'deposit_approved':
        return 'Deposit Approved'
      case 'deposit_rejected':
        return 'Deposit Rejected'
      case 'deposit_reversed':
        return 'Deposit Reversed'
      case 'fee':
        return 'Fee'
      case 'refund':
        return 'Refund'
      case 'adjustment':
        return 'Balance Adjustment'
      default:
        return type?.replace(/_/g, ' ').charAt(0).toUpperCase() + type?.slice(1).replace(/_/g, ' ').toLowerCase()
    }
  }

  const filteredTransactions = transactions.filter(t => {
    if (filter !== 'all' && t.transaction_type !== filter && t.type !== filter) return false
    if (selectedCurrency !== 'all' && t.currency_code !== selectedCurrency) return false
    return true
  })

  const currencies = [...new Set(transactions.map(t => t.currency_code).filter(Boolean))]

  if (loading) {
    return (
      <div className="w-full px-3 sm:px-6 py-4 sm:py-6">
        <div className="text-center text-slate-500">Loading transactions...</div>
      </div>
    )
  }

  return (
    <>
      <div className="w-full px-3 sm:px-6 py-4 sm:py-6">
        <h2 className="text-2xl sm:text-3xl font-light text-slate-900 mb-4 sm:mb-6 tracking-tight">Transaction History</h2>

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-2">Transaction Type</label>
              <select
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm"
              >
                <option value="all">All Types</option>
                <option value="transfer_sent">Money Sent</option>
                <option value="transfer_received">Money Received</option>
                <option value="add_funds">Added Funds</option>
                <option value="bill_payment">Bill Payments</option>
                <option value="deposit_pending">Deposits Pending</option>
                <option value="deposit_approved">Deposits Approved</option>
                <option value="withdrawal">Withdrawals</option>
                <option value="fee">Fees</option>
              </select>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-2">Currency</label>
              <select
                value={selectedCurrency}
                onChange={e => setSelectedCurrency(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm"
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
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 text-center">
            <p className="text-slate-500 text-sm">No transactions found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map(transaction => {
              const usdValue = getCryptoInUSD(transaction.amount, transaction.currency_code)
              const isOutgoing = transaction.type?.includes('sent') || transaction.type === 'bill_payment' || transaction.type === 'withdrawal' || transaction.type?.includes('fee')
              const transactionType = transaction.transaction_type || transaction.type

              return (
                <button
                  key={transaction.id}
                  onClick={() => setSelectedTransaction(transaction)}
                  className="w-full text-left bg-white border border-slate-200 rounded-lg p-4 sm:p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
                >
                  {/* Header: Icon and Title */}
                  <div className="flex items-start gap-3 sm:gap-4 mb-3">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-light text-lg ${
                      isOutgoing
                        ? 'bg-red-100 text-red-600'
                        : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      {getTransactionIcon(transactionType)}
                    </div>

                    <div className="flex-grow min-w-0">
                      <p className="font-medium text-slate-900 text-sm sm:text-base">{getTransactionLabel(transactionType)}</p>
                      <p className="text-xs sm:text-sm text-slate-500 mt-1 break-words">{transaction.description || transaction.note || '—'}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(transaction.created_at).toLocaleDateString()} {new Date(transaction.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                      </p>
                    </div>
                  </div>

                  {/* Amount Section */}
                  <div className="bg-slate-50 rounded-lg p-3 sm:p-4 space-y-2">
                    {/* Primary Amount - in wallet currency */}
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-xs sm:text-sm font-medium text-slate-600 uppercase tracking-wide">
                        {transaction.currency_code?.toUpperCase() || 'Currency'}
                      </span>
                      <p className={`text-base sm:text-lg font-light flex-shrink-0 ${
                        isOutgoing
                          ? 'text-red-600'
                          : 'text-emerald-600'
                      }`}>
                        {isOutgoing ? '-' : '+'}
                        {getCurrencySymbol(transaction.currency_code)}
                        {formatFullPrecision(transaction.amount)} {transaction.currency_code?.toUpperCase()}
                      </p>
                    </div>

                    {/* Original Amount - if this was a converted deposit */}
                    {transaction.original_currency && transaction.original_currency !== transaction.currency_code && transaction.original_amount && (
                      <div className="flex items-baseline justify-between gap-3 pt-2 border-t border-slate-200">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                          {transaction.original_currency?.toUpperCase()} (Original)
                        </span>
                        <p className="text-sm font-light flex-shrink-0 text-slate-700">
                          {getCurrencySymbol(transaction.original_currency)}
                          {formatFullPrecision(transaction.original_amount)} {transaction.original_currency?.toUpperCase()}
                        </p>
                      </div>
                    )}

                    {/* Received Amount - if different from primary */}
                    {transaction.received_currency && transaction.received_currency !== transaction.currency_code && transaction.received_amount && (
                      <div className="flex items-baseline justify-between gap-3 pt-2 border-t border-slate-200">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                          {transaction.received_currency?.toUpperCase()} (Received)
                        </span>
                        <p className="text-sm font-light flex-shrink-0 text-slate-700">
                          {getCurrencySymbol(transaction.received_currency)}
                          {formatFullPrecision(transaction.received_amount)} {transaction.received_currency?.toUpperCase()}
                        </p>
                      </div>
                    )}

                    {/* Conversion Fee - in its own currency */}
                    {transaction.conversion_fee && transaction.conversion_fee > 0 && (
                      <div className="flex items-baseline justify-between gap-3 pt-2 border-t border-amber-200">
                        <span className="text-xs font-medium text-amber-600 uppercase tracking-wide">Conversion Fee</span>
                        <p className="text-sm font-light flex-shrink-0 text-amber-700">
                          {getCurrencySymbol(transaction.conversion_fee_currency || transaction.currency_code)}
                          {formatFullPrecision(transaction.conversion_fee)} {transaction.conversion_fee_currency?.toUpperCase() || transaction.currency_code?.toUpperCase()}
                        </p>
                      </div>
                    )}

                    {/* Crypto to USD Value - only for crypto transactions */}
                    {isCryptoCurrency(transaction.currency_code) && usdValue !== null && (
                      <div className="flex items-baseline justify-between gap-3 pt-2 border-t border-slate-200">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">USD VALUE</span>
                        <p className={`text-sm font-light flex-shrink-0 ${
                          isOutgoing
                            ? 'text-red-600'
                            : 'text-emerald-600'
                        }`}>
                          {isOutgoing ? '-' : '+'}
                          ${formatFullPrecision(usdValue.toFixed(2))} USD
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Reference Number */}
                  {(transaction.reference_number || transaction.payment_reference) && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-500">Ref: {transaction.reference_number || transaction.payment_reference}</p>
                    </div>
                  )}

                  {/* Click Hint */}
                  <div className="mt-3 text-xs text-blue-600 font-medium">Click to view details →</div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg sm:text-xl font-semibold text-slate-900">Transaction Details</h3>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="text-slate-400 hover:text-slate-600 text-2xl font-light"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-6">
              {/* Primary Information */}
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Transaction Type</p>
                  <p className="text-base font-medium text-slate-900">{getTransactionLabel(selectedTransaction.transaction_type || selectedTransaction.type)}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Status</p>
                  <p className="text-base font-medium text-slate-900 capitalize">{selectedTransaction.status || 'Completed'}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Date & Time</p>
                  <p className="text-base text-slate-700">
                    {new Date(selectedTransaction.created_at).toLocaleDateString()} at {new Date(selectedTransaction.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              {/* Amount Details - Show all relevant currencies */}
              <div className="border-t border-slate-200 pt-4 space-y-4">
                <h4 className="font-medium text-slate-900">Amount Details</h4>

                {/* Primary Amount in Wallet Currency */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                    Amount ({selectedTransaction.currency_code?.toUpperCase() || 'Primary Currency'})
                  </p>
                  <p className="text-2xl font-light text-slate-900">
                    {getCurrencySymbol(selectedTransaction.currency_code)}
                    {formatFullPrecision(selectedTransaction.amount)} {selectedTransaction.currency_code?.toUpperCase()}
                  </p>
                </div>

                {/* Original Amount - If converted from another currency */}
                {selectedTransaction.original_amount && selectedTransaction.original_currency && selectedTransaction.original_currency !== selectedTransaction.currency_code && (
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                      Original Amount ({selectedTransaction.original_currency?.toUpperCase()})
                    </p>
                    <p className="text-xl font-light text-slate-900 mb-2">
                      {getCurrencySymbol(selectedTransaction.original_currency)}
                      {formatFullPrecision(selectedTransaction.original_amount)} {selectedTransaction.original_currency?.toUpperCase()}
                    </p>
                    {selectedTransaction.exchange_rate && (
                      <div className="bg-white rounded p-2 mt-2">
                        <p className="text-sm text-slate-600">
                          <span className="font-medium">Exchange Rate:</span> 1 {selectedTransaction.original_currency?.toUpperCase()} = {formatFullPrecision(selectedTransaction.exchange_rate)} {selectedTransaction.currency_code?.toUpperCase()}
                        </p>
                        {selectedTransaction.rate_source && (
                          <p className="text-xs text-slate-500 mt-1">Source: {selectedTransaction.rate_source}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Received Amount - If different from primary */}
                {selectedTransaction.received_amount && selectedTransaction.received_currency && selectedTransaction.received_currency !== selectedTransaction.currency_code && (
                  <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                      Received Amount ({selectedTransaction.received_currency?.toUpperCase()})
                    </p>
                    <p className="text-xl font-light text-slate-900">
                      {getCurrencySymbol(selectedTransaction.received_currency)}
                      {formatFullPrecision(selectedTransaction.received_amount)} {selectedTransaction.received_currency?.toUpperCase()}
                    </p>
                  </div>
                )}

                {/* Net Received Amount - Final amount after fees */}
                {selectedTransaction.net_received_amount && selectedTransaction.net_received_amount !== selectedTransaction.amount && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                      Net Received Amount ({selectedTransaction.currency_code?.toUpperCase()})
                    </p>
                    <p className="text-xl font-light text-emerald-700 font-medium">
                      {getCurrencySymbol(selectedTransaction.currency_code)}
                      {formatFullPrecision(selectedTransaction.net_received_amount)} {selectedTransaction.currency_code?.toUpperCase()}
                    </p>
                  </div>
                )}

                {/* Conversion Fee - in its own currency */}
                {selectedTransaction.conversion_fee && selectedTransaction.conversion_fee > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-1">Conversion Fee</p>
                    <p className="text-lg font-light text-amber-900">
                      {getCurrencySymbol(selectedTransaction.conversion_fee_currency || selectedTransaction.currency_code)}
                      {formatFullPrecision(selectedTransaction.conversion_fee)} {selectedTransaction.conversion_fee_currency?.toUpperCase() || selectedTransaction.currency_code?.toUpperCase()}
                    </p>
                  </div>
                )}

                {/* Crypto to USD Value - only for crypto transactions */}
                {isCryptoCurrency(selectedTransaction.currency_code) && getCryptoInUSD(selectedTransaction.amount, selectedTransaction.currency_code) && (
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">USD Value Reference</p>
                    <p className="text-xl font-light text-slate-900">
                      ${formatFullPrecision(getCryptoInUSD(selectedTransaction.amount, selectedTransaction.currency_code).toFixed(2))} USD
                    </p>
                    <p className="text-xs text-slate-500 mt-1">For reference only, actual transaction was in {selectedTransaction.currency_code?.toUpperCase()}</p>
                  </div>
                )}
              </div>

              {/* Balance Information */}
              {(selectedTransaction.balance_before !== undefined || selectedTransaction.balance_after !== undefined) && (
                <div className="border-t border-slate-200 pt-4 space-y-4">
                  <h4 className="font-medium text-slate-900">Wallet Balance</h4>

                  {selectedTransaction.balance_before !== undefined && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-600">Balance Before ({selectedTransaction.currency_code?.toUpperCase()})</span>
                      <span className="font-light text-slate-900">
                        {getCurrencySymbol(selectedTransaction.currency_code)}
                        {formatFullPrecision(selectedTransaction.balance_before)} {selectedTransaction.currency_code?.toUpperCase()}
                      </span>
                    </div>
                  )}

                  {selectedTransaction.balance_after !== undefined && (
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <span className="text-sm font-medium text-slate-600">Balance After ({selectedTransaction.currency_code?.toUpperCase()})</span>
                      <span className="font-light text-blue-900 font-medium">
                        {getCurrencySymbol(selectedTransaction.currency_code)}
                        {formatFullPrecision(selectedTransaction.balance_after)} {selectedTransaction.currency_code?.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Additional Details */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                {selectedTransaction.description && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Description</p>
                    <p className="text-sm text-slate-700">{selectedTransaction.description}</p>
                  </div>
                )}

                {selectedTransaction.note && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Note</p>
                    <p className="text-sm text-slate-700">{selectedTransaction.note}</p>
                  </div>
                )}

                {selectedTransaction.deposit_method && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Deposit Method</p>
                    <p className="text-sm text-slate-700 capitalize">{selectedTransaction.deposit_method.replace(/_/g, ' ')}</p>
                  </div>
                )}

                {selectedTransaction.payment_reference && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Payment Reference</p>
                    <p className="text-sm font-mono text-slate-700 break-all">{selectedTransaction.payment_reference}</p>
                  </div>
                )}

                {selectedTransaction.reference_number && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Reference Number</p>
                    <p className="text-sm font-mono text-slate-700">{selectedTransaction.reference_number}</p>
                  </div>
                )}

                {selectedTransaction.rate_source && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Rate Source</p>
                    <p className="text-sm text-slate-700 capitalize">{selectedTransaction.rate_source}</p>
                  </div>
                )}

                {selectedTransaction.approved_by && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Approved By</p>
                    <p className="text-sm font-mono text-slate-700">{selectedTransaction.approved_by}</p>
                  </div>
                )}

                {selectedTransaction.approved_at && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Approved At</p>
                    <p className="text-sm text-slate-700">{new Date(selectedTransaction.approved_at).toLocaleString()}</p>
                  </div>
                )}

                {selectedTransaction.reversal_reason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Reversal Reason</p>
                    <p className="text-sm text-red-700">{selectedTransaction.reversal_reason}</p>
                  </div>
                )}

                {selectedTransaction.id && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Transaction ID</p>
                    <p className="text-xs font-mono text-slate-500 break-all">{selectedTransaction.id}</p>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div className="border-t border-slate-200 pt-4">
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
