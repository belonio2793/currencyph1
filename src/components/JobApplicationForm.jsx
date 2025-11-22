import { useState, useEffect } from 'react'
import { jobApplicationService } from '../lib/jobApplicationService'
import EmploymentHistorySection from './EmploymentHistorySection'
import EducationSection from './EducationSection'
import CertificationsSection from './CertificationsSection'
import SkillsSection from './SkillsSection'
import InterviewPreferencesSection from './InterviewPreferencesSection'
import ReferencesSection from './ReferencesSection'
import './JobApplicationForm.css'

export default function JobApplicationForm({ business, job, userId, onClose, onSubmitted }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [applicationId, setApplicationId] = useState(null)
  const [formStep, setFormStep] = useState('basic')
  const [activeTab, setActiveTab] = useState('application')

  const [basicInfo, setBasicInfo] = useState({
    position_applied_for: job?.job_title || '',
    salary_expectation: '',
    salary_currency: 'PHP',
    years_of_experience: '',
    notice_period_days: 0,
    available_start_date: '',
    work_authorized: false,
    visa_sponsorship_needed: false,
    cover_letter: '',
    employment_type: 'full_time',
    work_arrangement: 'on_site',
    willing_to_relocate: false,
    willing_to_travel: false
  })

  const [employment, setEmployment] = useState([])
  const [education, setEducation] = useState([])
  const [certifications, setCertifications] = useState([])
  const [skills, setSkills] = useState([])
  const [interviewPreferences, setInterviewPreferences] = useState({})
  const [references, setReferences] = useState([])

  const handleBasicInfoChange = (e) => {
    const { name, value, type, checked } = e.target
    setBasicInfo(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const validateBasicInfo = () => {
    if (!basicInfo.position_applied_for.trim()) {
      setError('Position is required')
      return false
    }
    if (basicInfo.years_of_experience === '' || basicInfo.years_of_experience < 0) {
      setError('Years of experience is required')
      return false
    }
    if (skills.length === 0) {
      setError('Please add at least one skill')
      return false
    }
    return true
  }

  const handleSubmitBasicInfo = async (e) => {
    e.preventDefault()
    if (!validateBasicInfo()) return

    try {
      setLoading(true)
      setError('')

      const result = await jobApplicationService.createApplication({
        job_id: job?.id,
        business_id: business.id,
        position_applied_for: basicInfo.position_applied_for,
        salary_expectation: basicInfo.salary_expectation ? parseFloat(basicInfo.salary_expectation) : null,
        salary_currency: basicInfo.salary_currency,
        years_of_experience: parseInt(basicInfo.years_of_experience),
        notice_period_days: parseInt(basicInfo.notice_period_days) || 0,
        available_start_date: basicInfo.available_start_date || null,
        work_authorized: basicInfo.work_authorized,
        visa_sponsorship_needed: basicInfo.visa_sponsorship_needed,
        cover_letter: basicInfo.cover_letter || null,
        employment_type: basicInfo.employment_type,
        work_arrangement: basicInfo.work_arrangement,
        willing_to_relocate: basicInfo.willing_to_relocate,
        willing_to_travel: basicInfo.willing_to_travel
      })

      if (result.error) {
        setError(result.error.message || 'Failed to create application')
      } else {
        setApplicationId(result.data.id)
        setFormStep('employment')
      }
    } catch (err) {
      console.error('Error creating application:', err)
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleFinalSubmit = async () => {
    try {
      setLoading(true)
      setError('')
      
      if (onSubmitted) {
        onSubmitted()
      }
    } catch (err) {
      console.error('Error in final submission:', err)
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const renderStep = () => {
    switch (formStep) {
      case 'basic':
        return (
          <form onSubmit={handleSubmitBasicInfo} className="form-section-main">
            <div>
              <h3 className="section-title">Your Information</h3>
              
              <div className="form-group">
                <label className="form-label">Years of Experience *</label>
                <input
                  type="number"
                  name="years_of_experience"
                  value={basicInfo.years_of_experience}
                  onChange={handleBasicInfoChange}
                  placeholder="0"
                  className="form-input"
                  min="0"
                  max="70"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Salary Expectation</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <input
                    type="number"
                    name="salary_expectation"
                    value={basicInfo.salary_expectation}
                    onChange={handleBasicInfoChange}
                    placeholder="Enter amount"
                    className="form-input"
                    min="0"
                    step="0.01"
                    disabled={loading}
                  />
                  <select
                    name="salary_currency"
                    value={basicInfo.salary_currency}
                    onChange={handleBasicInfoChange}
                    className="form-input"
                    disabled={loading}
                  >
                    <option value="PHP">PHP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Employment Type</label>
                <select
                  name="employment_type"
                  value={basicInfo.employment_type}
                  onChange={handleBasicInfoChange}
                  className="form-input"
                  disabled={loading}
                >
                  <option value="full_time">Full-Time</option>
                  <option value="part_time">Part-Time</option>
                  <option value="contract">Contract</option>
                  <option value="temporary">Temporary</option>
                  <option value="flexible">Flexible</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Work Arrangement</label>
                <select
                  name="work_arrangement"
                  value={basicInfo.work_arrangement}
                  onChange={handleBasicInfoChange}
                  className="form-input"
                  disabled={loading}
                >
                  <option value="on_site">On-Site</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Available Start Date</label>
                <input
                  type="date"
                  name="available_start_date"
                  value={basicInfo.available_start_date}
                  onChange={handleBasicInfoChange}
                  className="form-input"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Cover Letter</label>
                <textarea
                  name="cover_letter"
                  value={basicInfo.cover_letter}
                  onChange={handleBasicInfoChange}
                  placeholder="Tell us why you're interested in this position..."
                  className="form-textarea"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <h3 className="section-title">Preferences</h3>
              
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="work_authorized"
                    checked={basicInfo.work_authorized}
                    onChange={handleBasicInfoChange}
                    disabled={loading}
                  />
                  <span>I am authorized to work in this country</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="visa_sponsorship_needed"
                    checked={basicInfo.visa_sponsorship_needed}
                    onChange={handleBasicInfoChange}
                    disabled={loading}
                  />
                  <span>I require visa sponsorship</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="willing_to_relocate"
                    checked={basicInfo.willing_to_relocate}
                    onChange={handleBasicInfoChange}
                    disabled={loading}
                  />
                  <span>Willing to relocate</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="willing_to_travel"
                    checked={basicInfo.willing_to_travel}
                    onChange={handleBasicInfoChange}
                    disabled={loading}
                  />
                  <span>Willing to travel</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="notice_period_days"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setBasicInfo(prev => ({ ...prev, notice_period_days: 30 }))
                      }
                    }}
                    disabled={loading}
                  />
                  <span>Notice period: {basicInfo.notice_period_days} days</span>
                </label>
              </div>
            </div>
          </form>
        )

      case 'employment':
        return (
          <EmploymentHistorySection
            applicationId={applicationId}
            onNext={() => setFormStep('education')}
            onBack={() => setFormStep('basic')}
            loading={loading}
            setLoading={setLoading}
          />
        )

      case 'education':
        return (
          <EducationSection
            applicationId={applicationId}
            onNext={() => setFormStep('certifications')}
            onBack={() => setFormStep('employment')}
            loading={loading}
            setLoading={setLoading}
          />
        )

      case 'certifications':
        return (
          <CertificationsSection
            applicationId={applicationId}
            onNext={() => setFormStep('skills')}
            onBack={() => setFormStep('education')}
            loading={loading}
            setLoading={setLoading}
          />
        )

      case 'skills':
        return (
          <SkillsSection
            applicationId={applicationId}
            onNext={() => setFormStep('interview')}
            onBack={() => setFormStep('certifications')}
            loading={loading}
            setLoading={setLoading}
          />
        )

      case 'interview':
        return (
          <InterviewPreferencesSection
            applicationId={applicationId}
            onNext={() => setFormStep('references')}
            onBack={() => setFormStep('skills')}
            loading={loading}
            setLoading={setLoading}
          />
        )

      case 'references':
        return (
          <ReferencesSection
            applicationId={applicationId}
            onNext={() => setFormStep('review')}
            onBack={() => setFormStep('interview')}
            loading={loading}
            setLoading={setLoading}
          />
        )

      case 'review':
        return (
          <div className="form-section-main">
            <div>
              <h3 className="section-title">Review Application</h3>
              <p style={{ color: '#6b7280', fontSize: '0.95rem', lineHeight: '1.5' }}>
                Your application is ready to submit. Please review all information to ensure it's accurate and complete before submitting.
              </p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const getProgressPercentage = () => {
    const steps = ['basic', 'employment', 'education', 'certifications', 'skills', 'interview', 'references', 'review']
    const currentIndex = steps.indexOf(formStep)
    return ((currentIndex + 1) / steps.length) * 100
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content job-application-form" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-content">
            <h2>{job?.job_title || 'Apply for Position'}</h2>
            <p>{business?.business_name}</p>
            <div className="modal-header-meta">
              Step {getStepNumber(formStep)} of 8
            </div>
          </div>
          <button onClick={onClose} className="modal-close">×</button>
        </div>

        {error && (
          <div style={{ padding: '0 24px 12px 24px' }}>
            <div className="error-message">
              {error}
              <button onClick={() => setError('')} className="close-error">×</button>
            </div>
          </div>
        )}

        <div className="modal-body">
          {renderStep()}
        </div>

        <div className="form-actions">
          {formStep !== 'basic' && (
            <button
              type="button"
              onClick={() => {
                if (formStep === 'employment') setFormStep('basic')
                else if (formStep === 'education') setFormStep('employment')
                else if (formStep === 'certifications') setFormStep('education')
                else if (formStep === 'skills') setFormStep('certifications')
                else if (formStep === 'interview') setFormStep('skills')
                else if (formStep === 'references') setFormStep('interview')
                else if (formStep === 'review') setFormStep('references')
              }}
              className="btn-cancel"
              disabled={loading}
            >
              Back
            </button>
          )}
          {formStep !== 'basic' && formStep !== 'review' && (
            <button
              type="button"
              onClick={onClose}
              className="btn-cancel"
              disabled={loading}
            >
              Cancel
            </button>
          )}
          {formStep !== 'review' ? (
            <button
              type="button"
              onClick={formStep === 'basic' ? handleSubmitBasicInfo : () => {}}
              className="btn-next"
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Next'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalSubmit}
              className="btn-submit"
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function getStepNumber(step) {
  const steps = ['basic', 'employment', 'education', 'certifications', 'skills', 'interview', 'references', 'review']
  return steps.indexOf(step) + 1
}
