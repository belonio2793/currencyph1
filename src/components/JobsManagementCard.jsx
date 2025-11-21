import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabaseClient'
import { jobsService } from '../lib/jobsService'
import JobsManagementModal from './JobsManagementModal'
import JobSeekerRequestModal from './JobSeekerRequestModal'
import './JobsManagementCard.css'

export default function JobsManagementCard({ business, userId, onUpdate }) {
  // Check if current user is the business owner
  const isBusinessOwner = business?.user_id === userId

  // Don't render card if user is not the business owner
  if (!isBusinessOwner) {
    return null
  }

  const [jobsCount, setJobsCount] = useState(0)
  const [pendingOffers, setPendingOffers] = useState(0)
  const [hiringStatus, setHiringStatus] = useState(business?.metadata?.hiring_status || 'not_hiring')
  const [showModal, setShowModal] = useState(false)
  const [showJobSeekerModal, setShowJobSeekerModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (business?.id) {
      loadJobsData()
    }
  }, [business?.id])

  const loadJobsData = async () => {
    try {
      setLoading(true)

      let jobCount = 0
      let offersCount = 0

      // Get active jobs count
      try {
        const { count } = await supabase
          .from('jobs')
          .select('*', { count: 'exact' })
          .eq('business_id', business.id)
          .eq('status', 'active')
          .is('deleted_at', null)
        jobCount = count || 0
      } catch (jobErr) {
        console.debug('Jobs table query failed:', jobErr?.message)
        jobCount = 0
      }

      // Get pending job applications
      try {
        const { count } = await supabase
          .from('job_applications')
          .select('*', { count: 'exact' })
          .eq('business_id', business.id)
          .eq('status', 'submitted')
        offersCount = count || 0
      } catch (offersErr) {
        console.debug('Job applications table query failed:', offersErr?.message)
        offersCount = 0
      }

      setJobsCount(jobCount)
      setPendingOffers(offersCount)
      setHiringStatus(business?.metadata?.hiring_status || 'not_hiring')
    } catch (err) {
      console.error('Error loading jobs data:', err)
      // Don't set error for non-critical data loading issues
    } finally {
      setLoading(false)
    }
  }

  const handleModalClose = () => {
    setShowModal(false)
  }

  const handleModalUpdated = (updatedBusiness) => {
    setShowModal(false)
    if (onUpdate) {
      onUpdate(updatedBusiness)
    }
    loadJobsData()
    setError('success|Jobs information updated successfully!')
    setTimeout(() => setError(''), 3000)
  }

  const getHiringStatusColor = () => {
    switch (hiringStatus) {
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
    switch (hiringStatus) {
      case 'actively_hiring':
        return 'Actively Hiring'
      case 'limited_hiring':
        return 'Limited Hiring'
      case 'not_hiring':
        return 'Not Hiring'
      default:
        return 'Not Set'
    }
  }

  return (
    <>
      {error && (
        <div className={`error-message ${error.startsWith('success') ? 'success' : ''}`}>
          {error.replace('success|', '')}
          <button onClick={() => setError('')} className="close-error">×</button>
        </div>
      )}

      <div className="jobs-management-card">
        {/* Card Header */}
        <div className="card-header-jobs">
          <div className="header-content">
            <div className="header-text">
              <h3>Jobs & Hiring</h3>
              <p>Manage employment positions and hiring</p>
            </div>
          </div>
          <span
            className="status-badge-header"
            style={{ backgroundColor: getHiringStatusColor() }}
          >
            {getHiringStatusText()}
          </span>
        </div>

        {/* Manage Button */}
        <div className="manage-button-row">
          <button
            onClick={() => setShowModal(true)}
            className="btn-manage-jobs"
            title="Manage jobs and hiring"
          >
            Manage
          </button>
        </div>

        {/* Stats Section */}
        {!loading ? (
          <div className="jobs-stats-section">
            <div className="stat-item">
              <span className="stat-number">{jobsCount}</span>
              <span className="stat-label">Active Positions</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{pendingOffers}</span>
              <span className="stat-label">Pending Requests</span>
            </div>
          </div>
        ) : (
          <div className="loading-state">Loading...</div>
        )}

        {/* Quick Info */}
        <div className="quick-info-section">
          {business?.metadata?.avg_salary && (
            <div className="info-item">
              <span className="label">Avg. Salary Range:</span>
              <span className="value">₱{business.metadata.avg_salary}</span>
            </div>
          )}
          {business?.metadata?.experience_level && (
            <div className="info-item">
              <span className="label">Experience Level:</span>
              <span className="value">{business.metadata.experience_level}</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="card-action">
          <button
            onClick={() => setShowJobSeekerModal(true)}
            className="btn-open-modal"
          >
            Send Request
          </button>
        </div>

      </div>

      {/* Jobs Management Modal - Portaled to document body to prevent overflow clipping */}
      {showModal && createPortal(
        <JobsManagementModal
          business={business}
          userId={userId}
          onClose={handleModalClose}
          onUpdated={handleModalUpdated}
        />,
        document.body
      )}

      {/* Job Seeker Request Modal - Portaled to document body to prevent overflow clipping */}
      {showJobSeekerModal && createPortal(
        <JobSeekerRequestModal
          business={business}
          userId={userId}
          onClose={() => setShowJobSeekerModal(false)}
        />,
        document.body
      )}
    </>
  )
}
