import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { MapContainer, TileLayer } from 'react-leaflet'
import LocationMarker from './LocationMarker'

export default function LookingToHireModal({ onClose, onSubmit, categories, cities, userBusinesses, userId }) {
  const mapRef = useRef(null)
  const [mapLocation, setMapLocation] = useState([12.8797, 121.7740]) // Default to Manila
  const [formData, setFormData] = useState({
    job_title: '',
    job_category: '',
    job_description: '',
    budget_min: '',
    budget_max: '',
    latitude: 0,
    longitude: 0,
    city: '',
    job_type: 'hourly',
    timeline: 'flexible',
    is_public: true,
    posting_type: 'service_request',
    business_id: null,
    public_notes: ''
  })
  const [updatedBusinesses, setUpdatedBusinesses] = useState([])
  const [showAddBusinessModal, setShowAddBusinessModal] = useState(false)
  const [businessFormData, setBusinessFormData] = useState({
    businessName: '',
    registrationType: 'sole',
    tin: '',
    currencyRegistrationNumber: '',
    cityOfRegistration: '',
    registrationDate: ''
  })
  const [creatingBusiness, setCreatingBusiness] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [locationMode, setLocationMode] = useState('location')
  const [fetchingLocation, setFetchingLocation] = useState(false)

  // Initialize updatedBusinesses with userBusinesses prop when they change
  useEffect(() => {
    const initializeBusinesses = async () => {
      if (userBusinesses && userBusinesses.length > 0) {
        setUpdatedBusinesses(userBusinesses)
        return
      }

      if (userId) {
        try {
          const { data, error } = await supabase
            .from('businesses')
            .select('*')
            .eq('user_id', userId)

          if (error) {
            console.error('LookingToHireModal: Error loading businesses from DB:', error)
            return
          }

          if (data && data.length > 0) {
            setUpdatedBusinesses(data)
          }
        } catch (err) {
          console.error('LookingToHireModal: Error querying businesses:', err)
        }
      }
    }

    initializeBusinesses()
  }, [userBusinesses, userId])

  const handleLocationSelect = (lat, lng) => {
    setFormData({
      ...formData,
      latitude: lat,
      longitude: lng
    })
    setMapLocation([lat, lng])
  }

  const handleFetchCurrentLocation = async () => {
    setFetchingLocation(true)
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords
            handleLocationSelect(latitude, longitude)
            setFetchingLocation(false)
          },
          (error) => {
            setError('Unable to fetch location: ' + error.message)
            setFetchingLocation(false)
          }
        )
      } else {
        setError('Geolocation is not supported by your browser')
        setFetchingLocation(false)
      }
    } catch (err) {
      setError('Error fetching location: ' + err.message)
      setFetchingLocation(false)
    }
  }

  const handleCreateBusiness = async (e) => {
    e.preventDefault()
    if (!businessFormData.businessName.trim()) {
      setError('Business name is required')
      return
    }

    setCreatingBusiness(true)
    try {
      const generatedNumber = `P-${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
      
      const { data, error: dbError } = await supabase
        .from('businesses')
        .insert([{
          user_id: userId,
          business_name: businessFormData.businessName,
          registration_type: businessFormData.registrationType,
          tin: businessFormData.tin || null,
          currency_registration_number: generatedNumber,
          city_of_registration: businessFormData.cityOfRegistration,
          registration_date: businessFormData.registrationDate || null,
          status: 'active'
        }])
        .select()

      if (dbError) throw dbError

      setUpdatedBusinesses([...updatedBusinesses, data[0]])
      setFormData({
        ...formData,
        business_id: data[0].id
      })
      setShowAddBusinessModal(false)
      setBusinessFormData({
        businessName: '',
        registrationType: 'sole',
        tin: '',
        currencyRegistrationNumber: '',
        cityOfRegistration: '',
        registrationDate: ''
      })
      setError('')
    } catch (err) {
      setError('Error creating business: ' + err.message)
    } finally {
      setCreatingBusiness(false)
    }
  }

  const validateForm = () => {
    if (!formData.job_title.trim()) {
      setError('Job needed is required')
      return false
    }
    if (!formData.job_category) {
      setError('Category is required')
      return false
    }
    if (!formData.job_description.trim()) {
      setError('Description is required')
      return false
    }
    if (locationMode === 'location' && (!formData.latitude || !formData.longitude)) {
      setError('Location is required')
      return false
    }
    if (!formData.budget_min || !formData.budget_max) {
      setError('Budget range is required')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    try {
      const jobData = {
        ...formData,
        latitude: locationMode === 'location' ? formData.latitude : null,
        longitude: locationMode === 'location' ? formData.longitude : null,
        user_id: userId,
        posting_type: 'service_request'
      }

      if (onSubmit) {
        await onSubmit(jobData)
      } else {
        const { data, error } = await supabase
          .from('jobs')
          .insert([jobData])
          .select()

        if (error) throw error
      }

      setError('')
      onClose()
    } catch (err) {
      setError('Error submitting service request: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="post-job-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Looking To Hire</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {error && (
          <div style={{ padding: '12px', backgroundColor: '#fee', borderLeft: '4px solid #f55', color: '#c33', marginBottom: '15px' }}>
            {error}
          </div>
        )}

        <form className="post-job-form" onSubmit={handleSubmit}>
          <div className="form-section">
            <h3>Service Details</h3>

            <div className="form-group">
              <label htmlFor="job_title">Service Needed *</label>
              <input
                id="job_title"
                type="text"
                name="job_title"
                value={formData.job_title}
                onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                placeholder="e.g., Website Design, Plumbing, Accounting"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="job_category">Category *</label>
                <select
                  id="job_category"
                  name="job_category"
                  value={formData.job_category}
                  onChange={(e) => setFormData({ ...formData, job_category: e.target.value })}
                  required
                >
                  <option value="">Select a category</option>
                  {categories && categories.length > 0 ? (
                    categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))
                  ) : (
                    <option value="">Loading categories...</option>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="timeline">Timeline</label>
                <select
                  id="timeline"
                  name="timeline"
                  value={formData.timeline}
                  onChange={(e) => setFormData({ ...formData, timeline: e.target.value })}
                >
                  <option value="flexible">Flexible</option>
                  <option value="urgent">Urgent (1-2 days)</option>
                  <option value="soon">Soon (1-2 weeks)</option>
                  <option value="ongoing">Ongoing</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="job_description">Description *</label>
              <textarea
                id="job_description"
                name="job_description"
                value={formData.job_description}
                onChange={(e) => setFormData({ ...formData, job_description: e.target.value })}
                placeholder="Describe what you need done"
                rows="5"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="budget_min">Budget Min (PHP) *</label>
                <input
                  id="budget_min"
                  type="number"
                  name="budget_min"
                  value={formData.budget_min}
                  onChange={(e) => setFormData({ ...formData, budget_min: e.target.value })}
                  placeholder="5000"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="budget_max">Budget Max (PHP) *</label>
                <input
                  id="budget_max"
                  type="number"
                  name="budget_max"
                  value={formData.budget_max}
                  onChange={(e) => setFormData({ ...formData, budget_max: e.target.value })}
                  placeholder="15000"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Location Type *</label>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '15px' }}>
                <button
                  type="button"
                  onClick={() => setLocationMode('location')}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: locationMode === 'location' ? '2px solid #667eea' : '1px solid #e0e0e0',
                    backgroundColor: locationMode === 'location' ? '#f0f4ff' : '#f5f5f5',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: locationMode === 'location' ? '600' : '500',
                    color: locationMode === 'location' ? '#667eea' : '#666',
                    fontSize: '0.9rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Specific Location
                </button>
                <button
                  type="button"
                  onClick={() => setLocationMode('remote')}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: locationMode === 'remote' ? '2px solid #667eea' : '1px solid #e0e0e0',
                    backgroundColor: locationMode === 'remote' ? '#f0f4ff' : '#f5f5f5',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: locationMode === 'remote' ? '600' : '500',
                    color: locationMode === 'remote' ? '#667eea' : '#666',
                    fontSize: '0.9rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Remote Location
                </button>
              </div>

              {locationMode === 'location' && (
              <div>
                <div style={{ height: '300px', borderRadius: '6px', overflow: 'hidden', marginBottom: '15px', border: '1px solid #e0e0e0' }}>
                  <MapContainer
                    ref={mapRef}
                    center={mapLocation}
                    zoom={12}
                    style={{ height: '100%', width: '100%' }}
                    attributionControl={false}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LocationMarker onLocationSelect={handleLocationSelect} initialPosition={mapLocation} />
                  </MapContainer>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', alignItems: 'center' }}>
                  <p style={{ color: '#666', margin: 0, fontSize: '0.85rem', flex: 1 }}>Click on the map to select a location</p>
                  <button
                    type="button"
                    onClick={handleFetchCurrentLocation}
                    disabled={fetchingLocation}
                    className="btn-add-skill"
                    style={{ whiteSpace: 'nowrap', padding: '8px 16px', fontSize: '0.85rem' }}
                  >
                    {fetchingLocation ? 'Fetching...' : 'Fetch Location'}
                  </button>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="latitude">Latitude</label>
                    <input
                      id="latitude"
                      type="number"
                      value={formData.latitude || ''}
                      onChange={(e) => {
                        const lat = parseFloat(e.target.value)
                        if (!isNaN(lat)) {
                          setFormData({ ...formData, latitude: lat })
                          setMapLocation([lat, formData.longitude])
                        }
                      }}
                      placeholder="Click on map or enter latitude"
                      step="0.00001"
                    />
                    <small style={{ color: '#999', marginTop: '4px', display: 'block' }}>
                      Drag the marker or enter coordinates
                    </small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="longitude">Longitude</label>
                    <input
                      id="longitude"
                      type="number"
                      value={formData.longitude || ''}
                      onChange={(e) => {
                        const lng = parseFloat(e.target.value)
                        if (!isNaN(lng)) {
                          setFormData({ ...formData, longitude: lng })
                          setMapLocation([formData.latitude, lng])
                        }
                      }}
                      placeholder="Click on map or enter longitude"
                      step="0.00001"
                    />
                    <small style={{ color: '#999', marginTop: '4px', display: 'block' }}>
                      Drag the marker or enter coordinates
                    </small>
                  </div>
                </div>
              </div>
              )}

              {locationMode === 'remote' && (
              <div style={{
                padding: '15px',
                backgroundColor: '#f0f9ff',
                borderLeft: '4px solid #0ea5e9',
                borderRadius: '6px',
                marginBottom: '15px'
              }}>
                <p style={{ margin: 0, color: '#0ea5e9', fontWeight: '600', fontSize: '0.95rem' }}>
                  Remote Location Selected
                </p>
                <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: '0.85rem' }}>
                  Service providers can work from anywhere. No specific location is needed.
                </p>
              </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="public_notes">Public Notes (Optional)</label>
              <textarea
                id="public_notes"
                name="public_notes"
                value={formData.public_notes}
                onChange={(e) => setFormData({ ...formData, public_notes: e.target.value })}
                placeholder="Add notes about your business, reputation, or preferences (visible to service providers)"
                rows="3"
              />
              <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                These notes help service providers understand your business and build trust
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="business_link">Link to Business (Optional)</label>
              <select
                id="business_link"
                value={formData.business_id || ''}
                onChange={(e) => setFormData({ ...formData, business_id: e.target.value || null })}
              >
                <option value="">No business selected</option>
                {updatedBusinesses.map(business => (
                  <option key={business.id} value={business.id}>
                    {business.business_name}
                  </option>
                ))}
              </select>
              <div style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddBusinessModal(true)}
                  style={{
                    fontSize: '0.85rem',
                    padding: '8px 16px',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  + Create a Business
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-submit">
              {loading ? 'Submitting...' : 'Post Service Request'}
            </button>
          </div>
        </form>

        {showAddBusinessModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowAddBusinessModal(false)}>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '500px', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
              <h3>Create a Business</h3>
              <form onSubmit={handleCreateBusiness}>
                <div className="form-group">
                  <label>Business Name *</label>
                  <input
                    type="text"
                    value={businessFormData.businessName}
                    onChange={(e) => setBusinessFormData({ ...businessFormData, businessName: e.target.value })}
                    placeholder="e.g., John's Plumbing Services"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Registration Type</label>
                  <select
                    value={businessFormData.registrationType}
                    onChange={(e) => setBusinessFormData({ ...businessFormData, registrationType: e.target.value })}
                  >
                    <option value="sole">Sole Proprietor</option>
                    <option value="partnership">Partnership</option>
                    <option value="corporation">Corporation</option>
                    <option value="cooperative">Cooperative</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Currency Registration Number</label>
                  <input
                    type="text"
                    value={businessFormData.currencyRegistrationNumber}
                    disabled
                    placeholder="Auto-generated"
                    style={{ backgroundColor: '#f5f5f5', color: '#666', cursor: 'not-allowed' }}
                  />
                  <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                    Auto-generated and will be permanent when business is created
                  </small>
                </div>

                <div className="form-group">
                  <label>TIN (Tax Identification Number)</label>
                  <input
                    type="text"
                    value={businessFormData.tin}
                    onChange={(e) => setBusinessFormData({ ...businessFormData, tin: e.target.value })}
                    placeholder="e.g., 123456789"
                  />
                </div>

                <div className="form-group">
                  <label>City of Registration</label>
                  <input
                    type="text"
                    value={businessFormData.cityOfRegistration}
                    onChange={(e) => setBusinessFormData({ ...businessFormData, cityOfRegistration: e.target.value })}
                    placeholder="e.g., Manila"
                  />
                </div>

                <div className="form-group">
                  <label>Registration Date</label>
                  <input
                    type="date"
                    value={businessFormData.registrationDate}
                    onChange={(e) => setBusinessFormData({ ...businessFormData, registrationDate: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button type="button" onClick={() => setShowAddBusinessModal(false)} className="btn-cancel">
                    Cancel
                  </button>
                  <button type="submit" disabled={creatingBusiness} className="btn-submit">
                    {creatingBusiness ? 'Creating...' : 'Create Business'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
