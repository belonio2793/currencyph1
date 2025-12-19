import { useState, useEffect } from 'react'
import { paymentsService } from '../../lib/paymentsService'

export default function PaymentHistory({ merchant, userId, globalCurrency = 'PHP' }) {
  const [payments, setPayments] = useState([])
  const [filteredPayments, setFilteredPayments] = useState([])
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

  useEffect(() => {
    if (merchant) {
      loadPayments()
    }
  }, [merchant])

  useEffect(() => {
    applyFilters()
  }, [payments, filters])

  const loadPayments = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await paymentsService.getPaymentsByMerchant(merchant.id)
      setPayments(data || [])
    } catch (err) {
      console.error('Error loading payment history:', err)
      setError('Failed to load payment history')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...payments]

    // Filter by status
    if (filters.status !== 'all') {
      filtered = filtered.filter(p => p.status === filters.status)
    }

    // Filter by payment type
    if (filters.type !== 'all') {
      filtered = filtered.filter(p => p.payment_type === filters.type)
    }

    // Filter by payment method
    if (filters.method !== 'all') {
      filtered = filtered.filter(p => p.payment_method === filters.method)
    }

    // Filter by reference number
    if (filters.searchRef.trim()) {
      const search = filters.searchRef.toLowerCase()
      filtered = filtered.filter(p =>
        p.reference_number?.toLowerCase().includes(search) ||
        p.guest_name?.toLowerCase().includes(search) ||
        p.guest_email?.toLowerCase().includes(search)
      )
    }

    // Sort
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

  // Pagination
  const totalPages = Math.ceil(filteredPayments.length / pagination.itemsPerPage)
  const startIdx = (pagination.currentPage - 1) * pagination.itemsPerPage
  const endIdx = startIdx + pagination.itemsPerPage
  const paginatedPayments = filteredPayments.slice(startIdx, endIdx)

  // Get unique values for filter options
  const uniqueStatuses = [...new Set(payments.map(p => p.status))]
  const uniqueTypes = [...new Set(payments.map(p => p.payment_type))]
  const uniqueMethods = [...new Set(payments.map(p => p.payment_method))]

  // Calculate summary
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

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-slate-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Total Transactions</p>
          <p className="text-2xl font-bold text-blue-900">{summary.total}</p>
          <div className="text-xs text-blue-600 mt-2">
            <span className="inline-block mr-3">✓ {summary.succeeded}</span>
            <span className="inline-block mr-3">⏳ {summary.pending}</span>
            <span className="inline-block">✗ {summary.failed}</span>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-emerald-700 uppercase mb-1">Gross Revenue</p>
          <p className="text-2xl font-bold text-emerald-900">{globalCurrency} {summary.totalAmount.toFixed(2)}</p>
          <p className="text-xs text-emerald-600 mt-2">Succeeded payments</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Total Fees</p>
          <p className="text-2xl font-bold text-amber-900">{globalCurrency} {summary.totalFees.toFixed(2)}</p>
          <p className="text-xs text-amber-600 mt-2">From succeeded payments</p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-purple-700 uppercase mb-1">Net Revenue</p>
          <p className="text-2xl font-bold text-purple-900">{globalCurrency} {summary.netRevenue.toFixed(2)}</p>
          <p className="text-xs text-purple-600 mt-2">After fees</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Filters</h3>
          <button
            onClick={() => setFilters({
              status: 'all',
              type: 'all',
              method: 'all',
              sortBy: 'date-desc',
              searchRef: ''
            })}
            className="text-xs text-slate-600 hover:text-slate-900 underline"
          >
            Reset
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="Ref, name, or email..."
              value={filters.searchRef}
              onChange={(e) => handleFilterChange('searchRef', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              {uniqueStatuses.map(status => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              {uniqueTypes.map(type => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Method</label>
            <select
              value={filters.method}
              onChange={(e) => handleFilterChange('method', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Methods</option>
              {uniqueMethods.map(method => (
                <option key={method} value={method || 'unknown'}>
                  {method ? method.charAt(0).toUpperCase() + method.slice(1) : 'Unknown'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Sort By</label>
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="amount-desc">Highest Amount</option>
              <option value="amount-asc">Lowest Amount</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Method</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Amount</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Fee</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Net</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Date</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPayments.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-slate-600">
                    {payments.length === 0 ? 'No transactions recorded yet' : 'No transactions match your filters'}
                  </td>
                </tr>
              ) : (
                paginatedPayments.map(payment => (
                  <tr key={payment.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-semibold text-slate-700">{payment.reference_number || payment.id.slice(0, 12)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">{payment.guest_name || '—'}</div>
                      <div className="text-xs text-slate-500">{payment.guest_email || '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded capitalize font-medium">
                        {payment.payment_type || 'payment'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-slate-600 uppercase tracking-tight font-semibold">
                        {payment.payment_method || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-semibold text-slate-900">
                        {payment.currency} {Number(payment.amount).toFixed(2)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className={Number(payment.fee_amount) > 0 ? 'font-semibold text-amber-600' : 'text-slate-400'}>
                        {payment.currency} {Number(payment.fee_amount || 0).toFixed(2)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-semibold text-slate-900">
                        {payment.currency} {Number(payment.net_amount || (payment.amount - (payment.fee_amount || 0))).toFixed(2)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        payment.status === 'succeeded'
                          ? 'bg-emerald-100 text-emerald-800'
                          : payment.status === 'pending'
                          ? 'bg-blue-100 text-blue-800'
                          : payment.status === 'processing'
                          ? 'bg-purple-100 text-purple-800'
                          : payment.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : payment.status === 'refunded'
                          ? 'bg-pink-100 text-pink-800'
                          : 'bg-slate-100 text-slate-800'
                      }`}>
                        {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {new Date(payment.created_at).toLocaleDateString()}
                      <div className="text-[10px] text-slate-500">{new Date(payment.created_at).toLocaleTimeString()}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredPayments.length > pagination.itemsPerPage && (
          <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-slate-600">
              Showing {startIdx + 1} to {Math.min(endIdx, filteredPayments.length)} of {filteredPayments.length}
            </p>
            <div className="flex gap-2">
              <button
                disabled={pagination.currentPage === 1}
                onClick={() => setPagination({ ...pagination, currentPage: pagination.currentPage - 1 })}
                className="px-3 py-1 text-xs border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setPagination({ ...pagination, currentPage: page })}
                  className={`px-3 py-1 text-xs rounded-lg ${
                    pagination.currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                disabled={pagination.currentPage === totalPages}
                onClick={() => setPagination({ ...pagination, currentPage: pagination.currentPage + 1 })}
                className="px-3 py-1 text-xs border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
