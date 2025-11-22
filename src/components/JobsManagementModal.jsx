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
              {/* Business Preview Card */}
              <div style={{
                padding: '20px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                marginBottom: '30px'
              }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: '#334155' }}>
                  📋 How Your Business Appears in Job Listings
                </h3>
                <div style={{
                  backgroundColor: 'white',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '16px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}>
                  {/* Business Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '12px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: '#667eea',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '18px',
                      fontWeight: '700',
                      marginRight: '12px'
                    }}>
                      {business?.business_name?.charAt(0).toUpperCase() || 'B'}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: '#1a1a1a' }}>
                        {business?.business_name || 'Business Name'}
                      </p>
                      {business?.currency_registration_id && (
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                          CRN: {business.currency_registration_id}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Hiring Status Badge */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '12px'
                  }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      backgroundColor: hiringParams.hiring_status === 'actively_hiring'
                        ? '#dcfce7'
                        : hiringParams.hiring_status === 'limited_hiring'
                          ? '#fef3c7'
                          : '#fee2e2',
                      color: hiringParams.hiring_status === 'actively_hiring'
                        ? '#166534'
                        : hiringParams.hiring_status === 'limited_hiring'
                          ? '#92400e'
                          : '#991b1b',
                      fontSize: '0.85rem',
                      fontWeight: '600'
                    }}>
                      {hiringParams.hiring_status === 'actively_hiring' && '🟢 Actively Hiring'}
                      {hiringParams.hiring_status === 'limited_hiring' && '🟡 Limited Hiring'}
                      {hiringParams.hiring_status === 'not_hiring' && '🔴 Not Hiring'}
                    </span>
                    {hiringParams.positions_available > 0 && (
                      <span style={{
                        fontSize: '0.85rem',
                        color: '#64748b'
                      }}>
                        {hiringParams.positions_available} position{hiringParams.positions_available !== 1 ? 's' : ''} available
                      </span>
                    )}
                  </div>

                  {/* Hiring Details Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    fontSize: '0.9rem',
                    color: '#475569'
                  }}>
                    {hiringParams.salary_range_min || hiringParams.salary_range_max ? (
                      <>
                        <div>
                          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Salary Range</span>
                          <p style={{ margin: '4px 0 0 0', fontWeight: '600', color: '#1a1a1a' }}>
                            ₱{hiringParams.salary_range_min || '0'} - ₱{hiringParams.salary_range_max || '0'}
                          </p>
                        </div>
                      </>
                    ) : null}
                    {hiringParams.experience_level !== 'any' && (
                      <div>
                        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Experience</span>
                        <p style={{ margin: '4px 0 0 0', fontWeight: '600', color: '#1a1a1a', textTransform: 'capitalize' }}>
                          {hiringParams.experience_level}
                        </p>
                      </div>
                    )}
                    {hiringParams.hiring_timeline && (
                      <div>
                        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Timeline</span>
                        <p style={{ margin: '4px 0 0 0', fontWeight: '600', color: '#1a1a1a' }}>
                          {hiringParams.hiring_timeline}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Benefits Section */}
                  {hiringParams.benefits && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                      <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: '#64748b' }}>Benefits & Perks</p>
                      <p style={{ margin: '0', fontSize: '0.9rem', color: '#334155', lineHeight: '1.5' }}>
                        {hiringParams.benefits}
                      </p>
                    </div>
                  )}
                </div>

                <p style={{
                  margin: '12px 0 0 0',
                  fontSize: '0.8rem',
                  color: '#64748b',
                  fontStyle: 'italic'
                }}>
                  💡 This is how job seekers will see your business when browsing jobs. Save your hiring details to update this preview.
                </p>
              </div>

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
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {/* Positions Tab */}
          {activeTab === 'positions' && (
            <div className="tab-content">
              {showNewJobForm ? (
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
              ) : (
                <>
                  {/* Jobs List */}
                  {loading ? (
                    <div className="loading">Loading positions...</div>
                  ) : jobs.length === 0 ? (
                    <div className="empty-state">
                      <p>No job positions created yet</p>
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
                </>
              )}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="modal-footer">
          {activeTab === 'positions' && !showNewJobForm && (
            <button
              onClick={() => setShowNewJobForm(true)}
              className="btn-add-job"
              style={{ flex: 1, marginRight: '10px' }}
            >
              + Create New Position
            </button>
          )}
          <button onClick={onClose} className="btn-close-modal" style={{ flex: 1 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
