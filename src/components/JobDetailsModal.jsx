import { useState, useEffect } from 'react'
import { jobsService } from '../lib/jobsService'
import JobRatings from './JobRatings'
import JobRemarks from './JobRemarks'
import JobOfferForm from './JobOfferForm'
import './JobDetailsModal.css'

export default function JobDetailsModal({
  job,
  onClose,
  onApply,
  currentUserId,
  businessId
}) {
  const [activeTab, setActiveTab] = useState('details') // 'details', 'offers', 'ratings', 'remarks'
  const [offers, setOffers] = useState([])
  const [remarks, setRemarks] = useState([])
  const [ratings, setRatings] = useState([])
  const [showOfferForm, setShowOfferForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [averageRating, setAverageRating] = useState(0)

  useEffect(() => {
    loadJobDetails()
  }, [job.id])

  const loadJobDetails = async () => {
    setLoading(true)
    try {
      const [offersData, remarksData, ratingsData] = await Promise.all([
        jobsService.getJobOffers(job.id),
        jobsService.getJobRemarks(job.id),
        jobsService.getJobRatings(job.id)
      ])

      setOffers(offersData)
      setRemarks(remarksData)
      setRatings(ratingsData)

      // Calculate average rating
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

  const skillsList = job.skills_required
    ? JSON.parse(job.skills_required)
    : []

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="job-details-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-content">
            <h2>{job.job_title}</h2>
            <span className={`status-badge ${job.status}`}>{job.status}</span>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError('')} className="close-error">×</button>
          </div>
        )}

        {/* Tabs */}
        <div className="modal-tabs">
          <button
            className={`tab ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            Details
          </button>
          <button
            className={`tab ${activeTab === 'offers' ? 'active' : ''}`}
            onClick={() => setActiveTab('offers')}
          >
            Offers ({offers.length})
          </button>
          <button
            className={`tab ${activeTab === 'ratings' ? 'active' : ''}`}
            onClick={() => setActiveTab('ratings')}
          >
            Ratings ({ratings.length})
          </button>
          <button
            className={`tab ${activeTab === 'remarks' ? 'active' : ''}`}
            onClick={() => setActiveTab('remarks')}
          >
            Remarks
          </button>
        </div>

        {/* Content */}
        <div className="modal-content">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="details-tab">
              <div className="detail-row">
                <div className="detail-column">
                  <h4>Job Information</h4>
                  <div className="info-item">
                    <span className="label">Category:</span>
                    <span className="value">{job.job_category}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Type:</span>
                    <span className="value">{job.job_type}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Location:</span>
                    <span className="value">{job.city}, {job.province}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Experience Level:</span>
                    <span className="value">{job.experience_level || 'Not specified'}</span>
                  </div>
                </div>

                <div className="detail-column">
                  <h4>Compensation</h4>
                  <div className="info-item">
                    <span className="label">Rate:</span>
                    <span className="value highlight">
                      ₱{job.pay_rate?.toFixed(2) || 'Negotiable'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="label">Pay Type:</span>
                    <span className="value">{job.pay_type}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Positions Available:</span>
                    <span className="value">{job.positions_available - job.positions_filled}</span>
                  </div>
                </div>
              </div>

              <div className="description-section">
                <h4>Job Description</h4>
                <p>{job.job_description}</p>
              </div>

              {skillsList.length > 0 && (
                <div className="skills-section">
                  <h4>Required Skills</h4>
                  <div className="skills-list">
                    {skillsList.map((skill, idx) => (
                      <span key={idx} className="skill-tag">{skill}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="timeline-section">
                <h4>Timeline</h4>
                <div className="timeline-item">
                  <span className="label">Start Date:</span>
                  <span className="value">
                    {job.start_date ? new Date(job.start_date).toLocaleDateString() : 'Not specified'}
                  </span>
                </div>
                <div className="timeline-item">
                  <span className="label">End Date:</span>
                  <span className="value">
                    {job.end_date ? new Date(job.end_date).toLocaleDateString() : 'Not specified'}
                  </span>
                </div>
                <div className="timeline-item">
                  <span className="label">Application Deadline:</span>
                  <span className="value">
                    {job.deadline_for_applications
                      ? new Date(job.deadline_for_applications).toLocaleDateString()
                      : 'No deadline'}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              {currentUserId !== job.posted_by_user_id && (
                <button
                  className="btn-apply-large"
                  onClick={() => setShowOfferForm(!showOfferForm)}
                >
                  {showOfferForm ? 'Cancel' : 'Submit Your Offer'}
                </button>
              )}

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
            <div className="offers-tab">
              {loading ? (
                <p>Loading offers...</p>
              ) : offers.length === 0 ? (
                <p className="empty-state">No offers yet. Be the first to apply!</p>
              ) : (
                <div className="offers-list">
                  {offers.map(offer => (
                    <div key={offer.id} className="offer-card">
                      <div className="offer-header">
                        <h4>{offer.provider_name}</h4>
                        <span className={`status ${offer.status}`}>{offer.status}</span>
                      </div>
                      <div className="offer-body">
                        <p><strong>Offered Rate:</strong> ₱{offer.offered_rate?.toFixed(2)}</p>
                        <p><strong>Email:</strong> {offer.provider_email}</p>
                        <p><strong>Phone:</strong> {offer.provider_phone}</p>
                        <p><strong>Message:</strong> {offer.offer_message}</p>
                      </div>
                      <div className="offer-footer">
                        <span className="date">{new Date(offer.created_at).toLocaleDateString()}</span>
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
