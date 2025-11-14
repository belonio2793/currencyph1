import React, { useState, useEffect } from 'react'
import { receiptService } from '../lib/receiptService'
import ReceiptTemplate from './ReceiptTemplate'

export default function ReceiptHistory({ userEmail, userPhone, userId }) {
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState('')
  const [filterBy, setFilterBy] = useState('all')

  useEffect(() => {
    loadReceipts()
  }, [userEmail, userPhone])

  const loadReceipts = async () => {
    if (!userEmail && !userPhone) {
      setReceipts([])
      return
    }

    setLoading(true)
    try {
      const data = await receiptService.getUserReceipts(userEmail, userPhone)
      setReceipts(data)
      setError('')
    } catch (err) {
      setError('Failed to load receipt history')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filteredReceipts = receipts.filter(r => {
    if (filterBy === 'this-month') {
      const now = new Date()
      const receiptDate = new Date(r.created_at)
      return receiptDate.getMonth() === now.getMonth() && receiptDate.getFullYear() === now.getFullYear()
    }
    if (filterBy === 'this-year') {
      const now = new Date()
      const receiptDate = new Date(r.created_at)
      return receiptDate.getFullYear() === now.getFullYear()
    }
    return true
  }).filter(r =>
    r.receipt_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.businesses?.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalAmount = filteredReceipts.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0)
  const totalReceipts = filteredReceipts.length

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
          Back to Receipt History
        </button>
        <ReceiptTemplate receipt={selectedReceipt} business={selectedReceipt.businesses} />
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

      {/* Summary Cards */}
      {receipts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-600 font-medium mb-1">Total Receipts</p>
            <p className="text-3xl font-bold text-blue-900">{receipts.length}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-600 font-medium mb-1">Total Amount</p>
            <p className="text-3xl font-bold text-green-900">₱{receipts.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0).toFixed(2)}</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-600 font-medium mb-1">Businesses</p>
            <p className="text-3xl font-bold text-purple-900">{new Set(receipts.map(r => r.business_id)).size}</p>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Search Receipts</label>
          <input
            type="text"
            placeholder="Search by receipt number, business name, or customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Filter by Period</label>
          <div className="flex gap-2">
            {[
              { value: 'all', label: 'All Time' },
              { value: 'this-month', label: 'This Month' },
              { value: 'this-year', label: 'This Year' }
            ].map(filter => (
              <button
                key={filter.value}
                onClick={() => setFilterBy(filter.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterBy === filter.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Receipts List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-slate-500">Loading receipt history...</p>
        </div>
      ) : filteredReceipts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Receipts Yet</h3>
          <p className="text-slate-600 mb-4">
            {!userEmail && !userPhone
              ? 'Update your email or phone number in your profile to view your receipt history.'
              : 'You don\'t have any receipts yet. Receipts from businesses will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats for filtered results */}
          {filterBy !== 'all' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>{totalReceipts}</strong> receipt{totalReceipts !== 1 ? 's' : ''} totaling <strong>₱{totalAmount.toFixed(2)}</strong> in this period
              </p>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Receipt #</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Business</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Date</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-900">Amount</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Payment Method</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-900">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceipts.map((receipt) => (
                    <tr key={receipt.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-sm font-medium text-slate-900">{receipt.receipt_number}</td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-900">{receipt.businesses?.business_name || 'Unknown Business'}</p>
                          <p className="text-xs text-slate-500">{receipt.businesses?.city_of_registration}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {new Date(receipt.created_at).toLocaleDateString('en-PH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                        <div className="text-xs text-slate-500">
                          {new Date(receipt.created_at).toLocaleTimeString('en-PH', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-900">₱{parseFloat(receipt.amount).toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{receipt.payment_method}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedReceipt(receipt)}
                          className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded text-sm font-medium transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
