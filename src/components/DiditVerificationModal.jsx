import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// Hardcoded default DIDIT session URL for all users
const DEFAULT_DIDIT_SESSION_URL = 'https://verify.didit.me/session/0YcwjP8Jj41H'

export default function DiditVerificationModal({ userId, onClose, onSuccess }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [verificationStatus, setVerificationStatus] = useState(null)
  const [statusCheckCount, setStatusCheckCount] = useState(0)

  useEffect(() => {
    initializeSession()
  }, [userId])

  // Check verification status periodically
  useEffect(() => {
    if (!userId || error) return

    const checkStatus = async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from('user_verifications')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()

        if (!fetchErr && data) {
          setVerificationStatus(data)

          // If status changed to approved, trigger success callback
          if (data.status === 'approved') {
            setTimeout(() => {
              if (onSuccess) onSuccess()
            }, 1000)
          }
        }
      } catch (err) {
        console.warn('Error checking verification status:', err)
      }
    }

    // Check status every 2 seconds
    checkStatus()
    const interval = setInterval(() => {
      checkStatus()
      setStatusCheckCount(c => c + 1)
    }, 2000)

    return () => clearInterval(interval)
  }, [userId, error])

  const initializeSession = async () => {
    try {
      setError('')
      setLoading(true)

      // Check if user already has a verification record
      const { data: existingStatus, error: fetchErr } = await supabase
        .from('user_verifications')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (!fetchErr && existingStatus) {
        setVerificationStatus(existingStatus)

        // If already approved, show success
        if (existingStatus.status === 'approved') {
          setLoading(false)
          return
        }

        // If already pending, show the session URL
        if (existingStatus.status === 'pending') {
          setLoading(false)
          return
        }
      }

      // Register the default session URL for this user
      const sessionIdMatch = DEFAULT_DIDIT_SESSION_URL.match(/session\/([A-Za-z0-9_-]+)/i)
      const sessionId = sessionIdMatch ? sessionIdMatch[1] : 'session-unknown'

      const { error: insertErr } = await supabase
        .from('user_verifications')
        .upsert(
          {
            user_id: userId,
            didit_session_id: sessionId,
            didit_session_url: DEFAULT_DIDIT_SESSION_URL,
            status: 'pending',
            verification_method: 'didit',
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )

      if (insertErr) {
        throw new Error(`Failed to register session: ${insertErr.message}`)
      }

      setVerificationStatus({
        user_id: userId,
        status: 'pending',
        didit_session_id: sessionId,
        didit_session_url: DEFAULT_DIDIT_SESSION_URL,
      })

      setLoading(false)
    } catch (err) {
      console.error('Error initializing DIDIT session:', err)
      setError(err?.message || 'Failed to initialize verification. Please try again.')
      setLoading(false)
    }
  }

  const handleClose = () => {
    onClose()
  }

  if (!userId) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Verification Required</h2>
          <p className="text-slate-600 mb-6">Please log in to verify your identity.</p>
          <button
            onClick={handleClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  // Show approved state
  if (verificationStatus?.status === 'approved') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full">
          <div className="text-center">
            <div className="text-5xl mb-4">✓</div>
            <h2 className="text-2xl font-bold text-green-600 mb-2">Verification Approved</h2>
            <p className="text-slate-600 mb-6">Your identity has been verified successfully.</p>
            <button
              onClick={handleClose}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show rejected state
  if (verificationStatus?.status === 'rejected') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full">
          <div className="text-center">
            <div className="text-5xl mb-4">✕</div>
            <h2 className="text-2xl font-bold text-red-600 mb-2">Verification Declined</h2>
            <p className="text-slate-600 mb-6">Your verification could not be completed. Please try again or contact support.</p>
            <div className="flex gap-3">
              <button
                onClick={initializeSession}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Try Again
              </button>
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show loading state
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full">
          <div className="text-center">
            <div className="inline-block animate-spin text-4xl mb-4">⚙️</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Preparing Verification</h2>
            <p className="text-slate-600">Setting up your identity verification session...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={initializeSession}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Retry
            </button>
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show verification in progress with iframe
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg overflow-hidden flex flex-col w-full max-w-2xl max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white">
          <h2 className="text-xl font-bold text-slate-900">Identity Verification</h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Iframe container */}
        <div className="flex-1 overflow-hidden relative bg-slate-50 min-h-[500px]">
          {statusCheckCount > 0 && (
            <div className="absolute top-4 right-4 z-10 text-xs text-slate-500 bg-white px-3 py-1.5 rounded border border-slate-200">
              Syncing... ({statusCheckCount * 2}s)
            </div>
          )}

          {verificationStatus?.didit_session_url ? (
            <iframe
              src={verificationStatus.didit_session_url}
              title="DIDIT Verification"
              className="w-full h-full border-0"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-presentation"
              allow="camera; microphone; payment"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block animate-spin text-4xl mb-4">⚙️</div>
                <p className="text-slate-600">Loading verification...</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-600 text-center">
            Complete the verification process in the window above. Status updates automatically every 2 seconds.
          </p>
        </div>
      </div>
    </div>
  )
}
