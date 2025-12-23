import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  ITEM_TYPES,
  QUANTITY_UNITS,
  SCHEDULE_INTERVALS,
  estimateDeliveryCost,
  estimateHandlingCost,
  estimateShippingCost,
  generateCommitmentSummary,
  formatCurrencyValue
} from '../lib/commitmentCalculatorService'

export default function CommitmentCalculator({ userId, profileId }) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [commitments, setCommitments] = useState([])
  const [editingId, setEditingId] = useState(null)

  // Form for new/editing commitment
  const [formData, setFormData] = useState({
    item_type: 'Coconut',
    item_description: '',
    quantity: '',
    quantity_unit: 'Pieces',
    scheduled_interval: 'monthly',
    interval_count: 1,
    unit_price: '',
    currency: 'PHP',
    requires_delivery: false,
    requires_handling: false,
    requires_shipping: false,
    commission_percentage: 50,
    notes: ''
  })

  const [totals, setTotals] = useState({})

  // Load commitments on mount
  useEffect(() => {
    if (userId && profileId) {
      loadCommitments()
    }
  }, [userId, profileId])

  const loadCommitments = async () => {
    try {
      setIsLoading(true)
      const { data, error: fetchError } = await supabase
        .from('commitments')
        .select('*')
        .eq('user_id', userId)
        .eq('commitment_profile_id', profileId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setCommitments(data || [])
    } catch (err) {
      setError('Failed to load commitments: ' + err.message)
      console.error('Load error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Update totals when form changes
  useEffect(() => {
    if (formData.quantity && formData.unit_price) {
      const summary = generateCommitmentSummary({
        quantity: parseFloat(formData.quantity) || 0,
        unitPrice: parseFloat(formData.unit_price) || 0,
        intervalCount: parseInt(formData.interval_count) || 1,
        itemType: formData.item_type,
        quantityUnit: formData.quantity_unit,
        requiresDelivery: formData.requires_delivery,
        requiresHandling: formData.requires_handling,
        requiresShipping: formData.requires_shipping,
        commissionPercentage: parseFloat(formData.commission_percentage) || 50,
        currency: formData.currency
      })
      setTotals(summary)
    } else {
      setTotals({})
    }
  }, [formData])

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleAddCommitment = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.quantity || !formData.unit_price) {
      setError('Please fill in quantity and unit price')
      return
    }

    setIsSaving(true)

    try {
      const commitmentData = {
        user_id: userId,
        commitment_profile_id: profileId,
        item_type: formData.item_type,
        item_description: formData.item_description,
        quantity: parseFloat(formData.quantity),
        quantity_unit: formData.quantity_unit,
        scheduled_interval: formData.scheduled_interval,
        interval_count: parseInt(formData.interval_count),
        unit_price: parseFloat(formData.unit_price),
        currency: formData.currency,
        requires_delivery: formData.requires_delivery,
        requires_handling: formData.requires_handling,
        requires_shipping: formData.requires_shipping,
        commission_percentage: parseFloat(formData.commission_percentage),
        notes: formData.notes,
        status: 'active'
      }

      if (editingId) {
        // Update existing
        const { error: updateError } = await supabase
          .from('commitments')
          .update(commitmentData)
          .eq('id', editingId)

        if (updateError) throw updateError
        setSuccess('Commitment updated successfully!')
      } else {
        // Create new
        const { error: insertError } = await supabase
          .from('commitments')
          .insert([commitmentData])

        if (insertError) throw insertError
        setSuccess('Commitment added successfully!')
      }

      // Reset form
      setFormData({
        item_type: 'Coconut',
        item_description: '',
        quantity: '',
        quantity_unit: 'Pieces',
        scheduled_interval: 'monthly',
        interval_count: 1,
        unit_price: '',
        currency: 'PHP',
        requires_delivery: false,
        requires_handling: false,
        requires_shipping: false,
        commission_percentage: 50,
        notes: ''
      })
      setEditingId(null)
      setTotals({})

      // Reload commitments
      await loadCommitments()
    } catch (err) {
      setError('Failed to save commitment: ' + err.message)
      console.error('Save error:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditCommitment = (commitment) => {
    setFormData({
      item_type: commitment.item_type,
      item_description: commitment.item_description || '',
      quantity: commitment.quantity.toString(),
      quantity_unit: commitment.quantity_unit,
      scheduled_interval: commitment.scheduled_interval,
      interval_count: commitment.interval_count,
      unit_price: commitment.unit_price.toString(),
      currency: commitment.currency,
      requires_delivery: commitment.requires_delivery,
      requires_handling: commitment.requires_handling,
      requires_shipping: commitment.requires_shipping,
      commission_percentage: commitment.commission_percentage.toString(),
      notes: commitment.notes || ''
    })
    setEditingId(commitment.id)
  }

  const handleDeleteCommitment = async (id) => {
    if (!window.confirm('Are you sure you want to delete this commitment?')) return

    try {
      const { error: deleteError } = await supabase
        .from('commitments')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      setSuccess('Commitment deleted successfully!')
      await loadCommitments()
    } catch (err) {
      setError('Failed to delete commitment: ' + err.message)
      console.error('Delete error:', err)
    }
  }

  const handleCancelEdit = () => {
    setFormData({
      item_type: 'Coconut',
      item_description: '',
      quantity: '',
      quantity_unit: 'Pieces',
      scheduled_interval: 'monthly',
      interval_count: 1,
      unit_price: '',
      currency: 'PHP',
      requires_delivery: false,
      requires_handling: false,
      requires_shipping: false,
      commission_percentage: 50,
      notes: ''
    })
    setEditingId(null)
    setTotals({})
  }

  return (
    <div className="commitment-calculator-container space-y-8">
      {/* Error and Success Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      {/* Commitment Form */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          {editingId ? 'Edit Commitment' : 'Add New Commitment'}
        </h2>

        <form onSubmit={handleAddCommitment} className="space-y-6">
          {/* Item Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700">Item Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Type *
                </label>
                <select
                  name="item_type"
                  value={formData.item_type}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {ITEM_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  name="item_description"
                  value={formData.item_description}
                  onChange={handleFormChange}
                  placeholder="e.g., Fresh Coconuts, Grade A"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Quantity and Pricing */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700">Quantity & Pricing</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity *
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleFormChange}
                  placeholder="0"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit
                </label>
                <select
                  name="quantity_unit"
                  value={formData.quantity_unit}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {QUANTITY_UNITS.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit Price *
                </label>
                <input
                  type="number"
                  name="unit_price"
                  value={formData.unit_price}
                  onChange={handleFormChange}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="PHP">PHP</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700">Scheduled Interval</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Interval Type
                </label>
                <select
                  name="scheduled_interval"
                  value={formData.scheduled_interval}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {SCHEDULE_INTERVALS.map(interval => (
                    <option key={interval.value} value={interval.value}>
                      {interval.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Intervals
                </label>
                <input
                  type="number"
                  name="interval_count"
                  value={formData.interval_count}
                  onChange={handleFormChange}
                  placeholder="1"
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Requirements */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700">Additional Requirements</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="requires_delivery"
                  checked={formData.requires_delivery}
                  onChange={handleFormChange}
                  className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Delivery Needed</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="requires_handling"
                  checked={formData.requires_handling}
                  onChange={handleFormChange}
                  className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Handling Needed</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="requires_shipping"
                  checked={formData.requires_shipping}
                  onChange={handleFormChange}
                  className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Shipping Needed</span>
              </label>
            </div>
          </div>

          {/* Commission */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Affiliate Commission Percentage (%)
            </label>
            <input
              type="number"
              name="commission_percentage"
              value={formData.commission_percentage}
              onChange={handleFormChange}
              placeholder="50"
              min="0"
              max="100"
              step="0.01"
              className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-2">Default: 50% for recurring commissions</p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleFormChange}
              placeholder="Any additional details..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Cost Breakdown Summary */}
          {totals.committedValue > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-3">
              <h4 className="font-semibold text-gray-800">Cost Breakdown</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Base Commitment</p>
                  <p className="text-lg font-semibold text-gray-800">{totals.formattedCommittedValue}</p>
                </div>
                <div>
                  <p className="text-gray-600">Total Additional Costs</p>
                  <p className="text-lg font-semibold text-gray-800">{totals.formattedAdditionalCosts}</p>
                </div>
                <div className="bg-blue-100 px-4 py-3 rounded-lg">
                  <p className="text-gray-600">Grand Total</p>
                  <p className="text-lg font-bold text-blue-700">{totals.formattedGrandTotal}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-blue-200">
                <p className="text-gray-600">
                  Affiliate Commission ({totals.commissionPercentage}%):
                </p>
                <p className="text-lg font-semibold text-green-700">{totals.formattedCommission}</p>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
            >
              {isSaving ? 'Saving...' : (editingId ? 'Update Commitment' : 'Add Commitment')}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition duration-200 font-semibold"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Commitments Table */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">My Commitments</h2>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading commitments...</div>
        ) : commitments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No commitments yet. Add one above to get started!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b border-gray-300">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Item Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Quantity</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Schedule</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Grand Total</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Commission</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {commitments.map(commitment => {
                  const summary = generateCommitmentSummary(commitment)
                  return (
                    <tr key={commitment.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800">{commitment.item_type}</div>
                        {commitment.item_description && (
                          <div className="text-xs text-gray-500">{commitment.item_description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {commitment.quantity} {commitment.quantity_unit}
                      </td>
                      <td className="px-4 py-3">
                        {commitment.scheduled_interval} × {commitment.interval_count}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {summary.formattedGrandTotal}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">
                          {summary.formattedCommission}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center space-x-2">
                        <button
                          onClick={() => handleEditCommitment(commitment)}
                          className="text-blue-600 hover:text-blue-800 font-semibold text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteCommitment(commitment.id)}
                          className="text-red-600 hover:text-red-800 font-semibold text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
