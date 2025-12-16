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
      // Get current user from auth
      const { data: authData } = await supabase.auth.getUser()
      if (!authData?.user) {
        setError('Not authenticated')
        return
      }

      // Try to load from profiles table, fall back to auth metadata
      let profileData = null
      try {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, phone_number')
          .eq('user_id', userId)
          .single()
        profileData = data
      } catch (e) {
        // profiles table might not exist, that's ok
      }

      setUserProfile({
        full_name: profileData?.full_name || authData.user.user_metadata?.full_name || 'User',
        email: authData.user.email,
        phone_number: profileData?.phone_number || authData.user.user_metadata?.phone_number
      })
    } catch (err) {
      console.error('Error loading user profile:', err?.message || String(err))
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
        position_applied_for: job.job_title,
        salary_expectation: job.pay_rate,
        salary_currency: job.pay_currency || 'PHP',
        applicant_name: userProfile.full_name,
        applicant_email: userProfile.email,
        applicant_phone: userProfile.phone_number || ''
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

  return (
    <div className="apply-modal-overlay" onClick={onClose}>
      <div className="apply-modal-container" onClick={e => e.stopPropagation()}>
        {/* Header with Title */}
        <div className="apply-modal-header">
          <h2>Apply for Job</h2>
        </div>

        {/* Scrollable Content */}
        <div className="apply-modal-content">
          {/* Job Title */}
          <div className="apply-job-title">
            <h3>{job.job_title}</h3>
          </div>

          {/* Job Details Section */}
          <div className="apply-section">
            <h4 className="apply-section-title">JOB DETAILS</h4>
            <div className="apply-detail-item">
              <span className="apply-detail-label">Category:</span>
              <span className="apply-detail-value">{formatFieldValue(job.job_category)}</span>
            </div>
            <div className="apply-detail-item">
              <span className="apply-detail-label">Type:</span>
              <span className="apply-detail-value">{formatFieldValue(job.job_type)}</span>
            </div>
            <div className="apply-detail-item">
              <span className="apply-detail-label">Location:</span>
              <span className="apply-detail-value">{job.city}{job.province ? `, ${job.province}` : ''}</span>
            </div>
          </div>

          {/* Compensation Section */}
          <div className="apply-section">
            <h4 className="apply-section-title">COMPENSATION</h4>
            <div className="apply-detail-item">
              <span className="apply-detail-label">Rate:</span>
              <span className="apply-detail-value">₱{job.pay_rate?.toFixed(2) || 'Negotiable'}</span>
            </div>
            <div className="apply-detail-item">
              <span className="apply-detail-label">Pay Type:</span>
              <span className="apply-detail-value">{formatFieldValue(job.pay_type)}</span>
            </div>
          </div>

          {/* Description Section */}
          {job.job_description && (
            <div className="apply-section">
              <h4 className="apply-section-title">DESCRIPTION</h4>
              <p className="apply-description-text">{job.job_description}</p>
            </div>
          )}

          {/* Timeline Section */}
          {job.start_date && (
            <div className="apply-section">
              <h4 className="apply-section-title">TIMELINE</h4>
              <div className="apply-detail-item">
                <span className="apply-detail-label">Start Date:</span>
                <span className="apply-detail-value">{new Date(job.start_date).toLocaleDateString()}</span>
              </div>
            </div>
          )}

          {/* Cover Letter Section */}
          <div className="apply-section">
            <h4 className="apply-section-title">YOUR COVER LETTER</h4>
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              className="apply-textarea"
              placeholder="Tell the employer about your interest in this position..."
              disabled={loading || userLoading}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="apply-error-message">
              {error}
              <button onClick={() => setError('')} className="apply-error-close">×</button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="apply-modal-footer">
          <button
            className="apply-btn-cancel"
            onClick={onClose}
            disabled={loading || userLoading}
          >
            Cancel
          </button>
          <button
            className="apply-btn-submit"
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
