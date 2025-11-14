import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function SalesAndTaxReporting({ businessId, userId }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [dateRange, setDateRange] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'office-supplies',
    cost_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    notes: ''
  })

  useEffect(() => {
    loadTransactions()
  }, [businessId, dateRange])

  const loadTransactions = async () => {
    if (!businessId) return
    
    setLoading(true)
    try {
      // Get receipts (income/credit)
      const { data: receipts, error: receiptError } = await supabase
        .from('business_receipts')
        .select('*')
        .eq('business_id', businessId)

      if (receiptError) throw receiptError

      // Get miscellaneous costs (expenses/debit)
      const { data: costs, error: costError } = await supabase
        .from('miscellaneous_costs')
        .select('*')
        .eq('business_id', businessId)

      if (costError) throw costError

      // Convert to unified transaction format
      const receiptTransactions = (receipts || []).map(r => ({
        id: r.id,
        type: 'receipt',
        date: r.created_at,
        description: `Receipt #${r.receipt_number}`,
        debit: 0,
        credit: parseFloat(r.amount) || 0,
        category: 'sales',
        customer: r.customer_name,
        rawData: r
      }))

      const costTransactions = (costs || []).map(c => ({
        id: c.id,
        type: 'cost',
        date: c.cost_date,
        description: c.description,
        debit: parseFloat(c.amount) || 0,
        credit: 0,
        category: c.category || 'uncategorized',
        paymentMethod: c.payment_method,
        rawData: c
      }))

      const allTransactions = [...receiptTransactions, ...costTransactions]
        .sort((a, b) => new Date(a.date) - new Date(b.date))

      setTransactions(allTransactions)
      setError('')
    } catch (err) {
      console.error('Error loading transactions:', err)
      setError('Failed to load transaction data')
    } finally {
      setLoading(false)
    }
  }

  const handleAddCost = async (e) => {
    e.preventDefault()
    
    if (!formData.description || !formData.amount) {
      setError('Please fill in all required fields')
      return
    }

    try {
      const { error: insertError } = await supabase
        .from('miscellaneous_costs')
        .insert([{
          business_id: businessId,
          user_id: userId,
          description: formData.description,
          amount: parseFloat(formData.amount),
          category: formData.category,
          cost_date: formData.cost_date,
          payment_method: formData.payment_method,
          notes: formData.notes,
          status: 'recorded'
        }])

      if (insertError) throw insertError

      setFormData({
        description: '',
        amount: '',
        category: 'office-supplies',
        cost_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
        notes: ''
      })
      setShowAddForm(false)
      setError('')
      loadTransactions()
    } catch (err) {
      console.error('Error adding cost:', err)
      setError('Failed to add cost')
    }
  }

  // Filter transactions by date range
  const getFilteredTransactions = () => {
    let filtered = transactions

    if (dateRange !== 'all') {
      const now = new Date()
      const startDate = new Date()

      switch (dateRange) {
        case 'month':
          startDate.setMonth(now.getMonth() - 1)
          break
        case 'quarter':
          startDate.setMonth(now.getMonth() - 3)
          break
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1)
          break
        default:
          break
      }

      filtered = filtered.filter(t => new Date(t.date) >= startDate)
    }

    if (filterCategory !== 'all') {
      filtered = filtered.filter(t => t.category === filterCategory)
    }

    return filtered
  }

  const filteredTransactions = getFilteredTransactions()

  // Calculate running balance and totals
  let runningBalance = 0
  const transactionsWithBalance = filteredTransactions.map(t => {
    runningBalance += (t.credit - t.debit)
    return { ...t, balance: runningBalance }
  })

  const totals = filteredTransactions.reduce(
    (acc, t) => ({
      debit: acc.debit + t.debit,
      credit: acc.credit + t.credit
    }),
    { debit: 0, credit: 0 }
  )

  const netIncome = totals.credit - totals.debit
  const taxRate = 0.12 // 12% VAT in Philippines
  const taxableAmount = Math.max(0, netIncome)
  const estimatedTax = taxableAmount * taxRate

  const categories = [
    { value: 'office-supplies', label: 'Office Supplies' },
    { value: 'utilities', label: 'Utilities' },
    { value: 'rent', label: 'Rent' },
    { value: 'salaries', label: 'Salaries' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'travel', label: 'Travel' },
    { value: 'meals', label: 'Meals & Entertainment' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'other', label: 'Other' }
  ]

  const paymentMethods = [
    { value: 'cash', label: 'Cash' },
    { value: 'check', label: 'Check' },
    { value: 'bank-transfer', label: 'Bank Transfer' },
    { value: 'credit-card', label: 'Credit Card' },
    { value: 'online', label: 'Online Payment' }
  ]

  if (loading) {
    return <div className="text-center py-12">Loading transactions...</div>
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-600 font-medium mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-blue-900">₱{totals.credit.toFixed(2)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600 font-medium mb-1">Total Expenses</p>
          <p className="text-2xl font-bold text-red-900">₱{totals.debit.toFixed(2)}</p>
        </div>
        <div className={`border rounded-lg p-4 ${netIncome >= 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
          <p className={`text-sm font-medium mb-1 ${netIncome >= 0 ? 'text-green-600' : 'text-orange-600'}`}>Net Income</p>
          <p className={`text-2xl font-bold ${netIncome >= 0 ? 'text-green-900' : 'text-orange-900'}`}>₱{netIncome.toFixed(2)}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-purple-600 font-medium mb-1">Est. Tax (12%)</p>
          <p className="text-2xl font-bold text-purple-900">₱{estimatedTax.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-sm"
              >
                <option value="all">All Time</option>
                <option value="month">Last Month</option>
                <option value="quarter">Last 3 Months</option>
                <option value="year">Last Year</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-sm"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
                <option value="sales">Sales (Receipts)</option>
              </select>
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
          >
            {showAddForm ? 'Cancel' : '+ Add Expense'}
          </button>
        </div>
      </div>

      {/* Add New Cost Form */}
      {showAddForm && (
        <form onSubmit={handleAddCost} className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Record New Expense</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Description *</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="e.g., Office rent, Supplies purchase"
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Amount (₱) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                placeholder="0.00"
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Date</label>
              <input
                type="date"
                value={formData.cost_date}
                onChange={(e) => setFormData({...formData, cost_date: e.target.value})}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Payment Method</label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              >
                {paymentMethods.map(method => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Notes</label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Additional notes (optional)"
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Save Expense
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-900">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-900">Description</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-900">Category</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-900">Debit</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-900">Credit</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-900">Balance</th>
              </tr>
            </thead>
            <tbody>
              {transactionsWithBalance.map((transaction, idx) => (
                <tr key={transaction.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-4 py-3 text-slate-700">
                    {new Date(transaction.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {transaction.description}
                    {transaction.customer && <span className="block text-xs text-slate-500">{transaction.customer}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    <span className={`px-2 py-1 rounded ${
                      transaction.category === 'sales' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {transaction.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {transaction.debit > 0 ? `₱${transaction.debit.toFixed(2)}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-green-600">
                    {transaction.credit > 0 ? `₱${transaction.credit.toFixed(2)}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    ₱{transaction.balance.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-semibold">
              <tr>
                <td colSpan="3" className="px-4 py-3 text-right">TOTALS:</td>
                <td className="px-4 py-3 text-right">₱{totals.debit.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-green-600">₱{totals.credit.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">₱{netIncome.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {transactionsWithBalance.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            No transactions found for the selected period.
          </div>
        )}
      </div>

      {/* Tax Information */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Tax Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-slate-600 mb-1">Gross Revenue</p>
            <p className="text-2xl font-bold text-purple-900">₱{totals.credit.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600 mb-1">Total Deductible Expenses</p>
            <p className="text-2xl font-bold text-purple-900">₱{totals.debit.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600 mb-1">Est. Tax Due (12% VAT)</p>
            <p className="text-2xl font-bold text-purple-900">₱{estimatedTax.toFixed(2)}</p>
          </div>
        </div>
        <p className="text-xs text-slate-600 mt-4">
          * Tax calculations are estimates based on 12% VAT. Please consult with a certified tax professional for accurate tax filing.
        </p>
      </div>
    </div>
  )
}
