import React, { useState } from 'react'
import { p2pLoanService } from '../lib/p2pLoanService'

const REPAYMENT_SCHEDULES = [
  { value: 'lump_sum', label: 'Lump Sum (Full amount at end)' },
  { value: 'monthly', label: 'Monthly Payments' },
  { value: 'weekly', label: 'Weekly Payments' }
]

const PAYMENT_METHODS = [
  { value: 'cash', label: '💵 Cash' },
  { value: 'gcash', label: '📱 GCash' },
  { value: 'crypto', label: '🔐 Crypto' },
  { value: 'bank_transfer', label: '🏦 Bank Transfer' }
]

export default function SubmitLoanOfferModal({ userId, loanRequest, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    offeredAmount: loanRequest.requested_amount,
    interestRate: 5,
    durationDays: 180,
    repaymentSchedule: 'monthly',
    paymentMethod: 'gcash',
    usePlatformFacilitation: false
  })

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const calculateDueDate = () => {
    const date = new Date()
    date.setDate(date.getDate() + parseInt(formData.durationDays))
    return date
  }

  const calculateTotalWithInterest = () => {
    const amount = parseFloat(formData.offeredAmount)
    const interest = (amount * (parseFloat(formData.interestRate) / 100))
    return amount + interest
  }

  const calculatePlatformFee = () => {
    if (!formData.usePlatformFacilitation) return 0
    return parseFloat(formData.offeredAmount) * 0.10
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Validation
      if (parseFloat(formData.offeredAmount) <= 0) {
        throw new Error('Offer amount must be greater than 0')
      }
      if (parseFloat(formData.interestRate) < 0) {
        throw new Error('Interest rate cannot be negative')
      }
      if (parseInt(formData.durationDays) <= 0) {
        throw new Error('Duration must be greater than 0')
      }

      const dueDate = calculateDueDate()

      await p2pLoanService.submitLoanOffer(
        loanRequest.id,
        userId,
        {
          offered_amount: parseFloat(formData.offeredAmount),
          interest_rate: parseFloat(formData.interestRate),
          duration_days: parseInt(formData.durationDays),
          due_date: dueDate.toISOString(),
          repayment_schedule: formData.repaymentSchedule,
          payment_method: formData.paymentMethod,
          use_platform_facilitation: formData.usePlatformFacilitation
        }
      )

      setSuccess(true)
      setTimeout(() => {
        if (onSuccess) onSuccess()
        onClose()
      }, 2000)
    } catch (err) {
      setError(err.message || 'Failed to submit offer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Submit Loan Offer</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Loan Request Summary */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
          <p className="text-sm text-blue-900">
            <strong>Requested Amount:</strong> {loanRequest.currency_code} {loanRequest.requested_amount}
          </p>
          <p className="text-sm text-blue-900 mt-1">
            <strong>City:</strong> {loanRequest.city}
          </p>
          {loanRequest.reason_for_loan && (
            <p className="text-sm text-blue-900 mt-1">
              <strong>Reason:</strong> {loanRequest.reason_for_loan}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
            ✓ Offer submitted successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Offered Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Offered Amount ({loanRequest.currency_code})
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.offeredAmount}
              onChange={(e) => handleChange('offeredAmount', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <p className="text-xs text-slate-600 mt-1">
              You can offer less or equal to the requested amount
            </p>
          </div>

          {/* Interest Rate */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Interest Rate (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="50"
              value={formData.interestRate}
              onChange={(e) => handleChange('interestRate', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <p className="text-xs text-slate-600 mt-1">
              Set your interest rate (0-50%)
            </p>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Loan Duration (Days)
            </label>
            <input
              type="number"
              min="1"
              max="3650"
              value={formData.durationDays}
              onChange={(e) => handleChange('durationDays', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <p className="text-xs text-slate-600 mt-1">
              Due date: {calculateDueDate().toLocaleDateString()}
            </p>
          </div>

          {/* Repayment Schedule */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Repayment Schedule
            </label>
            <select
              value={formData.repaymentSchedule}
              onChange={(e) => handleChange('repaymentSchedule', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              {REPAYMENT_SCHEDULES.map(schedule => (
                <option key={schedule.value} value={schedule.value}>
                  {schedule.label}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Preferred Payment Method
            </label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => handleChange('paymentMethod', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              {PAYMENT_METHODS.map(method => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>

          {/* Platform Facilitation */}
          <div className="p-3 bg-slate-50 rounded-lg">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={formData.usePlatformFacilitation}
                onChange={(e) => handleChange('usePlatformFacilitation', e.target.checked)}
                className="mt-1 w-4 h-4 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Use Platform for Transaction Facilitation
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  If checked, platform will take 10% fee from the total amount
                </p>
              </div>
            </label>
          </div>

          {/* Summary */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-700">Offered Amount:</span>
              <span className="font-semibold text-slate-900">
                {formData.offeredAmount} {loanRequest.currency_code}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-700">Interest ({formData.interestRate}%):</span>
              <span className="font-semibold text-slate-900">
                {(parseFloat(formData.offeredAmount) * (parseFloat(formData.interestRate) / 100)).toFixed(2)} {loanRequest.currency_code}
              </span>
            </div>
            {formData.usePlatformFacilitation && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-700">Platform Fee (10%):</span>
                <span className="font-semibold text-slate-900">
                  {calculatePlatformFee().toFixed(2)} {loanRequest.currency_code}
                </span>
              </div>
            )}
            <div className="flex justify-between text-base border-t pt-2">
              <span className="font-bold text-slate-900">Total with Interest:</span>
              <span className="font-bold text-blue-600">
                {calculateTotalWithInterest().toFixed(2)} {loanRequest.currency_code}
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {loading ? 'Submitting...' : 'Submit Offer'}
          </button>
        </form>
      </div>
    </div>
  )
}
