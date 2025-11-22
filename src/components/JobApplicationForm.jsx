import { useState } from 'react'
import { jobApplicationService } from '../lib/jobApplicationService'
import './JobApplicationForm.css'

export default function JobApplicationForm({ business, job, userId, onClose, onSubmitted }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [coverLetter, setCoverLetter] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!coverLetter.trim()) {
      setError('Please write a cover letter')
      return
    }

    try {
      setLoading(true)
      setError('')

      const result = await jobApplicationService.createApplication({
        job_id: job?.id,
        business_id: business?.id,
        position_applied_for: job?.job_title || '',
        cover_letter: coverLetter,
        salary_expectation: job?.salary || null,
        salary_currency: 'PHP',
        years_of_experience: 0,
        employment_type: 'full_time',
        work_arrangement: 'on_site'
      })

      if (result.error) {
        setError(result.error.message || 'Failed to submit application')
      } else {
        if (onSubmitted) {
          onSubmitted()
        }
        onClose()
      }
    } catch (err) {
      console.error('Error submitting application:', err)
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  const jobStartDate = formatDate(job?.start_date)
  const jobEndDate = formatDate(job?.end_date)
  const applicationDeadline = formatDate(job?.application_deadline)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content job-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Apply for Job</h2>
          </div>
          <button onClick={onClose} className="modal-close">×</button>
        </div>

        {/* Main Content */}
        <div className="modal-body">
          
          {/* Job Title Card */}
          <div className="job-header">
            <div className="job-title-section">
              <h3 className="job-title">{job?.job_title || 'Position'}</h3>
              <p className="job-location">{job?.location || 'Location TBD'}</p>
              <p className="job-posted">Posted {jobStartDate}</p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="error-alert">
              <span>{error}</span>
              <button onClick={() => setError('')} className="error-close">×</button>
            </div>
          )}

          {/* Job Details Table */}
          <div className="details-section">
            <h4 className="section-label">JOB DETAILS</h4>
            <div className="details-table">
              <div className="detail-row">
                <span className="detail-label">Category:</span>
                <span className="detail-value">{job?.category || 'Not specified'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Type:</span>
                <span className="detail-value">{job?.job_type || 'Not specified'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Location:</span>
                <span className="detail-value">{job?.location || 'Not specified'}</span>
              </div>
            </div>
          </div>

          {/* Compensation Section */}
          <div className="details-section">
            <h4 className="section-label">COMPENSATION</h4>
            <div className="details-table">
              <div className="detail-row">
                <span className="detail-label">Rate:</span>
                <span className="detail-value">
                  {job?.salary ? `₱${parseFloat(job.salary).toLocaleString()}` : 'Not specified'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Pay Type:</span>
                <span className="detail-value">{job?.pay_type || 'Not specified'}</span>
              </div>
            </div>
          </div>

          {/* Description Section */}
          {job?.description && (
            <div className="details-section">
              <h4 className="section-label">DESCRIPTION</h4>
              <p className="description-text">{job.description}</p>
            </div>
          )}

          {/* Timeline Section */}
          <div className="details-section">
            <h4 className="section-label">TIMELINE</h4>
            <div className="details-table">
              <div className="detail-row">
                <span className="detail-label">Start Date:</span>
                <span className="detail-value">{jobStartDate}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">End Date:</span>
                <span className="detail-value">{jobEndDate}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Application Deadline:</span>
                <span className="detail-value">{applicationDeadline}</span>
              </div>
            </div>
          </div>

          {/* Cover Letter Section */}
          <form onSubmit={handleSubmit} className="cover-letter-section">
            <h4 className="section-label">YOUR COVER LETTER</h4>
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              placeholder="I am interested in this position and am ready to start immediately."
              className="cover-letter-input"
              disabled={loading}
            />
          </form>
        </div>

        {/* Footer Actions */}
        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn-cancel"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="btn-submit"
            disabled={loading}
          >
            {loading ? 'Submitting...' : 'Submit Application'}
          </button>
        </div>
      </div>
    </div>
  )
}
