import React, { useState } from 'react'
import ExpandableModal from './ExpandableModal'
import { useDevice } from '../context/DeviceContext'

export default function RakeModal({ open, onClose, startingBalance, endingBalance, userId, tableId, currencyCode, onRakeProcessed }) {
  const { isMobile } = useDevice()
  const [rakePercent, setRakePercent] = useState(10)
  const [tipPercent, setTipPercent] = useState(10)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)

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

  const footer = (
    <div className="flex gap-2 w-full">
      <button
        type="button"
        onClick={onClose}
        disabled={processing}
        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        onClick={handleConfirm}
        disabled={processing}
        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {processing ? 'Processing...' : 'Confirm'}
      </button>
    </div>
  )

  return (
    <ExpandableModal
      isOpen={open}
      onClose={onClose}
      title="Game Summary & Rake"
      icon="💰"
      size={isMobile ? 'fullscreen' : 'sm'}
      footer={footer}
      defaultExpanded={!isMobile}
    >
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Game Results */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <h3 className="font-semibold text-slate-900 mb-3">Game Results</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Starting Balance:</span>
              <span className="font-medium text-slate-900">{formatChips(startingBalance)} {currencyCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Ending Balance:</span>
              <span className="font-medium text-slate-900">{formatChips(endingBalance)} {currencyCode}</span>
            </div>
            <div className="border-t border-slate-300 my-2"></div>
            <div className="flex justify-between">
              <span className="font-medium text-slate-900">
                {isWinner ? 'Profit:' : 'Loss:'}
              </span>
              <span className={`font-semibold ${isWinner ? 'text-green-600' : 'text-red-600'}`}>
                {isWinner ? '+' : ''}{formatChips(netProfit)} {currencyCode}
              </span>
            </div>
          </div>
        </div>

        {/* Rake and Tip Calculation */}
        {isWinner && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Rake & Tip</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-slate-700 font-medium">Rake Percentage</label>
                  <span className="text-sm font-semibold text-blue-600">{rakePercent}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={rakePercent}
                  onChange={(e) => setRakePercent(parseInt(e.target.value))}
                  disabled={processing}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                />
                <div className="text-xs text-slate-600 mt-1">
                  {formatChips(rakeChips)} {currencyCode}
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-slate-700 font-medium">Tip (% of Rake)</label>
                  <span className="text-sm font-semibold text-blue-600">{tipPercent}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={tipPercent}
                  onChange={(e) => setTipPercent(parseInt(e.target.value))}
                  disabled={processing}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                />
                <div className="text-xs text-slate-600 mt-1">
                  {formatChips(tipChips)} {currencyCode}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Final Summary */}
        <div className={`rounded-lg p-4 ${isWinner ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'}`}>
          <h3 className="font-semibold mb-2">Final Balance</h3>
          <div className="text-2xl font-bold">
            {formatChips(finalBalance)} {currencyCode}
          </div>
          {isWinner && totalDeduction > 0 && (
            <p className="text-xs text-slate-600 mt-2">
              After {formatChips(totalDeduction)} {currencyCode} in rake and tips
            </p>
          )}
        </div>
      </div>
    </ExpandableModal>
  )
}
