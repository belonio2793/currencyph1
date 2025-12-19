import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { currencyAPI } from '../lib/payments'
import { currencySymbols, formatCurrency, getCurrencySymbol } from '../lib/currency'

export default function ReceiveMoney({ userId }) {
  const [wallets, setWallets] = useState([])
  const [recentTransfers, setRecentTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedWallet, setSelectedWallet] = useState(null)
  const [userEmail, setUserEmail] = useState('')
  const [copyFeedback, setCopyFeedback] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [userId])

  const loadData = async () => {
    try {
      // Skip for guest-local or invalid user IDs
      if (!userId || userId.includes('guest-local') || userId === 'null' || userId === 'undefined') {
        setWallets([])
        setRecentTransfers([])
        setLoading(false)
        return
      }

      const [walletsData, transfersData, userData] = await Promise.all([
        currencyAPI.getWallets(userId),
        currencyAPI.getTransfers(userId),
        currencyAPI.getUserById(userId)
      ])

      setWallets(walletsData)
      setUserEmail(userData?.email || '')

      // Filter transfers where user is recipient
      const incomingTransfers = transfersData.filter(t => t.recipient_id === userId)
      setRecentTransfers(incomingTransfers)

      // Prioritize PHP wallet as default
      if (walletsData.length > 0) {
        const phpWallet = walletsData.find(w => w.currency_code === 'PHP')
        const defaultWallet = phpWallet || walletsData[0]
        setSelectedWallet(defaultWallet)
      }
    } catch (err) {
      setError('Failed to load data')
      setWallets([])
      setRecentTransfers([])
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text)
    setCopyFeedback(label)
    setTimeout(() => setCopyFeedback(''), 2000)
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="text-center text-slate-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <h2 className="text-3xl font-light text-slate-900 mb-6 tracking-tight">Receive Money</h2>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Receive Info */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div>
              <h3 className="text-lg font-medium text-slate-900 mb-4">Your Receiving Wallets</h3>

              {wallets.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    You don't have any wallets yet. <a href="#" onClick={e => { e.preventDefault(); window.location.href = '/deposit' }} className="font-medium underline">Create a wallet</a> to receive money.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Select a Wallet to Receive Funds</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {wallets.map(wallet => (
                      <button
                        key={wallet.id}
                        onClick={() => setSelectedWallet(wallet)}
                        className={`p-4 border-2 rounded-lg transition-all text-left ${
                          selectedWallet?.id === wallet.id
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-slate-200 bg-white hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-slate-900">{getCurrencySymbol(wallet.currency_code)} {wallet.currency_code}</p>
                            <p className="text-xs text-slate-500 mt-1">Balance: {getCurrencySymbol(wallet.currency_code)}{wallet.balance.toFixed(2)}</p>
                          </div>
                          <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{
                            borderColor: selectedWallet?.id === wallet.id ? '#2563eb' : '#cbd5e1'
                          }}>
                            {selectedWallet?.id === wallet.id && (
                              <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {selectedWallet && (
              <div className="space-y-4 border-t border-slate-200 pt-6">
                <h3 className="text-lg font-medium text-slate-900">Share Your Details</h3>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
                  {/* Email */}
                  <div>
                    <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-2">Your Email (For Direct Transfers)</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm font-mono text-slate-900 break-all">
                        {userEmail}
                      </div>
                      <button
                        onClick={() => copyToClipboard(userEmail, 'Email copied!')}
                        className="px-4 py-3 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
                      >
                        {copyFeedback === 'Email copied!' ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {/* Wallet ID */}
                  <div>
                    <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-2">Wallet ID</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm font-mono text-slate-900 break-all">
                        {selectedWallet.id}
                      </div>
                      <button
                        onClick={() => copyToClipboard(selectedWallet.id, 'Wallet ID copied!')}
                        className="px-4 py-3 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
                      >
                        {copyFeedback === 'Wallet ID copied!' ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {/* Account Number */}
                  <div>
                    <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-2">Account Number</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm font-mono text-slate-900 text-center tracking-wider">
                        {selectedWallet.account_number}
                      </div>
                      <button
                        onClick={() => copyToClipboard(selectedWallet.account_number, 'Account number copied!')}
                        className="px-4 py-3 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
                      >
                        {copyFeedback === 'Account number copied!' ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {/* Quick Share Text */}
                  <div>
                    <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-2">Share Message</p>
                    <button
                      onClick={() => {
                        const text = `You can send me money using currency.ph:\n\nEmail: ${userEmail}\nWallet ID: ${selectedWallet.id}\nAccount #: ${selectedWallet.account_number}`
                        copyToClipboard(text, 'Share message copied!')
                      }}
                      className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                    >
                      {copyFeedback === 'Share message copied!' ? '✓ Copied' : 'Copy Share Message'}
                    </button>
                  </div>
                </div>

                {/* Wallet Details Summary */}
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-slate-700">Wallet Summary</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Currency</p>
                      <p className="font-medium text-slate-900">{selectedWallet.currency_code}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Current Balance</p>
                      <p className="font-medium text-slate-900">{getCurrencySymbol(selectedWallet.currency_code)}{selectedWallet.balance.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Total Received</p>
                      <p className="font-medium text-slate-900">{getCurrencySymbol(selectedWallet.currency_code)}{selectedWallet.total_deposited.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Created</p>
                      <p className="font-medium text-slate-900">{new Date(selectedWallet.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Recent Transfers */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Recent Incoming Transfers</h3>
            <div className="space-y-3">
              {recentTransfers.length === 0 ? (
                <p className="text-slate-500 text-sm">No incoming transfers yet</p>
              ) : (
                recentTransfers.slice(0, 5).map(transfer => (
                  <div
                    key={transfer.id}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-200 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium text-emerald-600">{getCurrencySymbol(transfer.recipient_currency)}{transfer.recipient_amount.toFixed(2)}</p>
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">Received</span>
                    </div>
                    <p className="text-xs text-slate-600 mb-1">From: {transfer.sender_id}</p>
                    <p className="text-xs text-slate-500">{new Date(transfer.created_at).toLocaleDateString()}</p>
                    {transfer.reference_number && (
                      <p className="text-xs text-slate-400 mt-1">Ref: {transfer.reference_number}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4">How to Receive</h3>
            <ol className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-medium">1</span>
                <span>Share your email or wallet ID with sender</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-medium">2</span>
                <span>They use "Send Money" to transfer funds</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-medium">3</span>
                <span>Funds arrive instantly in your wallet</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-medium">4</span>
                <span>Check your transaction history</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
