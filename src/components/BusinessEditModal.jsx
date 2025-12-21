import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import ExpandableModal from './ExpandableModal'
import { useDevice } from '../context/DeviceContext'

export default function BusinessEditModal({ business, userId, onClose, onUpdated }) {
  const { isMobile } = useDevice()
  const [formData, setFormData] = useState({
    business_name: business?.business_name || '',
    registration_type: business?.registration_type || 'sole',
    city_of_registration: business?.city_of_registration || '',
    tin: business?.tin || '',
    currency_registration_id: business?.currency_registration_id || '',
    address: business?.metadata?.address || '',
    phone: business?.metadata?.phone || '',
    email: business?.metadata?.email || '',
    website: business?.metadata?.website || '',
    description: business?.metadata?.description || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (!formData.business_name.trim()) {
        throw new Error('Business name is required')
      }

      const { error: updateError } = await supabase
        .from('businesses')
        .update({
          business_name: formData.business_name,
          registration_type: formData.registration_type,
          city_of_registration: formData.city_of_registration,
          tin: formData.tin,
          currency_registration_id: formData.currency_registration_id,
          metadata: {
            ...business.metadata,
            address: formData.address,
            phone: formData.phone,
            email: formData.email,
            website: formData.website,
            description: formData.description
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', business.id)
        .eq('user_id', userId)

      if (updateError) throw updateError

      onUpdated()
    } catch (err) {
      console.error('Error updating business:', err)
      setError(err?.message || 'Failed to update business. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const footer = (
    <div className="flex gap-2 w-full">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
        disabled={loading}
      >
        Cancel
      </button>
      <button
        type="submit"
        form="business-edit-form"
        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 font-medium"
        disabled={loading}
      >
        {loading ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )

  return (
    <ExpandableModal
      isOpen={true}
      onClose={onClose}
      title="Edit Business Details"
      icon="🏢"
      size="lg"
      footer={footer}
      defaultExpanded={!isMobile}
    >
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-600 hover:text-red-800">×</button>
        </div>
      )}

      <form id="business-edit-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Basic Information</h3>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Business Name *</label>
            <input
              type="text"
              name="business_name"
              value={formData.business_name}
              onChange={handleChange}
              placeholder="Enter business name"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Registration Type</label>
              <select
                name="registration_type"
                value={formData.registration_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="sole">Sole Proprietor</option>
                <option value="partnership">Partnership</option>
                <option value="corporation">Corporation</option>
                <option value="llc">LLC</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">City/Region</label>
              <input
                type="text"
                name="city_of_registration"
                value={formData.city_of_registration}
                onChange={handleChange}
                placeholder="e.g., Manila"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Registration Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Registration Details</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">TIN</label>
              <input
                type="text"
                name="tin"
                value={formData.tin}
                onChange={handleChange}
                placeholder="Tax Identification Number"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Currency Registration ID</label>
              <input
                type="text"
                name="currency_registration_id"
                value={formData.currency_registration_id}
                readOnly
                placeholder="CRN-XXXXXXXXXXXXXXXX"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Business address"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Contact Information</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Phone number"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Email address"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Website</label>
            <input
              type="url"
              name="website"
              value={formData.website}
              onChange={handleChange}
              placeholder="https://example.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Business Description</h3>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Tell us about your business..."
              rows="4"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </form>
    </ExpandableModal>
  )
}
