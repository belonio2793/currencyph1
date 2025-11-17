import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { jobsService } from '../lib/jobsService'
import JobCard from './JobCard'
import PostJobModal from './PostJobModal'
import JobDetailsModal from './JobDetailsModal'
import './Jobs.css'

export default function EmployerJobsOverview({ businessId, currentUserId }) {
  const [jobs, setJobs] = useState([])
  const [offers, setOffers] = useState([])
  const [activeTab, setActiveTab] = useState('posted-jobs')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
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

  // Load categories and cities
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

  // Load jobs and offers
  useEffect(() => {
    loadData()
  }, [businessId, activeTab])

  const loadData = async () => {
    setLoading(true)
    setError('')

    try {
      if (activeTab === 'posted-jobs') {
        const data = await jobsService.getBusinessJobs(businessId)
        setJobs(data)
      } else {
        const data = await jobsService.getBusinessOffers(businessId)
        setOffers(data)
      }
      
      // Load stats
      const statsData = await jobsService.getBusinessJobStats(businessId)
      setStats(statsData)
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Failed to load jobs data.')
    } finally {
      setLoading(false)
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
      loadData()
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

  const handleDeleteJob = async (jobId) => {
    if (!confirm('Are you sure you want to delete this job posting?')) return
    try {
      await jobsService.deleteJob(jobId)
      loadData()
    } catch (err) {
      console.error('Error deleting job:', err)
      setError('Failed to delete job.')
    }
  }

  return (
    <div className="jobs-employer-container">
      <div className="jobs-header">
        <div className="jobs-title-section">
          <h2>Posted Jobs</h2>
          <p>Manage job postings and offers for this business</p>
        </div>

        {activeTab === 'posted-jobs' && (
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
          className={`tab ${activeTab === 'posted-jobs' ? 'active' : ''}`}
          onClick={() => setActiveTab('posted-jobs')}
        >
          Posted Jobs
        </button>
        <button
          className={`tab ${activeTab === 'offers' ? 'active' : ''}`}
          onClick={() => setActiveTab('offers')}
        >
          Offers Received
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className={`error-message ${error.toLowerCase().includes('success') ? 'success' : ''}`}>
          {error}
          <button onClick={() => setError('')} className="close-error">×</button>
        </div>
      )}

      {/* Content */}
      {activeTab === 'posted-jobs' ? (
        <div className="jobs-content">
          {loading ? (
            <div className="loading">Loading jobs...</div>
          ) : jobs.length === 0 ? (
            <div className="empty-state">
              <h3>No jobs posted yet</h3>
              <p>Create your first job posting to start finding service providers</p>
              <button
                className="btn-primary"
                onClick={() => setShowPostModal(true)}
              >
                Post a Job
              </button>
            </div>
          ) : (
            <div className="employer-jobs-list">
              {jobs.map(job => (
                <div key={job.id} className="employer-job-item">
                  <div className="job-header">
                    <div>
                      <h3>{job.job_title}</h3>
                      <p className="job-category">{job.job_category}</p>
                    </div>
                    <span className={`job-status ${job.status}`}>{job.status}</span>
                  </div>

                  <div className="job-details">
                    <div className="detail-row">
                      <span className="detail-label">Type:</span>
                      <span>{job.job_type}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Rate:</span>
                      <span>₱{job.pay_rate?.toFixed(2)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Location:</span>
                      <span>{job.city}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Posted:</span>
                      <span>{new Date(job.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="job-actions">
                    <button
                      className="btn-small"
                      onClick={() => handleJobSelect(job)}
                    >
                      View Details
                    </button>
                    <button
                      className="btn-small btn-danger"
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
      ) : (
        <div className="offers-content">
          {loading ? (
            <div className="loading">Loading offers...</div>
          ) : offers.length === 0 ? (
            <div className="empty-state">
              <h3>No offers received yet</h3>
              <p>Offers will appear here when people apply for your jobs</p>
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
                    <p><strong>Provider Rate:</strong> ₱{offer.offered_rate?.toFixed(2)}</p>
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
          onApply={() => {}}
          onEdit={() => {
            setShowJobDetails(false)
          }}
          currentUserId={currentUserId}
          businessId={businessId}
        />
      )}
    </div>
  )
}
