import { useState } from 'react'
import { formatFieldValue } from '../lib/formatters'
import './JobCard.css'

export default function JobCard({ job, onSelect, onApply }) {
  const [showRating, setShowRating] = useState(false)

  const averageRating = job.job_ratings && job.job_ratings.length > 0
    ? (job.job_ratings.reduce((sum, r) => sum + r.rating_score, 0) / job.job_ratings.length).toFixed(1)
    : 0

  const offersCount = job.job_offers?.length || 0

  return (
    <div className="job-card" onClick={() => onSelect(job)}>
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
          <span className="icon">👥</span>
          <span className="text">{offersCount} offers</span>
        </div>
        {job.job_ratings && job.job_ratings.length > 0 && (
          <div className="stat">
            <span className="icon">⭐</span>
            <span className="text">{averageRating} ({job.job_ratings.length} reviews)</span>
          </div>
        )}
        <div className="stat">
          <span className="icon">📅</span>
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
  )
}
