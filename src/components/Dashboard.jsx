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
      // Skip for guest-local or invalid user IDs
      if (!userId || userId.includes('guest-local') || userId === 'null' || userId === 'undefined') {
        const defaultWallets = [
          { user_id: userId, currency_code: 'PHP', balance: 0 },
          { user_id: userId, currency_code: 'USD', balance: 0 }
        ]
        setWallets(defaultWallets)
        setTotalBalance(0)
        setLoading(false)
        return
      }
      const data = await wisegcashAPI.getWallets(userId)
      const walletData = data || []
      setWallets(walletData)
      const total = walletData.reduce((sum, w) => sum + (w.balance || 0), 0)
      setTotalBalance(total)
    } catch (err) {
      // Fallback: use default wallets with zero balance
      const defaultWallets = [
        { user_id: userId, currency_code: 'PHP', balance: 0 },
        { user_id: userId, currency_code: 'USD', balance: 0 }
      ]
      setWallets(defaultWallets)
      setTotalBalance(0)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center text-slate-500">Loading...</div>
      </div>
    )
  }

  const actions = [
    { id: 'send', label: 'Send Money', icon: '→', color: 'blue' },
    { id: 'wallet', label: 'My Wallets', icon: '○', color: 'emerald' },
    { id: 'bills', label: 'Pay Bills', icon: '⋮', color: 'amber' },
    { id: 'transactions', label: 'History', icon: '↻', color: 'slate' }
  ]

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Total Balance Card */}
      <div className="mb-12">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 text-white shadow-lg">
          <p className="text-slate-300 text-sm font-light tracking-wide mb-3">Total Balance</p>
          <h2 className="text-5xl font-light mb-2">${totalBalance.toFixed(2)}</h2>
          <p className="text-slate-400 text-sm">Across all currencies</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-12">
        <h3 className="text-lg font-light text-slate-900 mb-6 tracking-wide">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {actions.map(action => {
            const colorMap = {
              blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
              emerald: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100',
              amber: 'bg-amber-50 text-amber-600 hover:bg-amber-100',
              slate: 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }
            return (
              <button
                key={action.id}
                onClick={() => onNavigate(action.id)}
                className={`${colorMap[action.color]} rounded-xl p-6 transition-colors text-center group`}
              >
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{action.icon}</div>
                <p className="font-medium text-sm">{action.label}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Wallets Section */}
      <div>
        <h3 className="text-lg font-light text-slate-900 mb-6 tracking-wide">My Wallets</h3>
        {wallets.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <p className="text-slate-500 text-sm">No wallets created yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {wallets.map(wallet => (
              <div key={wallet.id} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-slate-600 font-medium uppercase tracking-wider">{wallet.currency_code}</p>
                  <span className="text-2xl font-light">
                    {wallet.currency_code === 'PHP' ? '₱' : wallet.currency_code === 'EUR' ? '€' : wallet.currency_code === 'GBP' ? '£' : '$'}
                  </span>
                </div>
                <p className="text-3xl font-light text-slate-900">{wallet.balance.toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-3">Available balance</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
