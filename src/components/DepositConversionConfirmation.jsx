import React, { useState } from 'react'

export const DepositConversionConfirmation = ({
  isOpen,
  deposit,
  walletCurrency,
  conversion,
  onConfirm,
  onReject,
  onClose,
  isLoading = false
}) => {
  const [showDetails, setShowDetails] = useState(false)

  if (!isOpen || !conversion) {
    return null
  }

  const exchangeRatePercentage = ((conversion.exchangeRate - 1) * 100).toFixed(2)
  const isAdverse = conversion.exchangeRate < 1
  const formatCurrency = (amount, currency) => {
    return `${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    })} ${currency}`
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Confirm Currency Conversion
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Your deposit will be converted to your wallet currency
          </p>
        </div>

        {/* Main Content */}
        <div className="px-6 py-5 space-y-4">
          {/* Deposit Details */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Amount Deposited</span>
              <span className="text-base font-semibold text-gray-900">
                {formatCurrency(conversion.originalAmount, conversion.fromCurrency)}
              </span>
            </div>

            {/* Exchange Rate Info */}
            <div className="border-t border-gray-200 pt-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-600">Exchange Rate</span>
                <span className="text-base font-semibold text-gray-900">
                  1 {conversion.fromCurrency} = {conversion.exchangeRate.toFixed(8)} {conversion.toCurrency}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                {isAdverse ? '⚠️ Unfavorable rate' : '✓ Current market rate'}
                {exchangeRatePercentage !== '0.00' && ` (${isAdverse ? '-' : '+'}${Math.abs(exchangeRatePercentage)}%)`}
              </div>
            </div>
          </div>

          {/* Conversion Result */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2">You will receive</p>
            <div className="flex justify-between items-center">
              <span className="text-2xl font-bold text-green-700">
                {formatCurrency(conversion.convertedAmount, conversion.toCurrency)}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              In your {conversion.toCurrency} wallet
            </p>
          </div>

          {/* Rate Source Info */}
          {showDetails && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
              <p><strong>Rate Source:</strong> {conversion.rateSource}</p>
              <p><strong>Rate Updated:</strong> {new Date(conversion.rateUpdatedAt).toLocaleString()}</p>
              <p><strong>Conversion Time:</strong> {new Date(conversion.timestamp).toLocaleString()}</p>
            </div>
          )}

          {/* Toggle Details */}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            {showDetails ? '▼ Hide details' : '▶ Show details'}
          </button>
        </div>

        {/* Footer / Actions */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            type="button"
            onClick={onReject}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm flex items-center justify-center gap-2"
          >
            {isLoading && <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
            {isLoading ? 'Processing...' : 'Confirm & Proceed'}
          </button>
        </div>

        {/* Disclaimer */}
        <div className="bg-yellow-50 border-t border-yellow-200 px-6 py-3 text-xs text-gray-600">
          <p>
            🔒 <strong>Safe & Secure:</strong> Your conversion will be recorded in our audit trail.
            All conversions use current market rates from verified sources.
          </p>
        </div>
      </div>
    </div>
  )
}

export default DepositConversionConfirmation
