import React, { useState } from 'react'
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
      {/* Content with responsive spacing */}
      <div className="space-y-4 sm:space-y-6">
        {/* Fiat Currency Section */}
        <div className="space-y-2 sm:space-y-3">
          <label className="text-sm sm:text-base font-medium text-slate-900">
            Display Currency
          </label>
          <select
            value={localFiatCurrency}
            onChange={(e) => setLocalFiatCurrency(e.target.value)}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base bg-white"
          >
            {fiatCurrencies.map(curr => (
              <option key={curr.code} value={curr.code}>
                {curr.label}
              </option>
            ))}
          </select>
        </div>

        {/* Cryptocurrency Section */}
        <div className="space-y-2 sm:space-y-3">
          <label className="text-sm sm:text-base font-medium text-slate-900">
            Display Cryptocurrency
          </label>
          <select
            value={localCryptoCurrency}
            onChange={(e) => setLocalCryptoCurrency(e.target.value)}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base bg-white"
          >
            {cryptocurrencies.map(crypto => (
              <option key={crypto.code} value={crypto.code}>
                {crypto.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </ResponsiveModal>
  )
}
