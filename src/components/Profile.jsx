import { useState, useEffect } from 'react'
import { wisegcashAPI } from '../lib/wisegcashAPI'

export default function Profile({ userId }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadUser()
  }, [userId])

  const loadUser = async () => {
    try {
      const userData = await wisegcashAPI.getUserById(userId)
      setUser(userData)
      setFormData(userData)
    } catch (err) {
      console.error('Error loading user:', err)
      setError('Failed to load user profile')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setError('')

    try {
      await wisegcashAPI.updateUserProfile(userId, {
        full_name: formData.full_name,
        phone_number: formData.phone_number,
        country_code: formData.country_code
      })
      setSuccess('Profile updated successfully!')
      loadUser()
      setEditing(false)
      setTimeout(() => setSuccess(''), 2000)
    } catch (err) {
      setError(err.message || 'Failed to update profile')
    }
  }

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
            <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl mx-auto mb-4 font-light">
              {user?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?'}
            </div>
            <h3 className="text-2xl font-light text-slate-900">{user?.full_name || 'User'}</h3>
            <p className="text-slate-500 text-sm mt-1">{user?.email}</p>
          </div>

          <div className="border-t border-slate-100 pt-6 space-y-4">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Status</p>
              <p className="text-sm text-slate-900 capitalize">{user?.status}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Country</p>
              <p className="text-sm text-slate-900">{user?.country_code}</p>
            </div>

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
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={formData.full_name || ''}
                    onChange={e => setFormData({...formData, full_name: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                  />
                </div>

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

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Country Code</label>
                  <input
                    type="text"
                    value={formData.country_code || ''}
                    onChange={e => setFormData({...formData, country_code: e.target.value.toUpperCase()})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    placeholder="PH"
                    maxLength="5"
                  />
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

                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Email</p>
                  <p className="text-lg text-slate-900">{user?.email}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Phone Number</p>
                  <p className="text-lg text-slate-900">{formData.phone_number || '-'}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Country Code</p>
                  <p className="text-lg text-slate-900">{formData.country_code}</p>
                </div>
              </div>
            )}
          </div>

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
