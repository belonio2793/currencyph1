import { useState } from 'react'

export default function InterviewPreferencesSection({ applicationId, onNext, onBack, loading, setLoading }) {
  const [preferences, setPreferences] = useState({
    preferred_interview_type: 'video',
    availability_notes: '',
    preferred_interview_dates: ''
  })

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setPreferences(prev => ({
      ...prev,
      [name]: value
    }))
  }

  return (
    <div className="form-section-main">
      <div className="section-header">
        <h2>Interview Preferences</h2>
        <p>Let us know your preferences for the interview process</p>
      </div>

      <form className="form-card" onSubmit={(e) => {
        e.preventDefault()
        onNext()
      }}>
        <div className="form-group">
          <label>Preferred Interview Type</label>
          <select
            name="preferred_interview_type"
            value={preferences.preferred_interview_type}
            onChange={handleInputChange}
            disabled={loading}
          >
            <option value="phone_screen">Phone Screen</option>
            <option value="video">Video Call</option>
            <option value="in_person">In-Person</option>
            <option value="no_preference">No Preference</option>
          </select>
        </div>

        <div className="form-group">
          <label>Preferred Interview Dates</label>
          <textarea
            name="preferred_interview_dates"
            value={preferences.preferred_interview_dates}
            onChange={handleInputChange}
            placeholder="List dates and times that work for you, e.g., Mon-Fri 9am-5pm"
            rows="3"
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label>Availability Notes</label>
          <textarea
            name="availability_notes"
            value={preferences.availability_notes}
            onChange={handleInputChange}
            placeholder="Any special considerations or notes (timezone, work schedule, etc.)"
            rows="3"
            disabled={loading}
          />
        </div>

        <div className="info-box">
          <p>💡 <strong>Tip:</strong> Being flexible and responsive to interview requests significantly improves your chances of being selected.</p>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onBack} className="btn-back" disabled={loading}>
            Back
          </button>
          <button type="submit" className="btn-next" disabled={loading}>
            Next: References
          </button>
        </div>
      </form>
    </div>
  )
}
