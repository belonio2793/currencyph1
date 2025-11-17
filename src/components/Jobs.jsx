import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { jobsService } from '../lib/jobsService'
import JobCard from './JobCard'
import JobSearch from './JobSearch'
import PostJobModal from './PostJobModal'
import EditJobModal from './EditJobModal'
import SubmitJobModal from './SubmitJobModal'
import LookingToHireModal from './LookingToHireModal'
import JobDetailsModal from './JobDetailsModal'
import SelectBusinessModal from './SelectBusinessModal'
import UserProfilePreview from './UserProfilePreview'
import './Jobs.css'

export default function Jobs({ userId }) {
  const [userType, setUserType] = useState('job-seeker') // 'employer' or 'job-seeker'
  const [activeTab, setActiveTab] = useState('job-listings') // 'job-listings', 'offers-received', 'my-jobs'
  const [jobs, setJobs] = useState([])
  const [offers, setOffers] = useState([])
  const [userJobs, setUserJobs] = useState([])
  const [userBusinesses, setUserBusinesses] = useState([])
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({})
  const [showPostModal, setShowPostModal] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showLookingToHireModal, setShowLookingToHireModal] = useState(false)
  const [showSelectBusiness, setShowSelectBusiness] = useState(false)
  const [selectedJob, setSelectedJob] = useState(null)
  const [showJobDetails, setShowJobDetails] = useState(false)
  const [showEditJobModal, setShowEditJobModal] = useState(false)
  const [editingJob, setEditingJob] = useState(null)
  const [categories, setCategories] = useState([])
  const [cities, setCities] = useState([])
  const [stats, setStats] = useState({
    totalJobs: 0,
    activeJobs: 0,
    filledJobs: 0,
    totalOffers: 0,
    acceptedOffers: 0
  })

  // Load categories, cities, and user's businesses
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [cats, citys, businesses] = await Promise.all([
          jobsService.getJobCategories(),
          jobsService.getJobCities(),
          userId ? loadUserBusinesses() : Promise.resolve([])
        ])
        setCategories(cats)
        setCities(citys)
        setUserBusinesses(businesses)

        // Determine user type based on whether they have businesses
        if (businesses && businesses.length > 0) {
          setUserType('employer')
        } else {
          setUserType('job-seeker')
        }
      } catch (err) {
        console.error('Error loading initial data:', err)
      }
    }

    if (userId) {
      loadInitialData()
    }
  }, [userId])

  // Load user's businesses
  const loadUserBusinesses = async () => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', userId)

      if (error) throw error
      console.log(`Jobs: Loaded ${data?.length || 0} businesses for user`, userId)
      return data || []
    } catch (err) {
      console.error('Jobs: Error loading businesses:', err)
      return []
    }
  }

  // Load jobs based on active tab
  useEffect(() => {
    loadJobs()
  }, [activeTab, filters, selectedBusiness])

  // Load user stats
  useEffect(() => {
    if (selectedBusiness) {
      loadStats()
    }
  }, [selectedBusiness])

  const loadJobs = async () => {
    setLoading(true)
    setError('')

    try {
      if (activeTab === 'job-listings') {
        const data = await jobsService.getActiveJobs(filters)
        setJobs(data)
      } else if (activeTab === 'offers-received') {
        const data = await jobsService.getProviderOffers(userId)
        setOffers(data)
      } else if (activeTab === 'my-jobs') {
        // Get jobs posted by the user
        const data = await jobsService.getUserJobHistory(userId)
        setUserJobs(data)
      }
    } catch (err) {
      console.error('Error loading jobs:', err)
      setError('Failed to load jobs. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const data = await jobsService.getBusinessJobStats(selectedBusiness.id)
      setStats(data)
    } catch (err) {
      console.error('Error loading stats:', err)
    }
  }

  const handlePostJobClick = () => {
    if (userBusinesses.length === 0) {
      setError('Please create a business first to post jobs.')
      return
    }
    if (userBusinesses.length === 1) {
      setSelectedBusiness(userBusinesses[0])
      setShowPostModal(true)
    } else {
      setShowSelectBusiness(true)
    }
  }

  const handleSelectBusiness = (business) => {
    setSelectedBusiness(business)
    setShowSelectBusiness(false)
    setShowPostModal(true)
  }

  const handlePostJob = async (jobData) => {
    try {
      const newJob = await jobsService.createJob({
        ...jobData,
        business_id: selectedBusiness.id,
        posted_by_user_id: userId
      })
      setShowPostModal(false)
      loadJobs()
      loadStats()
    } catch (err) {
      console.error('Error posting job:', err)
      setError('Failed to post job. Please try again.')
    }
  }

  const handleJobSelect = async (job) => {
    try {
      const fullJob = await jobsService.getJobById(job.id)
      setSelectedJob(fullJob)
      setShowJobDetails(true)
    } catch (err) {
      console.error('Error loading job details:', err)
      setError('Failed to load job details.')
    }
  }

  const handleApplyForJob = async (jobId, offerData) => {
    try {
      await jobsService.createJobOffer({
        job_id: jobId,
        service_provider_id: userId,
        business_id: selectedJob.business_id,
        ...offerData
      })
      loadJobs()
      setShowJobDetails(false)
    } catch (err) {
      console.error('Error applying for job:', err)
      setError('Failed to apply for job. Please try again.')
    }
  }

  const handleSubmitJob = async (jobData) => {
    try {
      // Ensure user has a business to submit the job
      let businessId = null

      if (userBusinesses.length === 0) {
        // Create a default business for the user if they don't have one
        try {
          const { data: newBusiness, error: createError } = await supabase
            .from('businesses')
            .insert([{
              user_id: userId,
              name: `${jobData.job_title || 'Service'} Provider`,
              registration_type: 'sole',
              status: 'active'
            }])
            .select()
            .single()

          if (createError) throw createError
          businessId = newBusiness.id

          // Update local businesses list
          setUserBusinesses([...userBusinesses, newBusiness])
        } catch (err) {
          console.warn('Could not create business:', err)
          setError('Please create a business profile first to submit jobs.')
          return
        }
      } else {
        businessId = userBusinesses[0].id
      }

      const newJob = await jobsService.createJob({
        ...jobData,
        business_id: businessId,
        posted_by_user_id: userId,
        is_public: true,
        status: 'active'
      })
      setShowSubmitModal(false)
      loadJobs()
      setError('Job submitted successfully!')
      setTimeout(() => setError(''), 3000)
    } catch (err) {
      console.error('Error submitting job:', err)
      let errorMessage = 'Unknown error occurred'

      if (err?.message) {
        errorMessage = err.message
      } else if (err?.details) {
        errorMessage = typeof err.details === 'string' ? err.details : JSON.stringify(err.details)
      } else if (err?.error_description) {
        errorMessage = err.error_description
      } else if (typeof err === 'string') {
        errorMessage = err
      } else if (err?.toString && err.toString() !== '[object Object]') {
        errorMessage = err.toString()
      }

      setError(`Failed to submit job: ${errorMessage}`)
    }
  }

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters)
  }

  const handleEditJob = async (jobData, jobId) => {
    try {
      await jobsService.updateJob(jobId, jobData)
      setShowEditJobModal(false)
      setEditingJob(null)
      loadJobs()
      setError('Job updated successfully!')
      setTimeout(() => setError(''), 3000)
    } catch (err) {
      console.error('Error updating job:', err)
      setError('Failed to update job. Please try again.')
    }
  }

  const handleDeleteJob = async (jobId) => {
    if (window.confirm('Are you sure you want to delete this job?')) {
      try {
        await jobsService.softDeleteJob(jobId)
        loadJobs()
        setError('Job deleted successfully!')
        setTimeout(() => setError(''), 3000)
      } catch (err) {
        console.error('Error deleting job:', err)
        setError('Failed to delete job. Please try again.')
      }
    }
  }

  return (
    <div className="jobs-container">
      {/* User Profile Preview */}
      {userId && <UserProfilePreview userId={userId} />}

      <div className="jobs-header">
        <div className="jobs-title-section">
          <h2>Jobs Marketplace</h2>
          <p>
            {userType === 'employer'
              ? 'Post jobs and find service providers'
              : 'Browse jobs and submit your offers'}
          </p>
        </div>

        <div className="header-buttons" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {userId && (
            <>
              <button
                className="btn-post-job"
                onClick={() => setShowSubmitModal(true)}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  transition: 'background 0.2s ease'
                }}
              >
                <span style={{ marginRight: '6px' }}>+</span> Post a Job
              </button>

              <button
                className="btn-looking-to-hire"
                onClick={() => setShowLookingToHireModal(true)}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  transition: 'background 0.2s ease'
                }}
              >
                <span style={{ marginRight: '6px' }}>+</span> Looking For Work
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats Dashboard - Only for employers */}
      {userType === 'employer' && selectedBusiness && (
        <div className="jobs-stats">
          <div className="stat-card">
            <div className="stat-value">{stats.activeJobs}</div>
            <div className="stat-label">Active Jobs</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalOffers}</div>
            <div className="stat-label">Total Offers</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.acceptedOffers}</div>
            <div className="stat-label">Accepted</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.filledJobs}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>
      )}

      {/* Business Selector for Employers */}
      {userType === 'employer' && userBusinesses.length > 1 && (
        <div className="business-selector">
          <label>Select Business:</label>
          <select 
            value={selectedBusiness?.id || ''}
            onChange={(e) => {
              const business = userBusinesses.find(b => b.id === e.target.value)
              if (business) setSelectedBusiness(business)
            }}
          >
            <option value="">Choose a business...</option>
            {userBusinesses.map(business => (
              <option key={business.id} value={business.id}>
                {business.business_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tabs */}
      <div className="jobs-tabs">
        <button
          className={`tab ${activeTab === 'job-listings' ? 'active' : ''}`}
          onClick={() => setActiveTab('job-listings')}
        >
          Job Listings
        </button>
        <button
          className={`tab ${activeTab === 'offers-received' ? 'active' : ''}`}
          onClick={() => setActiveTab('offers-received')}
        >
          Offers Received
        </button>
        <button
          className={`tab ${activeTab === 'my-jobs' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-jobs')}
        >
          My Jobs
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className={`error-message ${error.toLowerCase().includes('success') ? 'success' : ''}`}>
          {error}
          <button onClick={() => setError('')} className="close-error">×</button>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'job-listings' ? (
        <div className="jobs-content">
          <JobSearch
            onFilterChange={handleFilterChange}
            categories={categories}
            cities={cities}
          />

          {loading ? (
            <div className="loading">Loading jobs...</div>
          ) : jobs.length === 0 ? (
            <div className="empty-state">
              <h3>
                {userType === 'employer'
                  ? 'No jobs posted yet'
                  : 'No jobs found'}
              </h3>
              <p>
                {userType === 'employer'
                  ? 'Create your first job posting to start finding service providers'
                  : 'Try adjusting your search filters'}
              </p>
              {userType === 'job-seeker' && (
                <button
                  className="btn-primary"
                  onClick={() => setFilters({})}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="jobs-grid">
              {jobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  onSelect={() => handleJobSelect(job)}
                  onApply={() => handleJobSelect(job)}
                />
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'offers-received' ? (
        <div className="offers-content">
          {loading ? (
            <div className="loading">Loading offers...</div>
          ) : offers.length === 0 ? (
            <div className="empty-state">
              <h3>
                {userType === 'employer'
                  ? 'No offers received yet'
                  : 'No offers submitted yet'}
              </h3>
              <p>
                {userType === 'employer'
                  ? 'Offers will appear here when people apply for your jobs'
                  : 'Browse available jobs and submit your offers'}
              </p>
              {userType === 'job-seeker' && (
                <button
                  className="btn-primary"
                  onClick={() => setActiveTab('job-listings')}
                >
                  Browse Jobs
                </button>
              )}
            </div>
          ) : (
            <div className="offers-list">
              {offers.map(offer => (
                <div key={offer.id} className="offer-item">
                  <div className="offer-header">
                    <h3>{offer.jobs?.job_title}</h3>
                    <span className={`status ${offer.status}`}>{offer.status}</span>
                  </div>
                  <div className="offer-details">
                    <p><strong>Category:</strong> {offer.jobs?.job_category}</p>
                    <p><strong>Your Rate:</strong> ₱{offer.offered_rate?.toFixed(2)}</p>
                    <p><strong>Job Rate:</strong> ₱{offer.jobs?.pay_rate?.toFixed(2)}</p>
                    <p><strong>Type:</strong> {offer.jobs?.job_type}</p>
                  </div>
                  <div className="offer-message">
                    <p>{offer.offer_message}</p>
                  </div>
                  <div className="offer-footer">
                    <span className="date">{new Date(offer.created_at).toLocaleDateString()}</span>
                    <button
                      className="btn-small"
                      onClick={() => handleJobSelect(offer.jobs)}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="my-jobs-content">
          {loading ? (
            <div className="loading">Loading your jobs...</div>
          ) : userJobs.length === 0 ? (
            <div className="empty-state">
              <h3>No jobs posted yet</h3>
              <p>Start by posting your first job to connect with service providers</p>
              <button
                className="btn-primary"
                onClick={() => setShowSubmitModal(true)}
              >
                Post a Job
              </button>
            </div>
          ) : (
            <div className="user-jobs-list">
              {userJobs.map(job => (
                <div key={job.id} className="user-job-card">
                  <div className="job-card-header">
                    <div className="job-title-section">
                      <h3>{job.job_title}</h3>
                      <p className="job-category">{job.job_category}</p>
                    </div>
                    <div className="job-status-section">
                      <span className={`job-status ${job.status}`}>{job.status}</span>
                      {job.job_offers && job.job_offers.length > 0 && (
                        <span className="offer-count">{job.job_offers.length} offer{job.job_offers.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>

                  <div className="job-card-details">
                    <div className="detail-item">
                      <span className="label">Rate:</span>
                      <span className="value">₱{job.pay_rate?.toFixed(2)}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Type:</span>
                      <span className="value">{job.job_type}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Location:</span>
                      <span className="value">{job.city || job.location}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Posted:</span>
                      <span className="value">{new Date(job.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="job-description">
                    <p>{job.job_description}</p>
                  </div>

                  <div className="job-card-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => handleJobSelect(job)}
                    >
                      View Details
                    </button>
                    <button
                      className="btn-edit"
                      onClick={() => {
                        setEditingJob(job)
                        setShowEditJobModal(true)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDeleteJob(job.id)}
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

      {/* Modals */}
      {showSelectBusiness && (
        <SelectBusinessModal
          businesses={userBusinesses}
          onSelect={handleSelectBusiness}
          onClose={() => setShowSelectBusiness(false)}
        />
      )}

      {showPostModal && selectedBusiness && (
        <PostJobModal
          onClose={() => setShowPostModal(false)}
          onSubmit={handlePostJob}
          categories={categories}
          cities={cities}
        />
      )}

      {showSubmitModal && (
        <SubmitJobModal
          onClose={() => setShowSubmitModal(false)}
          onSubmit={handleSubmitJob}
          categories={categories}
          cities={cities}
          userBusinesses={userBusinesses}
          userId={userId}
        />
      )}

      {showLookingToHireModal && (
        <LookingToHireModal
          onClose={() => setShowLookingToHireModal(false)}
          onSubmit={handleSubmitJob}
          categories={categories}
          cities={cities}
          userBusinesses={userBusinesses}
          userId={userId}
        />
      )}

      {showJobDetails && selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          onClose={() => setShowJobDetails(false)}
          onApply={handleApplyForJob}
          onEdit={(job) => {
            setEditingJob(job)
            setShowEditJobModal(true)
            setShowJobDetails(false)
          }}
          currentUserId={userId}
          businessId={selectedBusiness?.id}
        />
      )}

      {showEditJobModal && editingJob && (
        <EditJobModal
          job={editingJob}
          onClose={() => {
            setShowEditJobModal(false)
            setEditingJob(null)
          }}
          onSubmit={handleEditJob}
          categories={categories}
          cities={cities}
        />
      )}
    </div>
  )
}
