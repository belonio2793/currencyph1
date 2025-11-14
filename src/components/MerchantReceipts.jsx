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

  if (!userId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <p className="text-yellow-900">Unable to access receipts. User ID is missing. Please refresh the page.</p>
      </div>
    )
  }

  if (!business?.id) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <p className="text-yellow-900">No business selected. Please select a business to manage receipts.</p>
      </div>
    )
  }
  const [savedItems, setSavedItems] = useState(() => {
    const saved = localStorage.getItem(`saved-items-${business?.id}`)
    return saved ? JSON.parse(saved) : []
  })
  const [showSavedItems, setShowSavedItems] = useState(false)
  const [saveItemName, setSaveItemName] = useState('')
  const [showSaveItemModal, setShowSaveItemModal] = useState(false)
  const [sendToEmail, setSendToEmail] = useState('')
  const [sendToPhone, setSendToPhone] = useState('')
  const [showSendToModal, setShowSendToModal] = useState(false)
  const [createdReceiptId, setCreatedReceiptId] = useState(null)
  const [editingItemIndex, setEditingItemIndex] = useState(null)

  const [formData, setFormData] = useState({
    receipt_number: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    payment_method: 'Balance',
    payment_method_custom: '',
    items: [{ description: '', quantity: 1, price: 0 }],
    notes: ''
  })

  useEffect(() => {
    loadReceipts()
    generateReceiptNumber()
    if (business?.id) {
      const saved = localStorage.getItem(`saved-items-${business.id}`)
      setSavedItems(saved ? JSON.parse(saved) : [])
    }
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

  const handleSaveItemForFuture = (index) => {
    const item = formData.items[index]
    if (!item.description || !item.price) {
      setError('Please fill in item description and price before saving')
      return
    }
    setEditingItemIndex(index)
    setSaveItemName('')
    setShowSaveItemModal(true)
  }

  const handleConfirmSaveItem = () => {
    if (!saveItemName.trim()) {
      setError('Please enter a name for this saved item')
      return
    }
    const item = formData.items[editingItemIndex]
    const newSavedItem = {
      id: Date.now().toString(),
      name: saveItemName,
      description: item.description,
      quantity: item.quantity,
      price: item.price
    }
    const updated = [...savedItems, newSavedItem]
    setSavedItems(updated)
    localStorage.setItem(`saved-items-${business?.id}`, JSON.stringify(updated))
    setSuccess(`Item "${saveItemName}" saved for future use!`)
    setTimeout(() => setSuccess(''), 3000)
    setShowSaveItemModal(false)
    setSaveItemName('')
  }

  const handleUseSavedItem = (savedItem) => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        description: savedItem.description,
        quantity: savedItem.quantity,
        price: savedItem.price
      }]
    }))
    setSuccess(`Added "${savedItem.name}" to items`)
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleRemoveSavedItem = (id) => {
    const updated = savedItems.filter(item => item.id !== id)
    setSavedItems(updated)
    localStorage.setItem(`saved-items-${business?.id}`, JSON.stringify(updated))
    setSuccess('Saved item removed')
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleReEditItem = (index) => {
    setEditingItemIndex(index)
  }

  const calculateTotal = () => {
    return formData.items.reduce((total, item) => {
      return total + (parseFloat(item.price || 0) * (parseInt(item.quantity || 1)))
    }, 0)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const validItems = formData.items.filter(item => item.description && item.price > 0)
    if (validItems.length === 0) {
      setError('Please add at least one item with description and price')
      return
    }

    if (formData.payment_method === 'Other' && !formData.payment_method_custom.trim()) {
      setError('Please specify the custom payment method')
      return
    }

    setLoading(true)
    try {
      const receiptData = {
        receipt_number: formData.receipt_number || `RCP-${Date.now()}`,
        customer_name: formData.customer_name || 'Walk-in Customer',
        customer_email: formData.customer_email || null,
        customer_phone: formData.customer_phone || null,
        payment_method: formData.payment_method === 'Other'
          ? formData.payment_method_custom || 'Other'
          : formData.payment_method,
        items: validItems,
        amount: validItems.reduce((sum, item) => sum + (item.quantity * item.price), 0),
        notes: formData.notes || ''
      }

      const newReceipt = await receiptService.createReceipt(business.id, userId, receiptData)
      setReceipts([newReceipt, ...receipts])
      setCreatedReceiptId(newReceipt.id)
      setSendToEmail('')
      setSendToPhone('')
      setShowSendToModal(true)
      setFormData({
        receipt_number: '',
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        payment_method: 'Balance',
        payment_method_custom: '',
        items: [{ description: '', quantity: 1, price: 0 }],
        notes: ''
      })
      generateReceiptNumber()
    } catch (err) {
      console.error('Receipt creation error:', err)
      setError(err.message || 'Failed to create receipt. Please check your input and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSendReceipt = async () => {
    const recipientEmail = sendToEmail || formData.customer_email
    const recipientPhone = sendToPhone || formData.customer_phone

    if (!recipientEmail && !recipientPhone) {
      setError('Please provide an email or phone number to send the receipt to')
      return
    }

    setLoading(true)
    try {
      await receiptService.sendReceipt(createdReceiptId, recipientEmail, recipientPhone)

      setSuccess(`Receipt sent successfully to ${recipientEmail || recipientPhone}!`)
      setTimeout(() => setSuccess(''), 3000)
      setShowSendToModal(false)
      setShowForm(false)
      setCreatedReceiptId(null)

      loadReceipts()
    } catch (err) {
      console.error('Error sending receipt:', err)
      setError(err.message || 'Failed to send receipt')
    } finally {
      setLoading(false)
    }
  }

  const handleSkipSend = () => {
    setSuccess('Receipt created successfully!')
    setTimeout(() => setSuccess(''), 3000)
    setShowSendToModal(false)
    setShowForm(false)
    setCreatedReceiptId(null)
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
                onChange={(e) => setFormData({...formData, payment_method: e.target.value, payment_method_custom: ''})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              >
                <option value="Cash">Cash</option>
                <option value="Balance">Balance</option>
                <option value="Other">Other</option>
              </select>
              {formData.payment_method === 'Other' && (
                <input
                  type="text"
                  value={formData.payment_method_custom}
                  onChange={(e) => setFormData({...formData, payment_method_custom: e.target.value})}
                  placeholder="e.g., Credit Card, Online Transfer, E-Wallet, Check..."
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent mt-2"
                />
              )}
            </div>

            {/* Items Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-medium text-slate-700">Items</label>
                <div className="flex gap-2">
                  {savedItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowSavedItems(!showSavedItems)}
                      className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Saved Items ({savedItems.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + Add Item
                  </button>
                </div>
              </div>

              {showSavedItems && savedItems.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <h5 className="text-sm font-semibold text-green-900 mb-3">Quick Add - Saved Items</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {savedItems.map((savedItem) => (
                      <div key={savedItem.id} className="flex items-center justify-between bg-white p-3 rounded border border-green-200">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{savedItem.name}</p>
                          <p className="text-xs text-slate-600">₱{savedItem.price} × {savedItem.quantity}</p>
                        </div>
                        <div className="flex gap-2 ml-2">
                          <button
                            type="button"
                            onClick={() => handleUseSavedItem(savedItem)}
                            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveSavedItem(savedItem.id)}
                            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {formData.items.map((item, index) => (
                  <div key={index} className={`flex gap-2 ${editingItemIndex === index ? 'bg-blue-50 p-3 rounded-lg border border-blue-200' : ''}`}>
                    <div className="flex-1 flex gap-3">
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
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleSaveItemForFuture(index)}
                        className="px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg text-xs font-medium whitespace-nowrap"
                        title="Save this item for future use"
                      >
                        Save
                      </button>
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

            {/* Business Information - Read Only (Bottom Section) */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">Currency Registration Number</label>
                  <input
                    type="text"
                    value={business.currency_registration_number || 'N/A'}
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

      {/* Save Item Modal */}
      {showSaveItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Save Item for Future Use</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Name this item</label>
              <input
                type="text"
                value={saveItemName}
                onChange={(e) => setSaveItemName(e.target.value)}
                placeholder="e.g., Coffee, T-Shirt Size M, etc."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-2">
                Item: {formData.items[editingItemIndex]?.description} - ���{formData.items[editingItemIndex]?.price}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmSaveItem}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
              >
                Save Item
              </button>
              <button
                onClick={() => {
                  setShowSaveItemModal(false)
                  setSaveItemName('')
                }}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Receipt Modal */}
      {showSendToModal && createdReceiptId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Send Receipt To Customer</h3>
            <p className="text-sm text-slate-600 mb-6">Receipt has been created. Would you like to send it to the customer?</p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Send to Email</label>
                <input
                  type="email"
                  value={sendToEmail || formData.customer_email}
                  onChange={(e) => setSendToEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Or Send to Phone (SMS)</label>
                <input
                  type="tel"
                  value={sendToPhone || formData.customer_phone}
                  onChange={(e) => setSendToPhone(e.target.value)}
                  placeholder="+63912345678"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSendReceipt}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
              >
                Send Receipt
              </button>
              <button
                onClick={handleSkipSend}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium text-sm"
              >
                Skip
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-4 text-center">You can send the receipt anytime from the receipts list</p>
          </div>
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
