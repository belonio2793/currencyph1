import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Auth({ onAuthSuccess, initialTab = 'login' }) {
  const [activeTab, setActiveTab] = useState(initialTab)

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab)
  }, [initialTab])
  const [identifier, setIdentifier] = useState('') // email or phone or 'guest'
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
    if (v === 'guest') return 'guest@currency.ph'
    if (v.includes('@')) return v

    // Treat as phone number: strip non-digits/plus
    const raw = v.replace(/[^+\d]/g, '')
    let phone = raw
    // If starts with +, assume full international provided
    if (phone.startsWith('+')) {
      // remove plus for email local part
      phone = phone.replace(/^\+/, '')
      return `${phone}@phone.currency.ph`
    }

    // If starts with 0 and 11 digits (e.g. 09171234567) -> convert to country code 63 (Philippines)
    if (/^0\d{10}$/.test(phone)) {
      const converted = '63' + phone.substring(1)
      return `${converted}@phone.currency.ph`
    }

    // If 10 digits starting with 9 (e.g. 9171234567) -> assume Philippines, add 63
    if (/^9\d{9}$/.test(phone)) {
      const converted = '63' + phone
      return `${converted}@phone.currency.ph`
    }

    // Fallback: treat as local username
    return `${v}@currency.local`
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
      const PROJECT_URL = import.meta.env.VITE_PROJECT_URL || process.env.PROJECT_URL
      if (!PROJECT_URL) throw new Error('Project URL not configured')
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      try {
        const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
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
          const txt = await res.text().catch(()=>'')
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

      const email = normalizeIdentifier(identifier)
      // Map guest/guest -> backend safe password to bypass Supabase min-length checks
      const effectivePassword = (identifier === 'guest' && password === 'guest') ? 'guest123' : password

      // Try signing in with timeout
      let signInResult
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

        try {
          signInResult = await supabase.auth.signInWithPassword({ email, password: effectivePassword })
        } finally {
          clearTimeout(timeoutId)
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          signInResult = { error: new Error('Login request timed out. Check your internet connection.') }
        } else if (err?.message?.includes('Failed to fetch')) {
          signInResult = { error: new Error('Cannot connect to authentication service. Check your internet connection or try again later.') }
        } else {
          signInResult = { error: err }
        }
      }

      let data = signInResult.data
      let signInError = signInResult.error

      if (signInError) {
        // If the error indicates email not confirmed, keep error but allow resend
        const msg = String(signInError.message || '')
        if (/confirm/i.test(msg)) {
          setError(msg)
          // do not throw; allow user to resend confirmation
          return
        }

        if (identifier === 'guest') {
          try {
            // Try to create the guest user via serverless Edge Function (preferred)
            const PROJECT_URL = import.meta.env.VITE_PROJECT_URL || process.env.PROJECT_URL
            try {
              if (PROJECT_URL) {
                const controller = new AbortController()
                const timeout = setTimeout(() => controller.abort(), 5000)
                try {
                  const fnRes = await fetch(`${PROJECT_URL}/functions/v1/create-guest`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password: effectivePassword, full_name: 'Guest' }),
                    signal: controller.signal
                  })
                  clearTimeout(timeout)
                  if (!fnRes.ok) {
                    const txt = await fnRes.text().catch(()=>'')
                    console.warn('create-guest function failed', fnRes.status, txt)
                    throw new Error('create-guest failed')
                  }
                  // After creation, sign in
                  const retry = await supabase.auth.signInWithPassword({ email, password: effectivePassword })
                  if (retry.error) throw retry.error
                  data = retry.data
                } finally {
                  clearTimeout(timeout)
                }
              } else {
                throw new Error('Project URL not configured')
              }
            } catch (err) {
              console.warn('create-guest function error', err)
              // fallback to admin direct (if service role key is present on client)
              const ADMIN_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
              if (ADMIN_KEY && PROJECT_URL) {
                const controller = new AbortController()
                const timeout = setTimeout(() => controller.abort(), 5000)
                try {
                  const res = await fetch(`${PROJECT_URL}/auth/v1/admin/users`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      apikey: ADMIN_KEY,
                      Authorization: `Bearer ${ADMIN_KEY}`,
                    },
                    body: JSON.stringify({ email, password: effectivePassword, email_confirm: true, user_metadata: { full_name: 'Guest' } }),
                    signal: controller.signal
                  })
                  clearTimeout(timeout)
                  if (res.ok) {
                    const retry = await supabase.auth.signInWithPassword({ email, password: effectivePassword })
                    if (retry.error) throw retry.error
                    data = retry.data
                  } else {
                    const txt = await res.text().catch(()=>'')
                    console.warn('Admin create user failed', res.status, txt)
                    throw new Error('Admin create user failed')
                  }
                } finally {
                  clearTimeout(timeout)
                }
              } else {
                throw err
              }
            }
          } catch (err) {
            console.warn('Guest backend create failed', err)
            // Final fallback: create local guest session with persistence
            const localUser = { id: 'guest-local-' + Date.now(), email: 'guest@currency.ph', user_metadata: { full_name: 'Guest' } }
            // Persist to localStorage so session survives refresh
            try {
              localStorage.setItem('currency_ph_guest_session', JSON.stringify({
                user: localUser,
                timestamp: Date.now()
              }))
            } catch (e) {
              console.warn('Could not persist guest session to localStorage', e)
            }
            setSuccess('Guest session created (offline mode)')
            setTimeout(() => onAuthSuccess(localUser), 500)
            return
          }
        } else {
          throw signInError
        }
      }

      setSuccess('Login successful! Redirecting...')
      setTimeout(() => {
        onAuthSuccess(data.user)
      }, 1000)
    } catch (err) {
      setError(err.message || 'Login failed')
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
      if (!identifier || !password || !confirmPassword || !fullName) {
        throw new Error('Please fill in all fields')
      }

      if (password !== confirmPassword) {
        throw new Error('Passwords do not match')
      }

      // Allow a guest account with short password 'guest'
      const normalizedEmailForCheck = normalizeIdentifier(identifier)
      const isGuestIdentifier = (identifier === 'guest' || normalizedEmailForCheck === 'guest@currency.local')
      if (password.length < 6 && !isGuestIdentifier) {
        throw new Error('Password must be at least 6 characters')
      }

      const email = normalizeIdentifier(identifier)
      const effectivePassword = (identifier === 'guest' && password === 'guest') ? 'guest123' : password

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: effectivePassword,
        options: {
          data: {
            full_name: fullName
          }
        }
      })

      if (signUpError) {
        throw signUpError
      }

      setSuccess('Registration successful! Please check your email to confirm your account.')
      setIdentifier('')
      setPassword('')
      setConfirmPassword('')
      setFullName('')
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

  const placeholderText = 'email address or phone number'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-start justify-center py-2 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md mt-2 mb-2">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-light text-slate-900 tracking-tight mb-2">
            currency.ph
          </h1>
          <p className="text-slate-600">Global currency at your fingertips</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => {
                setActiveTab('login')
                setError('')
                setSuccess('')
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
                    Email or Phone
                  </label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={placeholderText}
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
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-sm"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email or Phone
                  </label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={placeholderText}
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
