import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import PropertyMapper from './PropertyMapper'
import './Addresses.css'

export default function Addresses({ userId, onClose }) {
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    addresses_address: '',
    addresses_street_number: '',
    addresses_street_name: '',
    addresses_city: '',
    addresses_province: '',
    addresses_region: '',
    addresses_postal_code: '',
    barangay: '',
    addresses_latitude: '',
    addresses_longitude: '',
    lot_number: '',
    lot_area: '',
    lot_area_unit: 'sqm',
    property_type: 'Residential',
    zoning_classification: 'residential',
    land_use: '',
    owner_name: '',
    land_title_number: '',
    elevation: '',
    property_status: 'active',
    notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.addresses_street_name || !formData.addresses_city || !formData.addresses_latitude || !formData.addresses_longitude) {
      setError('Please fill in street name, city, latitude, and longitude')
      return
    }

    try {
      setLoading(true)
      const propertyData = {
        user_id: userId,
        ...formData,
        addresses_latitude: parseFloat(formData.addresses_latitude),
        addresses_longitude: parseFloat(formData.addresses_longitude),
        lot_area: formData.lot_area ? parseFloat(formData.lot_area) : null,
        elevation: formData.elevation ? parseFloat(formData.elevation) : null
      }

      const { error: insertError } = await supabase
        .from('addresses')
        .insert([propertyData])

      if (insertError) throw insertError

      setFormData({
        addresses_address: '',
        addresses_street_number: '',
        addresses_street_name: '',
        addresses_city: '',
        addresses_province: '',
        addresses_region: '',
        addresses_postal_code: '',
        barangay: '',
        addresses_latitude: '',
        addresses_longitude: '',
        lot_number: '',
        lot_area: '',
        lot_area_unit: 'sqm',
        property_type: 'Residential',
        zoning_classification: 'residential',
        land_use: '',
        owner_name: '',
        land_title_number: '',
        elevation: '',
        property_status: 'active',
        notes: ''
      })
      setShowForm(false)
      setRefreshKey(prev => prev + 1)
    } catch (err) {
      console.error('Error saving property:', err)
      setError(err.message || 'Failed to save property')
    } finally {
      setLoading(false)
    }
  }

  const propertyTypes = [
    'Residential',
    'Commercial',
    'Industrial',
    'Agricultural',
    'Mixed-Use',
    'Government'
  ]

  const zoningOptions = [
    'residential',
    'commercial',
    'industrial',
    'agricultural',
    'mixed-use',
    'govt'
  ]

  const regions = [
    'National Capital Region',
    'Cordillera Administrative Region',
    'Ilocos Region',
    'Cagayan Valley',
    'Central Luzon',
    'Calabarzon',
    'Mimaropa',
    'Bicol Region',
    'Western Visayas',
    'Central Visayas',
    'Eastern Visayas',
    'Zamboanga Peninsula',
    'Northern Mindanao',
    'Davao Region',
    'Soccsksargen',
    'Caraga',
    'Bangsamoro Autonomous Region in Muslim Mindanao'
  ]

  return (
    <div className="addresses-container">
      <PropertyMapper key={refreshKey} userId={userId} onPropertyAdded={() => setRefreshKey(prev => prev + 1)} />

      {/* Add Property Button - Fixed Position */}
      <button
        onClick={() => setShowForm(true)}
        className="btn-add-property-fixed"
        title="Add new property"
      >
        +
      </button>

      {/* Add Property Form Modal */}
      {showForm && (
        <div className="property-form-overlay" onClick={() => setShowForm(false)}>
          <div className="property-form-modal" onClick={e => e.stopPropagation()}>
            <div className="form-modal-header">
              <h2>Add New Property</h2>
              <button
                onClick={() => setShowForm(false)}
                className="form-modal-close"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="form-error-message">
                {error}
                <button onClick={() => setError('')} className="error-close">×</button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="property-form">
              {/* Address Section */}
              <div className="form-section">
                <h3 className="form-section-title">Address Information</h3>

                <div className="form-row">
                  <div className="form-group">
                    <label>Street Number</label>
                    <input
                      type="text"
                      name="addresses_street_number"
                      value={formData.addresses_street_number}
                      onChange={handleInputChange}
                      placeholder="e.g., 123"
                    />
                  </div>
                  <div className="form-group">
                    <label>Street Name *</label>
                    <input
                      type="text"
                      name="addresses_street_name"
                      value={formData.addresses_street_name}
                      onChange={handleInputChange}
                      placeholder="e.g., Makati Avenue"
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>City *</label>
                    <input
                      type="text"
                      name="addresses_city"
                      value={formData.addresses_city}
                      onChange={handleInputChange}
                      placeholder="e.g., Manila"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Province</label>
                    <input
                      type="text"
                      name="addresses_province"
                      value={formData.addresses_province}
                      onChange={handleInputChange}
                      placeholder="e.g., Metro Manila"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Region</label>
                    <select
                      name="addresses_region"
                      value={formData.addresses_region}
                      onChange={handleInputChange}
                    >
                      <option value="">Select Region</option>
                      {regions.map(region => (
                        <option key={region} value={region}>{region}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Postal Code</label>
                    <input
                      type="text"
                      name="addresses_postal_code"
                      value={formData.addresses_postal_code}
                      onChange={handleInputChange}
                      placeholder="e.g., 1200"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Barangay</label>
                    <input
                      type="text"
                      name="barangay"
                      value={formData.barangay}
                      onChange={handleInputChange}
                      placeholder="Barangay name"
                    />
                  </div>
                </div>
              </div>

              {/* Geolocation Section */}
              <div className="form-section">
                <h3 className="form-section-title">Geolocation *</h3>

                <div className="form-row">
                  <div className="form-group">
                    <label>Latitude *</label>
                    <input
                      type="number"
                      name="addresses_latitude"
                      value={formData.addresses_latitude}
                      onChange={handleInputChange}
                      placeholder="e.g., 14.5549"
                      step="0.000001"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Longitude *</label>
                    <input
                      type="number"
                      name="addresses_longitude"
                      value={formData.addresses_longitude}
                      onChange={handleInputChange}
                      placeholder="e.g., 121.0175"
                      step="0.000001"
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Elevation (meters)</label>
                    <input
                      type="number"
                      name="elevation"
                      value={formData.elevation}
                      onChange={handleInputChange}
                      placeholder="e.g., 45.5"
                      step="0.1"
                    />
                  </div>
                </div>
              </div>

              {/* Property Information Section */}
              <div className="form-section">
                <h3 className="form-section-title">Property Information</h3>

                <div className="form-row">
                  <div className="form-group">
                    <label>Property Type</label>
                    <select
                      name="property_type"
                      value={formData.property_type}
                      onChange={handleInputChange}
                    >
                      {propertyTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Zoning Classification</label>
                    <select
                      name="zoning_classification"
                      value={formData.zoning_classification}
                      onChange={handleInputChange}
                    >
                      {zoningOptions.map(zoning => (
                        <option key={zoning} value={zoning}>{zoning}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Lot Number</label>
                    <input
                      type="text"
                      name="lot_number"
                      value={formData.lot_number}
                      onChange={handleInputChange}
                      placeholder="e.g., LOT-001-MM-2024"
                    />
                  </div>
                  <div className="form-group">
                    <label>Lot Area</label>
                    <div className="input-with-unit">
                      <input
                        type="number"
                        name="lot_area"
                        value={formData.lot_area}
                        onChange={handleInputChange}
                        placeholder="e.g., 1500"
                        step="0.01"
                      />
                      <select
                        name="lot_area_unit"
                        value={formData.lot_area_unit}
                        onChange={handleInputChange}
                      >
                        <option value="sqm">sqm</option>
                        <option value="sqft">sqft</option>
                        <option value="hectares">hectares</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Land Use</label>
                    <input
                      type="text"
                      name="land_use"
                      value={formData.land_use}
                      onChange={handleInputChange}
                      placeholder="e.g., Office Space"
                    />
                  </div>
                </div>
              </div>

              {/* Ownership Section */}
              <div className="form-section">
                <h3 className="form-section-title">Ownership & Legal</h3>

                <div className="form-row">
                  <div className="form-group">
                    <label>Owner Name</label>
                    <input
                      type="text"
                      name="owner_name"
                      value={formData.owner_name}
                      onChange={handleInputChange}
                      placeholder="Property owner name"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Land Title Number</label>
                    <input
                      type="text"
                      name="land_title_number"
                      value={formData.land_title_number}
                      onChange={handleInputChange}
                      placeholder="e.g., TCT-123456"
                    />
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div className="form-section">
                <h3 className="form-section-title">Additional Notes</h3>

                <div className="form-group full-width">
                  <label>Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Add any additional information about this property..."
                    rows="4"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-form-cancel"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-form-save"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Property'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
