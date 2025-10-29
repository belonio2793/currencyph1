import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function BalancesSection({ userId }) {
  const [tab, setTab] = useState('most_recent')
  const [mostRecent, setMostRecent] = useState([])
  const [largest, setLargest] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchId, setSearchId] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchMostRecent()
    fetchLargest()

    // Real-time subscription: update lists on insert/update (compatible with existing project usage)
    const subscription = supabase
      .from('balances')
      .on('INSERT', payload => {
        if (tab === 'most_recent') fetchMostRecent()
        if (tab === 'largest_balances') fetchLargest()
      })
      .on('UPDATE', payload => {
        if (tab === 'most_recent') fetchMostRecent()
        if (tab === 'largest_balances') fetchLargest()
      })
      .subscribe()

    return () => {
      try { subscription.unsubscribe() } catch (e) { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const fetchMostRecent = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('balances')
        .select('id, reference_id, user_id, activity_type, transaction_type, amount, currency, previous_balance, new_balance, status, visibility, description, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      setMostRecent(data || [])
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  const fetchLargest = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('balances')
        .select('id, reference_id, user_id, activity_type, transaction_type, amount, currency, previous_balance, new_balance, status, visibility, description, created_at')
        .order('new_balance', { ascending: false })
        .limit(50)
      if (error) throw error
      setLargest(data || [])
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('balances')
        .select('id, reference_id, user_id, activity_type, transaction_type, amount, currency, previous_balance, new_balance, status, visibility, description, created_at')
        .or(`id.eq.${searchId},reference_id.eq.${searchId}`)
        .limit(1)
      if (error) throw error
      setSearchResult((data && data[0]) || null)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (t) => {
    try { return new Date(t).toLocaleString() } catch (e) { return t }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200 mt-8">
      <h3 className="text-xl font-light text-slate-900 mb-4 tracking-tight">Balances Ledger</h3>

      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setTab('most_recent')} className={`px-3 py-2 rounded-lg text-sm ${tab === 'most_recent' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700'}`}>
          Most Recent
        </button>
        <button onClick={() => setTab('largest_balances')} className={`px-3 py-2 rounded-lg text-sm ${tab === 'largest_balances' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700'}`}>
          Largest Balances
        </button>
        <button onClick={() => setTab('transaction_id')} className={`px-3 py-2 rounded-lg text-sm ${tab === 'transaction_id' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700'}`}>
          Transaction ID
        </button>
      </div>

      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

      {tab === 'transaction_id' ? (
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="Enter transaction ID or reference ID"
              className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg"
            />
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Search</button>
          </div>

          {loading && <p className="text-sm text-slate-500">Searching...</p>}

          {searchResult ? (
            <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-sm font-medium text-slate-900">ID: <span className="font-mono text-xs text-slate-700">{searchResult.id}</span></p>
              <p className="text-sm">Type: {searchResult.transaction_type}</p>
              <p className="text-sm">Amount: {parseFloat(searchResult.amount).toFixed(2)} {searchResult.currency}</p>
              <p className="text-sm">Balance after: {parseFloat(searchResult.new_balance || 0).toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-2">Created: {formatDate(searchResult.created_at)}</p>
            </div>
          ) : (
            !loading && <p className="text-sm text-slate-500">No transaction found.</p>
          )}
        </form>
      ) : (
        <div>
          {loading && <p className="text-sm text-slate-500">Loading...</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="py-2">ID</th>
                  <th className="py-2">When</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Balance</th>
                  <th className="py-2">Visibility</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(tab === 'most_recent' ? mostRecent : largest).map(row => (
                  <tr key={row.id} className="bg-white">
                    <td className="py-3 font-mono text-xs text-slate-700">{row.id.slice(0,8)}</td>
                    <td className="py-3 text-xs text-slate-600">{formatDate(row.created_at)}</td>
                    <td className="py-3 text-xs text-slate-700">{row.transaction_type}</td>
                    <td className={`py-3 text-xs font-medium ${row.transaction_type && row.transaction_type.includes('sent') ? 'text-red-600' : 'text-emerald-600'}`}>
                      {(row.transaction_type && row.transaction_type.includes('sent')) ? '-' : '+'}{parseFloat(row.amount).toFixed(2)} {row.currency}
                    </td>
                    <td className="py-3 text-xs text-slate-700">{row.new_balance !== null ? parseFloat(row.new_balance).toFixed(2) : '-'}</td>
                    <td className="py-3 text-xs text-slate-500">{row.visibility ? 'Public' : 'Private'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
