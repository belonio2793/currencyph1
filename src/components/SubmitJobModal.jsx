import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
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
  const [jobTitleSuggestions, setJobTitleSuggestions] = useState([])
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false)
  const [mapLocation, setMapLocation] = useState([12.5, 121.5]) // Default to Philippines center
  const [fetchingLocation, setFetchingLocation] = useState(false)
  const [showAddBusinessModal, setShowAddBusinessModal] = useState(false)
  const [updatedBusinesses, setUpdatedBusinesses] = useState([])
  const [locationMode, setLocationMode] = useState('location') // 'location' or 'remote'

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
  const [businessFormData, setBusinessFormData] = useState({
    businessName: '',
    registrationType: 'sole',
    tin: '',
    currencyRegistrationNumber: '',
    cityOfRegistration: '',
    registrationDate: ''
  })
  const [creatingBusiness, setCreatingBusiness] = useState(false)

  // Generate a unique currency registration number when the modal opens
  useEffect(() => {
    if (showAddBusinessModal && !businessFormData.currencyRegistrationNumber) {
      // Generate format: P-XXXXXXXX-XXX (Philippine registration format)
      const randomNum1 = Math.floor(Math.random() * 100000000).toString().padStart(8, '0')
      const randomNum2 = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
      const generatedNumber = `P-${randomNum1}-${randomNum2}`
      setBusinessFormData(prev => ({
        ...prev,
        currencyRegistrationNumber: generatedNumber
      }))
    }
  }, [showAddBusinessModal])

  const handleCreateBusiness = async (e) => {
    e.preventDefault()
    if (!businessFormData.businessName.trim()) {
      setError('Business name is required')
      return
    }

    setCreatingBusiness(true)
    try {
      const { data, error: dbError } = await supabase
        .from('businesses')
        .insert([{
          user_id: userId,
          business_name: businessFormData.businessName,
          registration_type: businessFormData.registrationType,
          tin: businessFormData.tin || null,
          currency_registration_number: businessFormData.currencyRegistrationNumber,
          city_of_registration: businessFormData.cityOfRegistration,
          registration_date: businessFormData.registrationDate || null,
          status: 'active'
        }])
        .select()

      if (dbError) throw dbError

      const newBusiness = data[0]
      const updatedList = [...updatedBusinesses, newBusiness]
      setUpdatedBusinesses(updatedList)
      setFormData({
        ...formData,
        business_id: newBusiness.id
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
      console.error('Error creating business:', err)
      setError(`Failed to create business: ${err.message}`)
    } finally {
      setCreatingBusiness(false)
    }
  }

  // Initialize updatedBusinesses with userBusinesses prop when they change
  useEffect(() => {
    const initializeBusinesses = async () => {
      // First, try using the userBusinesses prop
      if (userBusinesses && userBusinesses.length > 0) {
        setUpdatedBusinesses(userBusinesses)
        console.log('SubmitJobModal: Loaded businesses from prop', userBusinesses)
        return
      }

      // Fallback: Load businesses directly from database if userId is available
      if (userId) {
        try {
          const { data, error } = await supabase
            .from('businesses')
            .select('*')
            .eq('user_id', userId)

          if (error) {
            console.error('SubmitJobModal: Error loading businesses from DB:', error)
            return
          }

          if (data && data.length > 0) {
            setUpdatedBusinesses(data)
            console.log('SubmitJobModal: Loaded businesses from database', data)
          } else {
            console.log('SubmitJobModal: No businesses found for user', userId)
          }
        } catch (err) {
          console.error('SubmitJobModal: Error querying businesses:', err)
        }
      }
    }

    initializeBusinesses()
  }, [userBusinesses, userId])

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
    setFetchingLocation(true)

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          const coords = [latitude, longitude]
          setMapLocation(coords)
          setFormData(prev => ({
            ...prev,
            latitude: latitude,
            longitude: longitude,
            city: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          }))
          setFetchingLocation(false)
        },
        (err) => {
          console.error('Geolocation error:', err)
          setError(`Location error: ${err.message}`)
          setFetchingLocation(false)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    } else {
      setError('Geolocation is not supported by your browser')
      setFetchingLocation(false)
    }
  }

  const getFormattedDate = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const setDatePreset = (fieldName, daysOffset) => {
    const date = new Date()
    date.setDate(date.getDate() + daysOffset)
    setFormData({
      ...formData,
      [fieldName]: getFormattedDate(date)
    })
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
    if (locationMode === 'location' && (!formData.latitude || !formData.longitude)) {
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
        posting_type: 'service_offer',
        skills_required: JSON.stringify(formData.skills_required),
        latitude: locationMode === 'location' ? formData.latitude : null,
        longitude: locationMode === 'location' ? formData.longitude : null
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

            {formData.job_type === 'remote' && (
              <div className="form-group" style={{
                padding: '15px',
                backgroundColor: '#f0f4ff',
                borderLeft: '4px solid #667eea',
                borderRadius: '6px',
                marginBottom: '20px'
              }}>
                <p style={{ margin: 0, color: '#667eea', fontWeight: '600', fontSize: '0.95rem' }}>
                  ✓ Remote Job Selected
                </p>
                <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: '0.85rem' }}>
                  Service providers can work from anywhere. Location information is optional.
                </p>
              </div>
            )}

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
              <label>Job Location Type *</label>
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
              <label htmlFor="business_select">Link to Business (Optional)</label>
              <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '10px' }}>
                Select a registered business to associate with this job
              </p>
              <select
                id="business_select"
                onChange={(e) => {
                  if (e.target.value) {
                    setFormData({
                      ...formData,
                      business_id: e.target.value
                    })
                  } else {
                    setFormData({
                      ...formData,
                      business_id: ''
                    })
                  }
                }}
                value={formData.business_id}
                className="form-control"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  fontSize: '0.9rem'
                }}
              >
                <option value="">No business selected</option>
                {updatedBusinesses && updatedBusinesses.length > 0 ? (
                  updatedBusinesses.map(business => (
                    <option key={business.id} value={business.id}>
                      {business.business_name}
                      {business.currency_registration_number ? ` (${business.currency_registration_number})` : ''}
                    </option>
                  ))
                ) : (
                  <option disabled>No businesses available</option>
                )}
              </select>
              <div style={{ marginTop: '8px' }}>
                <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '6px' }}>
                  💡 Create a new business to link to this job:
                </p>
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
          </div>

          <div className="form-section">
            <h3>Timeline</h3>

            <div className="form-row">
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label htmlFor="start_date">Start Date</label>
                  <div style={{ fontSize: '0.85rem' }}>
                    <button
                      type="button"
                      onClick={() => setDatePreset('start_date', 0)}
                      style={{
                        color: '#667eea',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        padding: '0',
                        marginRight: '12px',
                        fontWeight: '500'
                      }}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatePreset('start_date', 1)}
                      style={{
                        color: '#667eea',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        padding: '0',
                        fontWeight: '500'
                      }}
                    >
                      Tomorrow
                    </button>
                  </div>
                </div>
                <input
                  id="start_date"
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label htmlFor="end_date">End Date</label>
                  <div style={{ fontSize: '0.85rem' }}>
                    <button
                      type="button"
                      onClick={() => setDatePreset('end_date', 0)}
                      style={{
                        color: '#667eea',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        padding: '0',
                        marginRight: '12px',
                        fontWeight: '500'
                      }}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatePreset('end_date', 1)}
                      style={{
                        color: '#667eea',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        padding: '0',
                        fontWeight: '500'
                      }}
                    >
                      Tomorrow
                    </button>
                  </div>
                </div>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label htmlFor="offer_expiry_date">Offer Expiry Date</label>
                <div style={{ fontSize: '0.85rem' }}>
                  <button
                    type="button"
                    onClick={() => setDatePreset('offer_expiry_date', 0)}
                    style={{
                      color: '#667eea',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: '0',
                      marginRight: '12px',
                      fontWeight: '500'
                    }}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setDatePreset('offer_expiry_date', 1)}
                    style={{
                      color: '#667eea',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: '0',
                      fontWeight: '500'
                    }}
                  >
                    Tomorrow
                  </button>
                </div>
              </div>
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

      {/* Create Business Modal */}
      {showAddBusinessModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          padding: '20px'
        }}
        onClick={() => setShowAddBusinessModal(false)}
        >
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#1a1a1a' }}>Create a Business</h2>
              <button
                onClick={() => setShowAddBusinessModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#1a1a1a'
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateBusiness} style={{ padding: '24px' }}>
              {error && (
                <div style={{
                  background: '#ffe5e5',
                  borderLeft: '4px solid #d63031',
                  padding: '12px 15px',
                  color: '#d63031',
                  marginBottom: '15px',
                  borderRadius: '4px',
                  fontSize: '0.9rem'
                }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', color: '#1a1a1a', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem' }}>
                  Business Name *
                </label>
                <input
                  type="text"
                  value={businessFormData.businessName}
                  onChange={(e) => setBusinessFormData({
                    ...businessFormData,
                    businessName: e.target.value
                  })}
                  placeholder="e.g., John's Plumbing Services"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', color: '#1a1a1a', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem' }}>
                  Registration Type
                </label>
                <select
                  value={businessFormData.registrationType}
                  onChange={(e) => setBusinessFormData({
                    ...businessFormData,
                    registrationType: e.target.value
                  })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="sole">Sole Proprietor</option>
                  <option value="partnership">Partnership</option>
                  <option value="corporation">Corporation</option>
                  <option value="cooperative">Cooperative</option>
                </select>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', color: '#1a1a1a', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem' }}>
                  Currency Registration Number
                </label>
                <input
                  type="text"
                  value={businessFormData.currencyRegistrationNumber}
                  disabled
                  placeholder="Auto-generated"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                    backgroundColor: '#f5f5f5',
                    color: '#666',
                    cursor: 'not-allowed'
                  }}
                />
                <small style={{ color: '#666', marginTop: '4px', display: 'block', fontSize: '0.8rem' }}>
                  Auto-generated and will be permanent when business is created
                </small>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', color: '#1a1a1a', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem' }}>
                  TIN (Tax Identification Number)
                </label>
                <input
                  type="text"
                  value={businessFormData.tin}
                  onChange={(e) => setBusinessFormData({
                    ...businessFormData,
                    tin: e.target.value
                  })}
                  placeholder="Optional"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', color: '#1a1a1a', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem' }}>
                  City of Registration
                </label>
                <input
                  type="text"
                  value={businessFormData.cityOfRegistration}
                  onChange={(e) => setBusinessFormData({
                    ...businessFormData,
                    cityOfRegistration: e.target.value
                  })}
                  placeholder="e.g., Manila"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#1a1a1a', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem' }}>
                  Registration Date
                </label>
                <input
                  type="date"
                  value={businessFormData.registrationDate}
                  onChange={(e) => setBusinessFormData({
                    ...businessFormData,
                    registrationDate: e.target.value
                  })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button
                  type="button"
                  onClick={() => setShowAddBusinessModal(false)}
                  style={{
                    padding: '10px 24px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    background: '#f5f5f5',
                    color: '#1a1a1a',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.9rem'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingBusiness}
                  style={{
                    padding: '10px 24px',
                    border: 'none',
                    borderRadius: '6px',
                    background: '#667eea',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    opacity: creatingBusiness ? 0.6 : 1
                  }}
                >
                  {creatingBusiness ? 'Creating...' : 'Create Business'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
