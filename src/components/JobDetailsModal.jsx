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
  const { isMobile } = useDevice()
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

  const footerContent = (
    <div className="flex gap-2 w-full flex-wrap">
      {currentUserId === job.posted_by_user_id && (
        <button
          className="flex-1 min-w-[100px] px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          onClick={() => onEdit && onEdit(job)}
          title="Edit this job posting"
        >
          ✎ Edit Job
        </button>
      )}
      {currentUserId !== job.posted_by_user_id && (
        <button
          className="flex-1 min-w-[100px] px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
          onClick={() => setShowOfferForm(!showOfferForm)}
        >
          {showOfferForm ? 'Cancel' : 'Submit Offer'}
        </button>
      )}
      <button
        onClick={onClose}
        className="flex-1 min-w-[100px] px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 font-medium transition-colors"
      >
        Close
      </button>
    </div>
  )

  return (
    <ExpandableModal
      isOpen={true}
      onClose={onClose}
      title={job.job_title}
      icon="💼"
      size="lg"
      footer={footerContent}
      defaultExpanded={!isMobile}
    >
      {/* Job Header Info */}
      <div className="mb-4 pb-4 border-b border-slate-200">
        <p className="text-sm text-slate-600">{job.city}{job.province ? `, ${job.province}` : ''}</p>
        <p className="text-xs text-slate-500 mt-1">Posted {job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Recently'}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="text-center bg-slate-50 rounded-lg p-3 border border-slate-200">
          <div className="text-base sm:text-lg font-bold text-slate-900">{jobStats.category}</div>
          <div className="text-xs text-slate-600 font-medium">Category</div>
        </div>
        <div className="text-center bg-slate-50 rounded-lg p-3 border border-slate-200">
          <div className="text-base sm:text-lg font-bold text-slate-900">{jobStats.type}</div>
          <div className="text-xs text-slate-600 font-medium">Type</div>
        </div>
        <div className="text-center bg-green-50 rounded-lg p-3 border border-green-200">
          <div className="text-base sm:text-lg font-bold text-green-600">{jobStats.rate}</div>
          <div className="text-xs text-slate-600 font-medium">Rate</div>
        </div>
        <div className="text-center bg-blue-50 rounded-lg p-3 border border-blue-200">
          <div className="text-base sm:text-lg font-bold text-blue-600">{jobStats.offers}</div>
          <div className="text-xs text-slate-600 font-medium">Offers</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 border-b border-slate-200 -mx-4 sm:-mx-6">
        <div className="flex gap-1 overflow-x-auto px-4 sm:px-6">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'overview'
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'offers'
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
            onClick={() => setActiveTab('offers')}
          >
            Offers ({offers.length})
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'ratings'
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
            onClick={() => setActiveTab('ratings')}
          >
            Ratings ({ratings.length})
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'remarks'
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
            onClick={() => setActiveTab('remarks')}
          >
            Remarks
          </button>
        </div>
      </div>

      {/* Content */}
      <div>
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
    </ExpandableModal>
  )
}
