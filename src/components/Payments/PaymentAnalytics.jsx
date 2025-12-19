import { useState, useEffect } from 'react'
import { paymentsService } from '../../lib/paymentsService'

export default function PaymentAnalytics({ merchant, userId, globalCurrency = 'PHP' }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dateRange, setDateRange] = useState('month') // week, month, quarter, year, all

  useEffect(() => {
    if (merchant) {
      loadAnalytics()
    }
  }, [merchant, dateRange])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await paymentsService.getPaymentsByMerchant(merchant.id)
      setPayments(data || [])
    } catch (err) {
      console.error('Error loading analytics:', err)
      setError('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  const getDateRangeFilter = () => {
    const now = new Date()
    let startDate

    switch (dateRange) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3)
        startDate = new Date(now.getFullYear(), quarter * 3, 1)
        break
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      default:
        startDate = null
    }

    return startDate
  }

  const getFilteredPayments = () => {
    const startDate = getDateRangeFilter()
    if (!startDate) return payments

    return payments.filter(p => new Date(p.created_at) >= startDate)
  }

  const filteredPayments = getFilteredPayments()
  const succeededPayments = filteredPayments.filter(p => p.status === 'succeeded')

  // Calculate metrics
  const metrics = {
    totalRevenue: succeededPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    totalFees: succeededPayments.reduce((sum, p) => sum + Number(p.fee_amount || 0), 0),
    netRevenue: succeededPayments.reduce((sum, p) => sum + Number(p.net_amount || p.amount - (p.fee_amount || 0)), 0),
    avgTransactionValue: succeededPayments.length > 0 ? succeededPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0) / succeededPayments.length : 0,
    totalTransactions: succeededPayments.length,
    pendingTransactions: filteredPayments.filter(p => p.status === 'pending').length,
    failedTransactions: filteredPayments.filter(p => p.status === 'failed').length
  }

  // Group by payment type
  const byType = {}
  succeededPayments.forEach(p => {
    const type = p.payment_type || 'unknown'
    if (!byType[type]) {
      byType[type] = {
        count: 0,
        amount: 0,
        fees: 0,
        avgValue: 0,
        percentage: 0
      }
    }
    byType[type].count += 1
    byType[type].amount += Number(p.amount || 0)
    byType[type].fees += Number(p.fee_amount || 0)
  })

  // Calculate percentages and averages for type
  Object.keys(byType).forEach(type => {
    byType[type].avgValue = byType[type].amount / byType[type].count
    byType[type].percentage = (byType[type].amount / metrics.totalRevenue) * 100
  })

  // Group by payment method
  const byMethod = {}
  succeededPayments.forEach(p => {
    const method = p.payment_method || 'unknown'
    if (!byMethod[method]) {
      byMethod[method] = {
        count: 0,
        amount: 0,
        fees: 0,
        avgValue: 0,
        percentage: 0
      }
    }
    byMethod[method].count += 1
    byMethod[method].amount += Number(p.amount || 0)
    byMethod[method].fees += Number(p.fee_amount || 0)
  })

  // Calculate percentages and averages for method
  Object.keys(byMethod).forEach(method => {
    byMethod[method].avgValue = byMethod[method].amount / byMethod[method].count
    byMethod[method].percentage = (byMethod[method].amount / metrics.totalRevenue) * 100
  })

  // Group by date for trend
  const byDate = {}
  succeededPayments.forEach(p => {
    const date = new Date(p.created_at).toLocaleDateString()
    if (!byDate[date]) {
      byDate[date] = { count: 0, amount: 0, fees: 0 }
    }
    byDate[date].count += 1
    byDate[date].amount += Number(p.amount || 0)
    byDate[date].fees += Number(p.fee_amount || 0)
  })

  const sortedDates = Object.keys(byDate).sort((a, b) => new Date(a) - new Date(b))
  const trendData = sortedDates.slice(-7).map(date => ({
    date,
    ...byDate[date]
  }))

  // Find max amount for chart scaling
  const maxAmount = trendData.length > 0 ? Math.max(...trendData.map(d => d.amount)) : 0

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-40 bg-slate-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Date Range Selector */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Analytics Period</h3>
          <div className="flex gap-2">
            {['week', 'month', 'quarter', 'year', 'all'].map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 text-sm rounded-lg transition-colors font-medium ${
                  dateRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {range === 'week' && 'Last 7 Days'}
                {range === 'month' && 'This Month'}
                {range === 'quarter' && 'This Quarter'}
                {range === 'year' && 'This Year'}
                {range === 'all' && 'All Time'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
          <p className="text-xs font-semibold text-blue-700 uppercase mb-2">Gross Revenue</p>
          <p className="text-3xl font-bold text-blue-900">{globalCurrency} {metrics.totalRevenue.toFixed(2)}</p>
          <p className="text-xs text-blue-600 mt-2">{metrics.totalTransactions} transactions</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-lg p-6">
          <p className="text-xs font-semibold text-emerald-700 uppercase mb-2">Net Revenue</p>
          <p className="text-3xl font-bold text-emerald-900">{globalCurrency} {metrics.netRevenue.toFixed(2)}</p>
          <p className="text-xs text-emerald-600 mt-2">After fees</p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-lg p-6">
          <p className="text-xs font-semibold text-amber-700 uppercase mb-2">Total Fees</p>
          <p className="text-3xl font-bold text-amber-900">{globalCurrency} {metrics.totalFees.toFixed(2)}</p>
          <p className="text-xs text-amber-600 mt-2">{((metrics.totalFees / metrics.totalRevenue) * 100 || 0).toFixed(2)}% of revenue</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-6">
          <p className="text-xs font-semibold text-purple-700 uppercase mb-2">Avg Transaction</p>
          <p className="text-3xl font-bold text-purple-900">{globalCurrency} {metrics.avgTransactionValue.toFixed(2)}</p>
          <p className="text-xs text-purple-600 mt-2">Average value per transaction</p>
        </div>
      </div>

      {/* Transaction Status Overview */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Transaction Status Overview</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-4xl font-bold text-emerald-600">{metrics.totalTransactions}</p>
            <p className="text-sm text-slate-600 mt-1">Succeeded</p>
            <p className="text-xs text-slate-500">{metrics.totalTransactions > 0 ? '100%' : '0%'} success rate</p>
          </div>
          <div className="text-center border-l border-r border-slate-200">
            <p className="text-4xl font-bold text-blue-600">{metrics.pendingTransactions}</p>
            <p className="text-sm text-slate-600 mt-1">Pending</p>
            <p className="text-xs text-slate-500">Awaiting confirmation</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-red-600">{metrics.failedTransactions}</p>
            <p className="text-sm text-slate-600 mt-1">Failed</p>
            <p className="text-xs text-slate-500">Requires attention</p>
          </div>
        </div>
      </div>

      {/* Revenue by Type */}
      {Object.keys(byType).length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Revenue by Transaction Type</h3>
          <div className="space-y-4">
            {Object.entries(byType)
              .sort((a, b) => b[1].amount - a[1].amount)
              .map(([type, data]) => (
                <div key={type}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-900 capitalize">{type}</span>
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">{data.count} transactions</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{globalCurrency} {data.amount.toFixed(2)}</p>
                      <p className="text-xs text-slate-500">{data.percentage.toFixed(1)}% of total</p>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${data.percentage}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Avg: {globalCurrency} {data.avgValue.toFixed(2)} | Fees: {globalCurrency} {data.fees.toFixed(2)}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Revenue by Method */}
      {Object.keys(byMethod).length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Revenue by Payment Method</h3>
          <div className="space-y-4">
            {Object.entries(byMethod)
              .sort((a, b) => b[1].amount - a[1].amount)
              .map(([method, data]) => (
                <div key={method}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-900 capitalize">{method || 'Unknown'}</span>
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">{data.count} times</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{globalCurrency} {data.amount.toFixed(2)}</p>
                      <p className="text-xs text-slate-500">{data.percentage.toFixed(1)}% of total</p>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-emerald-600 h-2 rounded-full"
                      style={{ width: `${data.percentage}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Avg: {globalCurrency} {data.avgValue.toFixed(2)} | Fees: {globalCurrency} {data.fees.toFixed(2)}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Daily Trend */}
      {trendData.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Daily Revenue Trend (Last 7 Days)</h3>
          <div className="flex items-end justify-between gap-2 h-48">
            {trendData.map((day, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all hover:opacity-80"
                  style={{
                    height: maxAmount > 0 ? `${(day.amount / maxAmount) * 100}%` : '0%'
                  }}
                  title={`${day.date}: ${globalCurrency} ${day.amount.toFixed(2)}`}
                ></div>
                <p className="text-xs text-slate-600 text-center whitespace-nowrap">
                  {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-600">
              Total for period: <span className="font-semibold text-slate-900">{globalCurrency} {trendData.reduce((sum, d) => sum + d.amount, 0).toFixed(2)}</span>
            </p>
          </div>
        </div>
      )}

      {/* No Data State */}
      {filteredPayments.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <p className="text-blue-900 font-semibold">No payment data available for this period</p>
          <p className="text-blue-700 text-sm mt-1">Payment analytics will appear here once transactions are processed.</p>
        </div>
      )}
    </div>
  )
}
