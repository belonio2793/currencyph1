import React, { useState } from 'react'

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

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={handleCancel} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
            <h2 className="text-xl font-semibold">Currency Selection</h2>
            <button
              onClick={handleCancel}
              className="hover:bg-blue-800 p-1 rounded transition-colors"
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Two columns layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Fiat Currency Column */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">Display Currency:</label>
                <select
                  value={localFiatCurrency}
                  onChange={(e) => setLocalFiatCurrency(e.target.value)}
                  className="px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-sm font-medium bg-slate-50"
                >
                  {fiatCurrencies.map(curr => (
                    <option key={curr.code} value={curr.code}>
                      {curr.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cryptocurrency Column */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">Display Cryptocurrency:</label>
                <select
                  value={localCryptoCurrency}
                  onChange={(e) => setLocalCryptoCurrency(e.target.value)}
                  className="px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-sm font-medium bg-slate-50"
                >
                  {cryptocurrencies.map(crypto => (
                    <option key={crypto.code} value={crypto.code}>
                      {crypto.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <p className="text-sm text-slate-600 mb-2">Preview:</p>
              <p className="text-lg font-medium text-slate-900">
                Display: <span className="text-blue-600">{localFiatCurrency}</span> & <span className="text-blue-600">{localCryptoCurrency}</span>
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-50 px-6 py-4 rounded-b-lg flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
