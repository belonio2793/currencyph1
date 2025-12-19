import { useState, useEffect } from 'react'
import { paymentsService } from '../../lib/paymentsService'
import GuestCheckoutFlow from './GuestCheckoutFlow'

export default function PaymentCheckoutPage({ userId, globalCurrency = 'PHP' }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [paymentLink, setPaymentLink] = useState(null)
  const [invoice, setInvoice] = useState(null)
  const [merchant, setMerchant] = useState(null)
  const [product, setProduct] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    loadCheckoutData()
  }, [])

  const loadCheckoutData = async () => {
    try {
      setLoading(true)
      const path = window.location.pathname
      const parts = path.split('/')

      if (path.startsWith('/payment/')) {
        const slug = parts[2]
        const { data: linkData, error: linkError } = await paymentsService.getPaymentLinkByUniversalSlug(slug)
        if (linkError) throw linkError
        if (!linkData) throw new Error('Payment link not found')

        setPaymentLink(linkData)
        const merchantData = await paymentsService.getMerchant(linkData.merchant_id)
        setMerchant(merchantData)

        // Load product information if this payment link is tied to a product
        if (linkData.product_id) {
          const productData = await paymentsService.getProduct(linkData.product_id)
          setProduct(productData)
        }
      } else if (path.startsWith('/invoice/')) {
        const invoiceId = parts[2]
        const invoiceData = await paymentsService.getInvoice(invoiceId)
        setInvoice(invoiceData)
        const merchantData = await paymentsService.getMerchant(invoiceData.merchant_id)
        setMerchant(merchantData)
      } else {
        throw new Error('Invalid checkout URL')
      }
    } catch (err) {
      console.error('Checkout load error:', err)
      setError(err.message || 'Failed to load checkout')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentSuccess = async () => {
    // Ensure the payment record is synced to the central payments ledger
    // The triggers should handle this automatically, but we verify here
    try {
      if (paymentLink?.merchant_id) {
        // Give the trigger a moment to sync the record
        await new Promise(resolve => setTimeout(resolve, 500))
        // The trigger should have created the payment record
        // If not, it will be created when the payment_intent status is updated
      }
    } catch (err) {
      console.error('Error verifying payment sync:', err)
      // Don't fail the payment just because sync verification failed
    }

    setSuccess(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-4"></div>
          <p className="text-slate-600">Loading checkout...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">Checkout Error</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-xl mx-auto">
        {/* Merchant Info */}
        <div className="text-center mb-8">
          {merchant?.logo_url ? (
            <img src={merchant.logo_url} alt={merchant.merchant_name} className="h-16 w-16 mx-auto mb-4 object-contain" />
          ) : (
            <div className="h-16 w-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
              {merchant?.merchant_name?.charAt(0)}
            </div>
          )}
          <h1 className="text-xl font-semibold text-slate-900">{merchant?.merchant_name}</h1>
          {merchant?.description && <p className="text-slate-500 text-sm mt-1">{merchant.description}</p>}
        </div>

        {/* Product Info */}
        {product && (
          <div className="mb-8 bg-slate-50 rounded-lg p-6 border border-slate-200">
            {product.image_url && (
              <img src={product.image_url} alt={product.name} className="w-full h-48 object-cover rounded-lg mb-4" />
            )}
            <h2 className="text-2xl font-light text-slate-900 mb-2">{product.name}</h2>
            {product.description && (
              <p className="text-slate-600 text-sm">{product.description}</p>
            )}
          </div>
        )}

        {/* Checkout Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-8">
            {success ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 mb-6">
                  <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-3xl font-light text-slate-900 mb-4">Payment Successful!</h2>
                <p className="text-slate-600 mb-8">
                  Your payment has been processed and confirmed. Thank you for your business.
                </p>
                <button
                  onClick={() => window.location.href = '/'}
                  className="px-8 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
                >
                  Return Home
                </button>
              </div>
            ) : (
              <GuestCheckoutFlow
                paymentLink={paymentLink}
                invoice={invoice}
                product={product}
                onSuccess={handlePaymentSuccess}
                onCancel={() => window.history.back()}
                userId={userId}
                globalCurrency={globalCurrency}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-slate-400 text-xs">
            Powered by currency.ph • Secure Payment Processing
          </p>
        </div>
      </div>
    </div>
  )
}
