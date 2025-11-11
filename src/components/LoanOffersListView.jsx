import React, { useState, useEffect } from 'react'
import { useState, useEffect } from 'react'
import { p2pLoanService } from '../lib/p2pLoanService'
import LenderProfileView from './LenderProfileView'
import { LenderVerificationDisplay } from './LenderVerificationDisplay'

export default function LoanOffersListView({ userId, loanRequest, onOfferAccepted, onClose }) {
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedLenderId, setSelectedLenderId] = useState(null)
  const [acceptingOfferId, setAcceptingOfferId] = useState(null)
  const [sortBy, setSortBy] = useState('rating') // 'rating', 'interest', 'duration'

  useEffect(() => {
    loadOffers()
  }, [loanRequest.id])

  const loadOffers = async () => {
    try {
      setLoading(true)
      const data = await p2pLoanService.getOffersForRequest(loanRequest.id)
      setOffers(data || [])
    } catch (err) {
      setError('Failed to load offers')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptOffer = async (offerId) => {
    if (!confirm('Accept this offer? You will be paired with this lender.')) return

    try {
      setAcceptingOfferId(offerId)
      await p2pLoanService.acceptLoanOffer(offerId, userId)
      if (onOfferAccepted) onOfferAccepted()
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to accept offer')
    } finally {
      setAcceptingOfferId(null)
    }
  }

  const getSortedOffers = () => {
    const copy = [...offers].filter(o => o.status === 'pending')
    
    switch (sortBy) {
      case 'interest':
        return copy.sort((a, b) => a.interest_rate - b.interest_rate)
      case 'duration':
        return copy.sort((a, b) => a.duration_days - b.duration_days)
      case 'rating':
      default:
        return copy.sort((a, b) => {
          const aRating = a.lender?.lender_profiles?.[0]?.rating || 0
          const bRating = b.lender?.lender_profiles?.[0]?.rating || 0
          return bRating - aRating
        })
    }
  }

  const pendingOffers = getSortedOffers()
  const acceptedOffers = offers.filter(o => o.status === 'accepted')

  const renderStars = (rating) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <span key={i} className={i <= Math.round(rating) ? 'text-yellow-500 text-lg' : 'text-slate-300 text-lg'}>
            ★
          </span>
        ))}
        <span className="text-xs text-slate-600 ml-1">({rating.toFixed(1)})</span>
      </div>
    )
  }

  const getVerificationBadge = (verified) => {
    if (verified) {
      return <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-semibold">✓ Verified</span>
    }
    return <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-semibold">Unverified</span>
  }

  if (selectedLenderId) {
    return (
      <LenderProfileView
        userId={userId}
        lenderId={selectedLenderId}
        onClose={() => setSelectedLenderId(null)}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Available Offers</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <p className="text-slate-600">Loading offers...</p>
            </div>
          ) : pendingOffers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-600">No offers yet. Check back later!</p>
            </div>
          ) : (
            <>
              {/* Sort Controls */}
              <div className="mb-6 flex gap-2">
                <button
                  onClick={() => setSortBy('rating')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    sortBy === 'rating'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Top Rated
                </button>
                <button
                  onClick={() => setSortBy('interest')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    sortBy === 'interest'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Lowest Interest
                </button>
                <button
                  onClick={() => setSortBy('duration')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    sortBy === 'duration'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Shortest Duration
                </button>
              </div>

              {/* Accepted Offer Banner */}
              {acceptedOffers.length > 0 && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-900 font-semibold">
                    ✓ You have accepted an offer from {acceptedOffers[0].lender?.email}
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    This loan is now active. Check your inbox for communication with the lender.
                  </p>
                </div>
              )}

              {/* Offers Grid */}
              <div className="space-y-4">
                {pendingOffers.map(offer => {
                  const lenderProfile = offer.lender?.lender_profiles?.[0]
                  const rating = lenderProfile?.rating || 0
                  const totalWithInterest = offer.offered_amount * (1 + (offer.interest_rate / 100))
                  const platformFee = offer.use_platform_facilitation ? offer.platform_fee_amount : 0

                  return (
                    <div key={offer.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-4">
                        {/* Lender Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-slate-900 truncate">
                                {offer.lender?.email}
                              </p>
                              <div className="mt-1">
                                {renderStars(rating)}
                              </div>
                              {lenderProfile && (
                                <p className="text-xs text-slate-600 mt-1">
                                  {lenderProfile.completed_loans_count} completed loans
                                </p>
                              )}
                            </div>
                            <div>
                              {getVerificationBadge(lenderProfile?.is_verified)}
                            </div>
                          </div>
                        </div>

                        {/* Offer Terms */}
                        <div className="bg-blue-50 p-3 rounded-lg text-sm min-w-fit">
                          <div className="font-semibold text-slate-900 mb-2">
                            {offer.offered_amount} {loanRequest.currency_code}
                          </div>
                          <div className="text-xs text-slate-600 space-y-1">
                            <p><span className="font-semibold">Interest:</span> {offer.interest_rate}%</p>
                            <p><span className="font-semibold">Duration:</span> {offer.duration_days} days</p>
                            <p><span className="font-semibold">Schedule:</span> {offer.repayment_schedule}</p>
                            <p><span className="font-semibold">Method:</span> {offer.payment_method}</p>
                            {platformFee > 0 && (
                              <p className="text-red-600"><span className="font-semibold">Platform Fee:</span> {platformFee.toFixed(2)}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Total Summary */}
                      <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-600">Total with interest</p>
                          <p className="text-lg font-bold text-slate-900">
                            {totalWithInterest.toFixed(2)} {loanRequest.currency_code}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedLenderId(offer.lender?.id)}
                            className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium"
                          >
                            View Profile
                          </button>
                          <button
                            onClick={() => handleAcceptOffer(offer.id)}
                            disabled={acceptingOfferId === offer.id}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                          >
                            {acceptingOfferId === offer.id ? 'Accepting...' : 'Accept Offer'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
