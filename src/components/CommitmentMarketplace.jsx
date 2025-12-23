import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useDevice } from '../context/DeviceContext'

export default function CommitmentMarketplace({ userId, isAuthenticated }) {
  const { isMobile } = useDevice()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Simple form data
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [whatICanOffer, setWhatICanOffer] = useState('')
  const [whatINeed, setWhatINeed] = useState('')
  const [notes, setNotes] = useState('')

  // Load user data if authenticated
  useEffect(() => {
    if (isAuthenticated && userId) {
      loadUserData()
    }
  }, [isAuthenticated, userId])

  const loadUserData = async () => {
    try {
      const { data: profileData } = await supabase
        .from('commitment_profiles')
        .select('contact_person, email')
        .eq('user_id', userId)
        .single()

      if (profileData) {
        setName(profileData.contact_person || '')
        setEmail(profileData.email || '')
      }
    } catch (err) {
      console.error('Error loading user data:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // At least one of offer or need should be filled
    if (!whatICanOffer.trim() && !whatINeed.trim()) {
      setError('Share what you can offer or what you need (or both!)')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Create or get commitment profile
      let profileId = null

      if (isAuthenticated && userId) {
        // Try to get existing profile
        const { data: existingProfile } = await supabase
          .from('commitment_profiles')
          .select('id')
          .eq('user_id', userId)
          .single()

        if (existingProfile) {
          profileId = existingProfile.id
        } else {
          // Create new profile
          const { data: newProfile, error: profileError } = await supabase
            .from('commitment_profiles')
            .insert({
              user_id: userId,
              contact_person: name,
              email: email,
              profile_completed: true
            })
            .select()
            .single()

          if (profileError) throw profileError
          profileId = newProfile.id
        }
      }

      // Create marketplace entry
      const { error: insertError } = await supabase
        .from('marketplace_listings')
        .insert({
          user_id: isAuthenticated ? userId : null,
          contact_name: name,
          contact_email: email,
          what_can_offer: whatICanOffer,
          what_need: whatINeed,
          notes: notes,
          commitment_profile_id: profileId,
          status: 'active'
        })

      if (insertError) throw insertError

      setSuccess('🎉 Thank you! We\'re matching you with others...')
      
      // Reset form
      setTimeout(() => {
        setWhatICanOffer('')
        setWhatINeed('')
        setNotes('')
        setSuccess('')
      }, 3000)
    } catch (err) {
      console.error('Error saving listing:', err)
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`border-t border-slate-700 ${isMobile ? 'px-3 py-4' : 'px-6 py-8'} bg-gradient-to-b from-slate-800 to-slate-900`}>
      {/* Header */}
      <div className="mb-8 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-2 flex items-center justify-center gap-2">
          <span>🤝</span> Marketplace of Possibilities
        </h2>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Share what you have to offer. Tell us what you need. We'll match you with the right partners.
        </p>
      </div>

      {/* Form */}
      <div className={`max-w-4xl mx-auto bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 p-6 md:p-8 space-y-6`}>
        {error && (
        <div className="p-4 bg-red-900/30 border border-red-700/50 rounded-lg text-red-200 text-sm mb-4">
          <p className="flex items-center gap-2"><span>❌</span> {error}</p>
          {error.includes('marketplace_listings') && (
            <p className="text-xs mt-2 text-red-100">Setup required: Check MARKETPLACE_SETUP.md for database setup instructions.</p>
          )}
        </div>
      )}

        {success && (
          <div className="p-4 bg-emerald-900/30 border border-emerald-700/50 rounded-lg text-emerald-200 text-sm animate-pulse">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contact Info - Optional */}
          {!isAuthenticated && (
            <div className="space-y-4 pb-4 border-b border-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 text-sm mb-2">
                    Your Name <span className="text-slate-500">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="How should we call you?"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-2">
                    Your Email <span className="text-slate-500">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* What They Can Offer */}
          <div className="space-y-3 bg-gradient-to-br from-emerald-900/20 to-transparent rounded-lg p-4 border border-emerald-700/30">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎁</span>
              <label className="block text-white font-semibold">
                What can you offer or provide?
              </label>
            </div>
            <p className="text-slate-400 text-sm">
              💡 Anything goes: products, services, time, skills, equipment, labor, advice, connections... be creative!
            </p>
            <textarea
              value={whatICanOffer}
              onChange={(e) => setWhatICanOffer(e.target.value)}
              placeholder="Examples: 1000 coconuts per month • Professional consulting • Logistics services • Free labor on weekends • Storage space • Technical skills • Mentorship • Quality assurance..."
              rows={4}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 transition-all resize-none"
            />
          </div>

          {/* What They Need */}
          <div className="space-y-3 bg-gradient-to-br from-blue-900/20 to-transparent rounded-lg p-4 border border-blue-700/30">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔍</span>
              <label className="block text-white font-semibold">
                What do you need or are looking for?
              </label>
            </div>
            <p className="text-slate-400 text-sm">
              💡 Tell us what would help you most. No request is too small or too large.
            </p>
            <textarea
              value={whatINeed}
              onChange={(e) => setWhatINeed(e.target.value)}
              placeholder="Examples: Need buyers for my harvest • Looking for quality packaging • Want to learn marketing • Need a warehouse • Seeking partnership • Looking for equipment rental • Want to grow my network..."
              rows={4}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all resize-none"
            />
          </div>

          {/* Additional Notes */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💬</span>
              <label className="block text-white font-semibold">
                Anything else we should know?
              </label>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Location, timing, preferences, constraints, dreams... anything else!"
              rows={3}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 transition-all resize-none"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={loading || (!whatICanOffer.trim() && !whatINeed.trim())}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 disabled:from-slate-600 disabled:to-slate-600 text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
            >
              <span>{loading ? '⏳' : '✨'}</span>
              {loading ? 'Connecting...' : 'Share & Connect'}
            </button>
          </div>

          {/* Info message */}
          <p className="text-slate-400 text-xs text-center">
            ✓ All fields are optional. Share what feels right. We'll handle the rest.
          </p>
        </form>
      </div>

      {/* Why This Works */}
      <div className={`mt-12 max-w-4xl mx-auto`}>
        <h3 className="text-xl font-bold text-white mb-4 text-center">How This Works</h3>
        <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 text-center">
            <p className="text-3xl mb-2">1️⃣</p>
            <h4 className="text-white font-semibold mb-2">You Share</h4>
            <p className="text-slate-400 text-sm">Tell us what you can offer and what you need</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 text-center">
            <p className="text-3xl mb-2">2️⃣</p>
            <h4 className="text-white font-semibold mb-2">We Match</h4>
            <p className="text-slate-400 text-sm">Our algorithm connects you with perfect partners</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 text-center">
            <p className="text-3xl mb-2">3️⃣</p>
            <h4 className="text-white font-semibold mb-2">You Grow</h4>
            <p className="text-slate-400 text-sm">Build lasting relationships and scale together</p>
          </div>
        </div>
      </div>
    </div>
  )
}
