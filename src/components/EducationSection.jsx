import { useState, useEffect } from 'react'
import { jobApplicationService } from '../lib/jobApplicationService'

export default function EducationSection({ applicationId, onNext, onBack, loading, setLoading }) {
  const [educationList, setEducationList] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  
  const [formData, setFormData] = useState({
    institution_name: '',
    institution_type: 'university',
    degree_level: 'bachelor',
    field_of_study: '',
    specialization: '',
    start_date: '',
    end_date: '',
    currently_studying: false,
    grade_average: '',
    grade_scale: '4.0',
    activities_societies: '',
    description: '',
    diploma_url: '',
    transcript_url: ''
  })

  useEffect(() => {
    loadEducation()
  }, [applicationId])

  const loadEducation = async () => {
    try {
      const result = await jobApplicationService.getEducation(applicationId)
      if (!result.error) {
        setEducationList(result.data)
      }
    } catch (err) {
      console.error('Error loading education:', err)
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.institution_name.trim() || !formData.field_of_study.trim() || !formData.start_date) {
      setError('Institution name, field of study, and start date are required')
      return
    }

    try {
      setLoading(true)
      setError('')

      let result
      if (editingId) {
        result = await jobApplicationService.updateEducation(editingId, formData)
      } else {
        result = await jobApplicationService.addEducation(applicationId, formData)
      }

      if (result.error) {
        setError(result.error.message || 'Failed to save education')
      } else {
        await loadEducation()
        setFormData({
          institution_name: '',
          institution_type: 'university',
          degree_level: 'bachelor',
          field_of_study: '',
          specialization: '',
          start_date: '',
          end_date: '',
          currently_studying: false,
          grade_average: '',
          grade_scale: '4.0',
          activities_societies: '',
          description: '',
          diploma_url: '',
          transcript_url: ''
        })
        setShowForm(false)
        setEditingId(null)
      }
    } catch (err) {
      console.error('Error saving education:', err)
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (item) => {
    setFormData(item)
    setEditingId(item.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this education record?')) {
      try {
        setLoading(true)
        const result = await jobApplicationService.deleteEducation(id)
        if (!result.error) {
          await loadEducation()
        } else {
          setError('Failed to delete education')
        }
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="form-section-main">
      <div className="section-header">
        <h2>Education</h2>
        <p>List your educational qualifications and degrees</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')} className="close-error">×</button>
        </div>
      )}

      {educationList.length > 0 && (
        <div className="items-list">
          {educationList.map(item => (
            <div key={item.id} className="list-item">
              <div className="item-header">
                <h4>{item.degree_level.charAt(0).toUpperCase() + item.degree_level.slice(1)} in {item.field_of_study}</h4>
                <span className="company-name">{item.institution_name}</span>
              </div>
              <div className="item-details">
                <p className="date-range">
                  {new Date(item.start_date).toLocaleDateString()}
                  {item.currently_studying ? ' - Present' : ` - ${new Date(item.end_date).toLocaleDateString()}`}
                </p>
                {item.grade_average && (
                  <p className="description">GPA: {item.grade_average} / {item.grade_scale}</p>
                )}
              </div>
              <div className="item-actions">
                <button
                  type="button"
                  onClick={() => handleEdit(item)}
                  className="btn-edit"
                  disabled={loading}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="btn-delete"
                  disabled={loading}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="form-card">
          <h3>{editingId ? 'Edit Education' : 'Add Education'}</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Institution Name *</label>
              <input
                type="text"
                name="institution_name"
                value={formData.institution_name}
                onChange={handleInputChange}
                placeholder="e.g., University of Manila"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Institution Type</label>
              <select name="institution_type" value={formData.institution_type} onChange={handleInputChange} disabled={loading}>
                <option value="university">University</option>
                <option value="college">College</option>
                <option value="vocational">Vocational School</option>
                <option value="high_school">High School</option>
                <option value="online">Online</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Degree Level *</label>
              <select name="degree_level" value={formData.degree_level} onChange={handleInputChange} disabled={loading}>
                <option value="high_school">High School</option>
                <option value="diploma">Diploma</option>
                <option value="bachelor">Bachelor's Degree</option>
                <option value="master">Master's Degree</option>
                <option value="phd">PhD</option>
                <option value="postdoc">Postdoctoral</option>
              </select>
            </div>
            <div className="form-group">
              <label>Field of Study *</label>
              <input
                type="text"
                name="field_of_study"
                value={formData.field_of_study}
                onChange={handleInputChange}
                placeholder="e.g., Computer Science"
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Specialization (optional)</label>
            <input
              type="text"
              name="specialization"
              value={formData.specialization}
              onChange={handleInputChange}
              placeholder="e.g., Artificial Intelligence"
              disabled={loading}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Date *</label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleInputChange}
                disabled={formData.currently_studying || loading}
              />
            </div>
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              name="currently_studying"
              checked={formData.currently_studying}
              onChange={handleInputChange}
              disabled={loading}
            />
            <span>I currently study here</span>
          </label>

          <div className="form-row">
            <div className="form-group">
              <label>Grade/GPA (optional)</label>
              <input
                type="number"
                name="grade_average"
                value={formData.grade_average}
                onChange={handleInputChange}
                placeholder="e.g., 3.8"
                min="0"
                step="0.01"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Grade Scale</label>
              <select name="grade_scale" value={formData.grade_scale} onChange={handleInputChange} disabled={loading}>
                <option value="4.0">4.0</option>
                <option value="5.0">5.0</option>
                <option value="100">100</option>
                <option value="A-F">A-F</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Activities & Societies</label>
            <textarea
              name="activities_societies"
              value={formData.activities_societies}
              onChange={handleInputChange}
              placeholder="Clubs, honor societies, leadership roles, etc."
              rows="2"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Description (Coursework, Thesis, etc.)</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Relevant coursework, thesis topic, key projects"
              rows="3"
              disabled={loading}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Diploma/Certificate URL</label>
              <input
                type="url"
                name="diploma_url"
                value={formData.diploma_url}
                onChange={handleInputChange}
                placeholder="https://..."
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Transcript URL</label>
              <input
                type="url"
                name="transcript_url"
                value={formData.transcript_url}
                onChange={handleInputChange}
                placeholder="https://..."
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
              }}
              className="btn-cancel"
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Saving...' : editingId ? 'Update' : 'Add Education'}
            </button>
          </div>
        </form>
      )}

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="btn-add-item"
          disabled={loading}
        >
          + Add Education
        </button>
      )}

      <div className="form-actions">
        <button type="button" onClick={onBack} className="btn-back" disabled={loading}>
          Back
        </button>
        <button type="button" onClick={onNext} className="btn-next" disabled={loading}>
          Next: Certifications
        </button>
      </div>
    </div>
  )
}
