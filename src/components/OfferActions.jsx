import { useState } from 'react'
import './OfferActions.css'

export default function OfferActions({
  offer,
  onAccept,
  onReject,
  userType = 'employer'
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAccept = async () => {
    setError('')
    setLoading(true)
    try {
      await onAccept(offer.id)
    } catch (err) {
      setError('Failed to accept offer')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    setError('')
    setLoading(true)
    try {
      await onReject(offer.id)
    } catch (err) {
      setError('Failed to reject offer')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const isAccepted = offer.status === 'accepted'
  const isRejected = offer.status === 'rejected'
  const isPending = offer.status === 'pending' || !offer.status

  return (
    <div className="offer-actions">
      {error && <p className="error-text">{error}</p>}
      
      {isAccepted ? (
        <div className="status-badge accepted">
          <span className="checkmark">✓</span> Accepted
        </div>
      ) : isRejected ? (
        <div className="status-badge rejected">
          <span className="x">✕</span> Rejected
        </div>
      ) : isPending ? (
        <div className="action-buttons">
          <button
            className="btn-accept"
            onClick={handleAccept}
            disabled={loading}
            title="Accept this offer"
          >
            {loading ? 'Accepting...' : 'Accept'}
          </button>
          <button
            className="btn-reject"
            onClick={handleReject}
            disabled={loading}
            title="Reject this offer"
          >
            {loading ? 'Rejecting...' : 'Reject'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
