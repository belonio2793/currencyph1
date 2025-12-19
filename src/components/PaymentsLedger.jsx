import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const STATUS_COLORS = {
  succeeded: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
  pending: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800' },
  failed: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-800' },
  cancelled: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-800' },
  refunded: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' }
}

export default function PaymentsLedger({ globalCurrency = 'PHP' }) {
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
    loadPayments()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [payments, filters])

  const loadPayments = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error: queryError } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })

      if (queryError) throw queryError
      setPayments(data || [])
    } catch (err) {
      console.error('Error loading payments:', err)
      setError('Failed to load payments')
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

  if (loading) {
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
        <div>
          <h2 className="text-3xl font-light text-slate-900">Payments Ledger</h2>
          <p className="text-slate-600 mt-1">View all payments from the public payments table</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        ) : null}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
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
                </tr>
              </thead>
              <tbody>
                {paginatedPayments.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-8 text-center">
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
    </div>
  )
}
