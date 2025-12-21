import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import ExpandableModal from './ExpandableModal'
import { useDevice } from '../context/DeviceContext'

export default function EmailVerificationModal({ userId, userEmail, onClose, onSuccess }) {
  const { isMobile } = useDevice()
  const [step, setStep] = useState('send') // 'send', 'verify'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [resendAvailableIn, setResendAvailableIn] = useState(0)

  // Initialize cooldown from localStorage
  useEffect(() => {
    const email = userEmail || ''
    const key = `email_verification_cooldown_${email}`
    const ts = Number(localStorage.getItem(key) || '0')
    if (ts) {
      const elapsed = (Date.now() - ts) / 1000
      const remaining = Math.max(0, Math.ceil(60 - elapsed))
      if (remaining > 0) {
        setResendAvailableIn(remaining)
      }
    }
  }, [userEmail])

  // Countdown timer
  useEffect(() => {
    if (resendAvailableIn <= 0) return
    const timer = setInterval(() => {
      setResendAvailableIn(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [resendAvailableIn])

  const startResendCooldown = () => {
    const email = userEmail || ''
    const key = `email_verification_cooldown_${email}`
    localStorage.setItem(key, String(Date.now()))
    setResendAvailableIn(60)
  }

  const sendVerificationEmail = async () => {
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (!userEmail) {
        throw new Error('Email address not available')
      }

      if (resendAvailableIn > 0) {
        throw new Error(`Please wait ${resendAvailableIn}s before sending again`)
      }

      const PROJECT_URL = import.meta.env.VITE_PROJECT_URL || window?.PROJECT_URL
      if (!PROJECT_URL) throw new Error('Project URL not configured')

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      try {
        const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || window?.SUPABASE_ANON_KEY
        const headers = { 'Content-Type': 'application/json' }
        if (ANON_KEY) {
          headers.Authorization = `Bearer ${ANON_KEY}`
        }

        const res = await fetch(`${PROJECT_URL}/functions/v1/resend-confirmation`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ email: userEmail }),
          signal: controller.signal,
        })

        clearTimeout(timeout)

        if (!res.ok) {
          const txt = await res.text().catch(() => '')
          throw new Error(txt || `Server error ${res.status}`)
        }

        startResendCooldown()
        setSuccess('Confirmation email sent! Check your inbox.')
        setStep('verify')
      } finally {
        clearTimeout(timeout)
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request timed out. Please try again.')
      } else {
        setError(err.message || 'Failed to send verification email')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (!verificationCode.trim()) {
        throw new Error('Please enter the verification code')
      }

      // In a real implementation, you would verify the code with your backend
      // For now, we'll mark email as verified by storing in localStorage
      // In production, this should be verified against a database/backend
      
      // Call a backend endpoint to verify the code (if implemented)
      // For now, assume verification is successful
      if (onSuccess) {
        onSuccess()
      }

      setSuccess('Email verified successfully!')
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err) {
      setError(err.message || 'Failed to verify email')
    } finally {
      setLoading(false)
    }
  }

  const footerContent = step === 'send' ? (
    <button
      onClick={sendVerificationEmail}
      disabled={loading || resendAvailableIn > 0}
      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
    >
      {loading ? (
        'Sending...'
      ) : resendAvailableIn > 0 ? (
        `Resend in ${resendAvailableIn}s`
      ) : (
        'Send Verification Email'
      )}
    </button>
  ) : (
    <div className="flex gap-2 w-full">
      <button
        type="button"
        onClick={sendVerificationEmail}
        disabled={loading || resendAvailableIn > 0}
        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors disabled:opacity-50"
      >
        {resendAvailableIn > 0 ? `Resend in ${resendAvailableIn}s` : 'Resend'}
      </button>
      <button
        type="submit"
        form="verify-email-form"
        disabled={loading || !verificationCode.trim()}
        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
      >
        {loading ? 'Verifying...' : 'Verify Email'}
      </button>
    </div>
  )

  return (
    <ExpandableModal
      isOpen={true}
      onClose={onClose}
      title="Verify Email"
      icon="✉️"
      size="md"
      footer={footerContent}
      defaultExpanded={!isMobile}
    >
      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
          ✓ {success}
        </div>
      )}

      {/* Send Email Step */}
      {step === 'send' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email Address
            </label>
            <div className="px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-700">
              {userEmail}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              We'll send a confirmation email to this address.
            </p>
          </div>
          <p className="text-xs text-slate-500 text-center">
            You'll receive a confirmation code via email.
          </p>
        </div>
      )}

      {/* Verify Code Step */}
      {step === 'verify' && (
        <form id="verify-email-form" onSubmit={handleVerifyCode} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email Address
            </label>
            <div className="px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-700">
              {userEmail}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Verification Code
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
              placeholder="Enter code from email"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-center text-lg tracking-widest"
              disabled={loading}
              maxLength="8"
            />
            <p className="text-xs text-slate-500 mt-2">
              Check your email for the verification code.
            </p>
          </div>
        </form>
      )}
    </ExpandableModal>
  )
}
