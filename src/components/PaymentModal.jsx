import React, { useState } from 'react'
import { formatNumber } from '../lib/currency'
import ResponsiveButton from './ResponsiveButton'

export default function PaymentModal({ ride, onClose, onCompletePayment, loading }) {
  const [selectedPayment, setSelectedPayment] = useState('wallet')
  const [tipAmount, setTipAmount] = useState(0)
  const [customTip, setCustomTip] = useState('')

  const basePrice = ride.final_price || ride.estimated_total_price || 0
  const tip = customTip ? parseFloat(customTip) : tipAmount
  const totalAmount = basePrice + tip

  const handleTip = (amount) => {
    setTipAmount(amount)
    setCustomTip('')
  }

  const handlePayment = () => {
    onCompletePayment({
      ride_id: ride.id,
      amount: basePrice,
      tip: tip,
      payment_method: selectedPayment,
      total: totalAmount
    })
  }

  const paymentMethods = [
    { id: 'wallet', name: 'Digital Wallet', available: true },
    { id: 'cash', name: 'Cash Payment', available: true },
    { id: 'card', name: 'Credit/Debit Card', available: true }
  ]

  return (
    <div className="modal-responsive overlay-responsive">
      <div className="modal-content-responsive max-w-md">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Payment</h2>
              <p className="text-xs sm:text-sm opacity-80 mt-1">Ride completed successfully</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="modal-body-responsive">
          {/* Price Breakdown */}
          <div className="bg-slate-50 rounded-lg p-3 sm:p-4 border border-slate-200 space-y-2 sm:space-y-3">
            <h3 className="font-semibold text-sm sm:text-base text-slate-900 mb-3">Fare Details</h3>
            <div className="space-y-1.5 sm:space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Base Fare</span>
                <span className="font-medium text-slate-900">₱{formatNumber(basePrice)}</span>
              </div>
              {ride.actual_distance_km && (
                <div className="flex justify-between items-center text-xs sm:text-sm">
                  <span className="text-slate-600">Distance ({ride.actual_distance_km} km)</span>
                  <span className="font-medium text-slate-900">₱{formatNumber(ride.actual_distance_km * 8)}</span>
                </div>
              )}
              {ride.actual_duration_minutes && (
                <div className="flex justify-between items-center text-xs sm:text-sm">
                  <span className="text-slate-600">Duration ({ride.actual_duration_minutes} min)</span>
                  <span className="font-medium text-slate-900">₱{formatNumber(ride.actual_duration_minutes * 0.5)}</span>
                </div>
              )}
              <div className="border-t border-slate-300 pt-1.5 sm:pt-2 flex justify-between items-center font-bold">
                <span className="text-slate-900 text-sm sm:text-base">Subtotal</span>
                <span className="text-green-600 text-base sm:text-lg">₱{formatNumber(basePrice)}</span>
              </div>
            </div>
          </div>

          {/* Tip Section */}
          <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg p-3 sm:p-4 border border-blue-200 space-y-2 sm:space-y-3">
            <h3 className="font-semibold text-sm sm:text-base text-slate-900">Add a Tip</h3>
            <p className="text-xs sm:text-sm text-slate-600">Help your driver get rewarded for great service</p>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[50, 100, 200].map(amount => (
                <button
                  key={amount}
                  onClick={() => handleTip(amount)}
                  className={`py-2 sm:py-3 rounded-lg font-semibold transition-colors text-xs sm:text-sm min-h-10 sm:min-h-11 ${
                    tipAmount === amount
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-300 text-slate-900 hover:border-blue-500'
                  }`}
                >
                  ₱{amount}
                </button>
              ))}
            </div>
            <div>
              <input
                type="number"
                placeholder="Custom tip amount"
                value={customTip}
                onChange={(e) => {
                  setCustomTip(e.target.value)
                  setTipAmount(0)
                }}
                className="form-input-responsive"
              />
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-2 sm:space-y-3">
            <h3 className="font-semibold text-sm sm:text-base text-slate-900">Payment Method</h3>
            <div className="space-y-2 sm:space-y-3">
              {paymentMethods.map(method => (
                <label
                  key={method.id}
                  className={`flex items-center p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-colors min-h-11 sm:min-h-12 ${
                    selectedPayment === method.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-300 bg-white hover:border-blue-300'
                  } ${!method.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={method.id}
                    checked={selectedPayment === method.id}
                    onChange={() => setSelectedPayment(method.id)}
                    disabled={!method.available}
                    className="w-4 h-4 sm:w-5 sm:h-5 accent-blue-600 cursor-pointer"
                  />
                  <span className="ml-3 font-medium text-slate-900 text-sm sm:text-base">{method.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Total Amount */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-3 sm:p-4 mt-3 sm:mt-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 text-sm sm:text-base">Total Amount</span>
              <span className="text-xl sm:text-2xl font-bold text-green-600">₱{formatNumber(totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="modal-footer-responsive">
          <ResponsiveButton variant="secondary" onClick={onClose} fullWidth>
            Cancel
          </ResponsiveButton>
          <ResponsiveButton
            variant="primary"
            onClick={handlePayment}
            loading={loading}
            disabled={loading}
            fullWidth
          >
            {loading ? 'Processing...' : 'Complete Payment'}
          </ResponsiveButton>
        </div>
      </div>
    </div>
  )
}
