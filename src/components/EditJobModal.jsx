import { useState, useEffect, useRef } from 'react'
import { jobsService } from '../lib/jobsService'
import { PHILIPPINES_CITIES, searchCities } from '../data/philippinesCities'
import './PostJobModal.css'

export default function EditJobModal({
  job,
  onClose,
  onSubmit,
  categories = [],
  cities = []
}) {
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
  const cityDropdownRef = useRef(null)

  useEffect(() => {
    if (job) {
      setFormData({
        job_title: job.job_title || '',
        job_category: job.job_category || '',
        job_description: job.job_description || '',
        job_type: job.job_type || 'one_time',
        pay_rate: job.pay_rate || '',
        pay_type: job.pay_type || 'fixed',
        location: job.location || '',
        city: job.city || '',
        province: job.province || '',
        skills_required: typeof job.skills_required === 'string' 
          ? JSON.parse(job.skills_required || '[]')
          : job.skills_required || [],
        experience_level: job.experience_level || 'intermediate',
        start_date: job.start_date || '',
        end_date: job.end_date || '',
        deadline_for_applications: job.deadline_for_applications || '',
        positions_available: job.positions_available || 1,
        status: job.status || 'active'
      })
    }
  }, [job])

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
        skills_required: JSON.stringify(formData.skills_required)
      }, job.id)
    } catch (err) {
      console.error('Error updating job:', err)
      setError('Failed to update job. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!job) {
    return null
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="post-job-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Job Listing</h2>
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

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="city">City *</label>
                <select
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select a city</option>
                  {cities.length > 0 ? (
                    cities.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))
                  ) : (
                    <>
                      <option value="Manila">Manila</option>
                      <option value="Cebu">Cebu</option>
                      <option value="Davao">Davao</option>
                      <option value="Cagayan de Oro">Cagayan de Oro</option>
                      <option value="Makati">Makati</option>
                      <option value="Quezon City">Quezon City</option>
                    </>
                  )}
                </select>
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
              {loading ? 'Updating...' : 'Update Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
