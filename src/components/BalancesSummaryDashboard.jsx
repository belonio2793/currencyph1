import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function BalancesSummaryDashboard({ userId }) {
  const [recentBalances, setRecentBalances] = useState([])
  const [stats, setStats] = useState({
    totalTransactions: 0,
    largestBalance: 0,
    averageAmount: 0,
    currencyBreakdown: {}
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchBalancesData()

    const channel = supabase
      .channel('public:balances')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'balances' },
        () => fetchBalancesData()
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [])

  const fetchBalancesData = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('balances')
        .select('id, user_id, transaction_type, amount, currency, new_balance, created_at, description, visibility')
        .order('created_at', { ascending: false })
        .limit(100)

      if (fetchError) throw fetchError

      setRecentBalances(data || [])

      // Calculate stats
      if (data && data.length > 0) {
        const totalTxns = data.length
        const largest = Math.max(...data.map(b => parseFloat(b.new_balance || 0)))
        const avgAmount = (data.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0) / totalTxns).toFixed(2)
        
        // Group by currency
        const currencyMap = {}
        data.forEach(b => {
          if (!currencyMap[b.currency]) {
            currencyMap[b.currency] = { count: 0, total: 0 }
          }
          currencyMap[b.currency].count++
          currencyMap[b.currency].total += parseFloat(b.amount || 0)
        })

        setStats({
          totalTransactions: totalTxns,
          largestBalance: largest,
          averageAmount: avgAmount,
          currencyBreakdown: currencyMap
        })
      }
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  const getTransactionColor = (type) => {
    if (type && type.includes('sent')) return 'text-red-600'
    if (type === 'bill_payment') return 'text-red-600'
    return 'text-emerald-600'
  }

  const getTransactionIcon = (type) => {
    if (type && type.includes('sent')) return '↗'
    if (type === 'bill_payment') return '✕'
    return '↙'
  }

  const getFilteredTransactions = () => {
    if (filter === 'all') return recentBalances.slice(0, 6)
    if (filter === 'incoming') return recentBalances.filter(b => !b.transaction_type?.includes('sent') && b.transaction_type !== 'bill_payment').slice(0, 6)
    if (filter === 'outgoing') return recentBalances.filter(b => b.transaction_type?.includes('sent') || b.transaction_type === 'bill_payment').slice(0, 6)
    return recentBalances.slice(0, 6)
  }

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diffMs = now - date
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)

      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24) return `${diffHours}h ago`
      if (diffDays < 7) return `${diffDays}d ago`
      
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch (e) {
      return dateStr
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200 mb-8 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/4 mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-slate-100 rounded-lg"></div>
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-slate-100 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  const filteredTransactions = getFilteredTransactions()

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 mb-8 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-700 px-8 py-8 text-white">
        <h2 className="text-3xl font-light tracking-tight mb-2">Balance Overview</h2>
        <p className="text-slate-300 text-sm">Real-time transaction summary and activity</p>
      </div>

      <div className="p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {/* Total Transactions */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <p className="text-blue-700 text-sm font-medium uppercase tracking-wider">Total Transactions</p>
              <span className="text-2xl">📊</span>
            </div>
            <p className="text-3xl font-light text-blue-900">{stats.totalTransactions}</p>
            <p className="text-xs text-blue-600 mt-2">All-time records</p>
          </div>

          {/* Largest Balance */}
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <p className="text-emerald-700 text-sm font-medium uppercase tracking-wider">Largest Balance</p>
              <span className="text-2xl">💰</span>
            </div>
            <p className="text-3xl font-light text-emerald-900">{stats.largestBalance.toFixed(2)}</p>
            <p className="text-xs text-emerald-600 mt-2">Peak balance</p>
          </div>

          {/* Average Amount */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <p className="text-orange-700 text-sm font-medium uppercase tracking-wider">Avg Transaction</p>
              <span className="text-2xl">📈</span>
            </div>
            <p className="text-3xl font-light text-orange-900">{stats.averageAmount}</p>
            <p className="text-xs text-orange-600 mt-2">Per transaction</p>
          </div>

          {/* Active Currencies */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <p className="text-purple-700 text-sm font-medium uppercase tracking-wider">Currencies</p>
              <span className="text-2xl">🌍</span>
            </div>
            <p className="text-3xl font-light text-purple-900">{Object.keys(stats.currencyBreakdown).length}</p>
            <p className="text-xs text-purple-600 mt-2">In use</p>
          </div>
        </div>

        {/* Currency Breakdown */}
        {Object.keys(stats.currencyBreakdown).length > 0 && (
          <div className="bg-slate-50 rounded-xl p-6 mb-8 border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Currency Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(stats.currencyBreakdown).map(([currency, data]) => (
                <div key={currency} className="bg-white rounded-lg p-4 border border-slate-100 hover:border-slate-300 transition-colors">
                  <p className="text-slate-600 text-xs font-medium mb-1">{currency}</p>
                  <p className="text-lg font-light text-slate-900">{data.count}</p>
                  <p className="text-xs text-slate-500 mt-1">Total: {data.total.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity Section */}
        <div>
          <div className="mb-6">
            <h3 className="text-lg font-light text-slate-900 mb-4 tracking-tight">Recent Activity</h3>
            
            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6">
              {['all', 'incoming', 'outgoing'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === tab
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tab === 'all' && 'All'}
                  {tab === 'incoming' && '↙ Incoming'}
                  {tab === 'outgoing' && '↗ Outgoing'}
                </button>
              ))}
            </div>
          </div>

          {/* Transaction Cards */}
          <div className="space-y-3">
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((txn) => (
                <div
                  key={txn.id}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-4 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`text-2xl ${getTransactionColor(txn.transaction_type)} mt-1`}>
                        {getTransactionIcon(txn.transaction_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 text-sm">{txn.description || txn.transaction_type || 'Transaction'}</p>
                        <p className="text-xs text-slate-500 mt-1">{formatDate(txn.created_at)}</p>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className={`font-light text-sm ${getTransactionColor(txn.transaction_type)}`}>
                        {(txn.transaction_type?.includes('sent') || txn.transaction_type === 'bill_payment') ? '-' : '+'}
                        {parseFloat(txn.amount).toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{txn.currency}</p>
                    </div>
                  </div>
                  {txn.new_balance !== null && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <p className="text-xs text-slate-600">Balance after: <span className="font-medium text-slate-900">{parseFloat(txn.new_balance).toFixed(2)} {txn.currency}</span></p>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-500">
                <p className="text-sm">No transactions found</p>
              </div>
            )}
          </div>

          {/* View More Link */}
          {recentBalances.length > 6 && (
            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600">
                Showing 6 of {recentBalances.length} transactions
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
