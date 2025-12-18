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

        {/* PHP Wallet Card */}
        {!showCustomizer && (
          <div className="mb-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PHP Wallet */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-lg transition-all">
                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Primary Currency
                  </p>
                  <div className="flex items-baseline gap-2 mb-2">
                    <p className="text-3xl font-light text-slate-900">PHP</p>
                    <p className="text-sm text-slate-500">Philippine Peso</p>
                  </div>
                </div>

                {phpWallet ? (
                  <>
                    <div className="bg-slate-50 rounded-lg p-4 mb-6">
                      <p className="text-xs text-slate-600 mb-1">Current Balance</p>
                      <p className="text-2xl font-light text-slate-900 font-mono">
                        {formatNumber(phpWallet.balance || 0)}
                      </p>
                      <p className="text-xs text-slate-500 mt-2">
                        Deposited: {formatNumber(phpWallet.total_deposited || 0)}
                      </p>
                    </div>

                    <div className="text-xs text-slate-500">
                      Created {new Date(phpWallet.created_at).toLocaleDateString()}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-slate-600">
                    Wallet not available
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-light text-slate-900 mb-4">Actions</h3>

                <div className="space-y-3">
                  <button
                    onClick={() => setShowCustomizer(true)}
                    className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Customize Dashboard Currencies
                  </button>

                  <p className="text-xs text-slate-600 p-3 bg-slate-50 rounded-lg">
                    💡 Click above to select which currencies appear on your main dashboard. You can add USD, EUR, GBP, and more!
                  </p>
                </div>
              </div>
            </div>
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
