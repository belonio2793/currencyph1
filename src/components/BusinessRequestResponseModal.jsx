import { useState } from 'react'
import { businessRequestService } from '../lib/businessRequestService'
import ExpandableModal from './ExpandableModal'
import { useDevice } from '../context/DeviceContext'

export default function BusinessRequestResponseModal({ request, business, onClose, onSubmitted }) {
  const { isMobile } = useDevice()
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

  const footer = (
    <div className="flex gap-2 w-full">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
        disabled={loading}
      >
        Cancel
      </button>
      <button
        type="submit"
        form="response-form"
        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 font-medium"
        disabled={loading}
      >
        {loading ? 'Sending...' : 'Send Response'}
      </button>
    </div>
  )

  return (
    <ExpandableModal
      isOpen={true}
      onClose={onClose}
      title="Respond to Application"
      icon="💬"
      size="lg"
      footer={footer}
      defaultExpanded={!isMobile}
    >
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-600 hover:text-red-800">×</button>
        </div>
      )}

      <form id="response-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Request Summary */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">Application Summary</h3>
          <div className="bg-slate-50 p-4 rounded-lg space-y-2 border border-slate-200">
            <div>
              <span className="text-sm font-medium text-slate-600">Position:</span>
              <p className="text-slate-900 font-semibold">{request.occupation}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-slate-600">Requested Salary:</span>
              <p className="text-slate-900">
                {request.requested_salary 
                  ? `${request.salary_currency} ${parseFloat(request.requested_salary).toFixed(2)}`
                  : 'Not specified'}
              </p>
            </div>
            <div>
              <span className="text-sm font-medium text-slate-600">Skills:</span>
              <p className="text-slate-900">
                {request.skills && request.skills.length > 0
                  ? request.skills.join(', ')
                  : 'No skills listed'}
              </p>
            </div>
          </div>
        </div>

        {/* Response Type */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Response Type *</h3>
          
          <div className="space-y-3">
            <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
              <input
                type="radio"
                name="responseStatus"
                value="needs_interview"
                checked={formData.responseStatus === 'needs_interview'}
                onChange={handleInputChange}
                disabled={loading}
                className="mt-1"
              />
              <div>
                <p className="font-semibold text-slate-900">Schedule Interview</p>
                <p className="text-sm text-slate-600">Request further discussion and interviews</p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
              <input
                type="radio"
                name="responseStatus"
                value="hire_request"
                checked={formData.responseStatus === 'hire_request'}
                onChange={handleInputChange}
                disabled={loading}
                className="mt-1"
              />
              <div>
                <p className="font-semibold text-slate-900">Make Job Offer</p>
                <p className="text-sm text-slate-600">Extend a formal job offer with position and salary</p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
              <input
                type="radio"
                name="responseStatus"
                value="offer_rejected"
                checked={formData.responseStatus === 'offer_rejected'}
                onChange={handleInputChange}
                disabled={loading}
                className="mt-1"
              />
              <div>
                <p className="font-semibold text-slate-900">Decline Application</p>
                <p className="text-sm text-slate-600">Politely reject the application</p>
              </div>
            </label>
          </div>
        </div>

        {/* Conditional Fields Based on Response Type */}
        {formData.responseStatus === 'hire_request' && (
          <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-slate-900">Job Offer Details</h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Position Title *</label>
              <input
                type="text"
                name="offeredPosition"
                value={formData.offeredPosition}
                onChange={handleInputChange}
                placeholder="e.g., Senior Sales Manager"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Offered Salary (Optional)</label>
              <input
                type="number"
                name="offeredSalary"
                value={formData.offeredSalary}
                onChange={handleInputChange}
                placeholder="Enter the offered salary amount"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
                disabled={loading}
              />
            </div>
          </div>
        )}

        {/* Message */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Message to Applicant *</h3>
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
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="6"
            disabled={loading}
          />
          <p className="text-sm text-slate-500">{formData.responseMessage.length} characters</p>
        </div>
      </form>
    </ExpandableModal>
  )
}
