import { useState, useEffect } from 'react'
import { wisegcashAPI } from '../lib/payments'

export default function HomePage({ userId, userEmail, globalCurrency = 'PHP', onTabChange }) {
  const [wallets, setWallets] = useState([])
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalBalanceConverted, setTotalBalanceConverted] = useState(null)
  const [totalDebtConverted, setTotalDebtConverted] = useState(null)

  useEffect(() => {
    loadData()
  }, [userId])

  const loadData = async () => {
    try {
      if (userId && !userId.includes('guest-local')) {
        const [walletsData, loansData] = await Promise.all([
          wisegcashAPI.getWallets(userId).catch(() => []),
          wisegcashAPI.getLoans(userId).catch(() => [])
        ])
        const w = walletsData || []
        const l = loansData || []
        setWallets(w)
        setLoans(l)

        // Convert totals to globalCurrency
        try {
          // Total balance: sum wallet balances converted to globalCurrency
          let balanceSum = 0
          for (const wallet of w) {
            const amt = Number(wallet.balance || 0)
            if (amt === 0) continue
            if (!wallet.currency_code || wallet.currency_code === globalCurrency) {
              balanceSum += amt
            } else {
              const rate = await wisegcashAPI.getExchangeRate(wallet.currency_code, globalCurrency)
              balanceSum += rate ? amt * Number(rate) : 0
            }
          }
          setTotalBalanceConverted(Number(balanceSum).toFixed(2))

          // Total debt: sum loan remaining_balance/total_owed converted to globalCurrency
          let debtSum = 0
          for (const loan of l) {
            const amt = Number(loan.remaining_balance || loan.total_owed || 0)
            if (amt === 0) continue
            const loanCurrency = loan.currency || loan.currency_code || globalCurrency
            if (loanCurrency === globalCurrency) {
              debtSum += amt
            } else {
              const rate = await wisegcashAPI.getExchangeRate(loanCurrency, globalCurrency)
              debtSum += rate ? amt * Number(rate) : 0
            }
          }
          setTotalDebtConverted(Number(debtSum).toFixed(2))
        } catch (convErr) {
          console.warn('Failed to convert totals to display currency', convErr)
          setTotalBalanceConverted(null)
          setTotalDebtConverted(null)
        }
      }
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const getTotalBalance = () => {
    return wallets.reduce((sum, w) => sum + (w.balance || 0), 0).toFixed(2)
  }

  const getActiveLoanCount = () => {
    return loans.filter(l => l.status === 'active' || l.status === 'pending').length
  }

  const getTotalDebt = () => {
    return loans.reduce((sum, l) => sum + (l.remaining_balance || l.total_owed || 0), 0).toFixed(2)
  }

  const personalLoans = loans.filter(l => l.loan_type === 'personal')
  const businessLoans = loans.filter(l => l.loan_type === 'business')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-light text-slate-900 mb-2">Welcome back, {userEmail?.split('@')[0] || 'User'}</h1>
          <p className="text-slate-600">Quick access to your most used features</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Total Balance */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
            <p className="text-sm text-blue-600 font-medium uppercase tracking-wider mb-1">Total Balance</p>
            <p className="text-3xl font-light text-blue-900">{totalBalanceConverted != null ? totalBalanceConverted : getTotalBalance()} {globalCurrency}</p>
          </div>

          {/* Active Loans */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200">
            <p className="text-sm text-orange-600 font-medium uppercase tracking-wider mb-1">Active Loans</p>
            <p className="text-3xl font-light text-orange-900">{getActiveLoanCount()}</p>
          </div>

          {/* Total Debt */}
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
            <p className="text-sm text-red-600 font-medium uppercase tracking-wider mb-1">Total Debt</p>
            <p className="text-3xl font-light text-red-900">{getTotalDebt()} {globalCurrency}</p>
          </div>
        </div>

        {/* Featured Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Play Currency Game */}
          <button
            onClick={() => onTabChange('play-currency')}
            className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-sky-300 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-sky-100 group-hover:bg-sky-200 transition-colors">
                <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
                </svg>
              </div>
              <span className="text-2xl">🎮</span>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Play Currency</h3>
            <p className="text-sm text-slate-600 mb-4">Create your character, explore, fight, and trade</p>
            <div className="text-sm font-medium text-sky-600 group-hover:text-sky-700">Open game →</div>
          </button>
          {/* Deposit Card */}
          <button
            onClick={() => onTabChange('deposit')}
            className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-blue-300 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100 group-hover:bg-blue-200 transition-colors">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-2xl">💰</span>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Deposit</h3>
            <p className="text-sm text-slate-600 mb-4">Add funds to your wallet using fiat or cryptocurrency</p>
            <div className="text-sm font-medium text-blue-600 group-hover:text-blue-700">Get started →</div>
          </button>

          {/* Nearby Card */}
          <button
            onClick={() => onTabChange('nearby')}
            className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-green-300 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-green-100 group-hover:bg-green-200 transition-colors">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-2xl">🗺️</span>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Nearby</h3>
            <p className="text-sm text-slate-600 mb-4">Find nearby businesses, shops, and services</p>
            <div className="text-sm font-medium text-green-600 group-hover:text-green-700">Explore →</div>
          </button>

          {/* Messages Card */}
          <button
            onClick={() => onTabChange('inbox')}
            className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-purple-300 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-purple-100 group-hover:bg-purple-200 transition-colors">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-2xl">💬</span>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Messages</h3>
            <p className="text-sm text-slate-600 mb-4">Check your messages and stay connected</p>
            <div className="text-sm font-medium text-purple-600 group-hover:text-purple-700">Open inbox →</div>
          </button>

          {/* P2P Loan Marketplace Card */}
          <button
            onClick={() => onTabChange('p2p-loans')}
            className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-purple-300 transition-all group col-span-2"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-purple-100 group-hover:bg-purple-200 transition-colors">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-2xl">💳</span>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Peer To Peer Loan Marketplace</h3>
            <p className="text-sm text-slate-600 mb-4">Browse loans • Submit offers • Manage your lending portfolio</p>
            <div className="text-sm font-medium text-purple-600 group-hover:text-purple-700">Explore marketplace →</div>
          </button>

          {/* Poker Card */}
          <button
            onClick={() => onTabChange('poker')}
            className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-rose-300 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-rose-100 group-hover:bg-rose-200 transition-colors">
                <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M7.172 7.172C5.26 9.083 5 11.622 5 15c0 4.418 2.612 8 5 8s5-3.582 5-8c0-3.378-.26-5.917-2.172-7.828m5.656 5.656a4 4 0 010 5.656M9.172 9.172L12 6m0 0l2.828 2.828M12 6v6m0 0l-2.828-2.828M12 12l2.828 2.828" />
                </svg>
              </div>
              <span className="text-2xl">🃏</span>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Poker</h3>
            <p className="text-sm text-slate-600 mb-4">Play poker games and win rewards</p>
            <div className="text-sm font-medium text-rose-600 group-hover:text-rose-700">Play now →</div>
          </button>

          {/* Network Balances Card */}
          <button
            onClick={() => onTabChange('network-balances')}
            className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-teal-300 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-teal-100 group-hover:bg-teal-200 transition-colors">
                <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-2xl">🌐</span>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Network Balances</h3>
            <p className="text-sm text-slate-600 mb-4">View balances across the network</p>
            <div className="text-sm font-medium text-teal-600 group-hover:text-teal-700">View details →</div>
          </button>
        </div>

        {/* Exchange Rates Preview */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Exchange Rates</h3>
            <button
              onClick={() => onTabChange('rates')}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              View all →
            </button>
          </div>
          <p className="text-slate-600 text-sm">Current exchange rates and currency conversion tools available on the Rates page</p>
        </div>
      </div>
    </div>
  )
}
