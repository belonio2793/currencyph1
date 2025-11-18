import React, { useState } from 'react'

const RIDE_TYPES = [
  {
    id: 'ride-share',
    label: 'Ride Share',
    icon: '🚗',
    color: 'from-blue-500 to-blue-600',
    description: 'Share a ride with other passengers',
    criteria: [
      { label: 'Passengers', icon: '👥', hint: '1-4 people' },
      { label: 'Luggage', icon: '🧳', hint: 'Small bags' },
      { label: 'Duration', icon: '⏱️', hint: 'Any duration' }
    ],
    details: {
      maxPassengers: 4,
      baseFare: 50,
      perKm: 12
    }
  },
  {
    id: 'package',
    label: 'Package Delivery',
    icon: '📦',
    color: 'from-purple-500 to-purple-600',
    description: 'Deliver packages and parcels',
    criteria: [
      { label: 'Weight', icon: '⚖️', hint: 'Up to 25kg' },
      { label: 'Size', icon: '📏', hint: 'Standard boxes' },
      { label: 'Fragility', icon: '🛡️', hint: 'Handle with care' }
    ],
    details: {
      maxWeight: 25,
      baseFare: 40,
      perKm: 10
    }
  },
  {
    id: 'food',
    label: 'Food Pickup',
    icon: '🍔',
    color: 'from-orange-500 to-orange-600',
    description: 'Delivery of food orders',
    criteria: [
      { label: 'Temperature', icon: '🌡️', hint: 'Insulated bag' },
      { label: 'Items', icon: '🥗', hint: 'Multiple items' },
      { label: 'Speed', icon: '⚡', hint: 'Quick delivery' }
    ],
    details: {
      maxItems: 10,
      baseFare: 35,
      perKm: 8,
      maxDeliveryTime: 45
    }
  },
  {
    id: 'laundry',
    label: 'Laundry Service',
    icon: '👕',
    color: 'from-pink-500 to-pink-600',
    description: 'Laundry pickup and delivery',
    criteria: [
      { label: 'Weight', icon: '⚖️', hint: 'Up to 10kg' },
      { label: 'Type', icon: '👔', hint: 'Clothes & fabric' },
      { label: 'Cleaning', icon: '✨', hint: 'Same-day service' }
    ],
    details: {
      maxWeight: 10,
      baseFare: 60,
      perKg: 8
    }
  },
  {
    id: 'medical',
    label: 'Medical Supplies',
    icon: '⚕️',
    color: 'from-red-500 to-red-600',
    description: 'Delivery of medications and medical items',
    criteria: [
      { label: 'Temperature', icon: '🌡️', hint: 'Climate controlled' },
      { label: 'Sensitivity', icon: '⚠️', hint: 'Handle with care' },
      { label: 'Urgency', icon: '🚨', hint: 'Priority delivery' }
    ],
    details: {
      maxItems: 20,
      baseFare: 80,
      perKm: 15,
      requiresCertification: true
    }
  },
  {
    id: 'documents',
    label: 'Document Courier',
    icon: '📄',
    color: 'from-green-500 to-green-600',
    description: 'Important document delivery',
    criteria: [
      { label: 'Security', icon: '🔒', hint: 'Secure delivery' },
      { label: 'Signature', icon: '✍️', hint: 'Signed receipt' },
      { label: 'Speed', icon: '⏰', hint: 'Same-day' }
    ],
    details: {
      maxDocuments: 50,
      baseFare: 75,
      perKm: 12,
      insurable: true
    }
  }
]

export default function RideTypeModal({ 
  isOpen, 
  onClose, 
  onSelectRideType,
  selectedRideType = null
}) {
  const [expandedType, setExpandedType] = useState(selectedRideType || 'ride-share')
  const selectedTypeData = RIDE_TYPES.find(t => t.id === expandedType)

  if (!isOpen) return null

  const handleSelect = () => {
    onSelectRideType(expandedType)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Select Ride Type
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ride Type Selection List */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Available Services</h3>
              <div className="space-y-2">
                {RIDE_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setExpandedType(type.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      expandedType === type.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{type.icon}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{type.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{type.description}</p>
                      </div>
                      {expandedType === type.id && (
                        <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Ride Type Details */}
            {selectedTypeData && (
              <div className={`bg-gradient-to-br ${selectedTypeData.color} rounded-lg p-6 text-white space-y-6`}>
                {/* Type Header */}
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-5xl">{selectedTypeData.icon}</span>
                    <div>
                      <h3 className="text-2xl font-bold">{selectedTypeData.label}</h3>
                      <p className="text-white text-opacity-90 text-sm">{selectedTypeData.description}</p>
                    </div>
                  </div>
                </div>

                {/* Criteria */}
                <div>
                  <h4 className="text-sm font-semibold text-white text-opacity-90 mb-3 uppercase tracking-wide">
                    Service Criteria
                  </h4>
                  <div className="space-y-2">
                    {selectedTypeData.criteria.map((criterion, idx) => (
                      <div key={idx} className="flex items-start gap-3 bg-white bg-opacity-10 rounded-lg p-3">
                        <span className="text-xl flex-shrink-0">{criterion.icon}</span>
                        <div>
                          <p className="font-medium text-sm">{criterion.label}</p>
                          <p className="text-xs text-white text-opacity-80">{criterion.hint}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pricing Info */}
                <div className="border-t border-white border-opacity-20 pt-4">
                  <h4 className="text-sm font-semibold text-white text-opacity-90 mb-3 uppercase tracking-wide">
                    Pricing
                  </h4>
                  <div className="bg-white bg-opacity-10 rounded-lg p-3 space-y-2 text-sm">
                    {selectedTypeData.details.baseFare && (
                      <div className="flex justify-between">
                        <span className="text-opacity-90">Base Fare:</span>
                        <span className="font-semibold">₱{selectedTypeData.details.baseFare}</span>
                      </div>
                    )}
                    {selectedTypeData.details.perKm && (
                      <div className="flex justify-between">
                        <span className="text-opacity-90">Per km:</span>
                        <span className="font-semibold">₱{selectedTypeData.details.perKm}</span>
                      </div>
                    )}
                    {selectedTypeData.details.perKg && (
                      <div className="flex justify-between">
                        <span className="text-opacity-90">Per kg:</span>
                        <span className="font-semibold">₱{selectedTypeData.details.perKg}</span>
                      </div>
                    )}
                    {selectedTypeData.details.maxPassengers && (
                      <div className="flex justify-between text-opacity-90">
                        <span>Max Passengers:</span>
                        <span className="font-semibold">{selectedTypeData.details.maxPassengers}</span>
                      </div>
                    )}
                    {selectedTypeData.details.maxWeight && (
                      <div className="flex justify-between text-opacity-90">
                        <span>Max Weight:</span>
                        <span className="font-semibold">{selectedTypeData.details.maxWeight}kg</span>
                      </div>
                    )}
                    {selectedTypeData.details.maxDeliveryTime && (
                      <div className="flex justify-between text-opacity-90">
                        <span>Max Delivery Time:</span>
                        <span className="font-semibold">{selectedTypeData.details.maxDeliveryTime} min</span>
                      </div>
                    )}
                    {selectedTypeData.details.requiresCertification && (
                      <div className="flex items-center gap-2 text-yellow-200">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm">Certification Required</span>
                      </div>
                    )}
                    {selectedTypeData.details.insurable && (
                      <div className="flex items-center gap-2 text-green-200">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 3.002v5.034a9 9 0 01-3.53 7.007l-3.236 2.839a1 1 0 01-1.414 0l-3.236-2.839A9 9 0 011.455 11.49v-5.034a3.066 3.066 0 012.812-3.002zm9.165 4.993a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm">Insurable</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 p-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Select {selectedTypeData?.label}
          </button>
        </div>
      </div>
    </div>
  )
}
