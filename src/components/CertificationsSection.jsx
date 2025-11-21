import { useState, useEffect } from 'react'
import { jobApplicationService } from '../lib/jobApplicationService'

export default function CertificationsSection({ applicationId, onNext, onBack, loading, setLoading }) {
  const [certList, setCertList] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  
  const [formData, setFormData] = useState({
    certification_name: '',
    issuing_organization: '',
    credential_id: '',
    credential_url: '',
    issue_date: '',
    expiration_date: '',
    does_not_expire: true,
    description: '',
    skill_covered: ''
  })

  useEffect(() => {
    loadCertifications()
  }, [applicationId])

  const loadCertifications = async () => {
    try {
      const result = await jobApplicationService.getCertifications(applicationId)
      if (!result.error) {
        setCertList(result.data)
      }
    } catch (err) {
      console.error('Error loading certifications:', err)
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
    
    if (!formData.certification_name.trim() || !formData.issuing_organization.trim() || !formData.issue_date) {
      setError('Certification name, organization, and issue date are required')
      return
    }

    try {
      setLoading(true)
      setError('')

      let result
      if (editingId) {
        result = await jobApplicationService.updateCertification(editingId, formData)
      } else {
        result = await jobApplicationService.addCertification(applicationId, formData)
      }

      if (result.error) {
        setError(result.error.message || 'Failed to save certification')
      } else {
        await loadCertifications()
        setFormData({
          certification_name: '',
          issuing_organization: '',
          credential_id: '',
          credential_url: '',
          issue_date: '',
          expiration_date: '',
          does_not_expire: true,
          description: '',
          skill_covered: ''
        })
        setShowForm(false)
        setEditingId(null)
      }
    } catch (err) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('Delete this certification?')) {
      try {
        setLoading(true)
        const result = await jobApplicationService.deleteCertification(id)
        if (!result.error) {
          await loadCertifications()
        }
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="form-section-main">
      <div className="section-header">
        <h2>Certifications & Licenses</h2>
        <p>Add any professional certifications or licenses</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')} className="close-error">×</button>
        </div>
      )}

      {certList.length > 0 && (
        <div className="items-list">
          {certList.map(item => (
            <div key={item.id} className="list-item">
              <div className="item-header">
                <h4>{item.certification_name}</h4>
                <span className="company-name">{item.issuing_organization}</span>
              </div>
              <div className="item-details">
                <p className="date-range">
                  Issued: {new Date(item.issue_date).toLocaleDateString()}
                  {item.expiration_date && !item.does_not_expire && ` - Expires: ${new Date(item.expiration_date).toLocaleDateString()}`}
                  {item.does_not_expire && ' - No Expiration'}
                </p>
              </div>
              <div className="item-actions">
                <button
                  type="button"
                  onClick={() => {
                    setFormData(item)
                    setEditingId(item.id)
                    setShowForm(true)
                  }}
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
          <h3>{editingId ? 'Edit Certification' : 'Add Certification'}</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Certification Name *</label>
              <input
                type="text"
                name="certification_name"
                value={formData.certification_name}
                onChange={handleInputChange}
                placeholder="e.g., AWS Solutions Architect"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Issuing Organization *</label>
              <input
                type="text"
                name="issuing_organization"
                value={formData.issuing_organization}
                onChange={handleInputChange}
                placeholder="e.g., Amazon Web Services"
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Issue Date *</label>
              <input
                type="date"
                name="issue_date"
                value={formData.issue_date}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Expiration Date</label>
              <input
                type="date"
                name="expiration_date"
                value={formData.expiration_date}
                onChange={handleInputChange}
                disabled={formData.does_not_expire || loading}
              />
            </div>
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              name="does_not_expire"
              checked={formData.does_not_expire}
              onChange={handleInputChange}
              disabled={loading}
            />
            <span>This certification does not expire</span>
          </label>

          <div className="form-row">
            <div className="form-group">
              <label>Credential ID</label>
              <input
                type="text"
                name="credential_id"
                value={formData.credential_id}
                onChange={handleInputChange}
                placeholder="Credential ID or License Number"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Credential URL</label>
              <input
                type="url"
                name="credential_url"
                value={formData.credential_url}
                onChange={handleInputChange}
                placeholder="https://..."
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Skill Covered</label>
            <input
              type="text"
              name="skill_covered"
              value={formData.skill_covered}
              onChange={handleInputChange}
              placeholder="Main skill this certification covers"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Details about this certification"
              rows="3"
              disabled={loading}
            />
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
              {loading ? 'Saving...' : editingId ? 'Update' : 'Add Certification'}
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
          + Add Certification
        </button>
      )}

      <div className="form-actions">
        <button type="button" onClick={onBack} className="btn-back" disabled={loading}>
          Back
        </button>
        <button type="button" onClick={onNext} className="btn-next" disabled={loading}>
          Next: Skills
        </button>
      </div>
    </div>
  )
}
