import React, { useState } from 'react'
import { currencyAPI } from './currencyAPI'

/**
 * Get exchange rate for PHP to USD based on user's geolocation
 * Falls back to standard rate if geolocation unavailable
 */
export async function getPhpToUsdRate() {
  try {
    const rates = await currencyAPI.getGlobalRates()
    if (rates && rates.PHP && rates.PHP.rate) {
      return 1 / rates.PHP.rate
    }
  } catch (err) {
    console.warn('Failed to fetch exchange rates:', err)
  }
  return 0.018
}

/**
 * Convert PHP to USD
 */
export function phpToUsd(phpAmount, exchangeRate) {
  if (!phpAmount || !exchangeRate) return 0
  return Number((phpAmount * exchangeRate).toFixed(2))
}

/**
 * Convert USD to PHP
 */
export function usdToPhp(usdAmount, exchangeRate) {
  if (!usdAmount || !exchangeRate) return 0
  return Number((usdAmount / exchangeRate).toFixed(2))
}

/**
 * Format currency value for display
 */
export function formatPhp(amount) {
  if (!amount && amount !== 0) return '₱0'
  return '₱' + Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatUsd(amount) {
  if (!amount && amount !== 0) return '$0.00'
  return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Currency Input Component - Toggle between PHP and USD input
 * Can be configured to allow switching input direction
 */
export function CurrencyInput({
  label,
  value,
  onChange,
  exchangeRate,
  placeholder = '0.00',
  step = '0.01',
  invertible = true,
  phpValue,
  usdValue,
  onPhpChange,
  onUsdChange
}) {
  const [inputMode, setInputMode] = useState('php') // 'php' or 'usd'

  // Support both single value and dual value modes
  const actualPhpValue = phpValue !== undefined ? phpValue : (value || 0)
  const actualUsdValue = usdValue !== undefined ? usdValue : phpToUsd(actualPhpValue, exchangeRate)

  const handlePhpInput = (phpVal) => {
    if (onPhpChange) {
      onPhpChange(phpVal)
    } else {
      onChange(phpVal)
    }
  }

  const handleUsdInput = (usdVal) => {
    if (onUsdChange) {
      onUsdChange(usdVal)
    } else {
      onChange(usdToPhp(usdVal, exchangeRate))
    }
  }

  return (
    <div>
      <label className="text-xs font-medium text-slate-700">{label}</label>
      <div className="flex gap-2 mt-1">
        <div className={`flex-1 ${inputMode === 'php' ? '' : 'opacity-75'}`}>
          <input
            type="number"
            step={step}
            value={actualPhpValue}
            onChange={(e) => {
              handlePhpInput(parseFloat(e.target.value) || 0)
              setInputMode('php')
            }}
            placeholder={placeholder}
            className={`w-full px-3 py-2 border rounded text-sm ${
              inputMode === 'php' ? '' : 'bg-slate-50'
            }`}
            readOnly={inputMode === 'usd' && invertible}
          />
          <div className="text-xs text-slate-500 mt-1">{formatPhp(actualPhpValue)}</div>
        </div>
        <div className={`flex-1 ${inputMode === 'usd' ? '' : 'opacity-75'}`}>
          <input
            type="number"
            step="0.01"
            value={actualUsdValue}
            onChange={(e) => {
              handleUsdInput(parseFloat(e.target.value) || 0)
              setInputMode('usd')
            }}
            placeholder={placeholder}
            className={`w-full px-3 py-2 border rounded text-sm ${
              inputMode === 'usd' ? '' : 'bg-slate-50'
            }`}
            readOnly={inputMode === 'php' && invertible}
          />
          <div className="text-xs text-slate-500 mt-1">{formatUsd(actualUsdValue)}</div>
        </div>
        {invertible && (
          <button
            onClick={() => setInputMode(inputMode === 'php' ? 'usd' : 'php')}
            className="px-2 py-1 border rounded text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition mt-6"
            title="Toggle input direction"
          >
            ⇄
          </button>
        )}
      </div>
    </div>
  )
}
