import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { wisegcashAPI } from '../lib/payments'
import { preferencesManager } from '../lib/preferencesManager'
import { deviceFingerprint } from '../lib/deviceFingerprint'

const COUNTRIES = [
  { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼' }
]

const RELATIONSHIP_STATUS = ['Single', 'In a relationship', 'Engaged', 'Married', "It's complicated", 'Prefer not to say']

export default function Profile({ userId, onSignOut }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({})
  const [privacySettings, setPrivacySettings] = useState({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [usernameAvailable, setUsernameAvailable] = useState(null)
  const [countrySearch, setCountrySearch] = useState('')
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [phoneCountrySearch, setPhoneCountrySearch] = useState('')
  const [showPhoneCountryDropdown, setShowPhoneCountryDropdown] = useState(false)
  const [openPrivacyDropdown, setOpenPrivacyDropdown] = useState(null)
  const [displayNameType, setDisplayNameType] = useState('full_name')
  const [emailEditable, setEmailEditable] = useState(false)
  const [autoScrollToTop, setAutoScrollToTop] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState(null)

  const isValidUUID = (id) => {
    return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  }

  const isGuestAccount = userId && userId.includes('guest')

  useEffect(() => {
    loadUser()
    loadDeviceInfo()
    setAutoScrollToTop(preferencesManager.getAutoScrollToTop(userId))
  }, [userId])

  const loadDeviceInfo = async () => {
    try {
      const stored = deviceFingerprint.retrieve()
      if (stored) {
        setDeviceInfo({
          fingerprint: stored.fingerprint,
          timestamp: new Date(stored.timestamp).toLocaleDateString(),
          expiresAt: new Date(stored.expiresAt).toLocaleDateString()
        })
      }
    } catch (error) {
      console.warn('Error loading device info:', error)
    }
  }

  const handleSignOut = async () => {
    try {
      setSigningOut(true)

      // Clear device fingerprint
      deviceFingerprint.clear()

      // Sign out from Supabase
      await supabase.auth.signOut()

      // Callback to parent component
      if (onSignOut) {
        onSignOut()
      }

      // Redirect or reset state
      setSuccess('Signed out successfully')
      setTimeout(() => {
        window.location.href = '/'
      }, 1000)
    } catch (err) {
      setError('Failed to sign out: ' + (err.message || 'Unknown error'))
    } finally {
      setSigningOut(false)
    }
  }

  const loadUser = async () => {
    try {
      if (!isValidUUID(userId)) {
        setUser({ id: userId, email: 'guest@currency.ph', full_name: 'Guest', status: 'active' })
        setFormData({ full_name: 'Guest', email: 'guest@currency.ph', phone_number: '', phone_country_code: 'PH', username: 'guest', country_code: 'PH', relationship_status: '', biography: '', profile_picture_url: '', display_name_type: 'full_name', display_as_username_everywhere: false })
        setLoading(false)
        return
      }

      try {
        const userData = await wisegcashAPI.getUserById(userId)
        setUser(userData)
        setFormData({ full_name: userData?.full_name || '', email: userData?.email || '', phone_number: userData?.phone_number || '', phone_country_code: userData?.phone_country_code || 'PH', username: userData?.username || '', country_code: userData?.country_code || 'PH', relationship_status: userData?.relationship_status || '', biography: userData?.biography || '', profile_picture_url: userData?.profile_picture_url || '', display_name_type: userData?.display_name_type || 'full_name', display_as_username_everywhere: userData?.display_as_username_everywhere || false })
        setDisplayNameType(userData?.display_name_type || 'full_name')

        const { data: privacyData } = await supabase
          .from('privacy_settings')
          .select('*')
          .eq('user_id', userId)

        const privacyMap = {}
        privacyData?.forEach(setting => { privacyMap[setting.field_name] = setting.visibility })
        setPrivacySettings(privacyMap)
      } catch (profileErr) {
        console.error('Error loading user profile:', profileErr)
        setUser({ id: userId, email: 'user@example.com', status: 'active' })
        setFormData({ full_name: '', email: 'user@example.com', phone_number: '', phone_country_code: 'PH', username: '', country_code: 'PH', relationship_status: '', biography: '', profile_picture_url: '', display_name_type: 'full_name', display_as_username_everywhere: false })
      }
    } catch (err) {
      console.error('Error loading user:', err)
      setError('Failed to load user profile')
    } finally {
      setLoading(false)
    }
  }

  const checkUsernameAvailability = async (username) => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null)
      return
    }

    if (isGuestAccount && !isValidUUID(userId)) {
      setUsernameAvailable(true)
      return
    }

    try {
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .limit(1)

      setUsernameAvailable(!(Array.isArray(data) && data.length > 0))
    } catch (err) {
      setUsernameAvailable(true)
    }
  }

  const handleUsernameChange = (value) => {
    setFormData({ ...formData, username: value })
    checkUsernameAvailability(value)
  }

  const saveProfileToServer = async (silent = false) => {
    if (isGuestAccount && !isValidUUID(userId)) {
      if (!silent) setError('Guest accounts cannot modify profile settings. Please create an account to save your changes.')
      return
    }

    if (formData.username && !usernameAvailable) {
      if (!silent) setError('Username is not available')
      return
    }

    try {
      const updateData = { full_name: formData.full_name, phone_number: formData.phone_number, phone_country_code: formData.phone_country_code, country_code: formData.country_code, username: formData.username || null, relationship_status: formData.relationship_status || null, biography: formData.biography || null, profile_picture_url: formData.profile_picture_url || null, display_name_type: formData.display_name_type, display_as_username_everywhere: formData.display_as_username_everywhere, email: formData.email || null }

      await wisegcashAPI.updateUserProfile(userId, updateData)

      try {
        const currentUserRes = await supabase.auth.getUser()
        const authEmail = currentUserRes?.data?.user?.email || currentUserRes?.user?.email
        if (formData.email && authEmail && formData.email !== authEmail) {
          try {
            await supabase.auth.updateUser({ email: formData.email })
          } catch (e) {
            console.debug('Could not update auth email:', e?.message || e)
          }
        }
      } catch (e) {
        console.debug('Auth email check/update failed:', e?.message || e)
      }

      if (isValidUUID(userId)) {
        for (const [field, visibility] of Object.entries(privacySettings)) {
          const { data: existingArr } = await supabase
            .from('privacy_settings')
            .select('id')
            .eq('user_id', userId)
            .eq('field_name', field)
            .limit(1)

          const existing = Array.isArray(existingArr) && existingArr.length > 0 ? existingArr[0] : null

          if (existing) {
            await supabase
              .from('privacy_settings')
              .update({ visibility })
              .eq('id', existing.id)
          } else {
            await supabase
              .from('privacy_settings')
              .insert([{ user_id: userId, field_name: field, visibility }])
          }
        }

        // If user set their account to private in listed_in_all, also mark presence as 'hide'
        try {
          if (privacySettings['listed_in_all'] === 'only_me') {
            const { data: presArr } = await supabase
              .from('privacy_settings')
              .select('id')
              .eq('user_id', userId)
              .eq('field_name', 'presence_status')
              .limit(1)

            const existingPres = Array.isArray(presArr) && presArr.length > 0 ? presArr[0] : null
            if (existingPres) {
              await supabase.from('privacy_settings').update({ visibility: 'hide' }).eq('id', existingPres.id)
            } else {
              await supabase.from('privacy_settings').insert([{ user_id: userId, field_name: 'presence_status', visibility: 'hide' }])
            }
          }
        } catch (e) {
          console.debug('Failed to sync presence status with privacy:', e)
        }
      }

      if (!silent) {
        setSuccess('Profile updated successfully!')
        setEditing(false)
        setTimeout(() => setSuccess(''), 2000)
      }
    } catch (err) {
      if (!silent) setError(err.message || 'Failed to update profile')
    }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setError('')
    await saveProfileToServer()
  }

  const setPrivacy = (field, visibility) => {
    setPrivacySettings({ ...privacySettings, [field]: visibility })
    setOpenPrivacyDropdown(null)
  }

  const toggleAllPrivacy = (visibility) => {
    const fields = ['full_name', 'phone_number', 'country_code', 'relationship_status', 'biography']
    const newSettings = {}
    fields.forEach(f => newSettings[f] = visibility)
    setPrivacySettings(newSettings)
  }

  const getPrivacyLabel = (visibility) => {
    const labels = { everyone: '👥 Everyone', friends_only: '👫 Friends', only_me: '🔒 Only Me' }
    return labels[visibility] || 'Everyone'
  }

  const getSelectedCountry = () => COUNTRIES.find(c => c.code === formData.country_code)
  const getSelectedPhoneCountry = () => COUNTRIES.find(c => c.code === formData.phone_country_code)

  const getDisplayNamePreview = () => {
    const type = formData.display_name_type
    if (type === 'username') return `@${formData.username}`
    if (type === 'first_name') {
      const names = (formData.full_name || '').split(' ')
      return names[0] || 'User'
    }
    if (type === 'last_name') {
      const names = (formData.full_name || '').split(' ')
      return names.length > 1 ? names[names.length - 1] : 'User'
    }
    return formData.full_name || 'User'
  }

  const filteredCountries = COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()) || c.code.toLowerCase().includes(countrySearch.toLowerCase()))

  if (loading) {
    return (<div className="max-w-7xl mx-auto px-6 py-6"><div className="text-center text-slate-500">Loading profile...</div></div>)
  }

  const isAccountPrivate = () => (privacySettings['listed_in_all'] === 'only_me')

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <h2 className="text-3xl font-light text-slate-900 mb-6 tracking-tight">Profile</h2>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      {isGuestAccount && !isValidUUID(userId) && (<div className="mb-6 p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">You are logged in as a guest. Create an account to save profile changes and access more features.</div>)}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="text-center mb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-4xl mx-auto mb-4 font-light overflow-hidden">
              {formData.profile_picture_url ? (<img src={formData.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />) : (formData.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?')}
            </div>
            <h3 className="text-2xl font-light text-slate-900">{getDisplayNamePreview()}</h3>
            <p className="text-slate-500 text-sm mt-1">{user?.email}</p>
            {getSelectedCountry() && (<p className="text-xl mt-3">{getSelectedCountry().flag}</p>)}
          </div>

          <div className="border-t border-slate-100 pt-6 space-y-4">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Status</p>
              <p className="text-sm text-slate-900 capitalize">{user?.status}</p>
            </div>

            {formData.relationship_status && (<div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Relationship</p><p className="text-sm text-slate-900">{formData.relationship_status}</p></div>)}

            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Member Since</p>
              <p className="text-sm text-slate-900">{new Date(user?.created_at).toLocaleDateString()}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Verification</p>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${user?.kyc_verified ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                <p className="text-sm text-slate-900">{user?.kyc_verified ? 'Verified' : 'Not Verified'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-light text-slate-900">Profile Information</h3>
              <button onClick={() => setEditing(!editing)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${editing ? 'text-slate-600 hover:bg-slate-100' : 'text-blue-600 hover:bg-blue-50'}`}>{editing ? 'Cancel' : 'Edit'}</button>
            </div>

            {editing ? (
              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Username</label>
                  <div className="flex items-center gap-2">
                    <input type="text" value={formData.username || ''} onChange={e => handleUsernameChange(e.target.value)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent" placeholder="Enter a display name here" />
                    {formData.username && (<span className={`text-sm font-medium ${usernameAvailable ? 'text-emerald-600' : 'text-red-600'}`}>{usernameAvailable ? '✓ Available' : '✗ Taken'}</span>)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">3-20 characters, letters and numbers only</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                  <input type="text" value={formData.full_name || ''} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent" />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-slate-900 mb-3">How should your name appear?</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer"><input type="radio" name="display_name_type" value="username" checked={formData.display_name_type === 'username'} onChange={e => setFormData({...formData, display_name_type: 'username'})} className="w-4 h-4" /><span className="text-sm text-slate-700">Username</span></label>

                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-3 cursor-pointer"><input type="radio" name="display_name_type" value="first_name" checked={formData.display_name_type === 'first_name'} onChange={e => setFormData({...formData, display_name_type: 'first_name'})} className="w-4 h-4" /><span className="text-sm text-slate-700">First Name</span></label>

                      <label className="flex items-center gap-3 cursor-pointer"><input type="radio" name="display_name_type" value="last_name" checked={formData.display_name_type === 'last_name'} onChange={e => setFormData({...formData, display_name_type: 'last_name'})} className="w-4 h-4" /><span className="text-sm text-slate-700">Last Name</span></label>

                      <label className="flex items-center gap-3 cursor-pointer"><input type="radio" name="display_name_type" value="full_name" checked={formData.display_name_type === 'full_name'} onChange={e => setFormData({...formData, display_name_type: 'full_name'})} className="w-4 h-4" /><span className="text-sm text-slate-700">Full Name</span></label>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-blue-200"><p className="text-xs text-slate-600">Preview: <span className="font-semibold text-slate-900">{getDisplayNamePreview()}</span></p></div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-lg hover:bg-slate-100"><input type="checkbox" checked={formData.display_as_username_everywhere || false} onChange={e => setFormData({...formData, display_as_username_everywhere: e.target.checked})} className="w-4 h-4" /><span className="text-sm font-medium text-slate-700">Display as username everywhere</span></label>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                    {!emailEditable ? (<button type="button" onClick={() => setEmailEditable(true)} className="text-sm text-blue-600 hover:underline">Update email</button>) : (<div className="flex items-center gap-2"><button type="button" onClick={() => { setFormData({...formData, email: user?.email || ''}); setEmailEditable(false) }} className="text-sm text-slate-600 hover:underline">Cancel</button><button type="button" onClick={() => { document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true })); setEmailEditable(false) }} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Save</button></div>)}
                  </div>

                  <input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} disabled={!emailEditable} className={`w-full px-4 py-2 border rounded-lg focus:outline-none ${emailEditable ? 'focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white text-slate-900' : 'bg-slate-50 text-slate-500 cursor-not-allowed border-slate-300'}`} />
                  <p className="text-xs text-slate-500 mt-1">Changing your email will also attempt to update your authentication email (may require confirmation).</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                  <div className="flex gap-2">
                    <div className="w-20 relative">
                      <button type="button" onClick={() => setShowPhoneCountryDropdown(!showPhoneCountryDropdown)} className="w-full px-2 py-2 border border-slate-300 rounded-lg text-left text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white">{getSelectedPhoneCountry()?.flag || '🌍'}</button>

                      {showPhoneCountryDropdown && (<div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto"><input type="text" placeholder="Search..." value={phoneCountrySearch} onChange={e => setPhoneCountrySearch(e.target.value)} className="w-full px-2 py-1 border-b border-slate-200 focus:outline-none text-xs" />{COUNTRIES.filter(c => c.name.toLowerCase().includes(phoneCountrySearch.toLowerCase()) || c.code.toLowerCase().includes(phoneCountrySearch.toLowerCase())).map(country => (<button key={country.code} type="button" onClick={() => { setFormData({...formData, phone_country_code: country.code}); setShowPhoneCountryDropdown(false); setPhoneCountrySearch('') }} className="w-full text-left px-2 py-1 hover:bg-slate-100 text-xs flex items-center gap-1"><span>{country.flag}</span><span className="text-slate-600">{country.code}</span></button>))}</div>)}
                    </div>
                    <input type="tel" value={formData.phone_number || ''} onChange={e => setFormData({...formData, phone_number: e.target.value})} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent" placeholder="9123456789" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Country</label>
                  <div className="relative">
                    <button type="button" onClick={() => setShowCountryDropdown(!showCountryDropdown)} className="w-full px-4 py-2 border border-slate-300 rounded-lg text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white"><span>{getSelectedCountry() && `${getSelectedCountry().flag} ${getSelectedCountry().name}`}{!getSelectedCountry() && 'Select Country'}</span><span>▼</span></button>

                    {showCountryDropdown && (<div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto"><input type="text" placeholder="Search country..." value={countrySearch} onChange={e => setCountrySearch(e.target.value)} className="w-full px-4 py-2 border-b border-slate-200 focus:outline-none text-sm" />{filteredCountries.map(country => (<button key={country.code} type="button" onClick={() => { setFormData({...formData, country_code: country.code}); setShowCountryDropdown(false); setCountrySearch('') }} className="w-full text-left px-4 py-2 hover:bg-slate-100 text-sm flex items-center gap-2"><span>{country.flag}</span><span>{country.name}</span><span className="text-slate-500 text-xs ml-auto">{country.code}</span></button>))}</div>)}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Relationship Status</label>
                  <select value={formData.relationship_status || ''} onChange={e => setFormData({...formData, relationship_status: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"><option value="">Not specified</option>{RELATIONSHIP_STATUS.map(status => (<option key={status} value={status}>{status}</option>))}</select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Biography</label>
                  <textarea value={formData.biography || ''} onChange={e => setFormData({...formData, biography: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent" placeholder="Tell us about yourself..." rows="4" maxLength={500} />
                  <p className="text-xs text-slate-500 mt-1">{(formData.biography || '').length}/500</p>
                </div>

                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">Save Changes</button>
                {success && (<div className="mt-3 text-sm text-emerald-700" role="status" aria-live="polite">{success}</div>)}
              </form>
            ) : (
              <div className="space-y-6">
                {formData.username && (<div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Username</p><p className="text-lg text-slate-900">@{formData.username}</p></div>)}

                <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Full Name</p><p className="text-lg text-slate-900">{formData.full_name || '-'}</p></div>

                {formData.display_name_type && (<div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Display As</p><p className="text-lg text-slate-900 capitalize">{formData.display_name_type.replace(/_/g, ' ')}</p></div>)}

                <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Email</p><p className="text-lg text-slate-900">{user?.email}</p></div>

                <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Phone Number</p><p className="text-lg text-slate-900">{formData.phone_number ? `${getSelectedPhoneCountry()?.flag || ''} ${formData.phone_number}` : '-'}</p></div>

                <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Country</p><p className="text-lg text-slate-900">{getSelectedCountry() && `${getSelectedCountry().flag} ${getSelectedCountry().name}`}</p></div>

                {formData.relationship_status && (<div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Relationship Status</p><p className="text-lg text-slate-900">{formData.relationship_status}</p></div>)}

                {formData.biography && (<div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Biography</p><p className="text-lg text-slate-900">{formData.biography}</p></div>)}
              </div>
            )}
          </div>

          {editing && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 mt-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-slate-900">Privacy Controls</h3>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => toggleAllPrivacy('everyone')} className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700">Show All</button>
                  <button type="button" onClick={() => toggleAllPrivacy('only_me')} className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700">Hide All</button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Hide my profile from the All users list</p>
                    <p className="text-xs text-slate-500">When enabled, your account will not appear in the Messages {'>'} All tab for other users.</p>
                  </div>
                  <div>
                    <input type="checkbox" checked={isAccountPrivate()} onChange={(e) => setPrivacy('listed_in_all', e.target.checked ? 'only_me' : 'everyone')} className="w-4 h-4" />
                  </div>
                </div>

                {['full_name', 'phone_number', 'country_code', 'relationship_status', 'biography'].map(field => (
                  <div key={field} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <span className="text-sm font-medium text-slate-900 capitalize">{field.replace(/_/g, ' ')}</span>
                    <div className="relative">
                      <button type="button" onClick={() => setOpenPrivacyDropdown(openPrivacyDropdown === field ? null : field)} className="text-sm px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 text-slate-700 flex items-center gap-1">{getPrivacyLabel(privacySettings[field] || 'everyone')}<span>▼</span></button>

                      {openPrivacyDropdown === field && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-20 min-w-max">
                          {['everyone', 'friends_only', 'only_me'].map(visibility => (
                            <button key={visibility} type="button" onClick={() => setPrivacy(field, visibility)} className="block w-full text-left px-4 py-2 hover:bg-slate-50 text-sm">{getPrivacyLabel(visibility)}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-6 mt-4">
            <h3 className="text-lg font-medium text-slate-900 mb-3">Preferences</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900 text-sm">Auto-scroll to top</p>
                  <p className="text-xs text-slate-500 mt-1">Automatically scroll to the top when changing pages, tabs, or opening modals</p>
                </div>
                <button
                  onClick={() => {
                    const newValue = !autoScrollToTop
                    setAutoScrollToTop(newValue)
                    preferencesManager.setAutoScrollToTop(userId, newValue)
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoScrollToTop ? 'bg-emerald-600' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoScrollToTop ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 mt-4">
            <h3 className="text-lg font-medium text-slate-900 mb-3">Security</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900 text-sm">Two-Factor Authentication</p>
                  <p className="text-xs text-slate-500 mt-1">Add extra security to your account</p>
                </div>
                <button className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium text-sm">Enable</button>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900 text-sm">Change Password</p>
                  <p className="text-xs text-slate-500 mt-1">Update your password regularly</p>
                </div>
                <button className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium text-sm">Change</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
