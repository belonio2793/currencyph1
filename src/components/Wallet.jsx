import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatNumber } from '../lib/currency'
import WalletDisplayCustomizer from './WalletDisplayCustomizer'
import { getWalletDisplayPreferences } from '../lib/walletPreferences'
import TransactionsList from './Wallets/TransactionsList'
import { currencyAPI } from '../lib/payments'
import FiatCryptoToggle from './FiatCryptoToggle'
import { walletService } from '../lib/walletService'

export default function Wallet({ userId, globalCurrency = 'PHP' }) {
  const [wallets, setWallets] = useState([])
  const [selectedCurrencies, setSelectedCurrencies] = useState(['PHP'])
  const [loading, setLoading] = useState(true)
  const [showCustomizer, setShowCustomizer] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(null)
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  const [activeType, setActiveType] = useState('fiat') // 'fiat' or 'crypto'
  const [authStatus, setAuthStatus] = useState(null)
  const [showDiagnostics, setShowDiagnostics] = useState(false)

  useEffect(() => {
    loadData()
  }, [userId])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      if (!userId || userId === 'null' || userId === 'undefined' || userId.includes('guest-local')) {
        console.debug('Wallet: Invalid or guest userId:', userId)
        setWallets([])
        setSelectedCurrencies(['PHP'])
        setLoading(false)
        return
      }

      // Check if user is properly authenticated with Supabase
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        console.error('Auth session error:', sessionError)
        setError('Authentication error - please log in again')
        setWallets([])
        setLoading(false)
        return
      }

      if (!session) {
        console.warn('No active auth session - user may not be authenticated with Supabase')
        setAuthStatus({
          authenticated: false,
          userId: userId,
          reason: 'No active session'
        })
        setError('Not authenticated - please log in to see your wallets')
        setWallets([])
        setLoading(false)
        return
      }

      setAuthStatus({
        authenticated: true,
        userId: session.user.id,
        email: session.user.email
      })

      console.debug('Wallet: Auth session found for user:', session.user.id)

      // Auto-generate account numbers for any wallets that don't have them
      try {
        await currencyAPI.ensureWalletsHaveAccountNumbers(userId)
      } catch (err) {
        console.warn('Warning: Could not ensure account numbers for wallets:', err)
      }

      // Load user's saved currency preferences
      const preferences = await getWalletDisplayPreferences(userId)
      setSelectedCurrencies(preferences || ['PHP'])

      // Fetch wallets with full details (including currency info)
      const allWallets = await walletService.getUserWalletsWithDetails(userId)

      if (!allWallets) {
        setError('Failed to load wallets')
        return
      }

      // Filter to only selected currencies
      const filteredWallets = allWallets.filter(w =>
        preferences?.includes(w.currency_code)
      )

      // Ensure PHP wallet exists and is in the list
      const hasPHP = filteredWallets.some(w => w.currency_code === 'PHP')
      if (!hasPHP) {
        const phpWallet = allWallets.find(w => w.currency_code === 'PHP')
        if (phpWallet && !filteredWallets.some(fw => fw.id === phpWallet.id)) {
          filteredWallets.unshift(phpWallet)
        }
      }

      setWallets(filteredWallets.length > 0 ? filteredWallets : allWallets)
    } catch (err) {
      console.error('Error loading wallets:', err)
      setError('Failed to load wallets')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  // Separate wallets into fiat and crypto based on currency code
  const fiats = ['PHP', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AUD', 'CAD', 'SGD', 'HKD', 'INR', 'MYR', 'THB', 'VND', 'IDR', 'KRW']
  const fiatWallets = wallets.filter(w => fiats.includes(w.currency_code?.toUpperCase()))
  const cryptoWallets = wallets.filter(w => !fiats.includes(w.currency_code?.toUpperCase()))

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center text-slate-500">Loading wallet...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="w-full px-4 sm:px-6 py-6 flex-1">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-light text-slate-900 tracking-tight mb-2">
            My Wallets
          </h1>
          <p className="text-slate-600">
            Manage your currency wallets and customize your dashboard.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Wallets Content */}
        {!showCustomizer && (
          <div className="mb-12">
            {/* Action Bar */}
            <div className="mb-6 flex gap-3 justify-between items-center flex-wrap">
              <div className="flex gap-3 items-center">
                <button
                  onClick={() => setShowCustomizer(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <span className="text-xl font-bold leading-none">+</span>
                  Add More Currencies
                </button>
              </div>

              {/* Fiat/Crypto Toggle */}
              {wallets.length > 0 && (
                <FiatCryptoToggle active={activeType} onChange={setActiveType} />
              )}

              {/* View Mode Toggle */}
              {wallets.length > 0 && (
                <div className="flex gap-2 bg-white border border-slate-200 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Grid
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      viewMode === 'list'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    List
                  </button>
                </div>
              )}
            </div>

            {wallets.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
                <p className="text-slate-500 mb-4">No wallets available yet</p>
                <button
                  onClick={() => setShowCustomizer(true)}
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Add a Currency
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              // Grid View
              <div className="space-y-12">
                {/* Fiat Currencies Section */}
                {activeType === 'fiat' && fiatWallets.length > 0 && (
                  <div>
                    <div className="mb-6 flex items-center gap-3">
                      <h2 className="text-2xl font-semibold text-slate-900">Fiat Currencies</h2>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        {fiatWallets.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {fiatWallets.map(wallet => (
                        <div key={wallet.id} className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-lg transition-all">
                          {/* Header */}
                          <div className="mb-4 flex items-start justify-between">
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                {wallet.currency_code}
                              </p>
                              <p className="text-2xl font-light text-slate-900">
                                {wallet.symbol || (wallet.currency_code === 'PHP' ? '₱' : wallet.currency_code === 'USD' ? '$' : wallet.currency_code === 'EUR' ? '€' : wallet.currency_code === 'GBP' ? '£' : wallet.currency_code)}
                              </p>
                            </div>
                            {wallet.is_active && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                Active
                              </span>
                            )}
                          </div>

                          {/* Balance */}
                          <div className="bg-slate-50 rounded-lg p-4 mb-4">
                            <p className="text-xs text-slate-600 mb-1">Current Balance</p>
                            <p className="text-2xl font-light text-slate-900 font-mono">
                              {formatNumber(wallet.balance || 0)}
                            </p>
                            <p className="text-xs text-slate-500 mt-2">
                              Deposited: {formatNumber(wallet.total_deposited || 0)}
                            </p>
                          </div>

                          {/* Wallet ID */}
                          <div className="bg-blue-50 rounded-lg p-3 mb-4 border border-blue-200">
                            <p className="text-xs text-blue-700 font-medium mb-2">Wallet ID</p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-mono text-slate-900 break-all flex-1">
                                {wallet.id}
                              </p>
                              <button
                                onClick={() => copyToClipboard(wallet.id, wallet.id)}
                                className="flex-shrink-0 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-medium"
                              >
                                {copied === wallet.id ? '✓' : 'Copy'}
                              </button>
                            </div>
                          </div>

                          {/* Meta Info */}
                          <div className="text-xs text-slate-500 space-y-1 pt-3 border-t border-slate-200">
                            <div>Created: {new Date(wallet.created_at).toLocaleDateString()}</div>
                            <div>Account: {wallet.account_number || 'N/A'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Crypto Currencies Section */}
                {activeType === 'crypto' && cryptoWallets.length > 0 && (
                  <div>
                    <div className="mb-6 flex items-center gap-3">
                      <h2 className="text-2xl font-semibold text-slate-900">Cryptocurrencies</h2>
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                        {cryptoWallets.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {cryptoWallets.map(wallet => (
                        <div key={wallet.id} className="bg-gradient-to-br from-orange-50 to-yellow-50 border border-orange-200 rounded-lg p-6 hover:shadow-lg transition-all">
                          {/* Header */}
                          <div className="mb-4 flex items-start justify-between">
                            <div>
                              <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-2">
                                {wallet.currency_code}
                              </p>
                              <p className="text-2xl font-light text-slate-900">
                                🪙
                              </p>
                            </div>
                            {wallet.is_active && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                Active
                              </span>
                            )}
                          </div>

                          {/* Balance */}
                          <div className="bg-white/60 rounded-lg p-4 mb-4">
                            <p className="text-xs text-slate-600 mb-1">Current Balance</p>
                            <p className="text-2xl font-light text-slate-900 font-mono">
                              {formatNumber(wallet.balance || 0)}
                            </p>
                            <p className="text-xs text-slate-500 mt-2">
                              Received: {formatNumber(wallet.total_deposited || 0)}
                            </p>
                          </div>

                          {/* Wallet Address */}
                          <div className="bg-orange-100/40 rounded-lg p-3 mb-4 border border-orange-200">
                            <p className="text-xs text-orange-700 font-medium mb-2">Wallet Address</p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-mono text-slate-900 break-all flex-1">
                                {wallet.id}
                              </p>
                              <button
                                onClick={() => copyToClipboard(wallet.id, wallet.id)}
                                className="flex-shrink-0 px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors text-xs font-medium"
                              >
                                {copied === wallet.id ? '✓' : 'Copy'}
                              </button>
                            </div>
                          </div>

                          {/* Meta Info */}
                          <div className="text-xs text-slate-500 space-y-1 pt-3 border-t border-orange-200">
                            <div>Created: {new Date(wallet.created_at).toLocaleDateString()}</div>
                            <div>Network: {wallet.account_number || 'Blockchain'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // List View
              <div className="space-y-8">
                {/* Fiat Currencies Section */}
                {activeType === 'fiat' && fiatWallets.length > 0 && (
                  <div>
                    <div className="mb-4 flex items-center gap-3">
                      <h2 className="text-xl font-semibold text-slate-900">Fiat Currencies</h2>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {fiatWallets.length}
                      </span>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Currency</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Symbol</th>
                              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Balance</th>
                              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Deposited</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Wallet ID</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Account</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fiatWallets.map((wallet, idx) => (
                              <tr key={wallet.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                <td className="px-6 py-4 text-sm font-medium text-slate-900">{wallet.currency_code}</td>
                                <td className="px-6 py-4 text-sm text-slate-600">
                                  {wallet.symbol || (wallet.currency_code === 'PHP' ? '₱' : wallet.currency_code === 'USD' ? '$' : wallet.currency_code === 'EUR' ? '€' : wallet.currency_code === 'GBP' ? '£' : wallet.currency_code)}
                                </td>
                                <td className="px-6 py-4 text-sm font-mono text-slate-900 text-right">{formatNumber(wallet.balance || 0)}</td>
                                <td className="px-6 py-4 text-sm font-mono text-slate-600 text-right">{formatNumber(wallet.total_deposited || 0)}</td>
                                <td className="px-6 py-4 text-sm font-mono text-slate-600 truncate max-w-xs">{wallet.id}</td>
                                <td className="px-6 py-4 text-sm text-slate-600">{wallet.account_number || 'N/A'}</td>
                                <td className="px-6 py-4 text-sm">
                                  {wallet.is_active && (
                                    <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                      Active
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Crypto Currencies Section */}
                {activeType === 'crypto' && cryptoWallets.length > 0 && (
                  <div>
                    <div className="mb-4 flex items-center gap-3">
                      <h2 className="text-xl font-semibold text-slate-900">Cryptocurrencies</h2>
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                        {cryptoWallets.length}
                      </span>
                    </div>
                    <div className="bg-white border border-orange-200 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-orange-50 border-b border-orange-200">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-orange-700 uppercase tracking-wider">Cryptocurrency</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-orange-700 uppercase tracking-wider">Type</th>
                              <th className="px-6 py-3 text-right text-xs font-semibold text-orange-700 uppercase tracking-wider">Balance</th>
                              <th className="px-6 py-3 text-right text-xs font-semibold text-orange-700 uppercase tracking-wider">Received</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-orange-700 uppercase tracking-wider">Address</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-orange-700 uppercase tracking-wider">Network</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-orange-700 uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cryptoWallets.map((wallet, idx) => (
                              <tr key={wallet.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-orange-50/40'}>
                                <td className="px-6 py-4 text-sm font-medium text-slate-900">{wallet.currency_code}</td>
                                <td className="px-6 py-4 text-sm text-orange-600 font-medium">Crypto</td>
                                <td className="px-6 py-4 text-sm font-mono text-slate-900 text-right">{formatNumber(wallet.balance || 0)}</td>
                                <td className="px-6 py-4 text-sm font-mono text-slate-600 text-right">{formatNumber(wallet.total_deposited || 0)}</td>
                                <td className="px-6 py-4 text-sm font-mono text-slate-600 truncate max-w-xs">{wallet.id}</td>
                                <td className="px-6 py-4 text-sm text-slate-600">{wallet.account_number || 'Blockchain'}</td>
                                <td className="px-6 py-4 text-sm">
                                  {wallet.is_active && (
                                    <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                      Active
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Transactions List - Always shows all transactions across all wallets */}
        <div className="mt-12">
          <TransactionsList userId={userId} />
        </div>

        {/* Customizer Modal */}
        {showCustomizer && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-light text-slate-900">Customize Dashboard</h2>
                <button
                  onClick={() => setShowCustomizer(false)}
                  className="text-slate-500 hover:text-slate-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="p-6">
                <WalletDisplayCustomizer
                  userId={userId}
                  onClose={() => {
                    setShowCustomizer(false)
                    loadData()
                  }}
                  onUpdate={() => {
                    loadData()
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
