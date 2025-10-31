import { useState, useEffect } from 'react'
import { wisegcashAPI } from '../lib/wisegcashAPI'

export default function Wallet({ userId }) {
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddFunds, setShowAddFunds] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState(null)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const currencies = ['PHP', 'USD', 'EUR', 'GBP']

  useEffect(() => {
    loadWallets()
  }, [userId])

  const loadWallets = async () => {
    try {
      // Skip for guest-local or invalid user IDs
      if (!userId || userId.includes('guest-local') || userId === 'null' || userId === 'undefined') {
        setWallets([
          { user_id: userId, currency_code: 'PHP', balance: 0 },
          { user_id: userId, currency_code: 'USD', balance: 0 }
        ])
        setLoading(false)
        return
      }
      const data = await wisegcashAPI.getWallets(userId)
      setWallets(data || [])
      setError('')
    } catch (err) {
      // Fallback: initialize default wallets
      setWallets([
        { user_id: userId, currency_code: 'PHP', balance: 0 },
        { user_id: userId, currency_code: 'USD', balance: 0 }
      ])
      setError('')
    } finally {
      setLoading(false)
    }
  }

  const handleAddFunds = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!selectedWallet || !amount || parseFloat(amount) <= 0) {
      setError('Please select a wallet and enter a valid amount')
      return
    }

    try {
      await wisegcashAPI.addFunds(userId, selectedWallet.currency_code, parseFloat(amount))
      setSuccess(`Successfully added ${amount} ${selectedWallet.currency_code}`)
      setAmount('')
      setShowAddFunds(false)
      loadWallets()
    } catch (err) {
      setError(err.message || 'Failed to add funds')
    }
  }

  const handleCreateWallet = async (currency) => {
    try {
      await wisegcashAPI.createWallet(userId, currency)
      loadWallets()
      setSuccess(`${currency} wallet created`)
    } catch (err) {
      setError(`Failed to create ${currency} wallet`)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center text-slate-500">Loading wallets...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <h2 className="text-3xl font-light text-slate-900 mb-6 tracking-tight">My Wallets</h2>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">{success}</div>}

      {/* Existing Wallets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {wallets.map(wallet => (
          <div key={wallet.id} className="bg-white border border-slate-200 rounded-xl p-8 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-slate-600 font-medium uppercase tracking-wider">{wallet.currency_code}</p>
              <span className="text-3xl font-light text-slate-900">
                {wallet.currency_code === 'PHP' ? '₱' : wallet.currency_code === 'EUR' ? '€' : wallet.currency_code === 'GBP' ? '£' : '$'}
              </span>
            </div>

            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Balance</p>
            <p className="text-4xl font-light text-slate-900 mb-8">{wallet.balance.toFixed(2)}</p>

            <button
              onClick={() => {
                setSelectedWallet(wallet)
                setShowAddFunds(true)
              }}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
            >
              Add Funds
            </button>
          </div>
        ))}
      </div>

      {/* Create New Wallet */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="text-lg font-light text-slate-900 mb-4 tracking-wide">Create New Wallet</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {currencies.map(currency => {
            const exists = wallets.some(w => w.currency_code === currency)
            return (
              <button
                key={currency}
                onClick={() => handleCreateWallet(currency)}
                disabled={exists}
                className={`p-4 rounded-lg border-2 transition-colors text-center ${
                  exists
                    ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                    : 'border-slate-200 hover:border-blue-600 hover:bg-blue-50 text-slate-900'
                }`}
              >
                <p className="font-medium text-sm">{currency}</p>
                <p className="text-xs mt-2 text-slate-500">{exists ? 'Created' : 'Create'}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Add Funds Modal */}
      {showAddFunds && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-light text-slate-900 mb-6">Add Funds</h3>

            <form onSubmit={handleAddFunds} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Amount ({selectedWallet?.currency_code})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-lg"
                />
              </div>

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setShowAddFunds(false)}
                  className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Add Funds
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
