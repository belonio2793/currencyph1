import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function CommunityManagerPanel({ userId, onClose }) {
  const [activeTab, setActiveTab] = useState('verifications') // 'verifications', 'pending-managers', 'my-votes'
  const [pendingVerifications, setPendingVerifications] = useState([])
  const [pendingManagers, setPendingManagers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [managerStatus, setManagerStatus] = useState(null)

  useEffect(() => {
    loadData()
  }, [userId])

  const loadData = async () => {
    try {
      setLoading(true)

      // Check if user is a community manager
      const { data: manager } = await supabase
        .from('community_managers')
        .select('*')
        .eq('user_id', userId)
        .single()

      setManagerStatus(manager || null)

      if (manager?.status === 'approved' && manager.can_verify_users) {
        // Load pending verifications
        const { data: verifications } = await supabase
          .from('user_verifications')
          .select('*, user:user_id(email)')
          .eq('status', 'pending')
          .order('submitted_at', { ascending: true })

        setPendingVerifications(verifications || [])
      }

      // Load pending community managers
      const { data: managers } = await supabase
        .from('community_managers')
        .select('*, user:user_id(email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      setPendingManagers(managers || [])
    } catch (err) {
      console.error('Error loading community manager data:', err)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleApproveVerification = async (verificationId) => {
    try {
      const { error } = await supabase
        .from('user_verifications')
        .update({
          status: 'approved',
          verified_by: userId,
          verified_at: new Date()
        })
        .eq('id', verificationId)

      if (error) throw error

      // Update UI
      setPendingVerifications(prev =>
        prev.filter(v => v.id !== verificationId)
      )
    } catch (err) {
      setError('Failed to approve verification')
    }
  }

  const handleRejectVerification = async (verificationId, notes) => {
    try {
      const { error } = await supabase
        .from('user_verifications')
        .update({
          status: 'rejected',
          verified_by: userId,
          verification_notes: notes,
          verified_at: new Date()
        })
        .eq('id', verificationId)

      if (error) throw error

      setPendingVerifications(prev =>
        prev.filter(v => v.id !== verificationId)
      )
    } catch (err) {
      setError('Failed to reject verification')
    }
  }

  const handleVoteForManager = async (managerId, voteType) => {
    try {
      // Check if user already voted
      const { data: existing } = await supabase
        .from('community_manager_votes')
        .select('id')
        .eq('community_manager_id', managerId)
        .eq('voter_id', userId)
        .single()

      if (existing) {
        // Update existing vote
        await supabase
          .from('community_manager_votes')
          .update({ vote_type: voteType })
          .eq('id', existing.id)
      } else {
        // Create new vote
        await supabase
          .from('community_manager_votes')
          .insert({
            community_manager_id: managerId,
            voter_id: userId,
            vote_type: voteType
          })
      }

      loadData()
    } catch (err) {
      setError('Failed to submit vote')
    }
  }

  if (!managerStatus) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Community Manager Panel</h2>
          <p className="text-slate-600 mb-4">
            You are not a registered community manager. Community managers help verify users and maintain platform integrity.
          </p>
          <p className="text-sm text-slate-500 mb-4">
            To become a community manager, you need to be voted in by the community. Community members can nominate you based on your reliability and reputation.
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Community Manager Panel</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Status Badge */}
        <div className="bg-green-50 border-b border-green-200 px-6 py-3">
          <p className="text-sm text-green-900">
            ✓ You are an approved community manager • Verification permissions: {managerStatus.can_verify_users ? 'Enabled' : 'Disabled'}
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 px-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('verifications')}
              className={`px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'verifications'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending Verifications ({pendingVerifications.length})
            </button>
            <button
              onClick={() => setActiveTab('pending-managers')}
              className={`px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'pending-managers'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending Managers ({pendingManagers.length})
            </button>
          </div>
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
              <p className="text-slate-600">Loading...</p>
            </div>
          ) : activeTab === 'verifications' ? (
            /* Pending Verifications Tab */
            <>
              {pendingVerifications.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-lg">
                  <p className="text-slate-600">No pending verifications</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingVerifications.map(verification => (
                    <VerificationCard
                      key={verification.id}
                      verification={verification}
                      onApprove={() => handleApproveVerification(verification.id)}
                      onReject={(notes) => handleRejectVerification(verification.id, notes)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : activeTab === 'pending-managers' ? (
            /* Pending Managers Tab */
            <>
              {pendingManagers.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-lg">
                  <p className="text-slate-600">No pending community managers</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingManagers.map(manager => (
                    <ManagerVotingCard
                      key={manager.id}
                      manager={manager}
                      onVote={(voteType) => handleVoteForManager(manager.id, voteType)}
                      userId={userId}
                    />
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function VerificationCard({ verification, onApprove, onReject }) {
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  return (
    <div className="border border-slate-200 rounded-lg p-4">
      <div className="mb-4">
        <p className="font-semibold text-slate-900">{verification.user?.email}</p>
        <p className="text-sm text-slate-600 mt-1">
          {verification.id_type.replace('_', ' ').toUpperCase()} • {verification.id_number}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Submitted {new Date(verification.submitted_at).toLocaleDateString()}
        </p>
      </div>

      {verification.id_image_url && (
        <img
          src={verification.id_image_url}
          alt="ID"
          className="w-full max-h-32 object-cover rounded mb-4"
        />
      )}

      {!showRejectForm ? (
        <div className="flex gap-2">
          <button
            onClick={onApprove}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
          >
            ✓ Approve
          </button>
          <button
            onClick={() => setShowRejectForm(true)}
            className="flex-1 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium text-sm"
          >
            ✗ Reject
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (optional)"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
            rows="3"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onReject(rejectReason)}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
            >
              Confirm Rejection
            </button>
            <button
              onClick={() => {
                setShowRejectForm(false)
                setRejectReason('')
              }}
              className="flex-1 px-4 py-2 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400 font-medium text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ManagerVotingCard({ manager, onVote, userId }) {
  const [userVote, setUserVote] = useState(null)

  return (
    <div className="border border-slate-200 rounded-lg p-4">
      <div className="mb-4">
        <p className="font-semibold text-slate-900">{manager.user?.email}</p>
        {manager.bio && (
          <p className="text-sm text-slate-600 mt-1">{manager.bio}</p>
        )}
        <p className="text-xs text-slate-500 mt-1">
          Nominated {new Date(manager.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="mb-4 p-3 bg-blue-50 rounded">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">{manager.approval_votes_received}</span> / {manager.approval_votes_required} votes needed
        </p>
        <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{
              width: `${Math.min((manager.approval_votes_received / manager.approval_votes_required) * 100, 100)}%`
            }}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => {
            onVote('approve')
            setUserVote('approve')
          }}
          className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            userVote === 'approve'
              ? 'bg-green-600 text-white'
              : 'bg-green-50 text-green-700 hover:bg-green-100'
          }`}
        >
          👍 Approve
        </button>
        <button
          onClick={() => {
            onVote('reject')
            setUserVote('reject')
          }}
          className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            userVote === 'reject'
              ? 'bg-red-600 text-white'
              : 'bg-red-50 text-red-700 hover:bg-red-100'
          }`}
        >
          👎 Reject
        </button>
      </div>
    </div>
  )
}
