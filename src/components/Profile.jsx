import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { wisegcashAPI } from '../lib/wisegcashAPI'

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

const RELATIONSHIP_STATUS = ['Single', 'In a relationship', 'Engaged', 'Married', 'It\'s complicated', 'Prefer not to say']

export default function Profile({ userId }) {
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

  useEffect(() => {
    loadUser()
  }, [userId])

  const loadUser = async () => {
    try {
      const userData = await wisegcashAPI.getUserById(userId)
      setUser(userData)
      setFormData({
        full_name: userData?.full_name || '',
        email: userData?.email || '',
        phone_number: userData?.phone_number || '',
        username: userData?.username || '',
        country_code: userData?.country_code || 'PH',
        relationship_status: userData?.relationship_status || '',
        biography: userData?.biography || '',
        profile_picture_url: userData?.profile_picture_url || ''
      })

      // Load privacy settings
      const { data: privacyData } = await supabase
        .from('privacy_settings')
        .select('*')
        .eq('user_id', userId)

      const privacyMap = {}
      privacyData?.forEach(setting => {
        privacyMap[setting.field_name] = setting.visibility
      })
      setPrivacySettings(privacyMap)
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

    try {
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single()

      setUsernameAvailable(!data)
    } catch (err) {
      setUsernameAvailable(true)
    }
  }

  const handleUsernameChange = (value) => {
    setFormData({ ...formData, username: value })
    checkUsernameAvailability(value)
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setError('')

    if (formData.username && !usernameAvailable) {
      setError('Username is not available')
      return
    }

    try {
      const updateData = {
        full_name: formData.full_name,
        phone_number: formData.phone_number,
        country_code: formData.country_code,
        username: formData.username || null,
        relationship_status: formData.relationship_status || null,
        biography: formData.biography || null,
        profile_picture_url: formData.profile_picture_url || null
      }

      await wisegcashAPI.updateUserProfile(userId, updateData)

      // Save privacy settings
      for (const [field, visibility] of Object.entries(privacySettings)) {
        const { data: existing } = await supabase
          .from('privacy_settings')
          .select('id')
          .eq('user_id', userId)
          .eq('field_name', field)
          .single()

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

      setSuccess('Profile updated successfully!')
      loadUser()
      setEditing(false)
      setTimeout(() => setSuccess(''), 2000)
    } catch (err) {
      setError(err.message || 'Failed to update profile')
    }
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

  const getSelectedCountry = () => {
    return COUNTRIES.find(c => c.code === formData.country_code)
  }

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.code.toLowerCase().includes(countrySearch.toLowerCase())
  )

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center text-slate-500">Loading profile...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <h2 className="text-3xl font-light text-slate-900 mb-12 tracking-tight">Profile</h2>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-8">
          <div className="text-center mb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-4xl mx-auto mb-4 font-light overflow-hidden">
              {formData.profile_picture_url ? (
                <img src={formData.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                formData.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?'
              )}
            </div>
            <h3 className="text-2xl font-light text-slate-900">{formData.full_name || 'User'}</h3>
            {formData.username && (
              <p className="text-slate-500 text-sm mt-1">@{formData.username}</p>
            )}
            <p className="text-slate-500 text-sm mt-1">{user?.email}</p>
            {getSelectedCountry() && (
              <p className="text-xl mt-3">{getSelectedCountry().flag}</p>
            )}
          </div>

          <div className="border-t border-slate-100 pt-6 space-y-4">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Status</p>
              <p className="text-sm text-slate-900 capitalize">{user?.status}</p>
            </div>

            {formData.relationship_status && (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Relationship</p>
                <p className="text-sm text-slate-900">{formData.relationship_status}</p>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Member Since</p>
              <p className="text-sm text-slate-900">
                {new Date(user?.created_at).toLocaleDateString()}
              </p>
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

        {/* Edit Profile Form */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-light text-slate-900">Profile Information</h3>
              <button
                onClick={() => setEditing(!editing)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  editing
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'text-blue-600 hover:bg-blue-50'
                }`}
              >
                {editing ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {editing ? (
              <form onSubmit={handleSaveProfile} className="space-y-6">
                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={formData.full_name || ''}
                    onChange={e => setFormData({...formData, full_name: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>

                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Username (for Poker & Leaderboards)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={formData.username || ''}
                      onChange={e => handleUsernameChange(e.target.value)}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      placeholder="choose_your_username"
                    />
                    {formData.username && (
                      <span className={`text-sm font-medium ${usernameAvailable ? 'text-emerald-600' : 'text-red-600'}`}>
                        {usernameAvailable ? '✓ Available' : '✗ Taken'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">3-20 characters, letters and numbers only</p>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone_number || ''}
                    onChange={e => setFormData({...formData, phone_number: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    placeholder="+63..."
                  />
                </div>

                {/* Country with Search and Flag */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Country</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white"
                    >
                      <span>
                        {getSelectedCountry() && `${getSelectedCountry().flag} ${getSelectedCountry().name}`}
                        {!getSelectedCountry() && 'Select Country'}
                      </span>
                      <span>▼</span>
                    </button>

                    {showCountryDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                        <input
                          type="text"
                          placeholder="Search country..."
                          value={countrySearch}
                          onChange={e => setCountrySearch(e.target.value)}
                          className="w-full px-4 py-2 border-b border-slate-200 focus:outline-none text-sm"
                        />
                        {filteredCountries.map(country => (
                          <button
                            key={country.code}
                            type="button"
                            onClick={() => {
                              setFormData({...formData, country_code: country.code})
                              setShowCountryDropdown(false)
                              setCountrySearch('')
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-slate-100 text-sm flex items-center gap-2"
                          >
                            <span>{country.flag}</span>
                            <span>{country.name}</span>
                            <span className="text-slate-500 text-xs ml-auto">{country.code}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Relationship Status */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Relationship Status</label>
                  <select
                    value={formData.relationship_status || ''}
                    onChange={e => setFormData({...formData, relationship_status: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  >
                    <option value="">Not specified</option>
                    {RELATIONSHIP_STATUS.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                {/* Biography */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Biography</label>
                  <textarea
                    value={formData.biography || ''}
                    onChange={e => setFormData({...formData, biography: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    placeholder="Tell us about yourself..."
                    rows="4"
                    maxLength={500}
                  />
                  <p className="text-xs text-slate-500 mt-1">{(formData.biography || '').length}/500</p>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Save Changes
                </button>
              </form>
            ) : (
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Full Name</p>
                  <p className="text-lg text-slate-900">{formData.full_name || '-'}</p>
                </div>

                {formData.username && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Username</p>
                    <p className="text-lg text-slate-900">@{formData.username}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Email</p>
                  <p className="text-lg text-slate-900">{user?.email}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Phone Number</p>
                  <p className="text-lg text-slate-900">{formData.phone_number || '-'}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Country</p>
                  <p className="text-lg text-slate-900">
                    {getSelectedCountry() && `${getSelectedCountry().flag} ${getSelectedCountry().name}`}
                  </p>
                </div>

                {formData.relationship_status && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Relationship Status</p>
                    <p className="text-lg text-slate-900">{formData.relationship_status}</p>
                  </div>
                )}

                {formData.biography && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Biography</p>
                    <p className="text-lg text-slate-900">{formData.biography}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Privacy Settings */}
          {editing && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 mt-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-slate-900">Privacy Controls</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleAllPrivacy('everyone')}
                    className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700"
                  >
                    Show All
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAllPrivacy('only_me')}
                    className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700"
                  >
                    Hide All
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {['full_name', 'phone_number', 'country_code', 'relationship_status', 'biography'].map(field => (
                  <div key={field} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <span className="text-sm font-medium text-slate-900 capitalize">{field.replace(/_/g, ' ')}</span>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenPrivacyDropdown(openPrivacyDropdown === field ? null : field)}
                        className="text-sm px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 text-slate-700 flex items-center gap-1"
                      >
                        {getPrivacyLabel(privacySettings[field] || 'everyone')}
                        <span>▼</span>
                      </button>

                      {openPrivacyDropdown === field && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-20 min-w-max">
                          {['everyone', 'friends_only', 'only_me'].map(visibility => (
                            <button
                              key={visibility}
                              type="button"
                              onClick={() => setPrivacy(field, visibility)}
                              className="block w-full text-left px-4 py-2 hover:bg-slate-50 text-sm"
                            >
                              {getPrivacyLabel(visibility)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-8 mt-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Security</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900 text-sm">Two-Factor Authentication</p>
                  <p className="text-xs text-slate-500 mt-1">Add extra security to your account</p>
                </div>
                <button className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium text-sm">
                  Enable
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900 text-sm">Change Password</p>
                  <p className="text-xs text-slate-500 mt-1">Update your password regularly</p>
                </div>
                <button className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium text-sm">
                  Change
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
