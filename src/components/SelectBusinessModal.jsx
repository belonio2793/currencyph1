import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import ExpandableModal from './ExpandableModal'
import { useDevice } from '../context/DeviceContext'

export default function SelectBusinessModal({ businesses, onSelect, onCreateNew, onAddExisting, onClose }) {
  const { isMobile } = useDevice()
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
        
        setSelectedId('')
        setIsDefault(false)
      }
    }
  }

  const footer = (
    <div className="flex gap-2 w-full">
      <button
        type="button"
        onClick={() => onCreateNew?.()}
        className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition-colors flex items-center justify-center gap-2 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Create New
      </button>
      <button
        type="button"
        onClick={() => onAddExisting?.()}
        className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition-colors flex items-center justify-center gap-2 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Existing
      </button>
      <button
        type="button"
        onClick={handleSelectBusiness}
        disabled={!selectedId || savingDefault}
        className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 font-medium transition-colors text-sm"
      >
        {savingDefault ? 'Saving...' : 'Select'}
      </button>
    </div>
  )

  return (
    <ExpandableModal
      isOpen={true}
      onClose={onClose}
      title="Select a Business"
      icon="🏢"
      size="md"
      footer={footer}
      defaultExpanded={!isMobile}
    >
      <div className="space-y-4">
        {businesses && businesses.length > 0 ? (
          <div className="space-y-2">
            {businesses.map((business) => (
              <div
                key={business.id}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedId === business.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
                onClick={() => setSelectedId(business.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{business.business_name}</h3>
                    {business.city_of_registration && (
                      <p className="text-sm text-slate-600">{business.city_of_registration}</p>
                    )}
                    {business.is_default && (
                      <span className="inline-block mt-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  {selectedId === business.id && (
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-slate-500">No businesses found</p>
          </div>
        )}

        {selectedId && (
          <label className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
            />
            <span className="text-sm font-medium text-slate-700">Set as default business</span>
          </label>
        )}
      </div>
    </ExpandableModal>
  )
}
