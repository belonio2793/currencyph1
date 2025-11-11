import React, { useState, useEffect } from 'react'
import { useState, useEffect } from 'react'
import { p2pLoanService } from '../lib/p2pLoanService'
import { VerificationBadge } from './VerificationBadge'
import { useUserVerificationStatus } from '../lib/usePublicUserProfile'

export default function LenderProfileView({ userId, lenderId, onClose }) {
  const [lenderProfile, setLenderProfile] = useState(null)
  const [ratings, setRatings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { isVerified, verificationData } = useUserVerificationStatus(lenderId)

  useEffect(() => {
    loadLenderProfile()
  }, [lenderId])

  const loadLenderProfile = async () => {
    try {
      setLoading(true)
      const profile = await p2pLoanService.getLenderProfile(lenderId)
      const lenderRatings = await p2pLoanService.getLenderRatings(lenderId)
      
      setLenderProfile(profile)
      setRatings(lenderRatings)
    } catch (err) {
      setError('Failed to load lender profile')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full text-center">
          <p className="text-slate-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (!lenderProfile) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full text-center">
          <p className="text-red-600">{error || 'Lender profile not found'}</p>
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

  const renderStars = (rating) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <span key={i} className={i <= Math.round(rating) ? 'text-yellow-500' : 'text-slate-300'}>
            ★
          </span>
        ))}
        <span className="text-sm text-slate-600 ml-1">({rating.toFixed(1)})</span>
      </div>
    )
  }

  const getVerificationBadge = (status) => {
    if (status === 'approved') {
      return <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-semibold">✓ Verified</span>
    }
    if (status === 'pending') {
      return <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-50 text-yellow-700 rounded-full text-xs font-semibold">⏳ Pending</span>
    }
    return <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">Unverified</span>
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Lender Profile</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Profile Content */}
        <div className="p-6 space-y-6">
          {/* Profile Header */}
          <div className="flex items-start gap-4">
            {lenderProfile.profile_image_url && (
              <img
                src={lenderProfile.profile_image_url}
                alt={lenderProfile.email}
                className="w-16 h-16 rounded-full object-cover"
              />
            )}
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-900">{lenderProfile.email}</h3>
              <p className="text-sm text-slate-600 mt-1">{lenderProfile.bio || 'No bio provided'}</p>
              <div className="mt-3">
                {getVerificationBadge(lenderProfile.verification_status)}
              </div>
            </div>
          </div>

          {/* Rating & Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-600 uppercase font-semibold mb-2">Rating</p>
              <div className="flex items-end gap-2">
                {renderStars(lenderProfile.rating)}
                <span className="text-xs text-slate-600">({lenderProfile.total_rating_count})</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-600 uppercase font-semibold mb-2">Success Rate</p>
              <p className="text-lg font-bold text-slate-900">
                {lenderProfile.completed_loans_count + lenderProfile.defaulted_loans_count > 0
                  ? Math.round((lenderProfile.completed_loans_count / (lenderProfile.completed_loans_count + lenderProfile.defaulted_loans_count)) * 100)
                  : 'N/A'}%
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-600 uppercase font-semibold mb-2">Completed Loans</p>
              <p className="text-lg font-bold text-green-600">{lenderProfile.completed_loans_count}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-600 uppercase font-semibold mb-2">Total Loaned</p>
              <p className="text-lg font-bold text-slate-900">
                {typeof lenderProfile.total_loaned === 'number' ? `${lenderProfile.total_loaned.toFixed(2)}` : 'N/A'}
              </p>
            </div>
          </div>

          {/* Payment Methods */}
          {lenderProfile.preferred_payment_methods && (
            <div>
              <p className="text-sm font-semibold text-slate-900 mb-2">Accepted Payment Methods</p>
              <div className="flex flex-wrap gap-2">
                {lenderProfile.preferred_payment_methods.split(',').map(method => (
                  <span key={method} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                    {method.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Rating Category */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-semibold text-blue-900 mb-1">Rating Category</p>
            <p className="text-lg font-bold text-blue-600 capitalize">{lenderProfile.rating_category}</p>
          </div>

          {/* Recent Ratings */}
          {ratings.length > 0 && (
            <div>
              <h4 className="text-lg font-bold text-slate-900 mb-3">Recent Ratings ({ratings.length})</h4>
              <div className="space-y-3">
                {ratings.map(rating => (
                  <div key={rating.id} className="p-3 border border-slate-200 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(i => (
                          <span key={i} className={i <= rating.rating_score ? 'text-yellow-500' : 'text-slate-300'}>
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(rating.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {rating.review && <p className="text-sm text-slate-700">{rating.review}</p>}
                    <div className="mt-2 flex gap-2 text-xs text-slate-600">
                      {rating.on_time_payment && (
                        <span className="px-2 py-1 bg-green-50 text-green-700 rounded">On-time payment</span>
                      )}
                      {rating.communication_quality && (
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
                          Communication: {rating.communication_quality}/5
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ratings.length === 0 && (
            <div className="p-4 bg-slate-50 rounded-lg text-center">
              <p className="text-sm text-slate-600">No ratings yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
