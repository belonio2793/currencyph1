import React, { useState } from 'react'

export default function RakeModal({ open, onClose, startingBalance, endingBalance, userId, tableId, currencyCode, onRakeProcessed }) {
  const [tipPercent, setTipPercent] = useState(10)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)

  if (!open) return null

  const netProfit = endingBalance - startingBalance
  const isWinner = netProfit > 0
  const rakeAmount = isWinner ? (netProfit * tipPercent) / 100 : 0
  const finalCashOut = endingBalance - rakeAmount

  const formatCurrency = (amount) => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  async function handleConfirm() {
    if (!userId || !tableId) {
      setError('Invalid session data')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const FUNCTIONS_BASE = (import.meta.env.VITE_PROJECT_URL || '').replace(/\/+$/, '') + '/functions/v1/poker-engine'
      
      const response = await fetch(`${FUNCTIONS_BASE}/process_rake`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId,
          tableId,
          startingBalance,
          endingBalance,
          rakeAmount,
          tipPercent,
          currencyCode
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process rake')
      }

      // Call success callback
      if (onRakeProcessed) {
        onRakeProcessed(data)
      }

      onClose()
    } catch (err) {
      console.error('Rake processing error:', err)
      setError(err.message || 'An error occurred while processing rake')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-2xl max-w-md w-full border border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
          <h2 className="text-2xl font-bold">Session Complete 🎉</h2>
          <p className="text-sm text-emerald-100 mt-1">Review your earnings and set your tip</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-600 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Balance Summary */}
          <div className="space-y-4">
            <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">Starting Balance</span>
                <span className="text-white font-mono font-semibold">{formatCurrency(startingBalance)} {currencyCode}</span>
              </div>
              
              <div className="border-t border-slate-600"></div>
              
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">Ending Balance</span>
                <span className="text-white font-mono font-semibold">{formatCurrency(endingBalance)} {currencyCode}</span>
              </div>
              
              <div className="border-t border-slate-600"></div>
              
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${isWinner ? 'text-emerald-400' : 'text-red-400'}`}>
                  Net Result
                </span>
                <span className={`font-mono font-bold ${isWinner ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isWinner ? '+' : ''}{formatCurrency(netProfit)} {currencyCode}
                </span>
              </div>
            </div>

            {/* Tip Adjustment Section */}
            {isWinner && (
              <div className="bg-slate-700/50 rounded-lg p-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-slate-300 font-semibold text-sm">Tip Amount</label>
                    <span className="text-emerald-400 font-mono font-bold text-lg">{formatCurrency(rakeAmount)} {currencyCode}</span>
                  </div>

                  {/* Slider */}
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={tipPercent}
                      onChange={(e) => setTipPercent(Number(e.target.value))}
                      disabled={processing}
                      className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">0%</span>
                      <span className="text-emerald-400 font-semibold">{tipPercent}%</span>
                      <span className="text-slate-400">100%</span>
                    </div>
                  </div>

                  {/* Tip description */}
                  <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                    Tips support the poker room. {tipPercent > 0 && `At ${tipPercent}%, you'll contribute ${formatCurrency(rakeAmount)} from your ${formatCurrency(netProfit)} profit.`}
                  </p>
                </div>
              </div>
            )}

            {!isWinner && (
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-slate-300 text-sm">
                  No tip charged on losing sessions. Better luck next time! 🍀
                </p>
              </div>
            )}

            {/* Final Amount */}
            <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-emerald-200 font-semibold">You will cash out</span>
                <span className="text-emerald-100 font-mono font-bold text-xl">{formatCurrency(finalCashOut)} {currencyCode}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={processing}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={processing}
              className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-emerald-300 border-t-white rounded-full animate-spin"></span>
                  Processing...
                </>
              ) : (
                <>
                  ✓ Confirm & Cashout
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
