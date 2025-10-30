import { useState, useEffect } from 'react'
import { tokenAPI } from '../lib/supabaseClient'

export default function BalanceDisplay({ userId }) {
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const fetchBalance = async () => {
      try {
        const bal = await tokenAPI.getUserBalance(userId)
        setBalance(bal)
        setError(null)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchBalance()

    // Subscribe to real-time updates
    const subscription = tokenAPI.subscribeToBalance(userId, (newBalance) => {
      setBalance(newBalance)
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [userId])

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 p-6 mb-6">
        <p className="text-gray-500 text-sm">Loading balance...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white border border-red-200 p-6 mb-6">
        <p className="text-red-600 text-sm">Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 p-6 mb-6">
      <p className="text-gray-600 text-xs mb-1">Balance</p>
      <p className="text-3xl font-bold text-black">
        {balance !== null ? balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0'}
      </p>
      <p className="text-gray-500 text-xs mt-2">Real-time via Supabase</p>
    </div>
  )
}
