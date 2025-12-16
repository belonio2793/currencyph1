import { useState, useEffect } from 'react'
import { paymentsService } from '../../lib/paymentsService'

export default function InvoicesManager({ merchant, userEmail, globalCurrency }) {
  const [invoices, setInvoices] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    amount_due: '',
    currency: globalCurrency,
    description: '',
    due_date: ''
  })

  useEffect(() => {
    if (merchant) {
      loadInvoices()
    }
  }, [merchant])

  const loadInvoices = async () => {
    try {
      setLoading(true)
      const data = await paymentsService.getInvoicesByMerchant(merchant.id)
      setInvoices(data || [])
    } catch (err) {
      console.error('Error loading invoices:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      const newInvoice = await paymentsService.createInvoice(merchant.id, {
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        amount_due: parseFloat(formData.amount_due),
        currency: formData.currency,
        description: formData.description,
        due_date: formData.due_date || null
      })
      setInvoices([newInvoice, ...invoices])
      setFormData({
        customer_name: '',
        customer_email: '',
        amount_due: '',
        currency: globalCurrency,
        description: '',
        due_date: ''
      })
      setShowCreateForm(false)
    } catch (err) {
      console.error('Error creating invoice:', err)
      alert('Failed to create invoice')
    }
  }

  const handleSendInvoice = async (invoiceId) => {
    try {
      const updated = await paymentsService.sendInvoice(invoiceId)
      setInvoices(invoices.map(i => i.id === invoiceId ? updated : i))
    } catch (err) {
      console.error('Error sending invoice:', err)
      alert('Failed to send invoice')
    }
  }

  const handleMarkPaid = async (invoiceId) => {
    try {
      const updated = await paymentsService.markInvoicePaid(invoiceId)
      setInvoices(invoices.map(i => i.id === invoiceId ? updated : i))
    } catch (err) {
      console.error('Error marking invoice as paid:', err)
      alert('Failed to update invoice')
    }
  }

  const filteredInvoices = filterStatus === 'all'
    ? invoices
    : invoices.filter(i => i.status === filterStatus)

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-slate-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-light text-slate-900">Invoices</h3>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            + New Invoice
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h4 className="text-lg font-semibold text-slate-900 mb-4">Create New Invoice</h4>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer Email</label>
                <input
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="john@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount Due</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount_due}
                  onChange={(e) => setFormData({ ...formData, amount_due: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                <input
                  type="text"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="PHP"
                  maxLength="3"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Invoice description"
                rows="3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Create Invoice
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'draft', 'sent', 'paid'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filterStatus === status
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Invoices List */}
      <div>
        {filteredInvoices.length === 0 ? (
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-8 text-center">
            <p className="text-slate-600">No invoices found</p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Customer</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Amount</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(invoice => (
                  <tr key={invoice.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-slate-900">{invoice.customer_name}</p>
                        <p className="text-xs text-slate-500">{invoice.customer_email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
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
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        {invoice.status === 'draft' && (
                          <button
                            onClick={() => handleSendInvoice(invoice.id)}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                          >
                            Send
                          </button>
                        )}
                        {invoice.status !== 'paid' && (
                          <button
                            onClick={() => handleMarkPaid(invoice.id)}
                            className="text-xs px-2 py-1 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200 transition-colors"
                          >
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
