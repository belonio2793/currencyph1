import { useState, useEffect } from 'react'
import { wisegcashAPI } from '../lib/wisegcashAPI'

export default function BillPayments({ userId }) {
  const [bills, setBills] = useState([])
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddBill, setShowAddBill] = useState(false)
  const [showPayBill, setShowPayBill] = useState(false)
  const [selectedBill, setSelectedBill] = useState(null)
  const [selectedCurrency, setSelectedCurrency] = useState('PHP')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paying, setPaying] = useState(false)

  const [billForm, setBillForm] = useState({
    biller_category: 'electricity',
    biller_name: '',
    account_number: ''
  })

  const billerCategories = [
    { value: 'electricity', label: 'Electricity' },
    { value: 'water', label: 'Water' },
    { value: 'internet', label: 'Internet' },
    { value: 'phone', label: 'Phone' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'loan', label: 'Loan Payment' },
    { value: 'subscription', label: 'Subscription' },
    { value: 'other', label: 'Other' }
  ]

  useEffect(() => {
    loadData()
  }, [userId])

  const loadData = async () => {
    try {
      const [billsData, walletsData] = await Promise.all([
        wisegcashAPI.getBills(userId),
        wisegcashAPI.getWallets(userId)
      ])
      setBills(billsData)
      setWallets(walletsData)
      if (walletsData.length > 0) {
        setSelectedCurrency(walletsData[0].currency_code)
      }
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Failed to load bills')
    } finally {
      setLoading(false)
    }
  }

  const handleAddBill = async (e) => {
    e.preventDefault()
    setError('')

    if (!billForm.biller_name || !billForm.account_number) {
      setError('Please fill in all fields')
      return
    }

    try {
      await wisegcashAPI.createBill(userId, billForm)
      setSuccess('Bill added successfully!')
      setBillForm({ biller_category: 'electricity', biller_name: '', account_number: '' })
      setShowAddBill(false)
      loadData()
    } catch (err) {
      setError(err.message || 'Failed to add bill')
    }
  }

  const handlePayBill = async (e) => {
    e.preventDefault()
    setError('')
    setPaying(true)

    try {
      if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
        throw new Error('Please enter a valid amount')
      }

      await wisegcashAPI.payBill(selectedBill.id, userId, parseFloat(paymentAmount), selectedCurrency)
      setSuccess(`Payment successful!`)
      setPaymentAmount('')
      setShowPayBill(false)
      setTimeout(() => {
        setSuccess('')
        loadData()
      }, 2000)
    } catch (err) {
      setError(err.message || 'Failed to pay bill')
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center text-slate-500">Loading bills...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-12">
        <h2 className="text-3xl font-light text-slate-900 tracking-tight">Pay Bills</h2>
        <button
          onClick={() => setShowAddBill(true)}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          Add Bill
        </button>
      </div>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">{success}</div>}

      {/* Bills List */}
      {bills.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500 text-sm mb-4">No bills added yet</p>
          <button
            onClick={() => setShowAddBill(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Add Your First Bill
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {bills.map(bill => (
            <div key={bill.id} className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-slate-900">{bill.biller_name}</h3>
                  <p className="text-sm text-slate-500 mt-1">{bill.account_number}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  bill.status === 'paid'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}
                </span>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Category</p>
                <p className="text-sm text-slate-900 mb-4">
                  {billerCategories.find(c => c.value === bill.biller_category)?.label || bill.biller_category}
                </p>

                {bill.status === 'pending' && (
                  <button
                    onClick={() => {
                      setSelectedBill(bill)
                      setShowPayBill(true)
                    }}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                  >
                    Pay Now
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Bill Modal */}
      {showAddBill && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-light text-slate-900 mb-6">Add Bill</h3>

            <form onSubmit={handleAddBill} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Bill Category</label>
                <select
                  value={billForm.biller_category}
                  onChange={e => setBillForm({...billForm, biller_category: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                >
                  {billerCategories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Biller Name</label>
                <input
                  type="text"
                  value={billForm.biller_name}
                  onChange={e => setBillForm({...billForm, biller_name: e.target.value})}
                  placeholder="e.g., Manila Electric Company"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Account Number</label>
                <input
                  type="text"
                  value={billForm.account_number}
                  onChange={e => setBillForm({...billForm, account_number: e.target.value})}
                  placeholder="Your account number"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddBill(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                  Add Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Bill Modal */}
      {showPayBill && selectedBill && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-light text-slate-900 mb-2">Pay Bill</h3>
            <p className="text-slate-500 text-sm mb-6">{selectedBill.biller_name}</p>

            <form onSubmit={handlePayBill} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">From</label>
                <select
                  value={selectedCurrency}
                  onChange={e => setSelectedCurrency(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                >
                  {wallets.map(w => (
                    <option key={w.id} value={w.currency_code}>
                      {w.currency_code} - Balance: {w.balance.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPayBill(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paying}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50"
                >
                  {paying ? 'Processing...' : 'Pay Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
