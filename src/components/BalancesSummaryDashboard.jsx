import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function BalancesSummaryDashboard({ userId }) {
  const [recentBalances, setRecentBalances] = useState([])
  const [allBalances, setAllBalances] = useState([])
  const [stats, setStats] = useState({
    totalTransactions: 0,
    largestBalance: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('transactions')

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
        .select('id, user_id, transaction_type, amount, currency, new_balance, created_at, description')
        .order('created_at', { ascending: false })
        .limit(100)

      if (fetchError) throw fetchError

      setRecentBalances(data || [])

      // Get unique balances sorted by new_balance descending
      const balanceMap = new Map()
      ;(data || []).forEach(b => {
        const key = `${b.user_id}-${b.currency}`
        const existing = balanceMap.get(key)
        if (!existing || parseFloat(b.new_balance) > parseFloat(existing.new_balance)) {
          balanceMap.set(key, b)
        }
      })
      
      const sorted = Array.from(balanceMap.values())
        .sort((a, b) => parseFloat(b.new_balance || 0) - parseFloat(a.new_balance || 0))
      
      setAllBalances(sorted)

      // Calculate stats
      if (data && data.length > 0) {
        const totalTxns = data.length
        const largest = Math.max(...data.map(b => parseFloat(b.new_balance || 0)))

        setStats({
          totalTransactions: totalTxns,
          largestBalance: largest
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

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch (e) {
      return dateStr
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 mb-8 p-6 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-1/4 mb-6"></div>
        <div className="h-40 bg-slate-100 rounded"></div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 mb-8 overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Balance Data</h2>
      </div>

      {error && (
        <div className="px-6 py-4 bg-red-50 border-b border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 px-6 flex gap-6">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`py-3 px-1 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'transactions'
              ? 'text-slate-900 border-slate-900'
              : 'text-slate-600 border-transparent hover:text-slate-900'
          }`}
        >
          Recent Transactions
        </button>
        <button
          onClick={() => setActiveTab('balances')}
          className={`py-3 px-1 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'balances'
              ? 'text-slate-900 border-slate-900'
              : 'text-slate-600 border-transparent hover:text-slate-900'
          }`}
        >
          Balances
        </button>
      </div>

      <div className="p-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="border border-slate-200 rounded p-4">
            <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">Total Transactions</p>
            <p className="text-2xl font-semibold text-slate-900">{stats.totalTransactions}</p>
          </div>
          <div className="border border-slate-200 rounded p-4">
            <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">Largest Balance</p>
            <p className="text-2xl font-semibold text-slate-900">{stats.largestBalance.toFixed(2)}</p>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'transactions' && (
          <div>
            {recentBalances.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-2 font-semibold text-slate-900">Date</th>
                      <th className="text-left py-3 px-2 font-semibold text-slate-900">Type</th>
                      <th className="text-left py-3 px-2 font-semibold text-slate-900">Description</th>
                      <th className="text-right py-3 px-2 font-semibold text-slate-900">Amount</th>
                      <th className="text-right py-3 px-2 font-semibold text-slate-900">Currency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBalances.slice(0, 20).map((txn, idx) => (
                      <tr key={txn.id} className={idx % 2 === 0 ? 'bg-slate-50' : ''}>
                        <td className="py-3 px-2 text-slate-700">{formatDate(txn.created_at)}</td>
                        <td className="py-3 px-2 text-slate-700">{txn.transaction_type || '-'}</td>
                        <td className="py-3 px-2 text-slate-700">{txn.description || '-'}</td>
                        <td className={`py-3 px-2 text-right font-medium ${getTransactionColor(txn.transaction_type)}`}>
                          {(txn.transaction_type?.includes('sent') || txn.transaction_type === 'bill_payment') ? '-' : '+'}
                          {parseFloat(txn.amount).toFixed(2)}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-700">{txn.currency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-8 text-slate-500">No transactions found</p>
            )}
          </div>
        )}

        {activeTab === 'balances' && (
          <div>
            {allBalances.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-2 font-semibold text-slate-900">User ID</th>
                      <th className="text-right py-3 px-2 font-semibold text-slate-900">Balance</th>
                      <th className="text-right py-3 px-2 font-semibold text-slate-900">Currency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allBalances.map((balance, idx) => (
                      <tr key={`${balance.user_id}-${balance.currency}-${idx}`} className={idx % 2 === 0 ? 'bg-slate-50' : ''}>
                        <td className="py-3 px-2 text-slate-700 font-mono text-xs">{balance.user_id.slice(0, 12)}</td>
                        <td className="py-3 px-2 text-right font-semibold text-slate-900">{parseFloat(balance.new_balance).toFixed(2)}</td>
                        <td className="py-3 px-2 text-right text-slate-700">{balance.currency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-8 text-slate-500">No balances found</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
