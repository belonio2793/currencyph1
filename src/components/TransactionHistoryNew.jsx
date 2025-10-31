import { useState, useEffect } from 'react'
import { wisegcashAPI } from '../lib/wisegcashAPI'

export default function TransactionHistory({ userId }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selectedCurrency, setSelectedCurrency] = useState('all')

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
      const data = await wisegcashAPI.getTransactions(userId, 100)
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
                <option key={curr} value={curr}>{curr}</option>
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
                    transaction.transaction_type.includes('sent') || transaction.transaction_type === 'bill_payment'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {getTransactionIcon(transaction.transaction_type)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{getTransactionLabel(transaction.transaction_type)}</p>
                    <p className="text-xs text-slate-500 mt-1">{transaction.description}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(transaction.created_at).toLocaleDateString()} {new Date(transaction.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className={`text-lg font-light ${
                    transaction.transaction_type.includes('sent') || transaction.transaction_type === 'bill_payment'
                      ? 'text-red-600'
                      : 'text-emerald-600'
                  }`}>
                    {transaction.transaction_type.includes('sent') || transaction.transaction_type === 'bill_payment' ? '-' : '+'}
                    {transaction.currency_code === 'PHP' ? '₱' : transaction.currency_code === 'EUR' ? '€' : transaction.currency_code === 'GBP' ? '£' : '$'}
                    {transaction.amount.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500">{transaction.currency_code}</p>
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
