import React, { useState, useEffect } from 'react'
import ResponsiveModal from './ResponsiveModal'
import ResponsiveButton from './ResponsiveButton'
import { getResponsiveFontSize } from '../lib/responsiveUtils'

export default function CurrencySelectionModal({ isOpen, onClose, globalCurrency, setGlobalCurrency, globalCryptocurrency, setGlobalCryptocurrency }) {
  const [localFiatCurrency, setLocalFiatCurrency] = useState(globalCurrency)
  const [localCryptoCurrency, setLocalCryptoCurrency] = useState(globalCryptocurrency)

  const fiatCurrencies = [
    { code: 'PHP', label: 'PHP - Philippine Peso' },
    { code: 'USD', label: 'USD - US Dollar' },
    { code: 'CAD', label: 'CAD - Canadian Dollar' },
    { code: 'EUR', label: 'EUR - Euro' },
    { code: 'GBP', label: 'GBP - British Pound' },
    { code: 'JPY', label: 'JPY - Japanese Yen' },
    { code: 'CNY', label: 'CNY - Chinese Yuan' },
    { code: 'INR', label: 'INR - Indian Rupee' },
    { code: 'AUD', label: 'AUD - Australian Dollar' },
    { code: 'CHF', label: 'CHF - Swiss Franc' },
    { code: 'SEK', label: 'SEK - Swedish Krona' },
    { code: 'NZD', label: 'NZD - New Zealand Dollar' },
    { code: 'SGD', label: 'SGD - Singapore Dollar' },
    { code: 'HKD', label: 'HKD - Hong Kong Dollar' },
    { code: 'IDR', label: 'IDR - Indonesian Rupiah' },
    { code: 'MYR', label: 'MYR - Malaysian Ringgit' },
    { code: 'THB', label: 'THB - Thai Baht' },
    { code: 'VND', label: 'VND - Vietnamese Dong' },
    { code: 'KRW', label: 'KRW - South Korean Won' },
    { code: 'ZAR', label: 'ZAR - South African Rand' },
    { code: 'BRL', label: 'BRL - Brazilian Real' },
    { code: 'MXN', label: 'MXN - Mexican Peso' },
    { code: 'NOK', label: 'NOK - Norwegian Krone' },
    { code: 'DKK', label: 'DKK - Danish Krone' },
    { code: 'AED', label: 'AED - UAE Dirham' }
  ]

  const cryptocurrencies = [
    { code: 'BTC', label: 'BTC - Bitcoin' },
    { code: 'ETH', label: 'ETH - Ethereum' },
    { code: 'USDT', label: 'USDT - Tether' },
    { code: 'BNB', label: 'BNB - Binance Coin' },
    { code: 'SOL', label: 'SOL - Solana' },
    { code: 'XRP', label: 'XRP - Ripple' },
    { code: 'ADA', label: 'ADA - Cardano' },
    { code: 'DOGE', label: 'DOGE - Dogecoin' },
    { code: 'DOT', label: 'DOT - Polkadot' },
    { code: 'BCH', label: 'BCH - Bitcoin Cash' },
    { code: 'LTC', label: 'LTC - Litecoin' },
    { code: 'USDC', label: 'USDC - USD Coin' },
    { code: 'LINK', label: 'LINK - Chainlink' },
    { code: 'MATIC', label: 'MATIC - Polygon' },
    { code: 'UNI', label: 'UNI - Uniswap' }
  ]

  // Sync local state when modal opens or global currency changes
  useEffect(() => {
    if (isOpen) {
      setLocalFiatCurrency(globalCurrency)
      setLocalCryptoCurrency(globalCryptocurrency)
    }
  }, [isOpen, globalCurrency, globalCryptocurrency])

  const handleApply = () => {
    setGlobalCurrency(localFiatCurrency)
    setGlobalCryptocurrency(localCryptoCurrency)
    onClose()
  }

  const handleCancel = () => {
    setLocalFiatCurrency(globalCurrency)
    setLocalCryptoCurrency(globalCryptocurrency)
    onClose()
  }

  const getFiatCurrencyLabel = (code) => {
    const curr = fiatCurrencies.find(c => c.code === code)
    return curr ? curr.label : code
  }

  const getCryptoCurrencyLabel = (code) => {
    const crypto = cryptocurrencies.find(c => c.code === code)
    return crypto ? crypto.label : code
  }

  return (
    <ResponsiveModal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Currency Selection"
      size="lg"
      footer={
        <>
          <ResponsiveButton
            variant="secondary"
            onClick={handleCancel}
          >
            Cancel
          </ResponsiveButton>
          <ResponsiveButton
            variant="primary"
            onClick={handleApply}
          >
            Apply
          </ResponsiveButton>
        </>
      }
    >
      <div className="space-y-4 sm:space-y-6">
        {/* Currently Selected Currency Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Currently Selected</h3>
          <div className="text-sm text-blue-800 space-y-1">
            <p><span className="font-medium">Display Currency:</span> <span className="inline-flex items-center gap-2">
              {getFiatCurrencyLabel(globalCurrency)}
              {globalCurrency === 'PHP' && <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded font-medium">Default</span>}
            </span></p>
            <p><span className="font-medium">Display Cryptocurrency:</span> {getCryptoCurrencyLabel(globalCryptocurrency)}</p>
          </div>
        </div>

        {/* Fiat Currency Section */}
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm sm:text-base font-medium text-slate-900">
              Display Currency
            </label>
            {localFiatCurrency === globalCurrency && (
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                ✓ Currently Selected
              </span>
            )}
          </div>
          <select
            value={localFiatCurrency}
            onChange={(e) => setLocalFiatCurrency(e.target.value)}
            className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base bg-white transition-colors ${
              localFiatCurrency === globalCurrency
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-300 hover:border-slate-400'
            }`}
          >
            {fiatCurrencies.map(curr => (
              <option key={curr.code} value={curr.code}>
                {curr.label}{curr.code === 'PHP' ? ' (Default)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Cryptocurrency Section */}
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm sm:text-base font-medium text-slate-900">
              Display Cryptocurrency
            </label>
            {localCryptoCurrency === globalCryptocurrency && (
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                ✓ Currently Selected
              </span>
            )}
          </div>
          <select
            value={localCryptoCurrency}
            onChange={(e) => setLocalCryptoCurrency(e.target.value)}
            className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base bg-white transition-colors ${
              localCryptoCurrency === globalCryptocurrency
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-300 hover:border-slate-400'
            }`}
          >
            {cryptocurrencies.map(crypto => (
              <option key={crypto.code} value={crypto.code}>
                {crypto.label}
              </option>
            ))}
          </select>
        </div>

        {/* Info Message */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-slate-600">
            <span className="font-medium">💡 Tip:</span> Your currency selection will be saved and applied to all monetary values across the application.
          </p>
        </div>
      </div>
    </ResponsiveModal>
  )
}
