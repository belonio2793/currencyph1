import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { jobsService } from '../lib/jobsService'
import './JobsManagementModal.css'

export default function JobsManagementModal({ business, userId, onClose, onUpdated }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Hiring parameters state
  const [hiringParams, setHiringParams] = useState({
    hiring_status: business?.metadata?.hiring_status || 'not_hiring',
    positions_available: business?.metadata?.positions_available || 0,
    avg_salary: business?.metadata?.avg_salary || '',
    salary_range_min: business?.metadata?.salary_range_min || '',
    salary_range_max: business?.metadata?.salary_range_max || '',
    experience_level: business?.metadata?.experience_level || 'any',
    job_types: business?.metadata?.job_types || [],
    required_skills: business?.metadata?.required_skills || [],
    hiring_timeline: business?.metadata?.hiring_timeline || '',
    benefits: business?.metadata?.benefits || ''
  })

  // New job form state
  const [showNewJobForm, setShowNewJobForm] = useState(false)
  const [newJob, setNewJob] = useState({
    job_title: '',
    job_category: '',
    job_description: '',
    job_type: 'full_time',
    pay_rate: '',
    pay_currency: 'PHP',
    pay_type: 'fixed',
    skills_required: [],
    experience_level: 'entry',
    positions_available: 1,
    deadline_for_applications: ''
  })

  useEffect(() => {
    if (business?.id) {
      loadJobs()
    }
  }, [business?.id])

  const loadJobs = async () => {
    try {
      setLoading(true)
      const jobsList = await jobsService.getBusinessJobs(business.id)
      setJobs(jobsList || [])
      setError('')
    } catch (err) {
      console.error('Error loading jobs:', err)
      // If table doesn't exist, show a friendly message but don't block the form
      if (err?.message?.includes('not found') || err?.code === 'PGRST116') {
        console.debug('Jobs table not yet available, showing empty state')
        setJobs([])
        setError('')
      } else {
        setError('Unable to load existing jobs, but you can still create new ones')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleHiringParamsChange = (e) => {
    const { name, value } = e.target
    setHiringParams(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleNewJobChange = (e) => {
    const { name, value } = e.target
    setNewJob(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSaveHiringParams = async () => {
    try {
      setLoading(true)
      setError('')

      // Validate positions available
      const positionsAvailable = parseInt(hiringParams.positions_available) || 0

      // Update business metadata
      const { error: updateError } = await supabase
        .from('businesses')
        .update({
          metadata: {
            ...business.metadata,
            ...hiringParams,
            positions_available: positionsAvailable,
            hiring_parameters_updated_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', business.id)
        .eq('user_id', userId)

      if (updateError) throw updateError

      setSuccess('Hiring parameters saved successfully!')
      if (onUpdated) {
        onUpdated({ ...business, metadata: { ...business.metadata, ...hiringParams } })
      }
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error saving hiring params:', err)
      setError('Failed to save hiring parameters')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateJob = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError('')

      if (!newJob.job_title.trim()) {
        throw new Error('Job title is required')
      }

      const jobData = {
        business_id: business.id,
        posted_by_user_id: userId,
        job_title: newJob.job_title,
        job_category: newJob.job_category,
        job_description: newJob.job_description,
        job_type: newJob.job_type,
        pay_rate: parseFloat(newJob.pay_rate) || null,
        pay_currency: newJob.pay_currency,
        pay_type: newJob.pay_type,
        skills_required: newJob.skills_required.length > 0 ? newJob.skills_required : [],
        experience_level: newJob.experience_level,
        positions_available: parseInt(newJob.positions_available) || 1,
        deadline_for_applications: newJob.deadline_for_applications || null,
        status: 'active',
        is_public: true,
        city: business.city_of_registration || '',
        location: business.city_of_registration || ''
      }

      await jobsService.createJob(jobData)
      
      setSuccess('Job created successfully!')
      setShowNewJobForm(false)
      setNewJob({
        job_title: '',
        job_category: '',
        job_description: '',
        job_type: 'full_time',
        pay_rate: '',
        pay_currency: 'PHP',
        pay_type: 'fixed',
        skills_required: [],
        experience_level: 'entry',
        positions_available: 1,
        deadline_for_applications: ''
      })
      
      loadJobs()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error creating job:', err)
      setError(err?.message || 'Failed to create job')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job?')) return

    try {
      setLoading(true)
      await jobsService.softDeleteJob(jobId)
      setSuccess('Job deleted successfully!')
      loadJobs()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error deleting job:', err)
      setError('Failed to delete job')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content jobs-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <h2>Jobs & Hiring Management</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        {/* Messages */}
        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError('')} className="close-msg">×</button>
          </div>
        )}
        {success && (
          <div className="success-message">
            {success}
            <button onClick={() => setSuccess('')} className="close-msg">×</button>
          </div>
        )}

        {/* Tabs */}
        <div className="modal-tabs">
          <button
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Hiring Overview
          </button>
          <button
            className={`tab ${activeTab === 'positions' ? 'active' : ''}`}
            onClick={() => setActiveTab('positions')}
          >
            Job Positions ({jobs.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="modal-body">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="tab-content">
              <div className="form-section">
                <h3>Hiring Status & Parameters</h3>

                <div className="form-group">
                  <label htmlFor="hiring_status">Hiring Status *</label>
                  <select
                    id="hiring_status"
                    name="hiring_status"
                    value={hiringParams.hiring_status}
                    onChange={handleHiringParamsChange}
                  >
                    <option value="actively_hiring">🟢 Actively Hiring</option>
                    <option value="limited_hiring">🟡 Limited Hiring</option>
                    <option value="not_hiring">🔴 Not Hiring</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="positions_available">Positions Available</label>
                    <input
                      type="number"
                      id="positions_available"
                      name="positions_available"
                      value={hiringParams.positions_available}
                      onChange={handleHiringParamsChange}
                      min="0"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="experience_level">Required Experience</label>
                    <select
                      id="experience_level"
                      name="experience_level"
                      value={hiringParams.experience_level}
                      onChange={handleHiringParamsChange}
                    >
                      <option value="any">Any Level</option>
                      <option value="entry">Entry Level</option>
                      <option value="mid">Mid Level</option>
                      <option value="senior">Senior Level</option>
                      <option value="executive">Executive</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="salary_range_min">Min. Salary (₱)</label>
                    <input
                      type="number"
                      id="salary_range_min"
                      name="salary_range_min"
                      value={hiringParams.salary_range_min}
                      onChange={handleHiringParamsChange}
                      placeholder="0"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="salary_range_max">Max. Salary (₱)</label>
                    <input
                      type="number"
                      id="salary_range_max"
                      name="salary_range_max"
                      value={hiringParams.salary_range_max}
                      onChange={handleHiringParamsChange}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="hiring_timeline">Hiring Timeline</label>
                  <input
                    type="text"
                    id="hiring_timeline"
                    name="hiring_timeline"
                    value={hiringParams.hiring_timeline}
                    onChange={handleHiringParamsChange}
                    placeholder="e.g., Immediate, 2 weeks, 1 month"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="benefits">Benefits & Perks</label>
                  <textarea
                    id="benefits"
                    name="benefits"
                    value={hiringParams.benefits}
                    onChange={handleHiringParamsChange}
                    placeholder="Describe benefits, perks, or compensation..."
                    rows="3"
                  ></textarea>
                </div>

                <button
                  onClick={handleSaveHiringParams}
                  className="btn-save"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Hiring Parameters'}
                </button>
              </div>
            </div>
          )}

          {/* Positions Tab */}
          {activeTab === 'positions' && (
            <div className="tab-content">
              {!showNewJobForm ? (
                <button
                  onClick={() => setShowNewJobForm(true)}
                  className="btn-add-job"
                >
                  + Create New Position
                </button>
              ) : (
                <form onSubmit={handleCreateJob} className="new-job-form">
                  <div className="form-section">
                    <h3>Create New Job Position</h3>

                    <div className="form-group">
                      <label htmlFor="job_title">Job Title *</label>
                      <input
                        type="text"
                        id="job_title"
                        name="job_title"
                        value={newJob.job_title}
                        onChange={handleNewJobChange}
                        placeholder="e.g., Senior Developer"
                        required
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="job_category">Category</label>
                        <input
                          type="text"
                          id="job_category"
                          name="job_category"
                          value={newJob.job_category}
                          onChange={handleNewJobChange}
                          placeholder="e.g., IT, Sales"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="job_type">Job Type</label>
                        <select
                          id="job_type"
                          name="job_type"
                          value={newJob.job_type}
                          onChange={handleNewJobChange}
                        >
                          <option value="full_time">Full Time</option>
                          <option value="part_time">Part Time</option>
                          <option value="contract">Contract</option>
                          <option value="temporary">Temporary</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="pay_rate">Pay Rate (₱)</label>
                        <input
                          type="number"
                          id="pay_rate"
                          name="pay_rate"
                          value={newJob.pay_rate}
                          onChange={handleNewJobChange}
                          placeholder="0"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="positions_available">Positions</label>
                        <input
                          type="number"
                          id="positions_available"
                          name="positions_available"
                          value={newJob.positions_available}
                          onChange={handleNewJobChange}
                          min="1"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="job_description">Job Description</label>
                      <textarea
                        id="job_description"
                        name="job_description"
                        value={newJob.job_description}
                        onChange={handleNewJobChange}
                        placeholder="Describe the job responsibilities..."
                        rows="4"
                      ></textarea>
                    </div>

                    <div className="form-group">
                      <label htmlFor="experience_level">Experience Level</label>
                      <select
                        id="experience_level"
                        name="experience_level"
                        value={newJob.experience_level}
                        onChange={handleNewJobChange}
                      >
                        <option value="entry">Entry Level</option>
                        <option value="mid">Mid Level</option>
                        <option value="senior">Senior Level</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="deadline_for_applications">Application Deadline</label>
                      <input
                        type="date"
                        id="deadline_for_applications"
                        name="deadline_for_applications"
                        value={newJob.deadline_for_applications}
                        onChange={handleNewJobChange}
                      />
                    </div>

                    <div className="form-actions">
                      <button
                        type="button"
                        onClick={() => setShowNewJobForm(false)}
                        className="btn-cancel"
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn-submit" disabled={loading}>
                        {loading ? 'Creating...' : 'Create Position'}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Jobs List */}
              {loading && !showNewJobForm ? (
                <div className="loading">Loading positions...</div>
              ) : jobs.length === 0 && !showNewJobForm ? (
                <div className="empty-state">
                  <p>No job positions created yet</p>
                  <button
                    onClick={() => setShowNewJobForm(true)}
                    className="btn-add-job"
                  >
                    Create Your First Position
                  </button>
                </div>
              ) : (
                <div className="jobs-list">
                  {jobs.map(job => (
                    <div key={job.id} className="job-item">
                      <div className="job-header">
                        <div>
                          <h4>{job.job_title}</h4>
                          <p className="category">{job.job_category} • {job.job_type}</p>
                        </div>
                        <span className={`status ${job.status}`}>{job.status}</span>
                      </div>

                      <div className="job-details">
                        <span className="detail">💰 ₱{job.pay_rate?.toLocaleString() || 'Negotiable'}</span>
                        <span className="detail">📍 {job.positions_available} position(s)</span>
                        {job.job_offers && <span className="detail">📋 {job.job_offers.length} offer(s)</span>}
                      </div>

                      <div className="job-actions">
                        <button
                          onClick={() => handleDeleteJob(job.id)}
                          className="btn-delete-job"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="modal-footer">
          <button onClick={onClose} className="btn-close-modal">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
