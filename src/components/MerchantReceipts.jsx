import React, { useState, useEffect } from 'react'
import { receiptService } from '../lib/receiptService'
import ReceiptTemplate from './ReceiptTemplate'

export default function MerchantReceipts({ business, userId }) {
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    receipt_number: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    payment_method: 'Cash',
    payment_method_custom: '',
    items: [{ description: '', quantity: 1, price: 0 }],
    notes: ''
  })

  useEffect(() => {
    loadReceipts()
    generateReceiptNumber()
  }, [business?.id])

  const loadReceipts = async () => {
    if (!business?.id) return
    setLoading(true)
    try {
      const data = await receiptService.getBusinessReceipts(business.id, 100)
      setReceipts(data)
    } catch (err) {
      setError('Failed to load receipts')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const generateReceiptNumber = () => {
    const timestamp = Date.now().toString().slice(-8)
    const random = Math.random().toString(36).substring(2, 5).toUpperCase()
    setFormData(prev => ({
      ...prev,
      receipt_number: `RCP-${timestamp}-${random}`
    }))
  }

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, price: 0 }]
    }))
  }

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const handleItemChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  const calculateTotal = () => {
    return formData.items.reduce((total, item) => {
      return total + (parseFloat(item.price || 0) * (parseInt(item.quantity || 1)))
    }, 0)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.customer_name && !formData.customer_email && !formData.customer_phone) {
      setError('Please provide at least customer name, email, or phone number')
      return
    }
    if (formData.items.some(item => !item.description || !item.price)) {
      setError('Please fill in all item details')
      return
    }

    setLoading(true)
    try {
      const receiptData = {
        receipt_number: formData.receipt_number,
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone || null,
        payment_method: formData.payment_method,
        items: formData.items,
        amount: calculateTotal(),
        notes: formData.notes
      }

      const newReceipt = await receiptService.createReceipt(business.id, userId, receiptData)
      setReceipts([newReceipt, ...receipts])
      setSuccess('Receipt created successfully!')
      setShowForm(false)
      setFormData({
        receipt_number: '',
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        payment_method: 'Cash',
        payment_method_custom: '',
        items: [{ description: '', quantity: 1, price: 0 }],
        notes: ''
      })
      generateReceiptNumber()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to create receipt')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filteredReceipts = receipts.filter(r =>
    r.receipt_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.customer_email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (selectedReceipt) {
    return (
      <div>
        <button
          onClick={() => setSelectedReceipt(null)}
          className="mb-6 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Receipts
        </button>
        <ReceiptTemplate receipt={selectedReceipt} business={business} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {success}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Digital Receipts</h3>
          <p className="text-sm text-slate-600">Create and manage business receipts</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
        >
          {showForm ? 'Cancel' : '+ Create Receipt'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h4 className="text-lg font-semibold mb-6">Create New Receipt</h4>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Business Information - Read Only */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h5 className="font-semibold text-slate-900 mb-4 text-sm">Business Information</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Business Name</label>
                  <input
                    type="text"
                    value={business.business_name || ''}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 font-semibold text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Registration Number</label>
                  <input
                    type="text"
                    value={business.metadata?.currency_registration_number || 'N/A'}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-600 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">TIN</label>
                  <input
                    type="text"
                    value={business.tin || 'N/A'}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-600 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">BIR Certificate</label>
                  <input
                    type="text"
                    value={business.certificate_of_incorporation || 'N/A'}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-600 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Receipt Date</label>
                  <input
                    type="text"
                    value={new Date().toLocaleDateString('en-PH', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-600 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Receipt Number */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Receipt Number</label>
              <input
                type="text"
                value={formData.receipt_number}
                readOnly
                className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 font-mono text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">Auto-generated</p>
            </div>

            {/* Customer Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Customer Name</label>
                <input
                  type="text"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                  placeholder="e.g., John Doe"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => setFormData({...formData, customer_email: e.target.value})}
                  placeholder="e.g., john@example.com"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({...formData, customer_phone: e.target.value})}
                  placeholder="e.g., +63912345678"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              >
                <option value="Cash">Cash</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Online Transfer">Online Transfer</option>
                <option value="E-Wallet">E-Wallet</option>
                <option value="Check">Check</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Items Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-medium text-slate-700">Items</label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Add Item
                </button>
              </div>
              <div className="space-y-3">
                {formData.items.map((item, index) => (
                  <div key={index} className="flex gap-3">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      placeholder="Item description"
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                      min="1"
                      placeholder="Qty"
                      className="w-20 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                    <input
                      type="number"
                      value={item.price}
                      onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      placeholder="Price"
                      className="w-24 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-900">Total Amount:</span>
                <span className="text-2xl font-bold text-blue-600">
                  ₱{calculateTotal().toFixed(2)}
                </span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Notes (Optional)</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Add any additional notes or terms..."
                rows="3"
                maxLength="500"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">{formData.notes.length}/500</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-slate-300 font-medium transition-colors"
            >
              {loading ? 'Creating...' : 'Create Receipt'}
            </button>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <input
          type="text"
          placeholder="Search receipts by number, customer name, or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
        />
      </div>

      {/* Receipts List */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading && !receipts.length ? (
          <div className="p-8 text-center text-slate-500">Loading receipts...</div>
        ) : filteredReceipts.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {receipts.length === 0 ? 'No receipts yet' : 'No matching receipts'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">Receipt #</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">Customer</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">Email/Phone</th>
                  <th className="px-6 py-3 text-right font-semibold text-slate-900">Amount</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">Date</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">Method</th>
                  <th className="px-6 py-3 text-right font-semibold text-slate-900">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.map((receipt) => (
                  <tr key={receipt.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-6 py-4 font-mono text-sm">{receipt.receipt_number}</td>
                    <td className="px-6 py-4">{receipt.customer_name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {receipt.customer_email && <div>{receipt.customer_email}</div>}
                      {receipt.customer_phone && <div>{receipt.customer_phone}</div>}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold">₱{parseFloat(receipt.amount).toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(receipt.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm">{receipt.payment_method}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedReceipt(receipt)}
                        className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded text-sm font-medium"
                      >
                        View
                      </button>
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
