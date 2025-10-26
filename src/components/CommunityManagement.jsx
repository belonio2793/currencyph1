import React, { useEffect, useState } from 'react'
import { nearbyUtils } from '../lib/nearbyUtils'

export default function CommunityManagement({ userId }) {
  const [pendingListings, setPendingListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [voteCounts, setVoteCounts] = useState({})
  const [userVotes, setUserVotes] = useState({})

  useEffect(() => {
    loadPendingListings()
  }, [])

  async function loadPendingListings() {
    try {
      setLoading(true)
      setError('')
      const listings = await nearbyUtils.getPendingListings('pending', 100)
      setPendingListings(listings)

      // Load vote counts and user votes for each
      const counts = {}
      const votes = {}
      for (const listing of listings) {
        const voteData = await nearbyUtils.getApprovalVotes(listing.id)
        counts[listing.id] = voteData
        
        if (userId) {
          const userVote = await nearbyUtils.getUserApprovalVote(listing.id, userId)
          votes[listing.id] = userVote
        }
      }
      setVoteCounts(counts)
      setUserVotes(votes)
    } catch (err) {
      console.error('Error loading pending listings:', err)
      setError('Failed to load pending listings')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprovalVote(listingId, voteType) {
    if (!userId) {
      setError('Please log in to vote')
      return
    }

    try {
      await nearbyUtils.submitApprovalVote(listingId, userId, voteType)
      
      // Update user vote
      setUserVotes(prev => ({
        ...prev,
        [listingId]: userVotes[listingId] === voteType ? null : voteType
      }))

      // Reload vote counts
      const voteData = await nearbyUtils.getApprovalVotes(listingId)
      setVoteCounts(prev => ({
        ...prev,
        [listingId]: voteData
      }))
    } catch (err) {
      console.error('Error submitting vote:', err)
      setError('Failed to submit vote')
    }
  }

  async function handleApprove(listingId) {
    if (!userId) {
      setError('Please log in to approve listings')
      return
    }

    try {
      await nearbyUtils.approvePendingListing(listingId)
      setPendingListings(prev => prev.filter(l => l.id !== listingId))
    } catch (err) {
      console.error('Error approving listing:', err)
      setError('Failed to approve listing')
    }
  }

  async function handleReject(listingId) {
    if (!userId) {
      setError('Please log in to reject listings')
      return
    }

    if (!confirm('Reject this listing? This cannot be undone.')) return

    try {
      await nearbyUtils.rejectPendingListing(listingId)
      setPendingListings(prev => prev.filter(l => l.id !== listingId))
    } catch (err) {
      console.error('Error rejecting listing:', err)
      setError('Failed to reject listing')
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-slate-900">Community Management</h2>
        <p className="text-sm text-slate-500 mt-2">Review and approve new business listings submitted by community members</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <p className="text-slate-500">Loading pending listings...</p>
        </div>
      )}

      {!loading && pendingListings.length === 0 && (
        <div className="bg-white border rounded-lg p-8 text-center">
          <p className="text-slate-500 mb-2">No pending listings to review</p>
          <p className="text-sm text-slate-400">All submitted businesses have been processed</p>
        </div>
      )}

      <div className="space-y-4">
        {pendingListings.map(listing => {
          const counts = voteCounts[listing.id] || { approvals: 0, rejections: 0 }
          const userVote = userVotes[listing.id]

          return (
            <div key={listing.id} className="bg-white border rounded-lg p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">{listing.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">{listing.address}</p>
                  
                  <div className="mt-3 flex items-center gap-4">
                    {listing.category && (
                      <span className="text-sm px-2 py-1 bg-slate-100 rounded text-slate-700">
                        {listing.category}
                      </span>
                    )}
                    {listing.rating && (
                      <span className="text-sm text-yellow-600">★ {listing.rating}</span>
                    )}
                    {listing.description && (
                      <p className="text-sm text-slate-600 mt-2">{listing.description}</p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700">Community Votes:</span>
                      <span className="text-sm text-green-600 font-semibold">{counts.approvals} approve</span>
                      <span className="text-sm text-red-600 font-semibold">{counts.rejections} reject</span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-400">
                  {new Date(listing.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="border-t pt-4 flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprovalVote(listing.id, 'approve')}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      userVote === 'approve'
                        ? 'bg-green-600 text-white'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    👍 Approve
                  </button>
                  <button
                    onClick={() => handleApprovalVote(listing.id, 'reject')}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      userVote === 'reject'
                        ? 'bg-red-600 text-white'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    👎 Reject
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(listing.id)}
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                  >
                    ✓ Mark Approved
                  </button>
                  <button
                    onClick={() => handleReject(listing.id)}
                    className="px-4 py-2 bg-slate-300 text-slate-700 rounded text-sm font-medium hover:bg-slate-400"
                  >
                    ✗ Mark Rejected
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
