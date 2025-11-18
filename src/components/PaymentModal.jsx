import React, { useState } from 'react'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold">Payment</h2>
              <p className="text-sm opacity-80 mt-1">Ride completed successfully</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Price Breakdown */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-3">
            <h3 className="font-semibold text-slate-900 mb-4">Fare Details</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Base Fare</span>
                <span className="font-medium text-slate-900">₱{basePrice.toFixed(2)}</span>
              </div>
              {ride.actual_distance_km && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Distance ({ride.actual_distance_km} km)</span>
                  <span className="font-medium text-slate-900">₱{(ride.actual_distance_km * 8).toFixed(2)}</span>
                </div>
              )}
              {ride.actual_duration_minutes && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Duration ({ride.actual_duration_minutes} min)</span>
                  <span className="font-medium text-slate-900">₱{(ride.actual_duration_minutes * 0.5).toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-slate-300 pt-2 flex justify-between items-center font-bold text-lg">
                <span className="text-slate-900">Subtotal</span>
                <span className="text-green-600">₱{basePrice.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Tip Section */}
          <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg p-4 border border-blue-200 space-y-3">
            <h3 className="font-semibold text-slate-900">Add a Tip</h3>
            <p className="text-sm text-slate-600">Help your driver get rewarded for great service</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleTip(50)}
                className={`py-2 rounded-lg font-semibold transition-colors text-sm ${
                  tipAmount === 50
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-300 text-slate-900 hover:border-blue-500'
                }`}
              >
                ₱50
              </button>
              <button
                onClick={() => handleTip(100)}
                className={`py-2 rounded-lg font-semibold transition-colors text-sm ${
                  tipAmount === 100
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-300 text-slate-900 hover:border-blue-500'
                }`}
              >
                ₱100
              </button>
              <button
                onClick={() => handleTip(200)}
                className={`py-2 rounded-lg font-semibold transition-colors text-sm ${
                  tipAmount === 200
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-300 text-slate-900 hover:border-blue-500'
                }`}
              >
                ₱200
              </button>
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900">Payment Method</h3>
            <div className="space-y-2">
              {paymentMethods.map(method => (
                <label
                  key={method.id}
                  className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors ${
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
                    onChange={(e) => setSelectedPayment(e.target.value)}
                    disabled={!method.available}
                    className="w-4 h-4"
                  />
                  <span className="ml-3 font-medium text-slate-900">{method.name}</span>
                  {!method.available && (
                    <span className="ml-auto text-xs text-slate-500">Coming Soon</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Total Amount */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-300">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-700 font-medium">Total Amount to Pay</span>
              <span className="text-3xl font-bold text-green-600">₱{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Promo Code */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900">Promo Code (Optional)</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter promo code"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <button className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium transition-colors text-sm">
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 space-y-3">
          <button
            onClick={handlePayment}
            disabled={loading}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold transition-colors disabled:bg-slate-400 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {loading ? 'Processing...' : `Pay ₱${totalAmount.toFixed(2)}`}
          </button>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
