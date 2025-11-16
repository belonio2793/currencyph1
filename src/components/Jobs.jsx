import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { jobsService } from '../lib/jobsService'
import JobCard from './JobCard'
import JobSearch from './JobSearch'
import PostJobModal from './PostJobModal'
import SubmitJobModal from './SubmitJobModal'
import JobDetailsModal from './JobDetailsModal'
import SelectBusinessModal from './SelectBusinessModal'
import './Jobs.css'

export default function Jobs({ userId }) {
  const [userType, setUserType] = useState('job-seeker') // 'employer' or 'job-seeker'
  const [activeTab, setActiveTab] = useState('looking-to-hire') // 'looking-to-hire' or 'offers'
  const [jobs, setJobs] = useState([])
  const [offers, setOffers] = useState([])
  const [userBusinesses, setUserBusinesses] = useState([])
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({})
  const [showPostModal, setShowPostModal] = useState(false)
  const [showSelectBusiness, setShowSelectBusiness] = useState(false)
  const [selectedJob, setSelectedJob] = useState(null)
  const [showJobDetails, setShowJobDetails] = useState(false)
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
          loadUserBusinesses()
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

    loadInitialData()
  }, [userId])

  // Load user's businesses
  const loadUserBusinesses = async () => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', userId)

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error loading businesses:', err)
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
      if (activeTab === 'looking-to-hire') {
        const data = await jobsService.getActiveJobs(filters)
        setJobs(data)
      } else {
        const data = await jobsService.getProviderOffers(userId)
        setOffers(data)
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

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters)
  }

  return (
    <div className="jobs-container">
      <div className="jobs-header">
        <div className="jobs-title-section">
          <h2>Jobs Marketplace</h2>
          <p>
            {userType === 'employer' 
              ? 'Post jobs and find service providers' 
              : 'Browse jobs and submit your offers'}
          </p>
        </div>

        {userType === 'employer' && activeTab === 'looking-to-hire' && (
          <button
            className="btn-post-job"
            onClick={handlePostJobClick}
          >
            <span className="icon">+</span> Post a Job
          </button>
        )}
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
          className={`tab ${activeTab === 'looking-to-hire' ? 'active' : ''}`}
          onClick={() => setActiveTab('looking-to-hire')}
        >
          {userType === 'employer' ? 'Post Jobs' : 'Available Jobs'}
        </button>
        <button
          className={`tab ${activeTab === 'offers' ? 'active' : ''}`}
          onClick={() => setActiveTab('offers')}
        >
          {userType === 'employer' ? 'Offers Received' : 'My Offers'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')} className="close-error">×</button>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'looking-to-hire' ? (
        <div className="jobs-content">
          {userType === 'job-seeker' && (
            <JobSearch
              onFilterChange={handleFilterChange}
              categories={categories}
              cities={cities}
            />
          )}

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
      ) : (
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
                  onClick={() => setActiveTab('looking-to-hire')}
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

      {showJobDetails && selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          onClose={() => setShowJobDetails(false)}
          onApply={handleApplyForJob}
          currentUserId={userId}
          businessId={selectedBusiness?.id}
        />
      )}
    </div>
  )
}
