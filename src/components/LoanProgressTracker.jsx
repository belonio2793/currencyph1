import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { p2pLoanService } from '../lib/p2pLoanService'

export default function LoanProgressTracker({ loanId, userId, onClose }) {
  const [loan, setLoan] = useState(null)
  const [paymentSchedule, setPaymentSchedule] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showMarkPayment, setShowMarkPayment] = useState(false)
  const [selectedScheduleId, setSelectedScheduleId] = useState(null)

  useEffect(() => {
    loadLoanData()
  }, [loanId])

  const loadLoanData = async () => {
    try {
      setLoading(true)

      // Get loan details
      const { data: loanData, error: loanError } = await supabase
        .from('loans')
        .select('*')
        .eq('id', loanId)
        .single()

      if (loanError) throw loanError
      setLoan(loanData)

      // Get payment schedule
      const schedule = await p2pLoanService.getPaymentSchedule(loanId)
      setPaymentSchedule(schedule)
    } catch (err) {
      console.error('Error loading loan data:', err)
      setError('Failed to load loan details')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full text-center">
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!loan) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full text-center">
          <p className="text-red-600">{error || 'Loan not found'}</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  const progressPercentage = loan.requested_amount > 0
    ? (loan.amount_paid / loan.total_owed) * 100
    : 0

  const isOverdue = new Date(loan.due_date) < new Date() && loan.status !== 'completed'
  const daysPastDue = isOverdue
    ? Math.floor((new Date() - new Date(loan.due_date)) / (1000 * 60 * 60 * 24))
    : 0

  const isLoanOwner = loan.user_id === userId
  const isLender = loan.lender_id === userId

  const totalPenalties = paymentSchedule
    .filter(p => p.status === 'late' || p.status === 'missed')
    .reduce((sum, p) => sum + (parseFloat(p.penalty_amount) || 0), 0)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Loan Progress</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-900 uppercase font-semibold mb-1">Total Owed</p>
              <p className="text-2xl font-bold text-blue-600">{loan.total_owed.toFixed(2)}</p>
              <p className="text-xs text-blue-700 mt-1">{loan.currency_code}</p>
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs text-green-900 uppercase font-semibold mb-1">Amount Paid</p>
              <p className="text-2xl font-bold text-green-600">{(loan.amount_paid || 0).toFixed(2)}</p>
              <p className="text-xs text-green-700 mt-1">{loan.currency_code}</p>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-900 uppercase font-semibold mb-1">Remaining</p>
              <p className="text-2xl font-bold text-amber-600">{(loan.remaining_balance || 0).toFixed(2)}</p>
              <p className="text-xs text-amber-700 mt-1">{loan.currency_code}</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-slate-900">Repayment Progress</p>
              <p className="text-sm text-slate-600">{progressPercentage.toFixed(1)}%</p>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-green-600 h-3 transition-all duration-300"
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Status & Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-600 uppercase font-semibold mb-1">Status</p>
              <p className={`font-semibold ${
                loan.status === 'completed' ? 'text-green-600' :
                loan.status === 'active' ? 'text-blue-600' :
                loan.status === 'pending' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-600 uppercase font-semibold mb-1">Interest Rate</p>
              <p className="font-semibold text-slate-900">{loan.interest_rate}%</p>
            </div>

            <div>
              <p className="text-xs text-slate-600 uppercase font-semibold mb-1">Original Due Date</p>
              <p className="font-semibold text-slate-900">
                {new Date(loan.original_due_date || loan.due_date).toLocaleDateString()}
              </p>
            </div>

            {isOverdue && (
              <div className="bg-red-50 border border-red-200 rounded p-2">
                <p className="text-xs text-red-900 uppercase font-semibold mb-1">Days Past Due</p>
                <p className="font-bold text-red-600">{daysPastDue} days</p>
              </div>
            )}
          </div>

          {/* Penalties Warning */}
          {totalPenalties > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="font-semibold text-red-900 mb-1">⚠️ Late Payment Penalties</p>
              <p className="text-sm text-red-700">
                Total penalties: {totalPenalties.toFixed(2)} {loan.currency_code}
              </p>
              <p className="text-xs text-red-600 mt-2">
                Payments made after the due date incur penalties. Stay on schedule to avoid additional charges.
              </p>
            </div>
          )}

          {/* Payment Schedule */}
          {paymentSchedule.length > 0 && (
            <div>
              <h3 className="font-bold text-slate-900 mb-3">Payment Schedule</h3>
              <div className="space-y-2">
                {paymentSchedule.map(schedule => {
                  const isLate = schedule.status === 'late' || schedule.status === 'missed'
                  const isPast = new Date(schedule.due_date) < new Date()

                  return (
                    <div
                      key={schedule.id}
                      className={`p-3 rounded-lg border ${
                        schedule.status === 'completed'
                          ? 'bg-green-50 border-green-200'
                          : isLate
                          ? 'bg-red-50 border-red-200'
                          : isPast && schedule.status === 'pending'
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">
                            Payment #{schedule.payment_number}
                          </p>
                          <p className="text-sm text-slate-600 mt-1">
                            Due: {new Date(schedule.due_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-900">
                            {schedule.amount_due.toFixed(2)} {loan.currency_code}
                          </p>
                          <p className={`text-xs font-semibold ${
                            schedule.status === 'completed' ? 'text-green-600' :
                            schedule.status === 'late' ? 'text-red-600' :
                            schedule.status === 'missed' ? 'text-red-700' :
                            'text-yellow-600'
                          }`}>
                            {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                          </p>
                        </div>
                      </div>

                      {schedule.amount_paid > 0 && (
                        <p className="text-xs text-slate-600 mt-2">
                          Paid: {schedule.amount_paid.toFixed(2)} {loan.currency_code}
                        </p>
                      )}

                      {schedule.penalty_amount > 0 && (
                        <p className="text-xs text-red-600 mt-2">
                          Penalty: {schedule.penalty_amount.toFixed(2)} {loan.currency_code}
                        </p>
                      )}

                      {isLoanOwner && schedule.status === 'pending' && (
                        <button
                          onClick={() => {
                            setSelectedScheduleId(schedule.id)
                            setShowMarkPayment(true)
                          }}
                          className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                        >
                          Mark as Paid
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Platform Fee Info */}
          {loan.platform_fee_applied && loan.platform_fee_amount && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="font-semibold text-slate-900 mb-1">Platform Facilitation Fee</p>
              <p className="text-sm text-slate-700">
                {loan.platform_fee_amount.toFixed(2)} {loan.currency_code} (10% of transaction)
              </p>
            </div>
          )}

          {/* Action Buttons */}
          {isLoanOwner && loan.status === 'active' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900 mb-3">
                Make a payment or message your lender for more information.
              </p>
              <div className="flex gap-2">
                <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
                  💳 Make Payment
                </button>
                <button className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium text-sm">
                  💬 Message Lender
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
