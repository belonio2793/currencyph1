import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { paymentsService } from '../lib/paymentsService'
import PaymentsOverview from './Payments/PaymentsOverview'
import PaymentHistory from './Payments/PaymentHistory'
import PaymentAnalytics from './Payments/PaymentAnalytics'
import ProductsManager from './Payments/ProductsManager'
import PricingManager from './Payments/PricingManager'
import InvoicesManager from './Payments/InvoicesManager'
import PaymentLinksManager from './Payments/PaymentLinksManager'
import PaymentsSettings from './Payments/PaymentsSettings'

const STATUS_COLORS = {
  succeeded: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
  pending: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800' },
  failed: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-800' },
  cancelled: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-800' },
  refunded: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' }
}

export default function PaymentsHub({ userId, userEmail, globalCurrency = 'PHP', setGlobalCurrency }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [payments, setPayments] = useState([])
  const [filteredPayments, setFilteredPayments] = useState([])
  const [merchants, setMerchants] = useState([])
  const [selectedMerchant, setSelectedMerchant] = useState(null)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    method: 'all',
    sortBy: 'date-desc',
    searchRef: ''
  })
  const [pagination, setPagination] = useState({
    currentPage: 1,
    itemsPerPage: 25
  })

  // Load payments and merchants
  useEffect(() => {
    if (userId && !userId.includes('guest-local')) {
      Promise.all([loadPayments(), loadMerchants()]).catch(err => console.error('Error initializing:', err))
    } else {
      setError('Please sign in to access payments')
      setLoading(false)
    }
  }, [userId])

  // Apply filters when payments or filters change
  useEffect(() => {
    applyFilters()
  }, [payments, filters])

  const loadPayments = async () => {
    try {
      const { data, error: queryError } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })

      if (queryError) throw queryError
      setPayments(data || [])
      return data || []
    } catch (err) {
      console.error('Error loading payments:', err)
      setError('Failed to load payments')
      return []
    }
  }

  const loadMerchants = async () => {
    try {
      setLoading(true)
      const data = await paymentsService.getMerchantsByUser(userId)
      setMerchants(data || [])
      if (data && data.length > 0) {
        setSelectedMerchant(data[0])
      }
    } catch (err) {
      console.error('Error loading merchants:', err)
      setError('Failed to load merchants')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...payments]

    if (filters.status !== 'all') {
      filtered = filtered.filter(p => p.status === filters.status)
    }

    if (filters.type !== 'all') {
      filtered = filtered.filter(p => p.payment_type === filters.type)
    }

    if (filters.method !== 'all') {
      filtered = filtered.filter(p => p.payment_method === filters.method)
    }

    if (filters.searchRef.trim()) {
      const search = filters.searchRef.toLowerCase()
      filtered = filtered.filter(p =>
        (p.reference_number?.toLowerCase().includes(search)) ||
        (p.guest_name?.toLowerCase().includes(search)) ||
        (p.guest_email?.toLowerCase().includes(search)) ||
        (p.description?.toLowerCase().includes(search))
      )
    }

    if (filters.sortBy === 'date-desc') {
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    } else if (filters.sortBy === 'date-asc') {
      filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    } else if (filters.sortBy === 'amount-desc') {
      filtered.sort((a, b) => Number(b.amount) - Number(a.amount))
    } else if (filters.sortBy === 'amount-asc') {
      filtered.sort((a, b) => Number(a.amount) - Number(b.amount))
    }

    setFilteredPayments(filtered)
    setPagination({ ...pagination, currentPage: 1 })
  }

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value })
  }

  const handleCreateMerchant = async (merchantData) => {
    try {
      const newMerchant = await paymentsService.createMerchant(userId, merchantData)
      setMerchants([newMerchant, ...merchants])
      setSelectedMerchant(newMerchant)
      return newMerchant
    } catch (err) {
      throw err
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
      throw err
    }
  }

  const totalPages = Math.ceil(filteredPayments.length / pagination.itemsPerPage)
  const startIdx = (pagination.currentPage - 1) * pagination.itemsPerPage
  const endIdx = startIdx + pagination.itemsPerPage
  const paginatedPayments = filteredPayments.slice(startIdx, endIdx)

  const uniqueStatuses = [...new Set(payments.map(p => p.status))].filter(Boolean)
  const uniqueTypes = [...new Set(payments.map(p => p.payment_type))].filter(Boolean)
  const uniqueMethods = [...new Set(payments.map(p => p.payment_method))].filter(Boolean)

  const summary = {
    total: filteredPayments.length,
    succeeded: filteredPayments.filter(p => p.status === 'succeeded').length,
    pending: filteredPayments.filter(p => p.status === 'pending').length,
    failed: filteredPayments.filter(p => p.status === 'failed').length,
    totalAmount: filteredPayments
      .filter(p => p.status === 'succeeded')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0),
    totalFees: filteredPayments
      .filter(p => p.status === 'succeeded')
      .reduce((sum, p) => sum + Number(p.fee_amount || 0), 0),
    netRevenue: filteredPayments
      .filter(p => p.status === 'succeeded')
      .reduce((sum, p) => sum + Number(p.net_amount || p.amount - (p.fee_amount || 0)), 0)
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

  if (loading && activeTab === 'overview') {
    return (
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-slate-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6">
        <div className="mb-6">
          <h2 className="text-3xl font-light text-slate-900">Payments</h2>
          <p className="text-slate-600 mt-1">Accept and send payments globally with real-world currencies</p>
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
        {error && (
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {activeTab === 'overview' && (
          <PaymentsOverview
            merchant={selectedMerchant}
            userId={userId}
            globalCurrency={globalCurrency}
          />
        )}

        {activeTab === 'history' && (
          selectedMerchant ? (
            <PaymentHistory
              merchant={selectedMerchant}
              userId={userId}
              globalCurrency={globalCurrency}
            />
          ) : (
            <div className="p-6">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
                <p className="text-slate-600">Select a merchant to view payment history</p>
              </div>
            </div>
          )
        )}

        {activeTab === 'analytics' && (
          selectedMerchant ? (
            <PaymentAnalytics
              merchant={selectedMerchant}
              userId={userId}
              globalCurrency={globalCurrency}
            />
          ) : (
            <div className="p-6">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
                <p className="text-slate-600">Select a merchant to view analytics</p>
              </div>
            </div>
          )
        )}

        {activeTab === 'products' && (
          selectedMerchant ? (
            <ProductsManager
              merchant={selectedMerchant}
              onRefresh={loadMerchants}
            />
          ) : (
            <div className="p-6">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
                <p className="text-slate-600">Select a merchant to manage products</p>
              </div>
            </div>
          )
        )}

        {activeTab === 'pricing' && (
          selectedMerchant ? (
            <PricingManager
              merchant={selectedMerchant}
              globalCurrency={globalCurrency}
            />
          ) : (
            <div className="p-6">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
                <p className="text-slate-600">Select a merchant to manage pricing</p>
              </div>
            </div>
          )
        )}

        {activeTab === 'invoices' && (
          selectedMerchant ? (
            <InvoicesManager
              merchant={selectedMerchant}
              userEmail={userEmail}
              globalCurrency={globalCurrency}
            />
          ) : (
            <div className="p-6">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
                <p className="text-slate-600">Select a merchant to create invoices</p>
              </div>
            </div>
          )
        )}

        {activeTab === 'payment-links' && (
          selectedMerchant ? (
            <PaymentLinksManager
              merchant={selectedMerchant}
              globalCurrency={globalCurrency}
            />
          ) : (
            <div className="p-6">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
                <p className="text-slate-600">Select a merchant to create payment links</p>
              </div>
            </div>
          )
        )}

        {activeTab === 'settings' && (
          <PaymentsSettings
            merchant={selectedMerchant}
            merchants={merchants}
            userId={userId}
            globalCurrency={globalCurrency}
            setGlobalCurrency={setGlobalCurrency}
            onCreateMerchant={handleCreateMerchant}
            onUpdateMerchant={handleUpdateMerchant}
            onMerchantsUpdated={loadMerchants}
          />
        )}
      </div>

      {/* Payment Details Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white">
              <h3 className="text-2xl font-semibold text-slate-900">Payment Details</h3>
              <button
                onClick={() => setSelectedPayment(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Transaction Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Amount</p>
                  <p className="text-2xl font-bold text-slate-900">{globalCurrency} {Number(selectedPayment.amount || 0).toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Status</p>
                  <p className={`text-lg font-bold ${STATUS_COLORS[selectedPayment.status]?.text || 'text-slate-900'}`}>
                    {selectedPayment.status}
                  </p>
                </div>
              </div>

              {/* Fee Information */}
              <div className="border-t border-slate-200 pt-6">
                <h4 className="font-semibold text-slate-900 mb-4">Transaction Breakdown</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-700">Gross Amount</span>
                    <span className="font-semibold text-slate-900">{globalCurrency} {Number(selectedPayment.amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <span className="text-slate-700">Fee Amount</span>
                    <span className="font-semibold text-red-900">-{globalCurrency} {Number(selectedPayment.fee_amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border-2 border-emerald-200">
                    <span className="font-semibold text-slate-900">Net Amount</span>
                    <span className="font-bold text-emerald-900">{globalCurrency} {Number(selectedPayment.net_amount || selectedPayment.amount - (selectedPayment.fee_amount || 0)).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              <div className="border-t border-slate-200 pt-6">
                <h4 className="font-semibold text-slate-900 mb-4">Payment Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Reference Number</p>
                    <p className="text-slate-900 font-medium">{selectedPayment.reference_number || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Payment Type</p>
                    <p className="text-slate-900 font-medium">{selectedPayment.payment_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Payment Method</p>
                    <p className="text-slate-900 font-medium">{selectedPayment.payment_method || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Currency</p>
                    <p className="text-slate-900 font-medium">{selectedPayment.currency || 'PHP'}</p>
                  </div>
                </div>
              </div>

              {/* Customer Information */}
              <div className="border-t border-slate-200 pt-6">
                <h4 className="font-semibold text-slate-900 mb-4">Customer Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Name</p>
                    <p className="text-slate-900 font-medium">{selectedPayment.guest_name || 'Guest'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Email</p>
                    <p className="text-slate-900 font-medium text-sm">{selectedPayment.guest_email || selectedPayment.customer_id || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="border-t border-slate-200 pt-6">
                <h4 className="font-semibold text-slate-900 mb-4">Timestamps</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Created</p>
                    <p className="text-slate-900 text-sm">{new Date(selectedPayment.created_at).toLocaleString()}</p>
                  </div>
                  {selectedPayment.completed_at && (
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Completed</p>
                      <p className="text-slate-900 text-sm">{new Date(selectedPayment.completed_at).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              {selectedPayment.description && (
                <div className="border-t border-slate-200 pt-6">
                  <h4 className="font-semibold text-slate-900 mb-2">Description</h4>
                  <p className="text-slate-700 bg-slate-50 p-3 rounded-lg">{selectedPayment.description}</p>
                </div>
              )}

              {/* Metadata */}
              {selectedPayment.metadata && Object.keys(selectedPayment.metadata).length > 0 && (
                <div className="border-t border-slate-200 pt-6">
                  <h4 className="font-semibold text-slate-900 mb-3">Additional Data</h4>
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <pre className="text-xs overflow-x-auto text-slate-700">
                      {JSON.stringify(selectedPayment.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50 sticky bottom-0">
              <button
                onClick={() => setSelectedPayment(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
