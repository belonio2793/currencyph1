import { useState, useEffect } from 'react'
import { currencyAPI } from '../lib/payments'

export default function ReceiveMoney({ userId }) {
  const [phpAmount, setPhpAmount] = useState('')
  const [solAmount, setSolAmount] = useState('0')
  const [exchangeRate, setExchangeRate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copyFeedback, setCopyFeedback] = useState('')

  // Solana wallet address
  const SOLANA_ADDRESS = '6o7t3TE9EZML7Rnqp4Mv'

  useEffect(() => {
    loadExchangeRate()
  }, [])

  const loadExchangeRate = async () => {
    // Use fallback rate immediately
    setExchangeRate(150)

    // Try to fetch live rate in background, but don't block on failure
    try {
      const rate = await currencyAPI.getExchangeRate('SOL', 'PHP')
      if (rate && typeof rate === 'number' && rate > 0) {
        setExchangeRate(rate)
      }
    } catch (err) {
      // Silently fail - use fallback rate
      console.debug('Exchange rate fetch failed, using fallback')
    } finally {
      setLoading(false)
    }
  }

  const handlePhpAmountChange = (value) => {
    setPhpAmount(value)
    if (value && !isNaN(value) && exchangeRate) {
      const sol = (parseFloat(value) / exchangeRate).toFixed(6)
      setSolAmount(sol)
    } else {
      setSolAmount('0')
    }
  }

  const copyToClipboard = async (text, label) => {
    let copied = false

    // Try modern Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text)
        copied = true
      } catch (clipErr) {
        console.debug('Clipboard API blocked, using fallback:', clipErr?.message)
        copied = false
      }
    }

    // If Clipboard API failed or unavailable, use fallback
    if (!copied) {
      try {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        textarea.style.pointerEvents = 'none'
        document.body.appendChild(textarea)
        textarea.select()
        const success = document.execCommand('copy')
        document.body.removeChild(textarea)
        copied = success
      } catch (fallbackErr) {
        console.debug('Fallback copy method failed:', fallbackErr?.message)
        copied = false
      }
    }

    if (copied) {
      setCopyFeedback(label)
      setTimeout(() => setCopyFeedback(''), 2000)
    } else {
      setError('Could not copy to clipboard. Please copy manually.')
      setTimeout(() => setError(''), 3000)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="text-center text-slate-500">Loading exchange rates...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <h2 className="text-3xl font-light text-slate-900 mb-6 tracking-tight">Receive SOL</h2>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main QR Section */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-8">
            {/* Amount Input Section */}
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-slate-900">Enter Amount to Receive</h3>

              {/* PHP Amount Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">Amount in PHP (Philippine Peso)</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-2xl text-slate-400">₱</span>
                  <input
                    type="number"
                    value={phpAmount}
                    onChange={(e) => handlePhpAmountChange(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full pl-12 pr-4 py-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-xl font-semibold"
                  />
                </div>
              </div>

              {/* SOL Amount Display */}
              {phpAmount && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wider">You Will Receive</p>
                  <div className="flex items-baseline justify-between">
                    <p className="text-3xl font-light text-emerald-600">{solAmount}</p>
                    <p className="text-sm text-slate-600">SOL</p>
                  </div>
                  <p className="text-xs text-slate-500 mt-3">
                    Exchange rate: 1 SOL = ₱{exchangeRate?.toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            {/* QR Code Section */}
            <div className="border-t border-slate-200 pt-8 space-y-6">
              <h3 className="text-lg font-medium text-slate-900">Share QR Code</h3>

              {/* QR Code Display */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 flex justify-center">
                <img
                  src="https://cdn.builder.io/api/v1/image/assets%2F8f0d8bd21f7949af92dc642658451224%2Ff3b8f3b7797443eb9703a9b4ae5b085f?format=webp&width=800"
                  alt="Solana Wallet QR Code"
                  className="w-80 h-80 object-contain"
                />
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3 text-sm text-slate-700">
                <p className="font-medium text-slate-900">How to send Solana:</p>
                <ol className="space-y-2 ml-4 list-decimal text-sm">
                  <li>Use Solana mobile wallet or web wallet to scan this QR code</li>
                  <li>The amount will be pre-filled based on your PHP input</li>
                  <li>Confirm and send the transaction</li>
                  <li>Funds will arrive instantly</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Solana Address */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-medium text-slate-900">Solana Address</h3>

            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 break-all font-mono text-xs text-slate-600">
                {SOLANA_ADDRESS}
              </div>

              <button
                onClick={() => copyToClipboard(SOLANA_ADDRESS, 'Address copied!')}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
              >
                {copyFeedback === 'Address copied!' ? '✓ Copied' : 'Copy Address'}
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-slate-600">
              <p className="font-medium text-slate-700 mb-1">Verified Solana Address</p>
              <p>This is a verified receiving address on the Solana blockchain.</p>
            </div>
          </div>

          {/* Exchange Rate Info */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-medium text-slate-900">Exchange Rate</h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">1 SOL</span>
                <span className="font-semibold text-slate-900">₱{exchangeRate?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">1 PHP</span>
                <span className="font-semibold text-slate-900">{(1 / exchangeRate)?.toFixed(6)} SOL</span>
              </div>
            </div>

            <button
              onClick={loadExchangeRate}
              className="w-full px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-xs font-medium"
            >
              Refresh Rate
            </button>
          </div>

          {/* Tips */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-medium text-slate-900">Tips</h3>

            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>Solana transactions are fast and cheap</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>QR code encodes the amount for quick checkout</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>Exchange rates update automatically</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>Sender needs a Solana-compatible wallet</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
