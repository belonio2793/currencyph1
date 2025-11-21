import { useState, useEffect } from 'react'
import { jobApplicationService } from '../lib/jobApplicationService'

export default function SkillsSection({ applicationId, onNext, onBack, loading, setLoading }) {
  const [skillsList, setSkillsList] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  
  const [formData, setFormData] = useState({
    skill_name: '',
    skill_category: 'technical',
    proficiency_level: 'intermediate',
    years_of_experience: '',
    description: ''
  })

  const skillCategories = [
    { value: 'technical', label: 'Technical Skills' },
    { value: 'soft_skill', label: 'Soft Skills' },
    { value: 'language', label: 'Languages' },
    { value: 'tool', label: 'Tools & Software' },
    { value: 'certification', label: 'Certification-based' }
  ]

  const proficiencyLevels = [
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
    { value: 'expert', label: 'Expert' },
    { value: 'fluent', label: 'Fluent (for languages)' }
  ]

  useEffect(() => {
    loadSkills()
  }, [applicationId])

  const loadSkills = async () => {
    try {
      const result = await jobApplicationService.getSkills(applicationId)
      if (!result.error) {
        setSkillsList(result.data)
      }
    } catch (err) {
      console.error('Error loading skills:', err)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.skill_name.trim()) {
      setError('Skill name is required')
      return
    }

    try {
      setLoading(true)
      setError('')

      let result
      if (editingId) {
        result = await jobApplicationService.updateSkill(editingId, formData)
      } else {
        result = await jobApplicationService.addSkill(applicationId, formData)
      }

      if (result.error) {
        setError(result.error.message || 'Failed to save skill')
      } else {
        await loadSkills()
        setFormData({
          skill_name: '',
          skill_category: 'technical',
          proficiency_level: 'intermediate',
          years_of_experience: '',
          description: ''
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
    if (window.confirm('Delete this skill?')) {
      try {
        setLoading(true)
        const result = await jobApplicationService.deleteSkill(id)
        if (!result.error) {
          await loadSkills()
        }
      } finally {
        setLoading(false)
      }
    }
  }

  const getProficiencyColor = (level) => {
    switch(level) {
      case 'beginner': return '#fbbf24'
      case 'intermediate': return '#60a5fa'
      case 'advanced': return '#10b981'
      case 'expert': return '#8b5cf6'
      case 'fluent': return '#8b5cf6'
      default: return '#6b7280'
    }
  }

  return (
    <div className="form-section-main">
      <div className="section-header">
        <h2>Skills & Expertise</h2>
        <p>List your professional skills and proficiency levels</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')} className="close-error">×</button>
        </div>
      )}

      {skillsList.length > 0 && (
        <div className="skills-grid">
          {skillsList.map(item => (
            <div key={item.id} className="skill-card">
              <div className="skill-header">
                <h4>{item.skill_name}</h4>
                <span 
                  className="proficiency-badge"
                  style={{ backgroundColor: getProficiencyColor(item.proficiency_level) }}
                >
                  {proficiencyLevels.find(p => p.value === item.proficiency_level)?.label || item.proficiency_level}
                </span>
              </div>
              <p className="skill-category">
                {skillCategories.find(c => c.value === item.skill_category)?.label || item.skill_category}
              </p>
              {item.years_of_experience && (
                <p className="skill-experience">
                  {item.years_of_experience} {item.years_of_experience == 1 ? 'year' : 'years'} experience
                </p>
              )}
              <div className="skill-actions">
                <button
                  type="button"
                  onClick={() => {
                    setFormData(item)
                    setEditingId(item.id)
                    setShowForm(true)
                  }}
                  className="btn-edit-small"
                  disabled={loading}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="btn-delete-small"
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
          <h3>{editingId ? 'Edit Skill' : 'Add Skill'}</h3>

          <div className="form-group">
            <label>Skill Name *</label>
            <input
              type="text"
              name="skill_name"
              value={formData.skill_name}
              onChange={handleInputChange}
              placeholder="e.g., JavaScript, Project Management, Leadership"
              disabled={loading}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select
                name="skill_category"
                value={formData.skill_category}
                onChange={handleInputChange}
                disabled={loading}
              >
                {skillCategories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Proficiency Level</label>
              <select
                name="proficiency_level"
                value={formData.proficiency_level}
                onChange={handleInputChange}
                disabled={loading}
              >
                {proficiencyLevels.map(level => (
                  <option key={level.value} value={level.value}>{level.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Years of Experience</label>
            <input
              type="number"
              name="years_of_experience"
              value={formData.years_of_experience}
              onChange={handleInputChange}
              placeholder="0"
              min="0"
              max="70"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Description (where/how acquired, examples)</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Examples: used in 5+ projects, completed online course, used in production systems..."
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
              {loading ? 'Saving...' : editingId ? 'Update' : 'Add Skill'}
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
          + Add Skill
        </button>
      )}

      <div className="form-actions">
        <button type="button" onClick={onBack} className="btn-back" disabled={loading}>
          Back
        </button>
        <button type="button" onClick={onNext} className="btn-next" disabled={loading}>
          Next: Interview Preferences
        </button>
      </div>
    </div>
  )
}
