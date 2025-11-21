import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { jobsService } from '../lib/jobsService'
import JobsManagementModal from './JobsManagementModal'
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
      
      // Get active jobs count
      const { count: jobCount } = await supabase
        .from('jobs')
        .select('*', { count: 'exact' })
        .eq('business_id', business.id)
        .eq('status', 'active')
        .is('deleted_at', null)

      // Get pending job offers
      const { count: offersCount } = await supabase
        .from('job_offers')
        .select('*', { count: 'exact' })
        .eq('business_id', business.id)
        .eq('status', 'pending')

      setJobsCount(jobCount || 0)
      setPendingOffers(offersCount || 0)
      setHiringStatus(business?.metadata?.hiring_status || 'not_hiring')
    } catch (err) {
      console.error('Error loading jobs data:', err)
      setError('Failed to load jobs data')
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
        return '🟢 Actively Hiring'
      case 'limited_hiring':
        return '🟡 Limited Hiring'
      case 'not_hiring':
        return '🔴 Not Hiring'
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
            <div className="header-icon">💼</div>
            <div className="header-text">
              <h3>Jobs & Hiring</h3>
              <p>Manage employment positions and hiring</p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn-manage-jobs"
            title="Manage jobs and hiring"
          >
            ⚙️ Manage
          </button>
        </div>

        {/* Hiring Status */}
        <div className="hiring-status-section">
          <div className="status-indicator" style={{ borderColor: getHiringStatusColor() }}>
            <span 
              className="status-badge" 
              style={{ backgroundColor: getHiringStatusColor() }}
            >
              {getHiringStatusText()}
            </span>
          </div>
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
            onClick={() => setShowModal(true)}
            className="btn-open-modal"
          >
            View & Manage Jobs →
          </button>
        </div>

        {/* Access Indicator */}
        <div className="access-feature">
          <span className="feature-label">Access Feature</span>
        </div>
      </div>

      {/* Jobs Management Modal */}
      {showModal && (
        <JobsManagementModal
          business={business}
          userId={userId}
          onClose={handleModalClose}
          onUpdated={handleModalUpdated}
        />
      )}
    </>
  )
}
