import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatNumber } from '../lib/currency'
import WalletDisplayCustomizer from './WalletDisplayCustomizer'
import { getWalletDisplayPreferences } from '../lib/walletPreferences'

export default function Wallet({ userId, globalCurrency = 'PHP' }) {
  const [wallets, setWallets] = useState([])
  const [selectedCurrencies, setSelectedCurrencies] = useState(['PHP'])
  const [loading, setLoading] = useState(true)
  const [showCustomizer, setShowCustomizer] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    loadData()
  }, [userId])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      if (!userId || userId === 'null' || userId === 'undefined' || userId.includes('guest-local')) {
        setWallets([])
        setSelectedCurrencies(['PHP'])
        setLoading(false)
        return
      }

      // Load user's saved currency preferences
      const preferences = await getWalletDisplayPreferences(userId)
      setSelectedCurrencies(preferences || ['PHP'])

      // Fetch wallets for all selected currencies
      const { data: userWallets, error: fetchError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching wallets:', fetchError)
        setError('Failed to load wallets')
        return
      }

      const allWallets = userWallets || []

      // Filter to only selected currencies
      const filteredWallets = allWallets.filter(w =>
        preferences?.includes(w.currency_code)
      )

      // Ensure PHP wallet exists and is in the list
      const hasPHP = filteredWallets.some(w => w.currency_code === 'PHP')
      if (!hasPHP) {
        const phpWallet = allWallets.find(w => w.currency_code === 'PHP')
        if (phpWallet) {
          filteredWallets.unshift(phpWallet)
        }
      }

      setWallets(filteredWallets)
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

        {/* Wallets Grid */}
        {!showCustomizer && (
          <div className="mb-12">
            {/* Action Button */}
            <div className="mb-6 flex gap-3">
              <button
                onClick={() => setShowCustomizer(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                ➕ Add More Currencies
              </button>
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
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {wallets.map(wallet => (
                  <div key={wallet.id} className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-lg transition-all">
                    {/* Header */}
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          {wallet.currency_code}
                        </p>
                        <p className="text-2xl font-light text-slate-900">
                          {wallet.currency_code === 'PHP' ? '₱' : wallet.currency_code === 'USD' ? '$' : wallet.currency_code === 'EUR' ? '€' : wallet.currency_code === 'GBP' ? '£' : wallet.currency_code}
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
            )}
          </div>
        )}

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
                  onClose={() => setShowCustomizer(false)}
                  onUpdate={() => {
                    // Optionally refresh wallet data after update
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
