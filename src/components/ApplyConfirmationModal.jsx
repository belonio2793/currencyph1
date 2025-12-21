import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { jobApplicationService } from '../lib/jobApplicationService'
import { formatFieldValue } from '../lib/formatters'
import ExpandableModal from './ExpandableModal'
import { useDevice } from '../context/DeviceContext'

export default function ApplyConfirmationModal({
  job,
  onClose,
  onAccept,
  userId
}) {
  const { isMobile } = useDevice()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userProfile, setUserProfile] = useState(null)
  const [userLoading, setUserLoading] = useState(true)
  const [coverLetter, setCoverLetter] = useState(`I am interested in this ${job?.job_title || 'position'} and am ready to start immediately.`)

  useEffect(() => {
    if (userId) {
      loadUserProfile()
    } else {
      setUserLoading(false)
    }
  }, [userId])

  const loadUserProfile = async () => {
    try {
      setUserLoading(true)
      const { data: authData } = await supabase.auth.getUser()
      if (!authData?.user) {
        setError('Not authenticated')
        return
      }

      let profileData = null
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, phone_number')
          .eq('user_id', userId)
          .limit(1)

        if (!error && data && data.length > 0) {
          profileData = data[0]
        }
      } catch (e) {
        // profiles table might not exist, that's ok
      }

      setUserProfile({
        full_name: profileData?.full_name || authData.user.user_metadata?.full_name || 'User',
        email: authData.user.email,
        phone_number: profileData?.phone_number || authData.user.user_metadata?.phone_number
      })
    } catch (err) {
      console.error('Error loading user profile:', err?.message || String(err))
      setError('Failed to load your profile information')
    } finally {
      setUserLoading(false)
    }
  }

  const handleSubmitApplication = async () => {
    if (!job || !userId || !userProfile) {
      setError('Missing required information to submit application')
      return
    }

    if (!coverLetter.trim()) {
      setError('Please enter a cover letter for your application')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await jobApplicationService.applyForJob({
        jobId: job.id,
        userId: userId,
        coverLetter: coverLetter.trim(),
        applicationData: userProfile
      })

      if (result.success) {
        onAccept?.(result.data)
        onClose()
      } else {
        setError(result.error || 'Failed to submit application')
      }
    } catch (err) {
      console.error('Error submitting application:', err)
      setError(err.message || 'An error occurred while submitting your application')
    } finally {
      setLoading(false)
    }
  }

  const footer = (
    <div className="flex gap-2 w-full">
      <button
        type="button"
        onClick={onClose}
        disabled={loading}
        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSubmitApplication}
        disabled={loading || !userProfile || userLoading}
        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
      >
        {loading ? 'Submitting...' : 'Submit Application'}
      </button>
    </div>
  )

  if (userLoading) {
    return (
      <ExpandableModal
        isOpen={!!job}
        onClose={onClose}
        title="Apply for Position"
        icon="📋"
        size={isMobile ? 'fullscreen' : 'md'}
        footer={footer}
        defaultExpanded={!isMobile}
      >
        <div className="flex items-center justify-center py-8">
          <p className="text-slate-600">Loading your profile...</p>
        </div>
      </ExpandableModal>
    )
  }

  return (
    <ExpandableModal
      isOpen={!!job}
      onClose={onClose}
      title="Apply for Position"
      icon="📋"
      size={isMobile ? 'fullscreen' : 'md'}
      footer={footer}
      defaultExpanded={!isMobile}
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Job Summary */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-slate-900">Position: {job?.job_title}</h3>
          {job?.job_category && (
            <p className="text-sm text-slate-600">Category: {job.job_category}</p>
          )}
          {job?.location && (
            <p className="text-sm text-slate-600">Location: {job.location}</p>
          )}
        </div>

        {/* Applicant Info */}
        {userProfile && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-slate-900 text-sm">Your Information</h3>
            <div className="space-y-1 text-sm">
              <p><span className="text-slate-600">Name:</span> <span className="font-medium">{userProfile.full_name}</span></p>
              <p><span className="text-slate-600">Email:</span> <span className="font-medium">{userProfile.email}</span></p>
              {userProfile.phone_number && (
                <p><span className="text-slate-600">Phone:</span> <span className="font-medium">{userProfile.phone_number}</span></p>
              )}
            </div>
          </div>
        )}

        {/* Cover Letter */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Cover Letter
          </label>
          <textarea
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:opacity-50 text-sm resize-none"
            rows={5}
            placeholder="Tell the employer why you're interested in this position..."
          />
          <p className="text-xs text-slate-500 mt-1">
            {coverLetter.length} characters
          </p>
        </div>

        {/* Confirmation */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-900">
            ℹ️ By clicking "Submit Application", you confirm that all the information provided is accurate and agree to the job application terms.
          </p>
        </div>
      </div>
    </ExpandableModal>
  )
}
