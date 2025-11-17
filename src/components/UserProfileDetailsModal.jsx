import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { jobsService } from '../lib/jobsService'
import './UserProfileDetailsModal.css'

export default function UserProfileDetailsModal({ userId, onClose }) {
  const [userProfile, setUserProfile] = useState(null)
  const [stats, setStats] = useState({
    postedJobs: 0,
    acceptedOffers: 0,
    completedJobs: 0,
    averageRating: 0,
    totalRatings: 0,
    jobHistory: []
  })
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
        .select('id, full_name, username, email, profile_picture_url, display_name_type, biography, country_code, created_at')
        .eq('id', userId)
        .single()

      if (profileError) throw profileError
      setUserProfile(profileData)

      // Fetch stats
      const [
        { count: postedCount },
        { count: acceptedCount },
        { count: completedCount },
        { data: ratings },
        { data: jobHistoryData }
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
          .select('rating_score, review_text, created_at, rated_by_user_id')
          .eq('rated_user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('job_history')
          .select('id, job_id, final_amount_paid, completion_status, completed_at, jobs(job_title)')
          .eq('service_provider_id', userId)
          .eq('completion_status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(5)
      ])

      const avgRating = ratings && ratings.length > 0
        ? (ratings.reduce((sum, r) => sum + r.rating_score, 0) / ratings.length).toFixed(1)
        : 0

      setStats({
        postedJobs: postedCount || 0,
        acceptedOffers: acceptedCount || 0,
        completedJobs: completedCount || 0,
        averageRating: avgRating,
        totalRatings: ratings?.length || 0,
        jobHistory: jobHistoryData || []
      })
    } catch (err) {
      console.error('Error loading profile data:', err)
      setError('Failed to load profile information')
    } finally {
      setLoading(false)
    }
  }

  const getDisplayName = (profile) => {
    if (!profile) return 'Unknown'
    const displayType = profile.display_name_type || 'full_name'
    
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
      <div className="profile-details-modal" onClick={e => e.stopPropagation()}>
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

        {/* Tabs */}
        <div className="profile-tabs">
          <div className="profile-section">
            <h3>Recent Ratings</h3>
            {stats.totalRatings === 0 ? (
              <p className="empty-message">No ratings yet</p>
            ) : (
              <div className="ratings-list">
                {stats.totalRatings > 0 && (
                  <div className="ratings-info">
                    <p className="rating-summary">
                      <strong>{stats.averageRating}</strong> out of 5 stars (<strong>{stats.totalRatings}</strong> reviews)
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="profile-section">
            <h3>Job History</h3>
            {stats.jobHistory.length === 0 ? (
              <p className="empty-message">No completed jobs yet</p>
            ) : (
              <div className="job-history-list">
                {stats.jobHistory.map((job, idx) => (
                  <div key={idx} className="history-item">
                    <div className="history-title">{job.jobs?.job_title || 'Job'}</div>
                    <div className="history-meta">
                      <span className="status completed">Completed</span>
                      {job.final_amount_paid && (
                        <span className="amount">₱{job.final_amount_paid?.toFixed(2)}</span>
                      )}
                      {job.completed_at && (
                        <span className="date">
                          {new Date(job.completed_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
