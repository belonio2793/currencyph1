import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { flexibleAuthClient } from '../lib/flexibleAuthClient'
import ExpandableModal from './ExpandableModal'
import { useDevice } from '../context/DeviceContext'

export default function PokerAuthModal({ open, onClose, onSuccess }) {
  const { isMobile } = useDevice()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (isSignUp) {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin
          }
        })

        if (signUpErr) throw signUpErr

        setMessage('Check your email for confirmation link')
        setEmail('')
        setPassword('')
        
        setTimeout(() => {
          if (data?.user) {
            onSuccess?.()
            onClose()
          }
        }, 3000)
      } else {
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (signInErr) throw signInErr

        setEmail('')
        setPassword('')
        onSuccess?.()
        onClose()
      }
    } catch (err) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const footer = (
    <div className="flex gap-2 w-full">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="poker-auth-form"
        disabled={loading}
        className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (isSignUp ? 'Creating...' : 'Signing in...') : (isSignUp ? '✓ Create Account' : '→ Sign In')}
      </button>
    </div>
  )

  return (
    <ExpandableModal
      isOpen={open}
      onClose={onClose}
      title={isSignUp ? 'Join the Game' : 'Welcome Back'}
      icon="♠️"
      size={isMobile ? 'fullscreen' : 'sm'}
      footer={footer}
      defaultExpanded={!isMobile}
    >
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} id="poker-auth-form" className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={loading}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={loading}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div className="pt-2 border-t border-slate-200">
          <p className="text-sm text-slate-600 text-center">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError(null)
                setMessage(null)
              }}
              disabled={loading}
              className="ml-2 text-emerald-600 hover:text-emerald-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </form>
    </ExpandableModal>
  )
}
