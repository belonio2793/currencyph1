import React from 'react'

export default function PotDisplay({ pot }) {
  return (
    <div className="flex justify-center">
      <div className="bg-gradient-to-r from-amber-900 to-amber-800 border-2 border-amber-600 rounded-xl px-8 py-4 text-center shadow-lg">
        <div className="text-sm font-semibold text-amber-100 mb-1">Current Pot</div>
        <div className="text-4xl font-bold text-amber-300 font-mono">
          {pot.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-xs text-amber-200 mt-1">PHP</div>
      </div>
    </div>
  )
}
