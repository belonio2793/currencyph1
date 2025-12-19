import { useState, useEffect } from 'react'
import { paymentsService } from '../../lib/paymentsService'

export default function PaymentLinksManager({ merchant, globalCurrency }) {
  const [paymentLinks, setPaymentLinks] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copiedLinkId, setCopiedLinkId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: '',
    currency: globalCurrency,
    expires_at: ''
  })

  useEffect(() => {
    if (merchant) {
      loadPaymentLinks()
    }
  }, [merchant])

  const loadPaymentLinks = async () => {
    try {
      setLoading(true)
      const data = await paymentsService.getPaymentLinksByMerchant(merchant.id)
      setPaymentLinks(data || [])
    } catch (err) {
      console.error('Error loading payment links:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      const newLink = await paymentsService.createPaymentLink(merchant.id, {
        name: formData.name,
        description: formData.description,
        amount: formData.amount ? parseFloat(formData.amount) : null,
        currency: formData.currency,
        expires_at: formData.expires_at || null
      })
      setPaymentLinks([newLink, ...paymentLinks])
      setFormData({
        name: '',
        description: '',
        amount: '',
        currency: globalCurrency,
        expires_at: ''
      })
      setShowCreateForm(false)
    } catch (err) {
      console.error('Error creating payment link:', err)
      alert('Failed to create payment link')
    }
  }

  const handleDelete = async (linkId) => {
    if (!confirm('Are you sure you want to delete this payment link?')) return

    try {
      await paymentsService.deletePaymentLink(linkId)
      setPaymentLinks(paymentLinks.filter(l => l.id !== linkId))
    } catch (err) {
      console.error('Error deleting payment link:', err)
      alert('Failed to delete payment link')
    }
  }

  const getPaymentLinkUrl = (link) => {
    const baseUrl = window.location.origin
    return `${baseUrl}/payment/${link.url_slug}`
  }

  const copyToClipboard = (text, linkId) => {
    navigator.clipboard.writeText(text)
    setCopiedLinkId(linkId)
    setTimeout(() => setCopiedLinkId(null), 2000)
  }

  const generateQRCodeUrl = (link) => {
    const url = getPaymentLinkUrl(link)
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-slate-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-light text-slate-900">Payment Links</h3>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            + New Payment Link
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h4 className="text-lg font-semibold text-slate-900 mb-4">Create New Payment Link</h4>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Link Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="e.g., Monthly Subscription"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="What is this payment link for?"
                rows="3"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fixed Amount (Optional)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Leave blank for custom amounts"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                <input
                  type="text"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="PHP"
                  maxLength="3"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expiration Date (Optional)</label>
              <input
                type="datetime-local"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Create Payment Link
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payment Links List */}
      <div>
        {paymentLinks.length === 0 ? (
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-8 text-center">
            <p className="text-slate-600 mb-4">No payment links yet</p>
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Create Your First Payment Link
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {paymentLinks.map(link => {
              const paymentUrl = getPaymentLinkUrl(link)
              return (
                <div key={link.id} className="bg-white rounded-lg border border-slate-200 p-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Link Details */}
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-slate-900">{link.name}</h4>
                      {link.description && (
                        <p className="text-slate-600 text-sm mt-1">{link.description}</p>
                      )}
                      <div className="mt-4 space-y-2">
                        {link.amount && (
                          <p className="text-sm text-slate-700">
                            <span className="font-medium">Amount:</span> {link.currency} {link.amount.toFixed(2)}
                          </p>
                        )}
                        <p className="text-sm text-slate-700">
                          <span className="font-medium">Created:</span> {new Date(link.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Link URL with Copy Button */}
                      <div className="mt-4 flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={paymentUrl}
                          className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded text-slate-700"
                        />
                        <button
                          onClick={() => copyToClipboard(paymentUrl, link.id)}
                          className={`px-3 py-2 text-sm rounded transition-colors ${
                            copiedLinkId === link.id
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {copiedLinkId === link.id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    {/* QR Code */}
                    <div className="flex flex-col items-center">
                      <p className="text-sm font-medium text-slate-700 mb-2">QR Code</p>
                      <img
                        src={generateQRCodeUrl(link)}
                        alt="QR Code"
                        className="w-32 h-32 border border-slate-300 rounded"
                      />
                      <a
                        href={generateQRCodeUrl(link)}
                        download={`payment-link-${link.id}.png`}
                        className="mt-2 text-xs text-blue-600 hover:text-blue-700 underline"
                      >
                        Download QR Code
                      </a>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => window.open(paymentUrl, '_blank')}
                        className="px-4 py-2 text-sm bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 transition-colors"
                      >
                        Visit Link
                      </button>
                      <button
                        onClick={() => copyToClipboard(paymentUrl, link.id)}
                        className="px-4 py-2 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                      >
                        Share
                      </button>
                      <button
                        onClick={() => handleDelete(link.id)}
                        className="px-4 py-2 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
