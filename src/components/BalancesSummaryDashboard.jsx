import React, { useEffect, useState } from 'react'
import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function BalancesSummaryDashboard({ userId }) {
  const [recentBalances, setRecentBalances] = useState([])
  const [allBalances, setAllBalances] = useState([])
  const [filteredBalances, setFilteredBalances] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('transactions')

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [minBalance, setMinBalance] = useState('')
  const [maxBalance, setMaxBalance] = useState('')

  useEffect(() => {
    fetchBalancesData()

    const channel = supabase
      .channel('public:wallet_transactions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallet_transactions' },
        () => fetchBalancesData()
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [])

  // Apply filters when search or range changes
  useEffect(() => {
    let filtered = [...allBalances]

    // Search by email or user ID
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(b =>
        b.user_id.toLowerCase().includes(query) ||
        (b.email && b.email.toLowerCase().includes(query))
      )
    }

    // Filter by balance range
    if (minBalance !== '') {
      filtered = filtered.filter(b => parseFloat(b.new_balance) >= parseFloat(minBalance))
    }
    if (maxBalance !== '') {
      filtered = filtered.filter(b => parseFloat(b.new_balance) <= parseFloat(maxBalance))
    }

    setFilteredBalances(filtered)
  }, [searchQuery, minBalance, maxBalance, allBalances])

  const fetchBalancesData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Recent transactions: from wallet_transactions
      const { data: txData, error: txErr } = await supabase
        .from('wallet_transactions')
        .select('id, user_id, type, amount, currency_code, balance_after, created_at, description')
        .order('created_at', { ascending: false })
        .limit(200)

      if (txErr) throw txErr

      // Normalize recent transactions
      const recent = (txData || []).map(t => ({
        id: t.id,
        user_id: t.user_id,
        transaction_type: t.type,
        amount: t.amount,
        currency: t.currency_code,
        new_balance: t.balance_after,
        created_at: t.created_at,
        description: t.description
      }))

      setRecentBalances(recent)

      // Aggregate current balances across wallets tables (wallets, wallets_fiat, wallets_crypto)
      const [ { data: wData = [] } = {}, { data: fData = [] } = {}, { data: cData = [] } = {} ] = await Promise.all([
        supabase.from('wallets').select('user_id, balance, currency_code'),
        supabase.from('wallets_fiat').select('user_id, balance, currency'),
        supabase.from('wallets_crypto').select('user_id, balance, chain')
      ])

      const combined = []

      (wData || []).forEach(r => combined.push({ user_id: r.user_id, new_balance: r.balance, currency: r.currency_code }))
      (fData || []).forEach(r => combined.push({ user_id: r.user_id, new_balance: r.balance, currency: r.currency }))
      (cData || []).forEach(r => combined.push({ user_id: r.user_id, new_balance: r.balance, currency: r.chain || 'CRYPTO' }))

      // Reduce to highest balances per (user_id, currency)
      const balanceMap = new Map()
      combined.forEach(b => {
        const key = `${b.user_id}-${b.currency}`
        const existing = balanceMap.get(key)
        if (!existing || parseFloat(b.new_balance || 0) > parseFloat(existing.new_balance || 0)) {
          balanceMap.set(key, b)
        }
      })

      const sorted = Array.from(balanceMap.values()).sort((a, b) => parseFloat(b.new_balance || 0) - parseFloat(a.new_balance || 0))

      setAllBalances(sorted)
      setFilteredBalances(sorted)
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
      const now = new Date()
      const diffMs = now - date
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)

      if (diffMins < 1) return 'Now'
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
      <div className="bg-white rounded-lg border border-slate-200 mb-8 p-6 animate-pulse">
        <div className="h-12 bg-slate-200 rounded w-1/2 mb-6"></div>
        <div className="h-40 bg-slate-100 rounded"></div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 mb-8 overflow-hidden">
      {error && (
        <div className="px-6 py-4 bg-red-50 border-b border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Tabs - No Header Title */}
      <div className="border-b border-slate-200 px-6 flex gap-6">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'transactions'
              ? 'text-slate-900 border-slate-900'
              : 'text-slate-600 border-transparent hover:text-slate-900'
          }`}
        >
          Recent Transactions
        </button>
        <button
          onClick={() => setActiveTab('balances')}
          className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'balances'
              ? 'text-slate-900 border-slate-900'
              : 'text-slate-600 border-transparent hover:text-slate-900'
          }`}
        >
          Balances
        </button>
      </div>

      <div className="p-6">
        {/* Recent Transactions Tab */}
        {activeTab === 'transactions' && (
          <div>
            <p className="text-xs text-slate-600 uppercase tracking-wide mb-4 font-medium">Real-time ledger across platform</p>
            {recentBalances.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-2 font-semibold text-slate-900">Time</th>
                      <th className="text-left py-3 px-2 font-semibold text-slate-900">User ID</th>
                      <th className="text-left py-3 px-2 font-semibold text-slate-900">Type</th>
                      <th className="text-left py-3 px-2 font-semibold text-slate-900">Description</th>
                      <th className="text-right py-3 px-2 font-semibold text-slate-900">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBalances.slice(0, 50).map((txn, idx) => (
                      <tr key={txn.id} className={idx % 2 === 0 ? 'bg-slate-50' : ''}>
                        <td className="py-3 px-2 text-slate-600 text-xs">{formatDate(txn.created_at)}</td>
                        <td className="py-3 px-2 text-slate-700 font-mono text-xs">{txn.user_id.slice(0, 12)}</td>
                        <td className="py-3 px-2 text-slate-700 text-xs">{txn.transaction_type || '-'}</td>
                        <td className="py-3 px-2 text-slate-700">{txn.description || '-'}</td>
                        <td className={`py-3 px-2 text-right font-medium text-xs ${getTransactionColor(txn.transaction_type)}`}>
                          {(txn.transaction_type?.includes('sent') || txn.transaction_type === 'bill_payment') ? '-' : '+'}
                          {parseFloat(txn.amount).toFixed(2)} {txn.currency}
                        </td>
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

        {/* Balances Tab */}
        {activeTab === 'balances' && (
          <div>
            <p className="text-xs text-slate-600 uppercase tracking-wide mb-4 font-medium">Highest to lowest balances</p>
            
            {/* Search and Filter Section */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1 block">Search by Email or User ID</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-slate-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1 block">Min Balance</label>
                  <input
                    type="number"
                    value={minBalance}
                    onChange={(e) => setMinBalance(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-slate-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1 block">Max Balance</label>
                  <input
                    type="number"
                    value={maxBalance}
                    onChange={(e) => setMaxBalance(e.target.value)}
                    placeholder="Any"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-slate-600"
                  />
                </div>
              </div>
              {(searchQuery || minBalance || maxBalance) && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setMinBalance('')
                    setMaxBalance('')
                  }}
                  className="text-xs text-slate-600 hover:text-slate-900 mt-3 underline"
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* Results Summary */}
            {(searchQuery || minBalance || maxBalance) && (
              <p className="text-xs text-slate-600 mb-4">
                Showing {filteredBalances.length} of {allBalances.length} balances
              </p>
            )}

            {/* Balances Table */}
            {(filteredBalances.length > 0 || !searchQuery && !minBalance && !maxBalance) ? (
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
                    {filteredBalances.map((balance, idx) => (
                      <tr key={`${balance.user_id}-${balance.currency}-${idx}`} className={idx % 2 === 0 ? 'bg-slate-50' : ''}>
                        <td className="py-3 px-2 text-slate-700 font-mono text-xs">{balance.user_id.slice(0, 16)}</td>
                        <td className="py-3 px-2 text-right font-semibold text-slate-900">{parseFloat(balance.new_balance).toFixed(2)}</td>
                        <td className="py-3 px-2 text-right text-slate-700 text-xs">{balance.currency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-8 text-slate-500">No balances match your filters</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
