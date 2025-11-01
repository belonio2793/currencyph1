import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function RequestLoanModal({ userId, loanType, onClose, onSuccess, wallets }) {
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('PHP')
  const [displayName, setDisplayName] = useState('')
  const [city, setCity] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [totalOwed, setTotalOwed] = useState(0)
  const [loanReason, setLoanReason] = useState('other')
  const [customReason, setCustomReason] = useState('')

  useEffect(() => {
    if (amount) {
      const parsedAmount = parseFloat(amount)
      const total = parsedAmount * 1.1 // 10% interest
      setTotalOwed(total)
    } else {
      setTotalOwed(0)
    }
  }, [amount])

  const validateForm = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount')
      return false
    }
    if (!displayName.trim()) {
      setError('Please enter your name')
      return false
    }
    if (!city.trim()) {
      setError('Please enter your city')
      return false
    }
    if (!phoneNumber.trim() || phoneNumber.length < 10) {
      setError('Please enter a valid phone number')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    try {
      setLoading(true)
      setError('')

      // Call the create_loan_request function
      const { data, error: err } = await supabase.rpc('create_loan_request', {
        p_user_id: userId,
        p_loan_type: loanType,
        p_requested_amount: parseFloat(amount),
        p_currency_code: currency,
        p_display_name: displayName,
        p_city: city,
        p_phone_number: phoneNumber
      })

      if (err) throw err

      // Success
      onSuccess()
    } catch (err) {
      console.error('Error creating loan request:', err)
      setError(err.message || 'Failed to create loan request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            Request {loanType === 'personal' ? 'Personal' : 'Business'} Loan
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Requested Amount *
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="flex-1 px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                step="0.01"
                min="0"
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              >
                <option value="PHP">PHP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          {/* Total Owed Preview */}
          {amount && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-slate-600">Total Amount to Pay (with 10% interest)</div>
              <div className="text-xl font-semibold text-blue-600">
                {Number(totalOwed).toFixed(2)} {currency}
              </div>
            </div>
          )}

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your full name"
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              City *
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Your city"
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Phone Number * (Will be stored securely)
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+63 9XX XXX XXXX"
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* Terms Checkbox */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="terms"
              required
              className="w-4 h-4"
            />
            <label htmlFor="terms" className="text-sm text-slate-600">
              I agree to the loan terms and will repay the full amount with interest
            </label>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Request Loan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
