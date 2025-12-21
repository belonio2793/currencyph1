import React from 'react'
import { useDevice } from '../context/DeviceContext'

/**
 * Responsive Modal Component
 * Automatically adapts to mobile (fullscreen) and desktop (centered dialog)
 * Features:
 * - Mobile: fullscreen with rounded top corners
 * - Tablet: medium-sized centered dialog
 * - Desktop: large centered dialog with max constraints
 */
export default function ResponsiveModal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md', // sm, md, lg, xl, fullscreen
  showCloseButton = true,
  className = ''
}) {
  const { isMobile, isTablet, isDesktop } = useDevice()

  if (!isOpen) return null

  // Determine modal size based on device and size prop
  const getSizeClasses = () => {
    if (isMobile) {
      return 'inset-0 rounded-t-2xl'
    }
    
    const sizeMap = {
      sm: 'w-full max-w-sm',
      md: 'w-full max-w-md',
      lg: 'w-full max-w-lg',
      xl: 'w-full max-w-2xl',
      fullscreen: 'w-full max-w-none'
    }
    
    return sizeMap[size] || sizeMap.md
  }

  const sizeClasses = getSizeClasses()
  const paddingClasses = isMobile ? 'p-4 sm:p-6' : 'p-6 sm:p-8'
  const headerPaddingClasses = isMobile ? 'p-4 sm:p-6' : 'p-6 sm:p-8'
  const footerPaddingClasses = isMobile ? 'p-4 sm:p-6' : 'p-6 sm:p-8'
  const titleClasses = isMobile ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div
        className={`fixed z-50 bg-white rounded-lg overflow-hidden flex flex-col transition-all ${
          isMobile
            ? 'inset-0 rounded-t-2xl rounded-b-none'
            : `top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${sizeClasses}`
        } ${className}`}
        style={{
          maxHeight: isMobile ? '100vh' : '90vh'
        }}
      >
        {/* Header */}
        {title && (
          <div
            className={`${headerPaddingClasses} border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10`}
          >
            <h2 className={`font-bold text-slate-900 ${titleClasses}`}>
              {title}
            </h2>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="ml-4 p-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
                aria-label="Close modal"
              >
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className={`flex-1 overflow-y-auto ${paddingClasses}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className={`${footerPaddingClasses} border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0 bg-slate-50 flex-wrap`}
          >
            {footer}
          </div>
        )}
      </div>
    </>
  )
}
