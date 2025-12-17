import React, { useState } from 'react'

export default function RakeModal({ open, onClose, startingBalance, endingBalance, userId, tableId, currencyCode, onRakeProcessed }) {
  const [rakePercent, setRakePercent] = useState(10)
  const [tipPercent, setTipPercent] = useState(10)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)

  if (!open) return null

  const isChipBased = currencyCode === 'CHIPS'
  const netProfit = endingBalance - startingBalance
  const isWinner = netProfit > 0
  const rakeAmount = isWinner ? Math.round(netProfit * (rakePercent / 100)) : 0
  const tipAmount = isWinner ? Math.round(rakeAmount * (tipPercent / 100)) : 0
  const totalDeduction = rakeAmount + tipAmount
  const finalBalance = endingBalance - totalDeduction

  const formatChips = (chips) => {
    return chips.toLocaleString()
  }

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
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const response = await fetch(`${FUNCTIONS_BASE}/process_rake`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({
          userId,
          tableId,
          startingChips: startingBalance,
          endingChips: endingBalance,
          rakePercent,
          tipPercent
        })
      })

      let data
      try {
        data = await response.json()
      } catch (e) {
        console.error('Failed to parse response:', e)
        throw new Error('Invalid response from server')
      }

      if (!response.ok) {
        const errorMsg = data?.error || `Server error: ${response.status}`
        throw new Error(errorMsg)
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
          <p className="text-sm text-emerald-100 mt-1">
            {isChipBased 
              ? 'Review your chip results and tips to the house'
              : 'Review your earnings and set your tip'}
          </p>
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
                <span className="text-slate-300 text-sm">Starting {isChipBased ? 'Chips' : 'Balance'}</span>
                <span className="text-white font-mono font-semibold">
                  {isChipBased ? formatChips(startingBalance) : formatCurrency(startingBalance)} {isChipBased ? 'chips' : ''}
                </span>
              </div>
              
              <div className="border-t border-slate-600"></div>
              
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">Ending {isChipBased ? 'Chips' : 'Balance'}</span>
                <span className="text-white font-mono font-semibold">
                  {isChipBased ? formatChips(endingBalance) : formatCurrency(endingBalance)} {isChipBased ? 'chips' : ''}
                </span>
              </div>
              
              <div className="border-t border-slate-600"></div>
              
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${isWinner ? 'text-emerald-400' : 'text-red-400'}`}>
                  Net Result
                </span>
                <span className={`font-mono font-bold ${isWinner ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isWinner ? '+' : ''}{isChipBased ? formatChips(netProfit) : formatCurrency(netProfit)} {isChipBased ? 'chips' : ''}
                </span>
              </div>
            </div>

            {/* House Rake/Tip Adjustment Section */}
            {isWinner && (
              <div className="bg-slate-700/50 rounded-lg p-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-slate-300 font-semibold text-sm">House Rake %</label>
                    <span className="text-slate-400 font-mono text-sm">{rakePercent}%</span>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="50"
                      step="1"
                      value={rakePercent}
                      onChange={(e) => setRakePercent(Number(e.target.value))}
                      disabled={processing}
                      className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">0%</span>
                      <span className="text-emerald-400 font-semibold">{rakePercent}%</span>
                      <span className="text-slate-400">50%</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                    {rakePercent > 0 
                      ? `House rake: ${isChipBased ? formatChips(rakeAmount) : formatCurrency(rakeAmount / 10000)} from your ${isChipBased ? formatChips(netProfit) : formatCurrency(netProfit / 10000)} profit.`
                      : 'No house rake.'}
                  </p>
                </div>

                <div className="border-t border-slate-600 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-slate-300 font-semibold text-sm">Tip to House %</label>
                    <span className="text-amber-400 font-mono text-sm">{tipPercent}%</span>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={tipPercent}
                      onChange={(e) => setTipPercent(Number(e.target.value))}
                      disabled={processing}
                      className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">0%</span>
                      <span className="text-amber-400 font-semibold">{tipPercent}%</span>
                      <span className="text-slate-400">100%</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                    Tips support the poker room. {tipPercent > 0 && `At ${tipPercent}%, you'll contribute ${isChipBased ? formatChips(tipAmount) : formatCurrency(tipAmount / 10000)} as tip.`}
                  </p>
                </div>
              </div>
            )}

            {!isWinner && (
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-slate-300 text-sm">
                  No rake charged on losing sessions. Your remaining chips are returned to your inventory. Better luck next time! 🍀
                </p>
              </div>
            )}

            {/* Final Amount / Summary */}
            <div className={`${isWinner ? 'bg-emerald-900/30 border-emerald-700' : 'bg-slate-700/30 border-slate-600'} border rounded-lg p-4`}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={isWinner ? 'text-emerald-200' : 'text-slate-300'}>
                    Chips returned to inventory
                  </span>
                  <span className={`font-mono font-bold text-xl ${isWinner ? 'text-emerald-100' : 'text-slate-200'}`}>
                    {isChipBased ? formatChips(finalBalance) : formatCurrency(finalBalance)} {isChipBased ? 'chips' : ''}
                  </span>
                </div>
                {isWinner && (
                  <div className="text-xs text-slate-400 text-right">
                    (House rake: {formatChips(rakeAmount)} + tip: {formatChips(tipAmount)})
                  </div>
                )}
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
                  ✓ Confirm & End Session
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
