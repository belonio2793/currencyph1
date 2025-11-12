import React, { useState, useEffect, useRef } from 'react'
import { diditService } from '../lib/diditService'

export default function DiditVerificationModal({ userId, onClose, onSuccess }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sessionUrl, setSessionUrl] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [verificationStatus, setVerificationStatus] = useState(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [pollCount, setPollCount] = useState(0)
  const iframeRef = useRef(null)
  const pollIntervalRef = useRef(null)

  useEffect(() => {
    initializeSession()
  }, [userId])

  const initializeSession = async () => {
    try {
      setError('')
      setLoading(true)
      
      // Check if user already has a pending or approved verification
      const existingStatus = await diditService.getVerificationStatus(userId)
      
      if (existingStatus?.status === 'approved') {
        setVerificationStatus(existingStatus)
        setLoading(false)
        return
      }

      // If pending and has session URL, reuse it
      if (existingStatus?.status === 'pending' && existingStatus?.didit_session_url) {
        setSessionUrl(existingStatus.didit_session_url)
        setSessionId(existingStatus.didit_session_id)
        setIsVerifying(true)
        setLoading(false)
        startPolling(existingStatus.didit_session_id)
        return
      }

      // Create new session
      const result = await diditService.createVerificationSession(userId)
      
      if (!result.success || !result.sessionUrl) {
        throw new Error('Failed to create verification session')
      }

      setSessionUrl(result.sessionUrl)
      setSessionId(result.sessionId)
      setIsVerifying(true)
      setLoading(false)
      
      // Start polling for status changes
      startPolling(result.sessionId)
    } catch (err) {
      console.error('Error initializing DIDIT session:', err)
      setError(err?.message || 'Failed to initialize verification. Please try again.')
      setLoading(false)
    }
  }

  const startPolling = (sessionId) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }

    // Poll every 2 seconds for status changes (up to 2 minutes)
    let count = 0
    const maxPolls = 60

    const checkStatus = async () => {
      try {
        const status = await diditService.getVerificationStatus(userId)
        count++
        setPollCount(count)

        if (status?.status === 'approved') {
          setVerificationStatus(status)
          clearInterval(pollIntervalRef.current)
          setIsVerifying(false)
          
          // Show success briefly before calling onSuccess
          setTimeout(() => {
            if (onSuccess) onSuccess()
          }, 1000)
        } else if (status?.status === 'rejected') {
          setVerificationStatus(status)
          clearInterval(pollIntervalRef.current)
          setIsVerifying(false)
          setError('Your verification was declined. Please try again or contact support.')
        } else if (status?.status === 'pending' && count >= maxPolls) {
          // Stop polling after 2 minutes
          clearInterval(pollIntervalRef.current)
          setIsVerifying(false)
        }
      } catch (err) {
        console.warn('Error polling verification status:', err)
      }
    }

    // Check immediately
    checkStatus()

    // Then poll every 2 seconds
    pollIntervalRef.current = setInterval(checkStatus, 2000)
  }

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  const handleClose = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }
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
  if (error && !sessionUrl) {
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

  // Show DIDIT verification iframe
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg overflow-hidden flex flex-col w-full max-w-2xl max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white">
          <h2 className="text-xl font-bold text-slate-900">Identity Verification</h2>
          <button
            onClick={handleClose}
            disabled={isVerifying}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title={isVerifying ? 'Verification in progress' : 'Close'}
          >
            ✕
          </button>
        </div>

        {/* Error message */}
        {error && sessionUrl && (
          <div className="p-4 bg-yellow-50 border-b border-yellow-200">
            <p className="text-sm text-yellow-700">{error}</p>
          </div>
        )}

        {/* Iframe container */}
        <div className="flex-1 overflow-hidden relative bg-slate-50 min-h-[500px]">
          {isVerifying && pollCount > 0 && (
            <div className="absolute top-4 right-4 z-10 text-xs text-slate-500 bg-white px-3 py-1.5 rounded border border-slate-200">
              Syncing... ({pollCount}s)
            </div>
          )}
          
          {sessionUrl ? (
            <iframe
              ref={iframeRef}
              src={sessionUrl}
              title="DIDIT Verification"
              className="w-full h-full border-0"
              allow="camera; microphone"
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
        {isVerifying && (
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-600 text-center">
              Complete the verification process in the window above. Changes will be synced automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
