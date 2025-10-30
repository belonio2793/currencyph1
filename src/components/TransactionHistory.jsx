import { useState, useEffect } from 'react'
import { tokenAPI } from '../lib/supabaseClient'

export default function TransactionHistory({ userId, refresh }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const fetchTransactions = async () => {
      try {
        const data = await tokenAPI.getDepositHistory(userId)
        setTransactions(data)
        setError(null)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [userId, refresh])

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 p-6">
        <p className="text-gray-500 text-sm">Loading transactions...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white border border-gray-200 p-6">
        <p className="text-red-600 text-sm">Error: {error}</p>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-white border border-gray-200 p-6">
        <p className="text-gray-500 text-sm">No transactions yet</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-black mb-4">History</h3>
      
      <div className="space-y-3">
        {transactions.map((tx) => (
          <div key={tx.id} className="flex justify-between items-center pb-3 border-b border-gray-100 last:border-b-0">
            <div>
              <p className="text-sm font-medium text-black">
                +{tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500">
                {new Date(tx.created_at).toLocaleDateString()} {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <span className={`text-xs font-medium px-2 py-1 ${
              tx.status === 'completed' ? 'bg-gray-100 text-gray-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {tx.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
