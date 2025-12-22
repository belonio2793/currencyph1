import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import customPaymentService from '../lib/customPaymentService'
import { formatNumber, getCurrencySymbol } from '../lib/currency'

export default function CheckoutPage() {
  const [searchParams] = useSearchParams()
  const paymentCode = searchParams.get('code')
  const transferId = searchParams.get('transferId')

  const [paymentDetails, setPaymentDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [step, setStep] = useState(1) // 1: confirm, 2: payment, 3: success

  // Payment form state
  const [paymentReference, setPaymentReference] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [paidCurrency, setPaidCurrency] = useState('PHP')
  const [submitting, setSubmitting] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState('')

  useEffect(() => {
    loadPaymentDetails()
  }, [paymentCode, transferId])

  const loadPaymentDetails = async () => {
    try {
      setLoading(true)
      setError('')

      const details = await customPaymentService.getPaymentDetails(paymentCode, transferId)

      if (details.isExpired) {
        setError('This payment link has expired')
        setPaymentDetails(details)
        return
      }

      setPaymentDetails(details)
      setPaidAmount(details.transfer.amount)
      setPaidCurrency(details.transfer.currency)
    } catch (err) {
      console.error('Error loading payment details:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCompletePayment = async (e) => {
    e.preventDefault()
    setError('')

    if (!paymentReference && paymentDetails.transfer.payment_method !== 'crypto') {
      setError('Please enter a payment reference')
      return
    }

    if (!guestName) {
      setError('Please enter your name')
      return
    }

    setSubmitting(true)
    try {
      const result = await customPaymentService.processGuestPayment({
        transferId: paymentDetails.transfer.id,
        paidAmount: parseFloat(paidAmount),
        paidCurrency,
        paymentReference,
        guestEmail: guestEmail || paymentDetails.transfer.to_email,
        guestName,
        guestPhone
      })

      if (result.success) {
        setStep(3)
      }
    } catch (err) {
      console.error('Error processing payment:', err)
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyFeedback(label)
      setTimeout(() => setCopyFeedback(''), 2000)
    } catch (err) {
      setError('Could not copy to clipboard')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading payment details...</p>
        </div>
      </div>
    )
  }

  if (!paymentDetails || paymentDetails.isExpired) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="inline-block w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl">⏰</span>
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">Link Expired</h2>
          <p className="text-slate-600 mb-6">This payment link has expired or is no longer valid</p>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Payment Request</h1>
            {paymentDetails.senderInfo && (
              <p className="text-slate-600">
                Requested by <span className="font-medium">{paymentDetails.senderInfo.full_name}</span>
              </p>
            )}
          </div>
        </div>

        {/* Payment Details Card */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="text-center mb-6">
            <div className="text-5xl font-bold text-blue-600 mb-2">
              {getCurrencySymbol(paymentDetails.transfer.currency)}{formatNumber(paymentDetails.transfer.amount)}
            </div>
            <p className="text-slate-600">{paymentDetails.transfer.description}</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Confirm Payment */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-slate-700">Payment Method</p>
                <div className="text-slate-900 font-medium">
                  {paymentDetails.transfer.payment_method === 'gcash' && '💰 GCash'}
                  {paymentDetails.transfer.payment_method === 'bank' && '🏦 Bank Transfer'}
                  {paymentDetails.transfer.payment_method === 'crypto' && `₿ ${paymentDetails.transfer.crypto_network}`}
                </div>
              </div>

              {/* Crypto Address Display */}
              {paymentDetails.transfer.payment_method === 'crypto' && paymentDetails.depositAddresses && paymentDetails.depositAddresses.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-semibold text-orange-900">📬 Send {paymentDetails.transfer.crypto_network} to:</p>
                  {paymentDetails.depositAddresses.map((addr, idx) => (
                    <div key={idx} className="bg-white border border-orange-300 rounded p-3">
                      <div className="text-xs font-semibold text-slate-700 mb-2">Network: {addr.network}</div>
                      <div className="text-xs font-mono text-slate-900 break-all bg-slate-100 p-2 rounded mb-2">
                        {addr.address}
                      </div>
                      <button
                        onClick={() => copyToClipboard(addr.address, 'Copied!')}
                        className="w-full text-xs px-3 py-2 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
                      >
                        {copyFeedback === 'Copied!' ? '✓ Copied' : 'Copy Address'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setStep(2)}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Continue to Payment
              </button>
            </div>
          )}

          {/* Step 2: Payment Form */}
          {step === 2 && (
            <form onSubmit={handleCompletePayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Your Name *</label>
                <input
                  type="text"
                  required
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={e => setGuestEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                <input
                  type="tel"
                  value={guestPhone}
                  onChange={e => setGuestPhone(e.target.value)}
                  placeholder="+63 9XX XXX XXXX"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Amount Paid</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paidAmount}
                    onChange={e => setPaidAmount(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                  <select
                    value={paidCurrency}
                    onChange={e => setPaidCurrency(e.target.value)}
                    className="px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  >
                    <option value="PHP">PHP</option>
                    <option value="USD">USD</option>
                    <option value="BTC">BTC</option>
                    <option value="ETH">ETH</option>
                    <option value="USDT">USDT</option>
                    <option value="USDC">USDC</option>
                  </select>
                </div>
              </div>

              {paymentDetails.transfer.payment_method !== 'crypto' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Payment Reference *
                  </label>
                  <input
                    type="text"
                    required
                    value={paymentReference}
                    onChange={e => setPaymentReference(e.target.value)}
                    placeholder="e.g., Reference number or transaction ID"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="text-center space-y-6">
              <div className="inline-block w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-5xl">✓</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment Received!</h2>
                <p className="text-slate-600">Thank you for your payment. A confirmation has been sent.</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-600 mb-2">Amount:</p>
                <p className="text-2xl font-bold text-slate-900">
                  {getCurrencySymbol(paymentDetails.transfer.currency)}{formatNumber(paymentDetails.transfer.amount)}
                </p>
              </div>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Back to Home
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-slate-600">
          <p>This is a secure payment form. Your information is protected.</p>
        </div>
      </div>
    </div>
  )
}
