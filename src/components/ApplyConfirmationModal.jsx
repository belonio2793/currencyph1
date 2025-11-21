import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { jobApplicationService } from '../lib/jobApplicationService'
import { formatFieldValue } from '../lib/formatters'
import './ApplyConfirmationModal.css'

export default function ApplyConfirmationModal({
  job,
  onClose,
  onAccept,
  userId
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userProfile, setUserProfile] = useState(null)
  const [userLoading, setUserLoading] = useState(true)
  const [coverLetter, setCoverLetter] = useState(`I am interested in this ${job?.job_title || 'position'} and am ready to start immediately.`)

  useEffect(() => {
    if (userId) {
      loadUserProfile()
    } else {
      setUserLoading(false)
    }
  }, [userId])

  const loadUserProfile = async () => {
    try {
      setUserLoading(true)
      const { data, error: queryError } = await supabase
        .from('users')
        .select('full_name, email, phone_number')
        .eq('id', userId)
        .single()

      if (queryError) throw queryError
      setUserProfile(data)
    } catch (err) {
      console.error('Error loading user profile:', err)
      setError('Failed to load your profile information')
    } finally {
      setUserLoading(false)
    }
  }

  const handleSubmitApplication = async () => {
    if (!job || !userId || !userProfile) {
      setError('Missing required information to submit application')
      return
    }

    if (!coverLetter.trim()) {
      setError('Please enter a cover letter for your application')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data, error: appError } = await jobApplicationService.createApplication({
        business_id: job.business_id,
        job_id: job.id,
        cover_letter: coverLetter,
        job_title: job.job_title,
        job_category: job.job_category,
        pay_rate: job.pay_rate,
        pay_currency: job.pay_currency || 'PHP'
      })

      if (appError) throw appError

      onClose()
      if (onAccept) {
        onAccept()
      }
    } catch (err) {
      console.error('Error submitting application:', err)
      let errorMessage = 'Failed to submit your application'
      if (err?.message) {
        errorMessage = err.message
      }
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (!job) return null

  const skillsList = job.skills_required ? (typeof job.skills_required === 'string' ? JSON.parse(job.skills_required) : job.skills_required) : []

  return (
    <div className="confirmation-modal-overlay" onClick={onClose}>
      <div className="confirmation-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="confirmation-header">
          <h2>Apply for Job</h2>
          <button className="close-btn" onClick={onClose}>X</button>
        </div>

        {/* Content */}
        <div className="confirmation-content">
          <div className="job-summary">
            <h3>{job.job_title}</h3>
            
            <div className="summary-section">
              <h4>Job Details</h4>
              <div className="detail-row">
                <span className="label">Category:</span>
                <span className="value">{formatFieldValue(job.job_category)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Type:</span>
                <span className="value">{formatFieldValue(job.job_type)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Location:</span>
                <span className="value">{job.city}{job.province ? `, ${job.province}` : ''}</span>
              </div>
            </div>

            <div className="summary-section">
              <h4>Compensation</h4>
              <div className="detail-row">
                <span className="label">Rate:</span>
                <span className="value highlight">₱{job.pay_rate?.toFixed(2) || 'Negotiable'}</span>
              </div>
              <div className="detail-row">
                <span className="label">Pay Type:</span>
                <span className="value">{formatFieldValue(job.pay_type)}</span>
              </div>
            </div>

            {job.job_description && (
              <div className="summary-section">
                <h4>Description</h4>
                <p className="description-text">
                  {job.job_description.length > 300
                    ? job.job_description.substring(0, 300) + '...'
                    : job.job_description}
                </p>
              </div>
            )}

            {skillsList.length > 0 && (
              <div className="summary-section">
                <h4>Required Skills</h4>
                <div className="skills-preview">
                  {skillsList.slice(0, 5).map((skill, idx) => (
                    <span key={idx} className="skill-tag">{skill}</span>
                  ))}
                  {skillsList.length > 5 && (
                    <span className="skill-tag">+{skillsList.length - 5}</span>
                  )}
                </div>
              </div>
            )}

            {job.start_date && (
              <div className="summary-section">
                <h4>Timeline</h4>
                <div className="detail-row">
                  <span className="label">Start Date:</span>
                  <span className="value">{new Date(job.start_date).toLocaleDateString()}</span>
                </div>
              </div>
            )}

            <div className="summary-section">
              <h4>Your Cover Letter</h4>
              <textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                className="message-textarea"
                placeholder="Tell the employer about your interest in this position..."
                rows="4"
                disabled={loading || userLoading}
              />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-message" style={{ marginBottom: '12px' }}>
            {error}
            <button onClick={() => setError('')} className="close-error">X</button>
          </div>
        )}

        {/* Actions */}
        <div className="confirmation-actions">
          <button
            className="btn-cancel"
            onClick={onClose}
            disabled={loading || userLoading}
          >
            Cancel
          </button>
          <button
            className="btn-accept"
            onClick={handleSubmitApplication}
            disabled={loading || userLoading}
          >
            {loading ? 'Submitting...' : userLoading ? 'Loading...' : 'Submit Application'}
          </button>
        </div>
      </div>
    </div>
  )
}
