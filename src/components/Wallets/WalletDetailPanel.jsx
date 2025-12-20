import { useState, useEffect } from 'react'
import { formatNumber } from '../../lib/currency'
import { walletTransactionService } from '../../lib/walletTransactionService'
import { walletExport } from '../../lib/walletExport'
import TransactionHistory from './TransactionHistory'
import WalletStatistics from './WalletStatistics'
import BalanceTrendChart from './BalanceTrendChart'
import ActivityTimeline from './ActivityTimeline'

export default function WalletDetailPanel({ wallet, userId, globalCurrency, onClose, ratesMap, convertAmount }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [balanceHistory, setBalanceHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadWalletDetails = async () => {
      try {
        setLoading(true)

        // Load stats and transactions in parallel
        const [walletStats, txs, history] = await Promise.all([
          wallet.wallet_id ? walletTransactionService.getWalletStats(wallet.wallet_id, userId) : Promise.resolve(null),
          wallet.wallet_id ? walletTransactionService.getWalletTransactions(wallet.wallet_id, 50) : Promise.resolve([]),
          wallet.wallet_id ? walletTransactionService.getBalanceHistory(wallet.wallet_id, 30) : Promise.resolve([])
        ])

        setStats(walletStats)
        setTransactions(txs)
        setBalanceHistory(history)
      } catch (err) {
        console.warn('Failed to load wallet details:', err)
      } finally {
        setLoading(false)
      }
    }

    loadWalletDetails()
  }, [wallet, userId])

  // Calculate converted balance
  const isSameCurrency = wallet.currency_code === globalCurrency
  let convertedBalance = Number(wallet.balance || 0)
  if (!isSameCurrency && ratesMap) {
    const converted = convertAmount(Number(wallet.balance || 0), wallet.currency_code, globalCurrency, ratesMap)
    convertedBalance = converted !== null ? converted : Number(wallet.balance || 0)
  }

  const symbol = wallet.symbol || wallet.currency_code
  const isCrypto = wallet.currency_type === 'cryptocurrency'

  // Format account number to display first and last parts
  const formatAccountNumber = (num) => {
    if (!num) return 'N/A'
    const str = num.toString()
    if (str.length <= 8) return str
    return `${str.substring(0, 4)}...${str.substring(str.length - 4)}`
  }

  const fullAccountNumber = wallet.account_number || 'Not assigned'

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-6 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-lg ${isCrypto ? 'bg-orange-100' : 'bg-blue-100'}`}>
              <span className={`text-3xl ${isCrypto ? 'text-orange-600' : 'text-blue-600'}`}>
                {isCrypto ? '₿' : '💵'}
              </span>
            </div>
            <div>
              <h2 className="text-3xl font-light text-white mb-1">
                {wallet.currency_code}
              </h2>
              <p className="text-slate-300 text-sm">{wallet.currency_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-300 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Main Content */}
        <div className="p-8">
          {/* Balance Display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-lg border border-slate-200">
              <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Current Balance</p>
              <p className="text-3xl font-light text-slate-900 mb-1">
                {formatNumber(convertedBalance)}
              </p>
              <p className="text-xs text-slate-500">{globalCurrency}</p>
              {!isSameCurrency && (
                <p className="text-xs text-slate-400 mt-2">
                  {formatNumber(Number(wallet.balance || 0))} {wallet.currency_code}
                </p>
              )}
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-lg border border-emerald-200">
              <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wide mb-2">Total Deposited</p>
              <p className="text-3xl font-light text-emerald-900">
                {formatNumber(Number(wallet.total_deposited || 0))}
              </p>
              <p className="text-xs text-emerald-600 mt-2">{wallet.currency_code}</p>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-lg border border-red-200">
              <p className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-2">Total Withdrawn</p>
              <p className="text-3xl font-light text-red-900">
                {formatNumber(Number(wallet.total_withdrawn || 0))}
              </p>
              <p className="text-xs text-red-600 mt-2">{wallet.currency_code}</p>
            </div>
          </div>

          {/* Wallet Information */}
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-6 mb-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Wallet Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Account Number</p>
                <p className="font-mono text-sm text-slate-900 break-all">{formatAccountNumber(fullAccountNumber)}</p>
                <p className="text-xs text-slate-400 mt-1">Unique identifier</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Created</p>
                <p className="text-sm text-slate-900">
                  {wallet.created_at ? new Date(wallet.created_at).toLocaleDateString() : 'N/A'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {wallet.created_at ? new Date(wallet.created_at).toLocaleTimeString() : ''}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Last Updated</p>
                <p className="text-sm text-slate-900">
                  {wallet.updated_at ? new Date(wallet.updated_at).toLocaleDateString() : 'N/A'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {wallet.updated_at ? new Date(wallet.updated_at).toLocaleTimeString() : ''}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</p>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                  wallet.is_active
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {wallet.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-slate-200">
            {['overview', 'transactions', 'history', 'timeline'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-500">Loading wallet details...</div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <WalletStatistics stats={stats} wallet={wallet} formatNumber={formatNumber} />
              )}

              {activeTab === 'transactions' && (
                <TransactionHistory transactions={transactions} wallet={wallet} formatNumber={formatNumber} />
              )}

              {activeTab === 'history' && (
                <BalanceTrendChart data={balanceHistory} wallet={wallet} formatNumber={formatNumber} />
              )}

              {activeTab === 'timeline' && (
                <ActivityTimeline transactions={transactions} wallet={wallet} formatNumber={formatNumber} />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-8 py-4 rounded-b-2xl border-t border-slate-200 flex justify-between gap-3 flex-wrap">
          <div className="flex gap-2">
            <button
              onClick={() => walletExport.exportToPDF(wallet, transactions, stats)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              PDF
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors font-medium text-sm"
            >
              Close
            </button>
            <button
              className={`px-6 py-2 text-white rounded-lg hover:opacity-90 transition-opacity font-medium text-sm ${
                isCrypto ? 'bg-orange-600' : 'bg-blue-600'
              }`}
            >
              Add Funds
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
