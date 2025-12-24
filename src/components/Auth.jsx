import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { flexibleAuthClient } from '../lib/flexibleAuthClient'

export default function Auth({ onAuthSuccess, initialTab = 'login', isModal = false }) {
  const [activeTab, setActiveTab] = useState(initialTab)

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const [identifier, setIdentifier] = useState('') // username
  const [email, setEmail] = useState('') // optional email
  const [phoneNumber, setPhoneNumber] = useState('') // optional phone
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Dynamic additional fields for registration
  const [additionalFields, setAdditionalFields] = useState([])
  const [nextFieldId, setNextFieldId] = useState(1)

  const [resendLoading, setResendLoading] = useState(false)
  const [resendError, setResendError] = useState('')
  const [resendSuccess, setResendSuccess] = useState('')
  const [resendAvailableIn, setResendAvailableIn] = useState(0)

  useEffect(() => {
    let timer
    if (resendAvailableIn > 0) {
      timer = setInterval(() => {
        setResendAvailableIn((p) => {
          if (p <= 1) {
            clearInterval(timer)
            return 0
          }
          return p - 1
        })
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [resendAvailableIn])

  const normalizeIdentifier = (id) => {
    const v = (id || '').trim()
    if (!v) return ''

    // Username-based identifier: convert to email format for internal use
    // If it's already an email, return as-is
    if (v.includes('@')) return v

    // Otherwise, treat as username and create a local email
    return `${v}@coconuts.local`
  }

  const detectFieldType = (value) => {
    if (!value) return null
    const trimmed = value.trim()

    // Detect email
    if (trimmed.includes('@')) return 'email'

    // Detect phone (contains digits and optional +, -, space)
    if (/^[+\-\s\d()]{7,}$/.test(trimmed) && /\d/.test(trimmed)) return 'phone'

    // Default to username/text
    return 'username'
  }

  const addAdditionalField = () => {
    setAdditionalFields([...additionalFields, { id: nextFieldId, value: '', type: null }])
    setNextFieldId(nextFieldId + 1)
  }

  const removeAdditionalField = (id) => {
    setAdditionalFields(additionalFields.filter(field => field.id !== id))
  }

  const updateAdditionalField = (id, value) => {
    const type = detectFieldType(value)
    setAdditionalFields(additionalFields.map(field =>
      field.id === id ? { ...field, value, type } : field
    ))
  }

  const startResendCooldown = (email) => {
    try {
      const key = `resend_confirmation_${email}`
      const now = Date.now()
      localStorage.setItem(key, String(now))
      setResendAvailableIn(60)
    } catch (e) {
      // ignore
    }
  }

  const canResendNow = (email) => {
    try {
      const key = `resend_confirmation_${email}`
      const ts = Number(localStorage.getItem(key) || '0')
      if (!ts) return true
      const elapsed = (Date.now() - ts) / 1000
      return elapsed >= 60
    } catch (e) {
      return true
    }
  }

  const getResendRemaining = (email) => {
    try {
      const key = `resend_confirmation_${email}`
      const ts = Number(localStorage.getItem(key) || '0')
      if (!ts) return 0
      const elapsed = (Date.now() - ts) / 1000
      return Math.max(0, Math.ceil(60 - elapsed))
    } catch (e) {
      return 0
    }
  }

  useEffect(() => {
    if (!identifier) return
    const email = normalizeIdentifier(identifier)
    const remaining = getResendRemaining(email)
    setResendAvailableIn(remaining)
  }, [identifier])

  const sendConfirmationEmail = async (emailRaw) => {
    setResendError('')
    setResendSuccess('')
    const email = String(emailRaw || '').trim()
    if (!email) {
      setResendError('No email to send confirmation to')
      return
    }
    if (!canResendNow(email)) {
      const rem = getResendRemaining(email)
      setResendError(`Please wait ${rem}s before resending`) 
      setResendAvailableIn(rem)
      return
    }

    setResendLoading(true)
    try {
      const PROJECT_URL = import.meta.env.VITE_PROJECT_URL || import.meta.env.PROJECT_URL || window?.PROJECT_URL
      if (!PROJECT_URL) throw new Error('Project URL not configured')
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      try {
        const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY || window?.SUPABASE_ANON_KEY
        const headers = { 'Content-Type': 'application/json' }
        if (ANON_KEY) {
          // Send only Authorization header to avoid triggering preflight for custom 'apikey' header
          headers.Authorization = `Bearer ${ANON_KEY}`
        }
        const res = await fetch(`${PROJECT_URL}/functions/v1/resend-confirmation`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ email }),
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (!res.ok) {
          const txt = await (res.text().catch(()=>''))
          // surface 401 with helpful message
          if (res.status === 401) throw new Error(txt || 'Unauthorized to call resend-confirmation function')
          throw new Error(txt || `Server error ${res.status}`)
        }
        startResendCooldown(email)
        setResendSuccess('Confirmation email sent')
      } finally {
        clearTimeout(timeout)
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setResendError('Request timed out')
      } else {
        setResendError(err.message || 'Failed to send confirmation')
      }
    } finally {
      setResendLoading(false)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (!identifier || !password) {
        throw new Error('Please fill in all fields')
      }

      // Use flexible auth that supports email, phone, username, nickname, etc.
      const result = await flexibleAuthClient.signInWithIdentifier(identifier, password)

      if (result.error) {
        throw new Error(result.error)
      }

      if (!result.session || !result.user) {
        throw new Error('Login failed - no session returned')
      }

      setSuccess('Login successful! Redirecting...')
      setTimeout(() => {
        onAuthSuccess(result.user)
      }, 1000)
    } catch (err) {
      let errorMsg = err.message || 'Login failed'
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (!identifier || !password || !confirmPassword) {
        throw new Error('Please fill in all required fields')
      }

      if (password !== confirmPassword) {
        throw new Error('Passwords do not match')
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters')
      }

      // Validate identifier is not empty
      if (!identifier || !identifier.trim()) {
        throw new Error('Please enter your email, username, or phone number')
      }

      // Check if identifier already exists
      const identifierType = detectFieldType(identifier)
      const checkIdentifier = identifierType === 'email' ? identifier : identifier.toLowerCase().trim()
      const { exists: identifierExists } = await flexibleAuthClient.checkIdentifierExists(checkIdentifier)

      if (identifierExists) {
        if (identifierType === 'email') {
          throw new Error('This email is already registered')
        } else if (identifierType === 'phone') {
          throw new Error('This phone number is already registered')
        } else {
          throw new Error('This username is already taken')
        }
      }

      // Process main identifier field
      const identifierTypeForData = detectFieldType(identifier)
      let authEmail = null
      let userData = {
        username: null,
        email: null,
        phone_number: null
      }

      // Set identifier-based fields
      if (identifierType === 'email') {
        userData.email = identifier.toLowerCase().trim()
        authEmail = userData.email
      } else if (identifierType === 'username') {
        userData.username = identifier.toLowerCase().trim()
        // Generate a unique email for auth (use hash of username instead of timestamp for shorter email)
        const usernameHash = Math.abs(identifier.toLowerCase().charCodeAt(0) * identifier.length).toString(36)
        authEmail = `${identifier.toLowerCase()}${usernameHash}@currency.ph`.substring(0, 254)
      } else if (identifierType === 'phone') {
        userData.phone_number = identifier.trim()
        // Generate email from phone number (use hash to keep it short)
        const phoneHash = identifier.replace(/\D/g, '').substring(0, 8)
        authEmail = `phone${phoneHash}${Math.random().toString(36).substring(2, 8)}@currency.ph`
      }

      // Process additional fields - fill in any missing primary fields
      additionalFields.forEach(field => {
        if (!field.value.trim()) return

        if (field.type === 'email' && !userData.email) {
          userData.email = field.value.toLowerCase().trim()
          if (!authEmail) authEmail = userData.email
        } else if (field.type === 'phone' && !userData.phone_number) {
          userData.phone_number = field.value.trim()
        } else if (field.type === 'username' && !userData.username) {
          userData.username = field.value.toLowerCase().trim()
        }
      })

      // Ensure we have a valid email for auth (required)
      if (!authEmail) {
        // Fallback: create email from identifier if no valid email found
        authEmail = `${identifier.toLowerCase().trim().replace(/\s+/g, '')}${Math.random().toString(36).substring(2, 8)}@currency.ph`.substring(0, 254)
      }

      if (!userData.email) {
        userData.email = authEmail
      }

      // Use flexible auth registration
      const result = await flexibleAuthClient.signUp(userData.email, password, userData)

      if (result.error) {
        let errorMsg = result.error
        if (errorMsg.includes('unique') || errorMsg.includes('duplicate')) {
          if (errorMsg.includes('email')) {
            errorMsg = 'This email is already registered'
          } else if (errorMsg.includes('username')) {
            errorMsg = 'This username is already taken'
          } else if (errorMsg.includes('phone')) {
            errorMsg = 'This phone number is already registered'
          } else {
            errorMsg = 'This information is already registered'
          }
        }
        throw new Error(errorMsg)
      }

      setSuccess('Registration successful! You can now log in.')
      setIdentifier('')
      setPassword('')
      setConfirmPassword('')
      setAdditionalFields([])
      setTimeout(() => {
        setActiveTab('login')
      }, 2000)
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  // Determine if the last shown error suggests unconfirmed email
  const isUnconfirmedError = (msg) => {
    if (!msg) return false
    return /confirm/i.test(msg)
  }

  return (
    <div className={`${isModal ? 'w-full' : 'min-h-screen bg-gradient-to-br from-slate-50 to-blue-50'} flex ${isModal ? 'items-center' : 'items-start'} justify-center ${isModal ? 'py-2' : 'py-2 px-4 sm:px-6 lg:px-8'}`}>
      <div className={`w-full max-w-md ${isModal ? '' : 'mt-2 mb-2'}`}>
        {/* Header */}
        {!isModal && (
          <div className="text-center mb-8">
            <h1 className="text-4xl font-light text-slate-900 tracking-tight mb-2">
              currency.ph
            </h1>
            <p className="text-slate-600">Global currency at your fingertips</p>
          </div>
        )}

        {/* Auth Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => {
                setActiveTab('login')
                setError('')
                setSuccess('')
                setPhoneNumber('')
                setEmail('')
                window.history.replaceState(null, '', '/login')
              }}
              className={`flex-1 px-6 py-4 font-medium text-center transition-colors ${
                activeTab === 'login'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => {
                setActiveTab('register')
                setError('')
                setSuccess('')
                setPhoneNumber('')
                window.history.replaceState(null, '', '/register')
              }}
              className={`flex-1 px-6 py-4 font-medium text-center transition-colors ${
                activeTab === 'register'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Register
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-8">
            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
                {isUnconfirmedError(error) && (
                  <div className="mt-3">
                    <button
                      disabled={resendLoading || resendAvailableIn > 0}
                      onClick={() => sendConfirmationEmail(normalizeIdentifier(identifier))}
                      className="px-3 py-2 bg-yellow-500 text-white rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resendLoading ? 'Sending...' : (resendAvailableIn > 0 ? `Resend available in ${resendAvailableIn}s` : 'Resend confirmation email')}
                    </button>
                    {resendError && <div className="mt-2 text-xs text-red-600">{resendError}</div>}
                    {resendSuccess && <div className="mt-2 text-xs text-emerald-700">{resendSuccess}</div>}
                  </div>
                )}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">
                {success}
              </div>
            )}

            {/* Login Form */}
            {activeTab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Username, Email, or Phone Number
                  </label>
                  <p className="text-xs text-slate-500 mb-2">Enter any of your registered information</p>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g., username, email@example.com, or +63 9XX XXXX XXX"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-sm"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-sm"
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                >
                  {loading ? 'Logging in...' : 'Login'}
                </button>

                <p className="text-center text-sm text-slate-600 mt-4">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('register')
                      setError('')
                      setSuccess('')
                      setPhoneNumber('')
                      setEmail('')
                      window.history.replaceState(null, '', '/register')
                    }}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Sign up
                  </button>
                </p>
              </form>
            )}

            {/* Register Form */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                {/* Smart Primary Identifier Field */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email, Username, or Phone <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="username, email@example.com, or +63 9XX XXXX XXX"
                      className="flex-1 px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-sm"
                      disabled={loading}
                    />
                    {identifier && (
                      <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                        {detectFieldType(identifier) === 'email' && '📧 email'}
                        {detectFieldType(identifier) === 'phone' && '📱 phone'}
                        {detectFieldType(identifier) === 'username' && '👤 username'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Additional Fields Section */}
                <div className="border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-semibold text-slate-600 uppercase">
                      Additional Info
                    </label>
                    <button
                      type="button"
                      onClick={addAdditionalField}
                      className="text-blue-600 hover:text-blue-700 font-bold text-lg"
                      title="Add more fields"
                      disabled={loading}
                    >
                      +
                    </button>
                  </div>

                  {/* Additional Fields */}
                  {additionalFields.map((field) => (
                    <div key={field.id} className="flex items-start gap-2 mb-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) => updateAdditionalField(field.id, e.target.value)}
                          placeholder="Email, phone, username, city, country, etc."
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-xs"
                          disabled={loading}
                        />
                        {field.value && field.type && (
                          <span className="text-xs text-slate-500 mt-1 block">
                            {field.type === 'email' && '📧 email'}
                            {field.type === 'phone' && '📱 phone'}
                            {field.type === 'username' && '👤 username'}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAdditionalField(field.id)}
                        className="text-red-600 hover:text-red-700 font-bold text-lg leading-none pt-2"
                        title="Remove field"
                        disabled={loading}
                      >
                        −
                      </button>
                    </div>
                  ))}
                </div>

                {/* Password Fields */}
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-sm"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-sm"
                      disabled={loading}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                >
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>

                <p className="text-center text-sm text-slate-600 mt-4">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('login')
                      setError('')
                      setSuccess('')
                      window.history.replaceState(null, '', '/login')
                    }}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Log in
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
