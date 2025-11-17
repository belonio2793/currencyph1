import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatFieldValue } from '../lib/formatters'
import UserProfileDetailsModal from './UserProfileDetailsModal'
import './JobCard.css'

export default function JobCard({ job, onSelect, onApply }) {
  const [showRating, setShowRating] = useState(false)
  const [posterProfile, setPosterProfile] = useState(null)
  const [showProfileModal, setShowProfileModal] = useState(false)

  useEffect(() => {
    if (job?.posted_by_user_id) {
      loadPosterProfile()
    }
  }, [job?.posted_by_user_id])

  const loadPosterProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, username, profile_picture_url, display_name_type')
        .eq('id', job.posted_by_user_id)
        .single()

      if (error) throw error
      setPosterProfile(data)
    } catch (err) {
      console.error('Error loading poster profile:', err)
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

  const averageRating = job.job_ratings && job.job_ratings.length > 0
    ? (job.job_ratings.reduce((sum, r) => sum + r.rating_score, 0) / job.job_ratings.length).toFixed(1)
    : 0

  const offersCount = job.job_offers?.length || 0

  return (
    <>
      {showProfileModal && job.posted_by_user_id && (
        <UserProfileDetailsModal
          userId={job.posted_by_user_id}
          onClose={() => setShowProfileModal(false)}
        />
      )}
      <div className="job-card" onClick={() => onSelect(job)}>
        {/* Poster Profile Section */}
        {posterProfile && (
          <div className="job-poster-section">
            <div
              className="poster-avatar-wrapper"
              onClick={(e) => {
                e.stopPropagation()
                setShowProfileModal(true)
              }}
            >
              <div className="poster-avatar">
                {posterProfile.profile_picture_url ? (
                  <img src={posterProfile.profile_picture_url} alt={getDisplayName(posterProfile)} />
                ) : (
                  <div className="avatar-placeholder">
                    {getDisplayName(posterProfile).charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="poster-info">
                <p className="poster-name">{getDisplayName(posterProfile)}</p>
                <p className="poster-display-type">{posterProfile.display_name_type?.replace(/_/g, ' ') || 'default'}</p>
              </div>
            </div>
          </div>
        )}

        <div className="job-card-header">
          <div className="job-title-section">
            <h3 className="job-title">{job.job_title}</h3>
            <span className="job-category">{formatFieldValue(job.job_category)}</span>
          </div>
          <span className={`job-status ${job.status}`}>{job.status}</span>
        </div>

        <p className="job-description">
          {job.job_description.substring(0, 120)}...
        </p>

        <div className="job-meta">
          <div className="meta-item">
            <span className="label">Type:</span>
            <span className="value">{formatFieldValue(job.job_type)}</span>
          </div>
          <div className="meta-item">
            <span className="label">Pay:</span>
            <span className="value">₱{job.pay_rate?.toFixed(2) || 'TBD'}</span>
          </div>
          <div className="meta-item">
            <span className="label">Location:</span>
            <span className="value">{job.city || job.location}</span>
          </div>
        </div>

        <div className="job-stats">
          <div className="stat">
            <span className="label">Offers:</span>
            <span className="text">{offersCount}</span>
          </div>
          {job.job_ratings && job.job_ratings.length > 0 && (
            <div className="stat">
              <span className="label">Rating:</span>
              <span className="text">{averageRating} ({job.job_ratings.length})</span>
            </div>
          )}
          <div className="stat">
            <span className="label">Posted:</span>
            <span className="text">{new Date(job.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="job-card-footer">
          <button
            className="btn-view-details"
            onClick={(e) => {
              e.stopPropagation()
              onSelect(job)
            }}
          >
            View Details
          </button>
          <button
            className="btn-apply"
            onClick={(e) => {
              e.stopPropagation()
              onApply()
            }}
          >
            Apply Now
          </button>
        </div>

        {job.skills_required && (
          <div className="skills-section">
            <label>Required Skills:</label>
            <div className="skills-list">
              {JSON.parse(job.skills_required).slice(0, 3).map((skill, idx) => (
                <span key={idx} className="skill-tag">{skill}</span>
              ))}
              {JSON.parse(job.skills_required).length > 3 && (
                <span className="skill-tag">+{JSON.parse(job.skills_required).length - 3}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
