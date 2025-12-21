import React, { useState, useEffect } from 'react'
import { useDevice } from '../context/DeviceContext'
import ExpandableModal from './ExpandableModal'

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
  const { isMobile } = useDevice()

  const filteredTransactions = filter === 'all' 
    ? transactions 
    : transactions.filter(t => t.transaction_type === filter)

  const getTotalAmount = () => {
    return transactions.reduce((sum, t) => sum + t.amount, 0)
  }

  const getTypeIcon = (type) => {
    switch(type) {
      case 'fare_payment':
        return '💳'
      case 'tip':
        return '👍'
      case 'refund':
        return '↩️'
      case 'cancellation_fee':
        return '❌'
      default:
        return '⚡'
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
           date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const footer = (
    <button
      onClick={onClose}
      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
    >
      Close
    </button>
  )

  return (
    <ExpandableModal
      isOpen={true}
      onClose={onClose}
      title="Transaction History"
      icon="📊"
      size={isMobile ? 'fullscreen' : 'lg'}
      footer={footer}
      defaultExpanded={!isMobile}
    >
      <div className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs text-slate-600 font-medium">Total Spent</p>
            <p className="text-lg font-bold text-slate-900">₱{getTotalAmount()}</p>
          </div>
          <div className="text-center bg-blue-50 rounded-lg p-3 border border-blue-200">
            <p className="text-xs text-slate-600 font-medium">Total Rides</p>
            <p className="text-lg font-bold text-blue-600">{transactions.filter(t => t.transaction_type === 'fare_payment').length}</p>
          </div>
          <div className="text-center bg-green-50 rounded-lg p-3 border border-green-200">
            <p className="text-xs text-slate-600 font-medium">Total Tips</p>
            <p className="text-lg font-bold text-green-600">₱{transactions.filter(t => t.transaction_type === 'tip').reduce((sum, t) => sum + t.amount, 0)}</p>
          </div>
          <div className="text-center bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs text-slate-600 font-medium">Avg per Ride</p>
            <p className="text-lg font-bold text-slate-900">₱{(getTotalAmount() / Math.max(1, transactions.filter(t => t.transaction_type === 'fare_payment').length)).toFixed(0)}</p>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'all', label: 'All' },
            { id: 'fare_payment', label: 'Fares' },
            { id: 'tip', label: 'Tips' },
            { id: 'refund', label: 'Refunds' },
            { id: 'cancellation_fee', label: 'Cancel' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors text-xs ${
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
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500">No transactions found</p>
            </div>
          ) : (
            filteredTransactions.map(transaction => (
              <div
                key={transaction.id}
                className="bg-white border border-slate-200 rounded-lg p-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-2">
                    <span className="text-xl">{getTypeIcon(transaction.transaction_type)}</span>
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">{getTypeLabel(transaction.transaction_type)}</h4>
                      <p className="text-xs text-slate-600">{transaction.driver_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {transaction.pickup_location} → {transaction.dropoff_location}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">₱{transaction.amount}</p>
                    <p className={`text-xs font-semibold ${
                      transaction.status === 'completed' ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-600">{formatDate(transaction.created_at)}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </ExpandableModal>
  )
}
