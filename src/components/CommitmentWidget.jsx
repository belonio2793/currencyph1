import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import Auth from './Auth'

export default function CommitmentWidget() {
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAuthModal, setShowAuthModal] = useState(false)
  
  const [formData, setFormData] = useState({
    item_type: 'coconut',
    item_description: '',
    quantity: '',
    quantity_unit: 'tons',
    scheduled_interval: 'monthly',
    interval_count: 1,
    unit_price: '',
    currency: 'PHP',
    notes: ''
  })

  useEffect(() => {
    // Check if user is authenticated
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setIsLoading(false)
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session)
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!session?.user?.id) {
      setShowAuthModal(true)
      return
    }

    setError('')
    setSuccess('')
    setIsSubmitting(true)

    try {
      // First, get or create commitment profile
      const { data: profileData, error: profileError } = await supabase
        .from('commitment_profiles')
        .select('id')
        .eq('user_id', session.user.id)
        .single()

      let profileId = profileData?.id

      // If profile doesn't exist, create one
      if (!profileId) {
        const { data: newProfile, error: createProfileError } = await supabase
          .from('commitment_profiles')
          .insert({
            user_id: session.user.id,
            email: session.user.email,
            profile_completed: false
          })
          .select('id')
          .single()

        if (createProfileError) throw createProfileError
        profileId = newProfile.id
      }

      // Now create the commitment
      const commitmentData = {
        user_id: session.user.id,
        commitment_profile_id: profileId,
        status: 'active',
        item_type: formData.item_type,
        item_description: formData.item_description,
        quantity: parseFloat(formData.quantity),
        quantity_unit: formData.quantity_unit,
        scheduled_interval: formData.scheduled_interval,
        interval_count: parseInt(formData.interval_count),
        unit_price: parseFloat(formData.unit_price),
        currency: formData.currency,
        notes: formData.notes || ''
      }

      const { error: commitmentError } = await supabase
        .from('commitments')
        .insert([commitmentData])

      if (commitmentError) throw commitmentError

      setSuccess('Your commitment has been recorded! Thank you for joining the ecosystem.')
      setFormData({
        item_type: 'coconut',
        item_description: '',
        quantity: '',
        quantity_unit: 'tons',
        scheduled_interval: 'monthly',
        interval_count: 1,
        unit_price: '',
        currency: 'PHP',
        notes: ''
      })

      setTimeout(() => setSuccess(''), 5000)
    } catch (err) {
      setError(err.message || 'Failed to save commitment')
      console.error('Commitment error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-8 border border-gray-200">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-gradient-to-br from-amber-50 to-white rounded-xl p-8 border-2 border-amber-300 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span className="text-3xl">🤝</span>
              Make Your Commitment
            </h3>
            <p className="text-gray-600 mt-2">
              {session ? 'Join our ecosystem by pledging your contribution' : 'Sign in to pledge your contribution to the coconut ecosystem'}
            </p>
          </div>
        </div>

        {!session ? (
          <div className="space-y-4">
            <div className="p-6 bg-white rounded-lg border border-amber-200">
              <h4 className="font-semibold text-gray-900 mb-3">How It Works:</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 font-bold mt-0.5">1.</span>
                  <span>Sign in with your account</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 font-bold mt-0.5">2.</span>
                  <span>Specify what you can commit to (coconuts, equipment, services, etc.)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 font-bold mt-0.5">3.</span>
                  <span>Your commitment is recorded and tracked transparently</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 font-bold mt-0.5">4.</span>
                  <span>Earn proportional returns based on your contribution</span>
                </li>
              </ul>
            </div>
            
            <button
              onClick={() => setShowAuthModal(true)}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Sign In to Commit →
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                {success}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What are you committing?
                </label>
                <select
                  name="item_type"
                  value={formData.item_type}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
                >
                  <option value="coconut">Fresh Coconuts</option>
                  <option value="equipment">Equipment/Machinery</option>
                  <option value="labour">Labour Services</option>
                  <option value="warehouse">Warehouse Space</option>
                  <option value="transportation">Transportation</option>
                  <option value="processing">Processing Services</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleChange}
                    placeholder="0"
                    step="0.01"
                    min="0"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    required
                  />
                  <select
                    name="quantity_unit"
                    value={formData.quantity_unit}
                    onChange={handleChange}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
                  >
                    <option value="tons">Tons</option>
                    <option value="kg">KG</option>
                    <option value="pieces">Pieces</option>
                    <option value="liters">Liters</option>
                    <option value="hours">Hours</option>
                    <option value="units">Units</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit Price
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="unit_price"
                    value={formData.unit_price}
                    onChange={handleChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    required
                  />
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
                  >
                    <option value="PHP">PHP</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Schedule
                </label>
                <div className="flex gap-2">
                  <select
                    name="scheduled_interval"
                    value={formData.scheduled_interval}
                    onChange={handleChange}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                    <option value="one-time">One-time</option>
                  </select>
                  <input
                    type="number"
                    name="interval_count"
                    value={formData.interval_count}
                    onChange={handleChange}
                    min="1"
                    className="w-20 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                  <span className="px-4 py-2 text-gray-600">times</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Any additional details about your commitment..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="bg-amber-100 p-4 rounded-lg border border-amber-300">
              <p className="text-sm text-amber-900">
                <span className="font-semibold">Total Commitment Value:</span> {formData.quantity && formData.unit_price ? `${(parseFloat(formData.quantity) * parseFloat(formData.unit_price) * parseInt(formData.interval_count)).toLocaleString()} ${formData.currency}` : 'Enter quantities to calculate'}
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !formData.quantity || !formData.unit_price}
              className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              {isSubmitting ? 'Recording Commitment...' : 'Record My Commitment →'}
            </button>
          </form>
        )}
      </div>

      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Sign In</h2>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <Auth 
                onAuthSuccess={() => {
                  setShowAuthModal(false)
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
