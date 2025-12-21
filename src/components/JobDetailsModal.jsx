import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabaseClient'
import { jobsService } from '../lib/jobsService'
import { formatFieldValue } from '../lib/formatters'
import JobRatings from './JobRatings'
import JobRemarks from './JobRemarks'
import JobOfferForm from './JobOfferForm'
import ExpandableModal from './ExpandableModal'
import { useDevice } from '../context/DeviceContext'
import './JobDetailsModal.css'

export default function JobDetailsModal({
  job,
  onClose,
  onApply,
  onEdit,
  currentUserId,
  businessId
}) {
  const [activeTab, setActiveTab] = useState('overview')
  const [offers, setOffers] = useState([])
  const [remarks, setRemarks] = useState([])
  const [ratings, setRatings] = useState([])
  const [showOfferForm, setShowOfferForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [averageRating, setAverageRating] = useState(0)
  const [postedByUser, setPostedByUser] = useState(null)

  useEffect(() => {
    loadJobDetails()
  }, [job.id])

  const loadJobDetails = async () => {
    setLoading(true)
    try {
      const [offersData, remarksData, ratingsData, userData] = await Promise.all([
        jobsService.getJobOffers(job.id),
        jobsService.getJobRemarks(job.id),
        jobsService.getJobRatings(job.id),
        supabase.from('profiles').select('*').eq('user_id', job.posted_by_user_id).single()
      ])

      setOffers(offersData)
      setRemarks(remarksData)
      setRatings(ratingsData)
      if (userData.data) setPostedByUser(userData.data)

      if (ratingsData.length > 0) {
        const avg = ratingsData.reduce((sum, r) => sum + r.rating_score, 0) / ratingsData.length
        setAverageRating(avg.toFixed(1))
      }
    } catch (err) {
      console.error('Error loading job details:', err)
      setError('Failed to load job details')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitOffer = async (offerData) => {
    try {
      await onApply(job.id, offerData)
      setShowOfferForm(false)
      loadJobDetails()
    } catch (err) {
      console.error('Error submitting offer:', err)
      setError('Failed to submit offer')
    }
  }

  const handleAddRemark = async (remarkText, isPublic) => {
    try {
      await jobsService.createJobRemark({
        job_id: job.id,
        created_by_user_id: currentUserId,
        remark_text: remarkText,
        is_public: isPublic,
        remark_type: 'note'
      })
      loadJobDetails()
    } catch (err) {
      console.error('Error adding remark:', err)
      setError('Failed to add remark')
    }
  }

  const skillsList = job.skills_required ? JSON.parse(job.skills_required) : []
  const jobStats = {
    category: formatFieldValue(job.job_category) || 'N/A',
    type: formatFieldValue(job.job_type) || 'N/A',
    rate: `₱${job.pay_rate?.toFixed(2) || 'Negotiable'}`,
    offers: offers.length
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="job-details-modal" onClick={e => e.stopPropagation()}>
        {/* Header Section */}
        <div className="job-modal-header">
          <div className="job-header-left">
            <div className="job-avatar">
              {job.job_title.charAt(0).toUpperCase()}
            </div>
            <div className="job-header-info">
              <h2>{job.job_title}</h2>
              <p className="job-location">{job.city}{job.province ? `, ${job.province}` : ''}</p>
              <p className="job-posted-date">Posted {job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Recently'}</p>
            </div>
          </div>
          <div className="job-header-right">
            {currentUserId === job.posted_by_user_id && (
              <button
                className="btn-edit-job"
                onClick={() => onEdit && onEdit(job)}
                title="Edit this job posting"
              >
                ✎ Edit
              </button>
            )}
            {currentUserId !== job.posted_by_user_id && (
              <button
                className="btn-submit-offer-header"
                onClick={() => setShowOfferForm(!showOfferForm)}
              >
                Submit Offer
              </button>
            )}
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="job-stats-grid">
          <div className="stat-item">
            <div className="stat-value">{jobStats.category}</div>
            <div className="stat-label">Category</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{jobStats.type}</div>
            <div className="stat-label">Type</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{jobStats.rate}</div>
            <div className="stat-label">Rate</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{jobStats.offers}</div>
            <div className="stat-label">Offers</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="job-modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`tab-btn ${activeTab === 'offers' ? 'active' : ''}`}
            onClick={() => setActiveTab('offers')}
          >
            Offers ({offers.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'ratings' ? 'active' : ''}`}
            onClick={() => setActiveTab('ratings')}
          >
            Ratings ({ratings.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'remarks' ? 'active' : ''}`}
            onClick={() => setActiveTab('remarks')}
          >
            Remarks
          </button>
        </div>

        {/* Content */}
        <div className="job-modal-content">
          {error && (
            <div className="error-message">
              {error}
              <button onClick={() => setError('')} className="close-error">×</button>
            </div>
          )}

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="overview-section">
              <h3>Job Details</h3>
              <div className="details-rows">
                <div className="detail-row">
                  <span className="detail-label">Experience Level:</span>
                  <span className="detail-value">{formatFieldValue(job.experience_level) || 'Not specified'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Pay Type:</span>
                  <span className="detail-value">{formatFieldValue(job.pay_type)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Positions Available:</span>
                  <span className="detail-value">{job.positions_available - job.positions_filled}</span>
                </div>
              </div>

              <h3>Description</h3>
              <p className="description-text">{job.job_description}</p>

              {skillsList.length > 0 && (
                <>
                  <h3>Required Skills</h3>
                  <div className="skills-list">
                    {skillsList.map((skill, idx) => (
                      <span key={idx} className="skill-tag">{skill}</span>
                    ))}
                  </div>
                </>
              )}

              <h3>Timeline</h3>
              <div className="details-rows">
                <div className="detail-row">
                  <span className="detail-label">Start Date:</span>
                  <span className="detail-value">
                    {job.start_date ? new Date(job.start_date).toLocaleDateString() : 'Not specified'}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">End Date:</span>
                  <span className="detail-value">
                    {job.end_date ? new Date(job.end_date).toLocaleDateString() : 'Not specified'}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Application Deadline:</span>
                  <span className="detail-value">
                    {job.deadline_for_applications
                      ? new Date(job.deadline_for_applications).toLocaleDateString()
                      : 'No deadline'}
                  </span>
                </div>
              </div>

              {showOfferForm && (
                <JobOfferForm
                  jobId={job.id}
                  jobRate={job.pay_rate}
                  onSubmit={handleSubmitOffer}
                  onCancel={() => setShowOfferForm(false)}
                />
              )}
            </div>
          )}

          {/* Offers Tab */}
          {activeTab === 'offers' && (
            <div className="offers-section">
              {loading ? (
                <p className="loading-text">Loading offers...</p>
              ) : offers.length === 0 ? (
                <p className="empty-state-text">No offers yet. Be the first to apply!</p>
              ) : (
                <div className="offers-list">
                  {offers.map(offer => (
                    <div key={offer.id} className="offer-item">
                      <div className="offer-header">
                        <h4>{offer.provider_name}</h4>
                        <span className={`offer-status ${offer.status}`}>{offer.status}</span>
                      </div>
                      <div className="offer-body">
                        <p><strong>Offered Rate:</strong> ₱{offer.offered_rate?.toFixed(2)}</p>
                        <p><strong>Email:</strong> {offer.provider_email}</p>
                        {offer.provider_phone && <p><strong>Phone:</strong> {offer.provider_phone}</p>}
                        {offer.offer_message && <p><strong>Message:</strong> {offer.offer_message}</p>}
                      </div>
                      <div className="offer-footer">
                        <span className="offer-date">{new Date(offer.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Ratings Tab */}
          {activeTab === 'ratings' && (
            <JobRatings ratings={ratings} averageRating={averageRating} />
          )}

          {/* Remarks Tab */}
          {activeTab === 'remarks' && (
            <JobRemarks
              remarks={remarks}
              onAddRemark={handleAddRemark}
              currentUserId={currentUserId}
              jobOwnerId={job.posted_by_user_id}
            />
          )}
        </div>
      </div>
    </div>
  )
}
