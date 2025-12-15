import React from 'react'
import { useDevice } from '../../context/DeviceContext'

export function MobileModal({ 
  isOpen, 
  onClose, 
  title, 
  children,
  actions
}) {
  const { isMobile } = useDevice()

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`fixed z-50 bg-white rounded-lg overflow-hidden flex flex-col ${
        isMobile 
          ? 'inset-0 rounded-none' 
          : 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md'
      }`}>
        {/* Header */}
        {title && (
          <div className="border-b border-slate-100 p-4 sm:p-6 flex items-center justify-between">
            <h2 className={`font-bold text-slate-900 ${isMobile ? 'text-lg' : 'text-2xl'}`}>
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className={`flex-1 overflow-y-auto ${isMobile ? 'p-4' : 'p-6'}`}>
          {children}
        </div>

        {/* Actions */}
        {actions && (
          <div className={`border-t border-slate-100 flex gap-2 ${isMobile ? 'p-4' : 'p-6'}`}>
            {actions}
          </div>
        )}
      </div>
    </>
  )
}
