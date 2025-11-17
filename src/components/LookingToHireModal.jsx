import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import './PostJobModal.css'

export default function LookingToHireModal({ onClose, userId }) {
  const [activeTab, setActiveTab] = useState('profile')
  const [formData, setFormData] = useState({
    full_name: '',
    about_me: '',
    headline: '',
    phone: '',
    location: '',
    profile_photo_url: '',
    portfolio_images: [],
    skills: [],
    experience: [],
    certifications: [],
    education: [],
    hourly_rate_min: '',
    hourly_rate_max: '',
    availability: 'open',
    preferred_job_types: [],
    industries_interested: [],
    is_public: true,
    save_to_profile: true
  })

  const [skillInput, setSkillInput] = useState('')
  const [experienceForm, setExperienceForm] = useState({
    job_title: '',
    company: '',
    start_date: '',
    end_date: '',
    is_current: false,
    description: ''
  })

  const [certificationForm, setCertificationForm] = useState({
    name: '',
    issuer: '',
    issue_date: '',
    expiry_date: '',
    credential_url: ''
  })

  const [educationForm, setEducationForm] = useState({
    school: '',
    degree: '',
    field_of_study: '',
    graduation_date: '',
    description: ''
  })

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false)

  const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Temporary', 'One-time Project']
  const INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'Education', 'Retail', 'Manufacturing', 'Construction', 'Hospitality', 'Marketing', 'Engineering', 'Design', 'Other']
  const AVAILABILITY = [
    { value: 'immediately', label: 'Available Immediately' },
    { value: 'two_weeks', label: 'Available in 2 Weeks' },
    { value: 'one_month', label: 'Available in 1 Month' },
    { value: 'open', label: 'Open to Opportunities' }
  ]

  const handleAddSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({
        ...formData,
        skills: [...formData.skills, skillInput.trim()]
      })
      setSkillInput('')
    }
  }

  const handleRemoveSkill = (index) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter((_, i) => i !== index)
    })
  }

  const handleAddExperience = () => {
    if (!experienceForm.job_title.trim() || !experienceForm.company.trim()) {
      setError('Job title and company are required')
      return
    }

    const newExperience = {
      id: Date.now(),
      ...experienceForm,
      start_date: experienceForm.start_date || null,
      end_date: experienceForm.is_current ? null : experienceForm.end_date
    }

    setFormData({
      ...formData,
      experience: [...formData.experience, newExperience]
    })

    setExperienceForm({
      job_title: '',
      company: '',
      start_date: '',
      end_date: '',
      is_current: false,
      description: ''
    })
    setError('')
  }

  const handleRemoveExperience = (id) => {
    setFormData({
      ...formData,
      experience: formData.experience.filter(exp => exp.id !== id)
    })
  }

  const handleAddCertification = () => {
    if (!certificationForm.name.trim()) {
      setError('Certification name is required')
      return
    }

    const newCert = {
      id: Date.now(),
      ...certificationForm,
      issue_date: certificationForm.issue_date || null,
      expiry_date: certificationForm.expiry_date || null
    }

    setFormData({
      ...formData,
      certifications: [...formData.certifications, newCert]
    })

    setCertificationForm({
      name: '',
      issuer: '',
      issue_date: '',
      expiry_date: '',
      credential_url: ''
    })
    setError('')
  }

  const handleRemoveCertification = (id) => {
    setFormData({
      ...formData,
      certifications: formData.certifications.filter(cert => cert.id !== id)
    })
  }

  const handleAddEducation = () => {
    if (!educationForm.school.trim() || !educationForm.degree.trim()) {
      setError('School and degree are required')
      return
    }

    const newEducation = {
      id: Date.now(),
      ...educationForm,
      graduation_date: educationForm.graduation_date || null
    }

    setFormData({
      ...formData,
      education: [...formData.education, newEducation]
    })

    setEducationForm({
      school: '',
      degree: '',
      field_of_study: '',
      graduation_date: '',
      description: ''
    })
    setError('')
  }

  const handleRemoveEducation = (id) => {
    setFormData({
      ...formData,
      education: formData.education.filter(edu => edu.id !== id)
    })
  }

  const handleProfilePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingPhoto(true)
    try {
      const fileName = `${userId}/profile-${Date.now()}.${file.name.split('.').pop()}`
      const { data, error } = await supabase.storage
        .from('user-profiles')
        .upload(fileName, file)

      if (error) throw error

      const { data: publicUrl } = supabase.storage
        .from('user-profiles')
        .getPublicUrl(fileName)

      setFormData({
        ...formData,
        profile_photo_url: publicUrl.publicUrl
      })
    } catch (err) {
      setError('Error uploading photo: ' + err.message)
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handlePortfolioUpload = async (e) => {
    const files = e.target.files
    if (!files) return

    setUploadingPortfolio(true)
    try {
      const uploadedUrls = []

      for (const file of files) {
        const fileName = `${userId}/portfolio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${file.name.split('.').pop()}`
        const { data, error } = await supabase.storage
          .from('user-profiles')
          .upload(fileName, file)

        if (error) throw error

        const { data: publicUrl } = supabase.storage
          .from('user-profiles')
          .getPublicUrl(fileName)

        uploadedUrls.push(publicUrl.publicUrl)
      }

      setFormData({
        ...formData,
        portfolio_images: [...formData.portfolio_images, ...uploadedUrls]
      })
    } catch (err) {
      setError('Error uploading portfolio images: ' + err.message)
    } finally {
      setUploadingPortfolio(false)
    }
  }

  const handleRemovePortfolioImage = (url) => {
    setFormData({
      ...formData,
      portfolio_images: formData.portfolio_images.filter(img => img !== url)
    })
  }

  const handleToggleJobType = (jobType) => {
    setFormData({
      ...formData,
      preferred_job_types: formData.preferred_job_types.includes(jobType)
        ? formData.preferred_job_types.filter(t => t !== jobType)
        : [...formData.preferred_job_types, jobType]
    })
  }

  const handleToggleIndustry = (industry) => {
    setFormData({
      ...formData,
      industries_interested: formData.industries_interested.includes(industry)
        ? formData.industries_interested.filter(i => i !== industry)
        : [...formData.industries_interested, industry]
    })
  }

  const validateForm = () => {
    if (!formData.full_name.trim()) {
      setError('Full name is required')
      return false
    }
    if (!formData.about_me.trim()) {
      setError('About me section is required')
      return false
    }
    if (formData.skills.length === 0) {
      setError('Please add at least one skill')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    try {
      if (formData.save_to_profile) {
        const profileData = {
          user_id: userId,
          full_name: formData.full_name,
          about_me: formData.about_me,
          headline: formData.headline,
          phone: formData.phone,
          location: formData.location,
          profile_photo_url: formData.profile_photo_url,
          portfolio_images: formData.portfolio_images,
          skills: formData.skills,
          experience: formData.experience,
          certifications: formData.certifications,
          education: formData.education,
          hourly_rate_min: formData.hourly_rate_min ? parseInt(formData.hourly_rate_min) : null,
          hourly_rate_max: formData.hourly_rate_max ? parseInt(formData.hourly_rate_max) : null,
          availability: formData.availability,
          preferred_job_types: formData.preferred_job_types,
          industries_interested: formData.industries_interested,
          is_public: formData.is_public,
          profile_visibility: formData.is_public ? 'public' : 'private'
        }

        const { error } = await supabase
          .from('job_seeker_profiles')
          .upsert([profileData], { onConflict: 'user_id' })

        if (error) throw error
      }

      setError('')
      onClose()
    } catch (err) {
      setError('Error saving profile: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="post-job-modal" style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Looking For Work - Build Your Profile</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError('')} className="close-error">×</button>
          </div>
        )}

        {/* Tabs */}
        <div className="modal-tabs" style={{ borderBottom: '2px solid #e0e0e0', display: 'flex', gap: 0, paddingLeft: '24px' }}>
          {['profile', 'experience', 'skills', 'portfolio'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 20px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: activeTab === tab ? '600' : '500',
                color: activeTab === tab ? '#667eea' : '#666',
                borderBottom: activeTab === tab ? '3px solid #667eea' : 'none',
                marginBottom: '-2px',
                fontSize: '0.95rem',
                textTransform: 'capitalize'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="post-job-form">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="form-section">
              <h3>About You</h3>

              {/* Profile Photo */}
              <div className="form-group">
                <label>Profile Photo</label>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                  {formData.profile_photo_url && (
                    <img
                      src={formData.profile_photo_url}
                      alt="Profile"
                      style={{ width: '100px', height: '100px', borderRadius: '8px', objectFit: 'cover' }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePhotoUpload}
                      disabled={uploadingPhoto}
                      style={{ display: 'block', marginBottom: '8px' }}
                    />
                    <small style={{ color: '#666' }}>
                      {uploadingPhoto ? 'Uploading...' : 'JPG, PNG up to 5MB. This will be visible on your public profile.'}
                    </small>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="full_name">Full Name *</label>
                <input
                  id="full_name"
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Your full name"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="headline">Professional Headline</label>
                <input
                  id="headline"
                  type="text"
                  value={formData.headline}
                  onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                  placeholder="e.g., Full-Stack Developer | React & Node.js Expert"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+63 9XX XXX XXXX"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="location">Location</label>
                  <input
                    id="location"
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="City, Country"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="about_me">About Me *</label>
                <textarea
                  id="about_me"
                  value={formData.about_me}
                  onChange={(e) => setFormData({ ...formData, about_me: e.target.value })}
                  placeholder="Tell employers about yourself, your background, what you're passionate about, and what you're looking for in your next role..."
                  rows="6"
                  required
                />
              </div>

              <h3 style={{ marginTop: '24px' }}>Work Preferences</h3>

              <div className="form-group">
                <label>Preferred Job Types</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {JOB_TYPES.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleToggleJobType(type)}
                      style={{
                        padding: '8px 16px',
                        border: formData.preferred_job_types.includes(type) ? '2px solid #667eea' : '1px solid #e0e0e0',
                        background: formData.preferred_job_types.includes(type) ? '#f0f4ff' : '#f9f9f9',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: formData.preferred_job_types.includes(type) ? '600' : '500',
                        color: formData.preferred_job_types.includes(type) ? '#667eea' : '#666'
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Industries Interested In</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {INDUSTRIES.map(industry => (
                    <button
                      key={industry}
                      type="button"
                      onClick={() => handleToggleIndustry(industry)}
                      style={{
                        padding: '8px 16px',
                        border: formData.industries_interested.includes(industry) ? '2px solid #667eea' : '1px solid #e0e0e0',
                        background: formData.industries_interested.includes(industry) ? '#f0f4ff' : '#f9f9f9',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: formData.industries_interested.includes(industry) ? '600' : '500',
                        color: formData.industries_interested.includes(industry) ? '#667eea' : '#666'
                      }}
                    >
                      {industry}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="availability">Availability</label>
                  <select
                    id="availability"
                    value={formData.availability}
                    onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
                  >
                    {AVAILABILITY.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Hourly Rate (PHP)</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="number"
                      value={formData.hourly_rate_min}
                      onChange={(e) => setFormData({ ...formData, hourly_rate_min: e.target.value })}
                      placeholder="Min"
                      style={{ flex: 1 }}
                    />
                    <span style={{ color: '#666' }}>to</span>
                    <input
                      type="number"
                      value={formData.hourly_rate_max}
                      onChange={(e) => setFormData({ ...formData, hourly_rate_max: e.target.value })}
                      placeholder="Max"
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_public}
                    onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                  />
                  <span>Make my profile public so employers can find me</span>
                </label>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.save_to_profile}
                    onChange={(e) => setFormData({ ...formData, save_to_profile: e.target.checked })}
                  />
                  <span>Save this profile for future use</span>
                </label>
              </div>
            </div>
          )}

          {/* Experience Tab */}
          {activeTab === 'experience' && (
            <div className="form-section">
              <h3>Work Experience</h3>

              {formData.experience.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  {formData.experience.map(exp => (
                    <div key={exp.id} style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '6px', marginBottom: '12px', borderLeft: '4px solid #667eea' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: '0 0 4px 0', color: '#1a1a1a' }}>{exp.job_title}</h4>
                          <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '0.9rem' }}>{exp.company}</p>
                          <p style={{ margin: '0 0 8px 0', color: '#999', fontSize: '0.85rem' }}>
                            {exp.start_date} {!exp.is_current && exp.end_date ? `- ${exp.end_date}` : exp.is_current ? '- Present' : ''}
                          </p>
                          {exp.description && <p style={{ margin: '0', color: '#555', fontSize: '0.9rem' }}>{exp.description}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveExperience(exp.id)}
                          style={{
                            background: '#fee',
                            border: 'none',
                            color: '#c33',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '0.85rem'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ backgroundColor: '#f0f4ff', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 15px 0', color: '#667eea' }}>Add Experience</h4>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="job_title">Job Title *</label>
                    <input
                      id="job_title"
                      type="text"
                      value={experienceForm.job_title}
                      onChange={(e) => setExperienceForm({ ...experienceForm, job_title: e.target.value })}
                      placeholder="e.g., Senior Developer"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="company">Company *</label>
                    <input
                      id="company"
                      type="text"
                      value={experienceForm.company}
                      onChange={(e) => setExperienceForm({ ...experienceForm, company: e.target.value })}
                      placeholder="e.g., Google"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="start_date">Start Date</label>
                    <input
                      id="start_date"
                      type="date"
                      value={experienceForm.start_date}
                      onChange={(e) => setExperienceForm({ ...experienceForm, start_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="end_date">End Date</label>
                    <input
                      id="end_date"
                      type="date"
                      value={experienceForm.end_date}
                      onChange={(e) => setExperienceForm({ ...experienceForm, end_date: e.target.value })}
                      disabled={experienceForm.is_current}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={experienceForm.is_current}
                      onChange={(e) => setExperienceForm({ ...experienceForm, is_current: e.target.checked })}
                    />
                    <span>I currently work here</span>
                  </label>
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    value={experienceForm.description}
                    onChange={(e) => setExperienceForm({ ...experienceForm, description: e.target.value })}
                    placeholder="Describe your responsibilities and achievements..."
                    rows="3"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddExperience}
                  className="btn-add-skill"
                  style={{ width: '100%', marginTop: '12px' }}
                >
                  + Add Experience
                </button>
              </div>
            </div>
          )}

          {/* Skills Tab */}
          {activeTab === 'skills' && (
            <div className="form-section">
              <h3>Skills & Certifications</h3>

              {/* Skills Section */}
              <div style={{ marginBottom: '30px' }}>
                <h4 style={{ marginBottom: '12px', color: '#667eea' }}>Skills</h4>

                {formData.skills.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '15px' }}>
                    {formData.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        style={{
                          backgroundColor: '#e8eaf6',
                          color: '#667eea',
                          padding: '8px 12px',
                          borderRadius: '16px',
                          fontSize: '0.9rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#667eea',
                            cursor: 'pointer',
                            fontSize: '1.2rem',
                            padding: '0',
                            lineHeight: '1'
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                    placeholder="e.g., JavaScript, Project Management, Sales"
                  />
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="btn-add-skill"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Education Section */}
              <div style={{ marginBottom: '30px' }}>
                <h4 style={{ marginBottom: '12px', color: '#667eea' }}>Education</h4>

                {formData.education.length > 0 && (
                  <div style={{ marginBottom: '15px' }}>
                    {formData.education.map(edu => (
                      <div key={edu.id} style={{ backgroundColor: '#f9f9f9', padding: '12px', borderRadius: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#1a1a1a' }}>{edu.degree} in {edu.field_of_study}</p>
                          <p style={{ margin: '0 0 4px 0', color: '#666', fontSize: '0.9rem' }}>{edu.school}</p>
                          {edu.graduation_date && <p style={{ margin: '0', color: '#999', fontSize: '0.85rem' }}>Graduated: {edu.graduation_date}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveEducation(edu.id)}
                          style={{
                            background: '#fee',
                            border: 'none',
                            color: '#c33',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '0.85rem'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ backgroundColor: '#f0f4ff', padding: '12px', borderRadius: '6px', marginBottom: '15px' }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="school">School/University *</label>
                      <input
                        id="school"
                        type="text"
                        value={educationForm.school}
                        onChange={(e) => setEducationForm({ ...educationForm, school: e.target.value })}
                        placeholder="e.g., University of the Philippines"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="degree">Degree *</label>
                      <input
                        id="degree"
                        type="text"
                        value={educationForm.degree}
                        onChange={(e) => setEducationForm({ ...educationForm, degree: e.target.value })}
                        placeholder="e.g., Bachelor of Science"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="field_of_study">Field of Study</label>
                      <input
                        id="field_of_study"
                        type="text"
                        value={educationForm.field_of_study}
                        onChange={(e) => setEducationForm({ ...educationForm, field_of_study: e.target.value })}
                        placeholder="e.g., Computer Science"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="graduation_date">Graduation Date</label>
                      <input
                        id="graduation_date"
                        type="date"
                        value={educationForm.graduation_date}
                        onChange={(e) => setEducationForm({ ...educationForm, graduation_date: e.target.value })}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddEducation}
                    className="btn-add-skill"
                    style={{ width: '100%' }}
                  >
                    + Add Education
                  </button>
                </div>
              </div>

              {/* Certifications Section */}
              <div>
                <h4 style={{ marginBottom: '12px', color: '#667eea' }}>Certifications & Credentials</h4>

                {formData.certifications.length > 0 && (
                  <div style={{ marginBottom: '15px' }}>
                    {formData.certifications.map(cert => (
                      <div key={cert.id} style={{ backgroundColor: '#f9f9f9', padding: '12px', borderRadius: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#1a1a1a' }}>{cert.name}</p>
                          <p style={{ margin: '0 0 4px 0', color: '#666', fontSize: '0.9rem' }}>{cert.issuer}</p>
                          {cert.issue_date && <p style={{ margin: '0', color: '#999', fontSize: '0.85rem' }}>Issued: {cert.issue_date}</p>}
                          {cert.credential_url && <a href={cert.credential_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', color: '#667eea' }}>View Credential →</a>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCertification(cert.id)}
                          style={{
                            background: '#fee',
                            border: 'none',
                            color: '#c33',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '0.85rem'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ backgroundColor: '#f0f4ff', padding: '12px', borderRadius: '6px' }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="cert_name">Certification Name *</label>
                      <input
                        id="cert_name"
                        type="text"
                        value={certificationForm.name}
                        onChange={(e) => setCertificationForm({ ...certificationForm, name: e.target.value })}
                        placeholder="e.g., AWS Solutions Architect"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="issuer">Issuer</label>
                      <input
                        id="issuer"
                        type="text"
                        value={certificationForm.issuer}
                        onChange={(e) => setCertificationForm({ ...certificationForm, issuer: e.target.value })}
                        placeholder="e.g., Amazon Web Services"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="issue_date">Issue Date</label>
                      <input
                        id="issue_date"
                        type="date"
                        value={certificationForm.issue_date}
                        onChange={(e) => setCertificationForm({ ...certificationForm, issue_date: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="expiry_date">Expiry Date (if any)</label>
                      <input
                        id="expiry_date"
                        type="date"
                        value={certificationForm.expiry_date}
                        onChange={(e) => setCertificationForm({ ...certificationForm, expiry_date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="credential_url">Credential URL</label>
                    <input
                      id="credential_url"
                      type="url"
                      value={certificationForm.credential_url}
                      onChange={(e) => setCertificationForm({ ...certificationForm, credential_url: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddCertification}
                    className="btn-add-skill"
                    style={{ width: '100%' }}
                  >
                    + Add Certification
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Portfolio Tab */}
          {activeTab === 'portfolio' && (
            <div className="form-section">
              <h3>Portfolio & Work Samples</h3>

              <p style={{ color: '#666', marginBottom: '15px' }}>
                Upload images of your work, projects, or portfolio pieces. This helps employers see what you can do.
              </p>

              {formData.portfolio_images.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ marginBottom: '12px', color: '#667eea' }}>Uploaded Images ({formData.portfolio_images.length})</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                    {formData.portfolio_images.map((url, idx) => (
                      <div key={idx} style={{ position: 'relative' }}>
                        <img
                          src={url}
                          alt={`Portfolio ${idx + 1}`}
                          style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '6px' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePortfolioImage(url)}
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            background: '#c33',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '28px',
                            height: '28px',
                            cursor: 'pointer',
                            fontSize: '1.2rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ backgroundColor: '#f0f4ff', padding: '20px', borderRadius: '6px', border: '2px dashed #667eea', textAlign: 'center' }}>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePortfolioUpload}
                  disabled={uploadingPortfolio}
                  style={{ display: 'none' }}
                  id="portfolio-upload"
                />
                <label htmlFor="portfolio-upload" style={{ cursor: uploadingPortfolio ? 'not-allowed' : 'pointer' }}>
                  <p style={{ margin: '0 0 10px 0', color: '#667eea', fontWeight: '600', fontSize: '1rem' }}>
                    {uploadingPortfolio ? 'Uploading...' : '+ Click or Drag to Upload Images'}
                  </p>
                  <p style={{ margin: '0', color: '#666', fontSize: '0.85rem' }}>
                    JPG, PNG up to 5MB each. You can upload up to 20 images.
                  </p>
                </label>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end', paddingTop: '24px', borderTop: '1px solid #e0e0e0' }}>
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-submit">
              {loading ? 'Saving Profile...' : 'Save My Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
