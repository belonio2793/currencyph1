import { useState, useRef, useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import { PHILIPPINES_CITIES, searchCities } from '../data/philippinesCities'
import './PostJobModal.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

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

export default function PostJobModal({
  onClose,
  onSubmit,
  categories = [],
  cities = []
}) {
  const mapRef = useRef(null)
  const [formData, setFormData] = useState({
    job_title: '',
    job_category: '',
    job_description: '',
    job_type: 'one_time',
    pay_rate: '',
    pay_type: 'fixed',
    location: '',
    city: '',
    province: '',
    latitude: 12.5,
    longitude: 121.5,
    skills_required: [],
    experience_level: 'intermediate',
    start_date: '',
    end_date: '',
    deadline_for_applications: '',
    positions_available: 1,
    status: 'active'
  })

  const [skillInput, setSkillInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCityDropdown, setShowCityDropdown] = useState(false)
  const [citySearchQuery, setCitySearchQuery] = useState('')
  const [filteredCities, setFilteredCities] = useState([])
  const [mapLocation, setMapLocation] = useState([12.5, 121.5])
  const [fetchingLocation, setFetchingLocation] = useState(false)
  const [locationMode, setLocationMode] = useState('location')
  const cityDropdownRef = useRef(null)

  useEffect(() => {
    setFilteredCities(PHILIPPINES_CITIES.slice(0, 10))
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target)) {
        setShowCityDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })
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

  const handleCitySearch = (value) => {
    setCitySearchQuery(value)
    if (value.trim()) {
      const filtered = searchCities(value)
      setFilteredCities(filtered)
    } else {
      setFilteredCities(PHILIPPINES_CITIES.slice(0, 10))
    }
  }

  const handleCitySelect = (city) => {
    setFormData({
      ...formData,
      city: city
    })
    setCitySearchQuery(city)
    setShowCityDropdown(false)
    setFilteredCities([city])
  }

  const handleLocationSelect = (coords) => {
    setMapLocation(coords)
    setFormData({
      ...formData,
      latitude: coords[0],
      longitude: coords[1],
      city: formData.city || `${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`
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
            city: prev.city || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
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
    if (!formData.city) {
      setError('City is required')
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
      const jobDataToSubmit = {
        ...formData,
        skills_required: JSON.stringify(formData.skills_required),
        is_public: true,
        latitude: locationMode === 'location' ? formData.latitude : null,
        longitude: locationMode === 'location' ? formData.longitude : null
      }
      await onSubmit(jobDataToSubmit)
    } catch (err) {
      console.error('Error posting job:', err)
      setError('Failed to post job. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="post-job-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Post a New Job</h2>
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
              <input
                id="job_title"
                type="text"
                name="job_title"
                value={formData.job_title}
                onChange={handleInputChange}
                placeholder="e.g., Expert Hairstylist, Makeup Artist"
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
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select a category</option>
                  {categories.length > 0 ? (
                    categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))
                  ) : (
                    <>
                      <option value="haircut">Haircut</option>
                      <option value="beauty">Beauty Services</option>
                      <option value="makeup">Makeup</option>
                      <option value="nails">Nails</option>
                      <option value="chef">Culinary/Chef</option>
                      <option value="personal_services">Personal Services</option>
                      <option value="construction">Construction</option>
                      <option value="cleaning">Cleaning</option>
                      <option value="tutoring">Tutoring</option>
                      <option value="other">Other</option>
                    </>
                  )}
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
                    <label htmlFor="latitude">Latitude</label>
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
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="longitude">Longitude</label>
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
                    />
                  </div>
                </div>

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

            <div className="form-row">
              <div className="form-group" ref={cityDropdownRef} style={{ position: 'relative' }}>
                <label htmlFor="city-search">City *</label>
                <input
                  id="city-search"
                  type="text"
                  value={citySearchQuery}
                  onChange={(e) => handleCitySearch(e.target.value)}
                  onFocus={() => setShowCityDropdown(true)}
                  placeholder="Type to search cities..."
                  required
                  style={{ width: '100%' }}
                />
                {showCityDropdown && filteredCities.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    marginTop: '2px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}>
                    {filteredCities.map((city, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleCitySelect(city)}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #eee',
                          backgroundColor: city === formData.city ? '#f0f0f0' : 'white',
                          ':hover': {
                            backgroundColor: '#f5f5f5'
                          }
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = city === formData.city ? '#f0f0f0' : 'white'}
                      >
                        {city}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="province">Province</label>
                <input
                  id="province"
                  type="text"
                  name="province"
                  value={formData.province}
                  onChange={handleInputChange}
                  placeholder="e.g., Metro Manila"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="location">Detailed Location</label>
              <input
                id="location"
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="e.g., Makati CBD, Taguig"
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Requirements & Timeline</h3>

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
              <label htmlFor="deadline_for_applications">Application Deadline</label>
              <input
                id="deadline_for_applications"
                type="date"
                name="deadline_for_applications"
                value={formData.deadline_for_applications}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="filled">Filled</option>
              </select>
            </div>
          </div>

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
              {loading ? 'Posting...' : 'Post Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
