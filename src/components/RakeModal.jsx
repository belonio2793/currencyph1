import React, { useState } from 'react'

export default function RakeModal({ open, onClose, startingBalance, endingBalance, userId, tableId, currencyCode, onRakeProcessed }) {
  const [rakePercent, setRakePercent] = useState(10)
  const [tipPercent, setTipPercent] = useState(10)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)

  if (!open) return null

  const netProfit = endingBalance - startingBalance
  const isWinner = netProfit > 0
  const rakeChips = isWinner ? Math.round(netProfit * (rakePercent / 100)) : 0
  const tipChips = isWinner ? Math.round(rakeChips * (tipPercent / 100)) : 0
  const totalDeduction = rakeChips + tipChips
  const finalBalance = endingBalance - totalDeduction

  const formatChips = (chips) => {
    return chips.toLocaleString()
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
          <p className="text-sm text-emerald-100 mt-1">Review your chip results and set house rake</p>
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
                <span className="text-slate-300 text-sm">Starting Chips</span>
                <span className="text-white font-mono font-semibold">
                  {formatChips(startingBalance)} PLAY CHIPS
                </span>
              </div>
              
              <div className="border-t border-slate-600"></div>
              
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">Ending Chips</span>
                <span className="text-white font-mono font-semibold">
                  {formatChips(endingBalance)} PLAY CHIPS
                </span>
              </div>
              
              <div className="border-t border-slate-600"></div>
              
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${isWinner ? 'text-emerald-400' : 'text-red-400'}`}>
                  Net Result
                </span>
                <span className={`font-mono font-bold ${isWinner ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isWinner ? '+' : ''}{formatChips(netProfit)} PLAY CHIPS
                </span>
              </div>
            </div>

            {/* House Rake & Tip Section */}
            {isWinner && (
              <div className="bg-slate-700/50 rounded-lg p-4 space-y-5">
                {/* Rake Slider */}
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

                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    {rakePercent > 0
                      ? `House takes ${formatChips(rakeChips)} PLAY CHIPS from your ${formatChips(netProfit)} PLAY CHIPS profit`
                      : 'No house rake'}
                  </p>
                </div>

                {/* Tip Slider */}
                <div className="border-t border-slate-600 pt-5">
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

                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    {tipPercent > 0
                      ? `Tip ${formatChips(tipChips)} PLAY CHIPS to the house`
                      : 'No tip'}
                  </p>
                </div>
              </div>
            )}

            {!isWinner && (
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-slate-300 text-sm">
                  No rake on losing sessions. Your chips are returned to inventory. Better luck next time! 🍀
                </p>
              </div>
            )}

            {/* Summary */}
            <div className={`${isWinner ? 'bg-emerald-900/30 border-emerald-700' : 'bg-slate-700/30 border-slate-600'} border rounded-lg p-4`}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={isWinner ? 'text-emerald-200' : 'text-slate-300'}>
                    Chips returned to inventory
                  </span>
                  <span className={`font-mono font-bold text-xl ${isWinner ? 'text-emerald-100' : 'text-slate-200'}`}>
                    {formatChips(finalBalance)} PLAY CHIPS
                  </span>
                </div>
                {isWinner && rakeChips + tipChips > 0 && (
                  <div className="text-xs text-slate-400 text-right">
                    (Rake: {formatChips(rakeChips)} + Tip: {formatChips(tipChips)} = {formatChips(rakeChips + tipChips)} PLAY CHIPS to house)
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
