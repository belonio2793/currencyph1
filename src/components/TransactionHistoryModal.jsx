import React, { useState, useEffect } from 'react'

export default function TransactionHistoryModal({ userId, onClose, loading }) {
  const [transactions, setTransactions] = useState([
    {
      id: 1,
      ride_id: 'ride-001',
      transaction_type: 'fare_payment',
      amount: 450,
      from_user: 'You',
      to_user: 'Driver John',
      status: 'completed',
      created_at: '2024-01-15T14:30:00',
      driver_name: 'Driver John',
      pickup_location: 'Makati',
      dropoff_location: 'BGC'
    },
    {
      id: 2,
      ride_id: 'ride-002',
      transaction_type: 'tip',
      amount: 100,
      from_user: 'You',
      to_user: 'Driver Maria',
      status: 'completed',
      created_at: '2024-01-14T18:45:00',
      driver_name: 'Driver Maria',
      pickup_location: 'Quezon City',
      dropoff_location: 'Manila'
    },
    {
      id: 3,
      ride_id: 'ride-003',
      transaction_type: 'cancellation_fee',
      amount: 50,
      from_user: 'You',
      to_user: 'Driver Mike',
      status: 'completed',
      created_at: '2024-01-13T10:15:00',
      driver_name: 'Driver Mike',
      pickup_location: 'Pasig',
      dropoff_location: 'Makati'
    }
  ])
  const [filter, setFilter] = useState('all')

  const filteredTransactions = filter === 'all' 
    ? transactions 
    : transactions.filter(t => t.transaction_type === filter)

  const getTotalAmount = () => {
    return transactions.reduce((sum, t) => sum + t.amount, 0)
  }

  const getTypeIcon = (type) => {
    switch(type) {
      case 'fare_payment':
        return <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      case 'tip':
        return <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.646 7.746A2 2 0 0110.355 21H5a2 2 0 01-2-2V9a2 2 0 012-2h1.05a2 2 0 011.664.89l5.286 6.11z" /></svg>
      case 'refund':
        return <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6m-6 6h12a6 6 0 010 12h-3" /></svg>
      case 'cancellation_fee':
        return <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      default:
        return <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    }
  }

  const getTypeLabel = (type) => {
    switch(type) {
      case 'fare_payment': return 'Fare Payment'
      case 'tip': return 'Tip'
      case 'refund': return 'Refund'
      case 'cancellation_fee': return 'Cancellation Fee'
      default: return type
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' +
           date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Transaction History</h2>
            <p className="text-sm opacity-80 mt-1">All your ride payments and transactions</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 p-6 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
          <div className="text-center">
            <p className="text-xs text-slate-600 font-medium">Total Spent</p>
            <p className="text-2xl font-bold text-slate-900">₱{getTotalAmount()}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-600 font-medium">Total Rides</p>
            <p className="text-2xl font-bold text-blue-600">{transactions.filter(t => t.transaction_type === 'fare_payment').length}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-600 font-medium">Total Tips</p>
            <p className="text-2xl font-bold text-green-600">₱{transactions.filter(t => t.transaction_type === 'tip').reduce((sum, t) => sum + t.amount, 0)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-600 font-medium">Avg per Ride</p>
            <p className="text-2xl font-bold text-slate-900">₱{(getTotalAmount() / transactions.filter(t => t.transaction_type === 'fare_payment').length).toFixed(0)}</p>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2 p-4 border-b border-slate-200 bg-white overflow-x-auto">
          {[
            { id: 'all', label: 'All Transactions' },
            { id: 'fare_payment', label: 'Fares' },
            { id: 'tip', label: 'Tips' },
            { id: 'refund', label: 'Refunds' },
            { id: 'cancellation_fee', label: 'Cancellations' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors text-sm ${
                filter === f.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Transactions List */}
        <div className="flex-1 overflow-y-auto">
          {filteredTransactions.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-500 text-center">No transactions found</p>
            </div>
          ) : (
            <div className="space-y-2 p-4">
              {filteredTransactions.map(transaction => (
                <div
                  key={transaction.id}
                  className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getTypeIcon(transaction.transaction_type)}</div>
                      <div>
                        <h4 className="font-semibold text-slate-900">{getTypeLabel(transaction.transaction_type)}</h4>
                        <p className="text-xs text-slate-600">{transaction.driver_name}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {transaction.pickup_location} → {transaction.dropoff_location}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-slate-900">₱{transaction.amount}</p>
                      <p className={`text-xs font-semibold ${
                        transaction.status === 'completed' ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">{formatDate(transaction.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
