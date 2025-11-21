import { useState, useEffect } from 'react'
import { businessRequestService } from '../lib/businessRequestService'
import BusinessRequestModal from './BusinessRequestModal'
import './BusinessCatalog.css'

export default function BusinessCatalog({ userId }) {
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const ITEMS_PER_PAGE = 12

  useEffect(() => {
    loadBusinesses()
  }, [])

  const loadBusinesses = async () => {
    try {
      setLoading(true)
      setError('')
      const offset = currentPage * ITEMS_PER_PAGE
      const result = await businessRequestService.getAllBusinesses(ITEMS_PER_PAGE, offset)

      if (result.error) {
        console.error('Error loading businesses:', result.error)
        setError('Failed to load businesses')
      } else {
        setBusinesses(result.data || [])
      }
    } catch (err) {
      console.error('Error in loadBusinesses:', err)
      setError('An error occurred while loading businesses')
    } finally {
      setLoading(false)
    }
  }

  const filteredBusinesses = businesses.filter(business =>
    business.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    business.city_of_registration?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    business.currency_registration_number?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleRequestJob = (business) => {
    setSelectedBusiness(business)
    setShowRequestModal(true)
  }

  const handleRequestSubmitted = () => {
    setShowRequestModal(false)
    setSelectedBusiness(null)
    setError('')
    // Show success message
    setTimeout(() => {
      setError('success|Your request has been submitted successfully!')
      setTimeout(() => setError(''), 3000)
    }, 100)
  }

  return (
    <div className="business-catalog">
      {error && (
        <div className={`error-message ${error.startsWith('success') ? 'success' : ''}`}>
          {error.replace('success|', '')}
          <button onClick={() => setError('')} className="close-error">×</button>
        </div>
      )}

      {/* Search Bar */}
      <div className="search-section">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search by business name, location, or registration number..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(0)
            }}
            className="search-input"
          />
        </div>
      </div>

      {/* Results Count */}
      <div className="results-info">
        <p className="text-slate-600">
          {filteredBusinesses.length === 0 ? 'No businesses found' : `Showing ${filteredBusinesses.length} business${filteredBusinesses.length !== 1 ? 'es' : ''}`}
        </p>
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
            {searchTerm ? 'Try adjusting your search criteria' : 'No active businesses registered yet'}
          </p>
        </div>
      ) : (
        <div className="businesses-grid">
          {filteredBusinesses.map((business) => (
            <div key={business.id} className="business-card">
              <div className="card-header">
                <div className="business-info">
                  <h3 className="business-name">{business.business_name}</h3>
                  <div className="business-meta">
                    {business.currency_registration_number && (
                      <span className="meta-badge registration">
                        CRN: {business.currency_registration_number}
                      </span>
                    )}
                    {business.registration_type && (
                      <span className="meta-badge type">
                        {business.registration_type.charAt(0).toUpperCase() + business.registration_type.slice(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="card-body">
                {business.city_of_registration && (
                  <div className="info-row">
                    <span className="label">Location:</span>
                    <span className="value">{business.city_of_registration}</span>
                  </div>
                )}

                {business.tin && (
                  <div className="info-row">
                    <span className="label">TIN:</span>
                    <span className="value">{business.tin}</span>
                  </div>
                )}

                <div className="info-row">
                  <span className="label">Registered:</span>
                  <span className="value">
                    {new Date(business.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>

                {business.metadata?.address && (
                  <div className="info-row">
                    <span className="label">Address:</span>
                    <span className="value">{business.metadata.address}</span>
                  </div>
                )}
              </div>

              <div className="card-footer">
                <button
                  onClick={() => handleRequestJob(business)}
                  className="btn-request-job"
                >
                  Request Job / Apply
                </button>
              </div>
            </div>
          ))}
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
    </div>
  )
}
