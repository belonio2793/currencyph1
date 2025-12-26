import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import ExpandableModal from './ExpandableModal'
import { useDevice } from '../context/DeviceContext'

// Use environment variable if available, with fallback
const DEFAULT_DIDIT_SESSION_URL =
  import.meta.env.VITE_DIDIT_DEFAULT_SESSION_URL ||
  'https://verify.didit.me/session/default'

export default function DiditVerificationModal({ userId, onClose, onSuccess }) {
  const { isMobile } = useDevice()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [verificationStatus, setVerificationStatus] = useState(null)
  const [statusCheckCount, setStatusCheckCount] = useState(0)

  useEffect(() => {
    initializeSession()
  }, [userId])

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

      const { data: existingStatus, error: fetchErr } = await supabase
        .from('user_verifications')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (!fetchErr && existingStatus) {
        setVerificationStatus(existingStatus)

        if (existingStatus.status === 'approved') {
          setLoading(false)
          return
        }

        if (existingStatus.status === 'pending') {
          setLoading(false)
          return
        }
      }

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

  if (!userId) {
    return (
      <ExpandableModal
        isOpen={true}
        onClose={onClose}
        title="Verification Required"
        icon="🔐"
        footer={
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Close
          </button>
        }
      >
        <p className="text-slate-600">Please log in to verify your identity.</p>
      </ExpandableModal>
    )
  }

  if (verificationStatus?.status === 'approved') {
    return (
      <ExpandableModal
        isOpen={true}
        onClose={onClose}
        title="Verification Approved"
        icon="✓"
        footer={
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            Continue
          </button>
        }
      >
        <div className="text-center py-8">
          <div className="text-5xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-green-600 mb-2">Verification Approved</h2>
          <p className="text-slate-600">Your identity has been verified successfully.</p>
        </div>
      </ExpandableModal>
    )
  }

  if (verificationStatus?.status === 'rejected') {
    return (
      <ExpandableModal
        isOpen={true}
        onClose={onClose}
        title="Verification Declined"
        icon="✕"
        footer={
          <div className="flex gap-3 w-full">
            <button
              onClick={initializeSession}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Try Again
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="text-center py-8">
          <div className="text-5xl mb-4">✕</div>
          <h2 className="text-2xl font-bold text-red-600 mb-2">Verification Declined</h2>
          <p className="text-slate-600">Your verification could not be completed. Please try again or contact support.</p>
        </div>
      </ExpandableModal>
    )
  }

  if (loading) {
    return (
      <ExpandableModal
        isOpen={true}
        onClose={onClose}
        title="Preparing Verification"
        icon="⚙️"
      >
        <div className="text-center py-8">
          <div className="inline-block animate-spin text-4xl mb-4">⚙️</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Preparing Verification</h2>
          <p className="text-slate-600">Setting up your identity verification session...</p>
        </div>
      </ExpandableModal>
    )
  }

  if (error) {
    return (
      <ExpandableModal
        isOpen={true}
        onClose={onClose}
        title="Error"
        icon="⚠️"
        footer={
          <div className="flex gap-3 w-full">
            <button
              onClick={initializeSession}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Retry
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium"
            >
              Close
            </button>
          </div>
        }
      >
        <p className="text-slate-600 text-center py-4">{error}</p>
      </ExpandableModal>
    )
  }

  return (
    <ExpandableModal
      isOpen={true}
      onClose={onClose}
      title="Identity Verification"
      icon="🔐"
      size="xl"
      defaultExpanded={!isMobile}
      footer={
        <p className="text-xs text-slate-600 text-center w-full">
          Status updates automatically every 2 seconds • {statusCheckCount > 0 && `Syncing... (${statusCheckCount * 2}s)`}
        </p>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Complete the verification process below. Your status will update automatically.
        </p>

        <div className="relative bg-slate-50 min-h-[500px] rounded-lg overflow-hidden border border-slate-200">
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
      </div>
    </ExpandableModal>
  )
}
