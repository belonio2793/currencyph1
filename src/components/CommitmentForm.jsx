import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useDevice } from '../context/DeviceContext'

const BUSINESS_TYPES = [
  'farmer',
  'vendor',
  'wholesaler',
  'retailer',
  'processor',
  'exporter',
  'service_provider',
  'equipment_supplier',
  'logistics',
  'other'
]

const ITEM_TYPES = [
  'coconut',
  'coconut_water',
  'processing_equipment',
  'machinery',
  'warehouse_space',
  'labour',
  'water',
  'processing_service',
  'transportation',
  'retail_space',
  'other'
]

const QUANTITY_UNITS = [
  'pieces',
  'tons',
  'kg',
  'liters',
  'units',
  'hours',
  'sq_meters',
  'bundles'
]

const SCHEDULED_INTERVALS = [
  { value: 'one-time', label: 'One Time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi-weekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
  { value: 'as-needed', label: 'As Needed' }
]

const ITEM_TYPE_ICONS = {
  'coconut': '🥥',
  'coconut_water': '💧',
  'processing_equipment': '⚙️',
  'machinery': '🏭',
  'warehouse_space': '📦',
  'labour': '👷',
  'water': '💦',
  'processing_service': '⚗️',
  'transportation': '🚚',
  'retail_space': '🏪',
  'other': '📝'
}

export default function CommitmentForm({ isOpen, onClose, onCommitmentSaved, userId, profileId, isAuthenticated }) {
  const { isMobile } = useDevice()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // User Profile
  const [businessType, setBusinessType] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [email, setEmail] = useState('')
  const [bio, setBio] = useState('')

  // Commitment Fields
  const [itemType, setItemType] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [quantity, setQuantity] = useState('')
  const [quantityUnit, setQuantityUnit] = useState('pieces')
  const [scheduledInterval, setScheduledInterval] = useState('monthly')
  const [intervalCount, setIntervalCount] = useState(1)
  const [unitPrice, setUnitPrice] = useState('')

  // Additional Costs
  const [requiresDelivery, setRequiresDelivery] = useState(false)
  const [estimatedDeliveryCost, setEstimatedDeliveryCost] = useState('0')
  const [requiresHandling, setRequiresHandling] = useState(false)
  const [estimatedHandlingCost, setEstimatedHandlingCost] = useState('0')
  const [requiresShipping, setRequiresShipping] = useState(false)
  const [estimatedShippingCost, setEstimatedShippingCost] = useState('0')
  const [notes, setNotes] = useState('')

  // Calculations
  const [calculations, setCalculations] = useState({
    totalCommittedValue: 0,
    totalAdditionalCosts: 0,
    grandTotal: 0
  })

  // Calculate totals whenever relevant fields change
  useEffect(() => {
    calculateTotals()
  }, [quantity, unitPrice, estimatedDeliveryCost, estimatedHandlingCost, estimatedShippingCost, intervalCount])

  const calculateTotals = () => {
    const qty = parseFloat(quantity) || 0
    const price = parseFloat(unitPrice) || 0
    const intervals = parseInt(intervalCount) || 1

    const totalCommittedValue = qty * price * intervals
    const delivery = requiresDelivery ? parseFloat(estimatedDeliveryCost) || 0 : 0
    const handling = requiresHandling ? parseFloat(estimatedHandlingCost) || 0 : 0
    const shipping = requiresShipping ? parseFloat(estimatedShippingCost) || 0 : 0
    const totalAdditionalCosts = delivery + handling + shipping
    const grandTotal = totalCommittedValue + totalAdditionalCosts

    setCalculations({
      totalCommittedValue,
      totalAdditionalCosts,
      grandTotal
    })
  }

  const loadProfileData = async () => {
    if (!profileId) return

    try {
      const { data, error } = await supabase
        .from('commitment_profiles')
        .select('*')
        .eq('id', profileId)
        .single()

      if (!error && data) {
        setBusinessType(data.business_type || '')
        setBusinessName(data.business_name || '')
        setContactPerson(data.contact_person || '')
        setEmail(data.email || '')
        setBio(data.bio || '')
      }
    } catch (err) {
      console.error('Error loading profile:', err)
    }
  }

  useEffect(() => {
    if (isOpen && profileId) {
      loadProfileData()
    }
  }, [isOpen, profileId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!itemType || !quantity || !unitPrice) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // First, ensure profile exists or create it
      let commitmentProfileId = profileId

      if (!commitmentProfileId) {
        const { data: profileData, error: profileError } = await supabase
          .from('commitment_profiles')
          .insert({
            user_id: userId,
            business_type: businessType,
            business_name: businessName,
            contact_person: contactPerson,
            email: email,
            bio: bio,
            profile_completed: true
          })
          .select()
          .single()

        if (profileError) throw profileError
        commitmentProfileId = profileData.id
      } else {
        // Update existing profile
        await supabase
          .from('commitment_profiles')
          .update({
            business_type: businessType,
            business_name: businessName,
            contact_person: contactPerson,
            email: email,
            bio: bio,
            profile_completed: true
          })
          .eq('id', commitmentProfileId)
      }

      // Create commitment
      const { error: commitmentError } = await supabase
        .from('commitments')
        .insert({
          user_id: userId,
          commitment_profile_id: commitmentProfileId,
          item_type: itemType,
          item_description: itemDescription,
          quantity: parseFloat(quantity),
          quantity_unit: quantityUnit,
          scheduled_interval: scheduledInterval,
          interval_count: parseInt(intervalCount),
          unit_price: parseFloat(unitPrice),
          currency: 'PHP',
          requires_delivery: requiresDelivery,
          estimated_delivery_cost: requiresDelivery ? parseFloat(estimatedDeliveryCost) : 0,
          requires_handling: requiresHandling,
          estimated_handling_cost: requiresHandling ? parseFloat(estimatedHandlingCost) : 0,
          requires_shipping: requiresShipping,
          estimated_shipping_cost: requiresShipping ? parseFloat(estimatedShippingCost) : 0,
          notes: notes,
          status: 'active'
        })

      if (commitmentError) throw commitmentError

      setSuccess('Commitment added successfully!')
      setTimeout(() => {
        onCommitmentSaved()
        onClose()
      }, 1500)
    } catch (err) {
      console.error('Error saving commitment:', err)
      setError(err.message || 'Failed to save commitment')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className={`bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-2xl ${isMobile ? 'w-full max-h-[90vh]' : 'w-full max-w-2xl max-h-[90vh]'} overflow-y-auto`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-cyan-600 border-b border-blue-500 px-6 py-5 sticky top-0 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌱</span>
            <div>
              <h2 className="text-xl font-bold text-white">Grow With Us</h2>
              <p className="text-blue-100 text-xs">Add your contribution to the partnership</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-blue-100 hover:text-white text-2xl flex-shrink-0 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {error && (
            <div className="p-4 bg-red-900/30 border border-red-700 rounded text-red-200 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-900/30 border border-green-700 rounded text-green-200 text-sm">
              {success}
            </div>
          )}

          {/* Section 1: Your Role & Business */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-600">
              <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg w-10 h-10 flex items-center justify-center text-lg font-bold">
                👤
              </div>
              <h3 className="text-lg font-bold text-white">Your Role & Business</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Business Type *
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  required
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                >
                  <option value="">Select business type</option>
                  {BUSINESS_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Business Name
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g., Fresh Coconut Farm"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Contact Person
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Business Description
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about your business..."
                  rows="2"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section 2: What Can You Contribute? */}
          <div className="space-y-4 border-t border-slate-600 pt-6">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-600">
              <div className="bg-gradient-to-r from-emerald-600 to-cyan-600 rounded-lg w-10 h-10 flex items-center justify-center text-lg font-bold">
                🎁
              </div>
              <h3 className="text-lg font-bold text-white">What Can You Contribute?</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Item Type *
                </label>
                <select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value)}
                  required
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select what you can provide</option>
                  {ITEM_TYPES.map(type => (
                    <option key={type} value={type}>
                      {ITEM_TYPE_ICONS[type]} {type.replace(/_/g, ' ').toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="e.g., Premium quality, Grade A"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Quantity & Pricing Calculator */}
          <div className="space-y-4 border-t border-slate-600 pt-6">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-600">
              <div className="bg-gradient-to-r from-yellow-600 to-orange-600 rounded-lg w-10 h-10 flex items-center justify-center text-lg font-bold">
                🧮
              </div>
              <h3 className="text-lg font-bold text-white">Quantity & Pricing</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Quantity *
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g., 5000"
                  step="0.01"
                  min="0"
                  required
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Unit *
                </label>
                <select
                  value={quantityUnit}
                  onChange={(e) => setQuantityUnit(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  {QUANTITY_UNITS.map(unit => (
                    <option key={unit} value={unit}>
                      {unit.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Unit Price (₱) *
                </label>
                <input
                  type="number"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="e.g., 50.00"
                  step="0.01"
                  min="0"
                  required
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                />
              </div>
            </div>

            {/* Scheduling */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Frequency
                </label>
                <select
                  value={scheduledInterval}
                  onChange={(e) => setScheduledInterval(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  {SCHEDULED_INTERVALS.map(interval => (
                    <option key={interval.value} value={interval.value}>
                      {interval.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Number of {scheduledInterval === 'one-time' ? 'delivery' : scheduledInterval === 'daily' ? 'days' : scheduledInterval === 'weekly' ? 'weeks' : scheduledInterval === 'bi-weekly' ? 'bi-weeks' : 'months'}
                </label>
                <input
                  type="number"
                  value={intervalCount}
                  onChange={(e) => setIntervalCount(e.target.value)}
                  placeholder="e.g., 1"
                  min="1"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Additional Costs */}
          <div className="space-y-4 border-t border-slate-600 pt-6">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-600">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg w-10 h-10 flex items-center justify-center text-lg font-bold">
                💰
              </div>
              <h3 className="text-lg font-bold text-white">Additional Costs (Optional)</h3>
            </div>

            {/* Delivery */}
            <div className="bg-slate-750 rounded p-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresDelivery}
                  onChange={(e) => setRequiresDelivery(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-white font-medium">Requires Delivery</span>
              </label>
              {requiresDelivery && (
                <input
                  type="number"
                  value={estimatedDeliveryCost}
                  onChange={(e) => setEstimatedDeliveryCost(e.target.value)}
                  placeholder="Estimated delivery cost (₱)"
                  step="0.01"
                  min="0"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                />
              )}
            </div>

            {/* Handling */}
            <div className="bg-slate-750 rounded p-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresHandling}
                  onChange={(e) => setRequiresHandling(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-white font-medium">Requires Handling/Packaging</span>
              </label>
              {requiresHandling && (
                <input
                  type="number"
                  value={estimatedHandlingCost}
                  onChange={(e) => setEstimatedHandlingCost(e.target.value)}
                  placeholder="Estimated handling cost (₱)"
                  step="0.01"
                  min="0"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                />
              )}
            </div>

            {/* Shipping */}
            <div className="bg-slate-750 rounded p-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresShipping}
                  onChange={(e) => setRequiresShipping(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-white font-medium">Requires Shipping</span>
              </label>
              {requiresShipping && (
                <input
                  type="number"
                  value={estimatedShippingCost}
                  onChange={(e) => setEstimatedShippingCost(e.target.value)}
                  placeholder="Estimated shipping cost (₱)"
                  step="0.01"
                  min="0"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                />
              )}
            </div>
          </div>

          {/* Section 5: Summary & Totals */}
          <div className="border-t border-slate-600 pt-6 space-y-4 bg-gradient-to-br from-blue-900/30 to-cyan-900/30 rounded-xl p-6 border border-blue-700/30">
            <div className="flex items-center gap-3 pb-3">
              <div className="bg-gradient-to-r from-emerald-600 to-cyan-600 rounded-lg w-10 h-10 flex items-center justify-center text-lg font-bold">
                💡
              </div>
              <h3 className="text-lg font-bold text-white">Commitment Summary</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between items-center p-3 bg-slate-700 rounded">
                <span className="text-slate-300">Item Total (Qty × Price × Intervals)</span>
                <span className="text-white font-semibold">₱{calculations.totalCommittedValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-slate-700 rounded">
                <span className="text-slate-300">Additional Costs</span>
                <span className="text-white font-semibold">₱{calculations.totalAdditionalCosts.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
              </div>

              <div className="md:col-span-2 flex justify-between items-center p-4 bg-blue-900/40 border border-blue-700 rounded-lg">
                <span className="text-blue-200 font-semibold text-base">Total Commitment Value</span>
                <span className="text-blue-100 font-bold text-lg">₱{calculations.grandTotal.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                Additional Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any other details about this contribution..."
                rows="2"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 border-t border-slate-600 pt-6">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-semibold rounded transition-colors"
            >
              {loading ? 'Saving...' : 'Add Contribution'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
