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
      const data = await wisegcashAPI.getWallets(userId)
      setWallets(data)
    } catch (err) {
      console.error('Error loading wallets:', err)
      setError('Failed to load wallets')
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
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center text-gray-500">Loading wallets...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">💳 My Wallets</h2>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>}
      {success && <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">{success}</div>}

      {/* Existing Wallets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {wallets.map(wallet => (
          <div key={wallet.id} className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">{wallet.currency_code}</h3>
              <span className="text-3xl">
                {wallet.currency_code === 'PHP' ? '₱' : wallet.currency_code === 'EUR' ? '€' : wallet.currency_code === 'GBP' ? '£' : '$'}
              </span>
            </div>

            <p className="text-gray-500 text-sm mb-4">Available Balance</p>
            <p className="text-3xl font-bold text-gray-900 mb-6">{wallet.balance.toFixed(2)}</p>

            <button
              onClick={() => {
                setSelectedWallet(wallet)
                setShowAddFunds(true)
              }}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Add Funds
            </button>
          </div>
        ))}
      </div>

      {/* Create New Wallet */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Create New Wallet</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {currencies.map(currency => {
            const exists = wallets.some(w => w.currency_code === currency)
            return (
              <button
                key={currency}
                onClick={() => handleCreateWallet(currency)}
                disabled={exists}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  exists
                    ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'
                    : 'border-blue-300 hover:border-blue-600 hover:bg-blue-50 text-gray-900'
                }`}
              >
                <p className="font-semibold">{currency}</p>
                <p className="text-xs mt-1">{exists ? 'Created' : 'Create'}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Add Funds Modal */}
      {showAddFunds && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Add Funds</h3>

            <form onSubmit={handleAddFunds} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Amount ({selectedWallet?.currency_code})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setShowAddFunds(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
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
