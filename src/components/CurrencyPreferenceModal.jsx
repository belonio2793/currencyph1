import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const CURRENCIES = [
  // Currencies
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', type: 'currency' },
  { code: 'USD', name: 'US Dollar', symbol: '$', type: 'currency' },
  { code: 'EUR', name: 'Euro', symbol: '€', type: 'currency' },
  { code: 'GBP', name: 'British Pound', symbol: '£', type: 'currency' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', type: 'currency' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', type: 'currency' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', type: 'currency' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', type: 'currency' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', type: 'currency' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', type: 'currency' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', type: 'currency' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', type: 'currency' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', type: 'currency' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', type: 'currency' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', type: 'currency' },
  // Cryptocurrencies
  { code: 'BTC', name: 'Bitcoin', symbol: '₿', type: 'cryptocurrency' },
  { code: 'ETH', name: 'Ethereum', symbol: 'Ξ', type: 'cryptocurrency' },
  { code: 'USDT', name: 'Tether', symbol: '₮', type: 'cryptocurrency' },
  { code: 'USDC', name: 'USD Coin', symbol: 'ⓤ', type: 'cryptocurrency' },
  { code: 'BNB', name: 'Binance Coin', symbol: 'Ⓑ', type: 'cryptocurrency' },
]

export default function CurrencyPreferenceModal({ onClose, setGlobalCurrency, globalCurrency = 'PHP' }) {
  const [selectedCurrency, setSelectedCurrency] = useState(globalCurrency)
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error?.message?.includes('Auth session missing')) {
          return
        }
        if (user) {
          setUserId(user.id)
          loadUserPreference(user.id)
        }
      } catch (err) {
        // Silently fail for non-authenticated users
      }
    }
    getCurrentUser()
  }, [])

  const loadUserPreference = async (id) => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('display_currency')
        .eq('user_id', id)
        .single()

      if (data && data.display_currency) {
        setSelectedCurrency(data.display_currency)
      }
    } catch (err) {
      // Silently fail
    }
  }

  const handleCurrencySelect = (currencyCode) => {
    setSelectedCurrency(currencyCode)
    // Update global currency immediately
    if (setGlobalCurrency) {
      setGlobalCurrency(currencyCode)
    }
    // Save to localStorage for guests
    localStorage.setItem('preferred_currency', currencyCode)
    // Save to database if authenticated
    if (userId) {
      supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          display_currency: currencyCode,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .catch(err => console.debug('Could not save preference:', err?.message))
    }
  }

  const selectedCurrencyObj = CURRENCIES.find(c => c.code === selectedCurrency)
  const currencyCurrencies = CURRENCIES.filter(c => c.type === 'currency')
  const cryptocurrencyCurrencies = CURRENCIES.filter(c => c.type === 'cryptocurrency')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 border-b border-slate-200 px-6 py-4 flex items-center justify-between bg-white">
          <div>
            <h2 className="text-2xl font-light text-slate-900">Preferred Currency</h2>
            <p className="text-sm text-slate-500 mt-1">Choose how you want to see prices and amounts</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Currencies */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Currencies</h3>
            <div className="grid grid-cols-2 gap-2">
              {currencyCurrencies.map(currency => (
                <button
                  key={currency.code}
                  type="button"
                  onClick={() => handleCurrencySelect(currency.code)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    selectedCurrency === currency.code
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-medium">{currency.symbol}</span>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{currency.code}</div>
                      <div className="text-xs text-slate-500">{currency.name}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Cryptocurrency */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Cryptocurrencies</h3>
            <div className="grid grid-cols-2 gap-2">
              {cryptocurrencyCurrencies.map(currency => (
                <button
                  key={currency.code}
                  type="button"
                  onClick={() => handleCurrencySelect(currency.code)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    selectedCurrency === currency.code
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-medium">{currency.symbol}</span>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{currency.code}</div>
                      <div className="text-xs text-slate-500">{currency.name}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Currency Preview */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-slate-600 mb-2">Preview</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-light text-blue-900">
                {selectedCurrencyObj?.symbol}
              </span>
              <span className="text-lg text-slate-600">1,234.56</span>
              <span className="text-sm text-slate-500 ml-auto">{selectedCurrency}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
