import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import { useGeolocation } from '../lib/useGeolocation'
import './PostJobModal.css'

// Fix Leaflet icon issues
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const JOB_CATEGORIES = ['Personal', 'Digital', 'Home', 'Business', 'Other']

// Map click handler component
function LocationMarker({ onLocationSelect, initialPosition }) {
  const [position, setPosition] = useState(initialPosition || [12.5, 121.5])
  
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng])
      onLocationSelect([e.latlng.lat, e.latlng.lng])
    },
  })

  return position ? <Marker position={position} /> : null
}

export default function SubmitJobModal({
  onClose,
  onSubmit,
  categories = [],
  cities = [],
  userBusinesses = [],
  userId
}) {
  const mapRef = useRef(null)
  const { location: userLocation, loading: geoLoading } = useGeolocation()
  const [jobTitleSuggestions, setJobTitleSuggestions] = useState([])
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false)
  const [mapLocation, setMapLocation] = useState([12.5, 121.5]) // Default to Philippines center
  const [equipment, setEquipment] = useState([])
  const [equipmentInput, setEquipmentInput] = useState('')
  const [fetchingLocation, setFetchingLocation] = useState(false)

  const [formData, setFormData] = useState({
    job_title: '',
    job_category: '',
    job_description: '',
    job_type: 'one_time',
    pay_rate: '',
    pay_type: 'fixed',
    location: '',
    city: '',
    latitude: 12.5,
    longitude: 121.5,
    skills_required: [],
    experience_level: 'intermediate',
    start_date: '',
    end_date: '',
    offer_expiry_date: '',
    positions_available: 1,
    business_id: '',
    posted_by_user_id: userId,
    is_public: true,
    status: 'active'
  })

  const [skillInput, setSkillInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Load existing job titles for suggestions
  useEffect(() => {
    const loadJobTitleSuggestions = async () => {
      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('job_title')
          .limit(20)

        if (!error && data) {
          const uniqueTitles = [...new Set(data.map(j => j.job_title))]
          setJobTitleSuggestions(uniqueTitles)
        }
      } catch (err) {
        console.error('Error loading job title suggestions:', err)
      }
    }

    loadJobTitleSuggestions()
  }, [])

  // Auto-update location when user's location is fetched
  useEffect(() => {
    if (fetchingLocation && userLocation && userLocation.latitude && userLocation.longitude) {
      const coords = [userLocation.latitude, userLocation.longitude]
      setMapLocation(coords)
      setFormData(prev => ({
        ...prev,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        city: `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`
      }))
      setFetchingLocation(false)
    }
  }, [userLocation, fetchingLocation])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })

    // Show title suggestions when typing
    if (name === 'job_title' && value.length > 0) {
      setShowTitleSuggestions(true)
    }
  }

  const handleTitleSuggestionClick = (title) => {
    setFormData({ ...formData, job_title: title })
    setShowTitleSuggestions(false)
  }

  const handleAddSkill = () => {
    if (skillInput.trim() && !formData.skills_required.includes(skillInput)) {
      setFormData({
        ...formData,
        skills_required: [...formData.skills_required, skillInput]
      })
      setSkillInput('')
    }
  }

  const handleRemoveSkill = (skill) => {
    setFormData({
      ...formData,
      skills_required: formData.skills_required.filter(s => s !== skill)
    })
  }

  const handleAddEquipment = () => {
    if (equipmentInput.trim() && !equipment.includes(equipmentInput)) {
      setEquipment([...equipment, equipmentInput])
      setEquipmentInput('')
    }
  }

  const handleRemoveEquipment = (item) => {
    setEquipment(equipment.filter(e => e !== item))
  }

  const handleLocationSelect = (coords) => {
    setMapLocation(coords)
    setFormData({
      ...formData,
      latitude: coords[0],
      longitude: coords[1],
      city: `${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`
    })
  }

  const handleFetchCurrentLocation = () => {
    if (userLocation && userLocation.latitude && userLocation.longitude && !geoLoading) {
      const coords = [userLocation.latitude, userLocation.longitude]
      setMapLocation(coords)
      setFormData(prev => ({
        ...prev,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        city: `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`
      }))
    } else {
      setFetchingLocation(true)
      try {
        window.dispatchEvent(new Event('geolocation:refresh'))
      } catch (e) {}
    }
  }

  const validateForm = () => {
    if (!formData.job_title.trim()) {
      setError('Job title is required')
      return false
    }
    if (!formData.job_category) {
      setError('Job category is required')
      return false
    }
    if (!formData.job_description.trim()) {
      setError('Job description is required')
      return false
    }
    if (!formData.latitude || !formData.longitude) {
      setError('Location is required')
      return false
    }
    if (formData.pay_type === 'fixed' && !formData.pay_rate) {
      setError('Pay rate is required for fixed pay')
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
      await onSubmit({
        ...formData,
        skills_required: JSON.stringify(formData.skills_required),
        equipment_required: JSON.stringify(equipment)
      })
    } catch (err) {
      console.error('Error submitting job:', err)
      const errorMessage = err?.message || err?.details || 'Failed to submit job. Please try again.'
      setError(`Failed to submit job: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const filteredTitleSuggestions = showTitleSuggestions && formData.job_title
    ? jobTitleSuggestions.filter(title =>
        title.toLowerCase().includes(formData.job_title.toLowerCase())
      ).slice(0, 5)
    : []

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="post-job-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Submit a Job</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="post-job-form">
          {/* Business Selection - Only show if user has businesses */}
          {userBusinesses.length > 0 && (
            <div className="form-section">
              <h3>Business Association (Optional)</h3>
              <div className="form-group">
                <label htmlFor="business_id">Associate with a Business</label>
                <select
                  id="business_id"
                  name="business_id"
                  value={formData.business_id}
                  onChange={handleInputChange}
                >
                  <option value="">Not associated with a business</option>
                  {userBusinesses.map(business => (
                    <option key={business.id} value={business.id}>
                      {business.business_name}
                    </option>
                  ))}
                </select>
                <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                  Associating with a business will sync this job to your My Business tab
                </small>
              </div>
            </div>
          )}

          <div className="form-section">
            <h3>Job Details</h3>

            <div className="form-group">
              <label htmlFor="job_title">Job Title *</label>
              <div className="job-title-wrapper" style={{ position: 'relative' }}>
                <input
                  id="job_title"
                  type="text"
                  name="job_title"
                  value={formData.job_title}
                  onChange={handleInputChange}
                  onFocus={() => formData.job_title && setShowTitleSuggestions(true)}
                  placeholder="e.g., Expert Hairstylist, Makeup Artist"
                  required
                />
                {filteredTitleSuggestions.length > 0 && (
                  <div className="suggestions-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100 }}>
                    {filteredTitleSuggestions.map((title, idx) => (
                      <div
                        key={idx}
                        className="suggestion-item"
                        onClick={() => handleTitleSuggestionClick(title)}
                        style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                      >
                        {title}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="job_category">Category *</label>
                <select
                  id="job_category"
                  name="job_category"
                  value={formData.job_category}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select a category</option>
                  {JOB_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="job_type">Job Type *</label>
                <select
                  id="job_type"
                  name="job_type"
                  value={formData.job_type}
                  onChange={handleInputChange}
                  required
                >
                  <option value="one_time">One-time</option>
                  <option value="hourly">Hourly</option>
                  <option value="full_time">Full-time</option>
                  <option value="part_time">Part-time</option>
                  <option value="contract">Contract</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="job_description">Job Description *</label>
              <textarea
                id="job_description"
                name="job_description"
                value={formData.job_description}
                onChange={handleInputChange}
                placeholder="Describe the job, requirements, and expectations..."
                rows="6"
                required
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Compensation & Location</h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="pay_type">Pay Type *</label>
                <select
                  id="pay_type"
                  name="pay_type"
                  value={formData.pay_type}
                  onChange={handleInputChange}
                >
                  <option value="fixed">Fixed Rate</option>
                  <option value="negotiable">Negotiable</option>
                  <option value="hourly_rate">Hourly Rate</option>
                </select>
              </div>

              {formData.pay_type === 'fixed' && (
                <div className="form-group">
                  <label htmlFor="pay_rate">Pay Rate (PHP) *</label>
                  <input
                    id="pay_rate"
                    type="number"
                    name="pay_rate"
                    value={formData.pay_rate}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Job Location *</label>
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
                  disabled={geoLoading || fetchingLocation}
                  className="btn-add-skill"
                  style={{ whiteSpace: 'nowrap', padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  {geoLoading || fetchingLocation ? 'Fetching...' : 'Fetch Location'}
                </button>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="latitude">Latitude *</label>
                  <input
                    id="latitude"
                    type="number"
                    name="latitude"
                    value={formData.latitude}
                    onChange={(e) => setFormData({
                      ...formData,
                      latitude: parseFloat(e.target.value) || 0
                    })}
                    placeholder="12.500000"
                    step="0.000001"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="longitude">Longitude *</label>
                  <input
                    id="longitude"
                    type="number"
                    name="longitude"
                    value={formData.longitude}
                    onChange={(e) => setFormData({
                      ...formData,
                      longitude: parseFloat(e.target.value) || 0
                    })}
                    placeholder="121.500000"
                    step="0.000001"
                    required
                  />
                </div>
              </div>

              {/* Location Info Messages */}
              <div style={{
                padding: '12px 15px',
                backgroundColor: '#e3f2fd',
                borderLeft: '4px solid #2196f3',
                borderRadius: '4px',
                marginTop: '15px',
                fontSize: '0.85rem',
                color: '#1565c0',
                lineHeight: '1.5'
              }}>
                <p style={{ margin: 0 }}>
                  📍 Make sure location services are enabled on your device. You can disable location tracking in your browser or device settings at any time. Location accuracy may vary depending on your device and connection.
                </p>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="location">Other Location Details</label>
              <input
                id="location"
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="e.g., Near the mall, accessible by car"
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Business Details</h3>

            <div className="form-group">
              <label htmlFor="currency_registration_number">Currency Registration Number (Optional)</label>
              <div style={{ marginBottom: '10px' }}>
                <select
                  id="currency_registration_select"
                  onChange={(e) => {
                    if (e.target.value) {
                      setFormData({
                        ...formData,
                        currency_registration_number: e.target.value
                      })
                    }
                  }}
                  className="form-control"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    marginBottom: '10px'
                  }}
                >
                  <option value="">Select from existing businesses...</option>
                  {userBusinesses && userBusinesses.map(business => (
                    business.currency_registration_number && (
                      <option key={business.id} value={business.currency_registration_number}>
                        {business.business_name} ({business.currency_registration_number})
                      </option>
                    )
                  ))}
                </select>
              </div>
              <input
                id="currency_registration_number"
                type="text"
                name="currency_registration_number"
                value={formData.currency_registration_number}
                onChange={handleInputChange}
                placeholder="Or manually enter registration number"
              />
              <p style={{ fontSize: '0.8rem', color: '#999', marginTop: '6px' }}>
                Link a business registration to this job (optional)
              </p>
            </div>
          </div>

          <div className="form-section">
            <h3>Requirements</h3>

            <div className="form-group">
              <label>Skills Required</label>
              <div className="skill-input-group">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                  placeholder="Add a skill and press Enter"
                  className="skill-input"
                />
                <button
                  type="button"
                  onClick={handleAddSkill}
                  className="btn-add-skill"
                >
                  Add
                </button>
              </div>
              {formData.skills_required.length > 0 && (
                <div className="skills-list">
                  {formData.skills_required.map((skill, idx) => (
                    <span key={idx} className="skill-tag">
                      {skill}
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="remove-skill"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Equipment Required</label>
              <div className="skill-input-group">
                <input
                  type="text"
                  value={equipmentInput}
                  onChange={(e) => setEquipmentInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEquipment())}
                  placeholder="Add equipment and press Enter"
                  className="skill-input"
                />
                <button
                  type="button"
                  onClick={handleAddEquipment}
                  className="btn-add-skill"
                >
                  Add
                </button>
              </div>
              {equipment.length > 0 && (
                <div className="skills-list">
                  {equipment.map((item, idx) => (
                    <span key={idx} className="skill-tag">
                      {item}
                      <button
                        type="button"
                        onClick={() => handleRemoveEquipment(item)}
                        className="remove-skill"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-section">
            <h3>Timeline</h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="start_date">Start Date</label>
                <input
                  id="start_date"
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="end_date">End Date</label>
                <input
                  id="end_date"
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="offer_expiry_date">Offer Expiry Date</label>
              <input
                id="offer_expiry_date"
                type="date"
                name="offer_expiry_date"
                value={formData.offer_expiry_date}
                onChange={handleInputChange}
              />
              <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                Job will be marked as closed after this date
              </small>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="experience_level">Experience Level</label>
                <select
                  id="experience_level"
                  name="experience_level"
                  value={formData.experience_level}
                  onChange={handleInputChange}
                >
                  <option value="entry">Entry Level</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="expert">Expert</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="positions_available">Positions Available</label>
                <input
                  id="positions_available"
                  type="number"
                  name="positions_available"
                  value={formData.positions_available}
                  onChange={handleInputChange}
                  min="1"
                  placeholder="1"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
