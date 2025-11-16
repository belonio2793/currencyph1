import { useState } from 'react'
import './JobRemarks.css'

export default function JobRemarks({
  remarks = [],
  onAddRemark,
  currentUserId,
  jobOwnerId
}) {
  const [remarkText, setRemarkText] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!remarkText.trim()) {
      setError('Please enter a remark')
      return
    }

    setLoading(true)
    try {
      await onAddRemark(remarkText, isPublic)
      setRemarkText('')
      setIsPublic(false)
      setError('')
    } catch (err) {
      console.error('Error adding remark:', err)
      setError('Failed to add remark')
    } finally {
      setLoading(false)
    }
  }

  const publicRemarks = remarks.filter(r => r.is_public)
  const privateRemarks = remarks.filter(r => !r.is_public && r.created_by_user_id === currentUserId)

  const canAddPrivateRemark = currentUserId === jobOwnerId

  return (
    <div className="remarks-container">
      {/* Add Remark Form */}
      <div className="add-remark-form">
        <h4>Add a Remark</h4>
        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <textarea
            value={remarkText}
            onChange={(e) => setRemarkText(e.target.value)}
            placeholder="Share your feedback or notes..."
            rows="4"
            className="remark-textarea"
          />

          <div className="remark-options">
            <div className="visibility-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  disabled={!canAddPrivateRemark}
                />
                <span>Make this remark public</span>
              </label>
              {!canAddPrivateRemark && (
                <small>Only job owner can make private remarks</small>
              )}
            </div>

            <button
              type="submit"
              className="btn-submit-remark"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Remark'}
            </button>
          </div>
        </form>
      </div>

      {/* Public Remarks Section */}
      <div className="remarks-section">
        <h4>Public Remarks ({publicRemarks.length})</h4>
        {publicRemarks.length === 0 ? (
          <p className="empty-state">No public remarks yet</p>
        ) : (
          <div className="remarks-list">
            {publicRemarks.map(remark => (
              <div key={remark.id} className="remark-card public">
                <div className="remark-header">
                  <span className="user-badge">👤</span>
                  <div className="remark-meta">
                    <span className="date">{new Date(remark.created_at).toLocaleDateString()}</span>
                    <span className="type-badge public">{remark.remark_type}</span>
                  </div>
                </div>
                <div className="remark-body">
                  <p>{remark.remark_text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Private Remarks Section (only visible to owner) */}
      {canAddPrivateRemark && (
        <div className="remarks-section">
          <h4>Private Remarks ({privateRemarks.length})</h4>
          {privateRemarks.length === 0 ? (
            <p className="empty-state">No private remarks yet</p>
          ) : (
            <div className="remarks-list">
              {privateRemarks.map(remark => (
                <div key={remark.id} className="remark-card private">
                  <div className="remark-header">
                    <span className="lock-badge">🔒</span>
                    <div className="remark-meta">
                      <span className="date">{new Date(remark.created_at).toLocaleDateString()}</span>
                      <span className="type-badge private">{remark.remark_type}</span>
                    </div>
                  </div>
                  <div className="remark-body">
                    <p>{remark.remark_text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
