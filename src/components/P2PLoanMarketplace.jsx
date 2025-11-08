import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { p2pLoanService } from '../lib/p2pLoanService'
import RequestLoanModal from './RequestLoanModal'
import SubmitLoanOfferModal from './SubmitLoanOfferModal'
import LoanOffersListView from './LoanOffersListView'
import UserVerificationModal from './UserVerificationModal'
import LenderProfileView from './LenderProfileView'

const LOAN_STATUSES = {
  pending: { label: 'Pending Offers', color: 'bg-yellow-50', textColor: 'text-yellow-700' },
  active: { label: 'Active', color: 'bg-blue-50', textColor: 'text-blue-700' },
  completed: { label: 'Completed', color: 'bg-green-50', textColor: 'text-green-700' },
  defaulted: { label: 'Defaulted', color: 'bg-red-50', textColor: 'text-red-700' }
}

export default function P2PLoanMarketplace({ userId, userEmail, onTabChange }) {
  const [activeTab, setActiveTab] = useState('browse') // 'browse', 'my-requests', 'my-offers', 'history'
  const [loanRequests, setLoanRequests] = useState([])
  const [myRequests, setMyRequests] = useState([])
  const [loanOffers, setLoanOffers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showSubmitOfferModal, setShowSubmitOfferModal] = useState(false)
  const [showOffersListModal, setShowOffersListModal] = useState(false)
  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const [selectedLoanRequest, setSelectedLoanRequest] = useState(null)
  const [selectedLenderId, setSelectedLenderId] = useState(null)

  const [verificationStatus, setVerificationStatus] = useState(null)
  const [lenderProfile, setLenderProfile] = useState(null)
  const [userWallets, setUserWallets] = useState([])
  const [loanTransactions, setLoanTransactions] = useState([])
  const [networkStats, setNetworkStats] = useState(null)

  useEffect(() => {
    loadInitialData()
  }, [userId, activeTab])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      setError('')

      // Load verification status if userId exists
      if (userId) {
        try {
          const verification = await p2pLoanService.getVerificationStatus(userId)
          setVerificationStatus(verification)
        } catch (err) {
          console.warn('Could not load verification status:', err)
        }

        // Load lender profile
        try {
          const profile = await p2pLoanService.getLenderProfile(userId)
          setLenderProfile(profile)
        } catch (err) {
          console.warn('Could not load lender profile:', err)
        }
      }

      // Load loan requests for browsing
      try {
        const { data: requests, error: reqError } = await supabase
          .from('loans')
          .select('*')
          .eq('lender_id', null)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(20)

        if (reqError) {
          console.warn('Could not load loan requests:', reqError)
        }
        setLoanRequests(requests || [])
      } catch (err) {
        console.warn('Error loading loan requests:', err)
      }

      if (userId) {
        // Load user's own requests
        try {
          const { data: myReqs, error: myReqsError } = await supabase
            .from('loans')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })

          if (myReqsError) {
            console.warn('Could not load user requests:', myReqsError)
          }
          setMyRequests(myReqs || [])
        } catch (err) {
          console.warn('Error loading user requests:', err)
        }

        // Load user's submitted offers
        try {
          const { data: offers, error: offersError } = await supabase
            .from('loan_offers')
            .select('*, loan_request:loan_request_id(*)')
            .eq('lender_id', userId)
            .order('created_at', { ascending: false })

          if (offersError) {
            console.warn('Could not load loan offers:', offersError)
          }
          setLoanOffers(offers || [])
        } catch (err) {
          console.warn('Error loading loan offers:', err)
        }

        // Load user's wallets for network balances
        try {
          const { data: wallets, error: walletsError } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', userId)

          if (walletsError) {
            console.warn('Could not load wallets:', walletsError)
          }
          setUserWallets(wallets || [])
        } catch (err) {
          console.warn('Error loading wallets:', err)
        }

        // Load loan payment transactions
        try {
          const { data: transactions, error: txError } = await supabase
            .from('loan_payments')
            .select('*')
            .or(`borrower_id.eq.${userId},lender_id.eq.${userId}`)
            .order('created_at', { ascending: false })
            .limit(50)

          if (txError) {
            console.warn('Could not load loan transactions:', txError)
          }
          setLoanTransactions(transactions || [])
        } catch (err) {
          console.warn('Error loading loan transactions:', err)
        }

        // Load network stats
        try {
          const { data: stats, error: statsError } = await supabase
            .from('network_balances')
            .select('*')
            .eq('user_id', userId)
            .single()

          if (statsError && statsError.code !== 'PGRST116') {
            console.warn('Could not load network stats:', statsError)
          }
          setNetworkStats(stats || null)
        } catch (err) {
          console.warn('Error loading network stats:', err)
        }
      }
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Failed to load marketplace data')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectLoanRequest = (request) => {
    setSelectedLoanRequest(request)
    if (request.lender_id) {
      setSelectedLenderId(request.lender_id)
    } else {
      setShowSubmitOfferModal(true)
    }
  }

  const handleViewOffers = (request) => {
    setSelectedLoanRequest(request)
    setShowOffersListModal(true)
  }

  const handleRequestSuccess = () => {
    setShowRequestModal(false)
    loadInitialData()
  }

  const handleOfferSubmitted = () => {
    setShowSubmitOfferModal(false)
    loadInitialData()
  }

  const handleOfferAccepted = () => {
    setShowOffersListModal(false)
    loadInitialData()
  }

  const renderStars = (rating) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <span key={i} className={i <= Math.round(rating) ? 'text-yellow-500' : 'text-slate-300'}>
            ★
          </span>
        ))}
        <span className="text-xs text-slate-600 ml-1">({rating.toFixed(1)})</span>
      </div>
    )
  }

  const markAsCompleted = async (loanId) => {
    if (!confirm('Mark this loan as completed?')) return
    try {
      await p2pLoanService.markLoanAsCompleted(loanId)
      loadInitialData()
    } catch (err) {
      setError('Failed to mark loan as completed')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-8 px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">P2P Loan Marketplace</h1>
          <p className="text-blue-100">Borrow or lend directly with other users in your community</p>
        </div>
      </div>

      {/* Verification Banner */}
      {verificationStatus?.status !== 'approved' && userId && (
        <div className="bg-amber-50 border-b border-amber-200 p-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900">
                ⚠️ Identity verification required to participate
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Submit your ID to start borrowing or lending
              </p>
            </div>
            <button
              onClick={() => setShowVerificationModal(true)}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium"
            >
              Verify Now
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('browse')}
              className={`px-6 py-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'browse'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Browse Loans
            </button>
            {userId && (
              <>
                <button
                  onClick={() => setActiveTab('my-requests')}
                  className={`px-6 py-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'my-requests'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  My Requests
                </button>
                <button
                  onClick={() => setActiveTab('my-offers')}
                  className={`px-6 py-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'my-offers'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  My Offers
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-6 py-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'history'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  History & Ratings
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-600">Loading...</p>
          </div>
        ) : activeTab === 'browse' ? (
          /* Browse Loans Tab */
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Available Loan Requests</h2>
              {userId && (
                <button
                  onClick={() => setShowRequestModal(true)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  + Request a Loan
                </button>
              )}
            </div>

            {loanRequests.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg">
                <p className="text-slate-600 mb-4">No loan requests available right now</p>
                {!userId && (
                  <p className="text-sm text-slate-500">Sign in to submit your own loan request</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {loanRequests.map(request => (
                  <div key={request.id} className="border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{request.requested_amount} {request.currency_code}</h3>
                        <p className="text-sm text-slate-600 mt-1">
                          📍 {request.city} • {request.loan_type === 'personal' ? 'Personal' : 'Business'} Loan
                        </p>
                        {request.reason_for_loan && (
                          <p className="text-sm text-slate-700 mt-2">{request.reason_for_loan}</p>
                        )}
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold ${LOAN_STATUSES[request.status].color} ${LOAN_STATUSES[request.status].textColor}`}>
                        {LOAN_STATUSES[request.status].label}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {userId ? (
                        <>
                          {request.lender_id ? (
                            <button
                              onClick={() => setSelectedLenderId(request.lender_id)}
                              className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium"
                            >
                              View Lender Profile
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleSelectLoanRequest(request)}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                              >
                                Submit Offer
                              </button>
                              <button
                                onClick={() => handleViewOffers(request)}
                                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium"
                              >
                                View Offers ({request.total_offers || 0})
                              </button>
                            </>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => alert('Please sign in to submit an offer')}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                        >
                          Submit Offer
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'my-requests' ? (
          /* My Requests Tab */
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">My Loan Requests</h2>
              <button
                onClick={() => setShowRequestModal(true)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                + New Request
              </button>
            </div>

            {myRequests.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg">
                <p className="text-slate-600">You haven't requested any loans yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myRequests.map(request => (
                  <div key={request.id} className="border border-slate-200 rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{request.requested_amount} {request.currency_code}</h3>
                        <p className="text-sm text-slate-600 mt-1">
                          Created {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold ${LOAN_STATUSES[request.status].color} ${LOAN_STATUSES[request.status].textColor}`}>
                        {LOAN_STATUSES[request.status].label}
                      </div>
                    </div>

                    {request.lender_id ? (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                        <p className="text-sm font-semibold text-blue-900">Paired with Lender</p>
                        <p className="text-sm text-blue-700 mt-1">
                          Interest Rate: {request.interest_rate}% • Due: {new Date(request.due_date).toLocaleDateString()}
                        </p>
                      </div>
                    ) : (
                      <div className="mb-4">
                        <p className="text-sm text-slate-600 mb-2">
                          Pending offers: {request.total_offers || 0}
                        </p>
                        {request.total_offers > 0 && (
                          <button
                            onClick={() => handleViewOffers(request)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                          >
                            Review Offers
                          </button>
                        )}
                      </div>
                    )}

                    {request.status === 'active' && (
                      <button
                        onClick={() => markAsCompleted(request.id)}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                      >
                        Mark as Completed
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'my-offers' ? (
          /* My Offers Tab */
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-6">My Submitted Offers</h2>

            {loanOffers.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg">
                <p className="text-slate-600">You haven't submitted any offers yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {loanOffers.map(offer => (
                  <div key={offer.id} className="border border-slate-200 rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          Offer: {offer.offered_amount} {offer.loan_request?.currency_code}
                        </h3>
                        <p className="text-sm text-slate-600 mt-1">
                          Interest: {offer.interest_rate}% • Duration: {offer.duration_days} days
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        offer.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                        offer.status === 'accepted' ? 'bg-green-50 text-green-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
                      </div>
                    </div>

                    {offer.status === 'accepted' && (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm font-semibold text-green-900">
                          ✓ Offer accepted! Loan is now active.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'history' ? (
          /* History & Ratings Tab */
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Your Lending History & Rating</h2>

            {lenderProfile && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900 uppercase font-semibold mb-2">Your Rating</p>
                  {renderStars(lenderProfile.rating)}
                  <p className="text-sm text-blue-700 mt-2">
                    Based on {lenderProfile.total_rating_count} reviews
                  </p>
                </div>

                <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-900 uppercase font-semibold mb-2">Completed Loans</p>
                  <p className="text-2xl font-bold text-green-600">{lenderProfile.completed_loans_count}</p>
                  <p className="text-sm text-green-700 mt-2">
                    Total loaned: {lenderProfile.total_loaned}
                  </p>
                </div>
              </div>
            )}

            {myRequests
              .filter(r => r.status === 'completed')
              .length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg">
                <p className="text-slate-600">No completed loans yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myRequests
                  .filter(r => r.status === 'completed')
                  .map(loan => (
                    <div key={loan.id} className="border border-slate-200 rounded-lg p-6 bg-green-50">
                      <h3 className="text-lg font-bold text-slate-900 mb-2">
                        Loan: {loan.requested_amount} {loan.currency_code}
                      </h3>
                      <p className="text-sm text-slate-600">
                        Completed on {new Date(loan.completed_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Modals */}
      {showRequestModal && (
        <RequestLoanModal
          userId={userId}
          onClose={() => setShowRequestModal(false)}
          onSuccess={handleRequestSuccess}
        />
      )}

      {showSubmitOfferModal && selectedLoanRequest && (
        <SubmitLoanOfferModal
          userId={userId}
          loanRequest={selectedLoanRequest}
          onClose={() => {
            setShowSubmitOfferModal(false)
            setSelectedLoanRequest(null)
          }}
          onSuccess={handleOfferSubmitted}
        />
      )}

      {showOffersListModal && selectedLoanRequest && (
        <LoanOffersListView
          userId={userId}
          loanRequest={selectedLoanRequest}
          onOfferAccepted={handleOfferAccepted}
          onClose={() => {
            setShowOffersListModal(false)
            setSelectedLoanRequest(null)
          }}
        />
      )}

      {showVerificationModal && (
        <UserVerificationModal
          userId={userId}
          onClose={() => setShowVerificationModal(false)}
          onSuccess={loadInitialData}
        />
      )}

      {selectedLenderId && !showSubmitOfferModal && !showOffersListModal && (
        <LenderProfileView
          userId={userId}
          lenderId={selectedLenderId}
          onClose={() => setSelectedLenderId(null)}
        />
      )}
    </div>
  )
}
