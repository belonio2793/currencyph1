import { useState, useEffect } from 'react'
import { paymentsService } from '../../lib/paymentsService'
import { currencyAPI } from '../../lib/payments'

export default function GuestCheckoutFlow({
  paymentLink,
  invoice,
  product,
  onSuccess,
  onCancel,
  userId,
  globalCurrency = 'PHP'
}) {
  const [step, setStep] = useState(userId ? 'payment-method' : 'guest-info') // guest-info, payment-method, confirm, deposit, success
  const [guestData, setGuestData] = useState({
    email: '',
    fullName: '',
    phone: ''
  })
  const [userWallets, setUserWallets] = useState([])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('wallet_balance')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const amount = invoice?.amount_due || paymentLink?.amount || 0
  const currency = invoice?.currency || paymentLink?.currency || globalCurrency

  useEffect(() => {
    if (userId) {
      loadUserWallets()
    }
  }, [userId])

  const loadUserWallets = async () => {
    try {
      const wallets = await currencyAPI.getWallets(userId)
      setUserWallets(wallets || [])
    } catch (err) {
      console.error('Error loading wallets:', err)
    }
  }

  const paymentMethods = [
    { id: 'wallet_balance', name: 'Wallet Balance', description: 'Pay using your account balance', authOnly: true },
    { id: 'bank_transfer', name: 'Bank Transfer', description: 'Transfer via online banking' },
    { id: 'credit_card', name: 'Credit/Debit Card', description: 'Visa, Mastercard, etc.' },
    { id: 'e_wallet', name: 'E-Wallet', description: 'GCash, PayMaya, etc.' },
    { id: 'crypto', name: 'Cryptocurrency', description: 'Bitcoin, Ethereum, etc.' }
  ]

  const filteredPaymentMethods = userId
    ? paymentMethods
    : paymentMethods.filter(m => !m.authOnly)

  useEffect(() => {
    if (!userId && selectedPaymentMethod === 'wallet_balance') {
      setSelectedPaymentMethod('bank_transfer')
    }
  }, [userId])

  const handleGuestInfoSubmit = async (e) => {
    e.preventDefault()
    setStep('payment-method')
  }

  const handleConfirmPayment = async () => {
    try {
      setLoading(true)
      setError(null)

      if (selectedPaymentMethod === 'wallet_balance') {
        const wallet = userWallets.find(w => w.currency_code === currency)
        if (!wallet || wallet.balance < amount) {
          throw new Error(`Insufficient balance in your ${currency} wallet`)
        }

        // Process wallet payment (no fees for wallet)
        await currencyAPI.withdrawFunds(userId, currency, amount)

        // Update invoice or record transaction
        if (invoice) {
          await paymentsService.markInvoicePaid(invoice.id)
        }

        setStep('success')
        return
      }

      // Calculate fees for the selected payment method
      const feeData = paymentsService.calculateFee(amount, selectedPaymentMethod)

      // Create payment intent for other methods
      const paymentIntent = await paymentsService.createPaymentIntent(
        invoice?.merchant_id || paymentLink?.merchant_id,
        {
          payer_id: userId || null,
          guest_email: userId ? null : guestData.email,
          guest_name: userId ? null : guestData.fullName,
          amount: amount,
          currency: currency,
          source_type: invoice ? 'invoice' : 'payment_link',
          reference_id: invoice?.id || paymentLink?.id,
          invoice_id: invoice?.id || null,
          payment_link_id: paymentLink?.id || null,
          onboarding_state: userId ? 'none' : 'pending',
          metadata: {
            payment_method: selectedPaymentMethod,
            fee_amount: feeData.feeAmount,
            net_amount: feeData.netAmount,
            fee_breakdown: feeData.breakdown
          }
        }
      )

      if (selectedPaymentMethod !== 'wallet_balance') {
        // Create deposit intent
        await paymentsService.createDepositIntent(
          userId || null,
          {
            amount: amount,
            currency: currency,
            deposit_method: selectedPaymentMethod,
            linked_payment_intent_id: paymentIntent.id,
            metadata: {
              fee_amount: feeData.feeAmount,
              net_amount: feeData.netAmount
            }
          }
        )
      }

      setStep('deposit')
    } catch (err) {
      console.error('Error processing payment:', err)
      setError(err.message || 'Failed to process payment. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDepositComplete = () => {
    setStep('success')
    if (onSuccess) {
      onSuccess()
    }
  }

  // Step 1: Guest Information
  if (step === 'guest-info') {
    return (
      <div className="space-y-6">
        {product && (
          <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
            {product.image_url && (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
            )}
            <h4 className="text-lg font-semibold text-slate-900">{product.name}</h4>
            {product.description && (
              <p className="text-slate-600 text-sm mt-2">{product.description}</p>
            )}
          </div>
        )}
        <div>
          <h3 className="text-2xl font-light text-slate-900 mb-2">Guest Checkout</h3>
          <p className="text-slate-600">
            No account needed. Provide your information to continue.
          </p>
        </div>

        <form onSubmit={handleGuestInfoSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              value={guestData.fullName}
              onChange={(e) => setGuestData({ ...guestData, fullName: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              value={guestData.email}
              onChange={(e) => setGuestData({ ...guestData, email: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="john@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number (Optional)</label>
            <input
              type="tel"
              value={guestData.phone}
              onChange={(e) => setGuestData({ ...guestData, phone: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="+63 9xx xxx xxxx"
            />
          </div>

          {/* Payment Amount Summary */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <p className="text-sm text-slate-600 mb-1">Amount to Pay</p>
            <p className="text-3xl font-light text-slate-900">
              {currency} {typeof amount === 'number' ? amount.toFixed(2) : '0.00'}
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
            >
              Continue to Payment
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-3 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    )
  }

  // Step 2: Select Payment Method
  if (step === 'payment-method') {
    return (
      <div className="space-y-6">
        {product && (
          <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
            {product.image_url && (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
            )}
            <h4 className="text-lg font-semibold text-slate-900">{product.name}</h4>
            {product.description && (
              <p className="text-slate-600 text-sm mt-2">{product.description}</p>
            )}
          </div>
        )}
        <div>
          <h3 className="text-2xl font-light text-slate-900 mb-2">Payment Method</h3>
          <p className="text-slate-600">
            Select how you'd like to pay {currency} {typeof amount === 'number' ? amount.toFixed(2) : '0.00'}
          </p>
        </div>

        <div className="space-y-3">
          {filteredPaymentMethods.map(method => {
            const isWallet = method.id === 'wallet_balance'
            const wallet = isWallet ? userWallets.find(w => w.currency_code === currency) : null
            const hasEnough = isWallet ? (wallet?.balance >= amount) : true

            return (
              <button
                key={method.id}
                onClick={() => setSelectedPaymentMethod(method.id)}
                disabled={isWallet && !hasEnough}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  selectedPaymentMethod === method.id
                    ? 'border-emerald-600 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                } ${isWallet && !hasEnough ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{method.name}</p>
                    <p className="text-sm text-slate-600">
                      {isWallet && wallet
                        ? `Balance: ${currency} ${wallet.balance.toFixed(2)}`
                        : method.description}
                    </p>
                    {isWallet && !hasEnough && (
                      <p className="text-xs text-red-600 mt-1">Insufficient balance</p>
                    )}
                  </div>
                  {selectedPaymentMethod === method.id && (
                    <svg className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleConfirmPayment}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50"
          >
            {loading ? 'Processing...' : (selectedPaymentMethod === 'wallet_balance' ? 'Pay Now' : 'Continue')}
          </button>
          {!userId && (
            <button
              onClick={() => setStep('guest-info')}
              className="flex-1 px-4 py-3 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 transition-colors"
            >
              Back
            </button>
          )}
        </div>
      </div>
    )
  }

  // Step 3: Deposit Instructions
  if (step === 'deposit') {
    const selectedMethod = paymentMethods.find(m => m.id === selectedPaymentMethod)

    const depositInstructions = {
      bank_transfer: {
        title: 'Bank Transfer',
        steps: [
          'Open your bank app or online banking portal',
          'Select "Transfer" or "Send Money"',
          'Enter our bank account details (will be provided)',
          `Enter amount: ${currency} ${typeof amount === 'number' ? amount.toFixed(2) : '0.00'}`,
          'Complete the transaction',
          'Your payment will be processed automatically'
        ]
      },
      credit_card: {
        title: 'Credit/Debit Card',
        steps: [
          'Your card details will be processed securely',
          'You will be redirected to the payment gateway',
          'Enter your card information',
          'Complete any required verification',
          'Your payment will be processed immediately'
        ]
      },
      e_wallet: {
        title: 'E-Wallet',
        steps: [
          'You will be redirected to your e-wallet app',
          'Approve the transaction',
          `Amount: ${currency} ${typeof amount === 'number' ? amount.toFixed(2) : '0.00'}`,
          'Complete the payment',
          'Your funds will be added to your account'
        ]
      },
      crypto: {
        title: 'Cryptocurrency',
        steps: [
          'A QR code with the payment address will be generated',
          'Scan with your crypto wallet',
          'Approve the transaction',
          'Once confirmed on the blockchain, your payment is complete',
          'You will receive a receipt immediately'
        ]
      }
    }

    const instructions = depositInstructions[selectedPaymentMethod]

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-light text-slate-900 mb-2">Complete Your Payment</h3>
          <p className="text-slate-600">
            Follow the steps below to deposit {currency} {typeof amount === 'number' ? amount.toFixed(2) : '0.00'} via {selectedMethod?.name}
          </p>
        </div>

        {/* Payment Instructions */}
        <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
          <h4 className="font-semibold text-blue-900 mb-4">How to {instructions.title}</h4>
          <ol className="space-y-3">
            {instructions.steps.map((step, index) => (
              <li key={index} className="flex gap-3">
                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-sm font-bold">
                  {index + 1}
                </span>
                <span className="text-blue-900">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Status Indicator */}
        <div className="bg-slate-50 rounded-lg p-6 border border-slate-200 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-3"></div>
          <p className="font-medium text-slate-900">Awaiting Payment</p>
          <p className="text-sm text-slate-600 mt-1">We're monitoring for your transaction...</p>
        </div>

        {/* Amount Summary */}
        <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
          <p className="text-sm text-emerald-700 mb-1">Total Amount</p>
          <p className="text-3xl font-light text-emerald-900">
            {currency} {typeof amount === 'number' ? amount.toFixed(2) : '0.00'}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleDepositComplete}
            className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
          >
            I've Completed the Payment
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // Step 4: Success
  if (step === 'success') {
    return (
      <div className="space-y-6 text-center">
        <div>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-2xl font-light text-slate-900 mb-2">Payment Received!</h3>
          <p className="text-slate-600">
            Thank you for your payment. A confirmation email has been sent to {guestData.email}
          </p>
        </div>

        <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
          <dl className="space-y-2 text-sm text-left">
            <div className="flex justify-between">
              <dt className="text-slate-600">Amount Paid:</dt>
              <dd className="font-bold text-emerald-600">
                {currency} {typeof amount === 'number' ? amount.toFixed(2) : '0.00'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Payer:</dt>
              <dd className="font-medium text-slate-900">{guestData.fullName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Date:</dt>
              <dd className="text-slate-900">{new Date().toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>

        <button
          onClick={onCancel}
          className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
        >
          Close
        </button>
      </div>
    )
  }
}
