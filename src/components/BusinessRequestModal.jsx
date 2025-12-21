import { useState } from 'react'
import { businessRequestService } from '../lib/businessRequestService'
import ExpandableModal from './ExpandableModal'
import { useDevice } from '../context/DeviceContext'

export default function BusinessRequestModal({ business, userId, onClose, onSubmitted }) {
  const { isMobile } = useDevice()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    occupation: '',
    requestedSalary: '',
    salaryCurrency: 'PHP',
    skills: [],
    skillInput: '',
    resumeText: '',
    message: '',
    availabilityDate: ''
  })

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleAddSkill = () => {
    if (formData.skillInput.trim() && !formData.skills.includes(formData.skillInput.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, prev.skillInput.trim()],
        skillInput: ''
      }))
    }
  }

  const handleRemoveSkill = (skill) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skill)
    }))
  }

  const validateForm = () => {
    if (!formData.occupation.trim()) {
      setError('Occupation/Position is required')
      return false
    }
    if (formData.skills.length === 0) {
      setError('Please add at least one skill')
      return false
    }
    if (!formData.resumeText.trim()) {
      setError('Resume/Bio is required')
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

      const result = await businessRequestService.submitBusinessRequest(business.id, {
        occupation: formData.occupation,
        requestedSalary: formData.requestedSalary,
        salaryCurrency: formData.salaryCurrency,
        skills: formData.skills,
        resumeText: formData.resumeText,
        message: formData.message,
        availabilityDate: formData.availabilityDate
      })

      if (result.error) {
        setError(result.error.message || 'Failed to submit request')
      } else {
        onSubmitted()
      }
    } catch (err) {
      console.error('Error submitting request:', err)
      setError(err.message || 'An error occurred while submitting your request')
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
        form="business-request-form"
        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 font-medium"
        disabled={loading}
      >
        {loading ? 'Submitting...' : 'Submit Application'}
      </button>
    </div>
  )

  return (
    <ExpandableModal
      isOpen={true}
      onClose={onClose}
      title={`Apply to ${business.business_name}`}
      icon="📋"
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

      <form id="business-request-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Business Info */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">Business Information</h3>
          <div className="bg-slate-50 p-4 rounded-lg space-y-2 border border-slate-200">
            <div>
              <span className="text-sm font-medium text-slate-600">Business Name:</span>
              <p className="text-slate-900 font-semibold">{business.business_name}</p>
            </div>
            {business.currency_registration_id && (
              <div>
                <span className="text-sm font-medium text-slate-600">Registration ID:</span>
                <p className="text-slate-900">{business.currency_registration_id}</p>
              </div>
            )}
            {business.city_of_registration && (
              <div>
                <span className="text-sm font-medium text-slate-600">Location:</span>
                <p className="text-slate-900">{business.city_of_registration}</p>
              </div>
            )}
          </div>
        </div>

        {/* Position & Salary */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Position & Salary</h3>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Occupation / Position *</label>
            <input
              type="text"
              name="occupation"
              value={formData.occupation}
              onChange={handleInputChange}
              placeholder="e.g., Sales Manager, Software Developer, etc."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Requested Salary</label>
              <input
                type="number"
                name="requestedSalary"
                value={formData.requestedSalary}
                onChange={handleInputChange}
                placeholder="Enter your expected salary"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Currency</label>
              <select
                name="salaryCurrency"
                value={formData.salaryCurrency}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="PHP">PHP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Skills *</h3>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.skillInput}
                onChange={(e) => setFormData(prev => ({ ...prev, skillInput: e.target.value }))}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddSkill()
                  }
                }}
                placeholder="e.g., Project Management, Python, etc."
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <button
                type="button"
                onClick={handleAddSkill}
                className="px-4 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 font-medium disabled:opacity-50"
                disabled={loading || !formData.skillInput.trim()}
              >
                + Add
              </button>
            </div>

            {formData.skills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.skills.map((skill) => (
                  <div key={skill} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="text-blue-600 hover:text-blue-800 font-bold"
                      disabled={loading}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {formData.skills.length === 0 && (
              <p className="text-sm text-slate-500">No skills added yet. Add at least one skill.</p>
            )}
          </div>
        </div>

        {/* Resume */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Resume / Professional Bio *</h3>
          <textarea
            name="resumeText"
            value={formData.resumeText}
            onChange={handleInputChange}
            placeholder="Write a brief professional summary, work experience, education, and achievements..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="6"
            disabled={loading}
          />
          <p className="text-sm text-slate-500">{formData.resumeText.length} characters</p>
        </div>

        {/* Availability */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Availability</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Available Start Date</label>
            <input
              type="date"
              name="availabilityDate"
              value={formData.availabilityDate}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Message to Business Owner</h3>
          <textarea
            name="message"
            value={formData.message}
            onChange={handleInputChange}
            placeholder="Add any additional message or cover letter..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="4"
            disabled={loading}
          />
        </div>
      </form>
    </ExpandableModal>
  )
}
