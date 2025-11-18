import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { calculateDistance } from '../lib/rideCalculations'

export default function RidePayment({
  rideId,
  riderId,
  driverId,
  finalPrice,
  startCoord,
  endCoord,
  onPaymentComplete,
  paymentMethod = 'wallet'
}) {
  const [paymentStatus, setPaymentStatus] = useState('pending') // 'pending', 'processing', 'success', 'failed'
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(paymentMethod)
  const [tipAmount, setTipAmount] = useState(0)
  const [customTipAmount, setCustomTipAmount] = useState('')
  const [offerMode, setOfferMode] = useState(false)
  const [customOfferAmount, setCustomOfferAmount] = useState(finalPrice.toString())
  const [acceptingOffer, setAcceptingOffer] = useState(false)
  const [wallet, setWallet] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWallet()
  }, [riderId])

  const loadWallet = async () => {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', riderId)
        .eq('currency_code', 'PHP')
        .single()

      if (!error && data) {
        setWallet(data)
      }
    } catch (err) {
      console.warn('Could not load wallet:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleTipSelection = (amount) => {
    setTipAmount(amount)
    setCustomTipAmount('')
  }

  const handleCustomTip = () => {
    const amount = parseFloat(customTipAmount)
    if (!isNaN(amount) && amount > 0) {
      setTipAmount(amount)
    }
  }

  const processPayment = async () => {
    setPaymentStatus('processing')

    try {
      // Determine the actual payment amount
      const totalAmount = offerMode ? parseFloat(customOfferAmount) : finalPrice + tipAmount

      if (selectedPaymentMethod === 'wallet') {
        // Verify wallet has sufficient balance
        if (!wallet || wallet.balance < totalAmount) {
          setPaymentStatus('failed')
          return false
        }
      }

      // Create transaction record
      const { data: transaction, error: txError } = await supabase
        .from('ride_transactions')
        .insert({
          ride_id: rideId,
          transaction_type: 'fare_payment',
          amount: totalAmount,
          currency: 'PHP',
          from_user_id: riderId,
          to_user_id: driverId,
          payment_method: selectedPaymentMethod,
          status: 'completed',
          wallet_id: wallet?.id,
          description: `Payment for ride`
        })
        .select()

      if (txError) {
        setPaymentStatus('failed')
        return false
      }

      // Create tip transaction if applicable
      if (tipAmount > 0 && !offerMode) {
        await supabase
          .from('ride_transactions')
          .insert({
            ride_id: rideId,
            transaction_type: 'tip',
            amount: tipAmount,
            currency: 'PHP',
            from_user_id: riderId,
            to_user_id: driverId,
            payment_method: selectedPaymentMethod,
            status: 'completed',
            wallet_id: wallet?.id,
            description: 'Tip for driver'
          })
      }

      // Update ride with payment info
      const { error: updateError } = await supabase
        .from('rides')
        .update({
          payment_status: 'completed',
          final_price: totalAmount,
          tip_amount: tipAmount,
          rider_offered_amount: offerMode ? totalAmount : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', rideId)

      if (updateError) {
        setPaymentStatus('failed')
        return false
      }

      setPaymentStatus('success')
      onPaymentComplete?.(transaction[0])
      return true
    } catch (err) {
      console.error('Payment processing error:', err)
      setPaymentStatus('failed')
      return false
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 text-center">
        <p className="text-slate-600">Loading payment details...</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
      {/* Payment Success */}
      {paymentStatus === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div className="text-5xl mb-3">✓</div>
          <h3 className="text-lg font-semibold text-green-900 mb-2">Payment Successful</h3>
          <p className="text-sm text-green-700">Thank you for using our service</p>
        </div>
      )}

      {/* Payment Failed */}
      {paymentStatus === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-5xl mb-3">✗</div>
          <h3 className="text-lg font-semibold text-red-900 mb-2">Payment Failed</h3>
          <p className="text-sm text-red-700 mb-4">
            {selectedPaymentMethod === 'wallet' && wallet && wallet.balance < finalPrice
              ? 'Insufficient wallet balance'
              : 'An error occurred during payment'}
          </p>
          <button
            onClick={() => setPaymentStatus('pending')}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Normal Payment Flow */}
      {paymentStatus === 'pending' && (
        <>
          {/* Payment Method Selection */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Payment Method</h3>
            <div className="space-y-3">
              <label className="flex items-center p-4 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors" style={{ borderColor: selectedPaymentMethod === 'wallet' ? '#3B82F6' : '#E2E8F0' }}>
                <input
                  type="radio"
                  value="wallet"
                  checked={selectedPaymentMethod === 'wallet'}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="ml-3 text-sm font-medium text-slate-900">💰 Wallet</span>
                {wallet && (
                  <span className="ml-auto text-sm text-slate-600">Balance: ₱{wallet.balance?.toLocaleString()}</span>
                )}
              </label>

              <label className="flex items-center p-4 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors" style={{ borderColor: selectedPaymentMethod === 'cash' ? '#3B82F6' : '#E2E8F0' }}>
                <input
                  type="radio"
                  value="cash"
                  checked={selectedPaymentMethod === 'cash'}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="ml-3 text-sm font-medium text-slate-900">💵 Cash</span>
                <span className="ml-auto text-xs text-slate-600">Pay driver directly</span>
              </label>
            </div>
          </div>

          {/* Flexible Offer Section */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Offer Amount</h3>
            {!offerMode ? (
              <>
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <p className="text-sm text-slate-700 mb-2">Estimated fare: <span className="font-bold">₱{finalPrice.toLocaleString()}</span></p>
                  <button
                    onClick={() => setOfferMode(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Suggest a different amount →
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">Your Offer</label>
                <input
                  type="number"
                  value={customOfferAmount}
                  onChange={(e) => setCustomOfferAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  step="10"
                  min="0"
                />
                {parseFloat(customOfferAmount) < finalPrice && (
                  <p className="text-xs text-orange-600">
                    ⚠️ Drivers may decline offers below the estimated fare
                  </p>
                )}
                <button
                  onClick={() => setOfferMode(false)}
                  className="text-sm text-slate-600 hover:text-slate-900 font-medium"
                >
                  ← Back to estimated fare
                </button>
              </div>
            )}
          </div>

          {/* Tip Section */}
          {!offerMode && (
            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Add a Tip (Optional)</h3>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[0, 20, 50, 100].map(amount => (
                  <button
                    key={amount}
                    onClick={() => handleTipSelection(amount)}
                    className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                      tipAmount === amount
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    {amount === 0 ? 'No tip' : `₱${amount}`}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={customTipAmount}
                  onChange={(e) => setCustomTipAmount(e.target.value)}
                  placeholder="Custom amount"
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                />
                <button
                  onClick={handleCustomTip}
                  className="px-4 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 font-medium text-sm"
                >
                  Set
                </button>
              </div>
            </div>
          )}

          {/* Fare Summary */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Ride fare:</span>
              <span className="font-medium text-slate-900">₱{finalPrice.toLocaleString()}</span>
            </div>
            {tipAmount > 0 && !offerMode && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Tip:</span>
                <span className="font-medium text-slate-900">₱{tipAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="border-t border-blue-200 pt-2 flex justify-between">
              <span className="font-semibold text-slate-900">Total:</span>
              <span className="text-lg font-bold text-blue-600">
                ₱{(offerMode ? parseFloat(customOfferAmount) : finalPrice + tipAmount).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Payment Button */}
          <button
            onClick={processPayment}
            disabled={paymentStatus === 'processing'}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            {paymentStatus === 'processing' ? 'Processing...' : 'Confirm Payment'}
          </button>
        </>
      )}
    </div>
  )
}
