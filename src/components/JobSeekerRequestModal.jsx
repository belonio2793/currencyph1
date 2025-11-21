import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './JobSeekerRequestModal.css'

export default function JobSeekerRequestModal({ business, userId, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    message: '',
    expected_rate: '',
    availability: 'immediate'
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.message.trim()) {
      setError('Please include a message with your request')
      return
    }

    try {
      setLoading(true)
      setError('')

      const { error: submitError } = await supabase
        .from('job_requests')
        .insert([{
          business_id: business.id,
          user_id: userId,
          message: formData.message,
          expected_rate: formData.expected_rate ? parseFloat(formData.expected_rate) : null,
          availability: formData.availability,
          status: 'pending',
          created_at: new Date().toISOString()
        }])

      if (submitError) throw submitError

      setSuccess('Request sent successfully!')
      setFormData({
        message: '',
        expected_rate: '',
        availability: 'immediate'
      })
      setTimeout(() => {
        setSuccess('')
        onClose()
      }, 2000)
    } catch (err) {
      console.error('Error submitting request:', err)
      setError(err?.message || 'Failed to send request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content job-seeker-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <h2>Send Job Request</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        {/* Messages */}
        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError('')} className="close-msg">×</button>
          </div>
        )}
        {success && (
          <div className="success-message">
            {success}
            <button onClick={() => setSuccess('')} className="close-msg">×</button>
          </div>
        )}

        {/* Modal Body */}
        <div className="modal-body">
          <form onSubmit={handleSubmit} className="request-form">
            <div className="form-group">
              <label htmlFor="business-name">Applying to</label>
              <input
                type="text"
                id="business-name"
                value={business?.business_name || 'Unknown Business'}
                readOnly
                className="input-readonly"
              />
            </div>

            <div className="form-group">
              <label htmlFor="message">Your Message *</label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder="Tell the business about yourself and why you're interested..."
                rows="5"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="expected-rate">Expected Rate (Optional)</label>
                <input
                  type="number"
                  id="expected-rate"
                  name="expected_rate"
                  value={formData.expected_rate}
                  onChange={handleChange}
                  placeholder="e.g., 250"
                  step="0.01"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label htmlFor="availability">Availability *</label>
                <select
                  id="availability"
                  name="availability"
                  value={formData.availability}
                  onChange={handleChange}
                >
                  <option value="immediate">Immediate</option>
                  <option value="one_week">Within 1 week</option>
                  <option value="two_weeks">Within 2 weeks</option>
                  <option value="one_month">Within 1 month</option>
                </select>
              </div>
            </div>

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
                {loading ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
