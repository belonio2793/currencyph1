import React from 'react'

export default function CurrencyCryptoToggle({ active, onChange }) {
  return (
    <div className="inline-flex bg-white border border-slate-200 rounded-lg p-1">
      <button
        onClick={() => onChange('currency')}
        className={`px-6 py-2 rounded text-sm font-medium transition-colors ${
          active === 'currency'
            ? 'bg-blue-600 text-white'
            : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        Currency
      </button>
      <button
        onClick={() => onChange('cryptocurrency')}
        className={`px-6 py-2 rounded text-sm font-medium transition-colors ${
          active === 'cryptocurrency'
            ? 'bg-orange-600 text-white'
            : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        Cryptocurrency
      </button>
    </div>
  )
}
