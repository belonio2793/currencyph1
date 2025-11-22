import { useState } from 'react'
import { businessRequestService } from '../lib/businessRequestService'
import './BusinessRequestModal.css'

export default function BusinessRequestModal({ business, userId, onClose, onSubmitted }) {
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content business-request-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Apply to {business.business_name}</h2>
            <p className="text-slate-500">Submit your application and resume</p>
          </div>
          <button onClick={onClose} className="modal-close">X</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-message">
              {error}
              <button onClick={() => setError('')} className="close-error">X</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="request-form">
            {/* Business Info */}
            <div className="form-section">
              <h3 className="section-title">Business Information</h3>
              <div className="info-box">
                <div className="info-item">
                  <span className="label">Business Name:</span>
                  <span className="value">{business.business_name}</span>
                </div>
                {business.currency_registration_id && (
                  <div className="info-item">
                    <span className="label">Registration ID:</span>
                    <span className="value">{business.currency_registration_id}</span>
                  </div>
                )}
                {business.city_of_registration && (
                  <div className="info-item">
                    <span className="label">Location:</span>
                    <span className="value">{business.city_of_registration}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Position & Salary */}
            <div className="form-section">
              <h3 className="section-title">Position & Salary</h3>
              
              <div className="form-group">
                <label className="form-label">Occupation / Position *</label>
                <input
                  type="text"
                  name="occupation"
                  value={formData.occupation}
                  onChange={handleInputChange}
                  placeholder="e.g., Sales Manager, Software Developer, etc."
                  className="form-input"
                  disabled={loading}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Requested Salary</label>
                  <input
                    type="number"
                    name="requestedSalary"
                    value={formData.requestedSalary}
                    onChange={handleInputChange}
                    placeholder="Enter your expected salary"
                    className="form-input"
                    min="0"
                    step="0.01"
                    disabled={loading}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <select
                    name="salaryCurrency"
                    value={formData.salaryCurrency}
                    onChange={handleInputChange}
                    className="form-input"
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
            <div className="form-section">
              <h3 className="section-title">Skills *</h3>
              <div className="skills-input-group">
                <div className="form-row">
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
                    className="form-input flex-1"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="btn-add-skill"
                    disabled={loading || !formData.skillInput.trim()}
                  >
                    + Add Skill
                  </button>
                </div>
              </div>

              {formData.skills.length > 0 && (
                <div className="skills-list">
                  {formData.skills.map((skill) => (
                    <div key={skill} className="skill-tag">
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="remove-skill"
                        disabled={loading}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {formData.skills.length === 0 && (
                <p className="text-slate-500 text-sm">No skills added yet. Add at least one skill.</p>
              )}
            </div>

            {/* Resume */}
            <div className="form-section">
              <h3 className="section-title">Resume / Professional Bio *</h3>
              <textarea
                name="resumeText"
                value={formData.resumeText}
                onChange={handleInputChange}
                placeholder="Write a brief professional summary, work experience, education, and achievements..."
                className="form-textarea"
                rows="8"
                disabled={loading}
              />
              <p className="text-slate-500 text-sm">
                {formData.resumeText.length} characters
              </p>
            </div>

            {/* Availability */}
            <div className="form-section">
              <h3 className="section-title">Availability</h3>
              <div className="form-group">
                <label className="form-label">Available Start Date</label>
                <input
                  type="date"
                  name="availabilityDate"
                  value={formData.availabilityDate}
                  onChange={handleInputChange}
                  className="form-input"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Message */}
            <div className="form-section">
              <h3 className="section-title">Message to Business Owner</h3>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                placeholder="Add any additional message or cover letter..."
                className="form-textarea"
                rows="4"
                disabled={loading}
              />
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
                {loading ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
