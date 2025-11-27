import { useState, useEffect } from 'react'
import { jobApplicationService } from '../lib/jobApplicationService'

export default function ReferencesSection({ applicationId, onNext, onBack, loading, setLoading }) {
  const [referencesList, setReferencesList] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  
  const [formData, setFormData] = useState({
    reference_name: '',
    reference_title: '',
    reference_company: '',
    reference_email: '',
    reference_phone: '',
    relationship_type: 'manager',
    years_known: '',
    known_since_date: '',
    can_be_contacted: true,
    contact_permission_date: ''
  })

  const relationshipTypes = [
    { value: 'manager', label: 'Manager/Supervisor' },
    { value: 'colleague', label: 'Colleague' },
    { value: 'professor', label: 'Professor/Instructor' },
    { value: 'mentor', label: 'Mentor' },
    { value: 'client', label: 'Client' }
  ]

  useEffect(() => {
    loadReferences()
  }, [applicationId])

  const loadReferences = async () => {
    try {
      const result = await jobApplicationService.getReferences(applicationId)
      if (!result.error) {
        setReferencesList(result.data)
      }
    } catch (err) {
      console.error('Error loading references:', err)
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
    
    if (!formData.reference_name.trim() || !formData.reference_email.trim()) {
      setError('Reference name and email are required')
      return
    }

    try {
      setLoading(true)
      setError('')

      let result
      if (editingId) {
        result = await jobApplicationService.updateReference(editingId, formData)
      } else {
        result = await jobApplicationService.addReference(applicationId, formData)
      }

      if (result.error) {
        setError(result.error.message || 'Failed to save reference')
      } else {
        await loadReferences()
        setFormData({
          reference_name: '',
          reference_title: '',
          reference_company: '',
          reference_email: '',
          reference_phone: '',
          relationship_type: 'manager',
          years_known: '',
          known_since_date: '',
          can_be_contacted: true,
          contact_permission_date: ''
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
    if (window.confirm('Delete this reference?')) {
      try {
        setLoading(true)
        const result = await jobApplicationService.deleteReference(id)
        if (!result.error) {
          await loadReferences()
        }
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="form-section-main">
      <div className="section-header">
        <h2>Professional References</h2>
        <p>Provide references who can vouch for your work experience and skills (optional but recommended)</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')} className="close-error">×</button>
        </div>
      )}

      {referencesList.length > 0 && (
        <div className="items-list">
          {referencesList.map(item => (
            <div key={item.id} className="list-item">
              <div className="item-header">
                <h4>{item.reference_name}</h4>
                <span className="company-name">
                  {item.reference_title} {item.reference_company && `@ ${item.reference_company}`}
                </span>
              </div>
              <div className="item-details">
                <p>{item.reference_email}</p>
                {item.reference_phone && <p>{item.reference_phone}</p>}
                <p className="relationship">
                  {relationshipTypes.find(r => r.value === item.relationship_type)?.label}
                  {item.years_known && ` • ${item.years_known} ${item.years_known == 1 ? 'year' : 'years'}`}
                </p>
                {!item.can_be_contacted && (
                  <p className="warning">[Warning] Permission not granted to contact</p>
                )}
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
          <h3>{editingId ? 'Edit Reference' : 'Add Reference'}</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Reference Name *</label>
              <input
                type="text"
                name="reference_name"
                value={formData.reference_name}
                onChange={handleInputChange}
                placeholder="Full name"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Relationship Type</label>
              <select
                name="relationship_type"
                value={formData.relationship_type}
                onChange={handleInputChange}
                disabled={loading}
              >
                {relationshipTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Title/Position</label>
              <input
                type="text"
                name="reference_title"
                value={formData.reference_title}
                onChange={handleInputChange}
                placeholder="e.g., Senior Manager"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Company</label>
              <input
                type="text"
                name="reference_company"
                value={formData.reference_company}
                onChange={handleInputChange}
                placeholder="Company name"
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                name="reference_email"
                value={formData.reference_email}
                onChange={handleInputChange}
                placeholder="email@example.com"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                name="reference_phone"
                value={formData.reference_phone}
                onChange={handleInputChange}
                placeholder="Phone number"
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Years Known</label>
              <input
                type="number"
                name="years_known"
                value={formData.years_known}
                onChange={handleInputChange}
                placeholder="0"
                min="0"
                max="70"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Known Since</label>
              <input
                type="date"
                name="known_since_date"
                value={formData.known_since_date}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              name="can_be_contacted"
              checked={formData.can_be_contacted}
              onChange={handleInputChange}
              disabled={loading}
            />
            <span>Permission granted to contact this reference</span>
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
              {loading ? 'Saving...' : editingId ? 'Update' : 'Add Reference'}
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
          + Add Reference
        </button>
      )}

      <div className="form-actions">
        <button type="button" onClick={onBack} className="btn-back" disabled={loading}>
          Back
        </button>
        <button type="button" onClick={onNext} className="btn-next" disabled={loading}>
          Next: Review Application
        </button>
      </div>
    </div>
  )
}
