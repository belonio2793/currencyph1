import { useState, useEffect } from 'react'
import { jobApplicationService } from '../lib/jobApplicationService'

export default function EmploymentHistorySection({ applicationId, onNext, onBack, loading, setLoading }) {
  const [employmentList, setEmploymentList] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  
  const [formData, setFormData] = useState({
    company_name: '',
    industry: '',
    company_location: '',
    company_size: 'medium',
    job_title: '',
    job_description: '',
    employment_type: 'full_time',
    start_date: '',
    end_date: '',
    currently_employed: false,
    salary_amount: '',
    salary_currency: 'PHP',
    key_responsibilities: '',
    achievements: '',
    reason_for_leaving: '',
    manager_name: '',
    manager_email: '',
    manager_phone: '',
    can_contact_manager: true,
    reference_person: '',
    reference_contact: ''
  })

  useEffect(() => {
    loadEmploymentHistory()
  }, [applicationId])

  const loadEmploymentHistory = async () => {
    try {
      const result = await jobApplicationService.getEmploymentHistory(applicationId)
      if (!result.error) {
        setEmploymentList(result.data)
      }
    } catch (err) {
      console.error('Error loading employment history:', err)
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
    
    if (!formData.company_name.trim() || !formData.job_title.trim() || !formData.start_date) {
      setError('Company name, job title, and start date are required')
      return
    }

    try {
      setLoading(true)
      setError('')

      let result
      if (editingId) {
        result = await jobApplicationService.updateEmploymentHistory(editingId, formData)
      } else {
        result = await jobApplicationService.addEmploymentHistory(applicationId, formData)
      }

      if (result.error) {
        setError(result.error.message || 'Failed to save employment history')
      } else {
        await loadEmploymentHistory()
        setFormData({
          company_name: '',
          industry: '',
          company_location: '',
          company_size: 'medium',
          job_title: '',
          job_description: '',
          employment_type: 'full_time',
          start_date: '',
          end_date: '',
          currently_employed: false,
          salary_amount: '',
          salary_currency: 'PHP',
          key_responsibilities: '',
          achievements: '',
          reason_for_leaving: '',
          manager_name: '',
          manager_email: '',
          manager_phone: '',
          can_contact_manager: true,
          reference_person: '',
          reference_contact: ''
        })
        setShowForm(false)
        setEditingId(null)
      }
    } catch (err) {
      console.error('Error saving employment history:', err)
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
    if (window.confirm('Are you sure you want to delete this employment record?')) {
      try {
        setLoading(true)
        const result = await jobApplicationService.deleteEmploymentHistory(id)
        if (!result.error) {
          await loadEmploymentHistory()
        } else {
          setError('Failed to delete employment history')
        }
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="form-section-main">
      <div className="section-header">
        <h2>Employment History</h2>
        <p>List your previous work experience</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')} className="close-error">×</button>
        </div>
      )}

      {employmentList.length > 0 && (
        <div className="items-list">
          {employmentList.map(item => (
            <div key={item.id} className="list-item">
              <div className="item-header">
                <h4>{item.job_title}</h4>
                <span className="company-name">{item.company_name}</span>
              </div>
              <div className="item-details">
                <p className="date-range">
                  {new Date(item.start_date).toLocaleDateString()} 
                  {item.currently_employed ? ' - Present' : ` - ${new Date(item.end_date).toLocaleDateString()}`}
                </p>
                {item.key_responsibilities && (
                  <p className="description">{item.key_responsibilities}</p>
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
          <h3>{editingId ? 'Edit Employment' : 'Add Employment'}</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Company Name *</label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleInputChange}
                placeholder="e.g., Acme Corporation"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Industry</label>
              <input
                type="text"
                name="industry"
                value={formData.industry}
                onChange={handleInputChange}
                placeholder="e.g., Technology, Finance"
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Job Title *</label>
              <input
                type="text"
                name="job_title"
                value={formData.job_title}
                onChange={handleInputChange}
                placeholder="e.g., Senior Developer"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Employment Type</label>
              <select name="employment_type" value={formData.employment_type} onChange={handleInputChange} disabled={loading}>
                <option value="full_time">Full-Time</option>
                <option value="part_time">Part-Time</option>
                <option value="contract">Contract</option>
                <option value="temporary">Temporary</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Company Location</label>
            <input
              type="text"
              name="company_location"
              value={formData.company_location}
              onChange={handleInputChange}
              placeholder="City, Country"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Company Size</label>
            <select name="company_size" value={formData.company_size} onChange={handleInputChange} disabled={loading}>
              <option value="small">Small (1-50)</option>
              <option value="medium">Medium (51-500)</option>
              <option value="large">Large (501-5000)</option>
              <option value="enterprise">Enterprise (5000+)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Job Description</label>
            <textarea
              name="job_description"
              value={formData.job_description}
              onChange={handleInputChange}
              placeholder="Describe the position and responsibilities"
              rows="3"
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
                disabled={formData.currently_employed || loading}
              />
            </div>
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              name="currently_employed"
              checked={formData.currently_employed}
              onChange={handleInputChange}
              disabled={loading}
            />
            <span>I currently work here</span>
          </label>

          <div className="form-row">
            <div className="form-group">
              <label>Salary</label>
              <input
                type="number"
                name="salary_amount"
                value={formData.salary_amount}
                onChange={handleInputChange}
                placeholder="Amount"
                min="0"
                step="0.01"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Currency</label>
              <select name="salary_currency" value={formData.salary_currency} onChange={handleInputChange} disabled={loading}>
                <option value="PHP">PHP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Key Responsibilities</label>
            <textarea
              name="key_responsibilities"
              value={formData.key_responsibilities}
              onChange={handleInputChange}
              placeholder="Main responsibilities in this role"
              rows="3"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Achievements</label>
            <textarea
              name="achievements"
              value={formData.achievements}
              onChange={handleInputChange}
              placeholder="Notable accomplishments and contributions"
              rows="3"
              disabled={loading}
            />
          </div>

          {!formData.currently_employed && (
            <div className="form-group">
              <label>Reason for Leaving</label>
              <textarea
                name="reason_for_leaving"
                value={formData.reason_for_leaving}
                onChange={handleInputChange}
                placeholder="Why did you leave this position?"
                rows="2"
                disabled={loading}
              />
            </div>
          )}

          <div className="form-divider">Manager Information (optional)</div>

          <div className="form-row">
            <div className="form-group">
              <label>Manager Name</label>
              <input
                type="text"
                name="manager_name"
                value={formData.manager_name}
                onChange={handleInputChange}
                placeholder="Full name"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Manager Email</label>
              <input
                type="email"
                name="manager_email"
                value={formData.manager_email}
                onChange={handleInputChange}
                placeholder="email@example.com"
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Manager Phone</label>
            <input
              type="tel"
              name="manager_phone"
              value={formData.manager_phone}
              onChange={handleInputChange}
              placeholder="Phone number"
              disabled={loading}
            />
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              name="can_contact_manager"
              checked={formData.can_contact_manager}
              onChange={handleInputChange}
              disabled={loading}
            />
            <span>Manager can be contacted as a reference</span>
          </label>

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
              {loading ? 'Saving...' : editingId ? 'Update' : 'Add Employment'}
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
          + Add Employment
        </button>
      )}

      <div className="form-actions">
        <button type="button" onClick={onBack} className="btn-back" disabled={loading}>
          Back
        </button>
        <button type="button" onClick={onNext} className="btn-next" disabled={loading}>
          Next: Education
        </button>
      </div>
    </div>
  )
}
