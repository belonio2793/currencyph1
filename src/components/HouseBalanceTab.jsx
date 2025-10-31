import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function HouseBalanceTab() {
  const [houseBalance, setHouseBalance] = useState(0)
  const [rakeTransactions, setRakeTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currencyFilter, setCurrencyFilter] = useState('PHP')

  const HOUSE_ID = '00000000-0000-0000-0000-000000000000'

  useEffect(() => {
    loadHouseData()

    // Subscribe to wallet updates
    const walletChannel = supabase
      .channel('public:wallets')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${HOUSE_ID}`
        },
        () => loadHouseData()
      )
      .subscribe()

    // Subscribe to rake transactions
    const rakeChannel = supabase
      .channel('public:rake_transactions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rake_transactions' },
        () => loadRakeTransactions()
      )
      .subscribe()

    return () => {
      walletChannel.unsubscribe()
      rakeChannel.unsubscribe()
    }
  }, [])

  useEffect(() => {
    loadRakeTransactions()
  }, [currencyFilter])

  async function loadHouseData() {
    setLoading(true)
    setError(null)
    try {
      const { data: wallets, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', HOUSE_ID)

      if (walletError) throw walletError

      const phpWallet = wallets?.find(w => w.currency_code === 'PHP')
      setHouseBalance(phpWallet ? Number(phpWallet.balance) : 0)
    } catch (err) {
      console.error('Error loading house balance:', err)
      setError('Failed to load house balance')
    } finally {
      setLoading(false)
    }
  }

  async function loadRakeTransactions() {
    try {
      const { data: txs, error: txError } = await supabase
        .from('rake_transactions')
        .select('id, user_id, amount, tip_percent, currency_code, balance_after, created_at')
        .eq('currency_code', currencyFilter)
        .order('created_at', { ascending: false })
        .limit(100)

      if (txError) throw txError

      // Load user emails separately
      if (txs && txs.length > 0) {
        const userIds = [...new Set(txs.map(tx => tx.user_id))]
        const { data: users } = await supabase
          .from('users')
          .select('id, email')
          .in('id', userIds)

        const userMap = {}
        if (users) {
          users.forEach(u => {
            userMap[u.id] = u.email
          })
        }

        const enrichedTxs = txs.map(tx => ({
          ...tx,
          users: { email: userMap[tx.user_id] || tx.user_id }
        }))
        setRakeTransactions(enrichedTxs)
      } else {
        setRakeTransactions([])
      }
      setError(null)
    } catch (err) {
      console.error('Error loading rake transactions:', err)
      setRakeTransactions([])
      setError(null)
    }
  }

  const formatCurrency = (amount) => {
    return Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading house balance...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-600 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* House Balance Card */}
      <div className="bg-slate-800/40 border border-slate-600/30 rounded-xl backdrop-blur-sm p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-300 text-sm font-semibold mb-2">🏠 House Balance</p>
            <h2 className="text-5xl font-bold font-mono">{formatCurrency(houseBalance)}</h2>
            <p className="text-slate-400 text-sm mt-2">{currencyFilter}</p>
          </div>
          <div className="text-6xl opacity-20">🎰</div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-slate-800/40 border border-slate-600/30 rounded-lg backdrop-blur-sm overflow-hidden">
        <div className="p-6 border-b border-slate-600/30">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">Rake Transactions</h3>
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="px-3 py-2 border border-slate-600/30 rounded-lg text-sm bg-slate-700/50 text-white"
            >
              <option value="PHP">PHP</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {rakeTransactions.length} transactions recorded
          </p>
        </div>

        {rakeTransactions.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <div className="text-4xl mb-2">📊</div>
            <p>No results to display</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-700/30 border-b border-slate-600/30">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-slate-300">Player</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-300">Tip %</th>
                  <th className="px-6 py-3 text-right font-semibold text-slate-300">Rake Amount</th>
                  <th className="px-6 py-3 text-right font-semibold text-slate-300">House Balance</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-300">Date</th>
                </tr>
              </thead>
              <tbody>
                {rakeTransactions.map((tx, idx) => (
                  <tr key={tx.id} className={idx % 2 === 0 ? 'bg-transparent' : 'bg-slate-700/20'}>
                    <td className="px-6 py-3 text-slate-300 font-mono text-xs">
                      {tx.users?.email || tx.user_id}
                    </td>
                    <td className="px-6 py-3 text-slate-300">
                      <span className="inline-block px-2 py-1 bg-blue-600/30 text-blue-300 rounded font-semibold">
                        {tx.tip_percent}%
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right font-mono font-semibold text-emerald-400">
                      +{formatCurrency(tx.amount)} {tx.currency_code}
                    </td>
                    <td className="px-6 py-3 text-right font-mono font-bold text-slate-200">
                      {formatCurrency(tx.balance_after)} {tx.currency_code}
                    </td>
                    <td className="px-6 py-3 text-slate-400 text-xs">
                      {formatDate(tx.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      {rakeTransactions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800/40 border border-slate-600/30 rounded-lg p-4 backdrop-blur-sm">
            <p className="text-sm text-slate-400 mb-1">Total Transactions</p>
            <p className="text-3xl font-bold text-white">{rakeTransactions.length}</p>
          </div>
          <div className="bg-slate-800/40 border border-slate-600/30 rounded-lg p-4 backdrop-blur-sm">
            <p className="text-sm text-slate-400 mb-1">Avg. Tip Percent</p>
            <p className="text-3xl font-bold text-white">
              {(rakeTransactions.reduce((sum, tx) => sum + tx.tip_percent, 0) / rakeTransactions.length).toFixed(1)}%
            </p>
          </div>
          <div className="bg-slate-800/40 border border-slate-600/30 rounded-lg p-4 backdrop-blur-sm">
            <p className="text-sm text-slate-400 mb-1">Avg. Rake/Transaction</p>
            <p className="text-3xl font-bold text-white">
              {formatCurrency(rakeTransactions.reduce((sum, tx) => sum + tx.amount, 0) / rakeTransactions.length)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
