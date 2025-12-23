import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Contribution type configuration - maps to dynamic field requirements
const CONTRIBUTION_TYPE_CONFIG = {
  farmer: {
    label: '🚜 Farmer / Landowner',
    requiredFields: ['businessName', 'contributions', 'monthlyCapacity', 'capacityUnit', 'location'],
    helpText: 'Tell us about your harvest capacity and coconut products'
  },
  processor: {
    label: '⚙️ Processor / Manufacturer',
    requiredFields: ['businessName', 'contributions', 'monthlyCapacity', 'capacityUnit', 'location'],
    helpText: 'Share your processing capabilities and production volume'
  },
  trader: {
    label: '🏪 Trader / Wholesaler',
    requiredFields: ['businessName', 'contributions', 'monthlyCapacity', 'location'],
    helpText: 'Tell us about your trading volume and market reach'
  },
  retailer: {
    label: '🏬 Retailer / Shop Owner',
    requiredFields: ['businessName', 'contributions', 'location'],
    helpText: 'Share your retail capacity and customer base'
  },
  exporter: {
    label: '✈️ Exporter / Distributor',
    requiredFields: ['businessName', 'contributions', 'monthlyCapacity', 'location'],
    helpText: 'Tell us about your export capabilities and distribution network'
  },
  logistics: {
    label: '🚚 Logistics / Transport',
    requiredFields: ['businessName', 'contributions', 'monthlyCapacity', 'location'],
    helpText: 'Share your transport capacity and service areas'
  },
  corporation: {
    label: '🏢 Corporation / Large Enterprise',
    requiredFields: ['businessName', 'contributions'],
    helpText: 'Tell us how your organization wants to contribute'
  },
  investor: {
    label: '💰 Investor / Financial Partner',
    requiredFields: ['businessName', 'contributions', 'pricePerUnit'],
    helpText: 'Share your investment interests and capabilities'
  },
  equipment: {
    label: '🔧 Equipment / Machinery Provider',
    requiredFields: ['businessName', 'contributions', 'pricePerUnit'],
    helpText: 'Tell us about equipment you can provide or finance'
  },
  warehouse: {
    label: '🏭 Warehouse / Storage Owner',
    requiredFields: ['businessName', 'contributions', 'monthlyCapacity', 'location'],
    helpText: 'Share your storage capacity and service areas'
  },
  service: {
    label: '💼 Other Services',
    requiredFields: ['businessName', 'contributions'],
    helpText: 'Describe the services or expertise you can offer'
  }
}

export default function PartnershipForm({
  userId,
  userEmail,
  isAuthenticated,
  onSubmitSuccess = null,
  onAuthRequired = null
}) {
  const [formData, setFormData] = useState({
    partnerType: '',
    businessName: '',
    publicName: '',
    contributions: [],
    monthlyCapacity: '',
    capacityUnit: 'tons',
    location: '',
    pricePerUnit: '',
    currency: 'php',
    notes: '',
    displayPublicly: true
  })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target

    if (name === 'contributions') {
      setFormData(prev => ({
        ...prev,
        contributions: checked
          ? [...prev.contributions, value]
          : prev.contributions.filter(c => c !== value)
      }))
    } else if (name === 'displayPublicly') {
      setFormData(prev => ({
        ...prev,
        displayPublicly: checked
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }

    // Clear error when user starts editing
    if (error) setError('')
  }

  const validateForm = () => {
    if (!formData.partnerType) {
      setError('Please select your partner type')
      return false
    }
    if (!formData.businessName?.trim()) {
      setError('Please enter your business or organization name')
      return false
    }
    if (formData.contributions.length === 0) {
      setError('Please select at least one contribution type')
      return false
    }
    if (!formData.publicName?.trim()) {
      setError('Please enter a name or nickname for the public directory')
      return false
    }

    // Check required fields based on partner type
    const config = CONTRIBUTION_TYPE_CONFIG[formData.partnerType]
    if (config?.requiredFields) {
      for (const field of config.requiredFields) {
        if (field === 'monthlyCapacity' && !formData.monthlyCapacity) {
          setError('Please enter your capacity/volume')
          return false
        }
        if (field === 'location' && !formData.location?.trim()) {
          setError('Please enter your location or service area')
          return false
        }
        if (field === 'pricePerUnit' && !formData.pricePerUnit) {
          setError('Please enter a price or cost')
          return false
        }
      }
    }

    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!validateForm()) {
      return
    }

    if (!isAuthenticated || !userId) {
      // Trigger auth modal
      if (onAuthRequired) {
        onAuthRequired('login')
      }
      return
    }

    setSubmitting(true)

    try {
      // Get or create commitment profile
      let profileId
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('commitment_profiles')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (profileCheckError && profileCheckError.code !== 'PGRST116') {
        throw profileCheckError
      }

      if (existingProfile) {
        profileId = existingProfile.id
        // Update existing profile
        await supabase
          .from('commitment_profiles')
          .update({
            business_name: formData.businessName,
            business_type: formData.partnerType,
            public_name: formData.publicName,
            display_publicly: formData.displayPublicly,
            email: userEmail,
            metadata: {
              contributions: formData.contributions
            }
          })
          .eq('id', profileId)
      } else {
        // Create new profile
        const { data: newProfile, error: createProfileError } = await supabase
          .from('commitment_profiles')
          .insert([{
            user_id: userId,
            business_name: formData.businessName,
            business_type: formData.partnerType,
            public_name: formData.publicName,
            display_publicly: formData.displayPublicly,
            email: userEmail,
            metadata: {
              contributions: formData.contributions
            }
          }])
          .select()
          .single()

        if (createProfileError) throw createProfileError
        profileId = newProfile.id
      }

      // Create commitment entry
      const { error: commitmentError } = await supabase
        .from('commitments')
        .insert([{
          user_id: userId,
          commitment_profile_id: profileId,
          status: 'active',
          item_type: formData.contributions[0],
          item_description: formData.contributions.join(', '),
          quantity: formData.monthlyCapacity ? parseFloat(formData.monthlyCapacity) : 1,
          quantity_unit: formData.capacityUnit,
          scheduled_interval: 'monthly',
          interval_count: 1,
          unit_price: formData.pricePerUnit ? parseFloat(formData.pricePerUnit) : null,
          currency: (formData.currency || 'php').toUpperCase(),
          notes: `Partner Type: ${formData.partnerType}\nLocation: ${formData.location}\nPublic Name: ${formData.publicName}\n${formData.notes}`,
          metadata: {
            partner_type: formData.partnerType,
            location: formData.location,
            contribution_types: formData.contributions,
            display_publicly: formData.displayPublicly
          }
        }])

      if (commitmentError) throw commitmentError

      setSuccess('✅ Thank you! Your partnership contribution has been submitted successfully.')
      
      // Reset form
      setFormData({
        partnerType: '',
        businessName: '',
        publicName: '',
        contributions: [],
        monthlyCapacity: '',
        capacityUnit: 'tons',
        location: '',
        pricePerUnit: '',
        currency: 'php',
        notes: '',
        displayPublicly: true
      })

      if (onSubmitSuccess) {
        onSubmitSuccess()
      }
    } catch (err) {
      console.error('Partnership submission error:', err)
      setError(`Failed to submit: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const config = CONTRIBUTION_TYPE_CONFIG[formData.partnerType]
  const shouldShowCapacity = config?.requiredFields?.includes('monthlyCapacity')
  const shouldShowPrice = config?.requiredFields?.includes('pricePerUnit')
  const shouldShowLocation = config?.requiredFields?.includes('location')

  return (
    <div className="w-full bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 rounded-lg border border-amber-600/30 shadow-2xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4 rounded-t-lg">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          🤝 Join Our Partnership Network
        </h2>
        <p className="text-amber-100 text-sm mt-2">Share your capabilities, connect with partners, and strengthen our supply chain</p>
      </div>

      {/* Content */}
      <div className="px-6 py-4 space-y-4 max-h-96 overflow-y-auto relative">
        {/* Preview Mode Overlay - for signed out users */}
        {!isAuthenticated && (
          <div className="absolute inset-0 bg-black/10 backdrop-blur-[0.5px] rounded z-10 flex items-center justify-center">
            <div className="bg-slate-900 border-2 border-amber-600 rounded-lg p-6 text-center max-w-sm">
              <p className="text-amber-100 font-semibold text-lg mb-3">👀 Preview Mode</p>
              <p className="text-slate-300 text-sm mb-4">You're viewing the partnership form. Sign in to contribute and share your capabilities with the community.</p>
              <button
                onClick={() => onAuthRequired && onAuthRequired('login')}
                className="w-full px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold rounded-lg transition-all transform hover:scale-105 text-sm"
              >
                Sign In to Contribute
              </button>
              <button
                onClick={() => onAuthRequired && onAuthRequired('register')}
                className="w-full mt-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white font-semibold rounded-lg transition-colors text-sm"
              >
                Create Account
              </button>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
          <p className="text-blue-100 text-sm">
            <strong>All contributions welcome:</strong> Whether you're an individual, small business, or corporation, your input helps build a collaborative ecosystem.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg">
            <p className="text-red-100 text-sm">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg">
            <p className="text-green-100 text-sm">{success}</p>
          </div>
        )}

        <form className={`space-y-4 ${!isAuthenticated ? 'opacity-60 pointer-events-none' : ''}`} onSubmit={handleSubmit}>
          {/* Partner Type */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">I am a... *</label>
            <select
              name="partnerType"
              value={formData.partnerType}
              onChange={handleInputChange}
              className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50 text-sm"
            >
              <option value="">-- Select Your Type --</option>
              <optgroup label="Agricultural">
                <option value="farmer">🚜 Farmer / Landowner</option>
                <option value="processor">⚙️ Processor / Manufacturer</option>
                <option value="trader">🏪 Trader / Wholesaler</option>
              </optgroup>
              <optgroup label="Business">
                <option value="retailer">🏬 Retailer / Shop Owner</option>
                <option value="exporter">✈️ Exporter / Distributor</option>
                <option value="logistics">🚚 Logistics / Transport</option>
              </optgroup>
              <optgroup label="Corporate">
                <option value="corporation">🏢 Corporation / Large Enterprise</option>
                <option value="investor">💰 Investor / Financial Partner</option>
              </optgroup>
              <optgroup label="Support Services">
                <option value="equipment">🔧 Equipment / Machinery Provider</option>
                <option value="warehouse">🏭 Warehouse / Storage Owner</option>
                <option value="service">💼 Other Services</option>
              </optgroup>
            </select>
            {config && <p className="text-xs text-slate-400 mt-1">{config.helpText}</p>}
          </div>

          {/* Business Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">Business / Organization Name *</label>
            <input
              type="text"
              name="businessName"
              value={formData.businessName}
              onChange={handleInputChange}
              placeholder="Your business or organization name"
              className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50 text-sm"
            />
          </div>

          {/* Public Name / Nickname */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">Display Name / Nickname *</label>
            <input
              type="text"
              name="publicName"
              value={formData.publicName}
              onChange={handleInputChange}
              placeholder="How you'd like to appear in the public partnership directory"
              className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50 text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">This name will be visible to other partners</p>
          </div>

          {/* What Can You Contribute */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">What Can You Contribute? *</label>
            <div className="space-y-2">
              {[
                { value: 'coconuts', label: '🥥 Coconuts / Harvest' },
                { value: 'equipment', label: '⚙️ Equipment / Machinery' },
                { value: 'processing', label: '🏭 Processing / Manufacturing' },
                { value: 'transportation', label: '🚚 Transportation / Logistics' },
                { value: 'distribution', label: '🏪 Distribution / Retail' },
                { value: 'warehouse', label: '📍 Warehouse / Storage' },
                { value: 'consulting', label: '💼 Expertise / Consulting' },
                { value: 'financial', label: '💰 Financial / Investment' }
              ].map(item => (
                <label key={item.value} className="flex items-center gap-3 cursor-pointer text-slate-300 hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    name="contributions"
                    value={item.value}
                    onChange={handleInputChange}
                    checked={formData.contributions.includes(item.value)}
                    className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-amber-600"
                  />
                  <span className="text-sm">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Capacity / Volume (conditional) */}
          {shouldShowCapacity && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">Monthly Capacity / Volume *</label>
                <input
                  type="number"
                  name="monthlyCapacity"
                  value={formData.monthlyCapacity}
                  onChange={handleInputChange}
                  placeholder="Quantity"
                  className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">Unit</label>
                <select
                  name="capacityUnit"
                  value={formData.capacityUnit}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50 text-sm"
                >
                  <option value="tons">Tons</option>
                  <option value="kg">KG</option>
                  <option value="liters">Liters</option>
                  <option value="pieces">Pieces</option>
                  <option value="units">Units</option>
                  <option value="hours">Hours</option>
                </select>
              </div>
            </div>
          )}

          {/* Location (conditional) */}
          {shouldShowLocation && (
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-2">Location / Service Area *</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="City, Province or service area"
                className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50 text-sm"
              />
            </div>
          )}

          {/* Price / Cost (conditional) */}
          {shouldShowPrice && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">Price Per Unit *</label>
                <input
                  type="number"
                  name="pricePerUnit"
                  value={formData.pricePerUnit}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">Currency</label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50 text-sm"
                >
                  <option value="php">PHP</option>
                  <option value="usd">USD</option>
                </select>
              </div>
            </div>
          )}

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">Tell Us More (Optional)</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Share details about your business, experience, or partnership interests..."
              rows="3"
              className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50 text-sm resize-none"
            />
          </div>

          {/* Display Publicly Checkbox */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-3 cursor-pointer text-slate-300 hover:text-white transition-colors">
              <input
                type="checkbox"
                name="displayPublicly"
                checked={formData.displayPublicly}
                onChange={handleInputChange}
                className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-amber-600"
              />
              <span className="text-sm">✅ Show my partnership on the public directory</span>
            </label>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:from-amber-800 disabled:to-orange-800 disabled:opacity-50 text-white font-semibold rounded-lg transition-all transform hover:scale-105 text-sm"
            >
              {submitting ? '⏳ Submitting...' : '✓ Submit Partnership'}
            </button>
            <button
              type="reset"
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white font-semibold rounded-lg transition-colors text-sm"
            >
              Clear
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
