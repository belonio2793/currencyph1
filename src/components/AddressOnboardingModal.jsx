import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
})

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick({
        latitude: e.latlng.lat,
        longitude: e.latlng.lng
      })
    }
  })
  return null
}

export default function AddressOnboardingModal({ userId, isOpen, onClose, onAddressCreated }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [mapPosition, setMapPosition] = useState(null)
  const [formData, setFormData] = useState({
    address_name: 'My Home',
    street_address: '',
    barangay: '',
    city: 'Manila',
    province: 'Metro Manila',
    postal_code: '',
    country: 'Philippines',
    latitude: 14.5995,
    longitude: 120.9842
  })

  const handleMapClick = (coords) => {
    setMapPosition(coords)
    setFormData(prev => ({
      ...prev,
      latitude: coords.latitude,
      longitude: coords.longitude
    }))
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSaveAddress = async () => {
    if (!formData.street_address || !formData.barangay) {
      alert('Please fill in required fields')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_addresses')
        .insert([{
          user_id: userId,
          address_name: formData.address_name,
          street_address: formData.street_address,
          barangay: formData.barangay,
          city: formData.city,
          province: formData.province,
          postal_code: formData.postal_code,
          country: formData.country,
          latitude: formData.latitude,
          longitude: formData.longitude,
          is_default: true,
          created_at: new Date().toISOString()
        }])

      if (error) throw error

      onAddressCreated?.(data?.[0])
      onClose()
    } catch (err) {
      console.error('Error creating address:', err)
      alert('Failed to create address. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Add Your First Address</h2>
            <p className="text-sm text-slate-500 mt-1">Help us locate you for better service</p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {step === 1 ? (
            <>
              {/* Step 1: Map Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  📍 Select Location on Map (Click to place marker)
                </label>
                <div className="h-80 rounded-lg overflow-hidden border border-slate-200">
                  <MapContainer
                    center={[formData.latitude, formData.longitude]}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; OpenStreetMap contributors'
                    />
                    <MapClickHandler onMapClick={handleMapClick} />
                    {mapPosition && (
                      <Marker position={[mapPosition.latitude, mapPosition.longitude]} />
                    )}
                  </MapContainer>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Latitude: {formData.latitude.toFixed(4)}, Longitude: {formData.longitude.toFixed(4)}
                </p>
              </div>

              <button
                onClick={() => setStep(2)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                Next: Add Details →
              </button>
            </>
          ) : (
            <>
              {/* Step 2: Address Details */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">
                    Address Name *
                  </label>
                  <input
                    type="text"
                    name="address_name"
                    value={formData.address_name}
                    onChange={handleInputChange}
                    placeholder="e.g., My Home"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    name="street_address"
                    value={formData.street_address}
                    onChange={handleInputChange}
                    placeholder="123 Main St"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      Barangay *
                    </label>
                    <input
                      type="text"
                      name="barangay"
                      value={formData.barangay}
                      onChange={handleInputChange}
                      placeholder="e.g., Taguig"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      Province
                    </label>
                    <input
                      type="text"
                      name="province"
                      value={formData.province}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      name="postal_code"
                      value={formData.postal_code}
                      onChange={handleInputChange}
                      placeholder="1234"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors disabled:opacity-50"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSaveAddress}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? 'Creating...' : '✓ Create Address'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
