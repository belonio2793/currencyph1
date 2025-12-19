import { useState, useEffect } from 'react'
import { paymentsService } from '../../lib/paymentsService'

export default function PaymentsOverview({ merchant, userId, globalCurrency }) {
  const [stats, setStats] = useState({
    totalInvoices: 0,
    totalReceived: 0,
    pendingInvoices: 0,
    products: 0,
    paymentLinks: 0
  })
  const [recentInvoices, setRecentInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (merchant) {
      loadStats()
    }
  }, [merchant])

  const loadStats = async () => {
    try {
      setLoading(true)
      const [invoices, products, paymentLinks] = await Promise.all([
        paymentsService.getInvoicesByMerchant(merchant.id),
        paymentsService.getProductsByMerchant(merchant.id),
        paymentsService.getPaymentLinksByMerchant(merchant.id)
      ])

      const paidInvoices = invoices.filter(i => i.status === 'paid')
      const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'draft')
      const totalReceived = paidInvoices.reduce((sum, i) => sum + (i.amount_due || 0), 0)

      setStats({
        totalInvoices: invoices.length,
        totalReceived: totalReceived,
        pendingInvoices: pendingInvoices.length,
        products: products.length,
        paymentLinks: paymentLinks.length
      })

      setRecentInvoices(invoices.slice(0, 5))
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Invoices"
          value={stats.totalInvoices}
          color="border-amber-200"
        />
        <StatCard
          title="Amount Received"
          value={`${globalCurrency} ${stats.totalReceived.toFixed(2)}`}
          color="border-emerald-200"
        />
        <StatCard
          title="Pending Invoices"
          value={stats.pendingInvoices}
          color="border-blue-200"
        />
        <StatCard
          title="Products"
          value={stats.products}
          color="border-purple-200"
        />
        <StatCard
          title="Payment Links"
          value={stats.paymentLinks}
          color="border-pink-200"
        />
      </div>

      {/* Recent Invoices */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Recent Invoices</h3>
          <button
            onClick={() => {
              // This is a bit hacky but works since setActiveTab is in parent
              const tabs = document.querySelectorAll('button')
              const invoicesTab = Array.from(tabs).find(t => t.textContent === 'Invoices')
              invoicesTab?.click()
            }}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            View All
          </button>
        </div>
        {recentInvoices.length === 0 ? (
          <p className="text-slate-600 text-center py-8">No invoices yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Customer</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Amount</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map(invoice => (
                  <tr key={invoice.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{invoice.customer_name}</div>
                      <div className="text-xs text-slate-500">{invoice.customer_email}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-900 font-medium">
                      {invoice.currency} {invoice.amount_due.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        invoice.status === 'paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : invoice.status === 'sent'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-800'
                      }`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(invoice.created_at).toLocaleDateString()}
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
