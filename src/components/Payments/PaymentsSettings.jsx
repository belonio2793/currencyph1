import { useState, useEffect } from 'react'
import { paymentsService } from '../../lib/paymentsService'
import { currencyAPI } from '../../lib/payments'

const SUPPORTED_CURRENCIES = [
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' }
]

export default function PaymentsSettings({
  merchant,
  merchants,
  userId,
  globalCurrency = 'PHP',
  setGlobalCurrency,
  onCreateMerchant,
  onUpdateMerchant,
  onMerchantsUpdated
}) {
  const [showCreateMerchant, setShowCreateMerchant] = useState(false)
  const [editingMerchant, setEditingMerchant] = useState(null)
  const [userBusinesses, setUserBusinesses] = useState([])
  const [exchangeRates, setExchangeRates] = useState({})
  const [loadingRates, setLoadingRates] = useState(false)
  const [ratesError, setRatesError] = useState(null)
  const [lastRatesUpdate, setLastRatesUpdate] = useState(null)
  const [formData, setFormData] = useState({
    merchant_name: '',
    description: '',
    logo_url: '',
    default_settlement_currency: 'PHP',
    business_id: ''
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (userId) {
      loadUserBusinesses()
      loadExchangeRates()
      // Refresh rates every 5 minutes
      const ratesInterval = setInterval(loadExchangeRates, 5 * 60 * 1000)
      return () => clearInterval(ratesInterval)
    }
  }, [userId])

  const loadExchangeRates = async () => {
    try {
      setLoadingRates(true)
      setRatesError(null)
      const rates = await currencyAPI.getAllExchangeRates()
      setExchangeRates(rates || {})
      setLastRatesUpdate(new Date())
    } catch (err) {
      console.error('Error loading exchange rates:', err)
      setRatesError('Failed to load real-time exchange rates')
    } finally {
      setLoadingRates(false)
    }
  }

  const loadUserBusinesses = async () => {
    try {
      const businesses = await paymentsService.getUserBusinesses(userId)
      setUserBusinesses(businesses)
    } catch (err) {
      console.error('Error loading businesses:', err)
    }
  }

  useEffect(() => {
    if (editingMerchant) {
      setFormData({
        merchant_name: editingMerchant.merchant_name,
        description: editingMerchant.description || '',
        logo_url: editingMerchant.logo_url || '',
        default_settlement_currency: editingMerchant.default_settlement_currency || 'PHP',
        business_id: editingMerchant.business_id || ''
      })
    } else if (!showCreateMerchant) {
      setFormData({
        merchant_name: '',
        description: '',
        logo_url: '',
        default_settlement_currency: 'PHP',
        business_id: ''
      })
    }
  }, [editingMerchant, showCreateMerchant])

  const handleSelectBusiness = (businessId) => {
    const business = userBusinesses.find(b => b.id === businessId)
    if (business) {
      setFormData({
        ...formData,
        business_id: businessId,
        merchant_name: formData.merchant_name || business.business_name
      })
    } else {
      setFormData({ ...formData, business_id: '' })
    }
  }

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
              <label className="block text-sm font-medium text-slate-700 mb-1">Link to Registered Business (Optional)</label>
              <select
                value={formData.business_id}
                onChange={(e) => handleSelectBusiness(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">No business linked (Personal/Individual)</option>
                {userBusinesses.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.business_name} (TIN: {b.tin})
                  </option>
                ))}
              </select>
              {formData.business_id && (
                <p className="text-xs text-slate-500 mt-1">UUID: {formData.business_id}</p>
              )}
            </div>

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
                {m.business && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase rounded">Linked Business</span>
                    <span className="text-xs text-slate-500 truncate">{m.business.business_name}</span>
                  </div>
                )}
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

      {/* Currency Settings */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-slate-900">Currency Settings</h4>
          <button
            onClick={loadExchangeRates}
            disabled={loadingRates}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 transition-colors"
          >
            {loadingRates ? 'Updating...' : 'Refresh Rates'}
          </button>
        </div>

        {/* Global Currency Selection */}
        <div className="mb-6 pb-6 border-b border-slate-200">
          <label className="block text-sm font-medium text-slate-700 mb-2">Default Display Currency</label>
          <select
            value={globalCurrency}
            onChange={(e) => setGlobalCurrency && setGlobalCurrency(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {SUPPORTED_CURRENCIES.map(currency => (
              <option key={currency.code} value={currency.code}>
                {currency.symbol} {currency.code} - {currency.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">This currency will be used for all payment displays</p>
        </div>

        {/* Exchange Rates */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h5 className="font-semibold text-slate-900">Real-Time Exchange Rates</h5>
            {lastRatesUpdate && (
              <p className="text-xs text-slate-500">
                Updated: {lastRatesUpdate.toLocaleTimeString()}
              </p>
            )}
          </div>

          {ratesError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700">{ratesError}</p>
            </div>
          )}

          {loadingRates && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          )}

          {!loadingRates && Object.keys(exchangeRates).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SUPPORTED_CURRENCIES.map(currency => {
                const rate = exchangeRates[currency.code]
                return (
                  <div key={currency.code} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <h6 className="font-semibold text-slate-900">{currency.code}</h6>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        {currency.symbol}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mb-2">{currency.name}</p>
                    {rate ? (
                      <div className="bg-white rounded p-2 border border-slate-200">
                        <p className="text-sm font-mono text-slate-900">
                          1 {globalCurrency} = {typeof rate === 'number' ? rate.toFixed(4) : rate} {currency.code}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">Rate not available</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {!loadingRates && Object.keys(exchangeRates).length === 0 && !ratesError && (
            <div className="bg-slate-50 rounded-lg p-8 text-center border border-slate-200">
              <p className="text-slate-600 mb-3">No exchange rates loaded yet</p>
              <button
                onClick={loadExchangeRates}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Load Exchange Rates
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Security Info */}
      <div className="bg-amber-50 rounded-lg border border-amber-200 p-6">
        <h4 className="text-lg font-semibold text-amber-900 mb-3">Security & Compliance</h4>
        <ul className="text-sm text-amber-800 space-y-2">
          <li>All transactions are encrypted with SSL/TLS</li>
          <li>PCI DSS compliant payment processing</li>
          <li>Real-time fraud detection and prevention</li>
          <li>Regular security audits and penetration testing</li>
          <li>GDPR compliant data handling</li>
        </ul>
      </div>
    </div>
  )
}
