import { useState, useEffect } from 'react'
import { paymentsService } from '../../lib/paymentsService'

export default function PaymentsSettings({
  merchant,
  merchants,
  userId,
  onCreateMerchant,
  onUpdateMerchant,
  onMerchantsUpdated
}) {
  const [showCreateMerchant, setShowCreateMerchant] = useState(false)
  const [editingMerchant, setEditingMerchant] = useState(null)
  const [formData, setFormData] = useState({
    merchant_name: '',
    description: '',
    logo_url: '',
    default_settlement_currency: 'PHP'
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (editingMerchant) {
      setFormData({
        merchant_name: editingMerchant.merchant_name,
        description: editingMerchant.description || '',
        logo_url: editingMerchant.logo_url || '',
        default_settlement_currency: editingMerchant.default_settlement_currency || 'PHP'
      })
    } else if (!showCreateMerchant) {
      setFormData({
        merchant_name: '',
        description: '',
        logo_url: '',
        default_settlement_currency: 'PHP'
      })
    }
  }, [editingMerchant, showCreateMerchant])

  const handleCreateMerchant = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      await onCreateMerchant(formData)
      setShowCreateMerchant(false)
      setFormData({
        merchant_name: '',
        description: '',
        logo_url: '',
        default_settlement_currency: 'PHP'
      })
    } catch (err) {
      console.error('Error creating merchant:', err)
      alert('Failed to create merchant')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateMerchant = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      await onUpdateMerchant(editingMerchant.id, formData)
      setEditingMerchant(null)
    } catch (err) {
      console.error('Error updating merchant:', err)
      alert('Failed to update merchant')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setShowCreateMerchant(false)
    setEditingMerchant(null)
    setFormData({
      merchant_name: '',
      description: '',
      logo_url: '',
      default_settlement_currency: 'PHP'
    })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-light text-slate-900">Merchant Settings</h3>
        {!showCreateMerchant && !editingMerchant && (
          <button
            onClick={() => setShowCreateMerchant(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            + New Merchant Account
          </button>
        )}
      </div>

      {/* Create/Edit Merchant Form */}
      {(showCreateMerchant || editingMerchant) && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h4 className="text-lg font-semibold text-slate-900 mb-4">
            {editingMerchant ? 'Edit Merchant Account' : 'Create New Merchant Account'}
          </h4>
          <form onSubmit={editingMerchant ? handleUpdateMerchant : handleCreateMerchant} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Merchant Name *</label>
              <input
                type="text"
                value={formData.merchant_name}
                onChange={(e) => setFormData({ ...formData, merchant_name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="My Store"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Tell customers about your business"
                rows="3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Logo URL</label>
              <input
                type="url"
                value={formData.logo_url}
                onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="https://example.com/logo.png"
              />
              {formData.logo_url && (
                <img
                  src={formData.logo_url}
                  alt="Logo preview"
                  className="mt-2 h-16 w-16 object-cover rounded"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Default Settlement Currency</label>
              <select
                value={formData.default_settlement_currency}
                onChange={(e) => setFormData({ ...formData, default_settlement_currency: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="PHP">Philippine Peso (PHP)</option>
                <option value="USD">US Dollar (USD)</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="GBP">British Pound (GBP)</option>
                <option value="JPY">Japanese Yen (JPY)</option>
              </select>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : (editingMerchant ? 'Update Merchant' : 'Create Merchant')}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Merchants List */}
      <div>
        <h4 className="text-lg font-semibold text-slate-900 mb-4">Your Merchant Accounts</h4>
        {merchants.length === 0 ? (
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-8 text-center">
            <p className="text-slate-600 mb-4">No merchant accounts yet</p>
            {!showCreateMerchant && (
              <button
                onClick={() => setShowCreateMerchant(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Create Your First Merchant Account
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {merchants.map(m => (
              <div
                key={m.id}
                className={`rounded-lg border p-6 transition-all ${
                  merchant?.id === m.id
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-white border-slate-200 hover:shadow-md'
                }`}
              >
                {m.logo_url && (
                  <img
                    src={m.logo_url}
                    alt={m.merchant_name}
                    className="h-12 w-12 object-cover rounded mb-3"
                  />
                )}
                <h5 className="text-lg font-semibold text-slate-900">{m.merchant_name}</h5>
                {m.description && (
                  <p className="text-sm text-slate-600 mt-2">{m.description}</p>
                )}
                <p className="text-xs text-slate-500 mt-3">
                  <span className="font-medium">Settlement Currency:</span> {m.default_settlement_currency}
                </p>
                <p className="text-xs text-slate-500">
                  <span className="font-medium">Created:</span> {new Date(m.created_at).toLocaleDateString()}
                </p>

                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => setEditingMerchant(m)}
                    className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                  >
                    Edit
                  </button>
                  {merchant?.id !== m.id && (
                    <button
                      onClick={() => {
                        // Switch merchant context
                        window.location.reload()
                      }}
                      className="flex-1 px-3 py-2 text-sm bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
                    >
                      Switch
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Integration Info */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
        <h4 className="text-lg font-semibold text-blue-900 mb-3">API Integration</h4>
        <p className="text-sm text-blue-800 mb-4">
          Integrate Payments API directly into your applications using your merchant ID.
        </p>
        {merchant && (
          <div className="bg-white rounded p-3 font-mono text-xs text-slate-600 break-all">
            Merchant ID: {merchant.id}
          </div>
        )}
        <p className="text-xs text-blue-700 mt-3">
          📚 See API documentation for integration examples (coming soon)
        </p>
      </div>

      {/* Security Info */}
      <div className="bg-amber-50 rounded-lg border border-amber-200 p-6">
        <h4 className="text-lg font-semibold text-amber-900 mb-3">Security & Compliance</h4>
        <ul className="text-sm text-amber-800 space-y-2">
          <li>✓ All transactions are encrypted with SSL/TLS</li>
          <li>✓ PCI DSS compliant payment processing</li>
          <li>✓ Real-time fraud detection and prevention</li>
          <li>✓ Regular security audits and penetration testing</li>
          <li>✓ GDPR compliant data handling</li>
        </ul>
      </div>
    </div>
  )
}
