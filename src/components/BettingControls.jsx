import React, { useState, useEffect } from 'react'

export default function BettingControls({ maxBet, onBet, onCall, onRaise, onCheck, onFold, selectedBet, onBetChange }) {
  const [actionMode, setActionMode] = useState('bet') // 'bet', 'raise', 'check'
  const [isProcessing, setIsProcessing] = useState(false)

  const handleQuickAmount = (amount) => {
    const newAmount = Math.min(amount, maxBet)
    onBetChange(newAmount)
  }

  const handleSubmitBet = async () => {
    setIsProcessing(true)
    try {
      await onBet(selectedBet)
    } finally {
      setIsProcessing(false)
      onBetChange(0)
      setActionMode('bet')
    }
  }

  const handleSubmitRaise = async () => {
    setIsProcessing(true)
    try {
      await onRaise(selectedBet)
    } finally {
      setIsProcessing(false)
      onBetChange(0)
      setActionMode('bet')
    }
  }

  const handleCall = async () => {
    setIsProcessing(true)
    try {
      await onCall()
    } finally {
      setIsProcessing(false)
      onBetChange(0)
    }
  }

  const handleCheck = async () => {
    setIsProcessing(true)
    try {
      await onCheck()
    } finally {
      setIsProcessing(false)
      onBetChange(0)
    }
  }

  const handleFold = async () => {
    if (window.confirm('Are you sure you want to fold?')) {
      setIsProcessing(true)
      try {
        await onFold()
      } finally {
        setIsProcessing(false)
        onBetChange(0)
      }
    }
  }

  const quickBets = [
    { label: '25%', value: Math.floor(maxBet * 0.25) },
    { label: '50%', value: Math.floor(maxBet * 0.5) },
    { label: '75%', value: Math.floor(maxBet * 0.75) },
    { label: 'All In', value: maxBet }
  ]

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-4">
      
      {/* Bet Amount Slider */}
      {(actionMode === 'bet' || actionMode === 'raise') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-300">
              {actionMode === 'raise' ? 'Raise Amount' : 'Bet Amount'}
            </label>
            <div className="text-lg font-mono font-bold text-emerald-400">
              {selectedBet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Slider */}
          <input
            type="range"
            min="0"
            max={maxBet}
            step="1"
            value={selectedBet}
            onChange={(e) => onBetChange(Number(e.target.value))}
            disabled={isProcessing}
            className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {/* Quick Amount Buttons */}
          <div className="grid grid-cols-4 gap-2">
            {quickBets.map(({ label, value }) => (
              <button
                key={label}
                onClick={() => handleQuickAmount(value)}
                disabled={isProcessing || value > maxBet}
                className="px-2 py-2 text-xs font-semibold bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded transition"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-2">
        {/* Check/Call Button */}
        <button
          onClick={handleCheck}
          disabled={isProcessing || selectedBet > 0}
          className="px-3 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition flex items-center justify-center gap-1 text-sm"
        >
          Check
        </button>

        {/* Call Button */}
        <button
          onClick={handleCall}
          disabled={isProcessing}
          className="px-3 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition flex items-center justify-center gap-1 text-sm"
        >
          Call
        </button>

        {/* Bet/Raise Button */}
        <button
          onClick={actionMode === 'raise' ? handleSubmitRaise : handleSubmitBet}
          disabled={isProcessing || selectedBet <= 0}
          className="px-3 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition flex items-center justify-center gap-1 text-sm"
        >
          {actionMode === 'raise' ? 'Raise' : 'Bet'}
        </button>

        {/* Fold Button */}
        <button
          onClick={handleFold}
          disabled={isProcessing}
          className="px-3 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition flex items-center justify-center gap-1 text-sm"
        >
          Fold
        </button>
      </div>

      {/* Mode Toggle */}
      {selectedBet > 0 && (
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => setActionMode('bet')}
            className={`flex-1 px-2 py-2 text-xs font-semibold rounded transition ${
              actionMode === 'bet'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Bet
          </button>
          <button
            onClick={() => setActionMode('raise')}
            className={`flex-1 px-2 py-2 text-xs font-semibold rounded transition ${
              actionMode === 'raise'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Raise
          </button>
        </div>
      )}

      {/* Processing State */}
      {isProcessing && (
        <div className="flex items-center justify-center gap-2 text-slate-300 text-sm">
          <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-emerald-400 rounded-full animate-spin"></span>
          Processing action...
        </div>
      )}

      {/* Max Bet Info */}
      <div className="text-xs text-slate-400 pt-2 border-t border-slate-700">
        Max available: {maxBet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  )
}
