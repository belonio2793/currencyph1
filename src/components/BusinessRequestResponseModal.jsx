import { useState } from 'react'
import { businessRequestService } from '../lib/businessRequestService'
import './BusinessRequestResponseModal.css'

export default function BusinessRequestResponseModal({ request, business, onClose, onSubmitted }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    responseStatus: 'needs_interview',
    responseMessage: '',
    offeredPosition: '',
    offeredSalary: ''
  })

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const validateForm = () => {
    if (!formData.responseStatus) {
      setError('Please select a response status')
      return false
    }
    if (!formData.responseMessage.trim()) {
      setError('Message is required')
      return false
    }
    if (formData.responseStatus === 'hire_request' && !formData.offeredPosition.trim()) {
      setError('Position is required for job offers')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) return

    try {
      setLoading(true)
      setError('')

      const result = await businessRequestService.submitResponse(request.id, business.id, {
        responseStatus: formData.responseStatus,
        responseMessage: formData.responseMessage,
        offeredPosition: formData.offeredPosition || null,
        offeredSalary: formData.offeredSalary ? parseFloat(formData.offeredSalary) : null
      })

      if (result.error) {
        setError(result.error.message || 'Failed to send response')
      } else {
        onSubmitted()
      }
    } catch (err) {
      console.error('Error submitting response:', err)
      setError(err.message || 'An error occurred while sending your response')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content business-response-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Respond to Application</h2>
            <p className="text-slate-500">Send your response to {request.occupation} applicant</p>
          </div>
          <button onClick={onClose} className="modal-close">×</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-message">
              {error}
              <button onClick={() => setError('')} className="close-error">×</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="response-form">
            {/* Request Summary */}
            <div className="form-section">
              <h3 className="section-title">Application Summary</h3>
              <div className="info-box">
                <div className="info-item">
                  <span className="label">Position:</span>
                  <span className="value">{request.occupation}</span>
                </div>
                <div className="info-item">
                  <span className="label">Requested Salary:</span>
                  <span className="value">
                    {request.requested_salary 
                      ? `${request.salary_currency} ${parseFloat(request.requested_salary).toFixed(2)}`
                      : 'Not specified'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="label">Skills:</span>
                  <span className="value">
                    {request.skills && request.skills.length > 0
                      ? request.skills.join(', ')
                      : 'No skills listed'}
                  </span>
                </div>
              </div>
            </div>

            {/* Response Type */}
            <div className="form-section">
              <h3 className="section-title">Response Type *</h3>
              
              <div className="response-type-options">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="responseStatus"
                    value="needs_interview"
                    checked={formData.responseStatus === 'needs_interview'}
                    onChange={handleInputChange}
                    disabled={loading}
                  />
                  <span className="option-label">
                    <span className="option-title">Schedule Interview</span>
                    <span className="option-desc">Request further discussion and interviews</span>
                  </span>
                </label>

                <label className="radio-option">
                  <input
                    type="radio"
                    name="responseStatus"
                    value="hire_request"
                    checked={formData.responseStatus === 'hire_request'}
                    onChange={handleInputChange}
                    disabled={loading}
                  />
                  <span className="option-label">
                    <span className="option-title">Make Job Offer</span>
                    <span className="option-desc">Extend a formal job offer with position and salary</span>
                  </span>
                </label>

                <label className="radio-option">
                  <input
                    type="radio"
                    name="responseStatus"
                    value="offer_rejected"
                    checked={formData.responseStatus === 'offer_rejected'}
                    onChange={handleInputChange}
                    disabled={loading}
                  />
                  <span className="option-label">
                    <span className="option-title">Decline Application</span>
                    <span className="option-desc">Politely reject the application</span>
                  </span>
                </label>
              </div>
            </div>

            {/* Conditional Fields Based on Response Type */}
            {formData.responseStatus === 'hire_request' && (
              <div className="form-section conditional-section">
                <h3 className="section-title">Job Offer Details</h3>
                
                <div className="form-group">
                  <label className="form-label">Position Title *</label>
                  <input
                    type="text"
                    name="offeredPosition"
                    value={formData.offeredPosition}
                    onChange={handleInputChange}
                    placeholder="e.g., Senior Sales Manager"
                    className="form-input"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Offered Salary (Optional)</label>
                  <input
                    type="number"
                    name="offeredSalary"
                    value={formData.offeredSalary}
                    onChange={handleInputChange}
                    placeholder="Enter the offered salary amount"
                    className="form-input"
                    min="0"
                    step="0.01"
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {/* Message */}
            <div className="form-section">
              <h3 className="section-title">Message to Applicant *</h3>
              <textarea
                name="responseMessage"
                value={formData.responseMessage}
                onChange={handleInputChange}
                placeholder={
                  formData.responseStatus === 'hire_request'
                    ? 'Write your job offer message with details and expectations...'
                    : formData.responseStatus === 'needs_interview'
                    ? 'Introduce yourself and explain why you\'d like to interview them...'
                    : 'Politely explain why you\'re declining the application...'
                }
                className="form-textarea"
                rows="6"
                disabled={loading}
              />
              <p className="text-slate-500 text-sm">
                {formData.responseMessage.length} characters
              </p>
            </div>

            {/* Buttons */}
            <div className="form-actions">
              <button
                type="button"
                onClick={onClose}
                className="btn-cancel"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-submit"
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Response'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
