import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { businessRequestService } from '../lib/businessRequestService'
import BusinessRequestModal from './BusinessRequestModal'
import BusinessEditModal from './BusinessEditModal'
import JobsManagementCard from './JobsManagementCard'
import JobsJobSeekerDisplay from './JobsJobSeekerDisplay'
import './BusinessDirectory.css'

export default function BusinessDirectory({ userId }) {
  const [businesses, setBusinesses] = useState([])
  const [userBusinessIds, setUserBusinessIds] = useState([])
  const [businessStats, setBusinessStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [expandedCard, setExpandedCard] = useState(null)
  const ITEMS_PER_PAGE = 12

  // Load user's businesses
  useEffect(() => {
    if (userId) {
      loadUserBusinesses()
    }
  }, [userId])

  // Load all businesses and stats
  useEffect(() => {
    loadBusinesses()
  }, [currentPage, filterType])

  const loadUserBusinesses = async () => {
    try {
      const { data, error: err } = await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', userId)

      if (!err && data) {
        setUserBusinessIds(data.map(b => b.id))
      }
    } catch (err) {
      console.error('Error loading user businesses:', err?.message)
    }
  }

  const loadBusinesses = async () => {
    try {
      setLoading(true)
      setError('')

      // Build query
      let query = supabase
        .from('businesses')
        .select('*', { count: 'exact' })
        .eq('status', 'active')

      // Apply filter
      if (filterType === 'featured') {
        query = query.eq('metadata->featured', true)
      } else if (filterType === 'mine' && userId) {
        query = query.eq('user_id', userId)
      }

      // Apply search
      if (searchTerm) {
        query = query.or(
          `business_name.ilike.%${searchTerm}%,city_of_registration.ilike.%${searchTerm}%,currency_registration_number.ilike.%${searchTerm}%`
        )
      }

      // Pagination and sorting
      const { data, count, error: err } = await query
        .order('metadata->featured', { ascending: false })
        .order('created_at', { ascending: false })
        .range(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE - 1)

      if (err) throw err

      setBusinesses(data || [])

      // Load stats for each business
      if (data && data.length > 0) {
        await loadBusinessStats(data)
      }
    } catch (err) {
      console.error('Error loading businesses:', err?.message)
      setError('Failed to load businesses')
    } finally {
      setLoading(false)
    }
  }

  const loadBusinessStats = async (businessList) => {
    try {
      const stats = {}

      for (const business of businessList) {
        try {
          // Get pending requests count
          const { count: requestCount } = await supabase
            .from('business_requests')
            .select('*', { count: 'exact' })
            .eq('business_id', business.id)
            .eq('status', 'pending')

          // Get active jobs count
          const { count: jobCount } = await supabase
            .from('jobs')
            .select('*', { count: 'exact' })
            .eq('business_id', business.id)
            .eq('status', 'active')

          // Get active employees count - try employee_assignments if it exists
          let employeeCount = 0
          try {
            const { count } = await supabase
              .from('employee_assignments')
              .select('*', { count: 'exact' })
              .eq('business_id', business.id)
              .eq('status', 'active')
            employeeCount = count || 0
          } catch (err) {
            // employee_assignments table may not exist yet, continue without it
            console.warn(`Could not load employee_assignments for business ${business.id}:`, err?.message)
          }

          // Get total applicants count (all non-withdrawn requests)
          const { count: totalApplicants } = await supabase
            .from('business_requests')
            .select('*', { count: 'exact' })
            .eq('business_id', business.id)
            .neq('status', 'withdrawn')

          // Get accepted applicants
          const { count: acceptedCount } = await supabase
            .from('business_requests')
            .select('*', { count: 'exact' })
            .eq('business_id', business.id)
            .eq('status', 'accepted')

          stats[business.id] = {
            pendingRequests: requestCount || 0,
            activeJobs: jobCount || 0,
            activeEmployees: employeeCount || 0,
            totalApplicants: totalApplicants || 0,
            acceptedApplicants: acceptedCount || 0
          }
        } catch (err) {
          console.error(`Error loading stats for business ${business.id}:`, err?.message)
          stats[business.id] = {
            pendingRequests: 0,
            activeJobs: 0,
            activeEmployees: 0,
            totalApplicants: 0,
            acceptedApplicants: 0
          }
        }
      }

      setBusinessStats(stats)
    } catch (err) {
      console.error('Error loading business stats:', err?.message)
    }
  }

  const handleRequestJob = (business) => {
    if (!userId) {
      setError('Please log in to request a job')
      return
    }
    setSelectedBusiness(business)
    setShowRequestModal(true)
  }

  const handleEditBusiness = (business) => {
    setSelectedBusiness(business)
    setShowEditModal(true)
  }

  const handleBusinessUpdated = (updatedBusiness) => {
    setShowEditModal(false)
    setSelectedBusiness(null)
    setError('success|Business updated successfully!')
    setTimeout(() => setError(''), 3000)
    loadBusinesses()
  }

  const handleRequestSubmitted = () => {
    setShowRequestModal(false)
    setSelectedBusiness(null)
    setError('success|Your request has been submitted successfully!')
    setTimeout(() => setError(''), 3000)
    loadBusinesses()
  }

  const handleToggleVisibility = async (business) => {
    try {
      const currentVisibility = business.metadata?.visible !== false
      const { error: err } = await supabase
        .from('businesses')
        .update({
          metadata: {
            ...business.metadata,
            visible: !currentVisibility
          }
        })
        .eq('id', business.id)

      if (err) throw err
      loadBusinesses()
      setError(`success|Business visibility ${!currentVisibility ? 'enabled' : 'disabled'}`)
      setTimeout(() => setError(''), 3000)
    } catch (err) {
      console.error('Error updating visibility:', err?.message)
      setError('Failed to update visibility')
    }
  }

  const filteredBusinesses = businesses.filter(business => {
    if (!business.metadata?.visible && !userBusinessIds.includes(business.id)) {
      return false
    }
    return true
  })

  const isOwner = (businessId) => userBusinessIds.includes(businessId)
  const isVerified = (business) => business.metadata?.verified || false

  return (
    <div className="business-directory">
      {error && (
        <div className={`error-message ${error.startsWith('success') ? 'success' : ''}`}>
          {error.replace('success|', '')}
          <button onClick={() => setError('')} className="close-error">×</button>
        </div>
      )}

      {/* Header Section */}
      <div className="directory-header">
        <div className="header-content">
          <h2>Business Directory</h2>
          <p>Discover businesses, explore opportunities, and grow your network</p>
        </div>
        
        {/* Filter and Search */}
        <div className="filter-controls">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search by name, location, or registration..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(0)
              }}
              className="search-input"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value)
              setCurrentPage(0)
            }}
            className="filter-select"
          >
            <option value="all">All Businesses</option>
            <option value="featured">Featured</option>
            {userId && <option value="mine">My Businesses</option>}
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading businesses...</p>
        </div>
      ) : filteredBusinesses.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">No Businesses Found</p>
          <p className="empty-description">
            {searchTerm 
              ? 'Try adjusting your search criteria'
              : 'No active businesses available'}
          </p>
        </div>
      ) : (
        <div className="businesses-grid">
          {filteredBusinesses.map((business) => {
            const owner = isOwner(business.id)
            const verified = isVerified(business)
            const stats = businessStats[business.id] || {
              pendingRequests: 0,
              activeJobs: 0,
              activeEmployees: 0,
              totalApplicants: 0,
              acceptedApplicants: 0
            }
            const isExpanded = expandedCard === business.id

            return (
              <div
                key={business.id}
                className={`business-card ${owner ? 'owner-card' : ''}`}
              >
                {/* Card Header */}
                <div className="card-header">
                  <div className="business-title-section">
                    <h3 className="business-name">{business.business_name}</h3>
                    <div className="badges">
                      {owner && <span className="badge owner-badge">Your Business</span>}
                      {verified && <span className="badge verified-badge">✓ Verified</span>}
                      {business.metadata?.featured && <span className="badge featured-badge">★ Featured</span>}
                    </div>
                  </div>
                  <button
                    className="btn-expand"
                    onClick={() => setExpandedCard(isExpanded ? null : business.id)}
                    title={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isExpanded ? '▼' : '▶'}
                  </button>
                </div>

                {/* Quick Info */}
                <div className="card-quick-info">
                  <div className="info-item">
                    <span className="label">Location:</span>
                    <span className="value">{business.city_of_registration || 'N/A'}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">CRN:</span>
                    <span className="value">{business.currency_registration_number || 'N/A'}</span>
                  </div>
                </div>

                {/* Stats Bar */}
                <div className="stats-bar">
                  <div className="stat">
                    <span className="stat-value">{stats.pendingRequests}</span>
                    <span className="stat-label">Requests</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{stats.activeJobs}</span>
                    <span className="stat-label">Active Jobs</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{stats.activeEmployees}</span>
                    <span className="stat-label">Employees</span>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="card-expanded">
                    {/* Business Details */}
                    <div className="detail-section">
                      <h4>Business Information</h4>
                      {business.registration_type && (
                        <div className="detail-row">
                          <span className="label">Type:</span>
                          <span className="value">{business.registration_type}</span>
                        </div>
                      )}
                      {business.tin && (
                        <div className="detail-row">
                          <span className="label">TIN:</span>
                          <span className="value">{business.tin}</span>
                        </div>
                      )}
                      {business.metadata?.address && (
                        <div className="detail-row">
                          <span className="label">Address:</span>
                          <span className="value">{business.metadata.address}</span>
                        </div>
                      )}
                      <div className="detail-row">
                        <span className="label">Registered:</span>
                        <span className="value">
                          {new Date(business.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Community Engagement Stats */}
                    <div className="detail-section">
                      <h4>Community Activity</h4>
                      <div className="detail-row">
                        <span className="label">Total Applicants:</span>
                        <span className="value">{stats.totalApplicants}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Accepted:</span>
                        <span className="value">{stats.acceptedApplicants}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Active Positions:</span>
                        <span className="value">{stats.activeJobs}</span>
                      </div>
                    </div>

                    {/* Jobs Section - Different for owners vs job seekers */}
                    {owner ? (
                      <JobsManagementCard
                        business={business}
                        userId={userId}
                        onUpdate={loadBusinesses}
                      />
                    ) : (
                      <JobsJobSeekerDisplay
                        business={business}
                        userId={userId}
                      />
                    )}

                    {/* Owner Tools */}
                    {owner && (
                      <div className="detail-section owner-section">
                        <h4>Business Management</h4>
                        <div className="owner-info">
                          <p className="info-text">You own this business</p>
                          <div className="visibility-status">
                            <span className="status-label">Visibility:</span>
                            <span className={`status ${business.metadata?.visible !== false ? 'public' : 'hidden'}`}>
                              {business.metadata?.visible !== false ? '👁️ Public' : '🚫 Hidden'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="card-actions">
                      {!owner && (
                        <button
                          onClick={() => handleRequestJob(business)}
                          className="btn-request"
                        >
                          Request Job / Apply
                        </button>
                      )}
                      {owner && (
                        <>
                          <button
                            onClick={() => handleEditBusiness(business)}
                            className="btn-edit-business"
                          >
                            ✏️ Edit Business
                          </button>
                          <button
                            onClick={() => handleToggleVisibility(business)}
                            className={`btn-visibility ${business.metadata?.visible !== false ? 'hide' : 'show'}`}
                          >
                            {business.metadata?.visible !== false ? '🚫 Hide' : '👁️ Show'}
                          </button>
                          <button
                            className="btn-manage"
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('navigateToBusinessRequests', {
                                detail: { businessId: business.id }
                              }))
                            }}
                          >
                            Manage Requests
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && filteredBusinesses.length > 0 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="btn-page"
          >
            ← Previous
          </button>
          <span className="page-info">Page {currentPage + 1}</span>
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={filteredBusinesses.length < ITEMS_PER_PAGE}
            className="btn-page"
          >
            Next →
          </button>
        </div>
      )}

      {/* Request Modal */}
      {showRequestModal && selectedBusiness && (
        <BusinessRequestModal
          business={selectedBusiness}
          userId={userId}
          onClose={() => {
            setShowRequestModal(false)
            setSelectedBusiness(null)
          }}
          onSubmitted={handleRequestSubmitted}
        />
      )}

      {/* Edit Business Modal */}
      {showEditModal && selectedBusiness && (
        <BusinessEditModal
          business={selectedBusiness}
          userId={userId}
          onClose={() => {
            setShowEditModal(false)
            setSelectedBusiness(null)
          }}
          onUpdated={handleBusinessUpdated}
        />
      )}
    </div>
  )
}
