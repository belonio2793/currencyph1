import { useState, useEffect } from 'react'
import { wisegcashAPI } from '../lib/wisegcashAPI'

export default function Dashboard({ userId, onNavigate }) {
  const [wallets, setWallets] = useState([])
  const [totalBalance, setTotalBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWallets()
  }, [userId])

  const loadWallets = async () => {
    try {
      const data = await wisegcashAPI.getWallets(userId)
      setWallets(data)

      // Calculate total balance (simple sum, assuming USD equivalent)
      const total = data.reduce((sum, w) => sum + (w.balance || 0), 0)
      setTotalBalance(total)
    } catch (err) {
      console.error('Error loading wallets:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Total Balance Card */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-8 text-white mb-8">
        <p className="text-sm opacity-90 mb-2">Total Balance</p>
        <h2 className="text-4xl font-bold mb-2">${totalBalance.toFixed(2)}</h2>
        <p className="text-sm opacity-75">Across all currencies</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <button
          onClick={() => onNavigate('send')}
          className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow text-center"
        >
          <div className="text-4xl mb-2">📤</div>
          <p className="font-semibold text-gray-900">Send Money</p>
          <p className="text-sm text-gray-500">To other users</p>
        </button>

        <button
          onClick={() => onNavigate('wallet')}
          className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow text-center"
        >
          <div className="text-4xl mb-2">💳</div>
          <p className="font-semibold text-gray-900">My Wallets</p>
          <p className="text-sm text-gray-500">View balances</p>
        </button>

        <button
          onClick={() => onNavigate('bills')}
          className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow text-center"
        >
          <div className="text-4xl mb-2">📋</div>
          <p className="font-semibold text-gray-900">Pay Bills</p>
          <p className="text-sm text-gray-500">Utilities, etc</p>
        </button>

        <button
          onClick={() => onNavigate('transactions')}
          className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow text-center"
        >
          <div className="text-4xl mb-2">📊</div>
          <p className="font-semibold text-gray-900">History</p>
          <p className="text-sm text-gray-500">All transactions</p>
        </button>
      </div>

      {/* My Wallets Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">My Wallets</h3>
        <div className="space-y-3">
          {wallets.length === 0 ? (
            <p className="text-gray-500">No wallets created yet</p>
          ) : (
            wallets.map(wallet => (
              <div
                key={wallet.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div>
                  <p className="font-semibold text-gray-900">{wallet.currency_code}</p>
                  <p className="text-sm text-gray-500">Available balance</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">
                    {wallet.currency_code === 'PHP' ? '₱' : '$'}
                    {wallet.balance.toFixed(2)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
