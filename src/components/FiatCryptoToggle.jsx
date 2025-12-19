import React from 'react'

export default function FiatCryptoToggle({ active, onChange }) {
  return (
    <div className="inline-flex bg-white border border-slate-200 rounded-lg p-1">
      <button
        onClick={() => onChange('fiat')}
        className={`px-6 py-2 rounded text-sm font-medium transition-colors ${
          active === 'fiat'
            ? 'bg-blue-600 text-white'
            : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        💵 Fiat
      </button>
      <button
        onClick={() => onChange('crypto')}
        className={`px-6 py-2 rounded text-sm font-medium transition-colors ${
          active === 'crypto'
            ? 'bg-orange-600 text-white'
            : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        ₿ Crypto
      </button>
    </div>
  )
}
