import { useState, useEffect } from 'react'
import { paymentsService } from '../../lib/paymentsService'

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
  const [recentPayments, setRecentPayments] = useState([])
  const [paymentsByType, setPaymentsByType] = useState({})
  const [paymentsByMethod, setPaymentsByMethod] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (merchant) {
      loadStats()
    }
  }, [merchant])

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

      // Calculate totals from the central payments ledger
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

      setPaymentsByType(byType)
      setPaymentsByMethod(byMethod)
      setRecentPayments(payments.slice(0, 10))
    } catch (err) {
      console.error('Error loading stats:', err)
    } finally {
      setLoading(false)
    }
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

      {/* Recent Payments */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Recent Transactions</h3>
          <div className="flex gap-2">
            <span className="text-xs text-slate-400 self-center">Showing last 10 from ledger</span>
          </div>
        </div>
        {recentPayments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-600">No payments recorded in the central ledger yet.</p>
            <p className="text-xs text-slate-400 mt-1">Successful transactions will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Reference</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Method</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-700">Amount</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-700">Fee</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-700">Net</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map(payment => (
                  <tr key={payment.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs text-slate-600">{payment.reference_number || payment.id.slice(0, 8)}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded capitalize">
                        {payment.payment_type || 'payment'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-[11px] text-slate-600 uppercase tracking-tight">
                        {payment.payment_method || '—'}
                      </div>
                      <div className="text-[10px] text-slate-500">{payment.guest_name || '—'}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900">
                      {payment.currency} {Number(payment.amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={Number(payment.fee_amount) > 0 ? 'text-amber-600 font-medium' : 'text-slate-400'}>
                        {payment.currency} {Number(payment.fee_amount || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900">
                      {payment.currency} {Number(payment.net_amount || (payment.amount - (payment.fee_amount || 0))).toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        payment.status === 'succeeded'
                          ? 'bg-emerald-100 text-emerald-800'
                          : payment.status === 'pending'
                          ? 'bg-blue-100 text-blue-800'
                          : payment.status === 'processing'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
    </div>
  )
}
