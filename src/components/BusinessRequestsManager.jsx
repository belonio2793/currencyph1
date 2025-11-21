import { useState, useEffect } from 'react'
import { businessRequestService } from '../lib/businessRequestService'
import { supabase } from '../lib/supabaseClient'
import BusinessRequestResponseModal from './BusinessRequestResponseModal'
import './BusinessRequestsManager.css'

export default function BusinessRequestsManager({ userId, selectedBusiness }) {
  const [requests, setRequests] = useState([])
  const [responses, setResponses] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [showResponseModal, setShowResponseModal] = useState(false)
  const [expandedRequestId, setExpandedRequestId] = useState(null)

  useEffect(() => {
    if (selectedBusiness?.id) {
      loadRequests()
    }
  }, [selectedBusiness, statusFilter])

  const loadRequests = async () => {
    try {
      setLoading(true)
      setError('')
      
      const status = statusFilter === 'all' ? null : statusFilter
      const result = await businessRequestService.getBusinessRequests(selectedBusiness.id, status)
      
      if (result.error) {
        console.error('Error loading requests:', result.error)
        setError('Failed to load requests')
        setRequests([])
      } else {
        setRequests(result.data || [])
        
        // Load responses for each request
        const responsesMap = {}
        for (const request of result.data || []) {
          const respResult = await businessRequestService.getResponsesForRequest(request.id)
          if (!respResult.error) {
            responsesMap[request.id] = respResult.data || []
          }
        }
        setResponses(responsesMap)
      }
    } catch (err) {
      console.error('Error in loadRequests:', err)
      setError('An error occurred while loading requests')
    } finally {
      setLoading(false)
    }
  }

  const handleResponseSubmitted = async () => {
    setShowResponseModal(false)
    setSelectedRequest(null)
    await loadRequests()
    setError('success|Your response has been sent successfully!')
    setTimeout(() => setError(''), 3000)
  }

  const handleStatusUpdate = async (requestId, newStatus) => {
    try {
      setLoading(true)
      const result = await businessRequestService.updateRequestStatus(requestId, newStatus)
      
      if (result.error) {
        setError('Failed to update request status')
      } else {
        setError('success|Request status updated successfully!')
        await loadRequests()
        setTimeout(() => setError(''), 3000)
      }
    } catch (err) {
      console.error('Error updating status:', err)
      setError('Failed to update request status')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#fbbf24'
      case 'reviewed':
        return '#3b82f6'
      case 'accepted':
        return '#10b981'
      case 'rejected':
        return '#ef4444'
      case 'withdrawn':
        return '#9ca3af'
      default:
        return '#6b7280'
    }
  }

  if (!selectedBusiness) {
    return (
      <div className="empty-state">
        <p className="empty-title">No Business Selected</p>
        <p className="empty-description">Please select a business to view requests</p>
      </div>
    )
  }

  return (
    <div className="business-requests-manager">
      {error && (
        <div className={`error-message ${error.startsWith('success') ? 'success' : ''}`}>
          {error.replace('success|', '')}
          <button onClick={() => setError('')} className="close-error">×</button>
        </div>
      )}

      <div className="manager-header">
        <div className="header-info">
          <h2>Business Requests</h2>
          <p className="text-slate-500">{selectedBusiness.business_name}</p>
        </div>
        
        <div className="filter-section">
          <label>Filter by Status:</label>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-filter"
          >
            <option value="all">All Requests</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="requests-stats">
        <div className="stat-card">
          <span className="stat-label">Total Requests</span>
          <span className="stat-value">{requests.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Pending</span>
          <span className="stat-value">{requests.filter(r => r.status === 'pending').length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Reviewed</span>
          <span className="stat-value">{requests.filter(r => r.status === 'reviewed').length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Accepted</span>
          <span className="stat-value">{requests.filter(r => r.status === 'accepted').length}</span>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">No Requests Found</p>
          <p className="empty-description">
            {statusFilter === 'all' 
              ? 'You haven\'t received any business requests yet' 
              : `No ${statusFilter} requests found`}
          </p>
        </div>
      ) : (
        <div className="requests-list">
          {requests.map((request) => (
            <div key={request.id} className="request-card">
              <div className="request-header">
                <div className="request-title-section">
                  <h3>{request.occupation}</h3>
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(request.status) }}
                  >
                    {request.status}
                  </span>
                </div>
                <button
                  className="btn-expand"
                  onClick={() => setExpandedRequestId(expandedRequestId === request.id ? null : request.id)}
                >
                  {expandedRequestId === request.id ? '▼' : '▶'}
                </button>
              </div>

              <div className="request-summary">
                <div className="summary-item">
                  <span className="label">Requested Salary:</span>
                  <span className="value">
                    {request.requested_salary 
                      ? `${request.salary_currency} ${parseFloat(request.requested_salary).toFixed(2)}`
                      : 'Not specified'}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="label">Skills:</span>
                  <span className="value">
                    {request.skills && request.skills.length > 0
                      ? request.skills.slice(0, 3).join(', ')
                      : 'No skills listed'}
                    {request.skills && request.skills.length > 3 && ` +${request.skills.length - 3}`}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="label">Applied:</span>
                  <span className="value">{formatDate(request.created_at)}</span>
                </div>
              </div>

              {expandedRequestId === request.id && (
                <div className="request-details">
                  <div className="detail-section">
                    <h4>Professional Information</h4>
                    
                    {request.skills && request.skills.length > 0 && (
                      <div className="detail-item">
                        <span className="label">Skills:</span>
                        <div className="skills-display">
                          {request.skills.map(skill => (
                            <span key={skill} className="skill-badge">{skill}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {request.resume_text && (
                      <div className="detail-item">
                        <span className="label">Resume/Bio:</span>
                        <div className="resume-text">{request.resume_text}</div>
                      </div>
                    )}

                    {request.availability_date && (
                      <div className="detail-item">
                        <span className="label">Available Date:</span>
                        <span className="value">{formatDate(request.availability_date)}</span>
                      </div>
                    )}
                  </div>

                  {request.message && (
                    <div className="detail-section">
                      <h4>Message from Applicant</h4>
                      <p className="message-text">{request.message}</p>
                    </div>
                  )}

                  {/* Responses Section */}
                  {responses[request.id] && responses[request.id].length > 0 && (
                    <div className="detail-section">
                      <h4>Responses ({responses[request.id].length})</h4>
                      {responses[request.id].map(response => (
                        <div key={response.id} className="response-item">
                          <div className="response-header">
                            <span className={`response-status ${response.response_status}`}>
                              {response.response_status.replace(/_/g, ' ')}
                            </span>
                            <span className="response-date">{formatDate(response.created_at)}</span>
                          </div>
                          {response.response_message && (
                            <p className="response-message">{response.response_message}</p>
                          )}
                          {response.offered_position && (
                            <div className="response-offer">
                              <span className="label">Position:</span>
                              <span className="value">{response.offered_position}</span>
                            </div>
                          )}
                          {response.offered_salary && (
                            <div className="response-offer">
                              <span className="label">Offered Salary:</span>
                              <span className="value">₱{parseFloat(response.offered_salary).toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="request-actions">
                    {request.status === 'pending' && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedRequest(request)
                            setShowResponseModal(true)
                          }}
                          className="btn-respond"
                        >
                          Send Response
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(request.id, 'reviewed')}
                          className="btn-reviewed"
                          disabled={loading}
                        >
                          Mark as Reviewed
                        </button>
                      </>
                    )}
                    
                    {request.status === 'reviewed' && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedRequest(request)
                            setShowResponseModal(true)
                          }}
                          className="btn-respond"
                        >
                          Send Response
                        </button>
                      </>
                    )}

                    {(request.status === 'pending' || request.status === 'reviewed') && (
                      <button
                        onClick={() => handleStatusUpdate(request.id, 'rejected')}
                        className="btn-reject"
                        disabled={loading}
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Response Modal */}
      {showResponseModal && selectedRequest && (
        <BusinessRequestResponseModal
          request={selectedRequest}
          business={selectedBusiness}
          onClose={() => {
            setShowResponseModal(false)
            setSelectedRequest(null)
          }}
          onSubmitted={handleResponseSubmitted}
        />
      )}
    </div>
  )
}
