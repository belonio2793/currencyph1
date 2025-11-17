import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import './UserProfileDetailsModal.css'

export default function UserProfileDetailsModal({ userId, onClose }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [userProfile, setUserProfile] = useState(null)
  const [stats, setStats] = useState({
    postedJobs: 0,
    acceptedOffers: 0,
    completedJobs: 0,
    averageRating: 0,
    totalRatings: 0
  })
  const [jobHistory, setJobHistory] = useState([])
  const [ratings, setRatings] = useState([])
  const [postedJobs, setPostedJobs] = useState([])
  const [verificationStatus, setVerificationStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (userId) {
      loadProfileData()
    }
  }, [userId])

  const loadProfileData = async () => {
    try {
      setLoading(true)
      setError('')

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('id, full_name, username, email, profile_picture_url, display_name_type, biography, country_code, relationship_status, phone_number, created_at, kyc_verified')
        .eq('id', userId)
        .single()

      if (profileError && profileError.code !== 'PGRST116') throw profileError
      setUserProfile(profileData)

      // Fetch verification status
      const { data: verifyData } = await supabase
        .from('user_verifications')
        .select('status, document_type, verified_at, is_public')
        .eq('user_id', userId)
        .single()

      if (verifyData) setVerificationStatus(verifyData)

      // Fetch all stats in parallel
      const [
        { count: postedCount },
        { count: acceptedCount },
        { count: completedCount },
        { data: ratingsData },
        { data: jobHistoryData },
        { data: postedJobsData }
      ] = await Promise.all([
        supabase
          .from('jobs')
          .select('id', { count: 'exact' })
          .eq('posted_by_user_id', userId),
        supabase
          .from('job_offers')
          .select('id', { count: 'exact' })
          .eq('service_provider_id', userId)
          .eq('status', 'accepted'),
        supabase
          .from('job_history')
          .select('id', { count: 'exact' })
          .eq('service_provider_id', userId)
          .eq('completion_status', 'completed'),
        supabase
          .from('job_ratings')
          .select('id, rating_score, review_text, created_at, rated_by_user_id')
          .eq('rated_user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('job_history')
          .select('id, job_id, final_amount_paid, completion_status, created_at, jobs(id, job_title, job_category, pay_rate)')
          .eq('service_provider_id', userId)
          .eq('completion_status', 'completed')
          .order('created_at', { ascending: false }),
        supabase
          .from('jobs')
          .select('id, job_title, job_category, pay_rate, status, created_at, job_offers(id)')
          .eq('posted_by_user_id', userId)
          .order('created_at', { ascending: false })
      ])

      const avgRating = ratingsData && ratingsData.length > 0
        ? (ratingsData.reduce((sum, r) => sum + (r.rating_score || 0), 0) / ratingsData.length).toFixed(1)
        : 0

      setStats({
        postedJobs: postedCount || 0,
        acceptedOffers: acceptedCount || 0,
        completedJobs: completedCount || 0,
        averageRating: avgRating,
        totalRatings: ratingsData?.length || 0
      })

      setJobHistory(jobHistoryData || [])
      setRatings(ratingsData || [])
      setPostedJobs(postedJobsData || [])
    } catch (err) {
      console.error('Error loading profile data:', err)
      setError('Failed to load profile information')
    } finally {
      setLoading(false)
    }
  }

  const getDisplayName = (profile) => {
    if (!profile) return 'Unknown'
    const displayType = profile?.display_name_type || 'full_name'

    switch (displayType) {
      case 'username':
        return profile.username || profile.full_name || 'User'
      case 'first_name':
        return profile.full_name?.split(' ')[0] || 'User'
      case 'last_name':
        return profile.full_name?.split(' ').pop() || 'User'
      case 'full_name':
      default:
        return profile.full_name || 'User'
    }
  }

  const formatDisplayNameType = (type) => {
    if (!type) return 'Full Name'
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const blurEmail = (email) => {
    if (!email) return ''
    const [localPart, domain] = email.split('@')
    const visibleChars = Math.ceil(localPart.length / 3)
    const blurred = localPart.substring(0, visibleChars) + '*'.repeat(localPart.length - visibleChars)
    return `${blurred}@${domain}`
  }

  const handleSendMessage = () => {
    onClose()
    window.dispatchEvent(new CustomEvent('openChat', { detail: { userId } }))
  }

  if (loading) {
    return (
      <div className="profile-details-overlay" onClick={onClose}>
        <div className="profile-details-modal" onClick={e => e.stopPropagation()}>
          <div className="loading">Loading profile...</div>
        </div>
      </div>
    )
  }

  if (!userProfile) {
    return (
      <div className="profile-details-overlay" onClick={onClose}>
        <div className="profile-details-modal" onClick={e => e.stopPropagation()}>
          <div className="error">Profile not found</div>
        </div>
      </div>
    )
  }

  const memberSince = new Date(userProfile.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

  return (
    <div className="profile-details-overlay" onClick={onClose}>
      <div className="profile-details-modal expanded" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="profile-header">
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Profile Info */}
        <div className="profile-main">
          <div className="profile-avatar-section">
            <div className="profile-avatar">
              {userProfile.profile_picture_url ? (
                <img src={userProfile.profile_picture_url} alt={getDisplayName(userProfile)} />
              ) : (
                <div className="avatar-placeholder">
                  {getDisplayName(userProfile).charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          <div className="profile-info">
            <h2 className="profile-name">{getDisplayName(userProfile)}</h2>
            <p className="profile-email">{userProfile.email}</p>
            {userProfile.biography && (
              <p className="profile-bio">{userProfile.biography}</p>
            )}
            <p className="profile-member-since">Member since {memberSince}</p>
          </div>
        </div>

        {error && (
          <div className="error-message">{error}</div>
        )}

        {/* Stats */}
        <div className="profile-stats">
          <div className="stat-card">
            <div className="stat-value">{stats.postedJobs}</div>
            <div className="stat-label">Jobs Posted</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.acceptedOffers}</div>
            <div className="stat-label">Offers Accepted</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.completedJobs}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.averageRating}</div>
            <div className="stat-label">Avg Rating ({stats.totalRatings})</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="profile-tab-nav">
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Job History ({stats.completedJobs})
          </button>
          <button
            className={`tab-btn ${activeTab === 'ratings' ? 'active' : ''}`}
            onClick={() => setActiveTab('ratings')}
          >
            Ratings ({stats.totalRatings})
          </button>
          <button
            className={`tab-btn ${activeTab === 'posted' ? 'active' : ''}`}
            onClick={() => setActiveTab('posted')}
          >
            Posted Jobs ({stats.postedJobs})
          </button>
          <button
            className={`tab-btn ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            Account Info
          </button>
        </div>

        {/* Tab Content */}
        <div className="profile-tab-content">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="tab-panel">
              <h3 className="section-title">Profile Overview</h3>
              <div className="overview-section">
                <div className="overview-item">
                  <span className="label">Display Name Type:</span>
                  <span className="value">{userProfile.display_name_type?.replace(/_/g, ' ') || 'Full Name'}</span>
                </div>
                {userProfile.country_code && (
                  <div className="overview-item">
                    <span className="label">Country:</span>
                    <span className="value">{userProfile.country_code}</span>
                  </div>
                )}
                {userProfile.relationship_status && (
                  <div className="overview-item">
                    <span className="label">Relationship Status:</span>
                    <span className="value">{userProfile.relationship_status}</span>
                  </div>
                )}
                <div className="overview-item">
                  <span className="label">Member Since:</span>
                  <span className="value">{memberSince}</span>
                </div>
                <div className="overview-item">
                  <span className="label">Account Status:</span>
                  <span className="value verified">{userProfile.kyc_verified ? '✓ Verified' : 'Not Verified'}</span>
                </div>
              </div>

              {verificationStatus && (
                <div className="verification-section">
                  <h4>Identity Verification</h4>
                  <div className="verification-status">
                    <span className={`status-badge ${verificationStatus.status}`}>
                      {verificationStatus.status.toUpperCase()}
                    </span>
                    {verificationStatus.document_type && (
                      <p><strong>Document:</strong> {verificationStatus.document_type}</p>
                    )}
                    {verificationStatus.didit_verified_at && (
                      <p><strong>Verified:</strong> {new Date(verificationStatus.didit_verified_at).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Job History Tab */}
          {activeTab === 'history' && (
            <div className="tab-panel">
              <h3 className="section-title">Completed Job History</h3>
              {jobHistory.length === 0 ? (
                <p className="empty-message">No completed jobs yet</p>
              ) : (
                <div className="job-history-list">
                  {jobHistory.map((job, idx) => (
                    <div key={idx} className="history-item">
                      <div className="history-header">
                        <div className="history-title">{job.jobs?.job_title || 'Job'}</div>
                        <div className="history-meta">
                          {job.final_amount_paid && (
                            <span className="amount">₱{job.final_amount_paid?.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                      <div className="history-details">
                        <span className="category">{job.jobs?.job_category}</span>
                        <span className="date">{new Date(job.completed_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Ratings Tab */}
          {activeTab === 'ratings' && (
            <div className="tab-panel">
              <h3 className="section-title">Ratings & Reviews</h3>
              {ratings.length === 0 ? (
                <p className="empty-message">No ratings yet</p>
              ) : (
                <div className="ratings-list">
                  <div className="rating-summary">
                    <div className="average-rating">
                      <span className="big-rating">{stats.averageRating}</span>
                      <span className="out-of">/ 5.0</span>
                    </div>
                    <p className="total-ratings">Based on {stats.totalRatings} review{stats.totalRatings !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="ratings-list-items">
                    {ratings.map((rating, idx) => (
                      <div key={idx} className="rating-item">
                        <div className="rating-header">
                          <div className="rating-stars">
                            {'★'.repeat(Math.round(rating.rating_score))}{'☆'.repeat(5 - Math.round(rating.rating_score))}
                          </div>
                          <span className="rating-date">{new Date(rating.created_at).toLocaleDateString()}</span>
                        </div>
                        {rating.review_text && (
                          <p className="rating-review">{rating.review_text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Posted Jobs Tab */}
          {activeTab === 'posted' && (
            <div className="tab-panel">
              <h3 className="section-title">Posted Jobs</h3>
              {postedJobs.length === 0 ? (
                <p className="empty-message">No jobs posted yet</p>
              ) : (
                <div className="posted-jobs-list">
                  {postedJobs.map((job, idx) => (
                    <div key={idx} className="posted-job-item">
                      <div className="job-header">
                        <div className="job-title">{job.job_title}</div>
                        <span className={`job-status ${job.status}`}>{job.status}</span>
                      </div>
                      <div className="job-details">
                        <span className="category">{job.job_category}</span>
                        <span className="pay">₱{job.pay_rate?.toFixed(2) || 'TBD'}</span>
                        <span className="offers">{job.job_offers?.length || 0} offer{(job.job_offers?.length || 0) !== 1 ? 's' : ''}</span>
                        <span className="date">{new Date(job.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Account Info Tab */}
          {activeTab === 'account' && (
            <div className="tab-panel">
              <h3 className="section-title">Account Information</h3>
              <button className="send-message-btn" onClick={handleSendMessage}>
                📧 Send Message
              </button>
              <div className="account-info-section">
                <div className="info-group">
                  <h4>Basic Information</h4>
                  <div className="info-item">
                    <span className="label">Full Name:</span>
                    <span className="value">{userProfile.full_name || '-'}</span>
                  </div>
                  {userProfile.username && (
                    <div className="info-item">
                      <span className="label">Username:</span>
                      <span className="value">@{userProfile.username}</span>
                    </div>
                  )}
                  <div className="info-item">
                    <span className="label">Display Name Type:</span>
                    <span className="value">{formatDisplayNameType(userProfile.display_name_type)}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Email:</span>
                    <span className="value blurred">{blurEmail(userProfile.email)}</span>
                  </div>
                  {userProfile.phone_number && (
                    <div className="info-item">
                      <span className="label">Phone:</span>
                      <span className="value">{userProfile.phone_number}</span>
                    </div>
                  )}
                </div>

                <div className="info-group">
                  <h4>Account Details</h4>
                  <div className="info-item">
                    <span className="label">Member Since:</span>
                    <span className="value">{memberSince}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Account Created:</span>
                    <span className="value">{new Date(userProfile.created_at).toLocaleString()}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Identity Verification:</span>
                    <span className={`value ${userProfile.kyc_verified ? 'verified' : ''}`}>
                      {userProfile.kyc_verified ? '✓ Verified' : '○ Not Verified'}
                    </span>
                  </div>
                </div>

                {userProfile.biography && (
                  <div className="info-group">
                    <h4>Biography</h4>
                    <p className="bio-text">{userProfile.biography}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
