import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { jobsService } from '../lib/jobsService'
import './JobsJobSeekerDisplay.css'

export default function JobsJobSeekerDisplay({ business, userId }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedJob, setExpandedJob] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [showApplicationForm, setShowApplicationForm] = useState(false)
  const [applicationData, setApplicationData] = useState({
    message: '',
    availability: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Hiring parameters
  const [hiringInfo, setHiringInfo] = useState({
    hiring_status: business?.metadata?.hiring_status || 'not_hiring',
    positions_available: business?.metadata?.positions_available || 0,
    salary_range_min: business?.metadata?.salary_range_min || null,
    salary_range_max: business?.metadata?.salary_range_max || null,
    experience_level: business?.metadata?.experience_level || 'any',
    benefits: business?.metadata?.benefits || '',
    hiring_timeline: business?.metadata?.hiring_timeline || ''
  })

  useEffect(() => {
    if (business?.id) {
      loadJobs()
      loadHiringInfo()
    }
  }, [business?.id])

  const loadJobs = async () => {
    try {
      setLoading(true)
      const jobsList = await jobsService.getBusinessJobs(business.id)
      // Filter to only active, public jobs
      const activeJobs = jobsList?.filter(j => j.status === 'active' && j.is_public) || []
      setJobs(activeJobs)
    } catch (err) {
      console.error('Error loading jobs:', err)
      setError('Failed to load job positions')
    } finally {
      setLoading(false)
    }
  }

  const loadHiringInfo = () => {
    if (business?.metadata) {
      setHiringInfo({
        hiring_status: business.metadata.hiring_status || 'not_hiring',
        positions_available: business.metadata.positions_available || 0,
        salary_range_min: business.metadata.salary_range_min || null,
        salary_range_max: business.metadata.salary_range_max || null,
        experience_level: business.metadata.experience_level || 'any',
        benefits: business.metadata.benefits || '',
        hiring_timeline: business.metadata.hiring_timeline || ''
      })
    }
  }

  const getHiringStatusColor = () => {
    switch (hiringInfo.hiring_status) {
      case 'actively_hiring':
        return '#10b981'
      case 'limited_hiring':
        return '#f59e0b'
      case 'not_hiring':
        return '#ef4444'
      default:
        return '#6b7280'
    }
  }

  const getHiringStatusText = () => {
    switch (hiringInfo.hiring_status) {
      case 'actively_hiring':
        return '🟢 Actively Hiring'
      case 'limited_hiring':
        return '🟡 Limited Hiring'
      case 'not_hiring':
        return '🔴 Not Hiring'
      default:
        return 'Hiring Status Unknown'
    }
  }

  const handleJobSelect = (job) => {
    setSelectedJob(job)
    setShowApplicationForm(true)
  }

  const handleApplicationChange = (e) => {
    const { name, value } = e.target
    setApplicationData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmitApplication = async (e) => {
    e.preventDefault()

    if (!userId) {
      setError('Please log in to apply for a job')
      return
    }

    try {
      setSubmitting(true)
      setError('')

      // Create job offer/application
      const { data, error: createError } = await supabase
        .from('job_offers')
        .insert([{
          job_id: selectedJob.id,
          business_id: business.id,
          service_provider_id: userId,
          status: 'pending',
          offer_message: applicationData.message,
          metadata: {
            availability: applicationData.availability,
            applied_at: new Date().toISOString()
          },
          created_at: new Date().toISOString()
        }])
        .select()

      if (createError) throw createError

      setError('success|Application submitted successfully! The business owner will review your application.')
      setShowApplicationForm(false)
      setApplicationData({ message: '', availability: '' })
      setTimeout(() => setError(''), 5000)
    } catch (err) {
      console.error('Error submitting application:', err)
      setError('Failed to submit application. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const salaryRangeDisplay = () => {
    if (hiringInfo.salary_range_min && hiringInfo.salary_range_max) {
      return `₱${parseInt(hiringInfo.salary_range_min).toLocaleString()} - ₱${parseInt(hiringInfo.salary_range_max).toLocaleString()}`
    } else if (hiringInfo.salary_range_min) {
      return `₱${parseInt(hiringInfo.salary_range_min).toLocaleString()}+`
    } else if (hiringInfo.salary_range_max) {
      return `Up to ₱${parseInt(hiringInfo.salary_range_max).toLocaleString()}`
    }
    return 'Salary negotiable'
  }

  return (
    <div className="jobs-seeker-display">
      {error && (
        <div className={`error-message ${error.startsWith('success') ? 'success' : ''}`}>
          {error.replace('success|', '')}
          <button onClick={() => setError('')} className="close-error">×</button>
        </div>
      )}

      {/* Hiring Status Overview */}
      <div className="hiring-overview">
        <div className="status-banner" style={{ borderColor: getHiringStatusColor() }}>
          <span className="status-text" style={{ color: getHiringStatusColor() }}>
            {getHiringStatusText()}
          </span>
          {hiringInfo.positions_available > 0 && (
            <span className="positions-badge">
              {hiringInfo.positions_available} position{hiringInfo.positions_available !== 1 ? 's' : ''} available
            </span>
          )}
        </div>

        {/* Hiring Details Grid */}
        <div className="hiring-details-grid">
          <div className="detail-box">
            <span className="detail-label">Salary Range</span>
            <span className="detail-value">{salaryRangeDisplay()}</span>
          </div>
          <div className="detail-box">
            <span className="detail-label">Experience Level</span>
            <span className="detail-value">{hiringInfo.experience_level}</span>
          </div>
          <div className="detail-box">
            <span className="detail-label">Hiring Timeline</span>
            <span className="detail-value">{hiringInfo.hiring_timeline || 'TBD'}</span>
          </div>
        </div>

        {/* Benefits Section */}
        {hiringInfo.benefits && (
          <div className="benefits-section">
            <h4>Benefits & Perks</h4>
            <p>{hiringInfo.benefits}</p>
          </div>
        )}
      </div>

      {/* Available Positions */}
      <div className="positions-section">
        <div className="section-header">
          <h3>Available Positions</h3>
          <span className="count-badge">{jobs.length}</span>
        </div>

        {loading ? (
          <div className="loading">Loading positions...</div>
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <p>No job positions available at this time</p>
          </div>
        ) : (
          <div className="positions-list">
            {jobs.map(job => (
              <div 
                key={job.id} 
                className={`position-card ${expandedJob === job.id ? 'expanded' : ''}`}
              >
                {/* Position Header */}
                <div 
                  className="position-header"
                  onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                >
                  <div className="header-left">
                    <h4>{job.job_title}</h4>
                    <p className="category">{job.job_category} • {job.job_type}</p>
                  </div>
                  <div className="header-right">
                    <span className="expand-icon">{expandedJob === job.id ? '▼' : '▶'}</span>
                  </div>
                </div>

                {/* Quick Info Bar */}
                <div className="quick-info">
                  <span className="info">💰 ₱{job.pay_rate?.toLocaleString() || 'Negotiable'}</span>
                  <span className="info">📍 {job.positions_available} position(s)</span>
                  {job.deadline_for_applications && (
                    <span className="info">📅 Deadline: {new Date(job.deadline_for_applications).toLocaleDateString()}</span>
                  )}
                </div>

                {/* Expanded Content */}
                {expandedJob === job.id && (
                  <div className="position-details">
                    <div className="description-section">
                      <h5>About This Position</h5>
                      <p>{job.job_description}</p>
                    </div>

                    {job.skills_required && job.skills_required.length > 0 && (
                      <div className="skills-section">
                        <h5>Required Skills</h5>
                        <div className="skills-list">
                          {Array.isArray(job.skills_required) ? (
                            job.skills_required.map((skill, idx) => (
                              <span key={idx} className="skill-tag">{skill}</span>
                            ))
                          ) : (
                            <p>Skills not specified</p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="requirements-section">
                      <h5>Requirements</h5>
                      <ul>
                        <li>Experience Level: {job.experience_level}</li>
                        <li>Job Type: {job.job_type}</li>
                        <li>Positions Available: {job.positions_available}</li>
                        {job.deadline_for_applications && (
                          <li>Application Deadline: {new Date(job.deadline_for_applications).toLocaleDateString()}</li>
                        )}
                      </ul>
                    </div>

                    {/* Application Section */}
                    {userId ? (
                      <button
                        onClick={() => handleJobSelect(job)}
                        className="btn-apply"
                      >
                        → Apply for This Position
                      </button>
                    ) : (
                      <p className="login-prompt">Please log in to apply for this position</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Application Modal */}
      {showApplicationForm && selectedJob && (
        <div className="modal-overlay" onClick={() => setShowApplicationForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Apply for {selectedJob.job_title}</h3>
              <button 
                className="btn-close" 
                onClick={() => setShowApplicationForm(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmitApplication} className="application-form">
              <div className="form-group">
                <label htmlFor="message">Cover Letter / Message *</label>
                <textarea
                  id="message"
                  name="message"
                  value={applicationData.message}
                  onChange={handleApplicationChange}
                  placeholder="Tell the employer why you're interested in this position..."
                  rows="5"
                  required
                ></textarea>
              </div>

              <div className="form-group">
                <label htmlFor="availability">When can you start? *</label>
                <input
                  type="text"
                  id="availability"
                  name="availability"
                  value={applicationData.availability}
                  onChange={handleApplicationChange}
                  placeholder="e.g., Immediately, 2 weeks, 1 month"
                  required
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => setShowApplicationForm(false)}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
