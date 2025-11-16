import { useState } from 'react'
import './JobOfferForm.css'

export default function JobOfferForm({
  jobId,
  jobRate,
  onSubmit,
  onCancel
}) {
  const [formData, setFormData] = useState({
    provider_name: '',
    provider_email: '',
    provider_phone: '',
    provider_description: '',
    offered_rate: jobRate || '',
    offer_message: ''
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })
  }

  const validateForm = () => {
    if (!formData.provider_name.trim()) {
      setError('Name is required')
      return false
    }
    if (!formData.provider_email.trim()) {
      setError('Email is required')
      return false
    }
    if (!formData.provider_phone.trim()) {
      setError('Phone number is required')
      return false
    }
    if (!formData.offered_rate) {
      setError('Please provide your rate')
      return false
    }
    if (!formData.offer_message.trim()) {
      setError('Please provide a brief message')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      await onSubmit(formData)
    } catch (err) {
      console.error('Error submitting offer:', err)
      setError('Failed to submit offer. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="job-offer-form">
      <h4>Submit Your Offer</h4>

      {error && (
        <div className="error-message">
          {error}
          <button
            type="button"
            onClick={() => setError('')}
            className="close-error"
          >
            ×
          </button>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="provider_name">Your Name *</label>
        <input
          id="provider_name"
          type="text"
          name="provider_name"
          value={formData.provider_name}
          onChange={handleInputChange}
          placeholder="Full name"
          required
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="provider_email">Email *</label>
          <input
            id="provider_email"
            type="email"
            name="provider_email"
            value={formData.provider_email}
            onChange={handleInputChange}
            placeholder="your@email.com"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="provider_phone">Phone Number *</label>
          <input
            id="provider_phone"
            type="tel"
            name="provider_phone"
            value={formData.provider_phone}
            onChange={handleInputChange}
            placeholder="+63 9XX XXX XXXX"
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="offered_rate">Your Rate (PHP) *</label>
        <div className="rate-input-group">
          <input
            id="offered_rate"
            type="number"
            name="offered_rate"
            value={formData.offered_rate}
            onChange={handleInputChange}
            placeholder="0.00"
            step="0.01"
            min="0"
            required
          />
          {jobRate && (
            <span className="job-rate-info">
              Job rate: ₱{jobRate.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="provider_description">About You</label>
        <textarea
          id="provider_description"
          name="provider_description"
          value={formData.provider_description}
          onChange={handleInputChange}
          placeholder="Brief information about your experience and qualifications"
          rows="3"
        />
      </div>

      <div className="form-group">
        <label htmlFor="offer_message">Why You're a Good Fit *</label>
        <textarea
          id="offer_message"
          name="offer_message"
          value={formData.offer_message}
          onChange={handleInputChange}
          placeholder="Explain why you're interested in this job and how you can help..."
          rows="4"
          required
        />
      </div>

      <div className="form-actions">
        <button
          type="button"
          onClick={onCancel}
          className="btn-cancel-offer"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn-submit-offer"
          disabled={loading}
        >
          {loading ? 'Submitting...' : 'Submit Offer'}
        </button>
      </div>
    </form>
  )
}
