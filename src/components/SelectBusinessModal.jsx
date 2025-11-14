import React, { useState } from 'react'

export default function SelectBusinessModal({ businesses, onSelect, onCreateNew, onAddExisting }) {
  const [isOpen, setDropdownOpen] = useState(false)
  const [selectedId, setSelectedId] = useState('')

  const handleSelectBusiness = () => {
    if (selectedId) {
      const selected = businesses.find(b => b.id === selectedId)
      if (selected) {
        onSelect(selected)
        setDropdownOpen(false)
        setSelectedId('')
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 0v2m0-6v-2m0 0V7a2 2 0 012-2h.5a4.5 4.5 0 110 9H12a2 2 0 01-2-2v-.5a4 4 0 014-4h0m0 0V7m0 0h-1" />
            </svg>
          </div>
        </div>

        {/* Title and Message */}
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Please Select a Business</h2>
        <p className="text-slate-600 text-center mb-8">You need to select a business to access this feature. Choose from your available businesses or create a new one.</p>

        {/* Business Dropdown */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Available Businesses</label>
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!isOpen)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-white text-left text-slate-900 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-colors"
            >
              <div className="flex items-center justify-between">
                <span>
                  {selectedId 
                    ? businesses.find(b => b.id === selectedId)?.business_name 
                    : 'Select a business...'}
                </span>
                <svg
                  className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-300 rounded-lg shadow-lg z-10">
                {businesses.length === 0 ? (
                  <div className="px-4 py-3 text-slate-500 text-sm text-center">
                    No businesses available
                  </div>
                ) : (
                  businesses.map(business => (
                    <button
                      key={business.id}
                      onClick={() => {
                        setSelectedId(business.id)
                        setDropdownOpen(false)
                      }}
                      className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${
                        selectedId === business.id ? 'bg-blue-100 font-semibold text-blue-900' : 'text-slate-900'
                      }`}
                    >
                      <div className="font-medium">{business.business_name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {business.registration_type && `${business.registration_type.charAt(0).toUpperCase() + business.registration_type.slice(1)}`}
                        {business.city_of_registration && ` • ${business.city_of_registration}`}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Select Button */}
        <button
          onClick={handleSelectBusiness}
          disabled={!selectedId}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-semibold transition-colors mb-3"
        >
          Select Business
        </button>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-slate-500">Or</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => {
              setDropdownOpen(false)
              onCreateNew()
            }}
            className="w-full px-4 py-3 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 font-semibold transition-colors"
          >
            <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New Business
          </button>
          <button
            onClick={() => {
              setDropdownOpen(false)
              onAddExisting()
            }}
            className="w-full px-4 py-3 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold transition-colors"
          >
            <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4M9 9l3-3 3 3m0 6l-3 3-3-3" />
            </svg>
            Add Existing Business
          </button>
        </div>
      </div>
    </div>
  )
}
