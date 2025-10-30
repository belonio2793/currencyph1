import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Auth({ onAuthSuccess }) {
  const [activeTab, setActiveTab] = useState('login')
  const [identifier, setIdentifier] = useState('') // email or phone or 'guest'
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const normalizeIdentifier = (id) => {
    const v = (id || '').trim()
    if (!v) return ''
    if (v === 'guest') return 'guest@currency.ph'
    if (v.includes('@')) return v
    // treat as phone or username
    return `${v}@currency.local`
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

      let { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: effectivePassword
      })

      if (signInError) {
        // If guest and no account exists, create it then sign in
        if (identifier === 'guest') {
          const { error: su } = await supabase.auth.signUp({ email, password: effectivePassword })
          if (su) throw su
          const retry = await supabase.auth.signInWithPassword({ email, password: effectivePassword })
          if (retry.error) throw retry.error
          data = retry.data
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
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
                    placeholder="you@example.com or 09171234567"
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
                <p className="text-center text-xs text-slate-400 mt-2">Guest login available: use identifier "guest" and password "guest"</p>
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
                    placeholder="you@example.com or 09171234567"
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
