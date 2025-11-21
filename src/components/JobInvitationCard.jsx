import { useState } from 'react'
import { employeeInvitationService } from '../lib/employeeInvitationService'
import { employeeManagementService } from '../lib/employeeManagementService'
import { formatFieldValue } from '../lib/formatters'
import './JobInvitationCard.css'

export default function JobInvitationCard({ invitation, userId, onAccepted, onRejected, onHidden }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)

  const calculateDaysUntilExpiry = (expiresAt) => {
    if (!expiresAt) return null
    const now = new Date()
    const expiry = new Date(expiresAt)
    const diffTime = expiry - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const daysUntilExpiry = calculateDaysUntilExpiry(invitation.expires_at)
  const isExpired = daysUntilExpiry && daysUntilExpiry <= 0

  const handleAccept = async () => {
    if (confirmAction === 'accept') {
      setIsLoading(true)
      setError('')

      try {
        // Create employee record first
        const employeeRes = await employeeManagementService.createEmployee(
          invitation.business_id,
          userId,
          {
            firstName: 'New',
            lastName: 'Employee',
            position: invitation.job_title,
            baseSalary: invitation.pay_rate,
            hireDate: new Date().toISOString().split('T')[0]
          }
        )

        if (!employeeRes || !employeeRes.id) {
          throw new Error('Failed to create employee record')
        }

        // Accept invitation
        const res = await employeeInvitationService.acceptInvitation(
          invitation.id,
          employeeRes.id
        )

        if (res.error) {
          throw res.error
        }

        setShowConfirmation(false)
        setConfirmAction(null)
        onAccepted()
      } catch (err) {
        console.error('Error accepting invitation:', err)
        setError('Failed to accept invitation. Please try again.')
      } finally {
        setIsLoading(false)
      }
    } else {
      setConfirmAction('accept')
      setShowConfirmation(true)
    }
  }

  const handleReject = async () => {
    if (confirmAction === 'reject') {
      setIsLoading(true)
      setError('')

      try {
        const res = await employeeInvitationService.rejectInvitation(invitation.id)

        if (res.error) {
          throw res.error
        }

        setShowConfirmation(false)
        setConfirmAction(null)
        onRejected()
      } catch (err) {
        console.error('Error rejecting invitation:', err)
        setError('Failed to reject invitation. Please try again.')
      } finally {
        setIsLoading(false)
      }
    } else {
      setConfirmAction('reject')
      setShowConfirmation(true)
    }
  }

  const handleHide = async () => {
    setIsLoading(true)
    setError('')

    try {
      const res = await employeeInvitationService.hideInvitation(invitation.id)

      if (res.error) {
        throw res.error
      }

      onHidden()
    } catch (err) {
      console.error('Error hiding invitation:', err)
      setError('Failed to hide invitation. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmCancel = () => {
    setShowConfirmation(false)
    setConfirmAction(null)
  }

  return (
    <div className="job-invitation-card">
      {error && (
        <div className="card-error">
          {error}
        </div>
      )}

      <div className="invitation-header">
        <div className="invitation-title-section">
          <h3 className="job-title">{invitation.job_title}</h3>
          <p className="business-name">{invitation.business?.business_name || 'Unknown Business'}</p>
        </div>
        <div className="invitation-status-section">
          {isExpired ? (
            <span className="expiry-badge expired">Expired</span>
          ) : daysUntilExpiry && daysUntilExpiry <= 3 ? (
            <span className="expiry-badge expiring">Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}</span>
          ) : daysUntilExpiry ? (
            <span className="expiry-badge active">Valid for {daysUntilExpiry} more days</span>
          ) : null}
        </div>
      </div>

      <div className="invitation-details">
        <div className="detail-item">
          <span className="label">Position:</span>
          <span className="value">{invitation.job_title}</span>
        </div>
        {invitation.job_category && (
          <div className="detail-item">
            <span className="label">Category:</span>
            <span className="value">{invitation.job_category}</span>
          </div>
        )}
        <div className="detail-item">
          <span className="label">Pay Rate:</span>
          <span className="value">₱{invitation.pay_rate?.toFixed(2)}</span>
        </div>
        <div className="detail-item">
          <span className="label">Type:</span>
          <span className="value">{formatFieldValue(invitation.job_type)}</span>
        </div>
      </div>

      {invitation.job_description && (
        <div className="invitation-description">
          <p>{invitation.job_description}</p>
        </div>
      )}

      {invitation.message && (
        <div className="invitation-message">
          <strong>Message from employer:</strong>
          <p>{invitation.message}</p>
        </div>
      )}

      <div className="sent-date">
        <small>Sent {new Date(invitation.sent_at).toLocaleDateString()}</small>
      </div>

      {showConfirmation && (
        <div className="confirmation-dialog">
          <div className="confirmation-content">
            <p>
              {confirmAction === 'accept'
                ? 'Are you sure you want to accept this job invitation?'
                : 'Are you sure you want to reject this job invitation?'}
            </p>
            <div className="confirmation-actions">
              <button
                className="btn-confirm-yes"
                onClick={confirmAction === 'accept' ? handleAccept : handleReject}
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : confirmAction === 'accept' ? 'Accept' : 'Reject'}
              </button>
              <button
                className="btn-confirm-no"
                onClick={handleConfirmCancel}
                disabled={isLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="invitation-actions">
        <button
          className="btn-accept"
          onClick={handleAccept}
          disabled={isLoading || isExpired || showConfirmation && confirmAction !== 'accept'}
          title={isExpired ? 'This invitation has expired' : ''}
        >
          {showConfirmation && confirmAction === 'accept' ? 'Confirming...' : 'Accept'}
        </button>
        <button
          className="btn-reject"
          onClick={handleReject}
          disabled={isLoading || isExpired || showConfirmation && confirmAction !== 'reject'}
          title={isExpired ? 'This invitation has expired' : ''}
        >
          {showConfirmation && confirmAction === 'reject' ? 'Confirming...' : 'Reject'}
        </button>
        <button
          className="btn-hide"
          onClick={handleHide}
          disabled={isLoading}
          title="Hide this invitation"
        >
          Hide
        </button>
      </div>
    </div>
  )
}
