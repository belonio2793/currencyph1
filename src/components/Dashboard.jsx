import { useState, useEffect } from 'react'
import { currencyAPI } from '../lib/payments'
import { getWalletDisplayPreferences } from '../lib/walletPreferences'
import { formatNumber } from '../lib/currency'
import { convertFiatToCryptoDb } from '../lib/cryptoRatesDb'

export default function Dashboard({ userId, onNavigate, globalCurrency = 'PHP', globalCryptocurrency = 'BTC', userEmail }) {
  const [wallets, setWallets] = useState([])
  const [totalBalance, setTotalBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [displayCurrencies, setDisplayCurrencies] = useState(['PHP'])
  const [cryptoBalance, setCryptoBalance] = useState(null)
  const [loadingCrypto, setLoadingCrypto] = useState(false)

  useEffect(() => {
    loadData()
  }, [userId])

  // Convert balance to cryptocurrency for dual display
  useEffect(() => {
    const convertToCrypto = async () => {
      if (!totalBalance || !globalCryptocurrency || !globalCurrency || !userEmail) {
        setCryptoBalance(null)
        return
      }

      setLoadingCrypto(true)
      try {
        const crypto = await convertFiatToCryptoDb(totalBalance, globalCurrency, globalCryptocurrency)
        setCryptoBalance(crypto)
      } catch (error) {
        console.error('Failed to convert balance to crypto:', error)
        setCryptoBalance(null)
      }
      setLoadingCrypto(false)
    }

    convertToCrypto()
  }, [totalBalance, globalCurrency, globalCryptocurrency, userEmail])

  const loadData = async () => {
    try {
      // Skip for guest-local or invalid user IDs
      if (!userId || userId.includes('guest-local') || userId === 'null' || userId === 'undefined') {
        const defaultWallets = [
          { user_id: userId, currency_code: 'PHP', balance: 0 }
        ]
        setWallets(defaultWallets)
        setTotalBalance(0)
        setDisplayCurrencies(['PHP'])
        setLoading(false)
        return
      }

      // Load user's wallet display preferences
      const preferences = await getWalletDisplayPreferences(userId)
      setDisplayCurrencies(preferences || ['PHP'])

      // Load all wallets for the user
      const data = await currencyAPI.getWallets(userId)
      const walletData = data || []

      // Filter wallets to show only selected currencies
      const filteredWallets = walletData.filter(wallet =>
        preferences.includes(wallet.currency_code)
      )

      setWallets(filteredWallets)
      const total = filteredWallets.reduce((sum, w) => sum + (w.balance || 0), 0)
      setTotalBalance(total)
    } catch (err) {
      // Fallback: use default wallets with zero balance
      const defaultWallets = [
        { user_id: userId, currency_code: 'PHP', balance: 0 }
      ]
      setWallets(defaultWallets)
      setTotalBalance(0)
      setDisplayCurrencies(['PHP'])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="text-center text-slate-500">Loading...</div>
      </div>
    )
  }

  const actions = [
    { id: 'send', label: 'Send Money', icon: '→', color: 'blue', bgColor: 'bg-blue-50 hover:bg-blue-100' },
    { id: 'wallet', label: 'My Wallets', icon: '○', color: 'emerald', bgColor: 'bg-emerald-50 hover:bg-emerald-100' },
    { id: 'bills', label: 'Pay Bills', icon: '⋮', color: 'amber', bgColor: 'bg-amber-50 hover:bg-amber-100' },
    { id: 'transactions', label: 'History', icon: '↻', color: 'purple', bgColor: 'bg-purple-50 hover:bg-purple-100' }
  ]

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Total Balance Card */}
      <div className="mb-6">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg">
          <p className="text-slate-300 text-sm font-light tracking-wide mb-3">Total Balance</p>
          <h2 className="text-5xl font-light mb-2">${formatNumber(totalBalance)} {globalCurrency}</h2>
          <p className="text-slate-300 text-sm mb-4">
            {loadingCrypto ? (
              <span className="italic text-slate-400">loading {globalCryptocurrency}...</span>
            ) : cryptoBalance !== null ? (
              <>{cryptoBalance.toFixed(8)} {globalCryptocurrency}</>
            ) : (
              <span className="italic text-slate-400">crypto unavailable</span>
            )}
          </p>
          <p className="text-slate-400 text-sm">Across all currencies</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <h3 className="text-lg font-light text-slate-900 mb-6 tracking-wide">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {actions.map(action => (
              <button
                key={action.id}
                onClick={() => onNavigate(action.id)}
                className={`${action.bgColor} text-${action.color}-600 rounded-xl p-6 transition-colors text-center group`}
              >
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{action.icon}</div>
                <p className="font-medium text-sm">{action.label}</p>
              </button>
            )
          )}
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
            {wallets.map((wallet, idx) => {
              const colors = ['bg-blue-50', 'bg-emerald-50', 'bg-amber-50', 'bg-cyan-50', 'bg-purple-50', 'bg-rose-50', 'bg-teal-50', 'bg-indigo-50']
              return (
              <div key={wallet.id} className={colors[idx % colors.length] + ' rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow'}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-slate-600 font-medium uppercase tracking-wider">{wallet.currency_code}</p>
                  <span className="text-2xl font-light">
                    {wallet.currency_code === 'PHP' ? '₱' : wallet.currency_code === 'EUR' ? '€' : wallet.currency_code === 'GBP' ? '£' : '$'}
                  </span>
                </div>
                <p className="text-3xl font-light text-slate-900">{formatNumber(wallet.balance)}</p>
                <p className="text-xs text-slate-500 mt-3">Available balance</p>
              </div>
            )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
