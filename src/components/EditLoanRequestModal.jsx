import React, { useState, useEffect } from 'react'
import { p2pLoanService } from '../lib/p2pLoanService'

export default function EditLoanRequestModal({ userId, loan, onClose, onSuccess }) {
  const [amount, setAmount] = useState(String(loan.requested_amount || ''))
  const [currency, setCurrency] = useState(loan.currency_code || 'PHP')
  const [displayName, setDisplayName] = useState(loan.display_name || '')
  const [city, setCity] = useState(loan.city || '')
  const [phoneNumber, setPhoneNumber] = useState(loan.phone_number || '')
  const [loanReason, setLoanReason] = useState(loan.reason_for_loan || 'other')
  const [customReason, setCustomReason] = useState(
    loan.reason_for_loan &&
    !['business_expansion','emergency','education','medical','debt_consolidation'].includes((loan.reason_for_loan || '').toLowerCase().replace(' ', '_'))
      ? loan.reason_for_loan
      : ''
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingOfferCount, setPendingOfferCount] = useState(0)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const count = await p2pLoanService.getPendingOfferCount(loan.id)
        if (mounted) setPendingOfferCount(count)
      } catch (e) {
        // non-fatal
      }
    })()
    return () => { mounted = false }
  }, [loan.id])

  const totalOwed = amount ? Number(parseFloat(amount) * 1.1).toFixed(2) : '0.00'

  const validate = () => {
    if (!amount || parseFloat(amount) <= 0) { setError('Enter a valid amount'); return false }
    if (!displayName.trim()) { setError('Enter your name'); return false }
    if (!city.trim()) { setError('Enter your city'); return false }
    if (!phoneNumber.trim() || phoneNumber.length < 10) { setError('Enter a valid phone number'); return false }
    return true
  }

  const getReasonText = () => {
    if (loanReason === 'other') return customReason || ''
    const label = loanReason.replace('_',' ')
    return label.charAt(0).toUpperCase() + label.slice(1)
  }

  const sqlPreview = () => {
    const reason = getReasonText().replace(/'/g, "''")
    const now = new Date().toISOString()
    const updateSql = `UPDATE loans\nSET requested_amount = ${parseFloat(amount)},\n    currency_code = '${currency}',\n    display_name = '${(displayName || '').replace(/'/g, "''")}',\n    city = '${(city || '').replace(/'/g, "''")}',\n    phone_number = '${(phoneNumber || '').replace(/'/g, "''")}',\n    reason_for_loan = '${reason}',\n    total_owed = ${Number(parseFloat(amount) * 1.1).toFixed(2)},\n    updated_at = '${now}'\nWHERE id = '${loan.id}' AND user_id = '${userId}' AND status = 'pending' AND lender_id IS NULL;`
    const offersSql = `UPDATE loan_offers\nSET status = 'rejected'\nWHERE loan_request_id = '${loan.id}' AND status = 'pending';`
    return `${updateSql}\n\n-- Retract pending offers (if any)\n${offersSql}`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!validate()) return

    try {
      setLoading(true)
      const updates = {
        requested_amount: parseFloat(amount),
        currency_code: currency,
        display_name: displayName,
        city,
        phone_number: phoneNumber,
        reason_for_loan: getReasonText()
      }
      await p2pLoanService.updateLoanRequest(loan.id, userId, updates)
      onSuccess()
    } catch (err) {
      setError(err.message || 'Failed to update loan request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full my-8">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Edit Loan Request</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          {pendingOfferCount > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
              Editing will automatically reject {pendingOfferCount} pending offer{pendingOfferCount>1?'s':''}. Lenders must submit new offers.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Requested Amount</label>
              <div className="flex gap-2">
                <input type="number" step="0.01" min="0" value={amount} onChange={e=>setAmount(e.target.value)} className="flex-1 px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600" />
                <select value={currency} onChange={e=>setCurrency(e.target.value)} className="px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600">
                  <option value="PHP">PHP</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex flex-col justify-center">
              <div className="text-xs text-slate-600">Total with 10% interest</div>
              <div className="text-lg font-semibold text-blue-600">{totalOwed} {currency}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
              <input type="text" value={displayName} onChange={e=>setDisplayName(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">City</label>
              <input type="text" value={city} onChange={e=>setCity(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600" />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
              <input type="tel" value={phoneNumber} onChange={e=>setPhoneNumber(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600" />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Reason for Loan</label>
              <select value={loanReason} onChange={e=>setLoanReason(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600">
                <option value="business_expansion">Business Expansion</option>
                <option value="emergency">Emergency/Personal</option>
                <option value="education">Education</option>
                <option value="medical">Medical</option>
                <option value="debt_consolidation">Debt Consolidation</option>
                <option value="other">Other</option>
              </select>
            </div>

            {loanReason === 'other' && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Please specify the reason</label>
                <textarea rows="2" value={customReason} onChange={e=>setCustomReason(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 resize-none" />
              </div>
            )}
          </div>


          <div className="flex gap-3 border-t border-slate-200 pt-4 mt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">{loading ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
