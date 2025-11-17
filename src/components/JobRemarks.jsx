import { useState } from 'react'
import UserProfileModal from './UserProfileModal'
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
  const [selectedUserId, setSelectedUserId] = useState(null)

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

  const getDisplayName = (user) => {
    if (!user) return 'Unknown User'
    return user.full_name || user.username || user.email || 'Anonymous'
  }

  const getAvatarUrl = (user) => {
    if (!user) return null
    return user.profile_picture_url
  }

  const RemarksCard = ({ remark, isPrivate = false }) => {
    const user = remark.user || {}
    const displayName = getDisplayName(user)
    const avatarUrl = getAvatarUrl(user)

    return (
      <div key={remark.id} className={`remark-card ${isPrivate ? 'private' : 'public'}`}>
        <div className="remark-header">
          <div className="user-section">
            {isPrivate && <span className="lock-badge">🔒</span>}
            
            {/* User Avatar and Name */}
            <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => user.id && setSelectedUserId(user.id)}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="user-avatar"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1px solid #e0e0e0'
                  }}
                />
              ) : (
                <div
                  className="user-avatar-fallback"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#667eea',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    border: '1px solid #667eea'
                  }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span className="username" style={{ fontWeight: '600', color: '#667eea', textDecoration: 'underline' }}>
                  {displayName}
                </span>
                <span className="user-email" style={{ fontSize: '0.75rem', color: '#999' }}>
                  {user.email && user.email !== displayName ? user.email : ''}
                </span>
              </div>
            </div>
          </div>

          <div className="remark-meta">
            <span className="date">{new Date(remark.created_at).toLocaleDateString()}</span>
            <span className="type-badge public">{remark.remark_type}</span>
          </div>
        </div>

        <div className="remark-body">
          <p>{remark.remark_text}</p>
        </div>
      </div>
    )
  }

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
              <RemarksCard key={remark.id} remark={remark} isPrivate={false} />
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
                <RemarksCard key={remark.id} remark={remark} isPrivate={true} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* User Profile Modal */}
      {selectedUserId && (
        <UserProfileModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  )
}
