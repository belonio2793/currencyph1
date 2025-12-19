import { useState, useEffect } from 'react'
import { paymentsService } from '../lib/paymentsService'
import PaymentsOverview from './Payments/PaymentsOverview'
import ProductsManager from './Payments/ProductsManager'
import PricingManager from './Payments/PricingManager'
import InvoicesManager from './Payments/InvoicesManager'
import PaymentLinksManager from './Payments/PaymentLinksManager'
import PaymentHistory from './Payments/PaymentHistory'
import PaymentAnalytics from './Payments/PaymentAnalytics'
import PaymentsSettings from './Payments/PaymentsSettings'

export default function Payments({ userId, userEmail, globalCurrency = 'PHP' }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [merchants, setMerchants] = useState([])
  const [selectedMerchant, setSelectedMerchant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (userId && !userId.includes('guest-local') && userId !== 'null' && userId !== 'undefined') {
      loadMerchants()
    } else {
      setError('Please sign in to access the Payments module')
      setLoading(false)
    }
  }, [userId])

  const loadMerchants = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await paymentsService.getMerchantsByUser(userId)
      setMerchants(data || [])
      if (data && data.length > 0) {
        setSelectedMerchant(data[0])
      }
    } catch (err) {
      let errorMessage = 'Unknown error'
      if (err instanceof Error) {
        errorMessage = err.message
      } else if (typeof err === 'object' && err !== null) {
        errorMessage = err?.message || err?.error_description || 'Failed to load merchants from database'
      } else if (typeof err === 'string') {
        errorMessage = err
      }
      console.error('Error loading merchants:', errorMessage, err)
      setError(`Failed to load merchants: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateMerchant = async (merchantData) => {
    try {
      const newMerchant = await paymentsService.createMerchant(userId, merchantData)
      setMerchants([newMerchant, ...merchants])
      setSelectedMerchant(newMerchant)
      return newMerchant
    } catch (err) {
      let errorMessage = 'Unknown error'
      if (err instanceof Error) {
        errorMessage = err.message
      } else if (typeof err === 'object' && err !== null) {
        errorMessage = err?.message || err?.error_description || 'Failed to create merchant'
      } else if (typeof err === 'string') {
        errorMessage = err
      }
      console.error('Error creating merchant:', errorMessage, err)
      throw new Error(errorMessage)
    }
  }

  const handleUpdateMerchant = async (merchantId, updates) => {
    try {
      const updated = await paymentsService.updateMerchant(merchantId, updates)
      setMerchants(merchants.map(m => m.id === merchantId ? updated : m))
      if (selectedMerchant?.id === merchantId) {
        setSelectedMerchant(updated)
      }
      return updated
    } catch (err) {
      let errorMessage = 'Unknown error'
      if (err instanceof Error) {
        errorMessage = err.message
      } else if (typeof err === 'object' && err !== null) {
        errorMessage = err?.message || err?.error_description || 'Failed to update merchant'
      } else if (typeof err === 'string') {
        errorMessage = err
      }
      console.error('Error updating merchant:', errorMessage, err)
      throw new Error(errorMessage)
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'history', label: 'Payment History' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'products', label: 'Products' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'payment-links', label: 'Payment Links' },
    { id: 'settings', label: 'Settings' }
  ]

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-light text-slate-900">Payments</h2>
            <p className="text-slate-600 mt-1">Accept and send payments globally with real-world currencies</p>
          </div>
        </div>

        {/* Merchant Selector */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">Active Merchant</label>
            {merchants.length === 0 ? (
              <p className="text-slate-600 text-sm">No merchants yet. Create one in Settings.</p>
            ) : (
              <select
                value={selectedMerchant?.id || ''}
                onChange={(e) => {
                  const merchant = merchants.find(m => m.id === e.target.value)
                  setSelectedMerchant(merchant)
                }}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                {merchants.map(merchant => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.merchant_name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-4 font-medium text-sm whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-4"></div>
              <p className="text-slate-600">Loading...</p>
            </div>
          </div>
        ) : error ? (
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        ) : !selectedMerchant ? (
          <div className="p-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-2">Welcome to Payments</h3>
              <p className="text-blue-800 mb-4">Create your first merchant account to start accepting payments.</p>
              <button
                onClick={() => setActiveTab('settings')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Merchant
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <PaymentsOverview
                merchant={selectedMerchant}
                userId={userId}
                globalCurrency={globalCurrency}
              />
            )}

            {activeTab === 'history' && (
              <PaymentHistory
                merchant={selectedMerchant}
                userId={userId}
                globalCurrency={globalCurrency}
              />
            )}

            {activeTab === 'products' && (
              <ProductsManager
                merchant={selectedMerchant}
                onRefresh={loadMerchants}
              />
            )}

            {activeTab === 'pricing' && (
              <PricingManager
                merchant={selectedMerchant}
                globalCurrency={globalCurrency}
              />
            )}

            {activeTab === 'invoices' && (
              <InvoicesManager
                merchant={selectedMerchant}
                userEmail={userEmail}
                globalCurrency={globalCurrency}
              />
            )}

            {activeTab === 'payment-links' && (
              <PaymentLinksManager
                merchant={selectedMerchant}
                globalCurrency={globalCurrency}
              />
            )}

            {activeTab === 'settings' && (
              <PaymentsSettings
                merchant={selectedMerchant}
                merchants={merchants}
                userId={userId}
                onCreateMerchant={handleCreateMerchant}
                onUpdateMerchant={handleUpdateMerchant}
                onMerchantsUpdated={loadMerchants}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
