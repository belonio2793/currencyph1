import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { formatNumber, getCurrencySymbol } from '../lib/currency'

export default function CheckoutPage() {
  const [searchParams] = useSearchParams()
  const transferId = searchParams.get('transferId')

  const [transfer, setTransfer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const [senderEmail, setSenderEmail] = useState('')
  const [paymentProof, setPaymentProof] = useState(null)

  useEffect(() => {
    loadTransferDetails()
  }, [transferId])

  const loadTransferDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!transferId) {
        setError('No transfer ID provided')
        return
      }

      const { data: transferData, error: transferError } = await supabase
        .from('transfers')
        .select('*')
        .eq('id', transferId)
        .single()

      if (transferError) {
        throw new Error(transferError.message)
      }

      if (!transferData) {
        setError('Transfer not found')
        return
      }

      setTransfer(transferData)
    } catch (err) {
      console.error('Error loading transfer:', err)
      setError(err.message || 'Failed to load transfer details')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitPayment = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      if (!senderEmail) {
        setError('Please enter your email address')
        return
      }

      // Update transfer status
      const { error: updateError } = await supabase
        .from('transfers')
        .update({
          status: 'completed',
          sender_email: senderEmail,
          payment_proof_url: paymentProof?.name || null,
          completed_at: new Date().toISOString()
        })
        .eq('id', transferId)

      if (updateError) {
        throw new Error(updateError.message)
      }

      // TODO: Record wallet transaction and update balances
      // This would involve:
      // 1. Creating a record in wallet_transactions
      // 2. Updating the balance in public.wallets
      // 3. Reversing the balance if payment is cancelled

      setSuccess(true)
    } catch (err) {
      console.error('Error submitting payment:', err)
      setError(err.message || 'Failed to process payment')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-slate-600">Loading payment details...</p>
        </div>
      </div>
    )
  }

  if (error && !transfer) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg border border-red-200 p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">!</div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Error</h2>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    )
  }

  if (!transfer) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg border border-slate-200 p-8 max-w-md w-full text-center">
          <p className="text-slate-600">Transfer not found</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center px-4">
        <div className="bg-white rounded-lg border border-emerald-200 p-8 max-w-md w-full text-center space-y-4">
          <div className="inline-block w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
            <span className="text-3xl font-bold text-emerald-600">✓</span>
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">Payment Received</h2>
          <p className="text-slate-600">Thank you! Your payment has been recorded.</p>
          <div className="pt-4 border-t border-slate-200">
            <p className="text-sm text-slate-600">
              Transaction ID: <span className="font-mono text-slate-900">{transfer.id}</span>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-light text-slate-900 mb-2">Payment Request</h1>
          <p className="text-slate-600">Complete your payment to settle this request</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Payment Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-slate-200 p-6 sm:p-8 space-y-6">
              {/* Transfer Details Summary */}
              <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Payment Details</h2>
                
                <div className="space-y-4">
                  {/* Amount */}
                  <div className="flex justify-between items-center pb-4 border-b border-blue-200">
                    <span className="text-slate-700">Amount</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {getCurrencySymbol(transfer.currency)}{formatNumber(transfer.amount)}
                    </span>
                  </div>

                  {/* From */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">Requested by</span>
                    <span className="text-slate-900 font-medium">
                      {transfer.guest_name || 'User'}
                    </span>
                  </div>

                  {/* Method */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">Payment Method</span>
                    <span className="text-slate-900 font-medium">
                      {transfer.method === 'gcash' && 'GCash'}
                      {transfer.method === 'bank' && 'Bank Transfer'}
                      {transfer.method === 'crypto' && transfer.crypto_network}
                    </span>
                  </div>

                  {/* Original Currency Conversion */}
                  {transfer.original_currency !== transfer.currency && (
                    <div className="flex justify-between items-center pt-4 border-t border-blue-200">
                      <span className="text-slate-700 text-sm">Conversion</span>
                      <span className="text-slate-900 font-medium text-sm">
                        {transfer.original_amount} {transfer.original_currency} @ {formatNumber(transfer.conversion_rate)}
                      </span>
                    </div>
                  )}

                  {/* Crypto Address */}
                  {transfer.crypto_address && (
                    <div className="pt-4 border-t border-blue-200">
                      <p className="text-sm font-medium text-slate-700 mb-2">Send to Address:</p>
                      <div className="bg-white rounded p-3 border border-slate-300">
                        <p className="text-xs font-mono text-slate-900 break-all">{transfer.crypto_address}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Form */}
              <form onSubmit={handleSubmitPayment} className="space-y-4">
                {/* Sender Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Your Email Address
                  </label>
                  <input
                    type="email"
                    value={senderEmail}
                    onChange={e => setSenderEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    required
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>

                {/* Payment Instructions */}
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <p className="text-sm text-amber-900 font-medium mb-2">Payment Instructions:</p>
                  <ol className="text-sm text-amber-800 space-y-2 list-decimal list-inside">
                    {transfer.method === 'gcash' && (
                      <>
                        <li>Open your GCash app</li>
                        <li>Go to Send Money</li>
                        <li>Enter the requested amount</li>
                        <li>Complete the transaction</li>
                      </>
                    )}
                    {transfer.method === 'bank' && (
                      <>
                        <li>Use your bank's app or online banking</li>
                        <li>Select fund transfer option</li>
                        <li>Enter the requested amount</li>
                        <li>Complete the transaction</li>
                      </>
                    )}
                    {transfer.method === 'crypto' && (
                      <>
                        <li>Open your crypto wallet</li>
                        <li>Select the appropriate network ({transfer.crypto_network})</li>
                        <li>Send the requested amount</li>
                        <li>Copy the address provided above</li>
                      </>
                    )}
                  </ol>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-emerald-600 text-white py-3 rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Processing...' : 'Confirm Payment Completed'}
                </button>
              </form>

              {/* Help Section */}
              <div className="border-t border-slate-200 pt-6">
                <p className="text-sm text-slate-600">
                  Having trouble? Contact support or ask the requester for assistance.
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar - Request Info */}
          <div className="space-y-6">
            {/* Request Summary */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">Request Summary</h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Amount Due:</span>
                  <span className="font-semibold text-slate-900">
                    {getCurrencySymbol(transfer.currency)}{formatNumber(transfer.amount)}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-slate-600">Status:</span>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    transfer.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-700'
                      : transfer.status === 'pending'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {transfer.status}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-600">Request ID:</span>
                  <span className="font-mono text-xs text-slate-700">{transfer.id.slice(0, 8)}...</span>
                </div>
              </div>
            </div>

            {/* Requester Info */}
            {transfer.guest_name && (
              <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-3">
                <h3 className="text-lg font-semibold text-slate-900">Requested by</h3>
                <div>
                  <p className="text-slate-900 font-medium">{transfer.guest_name}</p>
                  {transfer.guest_user_id && (
                    <p className="text-xs text-slate-600 mt-1">User ID: {transfer.guest_user_id.slice(0, 8)}</p>
                  )}
                </div>
              </div>
            )}

            {/* FAQ */}
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-6 space-y-3">
              <h3 className="font-semibold text-slate-900 text-sm">Need Help?</h3>
              <ul className="text-xs text-slate-600 space-y-2">
                <li>Check your {transfer.method === 'crypto' ? 'crypto wallet' : 'payment app'} for transaction confirmations</li>
                <li>Ensure you're sending the exact amount requested</li>
                <li>Contact the requester if you have questions</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
