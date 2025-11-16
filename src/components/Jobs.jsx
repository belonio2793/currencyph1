import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { jobsService } from '../lib/jobsService'
import JobCard from './JobCard'
import JobSearch from './JobSearch'
import PostJobModal from './PostJobModal'
import JobDetailsModal from './JobDetailsModal'
import './Jobs.css'

export default function Jobs({ businessId, currentUserId }) {
  const [activeTab, setActiveTab] = useState('looking-to-hire') // 'looking-to-hire' or 'offers'
  const [jobs, setJobs] = useState([])
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({})
  const [showPostModal, setShowPostModal] = useState(false)
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

  // Load categories and cities for search filters
  useEffect(() => {
    const loadSearchOptions = async () => {
      try {
        const [cats, citys] = await Promise.all([
          jobsService.getJobCategories(),
          jobsService.getJobCities()
        ])
        setCategories(cats)
        setCities(citys)
      } catch (err) {
        console.error('Error loading search options:', err)
      }
    }

    loadSearchOptions()
  }, [])

  // Load jobs based on active tab
  useEffect(() => {
    loadJobs()
  }, [activeTab, filters])

  // Load business stats
  useEffect(() => {
    if (businessId) {
      loadStats()
    }
  }, [businessId])

  const loadJobs = async () => {
    setLoading(true)
    setError('')

    try {
      if (activeTab === 'looking-to-hire') {
        const data = await jobsService.getActiveJobs(filters)
        setJobs(data)
      } else {
        const data = await jobsService.getProviderOffers(currentUserId)
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
      const data = await jobsService.getBusinessJobStats(businessId)
      setStats(data)
    } catch (err) {
      console.error('Error loading stats:', err)
    }
  }

  const handlePostJob = async (jobData) => {
    try {
      const newJob = await jobsService.createJob({
        ...jobData,
        business_id: businessId,
        posted_by_user_id: currentUserId
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
        service_provider_id: currentUserId,
        business_id: businessId,
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
          <p>Post jobs and find service providers</p>
        </div>

        {activeTab === 'looking-to-hire' && (
          <button
            className="btn-post-job"
            onClick={() => setShowPostModal(true)}
          >
            <span className="icon">+</span> Post a Job
          </button>
        )}
      </div>

      {/* Stats Dashboard */}
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

      {/* Tabs */}
      <div className="jobs-tabs">
        <button
          className={`tab ${activeTab === 'looking-to-hire' ? 'active' : ''}`}
          onClick={() => setActiveTab('looking-to-hire')}
        >
          Looking to Hire
        </button>
        <button
          className={`tab ${activeTab === 'offers' ? 'active' : ''}`}
          onClick={() => setActiveTab('offers')}
        >
          My Offers
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
          <JobSearch
            onFilterChange={handleFilterChange}
            categories={categories}
            cities={cities}
          />

          {loading ? (
            <div className="loading">Loading jobs...</div>
          ) : jobs.length === 0 ? (
            <div className="empty-state">
              <h3>No jobs found</h3>
              <p>Try adjusting your search filters</p>
              <button
                className="btn-primary"
                onClick={() => setFilters({})}
              >
                Clear Filters
              </button>
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
              <h3>No offers yet</h3>
              <p>Browse available jobs and submit your offers</p>
              <button
                className="btn-primary"
                onClick={() => setActiveTab('looking-to-hire')}
              >
                Browse Jobs
              </button>
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
      {showPostModal && (
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
          currentUserId={currentUserId}
          businessId={businessId}
        />
      )}
    </div>
  )
}
