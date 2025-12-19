import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { paymentsService } from '../../lib/paymentsService'

const STATUS_COLORS = {
  succeeded: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
  pending: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800' },
  failed: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-800' },
  cancelled: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-800' },
  refunded: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' }
}

export default function PaymentsOverview({ merchant, userId, globalCurrency }) {
  const [stats, setStats] = useState({
    totalInvoices: 0,
    totalReceived: 0,
    totalFees: 0,
    netRevenue: 0,
    pendingInvoices: 0,
    totalPayments: 0,
    products: 0,
    paymentLinks: 0
  })
  const [allPayments, setAllPayments] = useState([])
  const [filteredPayments, setFilteredPayments] = useState([])
  const [paymentsByType, setPaymentsByType] = useState({})
  const [paymentsByMethod, setPaymentsByMethod] = useState({})
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    loadStats()
  }, [merchant])

  useEffect(() => {
    applyFilters()
  }, [allPayments, filters])

  const loadStats = async () => {
    try {
      setLoading(true)
      const [invoices, products, paymentLinks, payments] = await Promise.all([
        paymentsService.getInvoicesByMerchant(merchant.id),
        paymentsService.getProductsByMerchant(merchant.id),
        paymentsService.getPaymentLinksByMerchant(merchant.id),
        paymentsService.getPaymentsByMerchant(merchant.id)
      ])

      const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'draft')
      const succeededPayments = payments.filter(p => p.status === 'succeeded')

      const totalReceived = succeededPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      const totalFees = succeededPayments.reduce((sum, p) => sum + (Number(p.fee_amount) || 0), 0)
      const netRevenue = succeededPayments.reduce((sum, p) => sum + (Number(p.net_amount) || Number(p.amount) - Number(p.fee_amount || 0)), 0)

      // Group by payment type
      const byType = {}
      payments.forEach(p => {
        const type = p.payment_type || 'unknown'
        if (!byType[type]) byType[type] = { count: 0, amount: 0, fees: 0 }
        byType[type].count += 1
        byType[type].amount += Number(p.amount) || 0
        byType[type].fees += Number(p.fee_amount) || 0
      })

      // Group by payment method
      const byMethod = {}
      payments.forEach(p => {
        const method = p.payment_method || 'unknown'
        if (!byMethod[method]) byMethod[method] = { count: 0, amount: 0, fees: 0 }
        byMethod[method].count += 1
        byMethod[method].amount += Number(p.amount) || 0
        byMethod[method].fees += Number(p.fee_amount) || 0
      })

      setStats({
        totalInvoices: invoices.length,
        totalReceived: totalReceived,
        totalFees: totalFees,
        netRevenue: netRevenue,
        pendingInvoices: pendingInvoices.length,
        totalPayments: payments.length,
        products: products.length,
        paymentLinks: paymentLinks.length
      })

      setAllPayments(payments)
      setPaymentsByType(byType)
      setPaymentsByMethod(byMethod)
    } catch (err) {
      console.error('Error loading stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...allPayments]

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

  const totalPages = Math.ceil(filteredPayments.length / pagination.itemsPerPage)
  const startIdx = (pagination.currentPage - 1) * pagination.itemsPerPage
  const endIdx = startIdx + pagination.itemsPerPage
  const paginatedPayments = filteredPayments.slice(startIdx, endIdx)

  const uniqueStatuses = [...new Set(allPayments.map(p => p.status))].filter(Boolean)
  const uniqueTypes = [...new Set(allPayments.map(p => p.payment_type))].filter(Boolean)
  const uniqueMethods = [...new Set(allPayments.map(p => p.payment_method))].filter(Boolean)

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

  const StatCard = ({ title, value, subtitle, color }) => (
    <div className={`bg-white rounded-lg border ${color} p-6`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="text-3xl font-light text-slate-900 mt-2">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 bg-slate-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Gross Revenue"
          value={`${globalCurrency} ${stats.totalReceived.toFixed(2)}`}
          color="border-blue-200"
        />
        <StatCard
          title="Net Revenue"
          value={`${globalCurrency} ${stats.netRevenue.toFixed(2)}`}
          subtitle={`Fees: ${globalCurrency} ${stats.totalFees.toFixed(2)}`}
          color="border-emerald-200"
        />
        <StatCard
          title="Total Transactions"
          value={stats.totalPayments}
          color="border-amber-200"
        />
        <StatCard
          title="Pending Invoices"
          value={stats.pendingInvoices}
          subtitle={`of ${stats.totalInvoices}`}
          color="border-orange-200"
        />
      </div>

      {/* Payment Ledger Section */}
      <div className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Filtered Transactions</p>
            <p className="text-2xl font-bold text-blue-900">{summary.total}</p>
            <div className="text-xs text-blue-600 mt-2 space-y-1">
              <div><span className="font-semibold text-emerald-600">Succeeded:</span> {summary.succeeded}</div>
              <div><span className="font-semibold text-yellow-600">Pending:</span> {summary.pending}</div>
              <div><span className="font-semibold text-red-600">Failed:</span> {summary.failed}</div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-emerald-700 uppercase mb-1">Gross Revenue</p>
            <p className="text-2xl font-bold text-emerald-900">{globalCurrency} {summary.totalAmount.toFixed(2)}</p>
            <p className="text-xs text-emerald-600 mt-2">Succeeded payments</p>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-purple-700 uppercase mb-1">Total Fees</p>
            <p className="text-2xl font-bold text-purple-900">{globalCurrency} {summary.totalFees.toFixed(2)}</p>
            <p className="text-xs text-purple-600 mt-2">Fee collected</p>
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-indigo-700 uppercase mb-1">Net Revenue</p>
            <p className="text-2xl font-bold text-indigo-900">{globalCurrency} {summary.netRevenue.toFixed(2)}</p>
            <p className="text-xs text-indigo-600 mt-2">After fees</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                {uniqueTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Method</label>
              <select
                value={filters.method}
                onChange={(e) => handleFilterChange('method', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Methods</option>
                {uniqueMethods.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Sort By</label>
              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="date-desc">Latest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="amount-desc">Highest Amount</option>
                <option value="amount-asc">Lowest Amount</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Search</label>
              <input
                type="text"
                placeholder="Ref, name, email..."
                value={filters.searchRef}
                onChange={(e) => handleFilterChange('searchRef', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Reference</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Method</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase">Amount</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase">Fee</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase">Net</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPayments.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-6 py-8 text-center">
                      <p className="text-slate-600">No payments found</p>
                    </td>
                  </tr>
                ) : (
                  paginatedPayments.map((payment) => {
                    const statusColors = STATUS_COLORS[payment.status] || STATUS_COLORS.pending
                    return (
                      <tr key={payment.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-900">
                          {new Date(payment.created_at).toLocaleDateString()} {new Date(payment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                          {payment.reference_number || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          <div>{payment.guest_name || 'Guest'}</div>
                          <div className="text-xs text-slate-500">{payment.guest_email || payment.customer_id || '-'}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-900">
                          <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                            {payment.payment_type || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{payment.payment_method || '-'}</td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900 text-right">
                          {globalCurrency} {Number(payment.amount || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 text-right">
                          {globalCurrency} {Number(payment.fee_amount || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900 text-right">
                          {globalCurrency} {Number(payment.net_amount || payment.amount - (payment.fee_amount || 0)).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusColors.badge}`}>
                            {payment.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <button
                            onClick={() => setSelectedPayment(payment)}
                            className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
              <p className="text-sm text-slate-600">
                Showing {startIdx + 1} to {Math.min(endIdx, filteredPayments.length)} of {filteredPayments.length}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination({ ...pagination, currentPage: Math.max(1, pagination.currentPage - 1) })}
                  disabled={pagination.currentPage === 1}
                  className="px-3 py-1 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setPagination({ ...pagination, currentPage: page })}
                      className={`px-2 py-1 rounded-lg text-sm font-medium transition-colors ${
                        pagination.currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'border border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setPagination({ ...pagination, currentPage: Math.min(totalPages, pagination.currentPage + 1) })}
                  disabled={pagination.currentPage === totalPages}
                  className="px-3 py-1 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Breakdown */}
      {Object.keys(paymentsByType).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">By Payment Type</h3>
            <div className="space-y-3">
              {Object.entries(paymentsByType).map(([type, data]) => (
                <div key={type} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="font-medium text-slate-900 capitalize">{type}</p>
                    <p className="text-xs text-slate-500">{data.count} transaction(s)</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-900">{globalCurrency} {Number(data.amount).toFixed(2)}</p>
                    <p className="text-xs text-amber-600">{globalCurrency} {Number(data.fees).toFixed(2)} fees</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">By Payment Method</h3>
            <div className="space-y-3">
              {Object.entries(paymentsByMethod).map(([method, data]) => (
                <div key={method} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="font-medium text-slate-900 capitalize">{method || 'Unknown'}</p>
                    <p className="text-xs text-slate-500">{data.count} transaction(s)</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-900">{globalCurrency} {Number(data.amount).toFixed(2)}</p>
                    <p className="text-xs text-amber-600">{globalCurrency} {Number(data.fees).toFixed(2)} fees</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Getting Started */}
      <div className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-lg border border-emerald-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Getting Started</h3>
        <ul className="space-y-2 text-slate-700">
          <li className="flex gap-3">
            <span className="text-emerald-600 font-bold">1.</span>
            <span>Create products and set prices for your services</span>
          </li>
          <li className="flex gap-3">
            <span className="text-emerald-600 font-bold">2.</span>
            <span>Generate invoices and send them to customers</span>
          </li>
          <li className="flex gap-3">
            <span className="text-emerald-600 font-bold">3.</span>
            <span>Create payment links and share them via QR code or email</span>
          </li>
          <li className="flex gap-3">
            <span className="text-emerald-600 font-bold">4.</span>
            <span>Track all transactions and payments in real-time</span>
          </li>
        </ul>
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
