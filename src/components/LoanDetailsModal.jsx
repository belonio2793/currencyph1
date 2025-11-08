import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { p2pLoanService } from '../lib/p2pLoanService'
import { tokenAPI } from '../lib/supabaseClient'

export default function LoanDetailsModal({ loan, userId, onClose, onSubmitOffer }) {
  const [borrowerInfo, setBorrowerInfo] = useState(null)
  const [borrowerRating, setBorrowerRating] = useState(null)
  const [borrowerRatings, setBorrowerRatings] = useState([])
  const [verificationStatus, setVerificationStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showOfferForm, setShowOfferForm] = useState(false)
  const [hasAcceptedOffer, setHasAcceptedOffer] = useState(false)
  const [isViewingOwnLoan, setIsViewingOwnLoan] = useState(false)

  // Offer form state
  const [offerAmount, setOfferAmount] = useState(loan?.requested_amount || '')
  const [interestRate, setInterestRate] = useState('12')
  const [durationDays, setDurationDays] = useState('30')
  const [repaymentSchedule, setRepaymentSchedule] = useState('monthly')
  const [paymentMethod, setPaymentMethod] = useState('gcash')
  const [usePlatformFacilitation, setUsePlatformFacilitation] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    loadBorrowerInfo()
  }, [loan])

  const loadBorrowerInfo = async () => {
    try {
      setLoading(true)

      // Check if viewing own loan
      const isOwnLoan = userId && userId === loan.user_id
      setIsViewingOwnLoan(isOwnLoan)

      // Check for accepted offer between current user and borrower
      let hasAccepted = false
      if (userId && userId !== loan.user_id && !userId.includes('guest')) {
        try {
          const { data: offers } = await supabase
            .from('loan_offers')
            .select('id, status')
            .eq('loan_request_id', loan.id)
            .eq('lender_id', userId)
            .eq('status', 'accepted')
            .single()

          hasAccepted = !!offers
        } catch (err) {
          // No accepted offer
        }
      }
      setHasAcceptedOffer(hasAccepted)

      // Load borrower user info
      const { data: borrower, error: borrowerError } = await supabase
        .from('users')
        .select('id, email, created_at')
        .eq('id', loan.user_id)
        .single()

      if (!borrowerError && borrower) {
        setBorrowerInfo(borrower)
      }

      // Load borrower verification status
      try {
        const verification = await p2pLoanService.getVerificationStatus(loan.user_id)
        setVerificationStatus(verification)
      } catch (err) {
        // Silently fail
      }

      // Load borrower ratings
      try {
        const ratings = await p2pLoanService.getLenderRatings(loan.user_id)
        setBorrowerRatings(ratings || [])

        if (ratings && ratings.length > 0) {
          const avgRating =
            ratings.reduce((sum, r) => sum + r.rating_score, 0) / ratings.length
          setBorrowerRating({
            average: avgRating,
            count: ratings.length,
            ratingScore: avgRating
          })
        }
      } catch (err) {
        // Silently fail
      }
    } catch (err) {
      console.error('Error loading borrower info:', err)
    } finally {
      setLoading(false)
    }
  }

  const maskPhoneNumber = (phone) => {
    if (!phone) return 'Not provided'
    return phone.substring(0, 3) + '****' + phone.substring(phone.length - 2)
  }

  const handleSubmitOffer = async (e) => {
    e.preventDefault()
    if (!userId || userId.includes('guest')) {
      setSubmitError('Please sign in to submit an offer')
      return
    }

    try {
      setSubmitLoading(true)
      setSubmitError('')

      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + parseInt(durationDays))

      const offerData = {
        offered_amount: parseFloat(offerAmount),
        interest_rate: parseFloat(interestRate),
        duration_days: parseInt(durationDays),
        due_date: dueDate.toISOString(),
        repayment_schedule: repaymentSchedule,
        payment_method: paymentMethod,
        use_platform_facilitation: usePlatformFacilitation
      }

      await p2pLoanService.submitLoanOffer(loan.id, userId, offerData)

      setShowOfferForm(false)
      if (onSubmitOffer) {
        onSubmitOffer()
      }
    } catch (err) {
      console.error('Error submitting offer:', err)
      setSubmitError(err.message || 'Failed to submit offer')
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full my-8">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">Loan Details</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-slate-600">Loading loan details...</p>
            </div>
          ) : (
            <>
              {/* Loan Details Section */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Loan Request</h3>
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg">
                  <div>
                    <p className="text-xs text-slate-600 uppercase font-semibold mb-1">
                      Amount Requested
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                      {loan.requested_amount} {loan.currency_code}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 uppercase font-semibold mb-1">
                      Loan Type
                    </p>
                    <p className="text-lg font-semibold text-slate-900">
                      {loan.loan_type === 'personal' ? 'Personal' : 'Business'} Loan
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 uppercase font-semibold mb-1">
                      Status
                    </p>
                    <p className="text-sm font-medium text-slate-900">
                      {loan.status?.charAt(0).toUpperCase() + loan.status?.slice(1) || 'Pending'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 uppercase font-semibold mb-1">
                      Location
                    </p>
                    <p className="text-sm font-medium text-slate-900">📍 {loan.city}</p>
                  </div>
                  {loan.loan_purpose && (
                    <div className="col-span-2">
                      <p className="text-xs text-slate-600 uppercase font-semibold mb-1">
                        Purpose
                      </p>
                      <p className="text-sm text-slate-900">{loan.loan_purpose}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Borrower Profile Section */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Borrower Profile</h3>
                <div className="border border-slate-200 rounded-lg p-4">
                  {/* Privacy Notice */}
                  {!isViewingOwnLoan && !hasAcceptedOffer && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-800">
                        ℹ️ Full contact details will be shared once an offer is accepted.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-slate-600 uppercase font-semibold mb-1">Name</p>
                      {isViewingOwnLoan || hasAcceptedOffer ? (
                        <p className="font-medium text-slate-900">
                          {loan.display_name || 'Not provided'}
                        </p>
                      ) : (
                        <p className="font-medium text-slate-900 blur-sm select-none">
                          {loan.display_name ? loan.display_name.substring(0, 1) + '***' : 'Not provided'}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 uppercase font-semibold mb-1">City</p>
                      <p className="font-medium text-slate-900">{loan.city}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 uppercase font-semibold mb-1">
                        Phone
                      </p>
                      {isViewingOwnLoan || hasAcceptedOffer ? (
                        <p className="font-medium text-slate-900">{loan.phone_number || 'Not provided'}</p>
                      ) : (
                        <p className="font-medium text-slate-900">
                          {loan.phone_number
                            ? loan.phone_number.substring(0, 3) + '****' + loan.phone_number.substring(loan.phone_number.length - 2)
                            : 'Not provided'}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 uppercase font-semibold mb-1">
                        Member Since
                      </p>
                      <p className="font-medium text-slate-900">
                        {borrowerInfo?.created_at
                          ? new Date(borrowerInfo.created_at).toLocaleDateString()
                          : 'Recently'}
                      </p>
                    </div>
                  </div>

                  {/* Verification & Rating */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                    <div>
                      <p className="text-xs text-slate-600 uppercase font-semibold mb-2">
                        Verification Status
                      </p>
                      {verificationStatus ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                          <span className="text-sm font-medium text-green-700">
                            {verificationStatus.status === 'approved'
                              ? '✓ Verified'
                              : 'Verification Pending'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-2 h-2 rounded-full bg-slate-300"></span>
                          <span className="text-sm font-medium text-slate-600">Not verified</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 uppercase font-semibold mb-2">
                        Borrower Rating
                      </p>
                      {borrowerRating ? (
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <span
                                key={i}
                                className={`text-lg ${
                                  i <= Math.round(borrowerRating.average)
                                    ? 'text-yellow-500'
                                    : 'text-slate-300'
                                }`}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                          <span className="text-sm font-medium text-slate-900">
                            {borrowerRating.average.toFixed(1)} ({borrowerRating.count})
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm font-medium text-slate-600">No ratings yet</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Reviews */}
              {borrowerRatings.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Reviews</h3>
                  <div className="space-y-3">
                    {borrowerRatings.slice(0, 3).map((rating) => (
                      <div key={rating.id} className="border border-slate-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <span
                                key={i}
                                className={`text-sm ${
                                  i <= rating.rating_score
                                    ? 'text-yellow-500'
                                    : 'text-slate-300'
                                }`}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                          <span className="text-xs text-slate-500">
                            {new Date(rating.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {rating.review && (
                          <p className="text-sm text-slate-700">{rating.review}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Offer Section */}
              {userId && !userId.includes('guest') && !loan.lender_id && (
                <div className="border-t border-slate-200 pt-6">
                  {!showOfferForm ? (
                    <button
                      onClick={() => setShowOfferForm(true)}
                      className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                    >
                      Submit Your Offer
                    </button>
                  ) : (
                    <form onSubmit={handleSubmitOffer} className="space-y-4">
                      <h4 className="font-semibold text-slate-900">Your Offer</h4>

                      {submitError && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                          {submitError}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Offer Amount ({loan.currency_code}) *
                          </label>
                          <input
                            type="number"
                            value={offerAmount}
                            onChange={(e) => setOfferAmount(e.target.value)}
                            placeholder="Amount"
                            className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                            step="0.01"
                            min="0"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Interest Rate (%) *
                          </label>
                          <input
                            type="number"
                            value={interestRate}
                            onChange={(e) => setInterestRate(e.target.value)}
                            placeholder="Interest rate"
                            className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                            step="0.1"
                            min="0"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Duration (Days) *
                          </label>
                          <input
                            type="number"
                            value={durationDays}
                            onChange={(e) => setDurationDays(e.target.value)}
                            placeholder="Duration"
                            className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                            min="1"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Repayment Schedule *
                          </label>
                          <select
                            value={repaymentSchedule}
                            onChange={(e) => setRepaymentSchedule(e.target.value)}
                            className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                          >
                            <option value="lump_sum">Lump Sum</option>
                            <option value="monthly">Monthly</option>
                            <option value="weekly">Weekly</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Payment Method *
                          </label>
                          <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                          >
                            <option value="gcash">GCash</option>
                            <option value="bank_transfer">Bank Transfer</option>
                            <option value="crypto">Cryptocurrency</option>
                            <option value="cash">Cash</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="platform"
                          checked={usePlatformFacilitation}
                          onChange={(e) => setUsePlatformFacilitation(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <label htmlFor="platform" className="text-sm text-slate-600">
                          Use platform facilitation (10% fee applies)
                        </label>
                      </div>

                      <div className="flex gap-2 border-t border-slate-200 pt-4">
                        <button
                          type="button"
                          onClick={() => setShowOfferForm(false)}
                          className="flex-1 px-4 py-2 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submitLoading}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submitLoading ? 'Submitting...' : 'Submit Offer'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
