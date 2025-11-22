import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './BusinessEditModal.css'

export default function BusinessEditModal({ business, userId, onClose, onUpdated }) {
  const [formData, setFormData] = useState({
    business_name: business?.business_name || '',
    registration_type: business?.registration_type || 'sole',
    city_of_registration: business?.city_of_registration || '',
    tin: business?.tin || '',
    currency_registration_id: business?.currency_registration_id || '',
    address: business?.metadata?.address || '',
    phone: business?.metadata?.phone || '',
    email: business?.metadata?.email || '',
    website: business?.metadata?.website || '',
    description: business?.metadata?.description || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Validate required fields
      if (!formData.business_name.trim()) {
        throw new Error('Business name is required')
      }

      // Update business in database
      const { error: updateError } = await supabase
        .from('businesses')
        .update({
          business_name: formData.business_name,
          registration_type: formData.registration_type,
          city_of_registration: formData.city_of_registration,
          tin: formData.tin,
          currency_registration_id: formData.currency_registration_id,
          metadata: {
            ...business.metadata,
            address: formData.address,
            phone: formData.phone,
            email: formData.email,
            website: formData.website,
            description: formData.description
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', business.id)
        .eq('user_id', userId)

      if (updateError) throw updateError

      onUpdated()
    } catch (err) {
      console.error('Error updating business:', err)
      setError(err?.message || 'Failed to update business. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content business-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Business Details</h2>
          <button className="btn-close" onClick={onClose}>X</button>
        </div>

        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError('')} className="close-error">X</button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Basic Information */}
          <div className="form-section">
            <h3>Basic Information</h3>
            
            <div className="form-group">
              <label htmlFor="business_name">Business Name *</label>
              <input
                type="text"
                id="business_name"
                name="business_name"
                value={formData.business_name}
                onChange={handleChange}
                placeholder="Enter business name"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="registration_type">Registration Type</label>
                <select
                  id="registration_type"
                  name="registration_type"
                  value={formData.registration_type}
                  onChange={handleChange}
                >
                  <option value="sole">Sole Proprietor</option>
                  <option value="partnership">Partnership</option>
                  <option value="corporation">Corporation</option>
                  <option value="llc">LLC</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="city_of_registration">City/Region</label>
                <input
                  type="text"
                  id="city_of_registration"
                  name="city_of_registration"
                  value={formData.city_of_registration}
                  onChange={handleChange}
                  placeholder="e.g., Manila"
                />
              </div>
            </div>
          </div>

          {/* Registration Details */}
          <div className="form-section">
            <h3>Registration Details</h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="tin">TIN</label>
                <input
                  type="text"
                  id="tin"
                  name="tin"
                  value={formData.tin}
                  onChange={handleChange}
                  placeholder="Tax Identification Number"
                />
              </div>

              <div className="form-group">
                <label htmlFor="currency_registration_id">Currency Registration ID</label>
                <input
                  type="text"
                  id="currency_registration_id"
                  name="currency_registration_id"
                  value={formData.currency_registration_id}
                  readOnly
                  placeholder="CRN-XXXXXXXXXXXXXXXX"
                  style={{ backgroundColor: '#f3f4f6', color: '#6b7280', cursor: 'not-allowed' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="address">Address</label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Business address"
              />
            </div>
          </div>

          {/* Contact Information */}
          <div className="form-section">
            <h3>Contact Information</h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="phone">Phone</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Phone number"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email address"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="website">Website</label>
              <input
                type="url"
                id="website"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://example.com"
              />
            </div>
          </div>

          {/* Description */}
          <div className="form-section">
            <h3>Business Description</h3>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Tell us about your business..."
                rows="4"
              ></textarea>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="modal-actions">
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
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
