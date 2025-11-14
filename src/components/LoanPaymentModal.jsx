import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { currencyAPI } from '../lib/payments'

export default function LoanPaymentModal({ loan, userId, onClose, onSuccess, wallets }) {
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('wallet')
  const [selectedWallet, setSelectedWallet] = useState(wallets && wallets.length > 0 ? wallets[0].id : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(1) // 1: amount selection, 2: payment confirmation

  const maxPayment = Number(loan.remaining_balance || loan.total_owed)
  const phpWallet = wallets?.find(w => w.currency_code === 'PHP')

  const validateAmount = () => {
    const amount = parseFloat(paymentAmount)
    if (!amount || amount <= 0) {
      setError('Please enter a valid amount')
      return false
    }
    if (amount > maxPayment) {
      setError(`Maximum payment amount is ${maxPayment.toFixed(2)} ${loan.currency_code}`)
      return false
    }
    return true
  }

  const handlePayment = async (e) => {
    e.preventDefault()
    if (!validateAmount()) return

    if (step === 1) {
      setStep(2)
      return
    }

    try {
      setLoading(true)
      setError('')
      const amount = parseFloat(paymentAmount)

      if (paymentMethod === 'wallet' && selectedWallet) {
        // Deduct from wallet
        const wallet = wallets.find(w => w.id === selectedWallet)
        if (!wallet || wallet.balance < amount) {
          setError('Insufficient balance in selected wallet')
          return
        }

        // Record wallet transaction (withdrawal for loan payment)
        const { data: txData, error: txErr } = await supabase.rpc('record_wallet_transaction', {
          p_user_id: userId,
          p_wallet_id: wallet.id,
          p_transaction_type: 'withdrawal',
          p_amount: amount,
          p_currency_code: wallet.currency_code,
          p_description: `Loan payment for ${loan.id.slice(0, 8)}`,
          p_reference_id: loan.id
        })

        if (txErr) throw txErr

        // Record loan payment
        const { data: paymentData, error: paymentErr } = await supabase.rpc('process_loan_payment', {
          p_loan_id: loan.id,
          p_amount: amount,
          p_payment_method: 'wallet',
          p_payment_reference: wallet.id
        })

        if (paymentErr) throw paymentErr
      } else {
        // For Gcash/Crypto, just record the payment intent
        const { data: err } = await supabase
          .from('loan_payments')
          .insert([
            {
              loan_id: loan.id,
              user_id: userId,
              amount: amount,
              payment_method: paymentMethod,
              status: 'pending'
            }
          ])

        // Note: In production, this would trigger payment gateway flow (Gcash, Crypto, etc.)
        // For now, we're just recording the payment intent
      }

      onSuccess()
    } catch (err) {
      console.error('Payment error:', err)
      setError(err.message || 'Failed to process payment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            {step === 1 ? 'Enter Payment Amount' : 'Confirm Payment'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handlePayment} className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {step === 1 ? (
            <>
              {/* Loan Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Total Owed:</span>
                  <span className="font-medium text-slate-900">{Number(loan.total_owed).toFixed(2)} {loan.currency_code}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Already Paid:</span>
                  <span className="font-medium text-slate-900">{Number(loan.amount_paid || 0).toFixed(2)} {loan.currency_code}</span>
                </div>
                <div className="border-t border-slate-300 my-2"></div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Remaining Balance:</span>
                  <span className="font-bold text-lg text-red-600">{Number(maxPayment).toFixed(2)} {loan.currency_code}</span>
                </div>
              </div>

              {/* Payment Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Payment Amount *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="flex-1 px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                    step="0.01"
                    min="0"
                    max={maxPayment}
                  />
                  <div className="px-3 py-2 bg-slate-100 border-2 border-slate-300 rounded-lg flex items-center font-medium text-slate-700">
                    {loan.currency_code}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Maximum: {Number(maxPayment).toFixed(2)} {loan.currency_code}
                </p>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Payment Method *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                >
                  <option value="wallet">Wallet Balance</option>
                  <option value="gcash">GCash</option>
                  <option value="crypto">Cryptocurrency</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              {/* Wallet Selection */}
              {paymentMethod === 'wallet' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select Wallet
                  </label>
                  <select
                    value={selectedWallet}
                    onChange={(e) => setSelectedWallet(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  >
                    {wallets && wallets.map(wallet => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.currency_code} - {Number(wallet.balance).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Confirmation */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <p className="text-sm text-slate-600">You are about to pay</p>
                <p className="text-2xl font-bold text-blue-600">
                  {Number(paymentAmount).toFixed(2)} {loan.currency_code}
                </p>
                <div className="border-t border-blue-300 my-3"></div>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Payment Method:</span>
                    <span className="font-medium text-slate-900 capitalize">
                      {paymentMethod === 'wallet' ? `${wallets.find(w => w.id === selectedWallet)?.currency_code} Wallet` : paymentMethod}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">New Balance After:</span>
                    <span className="font-medium text-slate-900">
                      {Number(maxPayment - parseFloat(paymentAmount)).toFixed(2)} {loan.currency_code}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500 text-center py-2">
                Please review the details above before confirming your payment.
              </p>
            </>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 px-4 py-2 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`${step === 2 ? 'flex-1' : 'flex-1'} px-4 py-2 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`${step === 2 ? 'flex-1' : 'flex-1'} px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? 'Processing...' : step === 1 ? 'Review' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
