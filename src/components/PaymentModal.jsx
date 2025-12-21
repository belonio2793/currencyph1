import React, { useState } from 'react'
import { useDevice } from '../context/DeviceContext'
import ExpandableModal from './ExpandableModal'
import { formatNumber } from '../lib/currency'
import ResponsiveButton from './ResponsiveButton'

export default function PaymentModal({ ride, onClose, onCompletePayment, loading }) {
  const [selectedPayment, setSelectedPayment] = useState('wallet')
  const [tipAmount, setTipAmount] = useState(0)
  const [customTip, setCustomTip] = useState('')
  const { isMobile } = useDevice()

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

  const footer = (
    <div className="flex gap-2 w-full">
      <button
        onClick={onClose}
        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
      >
        Cancel
      </button>
      <button
        onClick={handlePayment}
        disabled={loading}
        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-400 font-medium"
      >
        {loading ? 'Processing...' : 'Complete Payment'}
      </button>
    </div>
  )

  return (
    <ExpandableModal
      isOpen={true}
      onClose={onClose}
      title="Payment"
      icon="💳"
      size={isMobile ? 'fullscreen' : 'sm'}
      footer={footer}
      defaultExpanded={!isMobile}
    >
      <div className="space-y-4">
        {/* Price Breakdown */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2">
          <h3 className="font-semibold text-sm text-slate-900 mb-3">Fare Details</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Base Fare</span>
              <span className="font-medium text-slate-900">₱{formatNumber(basePrice)}</span>
            </div>
            {ride.actual_distance_km && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">Distance ({ride.actual_distance_km} km)</span>
                <span className="font-medium text-slate-900">₱{formatNumber(ride.actual_distance_km * 8)}</span>
              </div>
            )}
            {ride.actual_duration_minutes && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">Duration ({ride.actual_duration_minutes} min)</span>
                <span className="font-medium text-slate-900">₱{formatNumber(ride.actual_duration_minutes * 0.5)}</span>
              </div>
            )}
            <div className="border-t border-slate-300 pt-1.5 flex justify-between items-center font-bold">
              <span className="text-slate-900 text-sm">Subtotal</span>
              <span className="text-green-600 text-base">₱{formatNumber(basePrice)}</span>
            </div>
          </div>
        </div>

        {/* Tip Section */}
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 space-y-2">
          <h3 className="font-semibold text-sm text-slate-900">Add a Tip</h3>
          <p className="text-xs text-slate-600">Help your driver get rewarded for great service</p>
          <div className="grid grid-cols-3 gap-2">
            {[50, 100, 200].map(amount => (
              <button
                key={amount}
                onClick={() => handleTip(amount)}
                className={`py-2 rounded-lg font-semibold transition-colors text-xs min-h-10 ${
                  tipAmount === amount
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-300 text-slate-900 hover:border-blue-500'
                }`}
              >
                ₱{amount}
              </button>
            ))}
          </div>
          <input
            type="number"
            placeholder="Custom tip amount"
            value={customTip}
            onChange={(e) => {
              setCustomTip(e.target.value)
              setTipAmount(0)
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Payment Method Selection */}
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-slate-900">Payment Method</h3>
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
                  onChange={() => setSelectedPayment(method.id)}
                  disabled={!method.available}
                  className="w-4 h-4 accent-blue-600 cursor-pointer"
                />
                <span className="ml-3 font-medium text-slate-900 text-sm">{method.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Total Amount */}
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-900 text-sm">Total Amount</span>
            <span className="text-xl font-bold text-green-600">₱{formatNumber(totalAmount)}</span>
          </div>
        </div>
      </div>
    </ExpandableModal>
  )
}
