import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { paymentTransferService } from '../lib/paymentTransferService'
import { formatNumber, getCurrencySymbol } from '../lib/currency'

export default function DynamicCheckoutPage() {
  const [searchParams] = useSearchParams()
  const transferId = searchParams.get('transferId') || searchParams.get('id')
  
  const [transfer, setTransfer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  
  const [step, setStep] = useState(1) // 1: review, 2: confirmation
  const [confirmPassword, setConfirmPassword] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('wallet')
  const [notes, setNotes] = useState('')
  
  useEffect(() => {
    loadTransferAndUser()
  }, [transferId])
  
  const loadTransferAndUser = async () => {
    try {
      setLoading(true)
      setError(null)
      
      if (!transferId) {
        setError('No transfer ID provided')
        return
      }
      
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        setError('Please sign in to view this payment')
        return
      }
      setCurrentUser(user)
      
      // Get transfer details
      const { data: transferData, error: transferError } = await supabase
        .from('transfers')
        .select(`
          *,
          from_user:from_user_id(id, email, full_name),
          to_user:to_user_id(id, email, full_name),
          from_wallet:from_wallet_id(id, currency_code, balance),
          to_wallet:to_wallet_id(id, currency_code, balance)
        `)
        .eq('id', transferId)
        .single()
      
      if (transferError) {
        setError('Transfer not found')
        return
      }
      
      // Check if current user is the recipient
      if (transferData.to_user_id !== user.id && transferData.from_user_id !== user.id) {
        setError('You do not have permission to view this payment')
        return
      }
      
      // Check if transfer is not completed
      if (transferData.status === 'completed') {
        setSuccess(true)
      }
      
      setTransfer(transferData)
    } catch (err) {
      console.error('Error loading transfer:', err)
      setError(err.message || 'Failed to load transfer details')
    } finally {
      setLoading(false)
    }
  }
  
  const handleCompleteTransfer = async () => {
    try {
      setError('')
      setSubmitting(true)
      
      if (!transfer) {
        setError('Transfer not found')
        return
      }
      
      // Check if user is the recipient
      if (transfer.to_user_id !== currentUser?.id) {
        setError('Only the payment recipient can confirm this transfer')
        return
      }
      
      // Complete the transfer
      const result = await paymentTransferService.completeTransfer(transfer.id, {
        payment_method: paymentMethod,
        notes: notes,
        confirmed_by: currentUser.id,
        confirmed_at: new Date().toISOString()
      })
      
      if (result.success) {
        setSuccess(true)
        setTransfer(result.transfer)
      } else {
        setError('Failed to complete transfer')
      }
    } catch (err) {
      console.error('Error completing transfer:', err)
      setError(err.message || 'Failed to process payment')
    } finally {
      setSubmitting(false)
    }
  }
  
  const getCurrencySymbol = (code) => {
    const symbolMap = {
      'PHP': '₱',
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'CNY': '¥',
      'INR': '₹',
      'BRL': 'R$',
      'AUD': 'A$'
    }
    return symbolMap[code] || code
  }
  
  // LOADING STATE
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8">
        <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-md w-full text-center space-y-4">
          <div className="inline-block">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
          </div>
          <p className="text-slate-600 font-medium">Loading payment details...</p>
        </div>
      </div>
    )
  }
  
  // ERROR STATE
  if (error && !transfer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center px-4 py-8">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center space-y-4">
          <div className="inline-block w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-3xl">⚠</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Error</h2>
          <p className="text-slate-600">{error}</p>
          <a
            href="/"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Go Home
          </a>
        </div>
      </div>
    )
  }
  
  // SUCCESS STATE
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center px-4 py-8">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center space-y-4">
          <div className="inline-block w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
            <span className="text-5xl">✓</span>
          </div>
          <h2 className="text-3xl font-bold text-slate-900">Payment Completed!</h2>
          <p className="text-slate-600">
            {transfer && (
              <>
                {formatNumber(transfer.recipient_amount)} {transfer.recipient_currency} has been received from {transfer.from_user?.full_name || transfer.from_user?.email}
              </>
            )}
          </p>
          <div className="pt-4 border-t border-slate-200 space-y-3">
            {transfer && (
              <>
                <div className="text-sm text-slate-600">
                  <span className="font-medium">Transaction ID:</span>
                  <div className="font-mono text-xs text-slate-500 mt-1 break-all">{transfer.id}</div>
                </div>
                <div className="text-sm text-slate-600">
                  <span className="font-medium">Completed:</span>
                  <div className="text-slate-500">{new Date(transfer.completed_at).toLocaleString()}</div>
                </div>
              </>
            )}
          </div>
          <a
            href="/"
            className="inline-block px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium"
          >
            Back Home
          </a>
        </div>
      </div>
    )
  }
  
  // CHECKOUT FLOW
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Payment Checkout</h1>
          <p className="text-slate-600">Step {step} of 2</p>
        </div>
        
        {/* Progress Bar */}
        <div className="mb-8 flex gap-2">
          <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
          <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
        </div>
        
        {/* Main Content */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Left: Payment Summary */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl p-6 sticky top-6 space-y-4">
              <h3 className="font-bold text-slate-900 text-lg">Payment Summary</h3>
              
              {transfer && (
                <div className="space-y-4">
                  {/* From */}
                  <div>
                    <div className="text-sm text-slate-600 mb-1">From</div>
                    <div className="font-semibold text-slate-900">
                      {transfer.from_user?.full_name || transfer.from_user?.email}
                    </div>
                  </div>
                  
                  {/* To */}
                  <div>
                    <div className="text-sm text-slate-600 mb-1">To</div>
                    <div className="font-semibold text-slate-900">
                      {transfer.to_user?.full_name || transfer.to_user?.email}
                    </div>
                  </div>
                  
                  <div className="border-t border-slate-200"></div>
                  
                  {/* Amount */}
                  <div>
                    <div className="text-sm text-slate-600 mb-1">Amount</div>
                    <div className="text-3xl font-bold text-blue-600">
                      {getCurrencySymbol(transfer.recipient_currency)}{formatNumber(transfer.recipient_amount)}
                    </div>
                  </div>
                  
                  {/* Exchange Rate */}
                  {transfer.sender_currency !== transfer.recipient_currency && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-xs text-slate-600 mb-1">Exchange Rate</div>
                      <div className="text-sm font-medium text-slate-900">
                        1 {transfer.sender_currency} = {formatNumber(transfer.exchange_rate)} {transfer.recipient_currency}
                      </div>
                      <div className="text-xs text-slate-600 mt-2">
                        Sender paid: {getCurrencySymbol(transfer.sender_currency)}{formatNumber(transfer.sender_amount)}
                      </div>
                    </div>
                  )}
                  
                  {/* Description */}
                  {transfer.description && (
                    <div>
                      <div className="text-sm text-slate-600 mb-1">Description</div>
                      <div className="text-sm text-slate-900">{transfer.description}</div>
                    </div>
                  )}
                  
                  {/* Status */}
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="text-xs text-slate-600">Status</div>
                    <div className="text-sm font-semibold text-yellow-700 capitalize">
                      {transfer.status}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Right: Checkout Form */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}
              
              {/* STEP 1: REVIEW */}
              {step === 1 && transfer && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">Confirm Payment Details</h2>
                    <p className="text-slate-600 mb-6">
                      Please review the payment details below and confirm to proceed.
                    </p>
                  </div>
                  
                  {/* Payment Details Summary */}
                  <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                    <div className="flex justify-between">
                      <span className="text-slate-600">From:</span>
                      <span className="font-semibold text-slate-900">
                        {transfer.from_user?.full_name || transfer.from_user?.email}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">To:</span>
                      <span className="font-semibold text-slate-900">
                        {transfer.to_user?.full_name || transfer.to_user?.email}
                      </span>
                    </div>
                    <div className="border-t border-slate-200"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Amount:</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {getCurrencySymbol(transfer.recipient_currency)}{formatNumber(transfer.recipient_amount)}
                      </span>
                    </div>
                    {transfer.description && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Purpose:</span>
                        <span className="text-slate-900">{transfer.description}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Confirmation */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-slate-700">
                      By confirming, you acknowledge receiving this payment of{' '}
                      <span className="font-bold text-blue-600">
                        {getCurrencySymbol(transfer.recipient_currency)}{formatNumber(transfer.recipient_amount)}
                      </span>{' '}
                      from{' '}
                      <span className="font-semibold">
                        {transfer.from_user?.full_name || transfer.from_user?.email}
                      </span>
                      .
                    </p>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4 border-t border-slate-200">
                    <button
                      onClick={() => window.history.back()}
                      className="flex-1 px-6 py-3 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setStep(2)}
                      className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}
              
              {/* STEP 2: CONFIRMATION */}
              {step === 2 && transfer && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Finalize Payment</h2>
                    <p className="text-slate-600">Confirm and complete this payment transfer</p>
                  </div>
                  
                  {/* Payment Method */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Payment Method</label>
                    <div className="space-y-2">
                      <label className="flex items-center p-3 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer transition">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="wallet"
                          checked={paymentMethod === 'wallet'}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="mr-3"
                        />
                        <div>
                          <div className="font-medium text-slate-900">Wallet Transfer</div>
                          <div className="text-sm text-slate-600">Instant transfer from your wallet</div>
                        </div>
                      </label>
                      <label className="flex items-center p-3 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer transition">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="bank"
                          checked={paymentMethod === 'bank'}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="mr-3"
                        />
                        <div>
                          <div className="font-medium text-slate-900">Bank Transfer</div>
                          <div className="text-sm text-slate-600">Transfer to your bank account</div>
                        </div>
                      </label>
                    </div>
                  </div>
                  
                  {/* Additional Notes */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Notes (Optional)</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any additional notes or references..."
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows="3"
                    ></textarea>
                  </div>
                  
                  {/* Final Confirmation */}
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-slate-700">
                      You are confirming receipt of{' '}
                      <span className="font-bold text-yellow-700">
                        {getCurrencySymbol(transfer.recipient_currency)}{formatNumber(transfer.recipient_amount)}
                      </span>
                      . This action cannot be undone.
                    </p>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4 border-t border-slate-200">
                    <button
                      onClick={() => setStep(1)}
                      disabled={submitting}
                      className="flex-1 px-6 py-3 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold transition disabled:opacity-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleCompleteTransfer}
                      disabled={submitting}
                      className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-300 font-semibold transition"
                    >
                      {submitting ? 'Processing...' : 'Confirm & Complete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
