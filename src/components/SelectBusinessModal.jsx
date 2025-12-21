import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import ResponsiveModal from './ResponsiveModal'
import ResponsiveButton from './ResponsiveButton'

export default function SelectBusinessModal({ businesses, onSelect, onCreateNew, onAddExisting, onClose }) {
  const [isOpen, setDropdownOpen] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [savingDefault, setSavingDefault] = useState(false)

  const handleSelectBusiness = async () => {
    if (selectedId) {
      const selected = businesses.find(b => b.id === selectedId)
      if (selected) {
        if (isDefault) {
          setSavingDefault(true)
          try {
            await supabase
              .from('businesses')
              .update({ is_default: true })
              .eq('id', selectedId)
            
            onSelect({ ...selected, is_default: true })
          } catch (error) {
            console.error('Error setting default business:', error)
            onSelect(selected)
          } finally {
            setSavingDefault(false)
          }
        } else {
          onSelect(selected)
        }
        
        setDropdownOpen(false)
        setSelectedId('')
        setIsDefault(false)
      }
    }
  }

  return (
    <ResponsiveModal
      isOpen={true}
      onClose={onClose}
      title="Please Select a Business"
      size="lg"
      footer={
        <>
          <ResponsiveButton
            variant="secondary"
            onClick={() => {
              setDropdownOpen(false)
              onCreateNew?.()
            }}
            fullWidth
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New
          </ResponsiveButton>
          <ResponsiveButton
            variant="secondary"
            onClick={() => {
              setDropdownOpen(false)
              onAddExisting?.()
            }}
            fullWidth
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Existing
          </ResponsiveButton>
        </>
      }
    >
      {/* Content */}
      <div className="space-y-4 sm:space-y-6">
        {/* Description */}
        <p className="text-sm sm:text-base text-slate-600">
          Choose from your available businesses or create a new one.
        </p>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-100">
            <svg className="w-7 h-7 sm:w-8 sm:h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 0v2m0-6v-2m0 0V7a2 2 0 012-2h.5a4.5 4.5 0 110 9H12a2 2 0 01-2-2v-.5a4 4 0 014-4h0m0 0V7m0 0h-1" />
            </svg>
          </div>
        </div>

        {/* Business Dropdown */}
        <div>
          <label className="block text-sm sm:text-base font-medium text-slate-900 mb-2">
            Available Businesses
          </label>
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!isOpen)}
              className="w-full px-3 sm:px-4 py-3 sm:py-4 border border-slate-300 rounded-lg bg-white text-left text-sm sm:text-base text-slate-900 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-colors min-h-11 sm:min-h-12"
            >
              <div className="flex items-center justify-between">
                <span>
                  {selectedId 
                    ? businesses.find(b => b.id === selectedId)?.business_name 
                    : 'Select a business...'}
                </span>
                <svg
                  className={`w-4 h-4 sm:w-5 sm:h-5 text-slate-400 transition-transform flex-shrink-0 ml-2`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </button>

            {/* Dropdown Menu - Responsive positioning */}
            {isOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-300 rounded-lg shadow-lg z-10 max-h-72 sm:max-h-96 overflow-y-auto">
                {businesses.length === 0 ? (
                  <div className="px-3 sm:px-4 py-3 sm:py-4 text-slate-500 text-sm text-center">
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
                      className={`w-full text-left px-3 sm:px-4 py-3 sm:py-4 min-h-11 sm:min-h-12 hover:bg-blue-50 transition-colors text-sm sm:text-base flex items-center justify-between ${
                        selectedId === business.id ? 'bg-blue-100 font-semibold text-blue-900' : 'text-slate-900'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{business.business_name}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {business.registration_type && `${business.registration_type.charAt(0).toUpperCase() + business.registration_type.slice(1)}`}
                          {business.city_of_registration && ` • ${business.city_of_registration}`}
                        </div>
                      </div>
                      {business.is_default && (
                        <div className="ml-2 text-sm font-semibold text-blue-600 flex-shrink-0">✓</div>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Default Business Checkbox */}
        {selectedId && (
          <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-2 focus:ring-blue-600 cursor-pointer"
              />
              <span className="ml-2 sm:ml-3 text-xs sm:text-sm font-medium text-slate-900">
                Set as default business
              </span>
            </label>
            <p className="text-xs text-slate-600 mt-2 ml-6">
              Automatically selected on next visit
            </p>
          </div>
        )}

        {/* Select Button */}
        <ResponsiveButton
          variant="primary"
          onClick={handleSelectBusiness}
          disabled={!selectedId || savingDefault}
          loading={savingDefault}
          fullWidth
        >
          {savingDefault ? 'Saving...' : 'Select Business'}
        </ResponsiveButton>
      </div>
    </ResponsiveModal>
  )
}
