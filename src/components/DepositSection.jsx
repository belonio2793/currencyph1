import { useState } from 'react'
import { dogTokenAPI } from '../lib/supabaseClient'

export default function DepositSection({ userId, onDepositSuccess }) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleDeposit = async () => {
    setError(null)
    setSuccess(false)

    if (!amount || parseFloat(amount) <= 0) {
      setError('Enter a valid amount')
      return
    }

    if (!userId) {
      setError('User ID required')
      return
    }

    setLoading(true)
    try {
      const depositAmount = parseFloat(amount)
      await dogTokenAPI.addDeposit(userId, depositAmount, 'manual')
      
      setSuccess(true)
      setAmount('')
      
      setTimeout(() => {
        setSuccess(false)
        if (onDepositSuccess) {
          onDepositSuccess()
        }
      }, 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleDeposit()
    }
  }

  return (
    <div className="bg-white border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-black mb-4">Add DOG</h2>
      
      <div className="flex gap-2">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Amount"
          disabled={loading}
          className="flex-1 px-3 py-2 border border-gray-300 focus:outline-none focus:border-black text-sm"
        />
        <button
          onClick={handleDeposit}
          disabled={loading}
          className="px-4 py-2 bg-black text-white font-medium text-sm hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : 'Deposit'}
        </button>
      </div>

      {error && (
        <p className="text-red-600 text-xs mt-2">{error}</p>
      )}

      {success && (
        <p className="text-green-600 text-xs mt-2">✓ Deposit successful</p>
      )}
    </div>
  )
}
