import { useState, useEffect } from 'react'
import { paymentsService } from '../../lib/paymentsService'
import GuestCheckoutFlow from './GuestCheckoutFlow'

export default function PaymentCheckoutPage({ userId, globalCurrency = 'PHP' }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [paymentLink, setPaymentLink] = useState(null)
  const [invoice, setInvoice] = useState(null)
  const [merchant, setMerchant] = useState(null)
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
        // We need a way to find the payment link without knowing merchant_id first
        // Or we update the service to search all merchants
        const { data, error: linkError } = await paymentsService.getPaymentLinkByUniversalSlug(slug)
        if (linkError) throw linkError
        if (!data) throw new Error('Payment link not found')
        
        setPaymentLink(data)
        const merchantData = await paymentsService.getMerchant(data.merchant_id)
        setMerchant(merchantData)
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

        {/* Checkout Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-8">
            <GuestCheckoutFlow
              paymentLink={paymentLink}
              invoice={invoice}
              onSuccess={() => setSuccess(true)}
              onCancel={() => window.history.back()}
              globalCurrency={globalCurrency}
            />
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
