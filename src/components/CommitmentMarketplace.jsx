import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { flexibleAuthClient } from '../lib/flexibleAuthClient'
import { useDevice } from '../context/DeviceContext'

export default function CommitmentMarketplace({ userId, isAuthenticated, onAuthSuccess }) {
  const { isMobile } = useDevice()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Simple form data
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [whatICanOffer, setWhatICanOffer] = useState('')
  const [whatINeed, setWhatINeed] = useState('')
  const [notes, setNotes] = useState('')

  // Social media profiles
  const [socialMedia, setSocialMedia] = useState({
    twitter: '',
    linkedin: '',
    instagram: '',
    facebook: '',
    telegram: '',
    whatsapp: '',
    viber: ''
  })

  // Password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [tempFormData, setTempFormData] = useState(null)

  // Signatories display state
  const [signatories, setSignatories] = useState([])
  const [loadingSignatories, setLoadingSignatories] = useState(false)

  // Load user data and signatories
  useEffect(() => {
    if (isAuthenticated && userId) {
      loadUserData()
    }
    loadSignatories()
  }, [isAuthenticated, userId])

  const loadSignatories = async () => {
    setLoadingSignatories(true)
    try {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .select('id, contact_name, contact_email, contact_phone, social_media, what_can_offer, what_need, notes, created_at, user_id')
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (!error && data) {
        setSignatories(data)
      }
    } catch (err) {
      console.error('Error loading signatories:', err)
    } finally {
      setLoadingSignatories(false)
    }
  }

  const loadUserData = async () => {
    try {
      const { data: profileData } = await supabase
        .from('commitment_profiles')
        .select('contact_person, email, phone_number, social_media')
        .eq('user_id', userId)
        .single()

      if (profileData) {
        setName(profileData.contact_person || '')
        setEmail(profileData.email || '')
        setPhone(profileData.phone_number || '')
        if (profileData.social_media) {
          setSocialMedia({ ...socialMedia, ...profileData.social_media })
        }
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

    // Validate email or phone is provided for non-authenticated users
    if (!isAuthenticated) {
      const hasEmail = email && email.includes('@')
      const hasPhone = phone && phone.trim().length >= 7

      if (!hasEmail && !hasPhone) {
        setError('Please enter either an email address or phone number to create an account')
        return
      }

      // If using email, proceed with signup
      if (hasEmail && !email.includes('@')) {
        setError('Please enter a valid email address')
        return
      }

      // For phone-only accounts, use a generated email
      const signupEmail = hasEmail ? email : `phone.${Date.now()}@coconuts.local`

      setNewUserEmail(signupEmail)
      setTempFormData({
        name,
        email,
        phone,
        whatICanOffer,
        whatINeed,
        notes,
        socialMedia
      })
      setShowPasswordModal(true)
      setError('')
      return
    }

    // If authenticated, proceed with submission
    await submitMarketplaceListing(userId, name, email, phone, whatICanOffer, whatINeed, notes, socialMedia)
  }

  const submitMarketplaceListing = async (currentUserId, contactName, contactEmail, contactPhone, offer, need, additionalNotes, socMediaProfiles) => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Create or get commitment profile
      let profileId = null

      if (currentUserId) {
        // Try to get existing profile
        const { data: existingProfile } = await supabase
          .from('commitment_profiles')
          .select('id')
          .eq('user_id', currentUserId)
          .single()

        if (existingProfile) {
          profileId = existingProfile.id
          // Update existing profile with new contact info
          const { error: updateError } = await supabase
            .from('commitment_profiles')
            .update({
              contact_person: contactName,
              email: contactEmail,
              phone_number: contactPhone,
              social_media: socMediaProfiles
            })
            .eq('id', profileId)

          if (updateError) throw updateError
        } else {
          // Create new profile
          const { data: newProfile, error: profileError } = await supabase
            .from('commitment_profiles')
            .insert({
              user_id: currentUserId,
              contact_person: contactName,
              email: contactEmail,
              phone_number: contactPhone,
              social_media: socMediaProfiles,
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
          user_id: currentUserId || null,
          contact_name: contactName,
          contact_email: contactEmail,
          contact_phone: contactPhone,
          what_can_offer: offer,
          what_need: need,
          notes: additionalNotes,
          social_media: socMediaProfiles,
          commitment_profile_id: profileId,
          status: 'active'
        })

      if (insertError) throw insertError

      setSuccess('🎉 Thank you! We\'re matching you with others...')
      loadSignatories()

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

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPasswordError('')

    // Validate password
    if (!password || password.length < 6) {
      setPasswordError('Password must be at least 6 characters long')
      return
    }

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    setPasswordLoading(true)

    try {
      // First, try to sign in case the user already exists
      try {
        const { data: existingSession, error: signInCheckError } = await supabase.auth.signInWithPassword({
          email: newUserEmail,
          password: password
        })

        if (!signInCheckError && existingSession?.user) {
          // User already exists and login successful, skip signup
          const userId = existingSession.user.id

          // Close modal and proceed
          setShowPasswordModal(false)

          // Submit marketplace listing
          await submitMarketplaceListing(
            userId,
            tempFormData.name,
            tempFormData.email,
            tempFormData.phone,
            tempFormData.whatICanOffer,
            tempFormData.whatINeed,
            tempFormData.notes,
            tempFormData.socialMedia
          )

          // Reset form
          setPassword('')
          setConfirmPassword('')
          setNewUserEmail('')
          setTempFormData(null)

          if (onAuthSuccess) {
            onAuthSuccess(userId)
          }
          setPasswordLoading(false)
          return
        }
      } catch (signInErr) {
        // User doesn't exist, proceed with signup
      }

      // Register user with flexible auth (no email verification required)
      const signupResult = await flexibleAuthClient.signUp(newUserEmail, password, {
        full_name: tempFormData.name || newUserEmail
      })

      if (signupResult.error) {
        setPasswordError(signupResult.error || 'Registration failed. Please try again.')
        setPasswordLoading(false)
        return
      }

      if (!signupResult.user) {
        throw new Error('User registration failed')
      }

      const userId = signupResult.user.id

      // Auto sign in the newly created user using flexible auth
      const signInResult = await flexibleAuthClient.signInWithIdentifier(newUserEmail, password)
      if (signInResult.error) {
        // User was created but sign-in failed - this is unusual
        setPasswordError('Account created successfully! You can now sign in with your credentials.')
        setPasswordLoading(false)
        return
      }

      // Close modal
      setShowPasswordModal(false)

      // Submit marketplace listing with new user ID
      await submitMarketplaceListing(
        userId,
        tempFormData.name,
        tempFormData.email,
        tempFormData.phone,
        tempFormData.whatICanOffer,
        tempFormData.whatINeed,
        tempFormData.notes,
        tempFormData.socialMedia
      )

      // Reset password form
      setPassword('')
      setConfirmPassword('')
      setNewUserEmail('')
      setTempFormData(null)

      // Trigger parent callback if provided
      if (onAuthSuccess) {
        onAuthSuccess(userId)
      }
    } catch (err) {
      console.error('Error during registration/sign in:', err)
      const errorMsg = err.message || 'Something went wrong. Please try again.'

      // Provide user-friendly error messages
      if (errorMsg.includes('already registered')) {
        setPasswordError('This email is already registered. Please sign in instead.')
      } else {
        setPasswordError(errorMsg)
      }
    } finally {
      setPasswordLoading(false)
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

      {/* Error & Success Messages */}
      {error && (
        <div className="max-w-7xl mx-auto p-4 bg-red-900/30 border border-red-700/50 rounded-lg text-red-200 text-sm mb-4">
          <p className="flex items-center gap-2"><span>❌</span> {error}</p>
          {error.includes('marketplace_listings') && (
            <p className="text-xs mt-2 text-red-100">Setup required: Check MARKETPLACE_SETUP.md for database setup instructions.</p>
          )}
        </div>
      )}

      {success && (
        <div className="max-w-7xl mx-auto p-4 bg-emerald-900/30 border border-emerald-700/50 rounded-lg text-emerald-200 text-sm mb-4 animate-pulse">
          {success}
        </div>
      )}

      {/* Dual Column Layout */}
      <div className={`max-w-7xl mx-auto grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-8`}>
        {/* LEFT COLUMN - INPUT FORM */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 p-6 md:p-8">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span>✍️</span> Share Your Opportunity
          </h3>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Contact Info - Optional */}
            {!isAuthenticated && (
              <div className="space-y-4 pb-4 border-b border-slate-700">
                <div className="space-y-4">
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
                  <div>
                    <label className="block text-slate-300 text-sm mb-2">
                      Your Phone <span className="text-slate-500">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+63-9XX-XXX-XXXX"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* What They Can Offer */}
            <div className="space-y-3">
              <label className="block text-white font-semibold flex items-center gap-2">
                <span>🎁</span> What can you offer?
              </label>
              <p className="text-slate-400 text-xs">
                Products, services, time, skills, equipment, labor, advice...
              </p>
              <textarea
                value={whatICanOffer}
                onChange={(e) => setWhatICanOffer(e.target.value)}
                placeholder="e.g., 1000 coconuts/month, consulting, logistics..."
                rows={3}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 transition-all resize-none"
              />
            </div>

            {/* What They Need */}
            <div className="space-y-3">
              <label className="block text-white font-semibold flex items-center gap-2">
                <span>🔍</span> What do you need?
              </label>
              <p className="text-slate-400 text-xs">
                Buyers, suppliers, partnerships, equipment, expertise...
              </p>
              <textarea
                value={whatINeed}
                onChange={(e) => setWhatINeed(e.target.value)}
                placeholder="e.g., Quality buyers, packaging supplier, storage space..."
                rows={3}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all resize-none"
              />
            </div>

            {/* Additional Notes */}
            <div className="space-y-3">
              <label className="block text-white font-semibold flex items-center gap-2">
                <span>💬</span> Additional details
              </label>
              <p className="text-slate-400 text-xs">
                Location, timing, preferences, constraints...
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Based in Manila, available Q2 2025..."
                rows={2}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 transition-all resize-none"
              />
            </div>

            {/* Social Media Profiles */}
            <div className="space-y-3 pb-4 border-b border-slate-700">
              <label className="block text-white font-semibold flex items-center gap-2">
                <span>🔗</span> Social Media Profiles
              </label>
              <p className="text-slate-400 text-xs">
                Share your social media handles for easy connection (all optional)
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Twitter</label>
                  <input
                    type="text"
                    value={socialMedia.twitter}
                    onChange={(e) => setSocialMedia({ ...socialMedia, twitter: e.target.value })}
                    placeholder="@yourhandle"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">LinkedIn</label>
                  <input
                    type="text"
                    value={socialMedia.linkedin}
                    onChange={(e) => setSocialMedia({ ...socialMedia, linkedin: e.target.value })}
                    placeholder="yourprofile"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Instagram</label>
                  <input
                    type="text"
                    value={socialMedia.instagram}
                    onChange={(e) => setSocialMedia({ ...socialMedia, instagram: e.target.value })}
                    placeholder="@yourhandle"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Facebook</label>
                  <input
                    type="text"
                    value={socialMedia.facebook}
                    onChange={(e) => setSocialMedia({ ...socialMedia, facebook: e.target.value })}
                    placeholder="yourprofile"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Telegram</label>
                  <input
                    type="text"
                    value={socialMedia.telegram}
                    onChange={(e) => setSocialMedia({ ...socialMedia, telegram: e.target.value })}
                    placeholder="@yourhandle"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">WhatsApp</label>
                  <input
                    type="text"
                    value={socialMedia.whatsapp}
                    onChange={(e) => setSocialMedia({ ...socialMedia, whatsapp: e.target.value })}
                    placeholder="+63-9XX-XXX-XXXX"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Viber</label>
                  <input
                    type="text"
                    value={socialMedia.viber}
                    onChange={(e) => setSocialMedia({ ...socialMedia, viber: e.target.value })}
                    placeholder="+63-9XX-XXX-XXXX"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || (!whatICanOffer.trim() && !whatINeed.trim())}
              className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 disabled:from-slate-600 disabled:to-slate-600 text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
            >
              <span>{loading ? '⏳' : '✨'}</span>
              {loading ? 'Connecting...' : 'Share & Connect'}
            </button>

            <p className="text-slate-400 text-xs text-center">
              ✓ All fields are optional. Share what feels right.
            </p>
          </form>
        </div>

        {/* RIGHT COLUMN - SIGNATORIES TABLE */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 p-6 md:p-8">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span>📋</span> Active Opportunities
            <span className="ml-auto text-sm font-normal bg-slate-700 px-3 py-1 rounded-full text-slate-300">
              {signatories.length}
            </span>
          </h3>

          {loadingSignatories ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-slate-400">Loading opportunities...</p>
              </div>
            </div>
          ) : signatories.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-center">
              <div>
                <p className="text-4xl mb-3">🌱</p>
                <p className="text-slate-400">Be the first to share an opportunity!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {signatories.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 hover:border-slate-500 transition-colors"
                >
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-3 mb-3 pb-3 border-b border-slate-600">
                    <div className="flex-1">
                      <p className="text-white font-semibold text-sm">
                        {entry.contact_name || 'Anonymous'}
                      </p>
                      <div className="mt-1 space-y-1">
                        {entry.contact_email && (
                          <p className="text-slate-400 text-xs">
                            ✉️ {entry.contact_email}
                          </p>
                        )}
                        {entry.contact_phone && (
                          <p className="text-slate-400 text-xs">
                            📱 {entry.contact_phone}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Content Grid */}
                  <div className="space-y-3">
                    {entry.what_can_offer && (
                      <div className="space-y-1">
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">
                          ✨ Can Offer
                        </p>
                        <p className="text-slate-200 text-sm line-clamp-2">
                          {entry.what_can_offer}
                        </p>
                      </div>
                    )}

                    {entry.what_need && (
                      <div className="space-y-1">
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">
                          🔍 Looking For
                        </p>
                        <p className="text-slate-200 text-sm line-clamp-2">
                          {entry.what_need}
                        </p>
                      </div>
                    )}

                    {entry.notes && (
                      <div className="space-y-1">
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">
                          📝 Notes
                        </p>
                        <p className="text-slate-200 text-sm line-clamp-2">
                          {entry.notes}
                        </p>
                      </div>
                    )}

                    {entry.social_media && Object.values(entry.social_media).some(v => v) && (
                      <div className="space-y-1">
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">
                          🔗 Connect
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {entry.social_media.twitter && (
                            <a href={`https://twitter.com/${entry.social_media.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline">
                              Twitter
                            </a>
                          )}
                          {entry.social_media.linkedin && (
                            <a href={`https://linkedin.com/in/${entry.social_media.linkedin}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline">
                              LinkedIn
                            </a>
                          )}
                          {entry.social_media.instagram && (
                            <a href={`https://instagram.com/${entry.social_media.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline">
                              Instagram
                            </a>
                          )}
                          {entry.social_media.facebook && (
                            <a href={`https://facebook.com/${entry.social_media.facebook}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline">
                              Facebook
                            </a>
                          )}
                          {entry.social_media.telegram && (
                            <a href={`https://t.me/${entry.social_media.telegram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline">
                              Telegram
                            </a>
                          )}
                          {entry.social_media.whatsapp && (
                            <a href={`https://wa.me/${entry.social_media.whatsapp.replace(/[^\d+]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-green-400 text-xs hover:underline">
                              WhatsApp
                            </a>
                          )}
                          {entry.social_media.viber && (
                            <span className="text-purple-400 text-xs">
                              Viber: {entry.social_media.viber}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <button className="mt-3 w-full px-3 py-2 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors">
                    💬 Connect with {entry.contact_name?.split(' ')[0] || 'Partner'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* How This Works */}
      <div className={`mt-12 max-w-7xl mx-auto`}>
        <h3 className="text-2xl font-bold text-white mb-6 text-center">✨ How This Works</h3>
        <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
          <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-900/10 rounded-lg p-5 border border-emerald-700/30 text-center hover:border-emerald-600/50 transition-colors">
            <p className="text-4xl mb-3">1️⃣</p>
            <h4 className="text-white font-bold mb-2">You Share</h4>
            <p className="text-slate-400 text-sm">Tell us what you can offer and what you need</p>
          </div>
          <div className="bg-gradient-to-br from-blue-900/30 to-blue-900/10 rounded-lg p-5 border border-blue-700/30 text-center hover:border-blue-600/50 transition-colors">
            <p className="text-4xl mb-3">2️⃣</p>
            <h4 className="text-white font-bold mb-2">We Match</h4>
            <p className="text-slate-400 text-sm">Our system connects you with the right partners</p>
          </div>
          <div className="bg-gradient-to-br from-cyan-900/30 to-cyan-900/10 rounded-lg p-5 border border-cyan-700/30 text-center hover:border-cyan-600/50 transition-colors">
            <p className="text-4xl mb-3">3️⃣</p>
            <h4 className="text-white font-bold mb-2">You Connect</h4>
            <p className="text-slate-400 text-sm">Build relationships and grow your network</p>
          </div>
        </div>
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-2xl ${isMobile ? 'w-full' : 'w-full max-w-md'}`}>
            {/* Modal Header */}
            <div className="border-b border-slate-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span>🔐</span> Create Your Account
              </h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false)
                  setPassword('')
                  setConfirmPassword('')
                  setPasswordError('')
                }}
                className="text-slate-400 hover:text-white text-2xl font-bold leading-none"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-6 space-y-4">
              <p className="text-slate-300 text-sm">
                Complete your profile by setting a secure password. We'll automatically sign you in.
              </p>

              {passwordError && (
                <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-200 text-sm">
                  <p className="flex items-center gap-2"><span>❌</span> {passwordError}</p>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                {/* Email Display */}
                <div>
                  <label className="block text-slate-300 text-sm mb-2">Email</label>
                  <input
                    type="email"
                    value={newUserEmail}
                    disabled
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-400 cursor-not-allowed"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-slate-300 text-sm mb-2">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                    disabled={passwordLoading}
                  />
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-slate-300 text-sm mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                    disabled={passwordLoading}
                  />
                </div>

                {/* Submit Button */}
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordModal(false)
                      setPassword('')
                      setConfirmPassword('')
                      setPasswordError('')
                    }}
                    className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-all"
                    disabled={passwordLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={passwordLoading || !password || !confirmPassword}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 disabled:from-slate-600 disabled:to-slate-600 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <span>{passwordLoading ? '⏳' : '✨'}</span>
                    {passwordLoading ? 'Creating Account...' : 'Create Account'}
                  </button>
                </div>

                {/* Security Info */}
                <p className="text-slate-400 text-xs text-center pt-2">
                  🔒 Your password is encrypted and stored securely
                </p>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
