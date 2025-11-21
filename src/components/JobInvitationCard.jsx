import React, { useState } from 'react'
import { employeeInvitationService } from '../lib/employeeInvitationService'
import { supabase } from '../lib/supabaseClient'

export default function JobInvitationCard({ invitation, userId, onInvitationAccepted, onInvitationRejected }) {
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [employeeId, setEmployeeId] = useState(null)

  React.useEffect(() => {
    loadEmployeeId()
  }, [userId])

  const loadEmployeeId = async () => {
    try {
      const { data } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (data) {
        setEmployeeId(data.id)
      }
    } catch (err) {
      console.error('Error loading employee ID:', err)
    }
  }

  const handleAccept = async () => {
    if (!employeeId) {
      setError('Employee record not found. Please try again.')
      return
    }

    try {
      setProcessing(true)
      setError(null)

      const { error: acceptError } = await employeeInvitationService.acceptInvitation(
        invitation.id,
        employeeId
      )

      if (acceptError) throw acceptError

      onInvitationAccepted()
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('Error accepting invitation:', errorMsg)
      setError(`Failed to accept invitation: ${errorMsg}`)
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    try {
      setProcessing(true)
      setError(null)

      const { error: rejectError } = await employeeInvitationService.rejectInvitation(invitation.id)

      if (rejectError) throw rejectError

      onInvitationRejected()
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('Error rejecting invitation:', errorMsg)
      setError(`Failed to reject invitation: ${errorMsg}`)
    } finally {
      setProcessing(false)
    }
  }

  const handleHide = async () => {
    try {
      setProcessing(true)
      setError(null)

      const { error: hideError } = await employeeInvitationService.hideInvitation(invitation.id)

      if (hideError) throw hideError

      onInvitationRejected()
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('Error hiding invitation:', errorMsg)
      setError(`Failed to hide invitation: ${errorMsg}`)
    } finally {
      setProcessing(false)
    }
  }

  const isExpired = invitation.expires_at && new Date(invitation.expires_at) < new Date()
  const daysUntilExpiry = invitation.expires_at
    ? Math.ceil((new Date(invitation.expires_at) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{invitation.job_title}</h3>
          <p className="text-sm text-slate-600 mt-1">
            from <span className="font-semibold">{invitation.business?.business_name}</span>
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
          isExpired
            ? 'bg-red-100 text-red-700'
            : 'bg-blue-100 text-blue-700'
        }`}>
          {isExpired ? 'Expired' : 'Pending'}
        </span>
      </div>

      {/* Job Details */}
      <div className="grid grid-cols-3 gap-4 mb-4 py-4 border-y border-slate-200">
        <div>
          <p className="text-xs text-slate-600 font-semibold uppercase">Job Type</p>
          <p className="text-sm font-medium text-slate-900 mt-1">
            {invitation.job_type ? invitation.job_type.replace('_', ' ') : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-600 font-semibold uppercase">Pay Rate</p>
          <p className="text-sm font-medium text-slate-900 mt-1">
            ₱{invitation.pay_rate?.toFixed(2) || 'Negotiable'}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-600 font-semibold uppercase">Category</p>
          <p className="text-sm font-medium text-slate-900 mt-1">
            {invitation.job_category ? invitation.job_category.replace('_', ' ') : 'General'}
          </p>
        </div>
      </div>

      {/* Description */}
      {invitation.job_description && (
        <div className="mb-4">
          <p className="text-sm text-slate-700 line-clamp-2">
            {invitation.job_description}
          </p>
        </div>
      )}

      {/* Message */}
      {invitation.message && (
        <div className="mb-4 bg-slate-50 p-3 rounded border border-slate-200">
          <p className="text-xs text-slate-600 font-semibold uppercase mb-1">Message from Employer</p>
          <p className="text-sm text-slate-700">"{invitation.message}"</p>
        </div>
      )}

      {/* Expiry Info */}
      {!isExpired && daysUntilExpiry !== null && (
        <div className="mb-4 text-xs text-orange-600 font-medium">
          ⏰ Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleAccept}
          disabled={processing || isExpired}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 font-medium text-sm transition-colors"
        >
          {processing ? 'Processing...' : 'Accept'}
        </button>
        <button
          onClick={handleReject}
          disabled={processing || isExpired}
          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-slate-300 font-medium text-sm transition-colors"
        >
          {processing ? 'Processing...' : 'Reject'}
        </button>
        <button
          onClick={handleHide}
          disabled={processing}
          className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 disabled:bg-slate-300 font-medium text-sm transition-colors"
        >
          {processing ? 'Processing...' : 'Hide'}
        </button>
      </div>

      {/* Business Owner Info */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <p className="text-xs text-slate-600">
          Invited by <span className="font-semibold text-slate-900">
            {invitation.invited_by?.full_name || 'Business Manager'}
          </span>
        </p>
      </div>
    </div>
  )
}
